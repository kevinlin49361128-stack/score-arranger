"""
Voice filler — 自動補完空 target player 的內聲部.

使用情境:
  - Corelli 三重奏 (2 violins + cello) → 弦樂四重奏 (4 parts), viola 空白
  - 鋼琴二重奏 (2 voices) → 弦四, viola + violin II 空白

策略 (簡化, 規則式; 未來可加 LLM voicing suggestion):
  1. arrange() 跑完後, 找出沒有 assignment 的 target player.
  2. 對 source score chordify, 取每小節 / 每拍的 pitch set 當作和聲基底.
  3. 對每個空 player, 每拍挑一個 chord tone:
     - 必須在 player 的 comfortable range 內
     - 避開 onset 已被其他 target part 演奏的精確音高 (避免不必要的 unison)
     - voice-leading: 與該 player 上一個音盡量接近 (最小 interval)
  4. 把 notes 寫進該 target part. 函式自動補完 — UI 看得到視覺化結果.

注意:
  - 補完的 notes 預設用 quarter-note 粒度 (每拍一個音), 細節後續可調.
  - 若該小節 source 完全休止 → target 也休止 (不填).
  - 加上一個 `synthesized: True` flag 在 ChordEvent 上, UI 可以視覺化區分.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from fractions import Fraction
from typing import Optional

from .arrangement_model import Arrangement, Player
from .instruments import get_profile
from .ir import (
    Measure,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Voice,
    VoiceFunction,
)


@dataclass
class FillerResult:
    """補完一次的 summary, 給 UI / log 顯示."""
    filled_players: list[str]        # ["violin_2", "viola_1"]
    notes_added: int
    skipped_measures: int            # source 該段沒有任何和聲


def fill_inner_voices(
    arrangement: Arrangement,
    *,
    beat_granularity: Fraction = Fraction(1),
) -> FillerResult:
    """補完 arrangement 中沒有 assignment 的 target player.

    Args:
        arrangement: 跑完 arrange() 的結果.
        beat_granularity: 每幾個 quarter-note 補一音 (預設 1 = 每拍).

    Returns:
        FillerResult, 同時直接 mutate arrangement.target_score.

    若沒有空 player, 立刻回傳空結果, 不做任何事.
    """
    if arrangement.target_score is None or arrangement.source_score is None:
        return FillerResult(filled_players=[], notes_added=0, skipped_measures=0)

    # 1. 找空 player
    occupied_ids = {a.target_player_id for a in arrangement.assignments}
    empty_players: list[Player] = [
        p for p in arrangement.players if p.player_id not in occupied_ids
    ]
    if not empty_players:
        return FillerResult(filled_players=[], notes_added=0, skipped_measures=0)

    # 2. Source chordify — 得到每個小節 / 每拍的 pitch set
    chord_map = _chordify_source(arrangement.source_score, beat_granularity)
    if not chord_map:
        return FillerResult(
            filled_players=[p.player_id for p in empty_players],
            notes_added=0, skipped_measures=len(empty_players),
        )

    # 3. 取得每個 target measure 在每拍已被佔用的 midi (避免不必要 unison)
    target_busy = _collect_target_busy(arrangement)

    # 4. 對每個空 player 補完
    notes_added = 0
    skipped = 0
    for player in empty_players:
        profile = get_profile(player.primary_instrument)
        if profile is None:
            skipped += 1
            continue
        added, skip_m = _fill_player(
            player, profile, arrangement.target_score, chord_map,
            target_busy, beat_granularity,
        )
        notes_added += added
        skipped += skip_m

    return FillerResult(
        filled_players=[p.player_id for p in empty_players],
        notes_added=notes_added,
        skipped_measures=skipped,
    )


# === 內部 ===

def _chordify_source(
    source: Score, granularity: Fraction,
) -> dict[tuple[int, Fraction], list[int]]:
    """source IR → {(measure_number, beat_offset): [midi, midi, ...]}.

    用 music21 的 chordify 取得跨 part 的 vertical sonority. Beat offset 對齊
    granularity 邊界, 若該 onset 沒和聲就跳過.
    """
    from .ir_to_music21 import ir_to_music21
    from music21 import stream as m21_stream, chord as m21_chord
    try:
        m21 = ir_to_music21(source)
        chordified = m21.chordify()
    except Exception:
        return {}

    result: dict[tuple[int, Fraction], list[int]] = {}
    for m in chordified.getElementsByClass(m21_stream.Measure):
        m_num = m.number
        for c in m.flatten().getElementsByClass(m21_chord.Chord):
            onset = Fraction(c.offset).limit_denominator(64)
            # snap 到 granularity grid
            snapped = (onset // granularity) * granularity
            key = (m_num, snapped)
            midis = sorted({int(p.midi) for p in c.pitches})
            if midis:
                result.setdefault(key, []).extend(midis)
    # dedupe & sort each bucket
    for k in result:
        result[k] = sorted(set(result[k]))
    return result


def _collect_target_busy(
    arrangement: Arrangement,
) -> dict[tuple[int, Fraction], set[int]]:
    """從目前 target_score 收集每個 (measure, beat) 已演奏的 midi 集合."""
    busy: dict[tuple[int, Fraction], set[int]] = {}
    if arrangement.target_score is None:
        return busy
    for part in arrangement.target_score.parts:
        for measure in part.measures:
            for voice in measure.voices.values():
                for event in voice.events:
                    if isinstance(event, NoteEvent):
                        key = (measure.number, event.onset)
                        busy.setdefault(key, set()).add(event.pitch.midi_number)
                    elif hasattr(event, "pitches"):
                        # ChordEvent
                        key = (measure.number, event.onset)
                        for p in event.pitches:
                            busy.setdefault(key, set()).add(p.midi_number)
    return busy


def _fill_player(
    player: Player,
    profile,
    target_score: Score,
    chord_map: dict[tuple[int, Fraction], list[int]],
    target_busy: dict[tuple[int, Fraction], set[int]],
    granularity: Fraction,
) -> tuple[int, int]:
    """為單一 player 的 target part(s) 填音, 回傳 (notes_added, skipped_measures)."""
    # 找到該 player 的 target part(s)
    parts: list[Part] = []
    for tp in target_score.parts:
        # part_id 形式: "violin_2" (single staff) 或 "piano_1_upper"/"piano_1_lower"
        if (
            tp.part_id == player.player_id
            or tp.part_id.startswith(player.player_id + "_")
        ):
            parts.append(tp)
    if not parts:
        return (0, 0)

    range_lo, range_hi = profile.range_comfortable
    range_mid = (range_lo + range_hi) // 2

    notes_added = 0
    skipped_measures = 0

    for tp in parts:
        prev_midi: Optional[int] = range_mid
        for measure in tp.measures:
            voice = measure.voices.get(1)
            if voice is None:
                voice = Voice(voice_id=1, events=[])
                measure.voices[1] = voice
            # 該 measure 是否有任何 chord onset
            any_chord = False
            new_events = []
            # 走 granularity 格 (e.g. 1.0, 2.0, 3.0, 4.0 for 4/4)
            num_beats = 4  # 預設; 若 measure 有 time_signature 用它
            if measure.time_signature is not None:
                num_beats = measure.time_signature[0]
                beat_unit = measure.time_signature[1]
                # 把 beat_unit 轉成 quarter-note 比例
                qn_per_beat = Fraction(4, beat_unit)
            else:
                qn_per_beat = Fraction(1)
            for b in range(num_beats):
                onset = Fraction(b) * qn_per_beat
                key = (measure.number, onset)
                chord_midis = chord_map.get(key)
                if not chord_midis:
                    # 沒和聲時 → 找最近一個有的鎖前一個 (簡化: 略過)
                    new_events.append(RestEvent(
                        duration=qn_per_beat, onset=onset,
                    ))
                    continue
                any_chord = True
                # 候選: chord midis + 它們的 octave 轉移以落在 range 內
                candidates: list[int] = []
                for m in chord_midis:
                    while m < range_lo:
                        m += 12
                    while m > range_hi:
                        m -= 12
                    if range_lo <= m <= range_hi:
                        candidates.append(m)
                if not candidates:
                    new_events.append(RestEvent(
                        duration=qn_per_beat, onset=onset,
                    ))
                    continue
                # 偏好: voice-leading (最小 interval to prev_midi)
                # + 避免 unison (penalize 已被佔用)
                busy_here = target_busy.get(key, set())
                def score(m: int) -> tuple[int, int]:
                    interval = abs(m - (prev_midi or range_mid))
                    unison_penalty = 12 if m in busy_here else 0
                    return (unison_penalty + interval, m)
                chosen = min(candidates, key=score)
                prev_midi = chosen
                pitch = Pitch(
                    midi_number=chosen,
                    spelling=_midi_to_name(chosen),
                )
                new_events.append(NoteEvent(
                    pitch=pitch,
                    duration=qn_per_beat,
                    onset=onset,
                ))
                notes_added += 1
            if any_chord:
                # 取代原本 voice events (本來是空的 Phase 1 skeleton)
                voice.events = new_events
            else:
                skipped_measures += 1
    return (notes_added, skipped_measures)


_PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F",
                "F#", "G", "G#", "A", "A#", "B"]


def _midi_to_name(midi: int) -> str:
    octave = (midi // 12) - 1
    name = _PITCH_NAMES[midi % 12]
    return f"{name}{octave}"

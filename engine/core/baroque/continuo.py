"""
Continuo realization — 從 bass line 自動生成大鍵琴右手和聲填充.

簡化策略 (Phase 1, 規則式):
  1. 找 source 的 BASS-tagged part (cello / bass_voice / double_bass / 8va bass).
  2. 偵測 source 整體調性 (music21 key analysis).
  3. 對 bass 的每個音, 用 figured bass 標記 (若有) 或 default 5-3 (root position
     diatonic triad) 推算上方和聲.
  4. 把和聲填到 target 的 harpsichord upper staff (player_id="harpsichord_1",
     staff="upper").

注意:
- 不嘗試「voice leading 完美」, 只求 functional 正確 (對應的 chord tone)
- 避免太密 (每拍一個和弦, 不分拍細放)
- 若 source 已標 figured bass, 優先用標記; 否則 fallback 為 diatonic 推測.

未來擴充:
- 解析 MusicXML 的 <figured-bass> 元素
- voice leading DP (避免平行五度 / 八度)
- LLM-augmented voicing (給 baroque style examples)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from typing import Optional

from ..arrangement_model import Arrangement
from ..instruments import get_profile
from ..ir import (
    ChordEvent,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Voice,
    VoiceFunction,
)


@dataclass
class ContinuoRealizationResult:
    realized_chord_count: int = 0
    target_player_id: Optional[str] = None
    skipped_reason: Optional[str] = None
    notes: list[str] = field(default_factory=list)


# Diatonic triads (root, third, fifth) for each scale degree in major / minor
# Returns set of semitone offsets above the bass pitch.
# 大調: I = M3+P5, ii = m3+P5, iii = m3+P5, IV = M3+P5, V = M3+P5, vi = m3+P5, vii° = m3+TT
# 簡化: 直接用 diatonic 第三 + 五度 (上方七音內取最近)
_MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]  # ionian
_MINOR_SCALE_SEMITONES = [0, 2, 3, 5, 7, 8, 10]  # natural minor


def _diatonic_triad_above(
    bass_midi: int, tonic_pc: int, is_major: bool,
) -> list[int]:
    """從調性 + bass 推 root-position triad 的上方兩音 (3rd + 5th).

    回傳 [third_midi, fifth_midi]; 若無法判定 (bass 不在音階上), 回傳 [].
    """
    scale = _MAJOR_SCALE_SEMITONES if is_major else _MINOR_SCALE_SEMITONES
    # bass pitch class 相對 tonic 的 degree (0-6)
    pc_offset = (bass_midi - tonic_pc) % 12
    if pc_offset not in scale:
        return []
    degree = scale.index(pc_offset)  # 0=I, 1=ii, ...
    # 3rd above = degree+2, 5th above = degree+4 (in scale steps)
    third_pc = scale[(degree + 2) % 7]
    fifth_pc = scale[(degree + 4) % 7]
    # 把 pc 轉成 midi: 至少比 bass 高 1 個半音, 從同八度找最低
    def first_above(target_pc: int) -> int:
        m = (bass_midi // 12) * 12 + ((tonic_pc + target_pc) % 12)
        while m <= bass_midi:
            m += 12
        return m
    return [first_above(third_pc), first_above(fifth_pc)]


def realize_continuo(
    arrangement: Arrangement,
    target_player_id: str = "harpsichord_1",
    target_staff: str = "upper",
) -> ContinuoRealizationResult:
    """從 source bass line 生成 continuo 和聲填充到 target.

    Mutates arrangement.target_score in place. 假設目標 (player_id, staff)
    存在於 target_score, 通常用 baroque_trio_sonata / violin_harpsichord ensemble.
    """
    result = ContinuoRealizationResult(target_player_id=target_player_id)

    if arrangement.target_score is None or arrangement.source_score is None:
        result.skipped_reason = "no source/target score"
        return result

    # 找目標 part
    target_part_id = (
        f"{target_player_id}_{target_staff}"
        if target_staff != "main" else target_player_id
    )
    target_part: Optional[Part] = next(
        (p for p in arrangement.target_score.parts
         if p.part_id == target_part_id),
        None,
    )
    if target_part is None:
        result.skipped_reason = f"target part {target_part_id} not found"
        return result

    # 偵測 key
    try:
        from music21 import key as m21_key
        from ..ir_to_music21 import ir_to_music21
        m21 = ir_to_music21(arrangement.source_score)
        key_obj = m21.analyze("key")
        is_major = key_obj.mode == "major"
        # tonic pitch class (C=0, C#=1, ...)
        tonic_pc = key_obj.tonic.pitchClass
    except Exception as e:
        result.skipped_reason = f"key analysis failed: {e}"
        return result

    # 找 source bass part — 偏好 BASS function tag, 否則最低音域的 part
    source = arrangement.source_score
    bass_part = _find_bass_part(source)
    if bass_part is None:
        result.skipped_reason = "no bass part found"
        return result

    profile = get_profile("harpsichord")
    range_lo, range_hi = profile.range_comfortable if profile else (36, 84)
    # upper staff: 偏好中音域 (C4-G5)
    upper_min = max(range_lo, 60)
    upper_max = min(range_hi, 79)

    # 對 bass 每個音生成 chord
    realized_chords: dict[tuple[int, Fraction], ChordEvent] = {}
    for measure in bass_part.measures:
        for voice in measure.voices.values():
            for ev in voice.events:
                if not isinstance(ev, NoteEvent):
                    continue
                bass_midi = ev.pitch.midi_number
                upper = _diatonic_triad_above(bass_midi, tonic_pc, is_major)
                if not upper:
                    continue
                # 把 upper notes 調到 upper staff comfortable
                adjusted = []
                for m in upper:
                    while m < upper_min:
                        m += 12
                    while m > upper_max:
                        m -= 12
                    if upper_min <= m <= upper_max:
                        adjusted.append(m)
                if not adjusted:
                    continue
                pitches = [
                    Pitch(midi_number=m, spelling=_midi_to_name(m))
                    for m in sorted(set(adjusted))
                ]
                if len(pitches) < 2:
                    continue
                realized_chords[(measure.number, ev.onset)] = ChordEvent(
                    pitches=pitches,
                    duration=ev.duration,
                    onset=ev.onset,
                )

    # 寫入 target_part — 取代既有 voice 1 events
    for measure in target_part.measures:
        new_events = []
        beats_used = []
        # 收集這小節的 realized chords
        for (mnum, onset), chord in sorted(
            realized_chords.items(), key=lambda kv: (kv[0][0], kv[0][1]),
        ):
            if mnum == measure.number:
                new_events.append(chord)
                beats_used.append((onset, chord.duration))
                result.realized_chord_count += 1
        if new_events:
            voice = measure.voices.get(1)
            if voice is None:
                voice = Voice(voice_id=1, events=[])
                measure.voices[1] = voice
            voice.events = new_events

    return result


def _find_bass_part(source: Score) -> Optional[Part]:
    """找 source 的 bass: 優先 BASS function-tagged, 否則音域最低的 part."""
    # 1. function-tagged
    for part in source.parts:
        for func in part.function_tags.values():
            if func == VoiceFunction.BASS:
                return part
    # 2. fallback: 音域最低
    def part_low(p: Part) -> int:
        midis = [
            ev.pitch.midi_number
            for m in p.measures
            for v in m.voices.values()
            for ev in v.events
            if isinstance(ev, NoteEvent)
        ]
        return min(midis) if midis else 999
    if source.parts:
        return min(source.parts, key=part_low)
    return None


_PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F",
                "F#", "G", "G#", "A", "A#", "B"]


def _midi_to_name(midi: int) -> str:
    octave = (midi // 12) - 1
    name = _PITCH_NAMES[midi % 12]
    return f"{name}{octave}"

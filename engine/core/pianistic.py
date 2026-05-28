"""
Pianistic texture 引擎 — 把柱式和弦展開為慣用鋼琴織體.

問題: arranger 把管弦樂多聲部塞進鋼琴雙手後, lower staff 常是一串柱式和弦
(block chords) — 不符合真實鋼琴演奏習慣 (unpianistic).

本模組把「一個長時值和弦」展開為常見伴奏織體:
  - alberti      — 阿爾貝蒂低音: 低-高-中-高 (古典時期最常見)
  - broken       — 分解和弦: 低-中-高-中 (上行波浪)
  - octave_tremolo — 八度震音: 低音與其上八度快速交替 (戲劇張力)

只在 piano lower staff (左手) 套用, 且必須是時值夠長的和弦 (≥ half note),
避免破壞已經有節奏的聲部.

呼叫時機: style preset post-hook (film_score_piano 等) 或使用者明確要求.

附加功能 (0.1.56 L1): `_post_auto_pedal` — 根據和聲變化點自動下/抬踏板.
僅針對 sustain_type=="pedal" 樂器 (鋼琴/有踏板樂器), 大鍵琴自動跳過.
浪漫鋼琴 preset 用. 標記寫入 Score.pedals.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Literal, Optional

from .arrangement_model import Arrangement
from .ir import ChordEvent, NoteEvent, PedalMark, Pitch, RestEvent, Voice


TextureKind = Literal["alberti", "broken", "octave_tremolo"]


@dataclass
class TextureResult:
    chords_expanded: int
    notes_generated: int
    texture: str


# 一個和弦最少要這麼長才值得展開 (quarter-note 單位); 短和弦展開會太密.
_MIN_DURATION = Fraction(2)
# 展開後每個小音符的時值
_SUBDIVISION = Fraction(1, 2)


def apply_pianistic_texture(
    arrangement: Arrangement,
    texture: TextureKind = "alberti",
    *,
    target_player_id: str = "piano_1",
    target_staff: str = "lower",
) -> TextureResult:
    """把 target 的鋼琴左手柱式和弦展開為指定織體.

    Mutates arrangement.target_score in place.
    """
    result = TextureResult(chords_expanded=0, notes_generated=0,
                           texture=texture)
    if arrangement.target_score is None:
        return result

    part_id = (
        f"{target_player_id}_{target_staff}"
        if target_staff != "main" else target_player_id
    )
    part = next(
        (p for p in arrangement.target_score.parts if p.part_id == part_id),
        None,
    )
    if part is None:
        return result

    for measure in part.measures:
        voice = measure.voices.get(1)
        if voice is None:
            continue
        new_events: list = []
        for ev in voice.events:
            if isinstance(ev, ChordEvent) and ev.duration >= _MIN_DURATION:
                expanded = _expand_chord(ev, texture)
                if expanded:
                    new_events.extend(expanded)
                    result.chords_expanded += 1
                    result.notes_generated += len(expanded)
                    continue
            new_events.append(ev)
        voice.events = new_events

    return result


def _expand_chord(chord: ChordEvent, texture: TextureKind) -> list[NoteEvent]:
    """把一個 ChordEvent 展開成一串 NoteEvent (依 texture 圖樣)."""
    pitches = sorted(chord.pitches, key=lambda p: p.midi_number)
    if len(pitches) < 2:
        return []

    low = pitches[0]
    high = pitches[-1]
    mid = pitches[len(pitches) // 2]

    # 依織體決定循環圖樣 (index into [low, mid, high])
    if texture == "alberti":
        # 阿爾貝蒂: 低-高-中-高
        pattern = [low, high, mid, high]
    elif texture == "broken":
        # 分解和弦: 低-中-高-中
        pattern = [low, mid, high, mid]
    elif texture == "octave_tremolo":
        # 八度震音: 低音 與 低音+12 交替
        oct_up = Pitch(
            midi_number=min(127, low.midi_number + 12),
            spelling=low.spelling,
        )
        pattern = [low, oct_up]
    else:
        return []

    # 依 chord 總時值切成 _SUBDIVISION 的格子, 循環套 pattern
    total = chord.duration
    n_slots = int(total / _SUBDIVISION)
    if n_slots < 2:
        return []

    events: list[NoteEvent] = []
    for i in range(n_slots):
        src = pattern[i % len(pattern)]
        onset = chord.onset + _SUBDIVISION * i
        events.append(NoteEvent(
            pitch=Pitch(
                midi_number=src.midi_number,
                spelling=src.spelling,
            ),
            duration=_SUBDIVISION,
            onset=onset,
            dynamic=chord.dynamic,
        ))
    return events


# ============================================================================
# 0.1.56 L1 — Auto pedal (chord-change heuristic)
# ============================================================================

# 用 pitch-class set 當 harmony fingerprint; root 取最低音的 pc 當「bass root」,
# 再聯合 quality (set of pc 上方音) 比對相鄰 onset 是否變化.
# 沒從 m21 ChordSymbol 走是因為 chordify 在多 part / 雙 staff 上不穩, 而
# pc-set 直接從 IR 算更可預期.
_HarmonyKey = tuple[int, frozenset[int]]


def _harmony_at_onset(
    pcs_active: list[tuple[int, int]],
) -> Optional[_HarmonyKey]:
    """從 (pc, midi) 列表算出和聲指紋: (root_pc, frozenset of pcs).

    root 取 midi 最低的 pc — 在鋼琴情境下 bass 大多在 lower staff 底.
    若沒任何活動音 → None (休止狀態, 不算 harmony 變化).
    """
    if not pcs_active:
        return None
    pcs_active_sorted = sorted(pcs_active, key=lambda t: t[1])
    root_pc = pcs_active_sorted[0][0]
    pc_set = frozenset(t[0] for t in pcs_active)
    return (root_pc, pc_set)


def _collect_piano_part_ids(
    arrangement: Arrangement,
    target_player_id: str,
) -> list[str]:
    """piano_1 → ['piano_1_upper', 'piano_1_lower'] (找實際存在的)."""
    if arrangement.target_score is None:
        return []
    score = arrangement.target_score
    candidates = [
        target_player_id,
        f"{target_player_id}_upper",
        f"{target_player_id}_lower",
        f"{target_player_id}_main",
    ]
    return [p.part_id for p in score.parts if p.part_id in candidates]


def _post_auto_pedal(
    arrangement: Arrangement,
    *,
    target_player_id: str = "piano_1",
) -> int:
    """掃 target piano 的所有 part, 在和聲變化點寫入 PedalMark.

    輸出格式: Score.pedals list, 每個 measure 的 onset 串接成連續 down→up→down
    序列 (一段「相同和聲」 = 一對 down/up).

    跳過條件:
      - 樂器 sustain_type != "pedal" (大鍵琴 / decay 樂器)
      - 該 part 沒任何 NoteEvent/ChordEvent

    回傳寫入的 PedalMark 數量 (一對 down/up = 2).
    """
    from .instruments import get_profile

    if arrangement.target_score is None:
        return 0

    part_ids = _collect_piano_part_ids(arrangement, target_player_id)
    if not part_ids:
        return 0

    score = arrangement.target_score
    parts = [p for p in score.parts if p.part_id in part_ids]

    # 跳過非踏板樂器 — 取第一個 part 的 instrument_id 判斷; piano upper/lower
    # 都同 instrument_id.
    instr_id = parts[0].instrument_id
    profile = get_profile(instr_id)
    if profile is None or profile.sustain_type != "pedal":
        return 0

    # 把 piano 所有 part 在 (measure_number, onset) 點上的 pitch 收集成 timeline.
    # 用 measure.number 對齊不同 staff.
    # 偏好只看 lower staff — 因為實際鋼琴踏板由左手 bass 和聲決定, melody 旋律
    # 起伏 (高音上裝飾音 / 經過音) 不該觸發換踏. 沒 lower 才退回所有 staff.
    bass_parts = [p for p in parts if p.part_id.endswith("_lower")]
    harmony_parts = bass_parts if bass_parts else parts
    # timeline[(mnum, onset)] = list[(pc, midi)]
    timeline: dict[tuple[int, Fraction], list[tuple[int, int]]] = {}
    for part in harmony_parts:
        for measure in part.measures:
            for voice in measure.voices.values():
                for ev in voice.events:
                    onset_key = (measure.number, Fraction(ev.onset))
                    if isinstance(ev, NoteEvent):
                        timeline.setdefault(onset_key, []).append(
                            (ev.pitch.midi_number % 12, ev.pitch.midi_number)
                        )
                    elif isinstance(ev, ChordEvent):
                        for p in ev.pitches:
                            timeline.setdefault(onset_key, []).append(
                                (p.midi_number % 12, p.midi_number)
                            )

    if not timeline:
        return 0

    # 按 (measure, onset) 排序, 計算每個 onset 的 harmony 指紋
    sorted_onsets = sorted(timeline.keys())
    harmonies: list[tuple[tuple[int, Fraction], Optional[_HarmonyKey]]] = [
        (k, _harmony_at_onset(timeline[k])) for k in sorted_onsets
    ]
    # 過濾掉純休止 (None) — 不影響和聲變化邊界
    harmonies = [h for h in harmonies if h[1] is not None]
    if not harmonies:
        return 0

    # 把 part_id 用作 PedalMark.part_id — 取 lower staff (踏板邏輯上歸左手譜)
    pedal_part_id = next(
        (pid for pid in part_ids if pid.endswith("_lower")),
        part_ids[0],
    )

    # 掃描 harmony 序列, 偵測變化邊界 (root 或 pc-set 變)
    # 每段「同和聲」span 開頭寫 down, 結尾 (下一段開始的前一個 onset) 寫 up.
    # 實作: 用 segment 結構 [(start_onset, end_onset)], 後續轉成 PedalMark.
    segments: list[tuple[tuple[int, Fraction], tuple[int, Fraction]]] = []
    seg_start = harmonies[0][0]
    prev_harmony = harmonies[0][1]

    for i in range(1, len(harmonies)):
        onset_key, harmony = harmonies[i]
        if harmony != prev_harmony:
            # 結束前一段 — end = 上一個 onset (i-1)
            segments.append((seg_start, harmonies[i - 1][0]))
            seg_start = onset_key
            prev_harmony = harmony
    # 收尾最後一段
    segments.append((seg_start, harmonies[-1][0]))

    # 移除舊的 pedals (避免多次套疊)
    score.pedals = [
        p for p in score.pedals if p.part_id != pedal_part_id
    ]

    added = 0
    for start, end in segments:
        score.pedals.append(PedalMark(
            part_id=pedal_part_id,
            span=(start, end),
            kind="sustain",
        ))
        added += 1
    return added

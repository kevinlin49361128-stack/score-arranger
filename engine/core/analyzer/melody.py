"""
主旋律偵測 — Skyline + 評分 + 統計

對應規格: architecture.md §4.2.1 (Melody Extraction)

策略:
- 第一層: Skyline (每時間點最高音)
- 第二層: Contour + Rhythm 評分
- 第三層: Dynamic/Articulation 加權 (Phase 2)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from typing import Optional

from core.ir import (
    ChordEvent,
    NoteEvent,
    Part,
    Score,
    Section,
)


# ============================================================================
# Per-part 統計
# ============================================================================

@dataclass
class PartStats:
    """單一 Part 在單一 Section 內的統計特徵。"""
    part_id: str
    note_count: int = 0
    avg_pitch: float = 0.0
    pitch_range: int = 0
    min_pitch: int = 127
    max_pitch: int = 0
    stepwise_ratio: float = 0.0      # 二度音程比例
    leap_ratio: float = 0.0          # ≥ 五度音程比例
    avg_duration: float = 0.0        # 平均時值 (quarter)
    rhythm_variety: int = 0          # distinct duration 數量
    chord_ratio: float = 0.0         # ChordEvent / 全部 event

    def has_notes(self) -> bool:
        return self.note_count > 0


def compute_part_stats(part: Part, section: Section) -> PartStats:
    """計算 part 在 section 範圍內的統計。"""
    midi_list: list[int] = []
    durations: list[Fraction] = []
    chord_count = 0
    total_events = 0

    for measure in part.measures:
        if not (section.start_measure <= measure.number <= section.end_measure):
            continue
        for voice in measure.voices.values():
            if voice.is_divisi:
                continue
            for event in voice.events:
                if isinstance(event, NoteEvent):
                    midi_list.append(event.pitch.midi_number)
                    durations.append(event.duration)
                    total_events += 1
                elif isinstance(event, ChordEvent):
                    # 用最高音代表 chord (旋律偵測)
                    midi_list.append(
                        max(p.midi_number for p in event.pitches)
                    )
                    durations.append(event.duration)
                    chord_count += 1
                    total_events += 1
                # RestEvent 不計入

    if not midi_list:
        return PartStats(part_id=part.part_id)

    intervals = [
        abs(midi_list[i + 1] - midi_list[i])
        for i in range(len(midi_list) - 1)
    ]
    stepwise = sum(1 for v in intervals if 1 <= v <= 2)
    leaps = sum(1 for v in intervals if v >= 7)

    return PartStats(
        part_id=part.part_id,
        note_count=len(midi_list),
        avg_pitch=sum(midi_list) / len(midi_list),
        pitch_range=max(midi_list) - min(midi_list),
        min_pitch=min(midi_list),
        max_pitch=max(midi_list),
        stepwise_ratio=stepwise / max(len(intervals), 1),
        leap_ratio=leaps / max(len(intervals), 1),
        avg_duration=float(sum(durations)) / len(durations),
        rhythm_variety=len(set(durations)),
        chord_ratio=chord_count / max(total_events, 1),
    )


# ============================================================================
# Skyline
# ============================================================================

def compute_skyline(
    score: Score,
    section: Section,
    beats_per_measure: int = 4,
) -> list[tuple[int, int, str, int]]:
    """回傳 [(measure, beat, top_part_id, midi), ...]。

    在每個 (measure, beat) 採樣最高音, 記錄是哪個 part 提供。
    """
    skyline: list[tuple[int, int, str, int]] = []
    for measure_num in range(section.start_measure, section.end_measure + 1):
        for beat in range(beats_per_measure):
            offset = Fraction(beat)
            top_part: Optional[str] = None
            top_midi: int = -1
            for part in score.parts:
                pitch = _highest_sounding_pitch(part, measure_num, offset)
                if pitch is None:
                    continue
                if pitch > top_midi:
                    top_midi = pitch
                    top_part = part.part_id
            if top_part is not None:
                skyline.append((measure_num, beat, top_part, top_midi))
    return skyline


def compute_baseline(
    score: Score,
    section: Section,
    beats_per_measure: int = 4,
) -> list[tuple[int, int, str, int]]:
    """Skyline 的對偶: 每時間點最低音 → 用於 BASS 偵測。"""
    baseline: list[tuple[int, int, str, int]] = []
    for measure_num in range(section.start_measure, section.end_measure + 1):
        for beat in range(beats_per_measure):
            offset = Fraction(beat)
            bot_part: Optional[str] = None
            bot_midi: int = 128
            for part in score.parts:
                pitch = _lowest_sounding_pitch(part, measure_num, offset)
                if pitch is None:
                    continue
                if pitch < bot_midi:
                    bot_midi = pitch
                    bot_part = part.part_id
            if bot_part is not None:
                baseline.append((measure_num, beat, bot_part, bot_midi))
    return baseline


def _highest_sounding_pitch(
    part: Part, measure_num: int, offset: Fraction
) -> Optional[int]:
    """在 (measure_num, offset) 時刻,此 part 最高的正在發聲音高。"""
    for measure in part.measures:
        if measure.number != measure_num:
            continue
        best: Optional[int] = None
        for voice in measure.voices.values():
            if voice.is_divisi:
                continue
            for event in voice.events:
                if not isinstance(event, (NoteEvent, ChordEvent)):
                    continue
                start = event.onset
                end = event.onset + event.duration
                if start <= offset < end:
                    if isinstance(event, NoteEvent):
                        midi = event.pitch.midi_number
                    else:
                        midi = max(p.midi_number for p in event.pitches)
                    if best is None or midi > best:
                        best = midi
        return best
    return None


def _lowest_sounding_pitch(
    part: Part, measure_num: int, offset: Fraction
) -> Optional[int]:
    for measure in part.measures:
        if measure.number != measure_num:
            continue
        best: Optional[int] = None
        for voice in measure.voices.values():
            if voice.is_divisi:
                continue
            for event in voice.events:
                if not isinstance(event, (NoteEvent, ChordEvent)):
                    continue
                start = event.onset
                end = event.onset + event.duration
                if start <= offset < end:
                    if isinstance(event, NoteEvent):
                        midi = event.pitch.midi_number
                    else:
                        midi = min(p.midi_number for p in event.pitches)
                    if best is None or midi < best:
                        best = midi
        return best
    return None


def skyline_match_ratio(
    skyline: list[tuple[int, int, str, int]],
) -> dict[str, float]:
    """各 part 在 skyline 中出現的比例。"""
    if not skyline:
        return {}
    counts: dict[str, int] = {}
    for _, _, part_id, _ in skyline:
        counts[part_id] = counts.get(part_id, 0) + 1
    total = len(skyline)
    return {pid: cnt / total for pid, cnt in counts.items()}


# ============================================================================
# Melody score (§4.2.1)
# ============================================================================

def melody_score(
    stats: PartStats,
    skyline_match: float,
    max_note_count: int,
    max_rhythm_variety: int,
) -> float:
    """合併 skyline 比例與 contour/rhythm 特徵的旋律分數。

    melody_score = 0.4 * skyline_match
                 + 0.3 * stepwise_ratio
                 + 0.2 * note_density (normalized)
                 + 0.1 * rhythm_variety (normalized)
    """
    if stats.note_count == 0:
        return 0.0
    note_density_norm = stats.note_count / max(max_note_count, 1)
    variety_norm = stats.rhythm_variety / max(max_rhythm_variety, 1)
    return (
        0.4 * skyline_match
        + 0.3 * stats.stepwise_ratio
        + 0.2 * note_density_norm
        + 0.1 * variety_norm
    )


def bass_score(
    stats: PartStats,
    baseline_match: float,
) -> float:
    """BASS 分數: 偏向低音域 + 在 baseline 出現比例高 + leap 比例適中。

    bass_score = 0.5 * baseline_match
               + 0.3 * (1 - avg_pitch / 127)    # 越低音越高分
               + 0.2 * (1 - stepwise_ratio)     # 低音聲部跳音多
    """
    if stats.note_count == 0:
        return 0.0
    avg_pitch_norm = stats.avg_pitch / 127.0
    return (
        0.5 * baseline_match
        + 0.3 * (1 - avg_pitch_norm)
        + 0.2 * (1 - stats.stepwise_ratio)
    )

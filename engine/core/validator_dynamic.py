"""
Playability Validator 層次 B — 動態序列模擬

對應規格: architecture.md §4.5.1 與 §4.5.6 (StringPositionSimulator)

Phase 1 範圍:
- 弦樂把位路徑: 模擬左手把位遷移, 在當前速度下評估可行性

Phase 2 範圍 (留 TODO):
- 鋼琴手部橫移
- 管樂換氣模擬
- 弓向交替
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from typing import Literal, Optional, cast

from .instruments import (
    CheckResult,
    InstrumentProfile,
    SuggestionStub,
    get_profile,
)
from .instruments.fingering import find_best_fingering_sequence
from .ir import ChordEvent, NoteEvent, Part, Pitch, Score


# ============================================================================
# 弦樂把位推算
# ============================================================================

def calculate_violin_position(
    pitch: Pitch, profile: InstrumentProfile,
) -> Optional[int]:
    """根據音高推算最佳把位 (簡化: 找能演奏此音的最低把位)。

    把位定義: 1 = 最低,半音越高 position 越大。
    每提高 2 半音為 1 把位 (粗略),3 半音內視為 1st position。
    """
    if profile.strings is None:
        return None
    for string in reversed(profile.strings):  # 從高弦開始試
        semitones = pitch.midi_number - string.open_pitch.midi_number
        if 0 <= semitones <= 24:
            # 1st position 涵蓋 0-3 半音, 2nd 約 3-5, ...
            if semitones <= 3:
                return 1
            return (semitones - 3) // 2 + 1
    return None


def _fret_to_position(fret: int) -> int:
    """fret (空弦上方半音數) → 左手把位; 與 calculate_violin_position 同公式。"""
    if fret <= 3:
        return 1
    return (fret - 3) // 2 + 1


# ============================================================================
# Located issue for dynamic validation
# ============================================================================

@dataclass
class DynamicIssue:
    """動態序列驗證問題。"""
    part_id: str
    measure_number: int
    voice_id: int
    event_index: int
    result: CheckResult


# ============================================================================
# 弦樂把位序列模擬
# ============================================================================

@dataclass
class StringPositionSimulator:
    """模擬弦樂左手把位狀態,追蹤連續音符間的把位跳躍。

    對應 architecture.md §4.5.6 的 StringPositionSimulator。
    """
    profile: InstrumentProfile
    current_position: int = 1
    # 經驗常數
    base_shift_time_sec: float = 0.08      # 把位起跳基礎時間
    per_distance_time_sec: float = 0.03    # 每多 1 把位加成時間
    safety_margin: float = 0.8             # 留 20% 餘裕

    def simulate_part(
        self,
        part: Part,
        tempo_bpm: float = 120.0,
    ) -> list[DynamicIssue]:
        """掃描整個 Part, 用跨事件指法 DP 推導把位路徑並偵測把位跳躍問題。

        把位由 find_best_fingering_sequence 的 viterbi DP 求得 — 相鄰音符的
        把位連貫性已納入考量, 比逐音貪婪估計更貼近真實左手動作 (例如可
        演奏的弦選擇會傾向維持手部位置, 不再每個音各自取最低把位)。
        """
        issues: list[DynamicIssue] = []
        beat_duration = 60.0 / max(tempo_bpm, 1.0)
        self.current_position = 1
        if self.profile.strings is None:
            return issues
        measure_starts = self._cumulative_measure_starts(part)

        # Pass 1: 依序收集所有有音高的事件
        seq: list[tuple[int, int, int, Pitch, Fraction]] = []
        for measure in part.measures:
            for voice in measure.voices.values():
                if voice.is_divisi:
                    continue
                for idx, event in enumerate(voice.events):
                    pitch = self._event_high_pitch(event)
                    if pitch is None:
                        continue
                    global_onset = (
                        measure_starts.get(measure.number, Fraction(0))
                        + event.onset
                    )
                    seq.append((
                        measure.number, voice.voice_id, idx,
                        pitch, global_onset,
                    ))
        if not seq:
            return issues

        # 跨事件 viterbi 指法 DP → 連續性感知的把位路徑
        fingerings = find_best_fingering_sequence(
            [[pitch] for _, _, _, pitch, _ in seq],
            self.profile.strings,
        )

        # Pass 2: 沿 DP 求得的把位序列偵測跳躍
        prev_global_onset: Optional[Fraction] = None
        for (measure_number, voice_id, idx, _pitch, global_onset), fingering \
                in zip(seq, fingerings):
            if fingering is None or not fingering.assignments:
                continue
            required_pos = _fret_to_position(fingering.assignments[0][2])

            if prev_global_onset is not None:
                shift = abs(required_pos - self.current_position)
                if shift > 0:
                    time_available = (
                        float(global_onset - prev_global_onset)
                        * beat_duration
                    )
                    time_needed = (
                        self.base_shift_time_sec
                        + shift * self.per_distance_time_sec
                    )
                    if time_needed > time_available * self.safety_margin:
                        severity = (
                            "error"
                            if time_needed > time_available
                            else "warning"
                        )
                        code = (
                            "E_VIOLIN_POSITION_JUMP_TOO_FAST"
                            if severity == "error"
                            else "W_VIOLIN_POSITION_JUMP_DIFFICULT"
                        )
                        issues.append(DynamicIssue(
                            part_id=part.part_id,
                            measure_number=measure_number,
                            voice_id=voice_id,
                            event_index=idx,
                            result=CheckResult(
                                severity=severity,
                                code=code,
                                params={
                                    "from_position": self.current_position,
                                    "to_position": required_pos,
                                    "shift": shift,
                                    "tempo_bpm": tempo_bpm,
                                    "time_available_sec": round(
                                        time_available, 3,
                                    ),
                                    "time_needed_sec": round(
                                        time_needed, 3,
                                    ),
                                },
                                difficulty_score=min(
                                    time_needed / max(time_available, 1e-6),
                                    1.0,
                                ),
                                suggestions=[
                                    SuggestionStub(code="S_OCTAVE_DOWN"),
                                    SuggestionStub(
                                        code="S_REVOICE_PASSAGE"),
                                ],
                            ),
                        ))

            self.current_position = required_pos
            prev_global_onset = global_onset

        return issues

    @staticmethod
    def _event_high_pitch(event) -> Optional[Pitch]:
        if isinstance(event, NoteEvent):
            return event.pitch
        if isinstance(event, ChordEvent):
            # 取最高音 (旋律線)
            return max(event.pitches, key=lambda p: p.midi_number)
        return None

    def _cumulative_measure_starts(self, part: Part) -> dict[int, Fraction]:
        return _cumulative_measure_starts(part)


def _cumulative_measure_starts(part: Part) -> dict[int, Fraction]:
    """每個 measure 的全局起始 offset (四分音符單位). 給多個 simulator 共用."""
    starts: dict[int, Fraction] = {}
    cumulative = Fraction(0)
    current_ts = (4, 4)
    for measure in part.measures:
        if measure.time_signature:
            current_ts = measure.time_signature
        starts[measure.number] = cumulative
        num, denom = current_ts
        cumulative += Fraction(num * 4, denom)
    return starts


# ============================================================================
# 撥弦樂器跨事件指法 DP (吉他 / 魯特琴)
# ============================================================================

# 各 fretted plucked 樂器的最大實用把位 (與其 *.py 的 *_MAX_FRET 一致)
_FRETTED_MAX_FRET: dict[str, int] = {
    "guitar": 19,
    "lute": 12,
}


@dataclass
class FrettedPositionSimulator:
    """撥弦樂器 (吉他/魯特琴) 跨事件指法 DP 模擬器。

    與 StringPositionSimulator 的差異:
    - require_adjacent=False (各弦獨立撥, 可略過中間弦)
    - 每樂器使用自己的 max_fret (吉他 19, 魯特琴 12)
    - 手部把位差距以「把位距離」評估, 跳超過閾值會在快板下標警告
    - 古典吉他換把節奏比擦弦稍寬鬆 — 給較大的 base_shift_time
    """
    profile: InstrumentProfile
    max_fret: int = 19
    base_shift_time_sec: float = 0.10      # 撥弦比擦弦更寬鬆少許
    per_distance_time_sec: float = 0.03
    safety_margin: float = 0.8

    def simulate_part(
        self,
        part: Part,
        tempo_bpm: float = 120.0,
    ) -> list[DynamicIssue]:
        """同 StringPositionSimulator, 但用 require_adjacent=False 跑 DP."""
        issues: list[DynamicIssue] = []
        beat_duration = 60.0 / max(tempo_bpm, 1.0)
        if self.profile.strings is None:
            return issues
        measure_starts = _cumulative_measure_starts(part)

        # 收集事件序列 (每個 event 取 chord 的全部音, 撥弦可同時)
        seq: list[tuple[int, int, int, list[Pitch], Fraction]] = []
        for measure in part.measures:
            for voice in measure.voices.values():
                if voice.is_divisi:
                    continue
                for idx, event in enumerate(voice.events):
                    pitches = self._event_pitches(event)
                    if not pitches:
                        continue
                    global_onset = (
                        measure_starts.get(measure.number, Fraction(0))
                        + event.onset
                    )
                    seq.append((
                        measure.number, voice.voice_id, idx,
                        pitches, global_onset,
                    ))
        if not seq:
            return issues

        fingerings = find_best_fingering_sequence(
            [pitches for _, _, _, pitches, _ in seq],
            self.profile.strings,
            max_fret=self.max_fret,
            max_stretch_semitones=(
                self.profile.max_stretch_semitones or 7
            ),
            require_adjacent=False,
        )

        prev_global_onset: Optional[Fraction] = None
        prev_hand_center: float = 0.0
        for (measure_number, voice_id, idx, _pitches, global_onset), fingering \
                in zip(seq, fingerings):
            if fingering is None or not fingering.assignments:
                continue
            curr_hand_center = fingering.hand_center

            if prev_global_onset is not None and curr_hand_center > 0 \
                    and prev_hand_center > 0:
                shift_frets = abs(curr_hand_center - prev_hand_center)
                if shift_frets > 0:
                    time_available = (
                        float(global_onset - prev_global_onset)
                        * beat_duration
                    )
                    time_needed = (
                        self.base_shift_time_sec
                        + shift_frets * self.per_distance_time_sec
                    )
                    if time_needed > time_available * self.safety_margin:
                        severity = (
                            "error"
                            if time_needed > time_available
                            else "warning"
                        )
                        code = (
                            "E_FRETTED_POSITION_JUMP_TOO_FAST"
                            if severity == "error"
                            else "W_FRETTED_POSITION_JUMP_DIFFICULT"
                        )
                        issues.append(DynamicIssue(
                            part_id=part.part_id,
                            measure_number=measure_number,
                            voice_id=voice_id,
                            event_index=idx,
                            result=CheckResult(
                                severity=cast(
                                    Literal["ok", "warning", "error"],
                                    severity,
                                ),
                                code=code,
                                params={
                                    "from_fret": round(prev_hand_center, 1),
                                    "to_fret": round(curr_hand_center, 1),
                                    "shift": round(shift_frets, 1),
                                    "tempo_bpm": tempo_bpm,
                                    "time_available_sec": round(
                                        time_available, 3,
                                    ),
                                    "time_needed_sec": round(
                                        time_needed, 3,
                                    ),
                                },
                                difficulty_score=min(
                                    time_needed / max(time_available, 1e-6),
                                    1.0,
                                ),
                            ),
                        ))

            prev_global_onset = global_onset
            if curr_hand_center > 0:
                prev_hand_center = curr_hand_center

        return issues

    @staticmethod
    def _event_pitches(event) -> list[Pitch]:
        if isinstance(event, NoteEvent):
            return [event.pitch]
        if isinstance(event, ChordEvent):
            return list(event.pitches)
        return []


# ============================================================================
# 整體流程: 收集動態問題
# ============================================================================

def collect_dynamic_issues(
    score: Score,
    tempo_bpm: Optional[float] = None,
) -> list[DynamicIssue]:
    """掃描整個 Score 跑層次 B 驗證。

    tempo_bpm: 若 None, 用 Score.default_tempo_bpm。
    """
    bpm = tempo_bpm if tempo_bpm is not None else score.default_tempo_bpm

    issues: list[DynamicIssue] = []
    for part in score.parts:
        profile = get_profile(part.instrument_id)
        if profile is None:
            continue
        if profile.family == "string_bowed" and profile.strings:
            simulator = StringPositionSimulator(profile=profile)
            issues.extend(simulator.simulate_part(part, tempo_bpm=bpm))
        elif profile.family == "plucked" and profile.strings:
            max_fret = _FRETTED_MAX_FRET.get(part.instrument_id, 19)
            fretted_sim = FrettedPositionSimulator(
                profile=profile, max_fret=max_fret,
            )
            issues.extend(fretted_sim.simulate_part(part, tempo_bpm=bpm))
        # Phase 2: keyboard 手位橫移 / 管樂氣息
    return issues

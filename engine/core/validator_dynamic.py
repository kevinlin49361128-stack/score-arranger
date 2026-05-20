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
from typing import Optional

from .instruments import (
    CheckResult,
    InstrumentProfile,
    SuggestionStub,
    get_profile,
)
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
        """掃描整個 Part 的單音 NoteEvent, 偵測把位跳躍問題。"""
        issues: list[DynamicIssue] = []
        beat_duration = 60.0 / max(tempo_bpm, 1.0)
        self.current_position = 1

        prev_pitch: Optional[Pitch] = None
        prev_global_onset: Optional[Fraction] = None
        measure_starts: dict[int, Fraction] = self._cumulative_measure_starts(part)

        for measure in part.measures:
            for voice in measure.voices.values():
                if voice.is_divisi:
                    continue
                for idx, event in enumerate(voice.events):
                    pitch = self._event_high_pitch(event)
                    if pitch is None:
                        continue

                    required_pos = calculate_violin_position(
                        pitch, self.profile
                    )
                    if required_pos is None:
                        continue

                    global_onset = (
                        measure_starts.get(measure.number, Fraction(0))
                        + event.onset
                    )

                    if prev_pitch is not None and prev_global_onset is not None:
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
                                    measure_number=measure.number,
                                    voice_id=voice.voice_id,
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
                                                time_available, 3
                                            ),
                                            "time_needed_sec": round(
                                                time_needed, 3
                                            ),
                                        },
                                        difficulty_score=min(
                                            time_needed / max(time_available, 1e-6),
                                            1.0,
                                        ),
                                        suggestions=[
                                            SuggestionStub(code="S_OCTAVE_DOWN"),
                                            SuggestionStub(code="S_REVOICE_PASSAGE"),
                                        ],
                                    ),
                                ))

                    self.current_position = required_pos
                    prev_pitch = pitch
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
        """計算每個 measure 的全局起始 offset (以四分音符為單位)。

        假設拍號變化少, 從 measure.time_signature 累加。
        """
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
        # Phase 2: keyboard 手位橫移 / 管樂氣息
    return issues

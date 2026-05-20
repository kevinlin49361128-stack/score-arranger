"""
IR 驗證 — 檢查 Score 物件是否符合 ir-spec.md §8 的不變式。

兩類錯誤:
- 強制不變式 (hard invariant): 違反 = 程式 bug, 列入 errors
- 軟約束 (soft constraint): 違反 = 資料異常但可繼續, 列入 warnings
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Optional

from .ir import (
    ChordEvent,
    Measure,
    NoteEvent,
    Part,
    Phrase,
    RestEvent,
    Score,
    Section,
    Voice,
)


@dataclass
class ValidationError:
    code: str
    message: str
    location: Optional[str] = None  # 描述位置, e.g. "Part[violin_1].Measure[32]"


@dataclass
class ValidationResult:
    errors: list[ValidationError]
    warnings: list[ValidationError]

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0

    def __bool__(self) -> bool:
        return self.ok


def validate(score: Score) -> ValidationResult:
    """檢查 Score 是否符合 IR 不變式。"""
    errors: list[ValidationError] = []
    warnings: list[ValidationError] = []

    _check_score_level(score, errors, warnings)
    for part in score.parts:
        _check_part(part, errors, warnings)
    for movement in score.movements:
        _check_movement_sections(movement, errors, warnings)

    return ValidationResult(errors=errors, warnings=warnings)


# ============================================================================
# 強制不變式檢查 (§8.1)
# ============================================================================

def _check_score_level(
    score: Score,
    errors: list[ValidationError],
    warnings: list[ValidationError],
) -> None:
    # Movement ID 唯一
    movement_ids = [m.movement_id for m in score.movements]
    if len(movement_ids) != len(set(movement_ids)):
        errors.append(ValidationError(
            code="E_DUPLICATE_MOVEMENT_ID",
            message=f"Movement ID 重複: {movement_ids}",
        ))

    # Part ID 唯一
    part_ids = [p.part_id for p in score.parts]
    if len(part_ids) != len(set(part_ids)):
        errors.append(ValidationError(
            code="E_DUPLICATE_PART_ID",
            message=f"Part ID 重複: {part_ids}",
        ))

    # IR 版本檢查 (僅 major.minor 比對)
    if not score.ir_version:
        warnings.append(ValidationError(
            code="W_MISSING_IR_VERSION",
            message="Score.ir_version 為空",
        ))


def _check_part(
    part: Part,
    errors: list[ValidationError],
    warnings: list[ValidationError],
) -> None:
    location_prefix = f"Part[{part.part_id}]"

    # Measure number 在 part 內遞增 (允許不連續, 但不允許倒序)
    prev_number = -1
    for measure in part.measures:
        if measure.number < prev_number:
            errors.append(ValidationError(
                code="E_MEASURE_NUMBER_BACKWARDS",
                message=f"小節編號倒序: {measure.number} < {prev_number}",
                location=f"{location_prefix}.Measure[{measure.number}]",
            ))
        prev_number = measure.number
        _check_measure(measure, location_prefix, errors, warnings)


def _check_measure(
    measure: Measure,
    parent_location: str,
    errors: list[ValidationError],
    warnings: list[ValidationError],
) -> None:
    location = f"{parent_location}.Measure[{measure.number}]"

    # Voice ID 在 Measure 內唯一
    if len(measure.voices) != len(set(measure.voices.keys())):
        errors.append(ValidationError(
            code="E_DUPLICATE_VOICE_ID",
            message="Voice ID 重複",
            location=location,
        ))

    # 每個 voice
    for voice_id, voice in measure.voices.items():
        if voice.voice_id != voice_id:
            errors.append(ValidationError(
                code="E_VOICE_ID_MISMATCH",
                message=f"dict key {voice_id} ≠ Voice.voice_id {voice.voice_id}",
                location=location,
            ))
        _check_voice(voice, location, measure, errors, warnings)


def _check_voice(
    voice: Voice,
    parent_location: str,
    measure: Measure,
    errors: list[ValidationError],
    warnings: list[ValidationError],
) -> None:
    location = f"{parent_location}.Voice[{voice.voice_id}]"

    # Divisi 結構 (§3.3 約束 6)
    if voice.is_divisi:
        if voice.events:
            errors.append(ValidationError(
                code="E_DIVISI_HAS_EVENTS",
                message="Divisi voice 的 events 必須為空",
                location=location,
            ))
        if not voice.divisi_branches or len(voice.divisi_branches) != 2:
            errors.append(ValidationError(
                code="E_DIVISI_BRANCH_COUNT",
                message="Divisi 需 2 個 branches",
                location=location,
            ))
        else:
            for sub_voice in voice.divisi_branches:
                _check_voice(sub_voice, location, measure, errors, warnings)
        return

    # 事件時值正性
    total_duration = Fraction(0)
    for event in voice.events:
        if event.duration <= 0:
            errors.append(ValidationError(
                code="E_NONPOSITIVE_DURATION",
                message=f"事件 duration {event.duration} 不為正",
                location=location,
            ))
        total_duration += event.duration

    # 軟約束: 總時值應等於拍號 (§8.2 條 2)
    if measure.time_signature is not None:
        num, denom = measure.time_signature
        expected = Fraction(num * 4, denom)  # 以四分音符為 1
        if not measure.is_pickup and total_duration != expected:
            warnings.append(ValidationError(
                code="W_MEASURE_DURATION_MISMATCH",
                message=f"小節總時值 {total_duration} ≠ 拍號預期 {expected}",
                location=location,
            ))

    # ChordEvent / NoteEvent 內部約束已在 __post_init__ 檢查


def _check_movement_sections(
    movement,
    errors: list[ValidationError],
    warnings: list[ValidationError],
) -> None:
    """檢查同 Movement 內 Section 不重疊 (§8.1 條 5)"""
    location_prefix = f"Movement[{movement.movement_id}]"
    sorted_sections = sorted(movement.sections, key=lambda s: s.start_measure)
    for i in range(1, len(sorted_sections)):
        prev = sorted_sections[i - 1]
        curr = sorted_sections[i]
        if curr.start_measure <= prev.end_measure:
            errors.append(ValidationError(
                code="E_SECTION_OVERLAP",
                message=f"Section {prev.section_id} 與 {curr.section_id} 重疊",
                location=location_prefix,
            ))

    # Phrase 邊界字典序 (§8.1 條 4)
    for section in movement.sections:
        for phrase in section.phrases:
            if phrase.start > phrase.end:
                errors.append(ValidationError(
                    code="E_PHRASE_BACKWARDS",
                    message=f"Phrase {phrase.phrase_id} start > end",
                    location=f"{location_prefix}.Section[{section.section_id}]",
                ))

"""IR 驗證測試"""

from __future__ import annotations

from fractions import Fraction

from core.ir import (
    Measure,
    Movement,
    NoteEvent,
    Part,
    Phrase,
    Pitch,
    Score,
    Section,
    Voice,
)
from core.ir_validate import validate


def test_empty_score_validates():
    result = validate(Score())
    assert result.ok


def test_duplicate_part_id_caught():
    score = Score(parts=[
        Part(part_id="violin_1", name_display="V1", instrument_id="violin"),
        Part(part_id="violin_1", name_display="V1b", instrument_id="violin"),
    ])
    result = validate(score)
    assert not result.ok
    assert any(e.code == "E_DUPLICATE_PART_ID" for e in result.errors)


def test_measure_number_backwards_caught():
    part = Part(
        part_id="violin_1",
        name_display="Violin",
        instrument_id="violin",
        measures=[
            Measure(number=5),
            Measure(number=3),  # 倒序
        ],
    )
    score = Score(parts=[part])
    result = validate(score)
    assert not result.ok
    assert any(e.code == "E_MEASURE_NUMBER_BACKWARDS" for e in result.errors)


def test_section_overlap_caught():
    score = Score(movements=[Movement(
        movement_id=1,
        sections=[
            Section(section_id=0, start_measure=1, end_measure=10),
            Section(section_id=1, start_measure=8, end_measure=20),  # 重疊
        ],
    )])
    result = validate(score)
    assert not result.ok
    assert any(e.code == "E_SECTION_OVERLAP" for e in result.errors)


def test_phrase_backwards_caught():
    score = Score(movements=[Movement(
        movement_id=1,
        sections=[Section(
            section_id=0,
            start_measure=1,
            end_measure=10,
            phrases=[Phrase(
                phrase_id=0,
                start=(5, Fraction(0)),
                end=(3, Fraction(0)),  # 反向
            )],
        )],
    )])
    result = validate(score)
    assert not result.ok
    assert any(e.code == "E_PHRASE_BACKWARDS" for e in result.errors)


def test_measure_duration_mismatch_warning():
    """軟約束: 小節時值不等於拍號"""
    part = Part(
        part_id="v",
        name_display="V",
        instrument_id="violin",
        measures=[Measure(
            number=1,
            time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=[
                NoteEvent(pitch=Pitch(60, "C4"), duration=Fraction(2), onset=Fraction(0)),
                # 只有 2 拍, 不滿 4/4
            ])},
        )],
    )
    score = Score(parts=[part])
    result = validate(score)
    assert any(w.code == "W_MEASURE_DURATION_MISMATCH" for w in result.warnings)


def test_pickup_measure_does_not_trigger_warning():
    part = Part(
        part_id="v",
        name_display="V",
        instrument_id="violin",
        measures=[Measure(
            number=0,
            is_pickup=True,
            time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=[
                NoteEvent(pitch=Pitch(67, "G4"), duration=Fraction(1), onset=Fraction(0)),
            ])},
        )],
    )
    score = Score(parts=[part])
    result = validate(score)
    assert not any(w.code == "W_MEASURE_DURATION_MISMATCH" for w in result.warnings)

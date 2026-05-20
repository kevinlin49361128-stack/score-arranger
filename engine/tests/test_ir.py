"""
IR 單元測試 — 涵蓋規格 §3-§9 的關鍵不變式與邊緣案例。
"""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.ir import (
    ChordEvent,
    DynamicHairpin,
    GraceNote,
    Measure,
    Movement,
    NoteEvent,
    Ornament,
    PedalMark,
    Part,
    Phrase,
    Pitch,
    RepeatStructure,
    RestEvent,
    Score,
    Section,
    TechniqueAnnotation,
    Tuplet,
    Voice,
    VoiceFunction,
)


# ============================================================================
# Pitch
# ============================================================================

class TestPitch:
    def test_basic(self):
        p = Pitch(midi_number=60, spelling="C4")
        assert p.midi_number == 60
        assert p.spelling == "C4"
        assert p.written_midi is None

    def test_transposing_instrument(self):
        # 法國號 in F: 譜上 C4, 實際 F3
        p = Pitch(
            midi_number=53, spelling="F3",
            written_midi=60, written_spelling="C4",
        )
        assert p.midi_number == 53  # concert pitch
        assert p.written_midi == 60

    def test_midi_range_validation(self):
        with pytest.raises(ValueError, match="midi_number"):
            Pitch(midi_number=128, spelling="X")
        with pytest.raises(ValueError, match="midi_number"):
            Pitch(midi_number=-1, spelling="X")

    def test_frozen(self):
        p = Pitch(midi_number=60, spelling="C4")
        with pytest.raises(Exception):  # FrozenInstanceError
            p.midi_number = 61  # type: ignore


# ============================================================================
# Events
# ============================================================================

class TestNoteEvent:
    def test_basic(self):
        n = NoteEvent(
            pitch=Pitch(60, "C4"),
            duration=Fraction(1),
            onset=Fraction(0),
        )
        assert n.duration == 1
        assert n.dynamic is None
        assert n.articulations == []

    def test_positive_duration(self):
        with pytest.raises(ValueError, match="duration"):
            NoteEvent(
                pitch=Pitch(60, "C4"),
                duration=Fraction(0),
                onset=Fraction(0),
            )


class TestChordEvent:
    def test_basic(self):
        c = ChordEvent(
            pitches=[Pitch(60, "C4"), Pitch(64, "E4"), Pitch(67, "G4")],
            duration=Fraction(1),
            onset=Fraction(0),
        )
        assert len(c.pitches) == 3

    def test_minimum_two_pitches(self):
        with pytest.raises(ValueError, match="≥ 2"):
            ChordEvent(
                pitches=[Pitch(60, "C4")],
                duration=Fraction(1),
                onset=Fraction(0),
            )

    def test_no_duplicate_pitches(self):
        with pytest.raises(ValueError, match="重複"):
            ChordEvent(
                pitches=[Pitch(60, "C4"), Pitch(60, "C4")],
                duration=Fraction(1),
                onset=Fraction(0),
            )


class TestTuplet:
    def test_basic_triplet(self):
        t = Tuplet(actual=3, normal=2, bracket_id=0)
        assert t.actual == 3

    def test_invalid_ratio(self):
        with pytest.raises(ValueError):
            Tuplet(actual=2, normal=3, bracket_id=0)  # 反了


# ============================================================================
# §9.1 三連音範例
# ============================================================================

def test_triplet_example_from_spec():
    """規格 §9.1 — 三連音 + 一個四分音符填滿一拍"""
    measure = Measure(
        number=1,
        time_signature=(4, 4),
        voices={
            1: Voice(voice_id=1, events=[
                NoteEvent(
                    pitch=Pitch(60, "C4"),
                    duration=Fraction(1, 3),
                    onset=Fraction(0),
                    tuplet=Tuplet(actual=3, normal=2, bracket_id=0),
                ),
                NoteEvent(
                    pitch=Pitch(62, "D4"),
                    duration=Fraction(1, 3),
                    onset=Fraction(1, 3),
                    tuplet=Tuplet(actual=3, normal=2, bracket_id=0),
                ),
                NoteEvent(
                    pitch=Pitch(64, "E4"),
                    duration=Fraction(1, 3),
                    onset=Fraction(2, 3),
                    tuplet=Tuplet(actual=3, normal=2, bracket_id=0),
                ),
                NoteEvent(
                    pitch=Pitch(65, "F4"),
                    duration=Fraction(1),
                    onset=Fraction(1),
                ),
            ]),
        },
    )
    # 總時值: 1/3 + 1/3 + 1/3 + 1 = 2
    total = sum(e.duration for e in measure.voices[1].events)
    assert total == Fraction(2)


# ============================================================================
# §9.4 弦樂分部 (Divisi)
# ============================================================================

class TestDivisi:
    def test_valid_divisi(self):
        v = Voice(
            voice_id=1,
            is_divisi=True,
            divisi_branches=[
                Voice(voice_id=11, events=[
                    NoteEvent(pitch=Pitch(72, "C5"), duration=Fraction(1), onset=Fraction(0))
                ]),
                Voice(voice_id=12, events=[
                    NoteEvent(pitch=Pitch(64, "E4"), duration=Fraction(1), onset=Fraction(0))
                ]),
            ],
        )
        assert v.is_divisi
        assert len(v.divisi_branches) == 2

    def test_divisi_must_have_empty_events(self):
        with pytest.raises(ValueError, match="events"):
            Voice(
                voice_id=1,
                events=[NoteEvent(pitch=Pitch(72, "C5"), duration=Fraction(1), onset=Fraction(0))],
                is_divisi=True,
                divisi_branches=[Voice(voice_id=11), Voice(voice_id=12)],
            )

    def test_divisi_must_have_two_branches(self):
        with pytest.raises(ValueError, match="branches"):
            Voice(
                voice_id=1,
                is_divisi=True,
                divisi_branches=[Voice(voice_id=11)],
            )


# ============================================================================
# Section / Phrase
# ============================================================================

def test_section_with_phrases():
    section = Section(
        section_id=0,
        name="呈示部",
        start_measure=1,
        end_measure=24,
        phrases=[
            Phrase(phrase_id=0, start=(1, Fraction(0)), end=(8, Fraction(4)), detection_confidence=0.85),
            Phrase(phrase_id=1, start=(9, Fraction(0)), end=(16, Fraction(4)), detection_confidence=0.72),
            Phrase(phrase_id=2, start=(17, Fraction(0)), end=(24, Fraction(4)), detection_confidence=0.45),
        ],
    )
    assert len(section.phrases) == 3
    assert section.phrases[2].detection_confidence < 0.6  # 低信心邊界


# ============================================================================
# 完整 Score 建構
# ============================================================================

def build_minimal_score() -> Score:
    """建構一個小範例 score: 2 個 part, 4 個小節"""
    violin_measures = [
        Measure(
            number=i + 1,
            time_signature=(4, 4) if i == 0 else None,
            voices={
                1: Voice(voice_id=1, events=[
                    NoteEvent(
                        pitch=Pitch(72 + i, f"C5"),
                        duration=Fraction(4),
                        onset=Fraction(0),
                    )
                ])
            },
        )
        for i in range(4)
    ]
    piano_measures = [
        Measure(
            number=i + 1,
            time_signature=(4, 4) if i == 0 else None,
            voices={
                1: Voice(voice_id=1, events=[
                    ChordEvent(
                        pitches=[Pitch(48, "C3"), Pitch(55, "G3"), Pitch(60, "C4")],
                        duration=Fraction(4),
                        onset=Fraction(0),
                    )
                ])
            },
        )
        for i in range(4)
    ]

    return Score(
        metadata={"title": "Test Score", "composer": "Anonymous"},
        movements=[Movement(
            movement_id=1,
            title="I.",
            measure_count=4,
            sections=[Section(section_id=0, start_measure=1, end_measure=4)],
        )],
        parts=[
            Part(part_id="violin_1", name_display="Violin",
                 instrument_id="violin", measures=violin_measures),
            Part(part_id="piano_1", name_display="Piano",
                 instrument_id="piano", measures=piano_measures),
        ],
    )


def test_minimal_score():
    score = build_minimal_score()
    assert len(score.parts) == 2
    assert score.parts[0].part_id == "violin_1"
    assert len(score.parts[0].measures) == 4
    assert score.ir_version == "0.1.0"


# ============================================================================
# Pickup measure
# ============================================================================

def test_pickup_measure():
    pickup = Measure(
        number=0,
        is_pickup=True,
        time_signature=(4, 4),
        voices={
            1: Voice(voice_id=1, events=[
                NoteEvent(pitch=Pitch(67, "G4"), duration=Fraction(1), onset=Fraction(0))
            ]),
        },
    )
    assert pickup.number == 0
    assert pickup.is_pickup


# ============================================================================
# 全域元素: Hairpin / Repeat / Pedal
# ============================================================================

def test_dynamic_hairpin():
    h = DynamicHairpin(
        hairpin_id=0,
        start=(1, Fraction(0)),
        end=(4, Fraction(0)),
        kind="crescendo",
        start_dynamic="p",
        end_dynamic="f",
    )
    assert h.kind == "crescendo"


def test_repeat_structure_volta():
    r = RepeatStructure(
        repeat_id=1,
        kind="volta",
        span=(3, 4),
        volta_number=1,
    )
    assert r.volta_number == 1


def test_pedal_mark():
    p = PedalMark(
        part_id="piano_1",
        span=((1, Fraction(0)), (4, Fraction(0))),
        kind="sustain",
    )
    assert p.kind == "sustain"

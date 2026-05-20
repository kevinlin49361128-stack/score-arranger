"""和聲分析測試"""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.analyzer.harmony import (
    CadenceMarker,
    ChordEntry,
    HarmonyReport,
    _detect_cadences,
    analyze_harmony,
)
from core.ir import (
    ChordEvent,
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Section,
    Voice,
)


# ============================================================================
# Cadence detection (純邏輯, 不需 music21)
# ============================================================================

class TestDetectCadences:
    def test_authentic_v_to_i(self):
        chords = [
            ChordEntry(measure=1, offset=0.0, roman_numeral="I", quality=None, bass=None),
            ChordEntry(measure=2, offset=0.0, roman_numeral="V", quality=None, bass=None),
            ChordEntry(measure=3, offset=0.0, roman_numeral="I", quality=None, bass=None),
        ]
        cadences = _detect_cadences(chords)
        assert len(cadences) == 1
        assert cadences[0].kind == "authentic"
        assert cadences[0].measure == 3

    def test_deceptive_v_to_vi(self):
        chords = [
            ChordEntry(measure=1, offset=0.0, roman_numeral="V", quality=None, bass=None),
            ChordEntry(measure=2, offset=0.0, roman_numeral="vi", quality=None, bass=None),
        ]
        cadences = _detect_cadences(chords)
        assert len(cadences) == 1
        assert cadences[0].kind == "deceptive"

    def test_plagal_iv_to_i(self):
        chords = [
            ChordEntry(measure=1, offset=0.0, roman_numeral="IV", quality=None, bass=None),
            ChordEntry(measure=2, offset=0.0, roman_numeral="I", quality=None, bass=None),
        ]
        cadences = _detect_cadences(chords)
        assert len(cadences) == 1
        assert cadences[0].kind == "plagal"

    def test_no_cadence_for_random_progression(self):
        chords = [
            ChordEntry(measure=1, offset=0.0, roman_numeral="I", quality=None, bass=None),
            ChordEntry(measure=2, offset=0.0, roman_numeral="ii", quality=None, bass=None),
            ChordEntry(measure=3, offset=0.0, roman_numeral="vi", quality=None, bass=None),
        ]
        cadences = _detect_cadences(chords)
        assert len(cadences) == 0

    def test_gap_greater_than_2_measures_skipped(self):
        chords = [
            ChordEntry(measure=1, offset=0.0, roman_numeral="V", quality=None, bass=None),
            ChordEntry(measure=10, offset=0.0, roman_numeral="I", quality=None, bass=None),
        ]
        cadences = _detect_cadences(chords)
        assert len(cadences) == 0


# ============================================================================
# 整合: 用 music21 corpus 跑 analyze_harmony
# ============================================================================

def test_analyze_bach_chorale():
    """Bach 聖詠應能偵測為 minor key 並有多個 authentic cadence"""
    from music21 import corpus
    from core.parser import parse_stream

    m21 = corpus.parse("bach/bwv66.6")
    ir = parse_stream(m21)
    report = analyze_harmony(ir)

    # 應偵測到調性
    assert report.detected_key != ""
    # Bach 聖詠應有多個 cadence
    # (此 piece 為 F# minor)
    assert len(report.chords) > 0


def test_analyze_simple_i_v_i():
    """合成 I-V-I 進行,應偵測到 1 個 authentic cadence"""
    # 在 C major: I=CEG, V=GBD, I=CEG
    score = Score(
        movements=[Movement(
            movement_id=1, measure_count=3,
            sections=[Section(0, 1, 3)],
        )],
        parts=[Part(
            part_id="piano_1", name_display="Piano",
            instrument_id="piano",
            measures=[
                Measure(
                    number=1, time_signature=(4, 4),
                    key_signature="C major",
                    voices={1: Voice(voice_id=1, events=[
                        ChordEvent(
                            pitches=[Pitch(48, "C3"), Pitch(60, "C4"),
                                     Pitch(64, "E4"), Pitch(67, "G4")],
                            duration=Fraction(4),
                            onset=Fraction(0),
                        ),
                    ])},
                ),
                Measure(
                    number=2,
                    voices={1: Voice(voice_id=1, events=[
                        ChordEvent(
                            pitches=[Pitch(55, "G3"), Pitch(62, "D4"),
                                     Pitch(67, "G4"), Pitch(71, "B4")],
                            duration=Fraction(4),
                            onset=Fraction(0),
                        ),
                    ])},
                ),
                Measure(
                    number=3,
                    voices={1: Voice(voice_id=1, events=[
                        ChordEvent(
                            pitches=[Pitch(48, "C3"), Pitch(60, "C4"),
                                     Pitch(64, "E4"), Pitch(67, "G4")],
                            duration=Fraction(4),
                            onset=Fraction(0),
                        ),
                    ])},
                ),
            ],
        )],
    )

    report = analyze_harmony(score)
    # 應有 authentic cadence (V→I at m.3)
    authentic = [c for c in report.cadences if c.kind == "authentic"]
    assert len(authentic) >= 1, \
        f"Expected authentic cadence, got cadences: {report.cadences}, " \
        f"chords: {[(c.measure, c.roman_numeral) for c in report.chords]}"

"""A1+A2: 演奏表情塑形 (performance.apply_playback_expression) 測試。

走真實 IR → music21 路徑, 同時驗證 articulation/dynamic 字串 → music21
物件 → 塑形 的整條接線。
"""
from fractions import Fraction

import pytest

from core.ir import Measure, NoteEvent, Part, Pitch, Score, Voice
from core.ir_to_music21 import ir_to_music21
from core.performance import (
    _ACCENT_BOOST,
    _DEFAULT_VELOCITY,
    _DYNAMIC_VELOCITY,
    _MARCATO_BOOST,
    _MIN_SOUNDING_QL,
    apply_playback_expression,
)


def _one_note_m21(articulations, ql=4.0, dynamic=None):
    note = NoteEvent(
        pitch=Pitch(midi_number=69, spelling="A4"),
        duration=Fraction(ql).limit_denominator(),
        onset=Fraction(0),
        articulations=list(articulations),
        dynamic=dynamic,
    )
    measure = Measure(
        number=1, voices={1: Voice(voice_id=1, events=[note])},
        time_signature=(4, 4),
    )
    part = Part(
        part_id="violin_1", name_display="Violin",
        instrument_id="violin", measures=[measure],
    )
    m21 = ir_to_music21(Score(parts=[part]))
    apply_playback_expression(m21)
    notes = list(m21.recurse().notes)
    assert len(notes) == 1
    return notes[0]


# ── A1: 時值塑形 ─────────────────────────────────────────────────────────

def test_plain_note_unchanged_duration_default_velocity():
    n = _one_note_m21([])
    assert float(n.quarterLength) == pytest.approx(4.0)
    assert n.volume.velocity == _DEFAULT_VELOCITY


def test_staccato_halves_duration():
    n = _one_note_m21(["staccato"])
    assert float(n.quarterLength) == pytest.approx(2.0)


def test_staccatissimo_shorter_than_staccato():
    n = _one_note_m21(["staccatissimo"])
    assert float(n.quarterLength) == pytest.approx(4.0 * 0.34)


def test_breath_trims_tail():
    n = _one_note_m21(["breath"])
    assert float(n.quarterLength) == pytest.approx(4.0 * 0.6)


def test_min_sounding_floor_protects_tiny_staccato():
    n = _one_note_m21(["staccatissimo"], ql=0.125)
    assert float(n.quarterLength) == pytest.approx(_MIN_SOUNDING_QL)


# ── A2: 力度動態 ─────────────────────────────────────────────────────────

def test_accent_boosts_velocity_relative_to_default():
    n = _one_note_m21(["accent"])
    assert n.volume.velocity == _DEFAULT_VELOCITY + _ACCENT_BOOST
    assert float(n.quarterLength) == pytest.approx(4.0)  # 重音不改時值


def test_marcato_boosts_more_than_accent():
    n = _one_note_m21(["marcato"])
    assert n.volume.velocity == _DEFAULT_VELOCITY + _MARCATO_BOOST
    assert _MARCATO_BOOST > _ACCENT_BOOST


def test_pp_quieter_than_ff():
    pp = _one_note_m21([], dynamic="pp")
    ff = _one_note_m21([], dynamic="ff")
    assert pp.volume.velocity == _DYNAMIC_VELOCITY["pp"]
    assert ff.volume.velocity == _DYNAMIC_VELOCITY["ff"]
    assert pp.volume.velocity < ff.volume.velocity


def test_accent_is_relative_to_active_dynamic():
    # accent 在 p 與 f 上應給「不同」絕對 velocity (相對加成, 非絕對)
    p_accent = _one_note_m21(["accent"], dynamic="p")
    f_accent = _one_note_m21(["accent"], dynamic="f")
    assert p_accent.volume.velocity == _DYNAMIC_VELOCITY["p"] + _ACCENT_BOOST
    assert f_accent.volume.velocity == _DYNAMIC_VELOCITY["f"] + _ACCENT_BOOST
    assert f_accent.volume.velocity > p_accent.volume.velocity


def test_chord_velocity_set_on_subnotes_and_duration_shaped():
    from core.ir import ChordEvent
    chord = ChordEvent(
        pitches=[
            Pitch(midi_number=69, spelling="A4"),
            Pitch(midi_number=73, spelling="C#5"),
        ],
        duration=Fraction(4), onset=Fraction(0),
        articulations=["marcato", "staccato"],
        dynamic="f",
    )
    measure = Measure(
        number=1, voices={1: Voice(voice_id=1, events=[chord])},
        time_signature=(4, 4),
    )
    part = Part(
        part_id="violin_1", name_display="Violin",
        instrument_id="violin", measures=[measure],
    )
    m21 = ir_to_music21(Score(parts=[part]))
    apply_playback_expression(m21)
    chords = list(m21.recurse().notes)
    assert len(chords) == 1
    c = chords[0]
    assert c.isChord
    assert c.volume.velocity == _DYNAMIC_VELOCITY["f"] + _MARCATO_BOOST
    assert float(c.quarterLength) == pytest.approx(2.0)
    for sub in c.notes:  # 子音 velocity 也要設到, 匯出才生效
        assert sub.volume.velocity == _DYNAMIC_VELOCITY["f"] + _MARCATO_BOOST

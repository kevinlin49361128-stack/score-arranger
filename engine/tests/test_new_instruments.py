"""新增樂器 (viola / cello / flute / clarinet) 的單元測試"""

from __future__ import annotations

import pytest

from core.instruments import (
    CELLO_PROFILE,
    CLARINET_PROFILE,
    FLUTE_PROFILE,
    VIOLA_PROFILE,
    check_cello_chord,
    check_clarinet,
    check_flute,
    check_viola_chord,
    get_profile,
)
from core.ir import Pitch


# ============================================================================
# Registry
# ============================================================================

class TestRegistry:
    def test_viola_registered(self):
        assert get_profile("viola") is VIOLA_PROFILE

    def test_cello_registered(self):
        assert get_profile("cello") is CELLO_PROFILE

    def test_flute_registered(self):
        assert get_profile("flute") is FLUTE_PROFILE

    def test_clarinet_registered(self):
        assert get_profile("clarinet_bb") is CLARINET_PROFILE


# ============================================================================
# Viola
# ============================================================================

class TestViola:
    def test_open_strings(self):
        # C3 G3 D4 A4
        assert [s.open_pitch.midi_number for s in VIOLA_PROFILE.strings] \
            == [48, 55, 62, 69]

    def test_low_c_in_range(self):
        r = check_viola_chord([Pitch(48, "C3")])
        assert r.severity == "ok"

    def test_below_lowest_string_fails(self):
        r = check_viola_chord([Pitch(47, "B2")])
        # B2 比 C3 低 → error (out of range)
        assert r.severity == "error"

    def test_double_stop_ok(self):
        # C3 + G3 = 兩條最低弦 → ok
        r = check_viola_chord([Pitch(48, "C3"), Pitch(55, "G3")])
        assert r.severity == "ok"

    def test_too_many_notes(self):
        r = check_viola_chord([
            Pitch(48, "C3"), Pitch(55, "G3"),
            Pitch(62, "D4"), Pitch(69, "A4"), Pitch(76, "E5"),
        ])
        assert r.severity == "error"
        assert r.code == "E_STRING_CHORD_EXCEED"


# ============================================================================
# Cello
# ============================================================================

class TestCello:
    def test_open_strings(self):
        # C2 G2 D3 A3
        assert [s.open_pitch.midi_number for s in CELLO_PROFILE.strings] \
            == [36, 43, 50, 57]

    def test_low_c2(self):
        r = check_cello_chord([Pitch(36, "C2")])
        assert r.severity == "ok"

    def test_stretch_exceed(self):
        # 兩弦 fret 差太大: C2(0) + F#3(8 frets on G string)
        # → fret_positions [8] only single non-open, no stretch
        # Use C2 + G3 → C string fret 0 + G string fret 12
        # Wait: C2 is open string 0, G3 = string 1 fret 12 → only one non-zero fret
        # Try: D2(2 on C) + F3(10 on G string)
        # fret_positions = [2, 10], stretch = 8 > max 5
        r = check_cello_chord([Pitch(38, "D2"), Pitch(53, "F3")])
        assert r.severity == "error"
        assert r.code == "E_CELLO_STRETCH_EXCEED"

    def test_triple_stop_warning(self):
        # 三音 → warning level
        r = check_cello_chord([
            Pitch(36, "C2"), Pitch(43, "G2"), Pitch(50, "D3"),
        ])
        assert r.severity == "warning"
        assert r.code == "W_CELLO_TRIPLE_QUAD_STOP"


# ============================================================================
# Flute (單音)
# ============================================================================

class TestFlute:
    def test_c4_ok(self):
        r = check_flute([Pitch(60, "C4")])
        assert r.severity == "ok"

    def test_below_range(self):
        r = check_flute([Pitch(59, "B3")])
        assert r.severity == "error"
        assert r.code == "E_PITCH_BELOW_RANGE"

    def test_above_range(self):
        r = check_flute([Pitch(99, "D#7")])
        assert r.severity == "error"

    def test_chord_fails(self):
        r = check_flute([Pitch(72, "C5"), Pitch(76, "E5")])
        assert r.severity == "error"
        assert r.code == "E_MONOPHONIC_CHORD"

    def test_empty_ok(self):
        r = check_flute([])
        assert r.severity == "ok"


# ============================================================================
# Clarinet (B♭, sounding pitch)
# ============================================================================

class TestClarinet:
    def test_d3_lowest(self):
        r = check_clarinet([Pitch(50, "D3")])
        assert r.severity == "ok"

    def test_below_d3_fails(self):
        r = check_clarinet([Pitch(49, "C#3")])
        assert r.severity == "error"
        assert r.code == "E_PITCH_BELOW_RANGE"

    def test_chord_fails(self):
        r = check_clarinet([Pitch(60, "C4"), Pitch(64, "E4")])
        assert r.severity == "error"

    def test_transposition_is_bflat(self):
        # 譜→sounding 是 -2 semitones (B♭ 樂器)
        assert CLARINET_PROFILE.transposition == -2

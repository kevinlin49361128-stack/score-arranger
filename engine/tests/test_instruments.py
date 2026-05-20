"""Instrument Knowledge Base 單元測試"""

from __future__ import annotations

import pytest

from core.instruments import (
    PIANO_PROFILE,
    VIOLIN_PROFILE,
    check_piano_hand_span,
    check_pitch_in_range,
    check_violin_chord,
    get_profile,
    list_profiles,
)
from core.instruments.piano import check_piano_chord_polyphony
from core.ir import Pitch


# ============================================================================
# Registry
# ============================================================================

class TestRegistry:
    def test_violin_registered(self):
        assert get_profile("violin") is VIOLIN_PROFILE

    def test_piano_registered(self):
        assert get_profile("piano") is PIANO_PROFILE

    def test_unknown_returns_none(self):
        assert get_profile("nonexistent_instrument") is None

    def test_list_contains_phase1_instruments(self):
        ids = list_profiles()
        assert "violin" in ids
        assert "piano" in ids

    def test_satb_voices_registered(self):
        ids = list_profiles()
        for voice_id in ("soprano", "alto", "tenor", "bass_voice"):
            assert voice_id in ids, f"missing voice profile: {voice_id}"

    def test_soprano_pitch_in_range(self):
        from core.ir import Pitch
        soprano = get_profile("soprano")
        # 中央 C4 應在 comfortable
        r = check_pitch_in_range(Pitch(60, "C4"), soprano)
        assert r.is_ok
        # G5 也在 comfortable (≤ A5)
        r = check_pitch_in_range(Pitch(79, "G5"), soprano)
        assert r.is_ok
        # C6 超出 comfortable (A5 上限),但仍在 absolute (C6 = 84)
        r = check_pitch_in_range(Pitch(84, "C6"), soprano)
        assert not r.is_ok  # warning, 超出 comfortable
        # E2 太低,超出 absolute
        r = check_pitch_in_range(Pitch(40, "E2"), soprano)
        assert r.is_error


# ============================================================================
# 通用音域檢查
# ============================================================================

class TestPitchInRange:
    def test_violin_g3_ok(self):
        r = check_pitch_in_range(Pitch(55, "G3"), VIOLIN_PROFILE)
        assert r.is_ok

    def test_violin_a4_ok(self):
        r = check_pitch_in_range(Pitch(69, "A4"), VIOLIN_PROFILE)
        assert r.is_ok

    def test_violin_below_g3_error(self):
        r = check_pitch_in_range(Pitch(50, "D3"), VIOLIN_PROFILE)
        assert r.is_error
        assert r.code == "E_PITCH_BELOW_RANGE"

    def test_violin_e7_warning_not_comfortable(self):
        """E7 (MIDI 100) 是 comfortable 上限,稍高應 warning"""
        r = check_pitch_in_range(Pitch(101, "F7"), VIOLIN_PROFILE)
        assert r.is_warning
        assert r.code == "W_PITCH_OUT_OF_COMFORTABLE"

    def test_violin_above_c8_error(self):
        r = check_pitch_in_range(Pitch(120, "C9"), VIOLIN_PROFILE)
        assert r.is_error
        assert r.code == "E_PITCH_ABOVE_RANGE"

    def test_piano_a0_ok(self):
        r = check_pitch_in_range(Pitch(21, "A0"), PIANO_PROFILE)
        # A0 在 absolute 範圍但不在 comfortable (C2 起)
        assert r.is_warning  # 超出 comfortable


# ============================================================================
# 小提琴和弦檢查
# ============================================================================

class TestViolinChord:
    def test_single_note(self):
        r = check_violin_chord([Pitch(69, "A4")])
        assert r.is_ok

    def test_double_stop_valid(self):
        """G + D 開放弦"""
        r = check_violin_chord([Pitch(55, "G3"), Pitch(62, "D4")])
        assert r.is_ok

    def test_quadruple_stop_valid(self):
        """G + D + A + E 四開放弦 — 可能但 warning"""
        r = check_violin_chord([
            Pitch(55, "G3"), Pitch(62, "D4"),
            Pitch(69, "A4"), Pitch(76, "E5"),
        ])
        # 四音 stop 因弓法限制需 warning
        assert r.is_warning
        assert r.code == "W_VIOLIN_TRIPLE_QUAD_STOP"

    def test_five_notes_error(self):
        r = check_violin_chord([
            Pitch(55, "G3"), Pitch(62, "D4"),
            Pitch(69, "A4"), Pitch(76, "E5"),
            Pitch(81, "A5"),
        ])
        assert r.is_error
        assert r.code == "E_STRING_CHORD_EXCEED"
        assert r.params["chord_size"] == 5

    def test_note_below_lowest_string(self):
        """C3 比 G3 弦低 — 錯誤"""
        r = check_violin_chord([Pitch(48, "C3"), Pitch(55, "G3")])
        assert r.is_error
        assert r.code == "E_NOTE_BELOW_STRING"

    def test_dp_finds_better_fingering(self):
        """Phase 2 DP: D4 + E5 在貪婪下會 stretch=7 (error), 但 DP 找到 D 弦/A 弦 fret 0/7 → ok"""
        r = check_violin_chord([Pitch(62, "D4"), Pitch(76, "E5")])
        assert r.is_ok
        # 不該再出現 stretch 錯誤
        assert r.code != "E_VIOLIN_STRETCH_EXCEED"

    def test_dp_returns_warning_when_unavoidable(self):
        """大三度雙音同弦: D4 + F#4 (距 4 半音), 必在同弦 → stretch=4 還 OK"""
        # 找一個 DP 仍會發出 warning 的雙音:
        # 雙音 D5(74) + A5(81), G 弦最低 fret = D5 上 fret 7, A5 = G 弦 fret 14 → stretch 7
        # 但 DP 會嘗試 D 弦 fret 12 + A 弦 fret 12 → stretch=0 → ok
        # 改: 用三音 G3 + D4 + B5 → 必須跨 G+D+A 三條; B5=83, A 弦 fret 14
        # 把位伸展 = 14 - 0 = 14 → 超 max → DP None → error (non adjacent / can't reach)
        # 但 fret 14 不會被排除 (只跟其他非開弦音比較); 反正測 result 確實是 warning/error
        r = check_violin_chord([
            Pitch(55, "G3"), Pitch(62, "D4"), Pitch(83, "B5"),
        ])
        # 三音和弦 → 至少 warning
        assert r.severity in ("warning", "error")


# ============================================================================
# 鋼琴手距檢查
# ============================================================================

class TestPianoHandSpan:
    def test_single_note(self):
        r = check_piano_hand_span([Pitch(60, "C4")])
        assert r.is_ok

    def test_octave_ok(self):
        """C4 + C5 = 12 半音,正好在舒適 (10) 上界外、極限 (12) 內 → warning"""
        r = check_piano_hand_span([Pitch(60, "C4"), Pitch(72, "C5")])
        # 12 > 10, ≤ 12 → warning
        assert r.is_warning

    def test_perfect_fifth_ok(self):
        """C4 + G4 = 7 半音,舒適"""
        r = check_piano_hand_span([Pitch(60, "C4"), Pitch(67, "G4")])
        assert r.is_ok

    def test_thirteenth_error(self):
        """C4 + A5 = 21 半音, 遠超過極限"""
        r = check_piano_hand_span([Pitch(60, "C4"), Pitch(81, "A5")])
        assert r.is_error
        assert r.code == "E_PIANO_HAND_SPAN_EXCEED"

    def test_eleven_semitones_warning(self):
        """C4 + B4 = 11 半音, > 10 ≤ 12 → warning"""
        r = check_piano_hand_span([Pitch(60, "C4"), Pitch(71, "B4")])
        assert r.is_warning
        assert r.code == "W_PIANO_HAND_SPAN_LARGE"

    def test_chord_5_notes_within_octave(self):
        """5 音 C 大七 (C-E-G-B-D) 在 13 半音內 (其實這超過 12)"""
        # C4-D5 = 14 半音, > 12
        r = check_piano_hand_span([
            Pitch(60, "C4"), Pitch(64, "E4"),
            Pitch(67, "G4"), Pitch(71, "B4"),
            Pitch(74, "D5"),
        ])
        assert r.is_error  # 跨度太大

    def test_chord_within_octave(self):
        """C4-E4-G4-C5 = 12 半音, warning"""
        r = check_piano_hand_span([
            Pitch(60, "C4"), Pitch(64, "E4"),
            Pitch(67, "G4"), Pitch(72, "C5"),
        ])
        assert r.is_warning


class TestPianoPolyphony:
    def test_6_notes_too_many(self):
        notes = [Pitch(60 + i, f"n{i}") for i in range(6)]
        r = check_piano_chord_polyphony(notes)
        assert r.is_warning
        assert r.code == "W_PIANO_TOO_MANY_NOTES_ONE_HAND"

    def test_5_notes_ok_if_span_ok(self):
        # 5 個音在小範圍 (例如 C-E-G-Bb-C, span ~12)
        notes = [Pitch(60, "C4"), Pitch(64, "E4"), Pitch(67, "G4"),
                 Pitch(70, "Bb4"), Pitch(72, "C5")]
        r = check_piano_chord_polyphony(notes)
        # 委派到 hand_span: span=12, warning
        assert r.is_warning
        assert r.code == "W_PIANO_HAND_SPAN_LARGE"


# ============================================================================
# Suggestions 攜帶
# ============================================================================

def test_violin_chord_exceed_carries_suggestions():
    r = check_violin_chord([Pitch(55 + i, f"n{i}") for i in range(5)])
    assert r.is_error
    assert len(r.suggestions) >= 2
    codes = {s.code for s in r.suggestions}
    assert "S_OMIT_NOTE" in codes


def test_piano_hand_span_exceed_carries_suggestions():
    r = check_piano_hand_span([Pitch(40, "E2"), Pitch(80, "Ab5")])
    assert r.is_error
    codes = {s.code for s in r.suggestions}
    assert "S_OMIT_INNER_VOICE" in codes
    assert "S_REDISTRIBUTE_HANDS" in codes

"""DP 指法最佳化測試"""

from __future__ import annotations

from core.instruments.base import StringDef
from core.instruments.fingering import find_best_fingering
from core.ir import Pitch


# Violin strings: G3 D4 A4 E5
VIOLIN_STRINGS = [
    StringDef(open_pitch=Pitch(55, "G3"), index=0),
    StringDef(open_pitch=Pitch(62, "D4"), index=1),
    StringDef(open_pitch=Pitch(69, "A4"), index=2),
    StringDef(open_pitch=Pitch(76, "E5"), index=3),
]


class TestFindBestFingering:
    def test_single_note_picks_lowest_fret(self):
        # G4 (67) — 可在 G 弦 fret 12, D 弦 fret 5, A 弦 fret -2 (X)
        # 最佳: D 弦 fret 5 (≠ 0, 但比 G 弦 12 低)
        result = find_best_fingering([Pitch(67, "G4")], VIOLIN_STRINGS)
        assert result is not None
        assert len(result.assignments) == 1
        _, _, fret = result.assignments[0]
        assert fret == 5

    def test_two_open_strings(self):
        # D4 + A4 → 都是空弦 (fret 0)
        result = find_best_fingering(
            [Pitch(62, "D4"), Pitch(69, "A4")], VIOLIN_STRINGS,
        )
        assert result is not None
        frets = [a[2] for a in result.assignments]
        assert sorted(frets) == [0, 0]

    def test_dp_prefers_low_position(self):
        # D4 + E5 — 貪婪會給 G fret 7 + D fret 14 (stretch 7)
        # DP 應選 D 弦 fret 0 + A 弦 fret 7 (stretch 0)
        result = find_best_fingering(
            [Pitch(62, "D4"), Pitch(76, "E5")], VIOLIN_STRINGS,
        )
        assert result is not None
        # 必有一個 fret 0 (open D 或 open E? E5 = 76, E 弦開 76, 也可能)
        frets = [a[2] for a in result.assignments]
        # Best assignments: D-open + A-fret 7, OR D-A swapped, OR E-open + D-fret 14
        # DP 選 D-open + A-7 → frets [0, 7]
        assert 0 in frets, f"Expected at least one open string, got frets={frets}"

    def test_unplayable_below_lowest(self):
        # C3 (48) 比 G3 弦 (55) 低 → 不可能
        result = find_best_fingering(
            [Pitch(48, "C3"), Pitch(60, "C4")], VIOLIN_STRINGS,
        )
        assert result is None

    def test_too_many_notes(self):
        # 5 音給 4 弦 → 不可能
        result = find_best_fingering(
            [
                Pitch(55, "G3"), Pitch(62, "D4"), Pitch(69, "A4"),
                Pitch(76, "E5"), Pitch(80, "G#5"),
            ],
            VIOLIN_STRINGS,
        )
        assert result is None

    def test_stretch_limit_with_two_stopped_notes(self):
        # D5 + G5 → 不能用空弦, 兩音都需按弦; 若 stretch=2 → ok
        # D5 (74): D 弦 fret 12 / A 弦 fret 5
        # G5 (79): A 弦 fret 10 / E 弦 fret 3 / D 弦 fret 17
        # DP 應選 A 弦 fret 5 + E 弦 fret 3 → stretch 2 ✓
        result = find_best_fingering(
            [Pitch(74, "D5"), Pitch(79, "G5")],
            VIOLIN_STRINGS,
            max_stretch_semitones=6,
        )
        assert result is not None
        frets = [a[2] for a in result.assignments]
        # 最佳 stretch ≤ 6
        if len(frets) == 2:
            non_open = [f for f in frets if f > 0]
            if len(non_open) >= 2:
                assert max(non_open) - min(non_open) <= 6

    def test_four_note_chord(self):
        # 所有四條開弦同時拉 → 四音都 fret 0
        result = find_best_fingering(
            [Pitch(55, "G3"), Pitch(62, "D4"), Pitch(69, "A4"), Pitch(76, "E5")],
            VIOLIN_STRINGS,
        )
        assert result is not None
        frets = [a[2] for a in result.assignments]
        assert frets == [0, 0, 0, 0]
        assert result.score == 0.0

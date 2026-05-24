"""A1b 完整羅馬數字和聲分析測試 (0.1.31)"""

from __future__ import annotations

from fractions import Fraction

from core.analyzer.harmony_function import (
    Key,
    analyze_harmony,
    detect_key,
    find_region_at,
    identify_chord,
)
from core.ir import (
    Measure,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Voice,
)


def _n(midi: int, onset=Fraction(0), dur=Fraction(1)) -> NoteEvent:
    return NoteEvent(pitch=Pitch(midi, f"n{midi}"), duration=dur, onset=onset)


class TestKKKeyDetection:
    """KK profile key detection — 用熟悉的旋律驗證."""

    def test_c_major_scale_detects_c_major(self):
        # C major scale: 每個 PC 各 1 拍
        hist = [0.0] * 12
        for pc in [0, 2, 4, 5, 7, 9, 11]:  # C D E F G A B
            hist[pc] = 1.0
        key, conf = detect_key(hist)
        assert key.tonic_pc == 0
        assert key.mode == "major"
        assert conf > 0.5

    def test_a_minor_natural_detects_a_minor(self):
        # A minor natural scale: A B C D E F G
        hist = [0.0] * 12
        for pc in [9, 11, 0, 2, 4, 5, 7]:
            hist[pc] = 1.0
        key, conf = detect_key(hist)
        # KK 對 A minor / C major 容易模糊, 允許其中一個 tonic
        assert (key.tonic_pc == 9 and key.mode == "minor") or \
               (key.tonic_pc == 0 and key.mode == "major")

    def test_g_major_detects_g_major(self):
        # G major scale: G A B C D E F#
        hist = [0.0] * 12
        for pc in [7, 9, 11, 0, 2, 4, 6]:
            hist[pc] = 1.0
        # 加重 tonic / dominant 避免模糊
        hist[7] += 3.0   # 多算 G
        hist[2] += 2.0   # 多算 D
        key, _ = detect_key(hist)
        assert key.tonic_pc == 7
        assert key.mode == "major"


class TestIdentifyChord:
    """PC set → RomanNumeral 識別."""

    def test_c_major_i_chord(self):
        # C-E-G in C major → I
        key = Key(tonic_pc=0, mode="major")
        rn = identify_chord({0, 4, 7}, key)
        assert rn is not None
        assert rn.degree == 1
        assert rn.quality == "major"
        assert rn.figure_string == "I"

    def test_c_major_v7_chord(self):
        # G-B-D-F in C major → V7
        key = Key(tonic_pc=0, mode="major")
        rn = identify_chord({7, 11, 2, 5}, key)
        assert rn is not None
        assert rn.degree == 5
        assert rn.quality == "dominant7"
        assert rn.figure_string == "V7"

    def test_c_major_vii_dim(self):
        # B-D-F in C major → vii°
        key = Key(tonic_pc=0, mode="major")
        rn = identify_chord({11, 2, 5}, key)
        assert rn is not None
        assert rn.degree == 7
        # 允許 diminished / half_diminished / fully_diminished
        # (vii° 不一定加七音, 允許多種)
        assert "diminished" in rn.quality or rn.quality == "diminished"

    def test_a_minor_i_chord(self):
        # A-C-E in A minor → i
        key = Key(tonic_pc=9, mode="minor")
        rn = identify_chord({9, 0, 4}, key)
        assert rn is not None
        assert rn.degree == 1
        assert rn.quality == "minor"

    def test_empty_returns_none(self):
        key = Key(tonic_pc=0, mode="major")
        assert identify_chord(set(), key) is None


class TestAnalyzeHarmony:
    """整曲流程 — 從 Score 出 list[HarmonicRegion]."""

    def _c_major_progression_score(self) -> Score:
        # C-F-G-C 進行, 用 SATB 分開 4 個 part
        s = Part(
            part_id="s", name_display="S", instrument_id="violin",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    _n(72, dur=Fraction(1)),                  # C5
                    _n(72, onset=Fraction(1), dur=Fraction(1)),  # C
                    _n(74, onset=Fraction(2), dur=Fraction(1)),  # D
                    _n(72, onset=Fraction(3), dur=Fraction(1)),  # C
                ])},
            )],
        )
        a = Part(
            part_id="a", name_display="A", instrument_id="violin",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    _n(64, dur=Fraction(1)),                  # E4 - C
                    _n(65, onset=Fraction(1), dur=Fraction(1)),  # F4 - F
                    _n(65, onset=Fraction(2), dur=Fraction(1)),  # F4 - G
                    _n(64, onset=Fraction(3), dur=Fraction(1)),  # E4 - C
                ])},
            )],
        )
        t = Part(
            part_id="t", name_display="T", instrument_id="viola",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    _n(60, dur=Fraction(1)),  # C4
                    _n(60, onset=Fraction(1), dur=Fraction(1)),  # C4
                    _n(59, onset=Fraction(2), dur=Fraction(1)),  # B3
                    _n(60, onset=Fraction(3), dur=Fraction(1)),  # C4
                ])},
            )],
        )
        b = Part(
            part_id="b", name_display="B", instrument_id="cello",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    _n(48, dur=Fraction(1)),  # C3 - I
                    _n(53, onset=Fraction(1), dur=Fraction(1)),  # F3 - IV
                    _n(55, onset=Fraction(2), dur=Fraction(1)),  # G3 - V
                    _n(48, onset=Fraction(3), dur=Fraction(1)),  # C3 - I
                ])},
            )],
        )
        return Score(metadata={}, movements=[], parts=[s, a, t, b])

    def test_detects_c_major_key(self):
        regions = analyze_harmony(self._c_major_progression_score())
        assert len(regions) >= 4
        assert all(r.key.tonic_pc == 0 and r.key.mode == "major"
                   for r in regions)

    def test_first_region_is_i_chord(self):
        regions = analyze_harmony(self._c_major_progression_score())
        first = regions[0]
        # 第一個 onset (C-E-G-C) → I
        assert first.roman.degree == 1
        assert 0 in first.essential_pitch_classes  # 含根音 C

    def test_v_chord_essential_includes_leading_tone_or_dominant(self):
        regions = analyze_harmony(self._c_major_progression_score())
        # 找到 V (degree=5) region
        v_regions = [r for r in regions if r.roman.degree == 5]
        assert len(v_regions) >= 1
        # V 至少含根音 G (pc=7)
        assert 7 in v_regions[0].essential_pitch_classes

    def test_empty_score_returns_empty(self):
        empty = Score(metadata={}, movements=[], parts=[])
        assert analyze_harmony(empty) == []

    def test_find_region_at(self):
        regions = analyze_harmony(self._c_major_progression_score())
        # 第 2 拍 (F chord)
        r = find_region_at(regions, Fraction(1))
        assert r is not None
        # 第 3 拍 (G chord)
        r = find_region_at(regions, Fraction(2))
        assert r is not None
        # 找不到 (邊界外) — 我們的實作會 fallback 最後一個 region
        r_late = find_region_at(regions, Fraction(100))
        assert r_late is not None

    def test_find_region_at_empty(self):
        assert find_region_at([], Fraction(0)) is None

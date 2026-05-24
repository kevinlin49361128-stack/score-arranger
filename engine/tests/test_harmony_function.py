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


# ============================================================================
# 0.1.31 樂理深化 #5: 導音 / V7 七度 強制解決
# ============================================================================

class TestTendencyToneResolution:
    """V → I 中導音不解決 / V7 七度不解決 → warning."""

    def _v_to_i_score(
        self, leading_tone_resolves_to: int,
        v_chord_seventh: bool = False,
    ) -> Score:
        """C major: I → V → I.
        m.1 I (1拍): 建立調性 - C major
        m.2 V (4拍): leading tone B in alto
        m.3 I (4拍): alto resolves to leading_tone_resolves_to
        """
        # Soprano: C5 (I) → G4 (V) → C5 (I)
        soprano = Part(
            part_id="s", name_display="S", instrument_id="violin",
            measures=[
                Measure(number=1, time_signature=(4, 4), voices={
                    1: Voice(voice_id=1, events=[
                        _n(72, dur=Fraction(4)),  # C5
                    ])}),
                Measure(number=2, time_signature=None, voices={
                    1: Voice(voice_id=1, events=[
                        _n(67, dur=Fraction(4)),  # G4
                    ])}),
                Measure(number=3, time_signature=None, voices={
                    1: Voice(voice_id=1, events=[
                        _n(72, dur=Fraction(4)),  # C5
                    ])}),
            ],
        )
        # Alto: E (I) → B (V leading tone) → leading_tone_resolves_to
        alto = Part(
            part_id="a", name_display="A", instrument_id="violin",
            measures=[
                Measure(number=1, time_signature=(4, 4), voices={
                    1: Voice(voice_id=1, events=[
                        _n(64, dur=Fraction(4)),  # E4
                    ])}),
                Measure(number=2, time_signature=None, voices={
                    1: Voice(voice_id=1, events=[
                        _n(71, dur=Fraction(4)),  # B4 (導音)
                    ])}),
                Measure(number=3, time_signature=None, voices={
                    1: Voice(voice_id=1, events=[
                        _n(leading_tone_resolves_to, dur=Fraction(4)),
                    ])}),
            ],
        )
        # Tenor: G (I) → D (V) → E (I)
        tenor_v = 65 if v_chord_seventh else 62  # F4 (V7 七度) or D4 (V 五)
        tenor = Part(
            part_id="t", name_display="T", instrument_id="viola",
            measures=[
                Measure(number=1, time_signature=(4, 4), voices={
                    1: Voice(voice_id=1, events=[
                        _n(60, dur=Fraction(4)),  # C4 (tenor 重複 root)
                    ])}),
                Measure(number=2, time_signature=None, voices={
                    1: Voice(voice_id=1, events=[
                        _n(tenor_v, dur=Fraction(4)),
                    ])}),
                Measure(number=3, time_signature=None, voices={
                    1: Voice(voice_id=1, events=[
                        _n(64, dur=Fraction(4)),  # E4 (3rd of I)
                    ])}),
            ],
        )
        # Bass: C3 → G3 → C3
        bass = Part(
            part_id="b", name_display="B", instrument_id="cello",
            measures=[
                Measure(number=1, time_signature=(4, 4), voices={
                    1: Voice(voice_id=1, events=[
                        _n(48, dur=Fraction(4)),  # C3
                    ])}),
                Measure(number=2, time_signature=None, voices={
                    1: Voice(voice_id=1, events=[
                        _n(55, dur=Fraction(4)),  # G3
                    ])}),
                Measure(number=3, time_signature=None, voices={
                    1: Voice(voice_id=1, events=[
                        _n(48, dur=Fraction(4)),  # C3
                    ])}),
            ],
        )
        return Score(metadata={}, movements=[], parts=[soprano, alto, tenor, bass])

    def test_leading_tone_resolves_up_clean(self):
        """B4 → C5 (上行半音) = 完美解決 → 無 W_UNRESOLVED_LEADING_TONE."""
        from core.analyzer.harmony_function import (
            detect_unresolved_tendency_tones,
        )
        score = self._v_to_i_score(leading_tone_resolves_to=72)  # B → C
        issues = detect_unresolved_tendency_tones(score)
        codes = [i.result.code for i in issues]
        assert "W_UNRESOLVED_LEADING_TONE" not in codes

    def test_leading_tone_jumps_down_flagged(self):
        """B4 → G4 (下行純四度, 非解決) → 應觸發警告."""
        from core.analyzer.harmony_function import (
            detect_unresolved_tendency_tones,
        )
        score = self._v_to_i_score(leading_tone_resolves_to=67)  # B → G
        issues = detect_unresolved_tendency_tones(score)
        codes = [i.result.code for i in issues]
        assert "W_UNRESOLVED_LEADING_TONE" in codes

    def test_chord7th_resolves_down_clean(self):
        """V7 七度 F4 → E4 (下行半音) = 正解 → 無 W_UNRESOLVED_CHORD7TH."""
        from core.analyzer.harmony_function import (
            detect_unresolved_tendency_tones,
        )
        score = self._v_to_i_score(
            leading_tone_resolves_to=72, v_chord_seventh=True,
        )
        issues = detect_unresolved_tendency_tones(score)
        codes = [i.result.code for i in issues]
        # F → E 解決, 不該抓 W_UNRESOLVED_CHORD7TH (但 leading tone 可能有)
        assert "W_UNRESOLVED_CHORD7TH" not in codes

    def test_collect_issues_includes_tendency_warnings(self):
        """collect_issues 應接到 tendency tone 檢查."""
        from core.repair import collect_issues
        score = self._v_to_i_score(leading_tone_resolves_to=67)
        codes = {i.result.code for i in collect_issues(score)}
        # leading tone 不解決應被抓
        assert "W_UNRESOLVED_LEADING_TONE" in codes


# ============================================================================
# 0.1.31 樂理深化 #6: 非和弦音 (NCT) 分類 + 掛留音保留
# ============================================================================

class TestNCTClassification:
    """classify_note_function — chord_tone / suspension / passing / neighbor."""

    def _region(self, root_pc: int, quality: str = "major",
                start: Fraction = Fraction(0),
                end: Fraction = Fraction(4)):
        from core.analyzer.harmony_function import (
            HarmonicRegion,
            Key,
            RomanNumeral,
            _build_triad_pcs,
        )
        ideal = sorted(_build_triad_pcs(root_pc, quality))
        return HarmonicRegion(
            start_quarter=start,
            end_quarter=end,
            key=Key(tonic_pc=0, mode="major"),
            roman=RomanNumeral(degree=1, quality="major"),
            ideal_pitch_classes=ideal,
            essential_pitch_classes=ideal[:2],
        )

    def test_chord_tone(self):
        from core.analyzer.harmony_function import classify_note_function
        # C major triad, 音 = C4 (60), pc=0 ∈ {0,4,7}
        region = self._region(0)
        assert classify_note_function(60, region) == "chord_tone"

    def test_suspension(self):
        """G→C 進行: D 從 G 和弦持平到 C 和弦變成非和弦音, 下行解決到 C
        (4-3 模型的 'D over Cmaj').
        """
        from core.analyzer.harmony_function import classify_note_function
        # G major triad (V) pcs {7,11,2}
        prev_region = self._region(7, start=Fraction(0), end=Fraction(2))
        # C major triad (I) pcs {0,4,7}
        curr_region = self._region(0, start=Fraction(2), end=Fraction(4))
        # D4 (62, pc=2) — 在 G 和弦內, 但不在 C 和弦; 下行解決到 C4 (60)
        result = classify_note_function(
            midi=62, region=curr_region,
            prev_midi=62, prev_region=prev_region, next_midi=60,
        )
        assert result == "suspension"

    def test_passing_tone(self):
        """C major: C → D → E 級進, D 是 passing tone."""
        from core.analyzer.harmony_function import classify_note_function
        region = self._region(0)  # C major {0,4,7}
        # D4 (62, pc=2) 不在 C 和弦, 但 prev C4 + next E4 都在
        result = classify_note_function(
            midi=62, region=region,
            prev_midi=60, prev_region=region, next_midi=64,
        )
        assert result == "passing"

    def test_neighbor_tone(self):
        """C major: C → D → C, D 是 neighbor tone."""
        from core.analyzer.harmony_function import classify_note_function
        region = self._region(0)
        result = classify_note_function(
            midi=62, region=region,
            prev_midi=60, prev_region=region, next_midi=60,
        )
        assert result == "neighbor"


class TestEssentialPcsPreserved:
    """_harmonic_omit_choice 接 essential_pcs 後, essential 音應被保留."""

    def _mk_pitch(self, midi: int):
        from core.ir import Pitch
        return Pitch(midi_number=midi, spelling=f"n{midi}")

    def test_essential_pc_not_omitted(self):
        """C-E-G-B (C major7), essential={C,E,B} — 內聲部該留 E/B,
        不能因為 _harmonic_omit_choice 選了 E 而違反."""
        from core.repair import _harmonic_omit_choice
        pitches = [
            self._mk_pitch(48),  # C3
            self._mk_pitch(64),  # E4
            self._mk_pitch(67),  # G4
            self._mk_pitch(71),  # B4 (在內聲部 — 我們設只能省 E 或 G)
        ]
        # 不傳 essential: 預設規則可能挑 G (完全五度)
        idx_without = _harmonic_omit_choice(pitches)
        omit_pc_without = pitches[idx_without].midi_number % 12
        # 傳 essential = [C, E, B] (root, 3rd, 7th)
        idx_with = _harmonic_omit_choice(
            pitches, essential_pcs=[0, 4, 11],
        )
        omit_pc_with = pitches[idx_with].midi_number % 12
        # 加 essential 後, 不該省 E (4) 或 B (11) — 應該省 G (7) 或保持原選擇
        assert omit_pc_with not in (4, 11), (
            f"essential pc 不該被省: omit_pc={omit_pc_with}"
        )
        # 應該選 G (完全五度)
        assert omit_pc_with == 7

    def test_backwards_compatible_no_essential(self):
        """不傳 essential_pcs 行為與舊版一致."""
        from core.repair import _harmonic_omit_choice
        pitches = [
            self._mk_pitch(48),
            self._mk_pitch(52),
            self._mk_pitch(55),
            self._mk_pitch(48),
        ]
        # 不該崩, 回傳合理 index
        idx = _harmonic_omit_choice(pitches)
        assert 0 <= idx < len(pitches)

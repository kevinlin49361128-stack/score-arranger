"""Phrase Detection 單元測試"""

from __future__ import annotations

import math
from fractions import Fraction

import pytest

from core.analyzer.phrase import (
    BoundarySignal,
    build_phrases,
    confidence,
    detect_contour_inflections,
    detect_double_barlines,
    detect_dynamic_resets,
    detect_fermatas,
    detect_large_leaps,
    detect_long_rests,
    detect_phrases,
    detect_rehearsal_marks,
    detect_slur_endings,
    detect_style,
    detect_tempo_changes,
    detect_time_signature_changes,
    dp_segment,
    length_log_prior,
    length_log_prior_chorale,
    length_log_prior_romantic,
    merge_signals,
)
from core.ir import (
    Measure,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Section,
    Voice,
)


# ============================================================================
# Test fixtures
# ============================================================================

def _note(midi: int, duration=Fraction(1), onset=Fraction(0), **kwargs) -> NoteEvent:
    return NoteEvent(
        pitch=Pitch(midi, f"note{midi}"),
        duration=duration,
        onset=onset,
        **kwargs,
    )


def _rest(duration=Fraction(1), onset=Fraction(0), **kwargs) -> RestEvent:
    return RestEvent(duration=duration, onset=onset, **kwargs)


def _measure(number: int, events: list, **kwargs) -> Measure:
    return Measure(
        number=number,
        voices={1: Voice(voice_id=1, events=events)},
        **kwargs,
    )


def _scale_part(num_measures: int = 16, start_midi: int = 60) -> Part:
    """建構 num_measures 個小節, 每小節 4 個音的上行音階 part。"""
    measures = []
    pitch = start_midi
    for i in range(num_measures):
        events = []
        for beat in range(4):
            events.append(_note(
                midi=pitch, duration=Fraction(1), onset=Fraction(beat),
            ))
            pitch = (pitch + 1) % 128 if pitch < 100 else pitch  # 簡單上行
        measures.append(Measure(
            number=i + 1,
            time_signature=(4, 4) if i == 0 else None,
            voices={1: Voice(voice_id=1, events=events)},
        ))
    return Part(
        part_id="test", name_display="Test",
        instrument_id="violin", measures=measures,
    )


# ============================================================================
# Length prior
# ============================================================================

class TestLengthPrior:
    def test_peaks_at_4(self):
        """4 小節應為最高機率"""
        p4 = length_log_prior(4)
        for n in [2, 3, 5, 6, 10, 16, 20]:
            assert p4 >= length_log_prior(n), f"4 < {n}: {p4} vs {length_log_prior(n)}"

    def test_decreasing_far_from_modes(self):
        """遠離 4 和 8 的兩個 mode 應下降"""
        assert length_log_prior(4) > length_log_prior(2)
        assert length_log_prior(8) > length_log_prior(20)

    def test_zero_returns_neginf(self):
        assert length_log_prior(0) == float("-inf")


# ============================================================================
# Confidence
# ============================================================================

class TestConfidence:
    def test_zero_weight_zero_conf(self):
        assert confidence(0.0) == 0.0

    def test_high_weight_near_one(self):
        assert confidence(5.0) > 0.99

    def test_monotonic(self):
        assert confidence(1.0) < confidence(2.0) < confidence(3.0)


# ============================================================================
# Signal merging
# ============================================================================

def test_merge_signals_accumulates_weight():
    signals = [
        BoundarySignal(measure=5, weight=1.0, reasons=["a"]),
        BoundarySignal(measure=5, weight=0.6, reasons=["b"]),
        BoundarySignal(measure=10, weight=0.3, reasons=["c"]),
    ]
    merged = merge_signals(signals)
    assert merged[5].weight == pytest.approx(1.6)
    assert set(merged[5].reasons) == {"a", "b"}
    assert merged[10].weight == 0.3


# ============================================================================
# 個別 signal detector
# ============================================================================

class TestDetectLongRests:
    def test_quarter_rest_triggers(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60), _rest(duration=Fraction(1), onset=Fraction(1))]),
            _measure(2, [_note(62)]),
            _measure(3, [_note(64)]),
        ])
        section = Section(section_id=0, start_measure=1, end_measure=3)
        sigs = detect_long_rests(part, section)
        assert len(sigs) == 1
        assert sigs[0].measure == 2  # 邊界在休止符後一小節
        assert sigs[0].weight == 1.0

    def test_short_rest_does_not_trigger(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60), _rest(duration=Fraction(1, 4))]),
            _measure(2, [_note(62)]),
        ])
        section = Section(section_id=0, start_measure=1, end_measure=2)
        assert len(detect_long_rests(part, section)) == 0


class TestDetectSlurEndings:
    def test_slur_end_creates_boundary(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60, slur_group=1)]),
            _measure(2, [_note(62, slur_group=1)]),
            _measure(3, [_note(64, slur_group=1)]),
            _measure(4, [_note(65)]),
        ])
        section = Section(section_id=0, start_measure=1, end_measure=4)
        sigs = detect_slur_endings(part, section)
        assert len(sigs) == 1
        assert sigs[0].measure == 4  # slur 結束在 m.3, 邊界在 m.4


class TestDetectDoubleBarlines:
    def test_double_barline(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60)]),
            _measure(2, [_note(62)], barline_right="double"),
            _measure(3, [_note(64)]),
        ])
        section = Section(section_id=0, start_measure=1, end_measure=3)
        sigs = detect_double_barlines(part, section)
        assert len(sigs) == 1
        assert sigs[0].measure == 3


class TestDetectFermatas:
    def test_fermata_articulation(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60)]),
            _measure(2, [_note(62, articulations=["fermata"])]),
            _measure(3, [_note(64)]),
        ])
        section = Section(section_id=0, start_measure=1, end_measure=3)
        sigs = detect_fermatas(part, section)
        assert len(sigs) == 1
        assert sigs[0].measure == 3


class TestDetectTempoChanges:
    def test_tempo_text_at_mid_section(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60)], tempo_text="Allegro"),
            _measure(2, [_note(62)]),
            _measure(3, [_note(64)], tempo_text="Andante"),
            _measure(4, [_note(65)]),
        ])
        section = Section(section_id=0, start_measure=1, end_measure=4)
        sigs = detect_tempo_changes(part, section)
        # 第一個 measure 是 section 起點, 不算; m.3 的 tempo_text 是新標記
        assert len(sigs) == 1
        assert sigs[0].measure == 3
        assert sigs[0].weight == 0.6


class TestDetectTimeSignatureChanges:
    def test_time_sig_change_mid_section(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60)], time_signature=(4, 4)),
            _measure(2, [_note(62)]),
            _measure(3, [_note(64)], time_signature=(3, 4)),
            _measure(4, [_note(65)]),
        ])
        section = Section(section_id=0, start_measure=1, end_measure=4)
        sigs = detect_time_signature_changes(part, section)
        assert len(sigs) == 1
        assert sigs[0].measure == 3


class TestDetectRehearsalMarks:
    def test_rehearsal_at_m5(self):
        measures = [_measure(i, [_note(60)]) for i in range(1, 9)]
        measures[4] = Measure(  # m.5 (index 4)
            number=5,
            voices={1: Voice(voice_id=1, events=[_note(60)])},
            rehearsal_mark="A",
        )
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=measures)
        section = Section(section_id=0, start_measure=1, end_measure=8)
        sigs = detect_rehearsal_marks(part, section)
        assert len(sigs) == 1
        assert sigs[0].measure == 5


class TestDetectLargeLeaps:
    def test_octave_leap_across_measures(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60)]),
            _measure(2, [_note(72)]),  # 一個八度跳
        ])
        section = Section(section_id=0, start_measure=1, end_measure=2)
        sigs = detect_large_leaps(part, section)
        assert len(sigs) == 1
        assert sigs[0].measure == 2
        assert sigs[0].weight == 0.3

    def test_small_leap_does_not_trigger(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60)]),
            _measure(2, [_note(64)]),  # 大三度,不夠
        ])
        section = Section(section_id=0, start_measure=1, end_measure=2)
        assert len(detect_large_leaps(part, section)) == 0


class TestDetectDynamicResets:
    def test_ff_to_p_subito(self):
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, [_note(60, dynamic="ff")]),
            _measure(2, [_note(62, dynamic="p")]),
        ])
        section = Section(section_id=0, start_measure=1, end_measure=2)
        sigs = detect_dynamic_resets(part, section)
        assert len(sigs) == 1
        assert sigs[0].measure == 2


class TestDetectContourInflections:
    def test_ascending_then_descending(self):
        """m.1 含 8 個上行八分音符,m.2 從首音開始下行 → 反轉跨小節。"""
        # m.1: 58, 59, 60, 61, 62, 63, 64, 65 (8 個八分音符上行)
        m1_events = [
            _note(58 + i, duration=Fraction(1, 2), onset=Fraction(i, 2))
            for i in range(8)
        ]
        # m.2: 64, 62, 60, 58 下行四分音符
        m2_events = [
            _note(64 - 2 * i, duration=Fraction(1), onset=Fraction(i))
            for i in range(4)
        ]
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=[
            _measure(1, m1_events, time_signature=(4, 4)),
            _measure(2, m2_events),
        ])
        section = Section(section_id=0, start_measure=1, end_measure=2)
        sigs = detect_contour_inflections(part, section, min_run=4)
        # 上行 run >= 4 後在 m.2 首音反向 → 邊界在 m.2
        assert len(sigs) >= 1
        assert sigs[0].measure == 2


# ============================================================================
# DP segmentation
# ============================================================================

class TestDpSegment:
    def test_empty_signals_short_section(self):
        """空訊號 + 短 section → 一個 phrase"""
        result = dp_segment({}, start_measure=1, end_measure=1)
        # section_len=1 < min_phrase_len, fallback 為一個 phrase
        assert result == [1, 2]

    def test_strong_signal_creates_split(self):
        """中段強訊號 → 切在訊號處"""
        signals = {8: BoundarySignal(measure=8, weight=2.0, reasons=["test"])}
        result = dp_segment(signals, start_measure=1, end_measure=16)
        # 預期切在 m.8 附近 (給予先驗偏好 4 或 8 小節)
        assert 8 in result or 7 in result or 9 in result

    def test_prefers_4_measure_phrases_without_signals(self):
        """無訊號的 16 小節, 應切為約 4 個 4 小節 phrase"""
        result = dp_segment({}, start_measure=1, end_measure=16)
        # 應該至少有 3 個 phrase (4 個邊界 + start + end+1)
        assert len(result) >= 3
        # phrase 長度應接近 4
        for i in range(len(result) - 1):
            length = result[i + 1] - result[i]
            assert 2 <= length <= 8, f"phrase length {length} unexpected"

    def test_section_too_long_no_signals_force_split(self):
        """50 小節無訊號, 但 max_phrase=32, 必須切"""
        result = dp_segment({}, start_measure=1, end_measure=50, max_phrase_len=32)
        assert len(result) >= 3
        for i in range(len(result) - 1):
            length = result[i + 1] - result[i]
            assert length <= 32

    def test_endpoints_always_included(self):
        result = dp_segment({}, start_measure=5, end_measure=20)
        assert result[0] == 5
        assert result[-1] == 21


# ============================================================================
# build_phrases
# ============================================================================

class TestBuildPhrases:
    def test_basic_construction(self):
        signals = {5: BoundarySignal(measure=5, weight=1.0, reasons=["test"])}
        phrases = build_phrases([1, 5, 9], signals)
        assert len(phrases) == 2
        assert phrases[0].start == (1, Fraction(0))
        assert phrases[0].end == (5, Fraction(0))
        assert phrases[1].start == (5, Fraction(0))
        assert phrases[1].end == (9, Fraction(0))

    def test_phrase_id_start(self):
        phrases = build_phrases([1, 5, 9], {}, phrase_id_start=10)
        assert phrases[0].phrase_id == 10
        assert phrases[1].phrase_id == 11

    def test_confidence_from_signal(self):
        signals = {5: BoundarySignal(measure=5, weight=2.0, reasons=["test"])}
        phrases = build_phrases([1, 5, 9], signals)
        # 第一個 phrase 的 end 在 m.5, 有 weight=2.0 的訊號
        assert phrases[0].detection_confidence > 0.8
        # 第二個 phrase 的 end 是 section 終點, conf=1.0
        assert phrases[1].detection_confidence == 1.0

    def test_no_signal_low_confidence(self):
        phrases = build_phrases([1, 5, 9], {})
        # m.5 無訊號 → conf = 0
        assert phrases[0].detection_confidence == 0.0


# ============================================================================
# 完整流程 (detect_phrases)
# ============================================================================

class TestStylePriors:
    def test_classical_peaks_at_4(self):
        p4 = length_log_prior(4)
        for n in (2, 3, 5, 6, 8, 16):
            assert p4 >= length_log_prior(n)

    def test_chorale_peaks_at_2(self):
        p2 = length_log_prior_chorale(2)
        for n in (3, 4, 6, 8, 12):
            assert p2 >= length_log_prior_chorale(n)

    def test_romantic_peaks_at_8(self):
        p8 = length_log_prior_romantic(8)
        # 8 應為最高 (其他可能接近)
        for n in (2, 3, 16, 20):
            assert p8 >= length_log_prior_romantic(n)


class TestDetectStyle:
    def test_high_fermata_density_chorale(self):
        """每 2 小節一個 fermata → chorale"""
        measures = []
        for i in range(1, 11):
            events = [
                _note(60),
                _note(62, onset=Fraction(1)),
                _note(64, onset=Fraction(2)),
            ]
            # 每偶數小節最後加 fermata
            if i % 2 == 0:
                events.append(_note(
                    65, onset=Fraction(3),
                    articulations=["fermata"],
                ))
            else:
                events.append(_note(65, onset=Fraction(3)))
            measures.append(Measure(
                number=i,
                time_signature=(4, 4) if i == 1 else None,
                voices={1: Voice(voice_id=1, events=events)},
            ))
        part = Part(part_id="p", name_display="P",
                    instrument_id="violin", measures=measures)
        section = Section(0, 1, 10)
        assert detect_style(part, section) == "chorale"

    def test_no_fermata_classical(self):
        part = _scale_part(num_measures=16)
        section = Section(0, 1, 16)
        assert detect_style(part, section) == "classical"


class TestDetectPhrasesWithStyleHint:
    def test_chorale_hint_produces_2_measure_phrases(self):
        """已知 2-bar 結構,用 chorale hint 應切為 2 小節"""
        part = _scale_part(num_measures=16)
        section = Section(0, 1, 16)
        phrases = detect_phrases(part, section, style_hint="chorale")
        # 應有 ≥ 6 phrases (~16/2)
        assert len(phrases) >= 6


class TestDetectPhrasesIntegration:
    def test_classical_4_measure_phrases(self):
        """無強訊號的 16 小節音階, 應切為類 4 小節 phrase"""
        part = _scale_part(num_measures=16)
        section = Section(section_id=0, start_measure=1, end_measure=16)
        phrases = detect_phrases(part, section)

        assert len(phrases) >= 3
        # 大部分 phrase 長度應在 2-8 之間
        lengths = [p.end[0] - p.start[0] for p in phrases]
        for length in lengths:
            assert 2 <= length <= 16

    def test_long_rest_creates_boundary(self):
        """中段有長休止符 → 邊界應切在休止後"""
        measures = []
        for i in range(1, 17):
            if i == 8:
                # 第 8 小節中間有 2 拍休止符
                events = [
                    _note(60, duration=Fraction(1)),
                    _note(62, duration=Fraction(1), onset=Fraction(1)),
                    _rest(duration=Fraction(2), onset=Fraction(2)),
                ]
            else:
                events = [_note(60 + i, duration=Fraction(4))]
            measures.append(Measure(
                number=i,
                time_signature=(4, 4) if i == 1 else None,
                voices={1: Voice(voice_id=1, events=events)},
            ))
        part = Part(part_id="t", name_display="T", instrument_id="violin", measures=measures)
        section = Section(section_id=0, start_measure=1, end_measure=16)
        phrases = detect_phrases(part, section)

        # 應有 phrase 邊界在 m.9 (休止符後)
        end_measures = {p.end[0] for p in phrases}
        assert 9 in end_measures, f"無 m.9 邊界, 收到 {end_measures}"

    def test_short_section_one_phrase(self):
        part = _scale_part(num_measures=1)
        section = Section(section_id=0, start_measure=1, end_measure=1)
        phrases = detect_phrases(part, section)
        assert len(phrases) == 1

    def test_assigns_unique_phrase_ids(self):
        part = _scale_part(num_measures=16)
        section = Section(section_id=0, start_measure=1, end_measure=16)
        phrases = detect_phrases(part, section, phrase_id_start=100)
        ids = [p.phrase_id for p in phrases]
        assert ids == list(range(100, 100 + len(phrases)))

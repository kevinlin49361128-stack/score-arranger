"""Melody detection + Function tagging 單元測試"""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.analyzer.function import (
    FunctionTagReport,
    tag_all_sections,
    tag_section_functions,
)
from core.analyzer.melody import (
    bass_score,
    compute_baseline,
    compute_part_stats,
    compute_skyline,
    melody_score,
    skyline_match_ratio,
)
from core.ir import (
    ChordEvent,
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Section,
    Voice,
    VoiceFunction,
)


# ============================================================================
# Test fixtures
# ============================================================================

def _note(midi: int, dur=Fraction(1), onset=Fraction(0)) -> NoteEvent:
    return NoteEvent(
        pitch=Pitch(midi, f"n{midi}"),
        duration=dur,
        onset=onset,
    )


def _chord(midis: list[int], dur=Fraction(1), onset=Fraction(0)) -> ChordEvent:
    return ChordEvent(
        pitches=[Pitch(m, f"n{m}") for m in midis],
        duration=dur,
        onset=onset,
    )


def _part(part_id: str, instrument: str, measure_events: list[list]) -> Part:
    """測試輔助: 建立含 4/4 拍號的 Part, 每小節 4 個 event。"""
    measures = []
    for i, events in enumerate(measure_events):
        measures.append(Measure(
            number=i + 1,
            time_signature=(4, 4) if i == 0 else None,
            voices={1: Voice(voice_id=1, events=events)},
        ))
    return Part(
        part_id=part_id, name_display=part_id,
        instrument_id=instrument, measures=measures,
    )


def _make_score(parts: list[Part]) -> Score:
    n_measures = max(len(p.measures) for p in parts)
    return Score(
        movements=[Movement(
            movement_id=1,
            measure_count=n_measures,
            sections=[Section(
                section_id=0, start_measure=1, end_measure=n_measures
            )],
        )],
        parts=parts,
    )


# ============================================================================
# PartStats
# ============================================================================

class TestPartStats:
    def test_empty_section(self):
        part = _part("p", "violin", [[_note(60, dur=Fraction(4))]])
        section = Section(section_id=99, start_measure=99, end_measure=99)
        stats = compute_part_stats(part, section)
        assert stats.note_count == 0

    def test_stepwise_scale(self):
        """上行音階,stepwise_ratio 應為 1.0"""
        events = [
            _note(60), _note(62, onset=Fraction(1)),
            _note(64, onset=Fraction(2)), _note(65, onset=Fraction(3)),
        ]
        part = _part("p", "violin", [events])
        section = Section(section_id=0, start_measure=1, end_measure=1)
        stats = compute_part_stats(part, section)
        assert stats.note_count == 4
        assert stats.stepwise_ratio == 1.0
        assert stats.avg_pitch == pytest.approx((60 + 62 + 64 + 65) / 4)

    def test_leap_ratio(self):
        """全部大跳"""
        events = [
            _note(60), _note(72, onset=Fraction(1)),
            _note(60, onset=Fraction(2)), _note(72, onset=Fraction(3)),
        ]
        part = _part("p", "violin", [events])
        section = Section(section_id=0, start_measure=1, end_measure=1)
        stats = compute_part_stats(part, section)
        assert stats.leap_ratio > 0.9


# ============================================================================
# Skyline
# ============================================================================

class TestSkyline:
    def test_higher_part_at_top(self):
        soprano = _part("sop", "violin", [[
            _note(72, dur=Fraction(4)),  # C5 holding
        ]])
        bass = _part("bas", "cello", [[
            _note(48, dur=Fraction(4)),  # C3 holding
        ]])
        score = _make_score([soprano, bass])
        section = Section(0, 1, 1)

        skyline = compute_skyline(score, section)
        # 4 beats × 1 measure = 4 entries, 全部 soprano
        assert len(skyline) == 4
        for _, _, pid, midi in skyline:
            assert pid == "sop"
            assert midi == 72

    def test_skyline_match_ratio(self):
        soprano = _part("sop", "violin", [[_note(72, dur=Fraction(4))]])
        bass = _part("bas", "cello", [[_note(48, dur=Fraction(4))]])
        score = _make_score([soprano, bass])
        section = Section(0, 1, 1)
        skyline = compute_skyline(score, section)
        match = skyline_match_ratio(skyline)
        assert match["sop"] == 1.0
        assert "bas" not in match

    def test_baseline_dual(self):
        """compute_baseline 應與 skyline 對偶"""
        soprano = _part("sop", "violin", [[_note(72, dur=Fraction(4))]])
        bass = _part("bas", "cello", [[_note(48, dur=Fraction(4))]])
        score = _make_score([soprano, bass])
        section = Section(0, 1, 1)
        baseline = compute_baseline(score, section)
        assert len(baseline) == 4
        for _, _, pid, midi in baseline:
            assert pid == "bas"
            assert midi == 48


# ============================================================================
# Melody score
# ============================================================================

class TestMelodyScore:
    def test_perfect_melody_features(self):
        """高 skyline + 全 stepwise + 高密度 + 多樣節奏 → 接近 1.0"""
        stats = compute_part_stats(
            _part("p", "violin", [[
                _note(60, dur=Fraction(1, 2)),
                _note(62, dur=Fraction(1, 4), onset=Fraction(1, 2)),
                _note(64, dur=Fraction(1, 4), onset=Fraction(3, 4)),
                _note(65, dur=Fraction(1), onset=Fraction(1)),
                _note(67, dur=Fraction(1, 2), onset=Fraction(2)),
                _note(69, dur=Fraction(1, 2), onset=Fraction(5, 2)),
                _note(71, dur=Fraction(1), onset=Fraction(3)),
            ]]),
            Section(0, 1, 1),
        )
        score = melody_score(stats, skyline_match=1.0,
                             max_note_count=stats.note_count,
                             max_rhythm_variety=stats.rhythm_variety)
        # 0.4 + 0.3*1.0 + 0.2*1.0 + 0.1*1.0 = 1.0
        assert score >= 0.9

    def test_zero_notes_zero_score(self):
        from core.analyzer.melody import PartStats
        stats = PartStats(part_id="empty")
        assert melody_score(stats, 0.5, 10, 5) == 0.0


# ============================================================================
# Function tagging
# ============================================================================

class TestTagSectionFunctions:
    def test_satb_chorale(self):
        """SATB 四部和聲: 最高為 MELODY, 最低為 BASS"""
        sop = _part("sop", "violin", [[_chord([72, 67], dur=Fraction(4))]])
        alt = _part("alt", "viola", [[_chord([64, 60], dur=Fraction(4))]])
        ten = _part("ten", "cello", [[_chord([55, 52], dur=Fraction(4))]])
        bas = _part("bas", "cello", [[_chord([48, 43], dur=Fraction(4))]])
        score = _make_score([sop, alt, ten, bas])
        section = Section(0, 1, 1)

        report = tag_section_functions(score, section)
        assert report.tags["sop"] == VoiceFunction.MELODY
        assert report.tags["bas"] == VoiceFunction.BASS

    def test_simple_two_part(self):
        soprano = _part("sop", "violin", [[
            _note(72), _note(74, onset=Fraction(1)),
            _note(76, onset=Fraction(2)), _note(77, onset=Fraction(3)),
        ]])
        bass = _part("bas", "cello", [[
            _note(48, dur=Fraction(4)),
        ]])
        score = _make_score([soprano, bass])
        section = Section(0, 1, 1)
        report = tag_section_functions(score, section)
        assert report.tags["sop"] == VoiceFunction.MELODY
        assert report.tags["bas"] == VoiceFunction.BASS

    def test_empty_score(self):
        rest_event = RestEvent(duration=Fraction(4), onset=Fraction(0))
        empty_part = Part(
            part_id="e",
            name_display="E",
            instrument_id="violin",
            measures=[Measure(
                number=1,
                time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[rest_event])},
            )],
        )
        score = _make_score([empty_part])
        section = Section(0, 1, 1)
        report = tag_section_functions(score, section)
        assert report.tags["e"] == VoiceFunction.UNASSIGNED

    def test_pedal_detection(self):
        """長音持續 (avg_duration > 2, rhythm_variety <= 2) → PEDAL"""
        melody = _part("mel", "violin", [[
            _note(72), _note(74, onset=Fraction(1)),
            _note(76, onset=Fraction(2)), _note(77, onset=Fraction(3)),
        ]])
        pedal = _part("ped", "viola", [[_note(60, dur=Fraction(4))]])
        bass = _part("bas", "cello", [[
            _note(48), _note(50, onset=Fraction(1)),
            _note(48, onset=Fraction(2)), _note(50, onset=Fraction(3)),
        ]])
        score = _make_score([melody, pedal, bass])
        section = Section(0, 1, 1)
        report = tag_section_functions(score, section)
        assert report.tags["mel"] == VoiceFunction.MELODY
        assert report.tags["bas"] == VoiceFunction.BASS
        assert report.tags["ped"] == VoiceFunction.PEDAL


class TestTagAllSections:
    def test_writes_back_to_part(self):
        soprano = _part("sop", "violin", [[
            _note(72), _note(74, onset=Fraction(1)),
            _note(76, onset=Fraction(2)), _note(77, onset=Fraction(3)),
        ]])
        bass = _part("bas", "cello", [[_note(48, dur=Fraction(4))]])
        score = _make_score([soprano, bass])

        tag_all_sections(score)
        assert soprano.function_tags[0] == VoiceFunction.MELODY
        assert bass.function_tags[0] == VoiceFunction.BASS

    def test_fallback_section_when_none(self):
        soprano = _part("sop", "violin", [[_note(72, dur=Fraction(4))]])
        # 沒有 section 定義
        score = Score(
            movements=[Movement(movement_id=1, measure_count=1)],
            parts=[soprano],
        )
        reports = tag_all_sections(score)
        assert 0 in reports
        assert reports[0].tags["sop"] == VoiceFunction.MELODY


# ============================================================================
# 整合: parser + tagging
# ============================================================================

def test_tagging_on_parsed_bach():
    """Bach 聖詠 parse 後跑 function tagging,Soprano 應為 MELODY、Bass 為 BASS"""
    from music21 import corpus
    from core.parser import parse_stream
    m21_score = corpus.parse("bach/bwv66.6")
    ir = parse_stream(m21_score)
    reports = tag_all_sections(ir)

    assert 0 in reports
    report = reports[0]
    # 取最高音 part 與最低音 part
    parts_by_avg_pitch = sorted(
        ir.parts,
        key=lambda p: report.stats[p.part_id].avg_pitch,
        reverse=True,
    )
    highest = parts_by_avg_pitch[0]
    lowest = parts_by_avg_pitch[-1]
    assert report.tags[highest.part_id] == VoiceFunction.MELODY
    assert report.tags[lowest.part_id] == VoiceFunction.BASS

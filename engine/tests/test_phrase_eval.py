"""Phrase Detection 評估框架單元測試"""

from __future__ import annotations

import json
from fractions import Fraction
from pathlib import Path

import pytest

from core.analyzer.phrase import detect_phrases
from core.evaluation.phrase_eval import (
    EvaluationResult,
    PhraseAnnotation,
    evaluate_boundaries,
    evaluate_phrase_detection,
    load_annotation,
)
from core.ir import Measure, NoteEvent, Part, Phrase, Pitch, Section, Voice


# ============================================================================
# Boundary 評估
# ============================================================================

class TestEvaluateBoundaries:
    def test_exact_match(self):
        r = evaluate_boundaries([5, 9, 13], [5, 9, 13])
        assert r.precision == 1.0
        assert r.recall == 1.0
        assert r.f1 == 1.0
        assert r.true_positives == 3
        assert r.false_positives == 0
        assert r.false_negatives == 0

    def test_perfect_with_tolerance(self):
        """預測偏移 1 小節, 仍應為 TP"""
        r = evaluate_boundaries([6, 10, 14], [5, 9, 13], tolerance=1)
        assert r.true_positives == 3
        assert r.f1 == 1.0
        assert r.avg_displacement == 1.0

    def test_partial_match(self):
        """3 預測, 2 黃金, 1 命中"""
        r = evaluate_boundaries([5, 9, 20], [5, 13], tolerance=1)
        assert r.true_positives == 1
        assert r.false_positives == 2  # 9, 20 不命中
        assert r.false_negatives == 1  # 13 漏

    def test_zero_predictions(self):
        r = evaluate_boundaries([], [5, 9, 13])
        assert r.recall == 0.0
        assert r.precision == 0.0
        assert r.f1 == 0.0
        assert r.false_negatives == 3

    def test_zero_gold(self):
        """應全為 FP"""
        r = evaluate_boundaries([5, 9], [])
        assert r.false_positives == 2

    def test_both_empty(self):
        r = evaluate_boundaries([], [])
        assert r.f1 == 1.0  # 邊角: 兩邊皆無

    def test_tolerance_zero_strict(self):
        """tolerance=0 必須完全匹配"""
        r = evaluate_boundaries([6], [5], tolerance=0)
        assert r.true_positives == 0

    def test_phase_0_classical_threshold(self):
        """F1 ≥ 0.75 + avg_disp ≤ 1.5 → passes"""
        r = evaluate_boundaries([5, 9, 13, 17], [5, 9, 13, 17])
        assert r.passes_phase_0_classical

        r2 = evaluate_boundaries([5, 9, 13, 99], [5, 9, 13, 17])
        # 3 TP, 1 FP, 1 FN. F1 = 6/8 = 0.75 (邊界值)
        # 但 99 vs 17 距離 82, 超過 tolerance, 算 FP+FN 不算 match
        # precision = 3/4 = 0.75, recall = 3/4 = 0.75, f1 = 0.75
        # passes? boundary case
        assert r2.f1 == 0.75

    def test_greedy_nearest_neighbor(self):
        """多預測接近同一個 gold, 取最近的"""
        # gold=10, pred=9, 11. 9 距離 1, 11 距離 1. 取 9 (排序穩定)
        r = evaluate_boundaries([9, 11], [10], tolerance=1)
        assert r.true_positives == 1
        assert r.false_positives == 1


# ============================================================================
# Phrase → boundary 抽取
# ============================================================================

class TestEvaluatePhraseDetection:
    def test_from_phrases(self):
        phrases = [
            Phrase(0, (1, Fraction(0)), (5, Fraction(0))),
            Phrase(1, (5, Fraction(0)), (9, Fraction(0))),
            Phrase(2, (9, Fraction(0)), (13, Fraction(0))),
            Phrase(3, (13, Fraction(0)), (17, Fraction(0))),
        ]
        ann = PhraseAnnotation(
            part_id="all",
            section_id=0,
            section_range=(1, 16),
            boundaries=[5, 9, 13],
        )
        r = evaluate_phrase_detection(phrases, ann)
        assert r.f1 == 1.0


# ============================================================================
# 真實 detector × 合成資料: F1 量測
# ============================================================================

def _scale_part(num_measures: int) -> Part:
    measures = []
    for i in range(num_measures):
        events = [
            NoteEvent(
                pitch=Pitch(60 + (i + j) % 12, "n"),
                duration=Fraction(1),
                onset=Fraction(j),
            )
            for j in range(4)
        ]
        measures.append(Measure(
            number=i + 1,
            time_signature=(4, 4) if i == 0 else None,
            voices={1: Voice(voice_id=1, events=events)},
        ))
    return Part(
        part_id="test", name_display="Test",
        instrument_id="violin", measures=measures,
    )


def test_detector_against_synthetic_4x4():
    """合成 16 小節音階 + 內建長度先驗,應切為 ~4 phrase"""
    part = _scale_part(16)
    section = Section(section_id=0, start_measure=1, end_measure=16)
    phrases = detect_phrases(part, section)

    ann = PhraseAnnotation(
        part_id="test",
        section_id=0,
        section_range=(1, 16),
        boundaries=[5, 9, 13],  # 4 個 4-measure phrase
    )
    r = evaluate_phrase_detection(phrases, ann, tolerance=1)
    # 應有合理 F1 (無強訊號時依長度先驗)
    assert r.f1 >= 0.5, f"F1 too low: {r}"


# ============================================================================
# JSON 載入
# ============================================================================

def test_load_annotation_synthetic_4x4(tmp_path):
    """從專案資料集載入合成 4x4 annotation"""
    repo_root = Path(__file__).parent.parent.parent
    path = repo_root / "evaluation" / "datasets" / "synthetic_4x4.json"
    if not path.exists():
        pytest.skip(f"annotation file not found: {path}")

    gt = load_annotation(path)
    assert gt.piece_id == "synthetic_4x4"
    assert len(gt.annotations) == 1
    ann = gt.annotations[0]
    assert ann.section_range == (1, 16)
    assert ann.boundaries == [5, 9, 13]


def test_load_annotation_bach(tmp_path):
    repo_root = Path(__file__).parent.parent.parent
    path = repo_root / "evaluation" / "datasets" / "bach_bwv66_6.json"
    if not path.exists():
        pytest.skip(f"annotation file not found: {path}")

    gt = load_annotation(path)
    assert gt.piece_id == "bach_bwv66_6"
    assert gt.source.startswith("music21:")
    ann = gt.annotations[0]
    # Fermata 啟發式產生的邊界
    assert ann.boundaries == [2, 3, 4, 6, 8]

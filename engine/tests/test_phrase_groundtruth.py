"""
Phrase Detection 對 Bach 聖詠 fermata ground truth 的聚合準確度測試。

與 test_phrase_eval.py 的差異: 後者用合成資料與單元邏輯, 本檔用真實 Bach
四部聖詠, 由延長記號 (fermata) 客觀推導樂句邊界 ground truth, 量測偵測器的
實際 precision / recall / F1, 並以略低於量測值的門檻作為**回歸防線**。

ground truth 推導規則見 ``core.evaluation.chorale_groundtruth`` 模組 docstring。
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from core.analyzer.phrase import detect_phrases
from core.evaluation.chorale_groundtruth import (
    CURATED_BACH_CHORALES,
    derive_ground_truth,
    load_chorale_ground_truth,
)
from core.evaluation.phrase_eval import evaluate_boundaries
from core.ir import Section

# 回歸防線門檻。實測聚合 F1 ≈ 0.97 (見 test 印出的 summary)。
# 門檻刻意設在實測值下方 — 目的是抓回歸, 不是讓 build 失敗。
MIN_AGGREGATE_F1 = 0.85
MIN_AGGREGATE_PRECISION = 0.80
MIN_AGGREGATE_RECALL = 0.80
BOUNDARY_TOLERANCE = 1


@dataclass
class _PieceResult:
    piece_id: str
    gold: list[int]
    predicted: list[int]
    tp: int
    fp: int
    fn: int
    f1: float


def _evaluate_one(corpus_id: str) -> _PieceResult:
    """載入一首聖詠, 跑 detect_phrases, 與 fermata gold 比對。"""
    score, gt = load_chorale_ground_truth(corpus_id)
    # 聖詠以女高音 (part 0) 為旋律聲部。
    part = score.parts[0]
    section = Section(
        section_id=0,
        start_measure=gt.start_measure,
        end_measure=gt.end_measure,
    )
    phrases = detect_phrases(part, section)
    # 內部邊界 = 非第一個 phrase 的起始小節 (對齊 evaluate_phrase_detection)。
    predicted = sorted({p.start[0] for p in phrases[1:]})
    result = evaluate_boundaries(predicted, gt.boundaries, tolerance=BOUNDARY_TOLERANCE)
    return _PieceResult(
        piece_id=corpus_id,
        gold=gt.boundaries,
        predicted=predicted,
        tp=result.true_positives,
        fp=result.false_positives,
        fn=result.false_negatives,
        f1=result.f1,
    )


def test_chorale_aggregate_phrase_detection_f1(capsys: pytest.CaptureFixture[str]) -> None:
    """對 curated 的 Bach 四部聖詠量測聚合 (micro-averaged) F1。

    micro-average: 跨曲累加 tp/fp/fn 再算 P/R/F1 — 反映整體偵測品質,
    不被短曲的高變異拉偏。
    """
    results: list[_PieceResult] = []
    for corpus_id in CURATED_BACH_CHORALES:
        results.append(_evaluate_one(corpus_id))

    assert results, "curated 聖詠清單為空"

    tp_sum = sum(r.tp for r in results)
    fp_sum = sum(r.fp for r in results)
    fn_sum = sum(r.fn for r in results)

    precision = tp_sum / max(tp_sum + fp_sum, 1)
    recall = tp_sum / max(tp_sum + fn_sum, 1)
    f1 = (
        2 * precision * recall / max(precision + recall, 1e-10)
        if (precision + recall) > 0
        else 0.0
    )

    per_piece_f1 = sorted(r.f1 for r in results)
    mean_f1 = sum(per_piece_f1) / len(per_piece_f1)

    # 量測數字印出 (pytest -s 可見)。
    lines = [
        "",
        "=" * 68,
        f"Phrase detection vs Bach fermata ground truth ({len(results)} chorales)",
        "=" * 68,
    ]
    for r in results:
        lines.append(
            f"  {r.piece_id:16s} gold={r.gold} pred={r.predicted} "
            f"tp={r.tp} fp={r.fp} fn={r.fn} F1={r.f1:.2f}"
        )
    lines.append("-" * 68)
    lines.append(
        f"  AGGREGATE (micro): tp={tp_sum} fp={fp_sum} fn={fn_sum}  "
        f"P={precision:.3f} R={recall:.3f} F1={f1:.3f}"
    )
    lines.append(
        f"  per-piece F1: min={per_piece_f1[0]:.2f} "
        f"max={per_piece_f1[-1]:.2f} mean={mean_f1:.2f}"
    )
    lines.append("=" * 68)
    with capsys.disabled():
        print("\n".join(lines))

    # 回歸防線。
    assert f1 >= MIN_AGGREGATE_F1, (
        f"聚合 F1 {f1:.3f} 低於回歸門檻 {MIN_AGGREGATE_F1} — 偵測器可能退化"
    )
    assert precision >= MIN_AGGREGATE_PRECISION, (
        f"聚合 precision {precision:.3f} 低於門檻 {MIN_AGGREGATE_PRECISION}"
    )
    assert recall >= MIN_AGGREGATE_RECALL, (
        f"聚合 recall {recall:.3f} 低於門檻 {MIN_AGGREGATE_RECALL}"
    )


def test_curated_list_size() -> None:
    """curated 清單應有 15-25 首 (測試時間與覆蓋度的平衡)。"""
    assert 15 <= len(CURATED_BACH_CHORALES) <= 25


def test_final_fermata_is_not_an_internal_boundary() -> None:
    """終曲 fermata 落在最後一小節 → 不得成為內部邊界。"""
    _score, gt = load_chorale_ground_truth("bach/bwv66.6")
    # bwv66.6: fermata 小節含曲末小節 9。
    assert gt.end_measure in gt.fermata_measures
    assert gt.end_measure not in gt.boundaries
    # 內部邊界皆嚴格落在曲內。
    for b in gt.boundaries:
        assert gt.start_measure < b <= gt.end_measure


def test_consecutive_fermatas_yield_adjacent_boundaries() -> None:
    """連續小節皆有 fermata → 產生相鄰邊界 (1 小節長的樂句)。"""
    _score, gt = load_chorale_ground_truth("bach/bwv245.40")
    # bwv245.40 第 22、23 小節為連續 fermata。
    assert 22 in gt.fermata_measures
    assert 23 in gt.fermata_measures
    # 兩者各自結束一樂句 → 邊界 23 與 24 皆存在且相鄰。
    assert 23 in gt.boundaries
    assert 24 in gt.boundaries


def test_boundaries_match_internal_definition() -> None:
    """boundary 須為「第 i>0 個 phrase 的起始小節」— 排序、去重、落在曲內。"""
    for corpus_id in ["bach/bwv66.6", "bach/bwv281", "bach/bwv356"]:
        _score, gt = load_chorale_ground_truth(corpus_id)
        assert gt.boundaries == sorted(set(gt.boundaries))
        for b in gt.boundaries:
            assert gt.start_measure < b <= gt.end_measure


def test_derive_ground_truth_rejects_empty_score() -> None:
    """空樂譜應明確報錯, 而非靜默回傳空 ground truth。"""
    from core.ir import Score

    with pytest.raises(ValueError, match="沒有任何小節"):
        derive_ground_truth(Score(), piece_id="empty")

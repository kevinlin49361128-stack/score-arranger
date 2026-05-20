"""
Phrase Detection 評估框架

對應規格: docs/phrase-detection-spec.md §8 (Phase 0 通過標準: F1 ≥ 0.75 古典時期)

Ground truth 結構 (JSON):
{
  "piece_id": "bach_bwv66_6",
  "source": "music21:bach/bwv66.6",
  "annotator": "demo",
  "notes": "...",
  "annotations": [
    {
      "part_id": "all",  # 或具體 part_id
      "section_id": 0,
      "section_range": [1, 10],
      "boundaries": [5]  # 內部邊界 (不含 section 起點與終點+1)
    }
  ]
}
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from core.ir import Phrase


# ============================================================================
# Data types
# ============================================================================

@dataclass
class PhraseAnnotation:
    """單一 part × section 的人工標註"""
    part_id: str                     # "all" 表示適用所有 part
    section_id: int
    section_range: tuple[int, int]   # (start_measure, end_measure)
    boundaries: list[int]            # 內部邊界 (新 phrase 開始的 measure)


@dataclass
class GroundTruth:
    """整首作品的標註集合"""
    piece_id: str
    source: str                      # music21 corpus path 或檔案路徑
    annotator: str
    notes: str
    annotations: list[PhraseAnnotation]


@dataclass
class EvaluationResult:
    """單一 annotation 的評估結果"""
    precision: float
    recall: float
    f1: float
    avg_displacement: float          # 平均邊界偏移 (小節)
    true_positives: int
    false_positives: int
    false_negatives: int
    matches: list[tuple[int, int, int]] = field(default_factory=list)
    # 每個 match: (predicted_measure, gold_measure, distance)

    @property
    def passes_phase_0_classical(self) -> bool:
        """通過古典時期作品標準: F1 ≥ 0.75 且平均偏移 ≤ 1.5"""
        return self.f1 >= 0.75 and self.avg_displacement <= 1.5

    def __str__(self) -> str:
        return (
            f"P={self.precision:.2f} R={self.recall:.2f} F1={self.f1:.2f} "
            f"disp={self.avg_displacement:.1f} "
            f"(tp={self.true_positives}, fp={self.false_positives}, "
            f"fn={self.false_negatives})"
        )


# ============================================================================
# Loading annotations
# ============================================================================

def load_annotation(path: str | Path) -> GroundTruth:
    """從 JSON 檔載入標註。"""
    p = Path(path)
    data = json.loads(p.read_text(encoding="utf-8"))
    return GroundTruth(
        piece_id=data["piece_id"],
        source=data["source"],
        annotator=data.get("annotator", "unknown"),
        notes=data.get("notes", ""),
        annotations=[
            PhraseAnnotation(
                part_id=a["part_id"],
                section_id=a["section_id"],
                section_range=tuple(a["section_range"]),
                boundaries=a["boundaries"],
            )
            for a in data["annotations"]
        ],
    )


# ============================================================================
# Evaluation
# ============================================================================

def evaluate_boundaries(
    predicted: list[int],
    gold: list[int],
    tolerance: int = 1,
) -> EvaluationResult:
    """比較兩個 boundary 列表的 F1。

    tolerance: 允許邊界誤差 (小節數)
    匹配採用貪婪最近鄰: 按距離排序,優先匹配距離最小的對。
    """
    # 建立所有可能的 (距離, 預測, 黃金) 配對
    candidate_pairs = [
        (abs(p - g), p, g)
        for p in predicted
        for g in gold
        if abs(p - g) <= tolerance
    ]
    candidate_pairs.sort()

    matched_p: set[int] = set()
    matched_g: set[int] = set()
    matches: list[tuple[int, int, int]] = []
    for dist, p, g in candidate_pairs:
        if p in matched_p or g in matched_g:
            continue
        matched_p.add(p)
        matched_g.add(g)
        matches.append((p, g, dist))

    tp = len(matches)
    fp = len(predicted) - tp
    fn = len(gold) - tp

    precision = tp / max(tp + fp, 1) if (tp + fp) > 0 else 0.0
    recall = tp / max(tp + fn, 1) if (tp + fn) > 0 else 0.0
    f1 = (
        2 * precision * recall / max(precision + recall, 1e-10)
        if (precision + recall) > 0 else 0.0
    )
    avg_disp = (
        sum(d for _, _, d in matches) / len(matches) if matches else 0.0
    )

    # 邊角情形: 兩邊都空
    if not predicted and not gold:
        precision = recall = f1 = 1.0

    return EvaluationResult(
        precision=precision,
        recall=recall,
        f1=f1,
        avg_displacement=avg_disp,
        true_positives=tp,
        false_positives=fp,
        false_negatives=fn,
        matches=matches,
    )


def evaluate_phrase_detection(
    predicted_phrases: list[Phrase],
    annotation: PhraseAnnotation,
    tolerance: int = 1,
) -> EvaluationResult:
    """從 Phrase 物件抽出內部邊界,與標註比較。

    內部邊界定義: 非第一個 phrase 的 start 小節。
    (亦等同於非最後一個 phrase 的 end 小節。)
    """
    if not predicted_phrases:
        predicted_boundaries: list[int] = []
    else:
        # phrase[i].start[0] for i > 0 是內部邊界
        predicted_boundaries = sorted({p.start[0] for p in predicted_phrases[1:]})

    return evaluate_boundaries(
        predicted=predicted_boundaries,
        gold=annotation.boundaries,
        tolerance=tolerance,
    )

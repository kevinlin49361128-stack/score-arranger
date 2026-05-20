"""Phase 0 評估工具 — 量化系統決策準確度。"""

from .phrase_eval import (
    EvaluationResult,
    PhraseAnnotation,
    evaluate_boundaries,
    evaluate_phrase_detection,
    load_annotation,
)

__all__ = [
    "EvaluationResult",
    "PhraseAnnotation",
    "evaluate_boundaries",
    "evaluate_phrase_detection",
    "load_annotation",
]

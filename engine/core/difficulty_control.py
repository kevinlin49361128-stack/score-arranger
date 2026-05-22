"""
難度閉環控制器 (Difficulty Control)

  A3 — converge_difficulty: 把一段小節的難度收斂到目標 (整段套同一強度)。
  A2 — level_difficulty:    逐小節把難度抹平到目標 (各小節分別收斂)。

對應 difficulty-loop-plan.md 的 Batch 2 (A3) 與 Batch 3 (A2)。

核心觀念 (plan §一):
  difficulty.py 是目標函式; enrich.py (加難度) 與 simplify.py (降難度)
  是雙向運算元。控制器在深拷貝上試 light / medium / full 三檔強度,
  挑「結果最接近目標」者套用一次 —— 太簡單就 enrich、太難就 simplify。

  level_difficulty (A2) 就是「對每個小節各跑一次 converge_difficulty」,
  因此整段的難度曲線會被抹平, 而不只是平均值被推近目標。
"""

from __future__ import annotations

import copy

from core.difficulty import analyze_part_difficulty
from core.enrich import enrich_part
from core.ir import Score
from core.simplify import simplify_part

# 預設目標帶寬 — 難度與目標相差在此之內即視為達標
DEFAULT_BAND = 0.4

_AMOUNTS = ("light", "medium", "full")


def _range_difficulty(
    part, measure_start: int, measure_end: int,
) -> float:
    """[measure_start, measure_end] 區間的平均難度 (1-5)。

    用 per-measure 難度平均 —— 範圍是整個 part 時等同 part 難度,
    是單一小節時等同該小節難度, A3 與 A2 因此能共用同一把尺。
    """
    pd = analyze_part_difficulty(part)
    scores = [
        m.score_1_to_5 for m in pd.measures
        if measure_start <= m.measure <= measure_end
    ]
    if scores:
        return sum(scores) / len(scores)
    return pd.score_1_to_5


def converge_difficulty(
    part,
    source: Score,
    measure_start: int,
    measure_end: int,
    target: float,
    *,
    band: float = DEFAULT_BAND,
):
    """A3 — 把 part [measure_start, measure_end] 的難度收斂到 target。

    就地修改 part.measures。回傳 (direction, amount, changed) 描述實際
    套用的操作; 已在目標帶內、或沒有任何強度能更接近目標時回 None。

    太簡單 → enrich 加厚; 太難 → simplify 簡化。在深拷貝上試三檔強度,
    挑結果最接近 target 者套用一次。
    """
    cur = _range_difficulty(part, measure_start, measure_end)
    if abs(cur - target) <= band:
        return None

    direction = "enrich" if cur < target else "simplify"
    best_amount: str | None = None
    best_dist = abs(cur - target)

    for amount in _AMOUNTS:
        trial = copy.deepcopy(part)
        if direction == "enrich":
            enrich_part(
                trial.measures, source, measure_start, measure_end,
                amount, "block", part.instrument_id,
            )
        else:
            simplify_part(
                trial.measures, measure_start, measure_end,
                amount, part.instrument_id,
            )
        dist = abs(
            _range_difficulty(trial, measure_start, measure_end) - target
        )
        if dist < best_dist:
            best_dist = dist
            best_amount = amount

    if best_amount is None:
        return None  # 沒有任何一檔比現狀更接近目標

    if direction == "enrich":
        changed = enrich_part(
            part.measures, source, measure_start, measure_end,
            best_amount, "block", part.instrument_id,
        )
    else:
        changed = simplify_part(
            part.measures, measure_start, measure_end,
            best_amount, part.instrument_id,
        )
    return (direction, best_amount, changed)


def level_difficulty(
    part,
    source: Score,
    measure_start: int,
    measure_end: int,
    target: float,
    *,
    band: float = DEFAULT_BAND,
) -> int:
    """A2 — 逐小節把 [measure_start, measure_end] 的難度抹平到 target。

    對範圍內每個小節各跑一次 converge_difficulty —— 太難的小節簡化、
    太簡單的加厚 —— 讓整段的難度曲線收斂成平坦, 而非只調整平均值。

    就地修改 part; 回傳實際被調整的小節數。
    """
    leveled = 0
    numbers = [
        m.number for m in part.measures
        if measure_start <= m.number <= measure_end
    ]
    for n in numbers:
        if converge_difficulty(
            part, source, n, n, target, band=band,
        ) is not None:
            leveled += 1
    return leveled

"""
explainer — 「老師評語層」

0.1.32 新加: 把改編 / 修復 / DP / 品質 / 難度資料聚合成
人類可讀的三段式說明:
  - preserved (保留了什麼)
  - changed   (改動了什麼)
  - cost      (音樂代價)

設計原則:
- 純資料聚合, 不再跑分析 — 所有 source signal 來自 arrangement /
  quality_report / difficulty_report / repair_report / vl_dp_result
- 字串是純 zh-TW (前端 i18n 不擴大; 老師面向工具 zh-TW 優先)
- 沒可用 source → 對應 list 留空, 不假裝

未來改進:
- 接 harmony_function RomanNumeral, 在 "changed" 加 V7→I 的解決狀態描述
- per-assignment 級的 diff 分析 (比較 source vs. target 的音符 delta)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .arrangement_model import Arrangement
from .ir import VoiceFunction


# ============================================================================
# 資料模型
# ============================================================================

@dataclass
class PartExplanation:
    """單一聲部的改編說明."""
    part_id: str
    display_name: str
    function: str               # "melody" / "bass" / "harmony_fill" / "inner_voice"
    source_part_label: str      # e.g. "Violin I" / "Cello" / "Piano LH"
    preserved: list[str] = field(default_factory=list)
    changed: list[str] = field(default_factory=list)
    cost: list[str] = field(default_factory=list)


@dataclass
class GlobalExplanation:
    """整體改編的單句 summary + 重要 sub-summary."""
    headline: str               # e.g. "鋼琴改編成弦樂四重奏, 共 4 部 + 修復 8 輪收斂"
    repair_summary: Optional[str] = None
    voice_leading_summary: Optional[str] = None
    quality_summary: Optional[str] = None


@dataclass
class ArrangementExplanation:
    """完整改編評語."""
    global_: GlobalExplanation
    parts: list[PartExplanation] = field(default_factory=list)


# ============================================================================
# 主流程
# ============================================================================

_FUNCTION_NAMES_ZH = {
    "melody": "主旋律",
    "bass": "低音線",
    "countermelody": "副旋律",
    "harmony_fill": "和聲填充",
    "pedal": "持續音",
    "ornamental": "裝飾",
    "unassigned": "未分類",
}


def generate_explanation(
    arrangement: Arrangement,
    quality_dict: Optional[dict] = None,
    difficulty_dict: Optional[dict] = None,
    repair_dict: Optional[dict] = None,
    vl_dp_dict: Optional[dict] = None,
) -> ArrangementExplanation:
    """生成「老師評語」.

    Args:
        arrangement: arrangement 物件 (含 players / assignments / target_score)
        quality_dict: quality_to_dict() 結果 (melody_preservation 等)
        difficulty_dict: 整體 difficulty (含 parts list, 每 part 有 factors)
        repair_dict: _build_repair_info 結果 (iterations / converged / quality_before/after)
        vl_dp_dict: voice_leading_dp result {optimized_count, cost_before, cost_after}

    Returns:
        ArrangementExplanation (含 global summary + 每聲部評語)
    """
    global_ = _build_global(
        arrangement, quality_dict, repair_dict, vl_dp_dict,
    )
    parts = _build_parts(arrangement, quality_dict, difficulty_dict)
    return ArrangementExplanation(global_=global_, parts=parts)


def _build_global(
    arrangement: Arrangement,
    quality_dict: Optional[dict],
    repair_dict: Optional[dict],
    vl_dp_dict: Optional[dict],
) -> GlobalExplanation:
    n_players = len(arrangement.players)
    headline = (
        f"改編為 {n_players} 部編制 "
        f"({', '.join(p.display_name for p in arrangement.players[:4])}"
        f"{', ...' if n_players > 4 else ''})"
    )
    repair_summary: Optional[str] = None
    if repair_dict:
        iters = repair_dict.get("iterations", 0)
        converged = repair_dict.get("converged", False)
        sev_before = repair_dict.get("severity_before", 0)
        sev_after = repair_dict.get("severity_after", 0)
        if iters > 0:
            status = "已收斂" if converged else "未完全收斂"
            repair_summary = (
                f"修復 {iters} 輪 ({status}); "
                f"嚴重度 {sev_before:.1f} → {sev_after:.1f}"
            )
    vl_summary: Optional[str] = None
    if vl_dp_dict:
        opt = vl_dp_dict.get("optimized_count", 0)
        cb = vl_dp_dict.get("cost_before", 0.0)
        ca = vl_dp_dict.get("cost_after", 0.0)
        if opt > 0:
            vl_summary = (
                f"Voice-leading DP 優化 {opt} 個內聲部位置, "
                f"cost {cb:.0f} → {ca:.0f}"
            )
    quality_summary: Optional[str] = None
    if quality_dict:
        mp = quality_dict.get("melody_preservation")
        hc = quality_dict.get("harmony_completeness")
        pl = quality_dict.get("playability")
        if mp is not None and hc is not None and pl is not None:
            quality_summary = (
                f"音樂品質: 旋律保留 {mp:.0%}, 和聲完整 {hc:.0%}, "
                f"可演奏 {pl:.0%}"
            )
    return GlobalExplanation(
        headline=headline,
        repair_summary=repair_summary,
        voice_leading_summary=vl_summary,
        quality_summary=quality_summary,
    )


def _build_parts(
    arrangement: Arrangement,
    quality_dict: Optional[dict],
    difficulty_dict: Optional[dict],
) -> list[PartExplanation]:
    parts_explanation: list[PartExplanation] = []
    if arrangement.target_score is None:
        return parts_explanation

    # 建 player → display name 的 map
    player_name: dict[str, str] = {
        p.player_id: p.display_name for p in arrangement.players
    }

    # 建 part_id → difficulty per-part 的 map (給每聲部評語抓 factors)
    diff_per_part: dict[str, dict] = {}
    if difficulty_dict and isinstance(difficulty_dict.get("parts"), list):
        for pd in difficulty_dict["parts"]:
            pid = pd.get("part_id")
            if pid:
                diff_per_part[pid] = pd

    for assignment in arrangement.assignments:
        target_player = assignment.target_player_id
        target_label = player_name.get(target_player, target_player)
        if assignment.target_staff and assignment.target_staff != "main":
            target_label = f"{target_label} ({assignment.target_staff})"
        source_label = _source_part_label(arrangement, assignment.source_part_id)
        func_str = _func_str(assignment.function)

        preserved: list[str] = []
        changed: list[str] = []
        cost: list[str] = []

        # === preserved ===
        if assignment.function == VoiceFunction.MELODY:
            preserved.append(f"主旋律保留在 {target_label}")
            if assignment.is_phrase_locked:
                preserved.append("樂句邊界已鎖定, 不換手")
        elif assignment.function == VoiceFunction.BASS:
            preserved.append(f"低音線完整保留在 {target_label}")
        elif assignment.function in (VoiceFunction.HARMONY_FILL,
                                     VoiceFunction.COUNTERMELODY):
            preserved.append(f"{func_str}指派到 {target_label}")

        # === changed ===
        # 找對應 target part 來判斷音高 / 譜號 / 移植
        target_part = _find_target_part(
            arrangement, target_player, assignment.target_staff,
        )
        source_part = _find_source_part(arrangement, assignment.source_part_id)
        if source_part is not None and target_part is not None:
            if source_part.instrument_id != target_part.instrument_id:
                changed.append(
                    f"{source_part.instrument_id} → {target_part.instrument_id} "
                    f"({source_label} → {target_label})"
                )

        # === cost (用 difficulty per-part factors 抓「為什麼難」) ===
        part_id = _target_part_id(target_player, assignment.target_staff)
        diff_info = diff_per_part.get(part_id)
        if diff_info:
            factors = diff_info.get("factors", {})
            dominant = _dominant_factors(factors)
            if dominant:
                cost.append(
                    f"難度主導因子: {', '.join(dominant)} "
                    f"(整體 {diff_info.get('score', 0):.1f}/5)"
                )

        parts_explanation.append(PartExplanation(
            part_id=part_id,
            display_name=target_label,
            function=assignment.function.value,
            source_part_label=source_label,
            preserved=preserved,
            changed=changed,
            cost=cost,
        ))

    return parts_explanation


# ============================================================================
# Helpers
# ============================================================================

_FACTOR_NAMES_ZH = {
    "range": "音域",
    "density": "密度",
    "chord": "和弦",
    "rhythm": "節奏",
    "technique": "技巧",
}


def _dominant_factors(factors: dict) -> list[str]:
    """挑出顯著 (>0.5) 的難度因子, 由高到低排序."""
    items = [
        (_FACTOR_NAMES_ZH.get(k, k), v)
        for k, v in factors.items()
        if isinstance(v, (int, float)) and v > 0.5
    ]
    items.sort(key=lambda x: -x[1])
    return [name for name, _ in items[:3]]


def _func_str(func: VoiceFunction) -> str:
    return _FUNCTION_NAMES_ZH.get(func.value, func.value)


def _source_part_label(arrangement: Arrangement, source_part_id: str) -> str:
    if arrangement.source_score is None:
        return source_part_id
    for p in arrangement.source_score.parts:
        if p.part_id == source_part_id:
            return p.name_display or p.part_id
    return source_part_id


def _find_source_part(arrangement: Arrangement, source_part_id: str):
    if arrangement.source_score is None:
        return None
    for p in arrangement.source_score.parts:
        if p.part_id == source_part_id:
            return p
    return None


def _find_target_part(arrangement: Arrangement, player_id: str, staff: str):
    if arrangement.target_score is None:
        return None
    part_id = _target_part_id(player_id, staff)
    for p in arrangement.target_score.parts:
        if p.part_id == part_id:
            return p
    # fallback: 找前綴匹配
    for p in arrangement.target_score.parts:
        if p.part_id.startswith(player_id):
            return p
    return None


def _target_part_id(player_id: str, staff: str) -> str:
    """player_id 'piano_1' + staff 'upper' → 'piano_1_upper'."""
    if staff and staff != "main":
        return f"{player_id}_{staff}"
    return player_id


# ============================================================================
# Serialization
# ============================================================================

def explanation_to_dict(exp: ArrangementExplanation) -> dict:
    return {
        "global": {
            "headline": exp.global_.headline,
            "repair": exp.global_.repair_summary,
            "voice_leading": exp.global_.voice_leading_summary,
            "quality": exp.global_.quality_summary,
        },
        "parts": [
            {
                "part_id": p.part_id,
                "display_name": p.display_name,
                "function": p.function,
                "source_part_label": p.source_part_label,
                "preserved": p.preserved,
                "changed": p.changed,
                "cost": p.cost,
            }
            for p in exp.parts
        ],
    }

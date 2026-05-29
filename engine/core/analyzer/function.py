"""
聲部功能標記 (Voice Function Tagging)

對應規格: docs/architecture.md §4.2.3 (Voice Function Labeling)

判斷邏輯優先序:
1. 最高聲部 + 旋律特徵 → MELODY
2. 最低聲部 + 根音/五音為主 → BASS
3. 與旋律形成對位運動 → COUNTERMELODY
4. 長音持續 → PEDAL
5. 和弦內音填充 → HARMONY_FILL
6. 快速音群裝飾 → ORNAMENTAL
"""

from __future__ import annotations

from dataclasses import dataclass

from core.ir import Score, Section, VoiceFunction

from .melody import (
    PartStats,
    bass_score,
    compute_baseline,
    compute_part_stats,
    compute_skyline,
    melody_score,
    skyline_match_ratio,
)


def _baseline_match_ratio(baseline):
    """各 part 在 baseline 中出現的比例。"""
    if not baseline:
        return {}
    counts: dict[str, int] = {}
    for _, _, part_id, _ in baseline:
        counts[part_id] = counts.get(part_id, 0) + 1
    total = len(baseline)
    return {pid: cnt / total for pid, cnt in counts.items()}


# ============================================================================
# 功能標記主流程
# ============================================================================

@dataclass
class FunctionTagReport:
    """為單一 section 的功能標記結果,含分數明細供除錯/UI 顯示。"""
    section_id: int
    tags: dict[str, VoiceFunction]            # part_id → function
    melody_scores: dict[str, float]
    bass_scores: dict[str, float]
    skyline_match: dict[str, float]
    baseline_match: dict[str, float]
    stats: dict[str, PartStats]


def tag_section_functions(
    score: Score,
    section: Section,
) -> FunctionTagReport:
    """為一個 section 中的每個 part 指派 VoiceFunction。"""
    # 1. 統計
    stats: dict[str, PartStats] = {
        p.part_id: compute_part_stats(p, section)
        for p in score.parts
    }

    # 2. Skyline & Baseline
    skyline = compute_skyline(score, section)
    baseline = compute_baseline(score, section)
    skyline_match = skyline_match_ratio(skyline)
    baseline_match = _baseline_match_ratio(baseline)

    # 3. 分數
    active_stats = {
        pid: s for pid, s in stats.items() if s.has_notes()
    }
    if not active_stats:
        return FunctionTagReport(
            section_id=section.section_id,
            tags={p.part_id: VoiceFunction.UNASSIGNED for p in score.parts},
            melody_scores={},
            bass_scores={},
            skyline_match={},
            baseline_match={},
            stats=stats,
        )

    max_count = max(s.note_count for s in active_stats.values())
    max_variety = max(s.rhythm_variety for s in active_stats.values())

    m_scores: dict[str, float] = {
        pid: melody_score(
            s,
            skyline_match.get(pid, 0.0),
            max_count,
            max_variety,
        )
        for pid, s in active_stats.items()
    }
    b_scores: dict[str, float] = {
        pid: bass_score(s, baseline_match.get(pid, 0.0))
        for pid, s in active_stats.items()
    }

    # 4. 分配
    tags: dict[str, VoiceFunction] = {}

    # MELODY: 最高 melody_score
    melody_part = max(m_scores.items(), key=lambda kv: kv[1])[0]
    tags[melody_part] = VoiceFunction.MELODY

    # BASS: 在剩餘 part 中 bass_score 最高 (排除已選 melody)
    remaining = {pid: s for pid, s in b_scores.items() if pid != melody_part}
    if remaining:
        bass_part = max(remaining.items(), key=lambda kv: kv[1])[0]
        tags[bass_part] = VoiceFunction.BASS
    else:
        bass_part = None

    # 中間聲部
    for pid, s in active_stats.items():
        if pid in tags:
            continue
        # COUNTERMELODY 條件: stepwise > 0.55 且 rhythm_variety >= 3
        # 否則 HARMONY_FILL
        # 若幾乎全是長音 (avg_duration > 2 且 rhythm_variety <= 2) → PEDAL
        # 若 chord_ratio > 0.5 → HARMONY_FILL (鋼琴常見)
        if s.chord_ratio > 0.5:
            tags[pid] = VoiceFunction.HARMONY_FILL
        elif s.avg_duration > 2.0 and s.rhythm_variety <= 2:
            tags[pid] = VoiceFunction.PEDAL
        elif s.stepwise_ratio > 0.55 and s.rhythm_variety >= 3:
            tags[pid] = VoiceFunction.COUNTERMELODY
        else:
            tags[pid] = VoiceFunction.HARMONY_FILL

    # 無音符的 part
    for p in score.parts:
        if p.part_id not in tags:
            tags[p.part_id] = VoiceFunction.UNASSIGNED

    return FunctionTagReport(
        section_id=section.section_id,
        tags=tags,
        melody_scores=m_scores,
        bass_scores=b_scores,
        skyline_match=skyline_match,
        baseline_match=baseline_match,
        stats=stats,
    )


def tag_all_sections(score: Score) -> dict[int, FunctionTagReport]:
    """對所有 movement.sections 跑功能標記,並寫回 Part.function_tags。"""
    reports: dict[int, FunctionTagReport] = {}

    # 收集所有 section
    all_sections: list[Section] = []
    for movement in score.movements:
        all_sections.extend(movement.sections)

    # 若無 section 定義, 建立 fallback 整曲 section
    if not all_sections:
        measure_count = max(
            (len(p.measures) for p in score.parts), default=0
        )
        if measure_count > 0:
            all_sections.append(Section(
                section_id=0,
                start_measure=1,
                end_measure=measure_count,
            ))

    for section in all_sections:
        report = tag_section_functions(score, section)
        reports[section.section_id] = report
        # 寫回 IR
        for part in score.parts:
            part.function_tags[section.section_id] = report.tags.get(
                part.part_id, VoiceFunction.UNASSIGNED
            )

    return reports

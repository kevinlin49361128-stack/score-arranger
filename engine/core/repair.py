"""
Directed Repair Loop — 定向修復迴圈

對應規格: docs/architecture.md §4.5 (Playability Validator + 修復迴圈)
       + i18n-spec.md (錯誤代碼結構)

Phase 1 範圍 (本檔案):
- 策略 1: 音高微調 (移八度) — 單一音符
- 策略 2: 省略次要音 — 單一和弦
- 策略 3: (留 stub, Phase 2 實作 — 需 voice 重分配機制)

收斂指標: 加權嚴重度 ERROR=10, WARNING=3, INFO=1。每次迭代需嚴格遞減
(差距 ≥ epsilon),否則回滾並嘗試下一策略。
"""

from __future__ import annotations

import copy
from typing import Optional

from .arrangement_model import Arrangement
from .ir import ChordEvent, NoteEvent, Score
from .quality import QualityReport, compute_quality
# 模型 + 純 issue 代數已抽到 repair_types (切斷模型↔策略耦合); re-export 維持
# `from core.repair import LocatedIssue, severity_score, issue_key, ...` 相容。
from .repair_types import (  # noqa: F401
    SEVERITY_WEIGHTS,
    LocatedIssue,
    ManualKey,
    RepairIteration,
    RepairReport,
    _severity_rank,
    actionable_issues,
    issue_key,
    mark_manual_by_keys,
    severity_score,
)
# 偵測層 (collect_issues + 檢查器) 已抽到 repair_issues; re-export 維持相容。
from .repair_issues import collect_issues  # noqa: F401
# 低階 score ops (leaf 層) 已抽到 repair_ops; re-export 維持
# `from core.repair import _shift_pitch_octave, ...` 相容。
from .repair_ops import (  # noqa: F401
    _get_event,
    _get_part,
    _replace_event,
    _shift_pitch_octave,
)
# 修復策略 + 註冊表已抽到 repair_strategies; 迴圈經 PHASE_1_STRATEGIES /
# _chord_severity / _reduce_chord_to_playable 取用, 其餘 strategy_* 與
# _harmonic_omit_choice 為 re-export (server / simplify / tests 仍從 core.repair 取)。
from .repair_strategies import (  # noqa: F401
    PHASE_1_STRATEGIES,
    RepairStrategy,
    _SPLIT_TRIGGER_CODES,
    _chord_severity,
    _harmonic_omit_choice,
    _reduce_chord_to_playable,
    strategy_hand_redistribute,
    strategy_octave_shift,
    strategy_omit_note,
    strategy_reassign_note,
    strategy_split_chord_to_parts,
    strategy_split_to_other_hand,
)


# ============================================================================
# 修復迴圈常數
# ============================================================================

DEFAULT_EPSILON = 0.5
# 每輪只處理一個 issue, 故密集改編 (鋼琴譜 → 弦樂四重奏) 動輒數十個可演奏性
# 問題時, 10 輪遠遠不夠收斂。提高上限讓自動修復能真正清完;迴圈本身在
# issue 清空或全部標為 manual 時就會提早結束, 不會空轉。
DEFAULT_MAX_ITERATIONS = 50

# 0.1.60 Q3d 硬上限: 每輪成本 ≈ collect_issues × 策略數 + per-iter 序列化,
# 隨譜面事件數線性增長。密集大譜 (e.g. 弦四 92 小節 → 鋼琴, 數千事件) ×
# 50 輪會逼近 server 300s timeout。依事件數縮放迭代上限, 保證任何譜都不
# 再 timeout (寧可少修幾輪也不要卡死); 觸發時 RepairReport.capped=True.
_HARD_CAP_EVENT_THRESHOLD = 1500   # 超過此事件數開始縮放
_HARD_CAP_MIN_ITERATIONS = 12      # 縮放後的下限


def _count_events(score: Score) -> int:
    n = 0
    for part in score.parts:
        for m in part.measures:
            for v in m.voices.values():
                branches = v.divisi_branches if v.is_divisi else [v]
                for b in (branches or []):
                    n += len(b.events)
    return n


def _capped_max_iterations(score: Score, requested: int) -> int:
    """依事件數縮放迭代上限. 小譜不受影響; 大譜線性收斂到 MIN."""
    events = _count_events(score)
    if events <= _HARD_CAP_EVENT_THRESHOLD:
        return requested
    # events 越多, 允許的輪數越少 (反比), 但不低於 MIN
    scaled = max(
        _HARD_CAP_MIN_ITERATIONS,
        int(requested * _HARD_CAP_EVENT_THRESHOLD / events),
    )
    return min(requested, scaled)


# 模型 + 純 issue 代數 (LocatedIssue / RepairReport / severity_score / issue_key
# …) 已抽到 repair_types; 偵測層 (collect_issues / _check_event) 抽到 repair_issues。
# 兩者皆於檔頭 re-export, 既有 `from core.repair import ...` 維持相容。


def _exclude_locked(
    score: Score, issues: list[LocatedIssue]
) -> list[LocatedIssue]:
    """剔除指向 is_locked 事件的 issue — 使用者鎖定的音符不可被自動修復覆寫。"""
    kept: list[LocatedIssue] = []
    for i in issues:
        ev = _get_event(score, i)
        if ev is not None and getattr(ev, "is_locked", False):
            continue
        kept.append(i)
    return kept


# ============================================================================
# Repair loop 主流程
# ============================================================================

def _safe_quality(arrangement: Arrangement) -> Optional[QualityReport]:
    """計算 arrangement 當前品質; 缺 source 或失敗 → None。"""
    src = getattr(arrangement, "source_score", None)
    tgt = arrangement.target_score
    if src is None or tgt is None:
        return None
    try:
        return compute_quality(src, tgt)
    except Exception:
        return None


def _pick_best_candidate(
    arrangement: Arrangement,
    candidates: list[tuple[str, float, Score]],
) -> tuple[str, float, Score]:
    """從合格候選 (皆已通過「問題嚴格減少」) 挑最佳。

    主鍵: 問題分數越低越好 (減越多)。同分時用品質當第二鍵 —— 旋律 + 和聲
    保留度越高越好, 避免「修掉 issue 卻把旋律/和聲弄爛」。
    """
    if len(candidates) == 1:
        return candidates[0]
    best_score = min(c[1] for c in candidates)
    tied = [c for c in candidates if c[1] <= best_score + 1e-9]
    if len(tied) == 1:
        return tied[0]
    src = getattr(arrangement, "source_score", None)
    if src is None:
        return tied[0]

    def quality_key(c: tuple[str, float, Score]) -> float:
        try:
            q = compute_quality(src, c[2])
            return q.melody_preservation + q.harmony_completeness
        except Exception:
            return 0.0

    return max(tied, key=quality_key)


def _force_resolve_chord_errors(target: Score) -> int:
    """保底: 強制清掉迴圈後殘留的「和弦在該樂器上不可演奏」錯誤。

    iterative repair_loop 受硬上限 / strict-better 門檻限制, 密集鋼琴譜 → 小編制
    (e.g. Vln+Hpsd, 一個 4-音和弦同時擠兩根弦) 可能殘留數個~數十個此類錯誤。
    這些是局部、確定性的問題: 用 _reduce_chord_to_playable 一次省到可演奏即可,
    不需逐輪 + deepcopy + strict-better。在此一次掃掉, 保證交付「沒有不可演奏
    和弦」的譜, 成本僅 O(殘留錯誤數)。回傳清掉的錯誤數。

    刻意不動單音類錯誤 (音域外 → octave_shift 的範疇) 與 warning。
    """
    resolved = 0
    for issue in actionable_issues(collect_issues(target)):
        if issue.severity != "error":
            continue
        event = _get_event(target, issue)
        if not isinstance(event, ChordEvent) or len(event.pitches) < 2:
            continue
        part = _get_part(target, issue.part_id)
        instrument_id = part.instrument_id if part is not None else ""
        if _chord_severity(list(event.pitches), instrument_id) != "error":
            continue
        remaining = _reduce_chord_to_playable(event.pitches, instrument_id)
        if len(remaining) == len(event.pitches):
            continue  # 沒省任何音 → 非此函式能解, 留給既有流程 / 使用者
        sorted_pitches = sorted(remaining, key=lambda p: p.midi_number)
        if len(sorted_pitches) < 2:
            _replace_event(target, issue, NoteEvent(
                pitch=sorted_pitches[0],
                duration=event.duration,
                onset=event.onset,
                articulations=list(event.articulations),
                dynamic=event.dynamic,
                is_tied_from=event.is_tied_from,
                is_tied_to=event.is_tied_to,
                slur_group=event.slur_group,
            ))
        else:
            event.pitches = sorted_pitches
        resolved += 1
    return resolved


def repair_loop(
    arrangement: Arrangement,
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
    epsilon: float = DEFAULT_EPSILON,
    strategies: Optional[list[tuple[str, RepairStrategy]]] = None,
) -> RepairReport:
    """執行定向修復迴圈,直接 in-place 修改 arrangement.target_score。

    收斂條件: actionable 問題清空, 或加權分數 < epsilon。
    """
    if arrangement.target_score is None:
        return RepairReport(converged=True)

    if strategies is None:
        strategies = PHASE_1_STRATEGIES

    report = RepairReport()
    target = arrangement.target_score
    report.quality_before = _safe_quality(arrangement)

    # 0.1.60 Q3d: 大譜硬上限 — 依事件數縮放迭代上限, 保證不 timeout.
    # (殘留的「和弦不可演奏」錯誤在迴圈後由 _force_resolve_chord_errors 保底
    #  清掉, 故這裡維持嚴格的時間上限, 不為了清錯誤而拖慢大譜 arrange。)
    effective_max = _capped_max_iterations(target, max_iterations)
    if effective_max < max_iterations:
        report.capped = True
    max_iterations = effective_max

    # 跨輪持久的 manual issue keys (reviewer 建議):
    # collect_issues 每輪重建 LocatedIssue 物件, 所以 is_manual 在物件上不持久;
    # 改用 (part_id, measure, voice, event_index, code) 5-tuple 維護。
    manual_keys: set[ManualKey] = set()

    for iteration in range(max_iterations):
        all_issues = collect_issues(target)
        # 把標為 manual 的標記回新建的 issues
        mark_manual_by_keys(all_issues, manual_keys)
        actionable = actionable_issues(all_issues)
        # 剔除使用者鎖定的事件 — 不被自動修復動到
        actionable = _exclude_locked(target, actionable)
        if not actionable:
            report.converged = True
            break

        # 排序: 嚴重度高優先, 同嚴重度 difficulty 高優先
        actionable.sort(
            key=lambda i: (-i.weight, -i.result.difficulty_score)
        )
        target_issue = actionable[0]
        score_before = severity_score(actionable)

        # 嘗試所有策略, 收集「能讓問題嚴格減少」的合格候選。
        # 收斂保證不變: 候選必過 new_score <= score_before - epsilon。
        # 多個合格時 _pick_best_candidate 用品質分數挑最佳 (有方向修復)。
        applied: Optional[str] = None
        score_after = score_before
        candidates: list[tuple[str, float, Score]] = []
        for name, strategy in strategies:
            snapshot = copy.deepcopy(target)
            if not strategy(target, target_issue):
                continue

            # 重新驗證 (同樣套用 manual 標記)
            new_issues = collect_issues(target)
            mark_manual_by_keys(new_issues, manual_keys)
            new_score = severity_score(actionable_issues(new_issues))
            if new_score <= score_before - epsilon:
                candidates.append((name, new_score, copy.deepcopy(target)))
            # 一律還原, 公平試下一個策略
            _restore_score(arrangement, snapshot)
            target = arrangement.target_score
            assert target is not None

        if candidates:
            # 和弦拆分類錯誤 (跨非相鄰弦 / 音數超載 / 音低於最低弦): 優先採用
            # split_to_parts —— 把吃不下的音搬到鄰近聲部 (violin II / viola /
            # cello), 保留所有音符。即使 omit_note 的 issue 分數略低 (丟一個音
            # 自然少一個和弦警告), 對音樂人而言「少一個音」遠比「分給別的聲部
            # 演奏」更難接受。split 候選已通過 epsilon 門檻, 故收斂保證不變。
            preferred = candidates
            if target_issue.result.code in _SPLIT_TRIGGER_CODES:
                split_only = [
                    c for c in candidates if c[0] == "split_to_parts"
                ]
                if split_only:
                    preferred = split_only
            applied, score_after, repaired = _pick_best_candidate(
                arrangement, preferred,
            )
            _restore_score(arrangement, repaired)
            target = arrangement.target_score
            assert target is not None

        # 此步結束後的 MusicXML 快照 (給時間軸 scrubber 檢視)
        iter_xml: Optional[str] = None
        try:
            from .musicxml_writer import write_musicxml_string
            iter_xml = write_musicxml_string(target)
        except Exception:
            iter_xml = None

        report.iterations.append(RepairIteration(
            iteration=iteration,
            issue_code=target_issue.result.code,
            issue_location=(
                f"{target_issue.part_id}/m.{target_issue.measure_number}"
                f"/v{target_issue.voice_id}#{target_issue.event_index}"
            ),
            applied_strategy=applied,
            score_before=score_before,
            score_after=score_after,
            target_musicxml=iter_xml,
        ))

        if applied is None:
            # 所有策略都失敗 — 永久標記 (跨輪持久)
            manual_keys.add(issue_key(target_issue))
            target_issue.is_manual = True

    # 0.1.67 最終保底: iterative loop 受硬上限 / strict-better 門檻限制, 密集
    # 鋼琴譜 → 小編制 (e.g. Vln+Hpsd) 可能殘留數個~數十個「和弦在該樂器上不
    # 可演奏」錯誤。這些是局部、確定性的 omit-to-playable 即可解 (不需逐輪 +
    # deepcopy + strict-better), 在此一次掃掉 —— 保證交付的譜「沒有不可演奏的
    # 和弦」(Kevin: 全部錯誤都要歸零), 且成本 O(殘留錯誤數), 不拖慢大譜。
    _force_resolve_chord_errors(target)

    # 最終狀態
    final_issues = collect_issues(target)
    mark_manual_by_keys(final_issues, manual_keys)
    report.final_issue_count = len(actionable_issues(final_issues))
    report.final_severity_score = severity_score(
        actionable_issues(final_issues)
    )
    report.manual_issues = [
        i for i in final_issues if i.is_manual
    ]
    report.quality_after = _safe_quality(arrangement)
    return report


def _restore_score(arrangement: Arrangement, snapshot: Score) -> None:
    arrangement.target_score = snapshot


# 註: 原 _find_and_mark_manual 改由 repair_loop 內的 manual_keys 集合處理,
# 因為 LocatedIssue 物件每輪由 collect_issues 重建, 直接 mutate 物件無法持久。

"""repair_types — 修復迴圈的資料模型 + 純 issue 代數 (無 score 變動)。

從 repair.py (原 1660 行巨檔) 抽出, 切斷「模型 / issue 函式」與「策略 / 迴圈」
的耦合。這裡只依賴 instruments(CheckResult) 與 quality(QualityReport), 不碰
score 變動, 故無循環依賴。repair.py 會 re-export 這些名稱, 既有
`from core.repair import LocatedIssue, severity_score, ...` 維持相容。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .instruments import CheckResult
from .quality import QualityReport


# 加權嚴重度: ERROR=10, WARNING=3, INFO=1 (收斂指標的權重)。
SEVERITY_WEIGHTS: dict[str, float] = {
    "error": 10.0,
    "warning": 3.0,
    "info": 1.0,
}


@dataclass
class LocatedIssue:
    """帶有 target_score 內位置資訊的可演奏性問題。"""
    part_id: str
    measure_number: int
    voice_id: int
    event_index: int
    result: CheckResult
    is_manual: bool = False                # 系統無法處理,需人工介入

    @property
    def severity(self) -> str:
        return self.result.severity

    @property
    def weight(self) -> float:
        return SEVERITY_WEIGHTS.get(self.severity, 0.0)


@dataclass
class RepairIteration:
    iteration: int
    issue_code: str
    issue_location: str
    applied_strategy: Optional[str]
    score_before: float
    score_after: float
    # 此 iteration 結束後的 target_score MusicXML 快照 (給時間軸 scrubber)
    target_musicxml: Optional[str] = None


@dataclass
class RepairReport:
    iterations: list[RepairIteration] = field(default_factory=list)
    final_issue_count: int = 0
    final_severity_score: float = 0.0
    converged: bool = False
    manual_issues: list[LocatedIssue] = field(default_factory=list)
    # 修復前/後的改編品質 (melody/harmony/playability) — 讓使用者看到
    # 修復除了減少 issue 數, 對音樂品質的實際影響。
    quality_before: Optional[QualityReport] = None
    quality_after: Optional[QualityReport] = None
    # 0.1.60 Q3d: 大譜觸發硬上限縮放迭代數 (避免 timeout). True = 此次修復
    # 未必修完所有 issue, 是為了不卡死主動降級.
    capped: bool = False


def _severity_rank(s: str) -> int:
    return {"info": 1, "warning": 2, "error": 3}.get(s, 0)


def severity_score(issues: list[LocatedIssue]) -> float:
    return sum(i.weight for i in issues if not i.is_manual)


# Manual issue 的穩定識別: (part_id, measure, voice_id, event_index, code)
ManualKey = tuple[str, int, int, int, str]


def issue_key(issue: LocatedIssue) -> ManualKey:
    """為 issue 產生跨輪可比對的穩定 key。"""
    return (
        issue.part_id,
        issue.measure_number,
        issue.voice_id,
        issue.event_index,
        issue.result.code,
    )


def mark_manual_by_keys(
    issues: list[LocatedIssue],
    manual_keys: set[ManualKey],
) -> None:
    """依 manual_keys 把對應的 issues 標 is_manual=True (in-place)。"""
    for issue in issues:
        if issue_key(issue) in manual_keys:
            issue.is_manual = True


def actionable_issues(issues: list[LocatedIssue]) -> list[LocatedIssue]:
    """剔除 INFO 與已標記為 manual 的問題。"""
    return [
        i for i in issues
        if i.severity != "info" and not i.is_manual
    ]

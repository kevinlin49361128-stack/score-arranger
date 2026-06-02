"""B4: 可演奏性稽核 (opt-in) — 對改編譜的弦樂聲部跑跨事件把位序列模擬,
surface「換把太快 / 把位跳躍困難」的警告。

為何做成 opt-in 而非自動跑進 repair:
  StringPositionSimulator 會發出 ERROR 級的 E_VIOLIN_POSITION_JUMP_TOO_FAST,
  若灌進 repair 的 collect_issues, 因 actionable_issues 含 warning/error,
  repair 會反覆嘗試修這些「需多步才能解」的把位問題 → churn
  (見 memory feedback_score_arranger_repair_cleanup)。
  故改成使用者主動觸發的「唯讀稽核」: 結果只顯示在問題面板給人看,
  不驅動 repair、不改譜。
"""
from __future__ import annotations

from core.instruments.registry import get_profile
from core.ir import Score
from core.validator_dynamic import DynamicIssue, StringPositionSimulator


def audit_string_positions(
    score: Score, tempo_bpm: float = 120.0,
) -> list[DynamicIssue]:
    """對 score 內所有「有開放弦定義」的弦樂聲部跑把位序列模擬。

    回傳 DynamicIssue list (欄位結構與 LocatedIssue 相容 → 可共用前端序列化
    與問題面板顯示)。非弦樂聲部 (鋼琴 / 管樂 / 未知樂器) 直接略過。
    """
    issues: list[DynamicIssue] = []
    for part in score.parts:
        profile = get_profile(part.instrument_id)
        if profile is None or getattr(profile, "strings", None) is None:
            continue
        sim = StringPositionSimulator(profile=profile)
        issues.extend(sim.simulate_part(part, tempo_bpm=tempo_bpm))
    return issues

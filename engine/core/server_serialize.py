"""Phase C: 從 server.py 抽出的純序列化層。

這些都是「拿 domain 物件 → 吐前端用 dict」的純函式 — 無 module-level
state、無副作用, 故可安全外移 (依賴圖的葉節點)。server.py import 回去,
呼叫端不變。其餘相依 (quality/difficulty/repair) 在函式內 lazy import,
避免載入成本 + 不擴大 import 面。
"""
from __future__ import annotations

from typing import Any, Optional

from core.ir import Score
from core.repair import LocatedIssue, collect_issues


def _serialize_tempo(score: Score) -> dict:
    """0.1.61: 把樂譜的速度 / 拍號資訊送給前端。

    節拍器從樂譜帶速度 (F1)、播放速度改用 BPM 顯示 (F4)、跟隨變速 (F2)、
    義式速度術語對照 (D4) 共用這份資料。

    - base_bpm / time_signature: 取第一小節 (未設則用 Score 預設)。
    - tempo_map / time_sig_map: 收集後續變更點 (measure → 新值), 給跟隨變速用。
    - tempo_text: 第一個義式速度標記 ("Allegro con brio")。
    """
    measures = score.parts[0].measures if score.parts else []
    base_bpm = float(score.default_tempo_bpm)
    base_ts = score.default_time_signature
    tempo_text: Optional[str] = None
    tempo_map: list[dict] = []
    time_sig_map: list[dict] = []
    seen_tempo = False
    seen_ts = False
    for m in measures:
        if m.tempo_bpm is not None:
            if not seen_tempo:
                base_bpm = float(m.tempo_bpm)
                seen_tempo = True
            tempo_map.append({"measure": m.number, "bpm": float(m.tempo_bpm)})
        if m.tempo_text and tempo_text is None:
            tempo_text = m.tempo_text
        if m.time_signature is not None:
            if not seen_ts:
                base_ts = m.time_signature
                seen_ts = True
            time_sig_map.append({
                "measure": m.number,
                "numerator": int(m.time_signature[0]),
                "denominator": int(m.time_signature[1]),
            })
    return {
        "base_bpm": base_bpm,
        "tempo_text": tempo_text,
        "time_signature": {
            "numerator": int(base_ts[0]),
            "denominator": int(base_ts[1]),
        },
        "tempo_map": tempo_map,
        "time_sig_map": time_sig_map,
    }


def _serialize_quality(arrangement) -> Optional[dict]:
    """整體改編品質 (melody/harmony/playability) — 給 A/B 版本比較用。"""
    if arrangement is None or arrangement.target_score is None \
            or getattr(arrangement, "source_score", None) is None:
        return None
    from core.quality import compute_quality, quality_to_dict
    try:
        issues = collect_issues(arrangement.target_score)
        return quality_to_dict(compute_quality(
            arrangement.source_score, arrangement.target_score, issues,
        ))
    except Exception:
        return None


def _serialize_difficulty(arrangement) -> dict:
    """為 arrangement 各 part 計算難度, 回傳 dict[part_id, payload]。"""
    if arrangement is None or arrangement.target_score is None:
        return {}
    from core.difficulty import analyze_score_difficulty, difficulty_to_dict
    try:
        per_part = analyze_score_difficulty(arrangement.target_score)
        return {pid: difficulty_to_dict(d) for pid, d in per_part.items()}
    except Exception:
        return {}


def _ordered_strategies(order):
    """依使用者偏好的策略名順序重排 PHASE_1_STRATEGIES。

    order: 前端依偏好學習推導的策略名清單 (e.g. ["omit_note", ...])。
    回傳重排後的 strategies; 無偏好 → None (repair_loop 沿用預設順序)。
    candidate-collection 的 _pick_best_candidate 在品質同分時取較前者,
    故偏好的策略會在「問題與品質皆同分」時勝出。
    """
    if not order or not isinstance(order, list):
        return None
    from core.repair import PHASE_1_STRATEGIES
    by_name = {pair[0]: pair for pair in PHASE_1_STRATEGIES}
    ranked = [by_name[n] for n in order if n in by_name]
    if not ranked:
        return None
    rest = [p for p in PHASE_1_STRATEGIES if p not in ranked]
    return ranked + rest


def _build_repair_info(report, before: float, after: float) -> dict:
    """把 RepairReport 轉成含時間軸 (per-iteration 快照) 的 dict."""
    from core.quality import quality_to_dict
    return {
        "iterations": len(report.iterations),
        "converged": report.converged,
        # 0.1.60 Q3d: 大譜觸發硬上限縮放 → UI 可提示「已自動降級, 可手動再修」
        "capped": getattr(report, "capped", False),
        "severity_before": before,
        "severity_after": after,
        # 修復前後的改編品質 (melody/harmony/playability) — 讓 UI 顯示
        # 修復對音樂品質的實際影響, 而不只是 issue 數。
        "quality_before": (
            quality_to_dict(report.quality_before)
            if report.quality_before is not None else None
        ),
        "quality_after": (
            quality_to_dict(report.quality_after)
            if report.quality_after is not None else None
        ),
        # 時間軸 — 每步的修復細節 + MusicXML 快照, 給 scrubber UI
        "timeline": [
            {
                "iteration": it.iteration,
                "issue_code": it.issue_code,
                "issue_location": it.issue_location,
                "applied_strategy": it.applied_strategy,
                "score_before": it.score_before,
                "score_after": it.score_after,
                "target_musicxml": it.target_musicxml,
            }
            for it in report.iterations
        ],
    }


def _serialize_issues(issues: list[LocatedIssue]) -> list[dict]:
    return [
        {
            "part_id": i.part_id,
            "measure": i.measure_number,
            "voice_id": i.voice_id,
            "event_index": i.event_index,
            "severity": i.result.severity,
            "code": i.result.code,
            "params": i.result.params,
            "difficulty": round(i.result.difficulty_score, 3),
            "suggestions": [
                {"code": s.code, "params": s.params}
                for s in i.result.suggestions
            ],
        }
        for i in issues
    ]

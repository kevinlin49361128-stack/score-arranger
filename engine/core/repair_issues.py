"""repair_issues — 可演奏性問題的偵測 / 收集。

從 repair.py (god file) 抽出純「讀 score → 產生 LocatedIssue」的偵測層:
collect_issues + _detect_wind_breathing + _check_event。不碰 score 變動、
不依賴策略或修復迴圈 → 無循環依賴。repair.py re-export collect_issues 維持相容。
"""
from __future__ import annotations

from typing import Optional

from .instruments import (
    CheckResult,
    check_cello_chord,
    check_guitar_chord,
    check_harp_chord,
    check_lute_chord,
    check_piano_hand_span,
    check_pitch_in_range,
    check_viola_chord,
    check_violin_chord,
    get_profile,
)
from .ir import ChordEvent, NoteEvent, RestEvent, Score
from .repair_types import LocatedIssue, _severity_rank


def collect_issues(
    score: Optional[Score],
    skill_level: Optional[str] = None,
) -> list[LocatedIssue]:
    """掃描整個 Score, 收集所有可演奏性問題。

    Args:
        score: 待檢查樂譜。None (如 arrangement 尚未建構 target_score) → 回空清單。
        skill_level: 若提供 ("amateur"/"intermediate"/"professional"), 額外跑
            銅管嘴形耐力檢查 (W_BRASS_EMBOUCHURE_FATIGUE). professional 自動
            跳過該檢查 (專業可承受 16 小節高音轟炸)。None = 跳過 (向後相容)。
    """
    if score is None:
        return []
    issues: list[LocatedIssue] = []
    for part in score.parts:
        profile = get_profile(part.instrument_id)
        if profile is None:
            continue
        for measure in part.measures:
            for voice_id, voice in measure.voices.items():
                if voice.is_divisi:
                    continue
                for idx, event in enumerate(voice.events):
                    result = _check_event(event, part.instrument_id)
                    if result is not None and not result.is_ok:
                        # 附上事件音高 (給弦樂指板模擬器 / UI 用)
                        if isinstance(event, ChordEvent):
                            result.params.setdefault(
                                "event_midis",
                                [p.midi_number for p in event.pitches],
                            )
                        elif isinstance(event, NoteEvent):
                            result.params.setdefault(
                                "event_midis", [event.pitch.midi_number],
                            )
                        issues.append(LocatedIssue(
                            part_id=part.part_id,
                            measure_number=measure.number,
                            voice_id=voice_id,
                            event_index=idx,
                            result=result,
                        ))
    # 跨聲部 voice-leading 檢查 (平行五度 / 八度 + 隱伏五/八度)
    try:
        from .voice_leading import (
            detect_hidden_parallels,
            detect_parallel_motion,
        )
        issues.extend(detect_parallel_motion(score))
        issues.extend(detect_hidden_parallels(score))
    except Exception:
        pass
    # 0.1.31 樂理深化 #5: 導音 / V7 chord 7th 未解決偵測
    # 依賴 A1b 的 RomanNumeral 分析; 空 region (無法 KK 偵測調) 自動跳過
    try:
        from .analyzer.harmony_function import detect_unresolved_tendency_tones
        issues.extend(detect_unresolved_tendency_tones(score))
    except Exception:
        pass
    # 管樂連續吹奏 (換氣) 檢查 — sustain_type=breath 且超過 max_sustained_beats
    # 連續無 rest / breath_mark, 提示需要換氣
    issues.extend(_detect_wind_breathing(score))
    # 銅管嘴形耐力預算 — 16 小節滾動視窗看高音域累積占比
    # 僅當 caller 明確帶入 skill_level 才跑 (向後相容: 舊測試不會多出 issue)
    if skill_level is not None:
        try:
            from .brass_endurance import analyze_brass_endurance
            issues.extend(analyze_brass_endurance(score, skill_level=skill_level))
        except Exception:
            pass
    return issues


def _detect_wind_breathing(score: Score) -> list[LocatedIssue]:
    """偵測管樂 (含人聲) 連續吹奏超過肺活量極限的段落.

    策略:
    - 只查 profile.breath_required == True 的 part
    - 累積無 RestEvent 且無 breath articulation / breath_mark_after 的 NoteEvent /
      ChordEvent duration, 超過 profile.max_sustained_beats 給 warning
    - 觸發後重置累積, 從下一段開始重算
    - issue 落在「超載點的第一個音符」上 (UI 上能跳到具體位置)
    """
    out: list[LocatedIssue] = []
    for part in score.parts:
        profile = get_profile(part.instrument_id)
        if profile is None or not profile.breath_required:
            continue
        max_beats = float(profile.max_sustained_beats or 0)
        if max_beats <= 0:
            continue
        # 線性掃過整個 part 的所有 voice; divisi 暫不處理.
        # 累積跨 measure, 但 RestEvent / breath articulation 重置.
        accumulated = 0.0
        breach_event: tuple[int, int, int] | None = None  # (measure, voice_id, idx)
        for measure in part.measures:
            for voice_id, voice in measure.voices.items():
                if voice.is_divisi:
                    continue
                for idx, ev in enumerate(voice.events):
                    # Rest → 自然呼吸點, 重置累積.
                    if isinstance(ev, RestEvent):
                        accumulated = 0.0
                        breach_event = None
                        continue
                    if not isinstance(ev, (NoteEvent, ChordEvent)):
                        continue
                    # NoteEvent / ChordEvent — 累積拍數.
                    duration = float(ev.duration)
                    accumulated += duration
                    if accumulated > max_beats and breach_event is None:
                        breach_event = (measure.number, voice_id, idx)
                    has_breath = (
                        getattr(ev, "breath_mark_after", False)
                        or "breath" in getattr(ev, "articulations", [])
                    )
                    if has_breath:
                        # 換氣後重置
                        accumulated = 0.0
                        if breach_event is not None:
                            # 報告超載點
                            m_no, v_id, ev_idx = breach_event
                            out.append(LocatedIssue(
                                part_id=part.part_id,
                                measure_number=m_no,
                                voice_id=v_id,
                                event_index=ev_idx,
                                result=CheckResult(
                                    severity="warning",
                                    code="W_WIND_NO_BREATH",
                                    params={
                                        "instrument": part.instrument_id,
                                        "max_beats": max_beats,
                                        "accumulated_beats": round(accumulated, 1),
                                    },
                                ),
                            ))
                            breach_event = None
        # part 結束時, 若仍有未報告的超載 → 報出
        if breach_event is not None:
            m_no, v_id, ev_idx = breach_event
            out.append(LocatedIssue(
                part_id=part.part_id,
                measure_number=m_no,
                voice_id=v_id,
                event_index=ev_idx,
                result=CheckResult(
                    severity="warning",
                    code="W_WIND_NO_BREATH",
                    params={
                        "instrument": part.instrument_id,
                        "max_beats": max_beats,
                        "accumulated_beats": round(accumulated, 1),
                    },
                ),
            ))
    return out


def _check_event(event, instrument_id: str) -> Optional[CheckResult]:
    """選擇合適的檢查函式。"""
    profile = get_profile(instrument_id)
    if profile is None:
        return None

    if isinstance(event, NoteEvent):
        return check_pitch_in_range(event.pitch, profile)
    if isinstance(event, ChordEvent):
        if instrument_id == "violin":
            return check_violin_chord(event.pitches)
        if instrument_id == "viola":
            return check_viola_chord(event.pitches)
        if instrument_id == "cello":
            return check_cello_chord(event.pitches)
        if instrument_id == "guitar":
            return check_guitar_chord(event.pitches)
        if instrument_id == "lute":
            return check_lute_chord(event.pitches)
        if instrument_id == "harp":
            return check_harp_chord(event.pitches)
        if instrument_id == "piano":
            # Phase 1 假設整個 chord 用單手
            return check_piano_hand_span(event.pitches, hand="right")
        # 其他樂器: 每個音檢查音域,回傳最嚴重的
        worst: Optional[CheckResult] = None
        for p in event.pitches:
            r = check_pitch_in_range(p, profile)
            if worst is None or _severity_rank(r.severity) > _severity_rank(worst.severity):
                worst = r
        return worst
    return None


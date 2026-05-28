"""
brass_endurance — 銅管嘴形耐力預算

對應規格背景:
    repair.py::_detect_wind_breathing 只看單一連續音的累積拍數, 不知道
    銅管玩家 (尤其業餘) 玩 30 秒高音 + 休 5 秒 + 再 30 秒高音 = 嘴形必崩。
    本模組以 16 小節滾動視窗計算「高音域累積時間」, 若超過該技能等級的
    預算比例則標 W_BRASS_EMBOUCHURE_FATIGUE warning。

設計:
    - 只處理 profile.family == "brass"
    - high range = pitch > profile.range_comfortable[1] (concert pitch midi)
    - 滾動視窗大小 16 小節, 步進 1 小節 (任何視窗超預算都報一次)
    - skill_level 預算 (high range 在視窗內占比上限):
        amateur:      0.50  ← 過半 high range 在 16 小節內必崩
        intermediate: 0.65
        professional: 跳過 (不適用)
    - issue 落點: 觸發視窗的第一個 high range 音符
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Optional

from .instruments import CheckResult, get_profile
from .ir import ChordEvent, NoteEvent, Part, RestEvent, Score


# 視窗大小 (小節數). 16 小節 ≈ 30-60 秒, 與業餘銅管嘴形循環 (~30-45 秒)
# 相當; 大於 1 樂句但小於整段, 能抓到累積疲勞但不會把長作品平均化掉。
WINDOW_MEASURES = 16

# skill_level → 視窗內 high-range 累積時間占視窗總時間的上限比例
_BUDGET_RATIO: dict[str, float] = {
    "amateur": 0.50,
    "intermediate": 0.65,
}


@dataclass
class _PartHit:
    """視窗內每個 high-range 事件的最小紀錄。"""
    measure_number: int
    voice_id: int
    event_index: int
    beats: Fraction


def analyze_brass_endurance(
    score: Score,
    skill_level: str = "amateur",
) -> list["LocatedIssue"]:
    """掃描整個 score 的銅管 part, 計算嘴形耐力預算違規.

    Args:
        score: 待檢查樂譜
        skill_level: "amateur" | "intermediate" | "professional".
            "professional" 跳過 (預設不報疲勞).

    Returns:
        每個觸發視窗回報一個 LocatedIssue (code=W_BRASS_EMBOUCHURE_FATIGUE)。
    """
    # late import 避開循環依賴 (repair.py 已 import 本模組)
    from .repair import LocatedIssue

    if skill_level == "professional":
        return []
    budget = _BUDGET_RATIO.get(skill_level, _BUDGET_RATIO["amateur"])

    issues: list[LocatedIssue] = []
    for part in score.parts:
        profile = get_profile(part.instrument_id)
        if profile is None or profile.family != "brass":
            continue
        high_threshold = profile.range_comfortable[1]
        issues.extend(_analyze_part(part, high_threshold, budget, skill_level))
    return issues


def _analyze_part(
    part: Part,
    high_threshold: int,
    budget_ratio: float,
    skill_level: str,
) -> list["LocatedIssue"]:
    from .repair import LocatedIssue

    # 收集 (measure_index, _PartHit list) — 每小節內 high range 事件
    # 同時記錄每小節的總拍數 (依 time_signature)
    per_measure_hits: list[list[_PartHit]] = []
    per_measure_beats: list[Fraction] = []
    measure_numbers: list[int] = []

    current_ts = (4, 4)
    for measure in part.measures:
        if measure.time_signature:
            current_ts = measure.time_signature
        num, denom = current_ts
        # 小節總拍數以四分音符為單位 (Fraction(num*4, denom)).
        measure_beats = Fraction(num * 4, denom)
        per_measure_beats.append(measure_beats)
        measure_numbers.append(measure.number)

        hits: list[_PartHit] = []
        for voice_id, voice in measure.voices.items():
            if voice.is_divisi:
                continue
            for idx, event in enumerate(voice.events):
                pitches = _event_pitches(event)
                if not pitches:
                    continue
                # 取最高音; brass 是單音樂器 (max_simultaneous_notes=1),
                # ChordEvent 罕見, 但保守用 max 處理.
                top = max(p.midi_number for p in pitches)
                if top > high_threshold:
                    hits.append(_PartHit(
                        measure_number=measure.number,
                        voice_id=voice_id,
                        event_index=idx,
                        beats=Fraction(event.duration),
                    ))
        per_measure_hits.append(hits)

    if not per_measure_hits:
        return []

    issues: list["LocatedIssue"] = []
    # 滾動視窗: 起點 [0, n - WINDOW_MEASURES] (若 part 比視窗短, 整段算一個視窗)
    n = len(per_measure_hits)
    span = min(WINDOW_MEASURES, n)
    reported_starts: set[int] = set()
    for start in range(0, max(1, n - span + 1)):
        end = start + span
        total_beats = sum(per_measure_beats[start:end], Fraction(0))
        if total_beats <= 0:
            continue
        window_hits: list[_PartHit] = []
        for i in range(start, end):
            window_hits.extend(per_measure_hits[i])
        high_beats = sum((h.beats for h in window_hits), Fraction(0))
        ratio = float(high_beats) / float(total_beats)
        if ratio <= budget_ratio:
            continue
        # 觸發: 報視窗內第一個 high-range 事件位置, 但同視窗起點不重複報.
        if not window_hits:
            continue
        first = window_hits[0]
        # 避免大量視窗重疊都報同一個音 — 以首個 hit 的 (measure, idx) 作 key.
        dedup_key = (first.measure_number, first.voice_id, first.event_index)
        if dedup_key in reported_starts:
            continue
        reported_starts.add(dedup_key)
        issues.append(LocatedIssue(
            part_id=part.part_id,
            measure_number=first.measure_number,
            voice_id=first.voice_id,
            event_index=first.event_index,
            result=CheckResult(
                severity="warning",
                code="W_BRASS_EMBOUCHURE_FATIGUE",
                params={
                    "instrument": part.instrument_id,
                    "skill_level": skill_level,
                    "window_start_measure": measure_numbers[start],
                    "window_end_measure": measure_numbers[end - 1],
                    "high_range_ratio": round(ratio, 3),
                    "budget_ratio": budget_ratio,
                    "high_threshold_midi": high_threshold,
                },
            ),
        ))
    return issues


def _event_pitches(event) -> list:
    if isinstance(event, NoteEvent):
        return [event.pitch]
    if isinstance(event, ChordEvent):
        return list(event.pitches)
    return []

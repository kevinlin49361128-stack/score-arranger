"""
breath_marks — 為管樂 (woodwind/brass) part 自動插入呼吸標記

策略:
- 只處理 profile.breath_required == True 的 instrument
- 每隔 ~effective_max_beats 拍 (跨技能 / 動態調整) 找一個自然停頓 (休止/長音/小節線) 處理
- effective_max_beats = profile.max_sustained_beats × skill_mul × dynamic_mul:
    skill: amateur 0.7 / intermediate 1.0 / professional 1.2
    dynamic: ff/fff 0.5 / f 0.7 / mp/p/pp 1.0 (預設等於 mp)
    即「大聲不能撐久; 業餘比職業氣短」

預期效果: target_musicxml 寫出時, music21 BreathMark → MusicXML <breath-mark/>
"""

from __future__ import annotations

from fractions import Fraction
from typing import Optional

from .instruments import get_profile
from .ir import (
    ChordEvent,
    NoteEvent,
    Part,
    RestEvent,
    Score,
)


# skill 等級對 max_sustained_beats 的乘數
_SKILL_MUL: dict[str, float] = {
    "amateur": 0.7,
    "intermediate": 1.0,
    "professional": 1.2,
}

# dynamic → 預算乘數. fortissimo/forte 比 mp 耗氣得多.
# key 為 lower-case dynamic marking. None / 未知 → 視為 mp (1.0).
_DYNAMIC_MUL: dict[str, float] = {
    "fff": 0.5,
    "ff": 0.5,
    "f": 0.7,
    "mf": 0.85,
    "mp": 1.0,
    "p": 1.0,
    "pp": 1.0,
    "ppp": 1.0,
    "sf": 0.7,
    "sfz": 0.7,
    "fp": 0.7,
}


def _dynamic_multiplier(dynamic: Optional[str]) -> float:
    if not dynamic:
        return 1.0
    return _DYNAMIC_MUL.get(dynamic.strip().lower(), 1.0)


def insert_breath_marks(
    score: Score,
    skill_level: str = "intermediate",
    part_skill_levels: Optional[dict[str, str]] = None,
) -> int:
    """為 score 內所有需要呼吸的 part 插入 breath 標記.

    Args:
        score: 目標樂譜 (in-place 修改)
        skill_level: 全域預設技能等級. "amateur"/"intermediate"/"professional"
        part_skill_levels: 每個 part_id → skill_level 的覆寫 (caller 從 player 推導).
            未列入的 part 用 skill_level 預設值.

    Returns:
        插入的 breath 標記總數.
    """
    count = 0
    skill_mul_default = _SKILL_MUL.get(skill_level, 1.0)
    for part in score.parts:
        profile = get_profile(part.instrument_id)
        if profile is None or not profile.breath_required:
            continue
        # 若 caller 提供 part 級 skill, 覆寫.
        part_skill = (
            (part_skill_levels or {}).get(part.part_id, skill_level)
        )
        skill_mul = _SKILL_MUL.get(part_skill, skill_mul_default)
        base_max = float(profile.max_sustained_beats or 16)
        count += _insert_breaths_for_part(part, base_max, skill_mul)
    return count


def _insert_breaths_for_part(
    part: Part,
    base_max_beats: float,
    skill_mul: float,
) -> int:
    """掃過 part, 動態調整每個音的「氣耗速度」並插入 breath.

    決策: 每個事件的「等效成本」= duration × (1 / dynamic_mul). 大聲時氣
    耗得快, 同樣 4 拍 ff 會比 mp 多消耗 2 倍預算. 累積成本到 base_max
    × skill_mul 即強制換氣.
    """
    inserted = 0
    accumulated_cost = 0.0
    last_pitched_event: Optional[NoteEvent | ChordEvent] = None
    current_dynamic: Optional[str] = None
    budget = base_max_beats * skill_mul

    for measure in part.measures:
        voices = (
            measure.voices.values()
            if isinstance(measure.voices, dict)
            else measure.voices
        )
        for voice in voices:
            branches = voice.divisi_branches if voice.is_divisi else [voice]
            for v in branches or []:
                for ev in v.events:
                    if isinstance(ev, RestEvent):
                        # 休止符 → 自然呼吸點
                        if accumulated_cost > 0 and last_pitched_event:
                            if "breath" not in last_pitched_event.articulations:
                                last_pitched_event.articulations.append("breath")
                                inserted += 1
                        accumulated_cost = 0.0
                        last_pitched_event = None
                        continue
                    if isinstance(ev, (NoteEvent, ChordEvent)):
                        # 追蹤 dynamic: 若事件帶 dynamic 標記, 更新 current.
                        if ev.dynamic:
                            current_dynamic = ev.dynamic
                        dyn_mul = _dynamic_multiplier(current_dynamic)
                        # 等效成本: duration / dyn_mul. dyn_mul 小 → 成本大.
                        cost = float(ev.duration) / max(dyn_mul, 1e-3)
                        accumulated_cost += cost
                        last_pitched_event = ev
                        if accumulated_cost >= budget:
                            if "breath" not in ev.articulations:
                                ev.articulations.append("breath")
                                inserted += 1
                            accumulated_cost = 0.0
                            last_pitched_event = None
    return inserted

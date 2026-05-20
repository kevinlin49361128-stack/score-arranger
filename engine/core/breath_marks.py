"""
breath_marks — 為管樂 (woodwind/brass) part 自動插入呼吸標記

策略:
- 只處理 profile.breath_required == True 的 instrument
- 在每個 phrase 結束的最後一個音符上加 "breath" articulation
- 若沒 phrase 資訊, 退而求其次: 每隔 ~max_sustained_beats 拍找一個自然停頓
  (休止符 / 長音 / 小節線) 處理

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


def insert_breath_marks(score: Score) -> int:
    """為 score 內所有需要呼吸的 part 插入 breath 標記.

    回傳: 共插入幾個 breath 標記。
    """
    count = 0
    for part in score.parts:
        profile = get_profile(part.instrument_id)
        if profile is None or not profile.breath_required:
            continue
        count += _insert_breaths_for_part(part, profile.max_sustained_beats or 16)
    return count


def _insert_breaths_for_part(part: Part, max_beats: float) -> int:
    """每隔 max_beats 拍找一個自然停頓 (休止 / 長音), 加 breath。"""
    inserted = 0
    accumulated = Fraction(0)
    last_pitched_event: Optional[NoteEvent | ChordEvent] = None

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
                        if accumulated > 0 and last_pitched_event:
                            # 在上一個音符加 breath (若還沒)
                            if "breath" not in last_pitched_event.articulations:
                                last_pitched_event.articulations.append("breath")
                                inserted += 1
                        accumulated = Fraction(0)
                        last_pitched_event = None
                        continue
                    if isinstance(ev, (NoteEvent, ChordEvent)):
                        accumulated += ev.duration
                        last_pitched_event = ev
                        if accumulated >= Fraction(int(max_beats)):
                            # 強制換氣
                            if "breath" not in ev.articulations:
                                ev.articulations.append("breath")
                                inserted += 1
                            accumulated = Fraction(0)
                            last_pitched_event = None
    return inserted

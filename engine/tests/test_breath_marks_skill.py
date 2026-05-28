"""breath_marks — skill_level / dynamic 感知測試"""

from __future__ import annotations

from fractions import Fraction
from typing import Optional

from core.breath_marks import insert_breath_marks
from core.ir import (
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Section,
    Voice,
)


def _note(midi: int, dur=Fraction(1), onset=Fraction(0), dynamic: Optional[str] = None) -> NoteEvent:
    return NoteEvent(
        pitch=Pitch(midi, "n"),
        duration=dur,
        onset=onset,
        dynamic=dynamic,
    )


def _wind_score(
    instrument_id: str,
    events: list,
) -> Score:
    """單管樂 part, events 全在 measure 1 voice 1.

    為了避開 IR Measure validate (events 不能跨 measure beat), 把整串
    塞到一個 measure 並讓它有足夠 beats 容納 — 用 4/4 dummy time_sig,
    但放大 part.measures 為多小節重複空 events. 簡化: 整段塞 measure 1.
    """
    return Score(
        movements=[Movement(
            movement_id=1, measure_count=1,
            sections=[Section(0, 1, 1)],
        )],
        parts=[Part(
            part_id=f"{instrument_id}_1",
            name_display=instrument_id,
            instrument_id=instrument_id,
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=events)},
            )],
        )],
    )


def _count_breaths(score: Score) -> int:
    """掃過 score 算 articulation 中 "breath" 出現次數."""
    n = 0
    for part in score.parts:
        for measure in part.measures:
            for voice in measure.voices.values():
                for ev in voice.events:
                    if hasattr(ev, "articulations") and "breath" in ev.articulations:
                        n += 1
    return n


# ============================================================================
# Skill multiplier (flute: max_sustained_beats = 16)
# ============================================================================

def test_amateur_more_breaths_than_professional():
    """amateur (0.7×16 = 11.2 拍) 應比 professional (1.2×16 = 19.2 拍) 換氣更密.

    40 個 1-拍音符 (共 40 拍). 用 mp dynamic 避開 dynamic 衰減干擾.
    amateur 預期 ~3 次 (40/11.2), professional ~2 次 (40/19.2).
    """
    # 兩份相同 score (avoid 共享狀態 in-place 修改)
    events_amateur = [_note(72, dur=Fraction(1), dynamic="mp") for _ in range(40)]
    events_pro = [_note(72, dur=Fraction(1), dynamic="mp") for _ in range(40)]
    score_amateur = _wind_score("flute", events_amateur)
    score_pro = _wind_score("flute", events_pro)
    insert_breath_marks(score_amateur, skill_level="amateur")
    insert_breath_marks(score_pro, skill_level="professional")
    amateur_breaths = _count_breaths(score_amateur)
    pro_breaths = _count_breaths(score_pro)
    assert amateur_breaths > pro_breaths, (
        f"amateur={amateur_breaths}, pro={pro_breaths}"
    )


def test_ff_dynamic_more_breaths_than_mp():
    """ff (預算 0.5×) 應比 mp 更快達到強制換氣."""
    # 20 個 1-拍音, 比較相同 score 在 ff vs mp 的 breath 數
    events_ff = [_note(72, dur=Fraction(1), dynamic="ff") for _ in range(20)]
    events_mp = [_note(72, dur=Fraction(1), dynamic="mp") for _ in range(20)]
    score_ff = _wind_score("flute", events_ff)
    score_mp = _wind_score("flute", events_mp)
    insert_breath_marks(score_ff, skill_level="intermediate")
    insert_breath_marks(score_mp, skill_level="intermediate")
    ff_breaths = _count_breaths(score_ff)
    mp_breaths = _count_breaths(score_mp)
    assert ff_breaths > mp_breaths, f"ff={ff_breaths}, mp={mp_breaths}"


def test_no_dynamic_uses_default_mp():
    """沒 dynamic 標記時走 default (mp, mul=1.0)."""
    # 30 個 1-拍音, 無 dynamic; 應在 ~16 拍處換氣 (intermediate default)
    events = [_note(72, dur=Fraction(1)) for _ in range(30)]
    score = _wind_score("flute", events)
    inserted = insert_breath_marks(score, skill_level="intermediate")
    # 30 拍 / 16 拍預算 → 至少 1 次強制換氣
    assert inserted >= 1
    assert _count_breaths(score) >= 1


def test_professional_mp_long_passage():
    """professional + mp + 18 拍: 預算 = 19.2 拍, 應不換氣 (剛好低於)."""
    # 18 個 1-拍音 = 18 拍 < 19.2 預算
    events = [_note(72, dur=Fraction(1), dynamic="mp") for _ in range(18)]
    score = _wind_score("flute", events)
    inserted = insert_breath_marks(score, skill_level="professional")
    assert inserted == 0


def test_part_skill_levels_override():
    """part_skill_levels 字典應覆寫全域 skill_level."""
    # 20 個 1-拍 ff 音
    events = [_note(72, dur=Fraction(1), dynamic="ff") for _ in range(20)]
    score = _wind_score("flute", events)
    # 全域 professional 但 part 級覆寫成 amateur → 應比純 professional 多換氣
    insert_breath_marks(
        score,
        skill_level="professional",
        part_skill_levels={"flute_1": "amateur"},
    )
    breaths_amateur = _count_breaths(score)

    # 對照組: 純 professional
    events2 = [_note(72, dur=Fraction(1), dynamic="ff") for _ in range(20)]
    score2 = _wind_score("flute", events2)
    insert_breath_marks(score2, skill_level="professional")
    breaths_pro = _count_breaths(score2)
    assert breaths_amateur > breaths_pro

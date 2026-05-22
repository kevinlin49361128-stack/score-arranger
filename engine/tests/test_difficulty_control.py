"""難度閉環控制器 (core/difficulty_control.py) 測試 — A3 + A2"""

from __future__ import annotations

from fractions import Fraction

from core.difficulty import analyze_part_difficulty
from core.difficulty_control import (
    _range_difficulty, converge_difficulty, level_difficulty,
)
from core.ir import (
    ChordEvent, Measure, NoteEvent, Part, Pitch, Score, Voice,
)


def _p(midi: int) -> Pitch:
    return Pitch(midi_number=midi, spelling=f"n{midi}")


def _easy_measure(number: int, base: int = 72) -> Measure:
    """單音、舒適音域、四分音符 — 低難度。"""
    events = [
        NoteEvent(pitch=_p(base + i), duration=Fraction(1),
                  onset=Fraction(i))
        for i in range(4)
    ]
    return Measure(number=number, time_signature=(4, 4),
                   voices={1: Voice(voice_id=1, events=events)})


def _hard_measure(number: int) -> Measure:
    """密集四音和弦 — 高難度。"""
    events = [
        ChordEvent(pitches=[_p(60), _p(64), _p(67), _p(72)],
                   duration=Fraction(1), onset=Fraction(i))
        for i in range(4)
    ]
    return Measure(number=number, time_signature=(4, 4),
                   voices={1: Voice(voice_id=1, events=events)})


def _easy_part(n: int = 4) -> Part:
    return Part(part_id="v", name_display="V", instrument_id="violin",
                measures=[_easy_measure(i) for i in range(1, n + 1)])


def _hard_part(n: int = 4) -> Part:
    return Part(part_id="v", name_display="V", instrument_id="violin",
                measures=[_hard_measure(i) for i in range(1, n + 1)])


def _source(n: int = 4) -> Score:
    """每小節一個涵蓋整小節的 C 大三和弦 — 給 enrich 當和聲來源。"""
    measures = []
    for i in range(1, n + 1):
        ch = ChordEvent(pitches=[_p(48), _p(52), _p(55)],
                        duration=Fraction(4), onset=Fraction(0))
        measures.append(Measure(
            number=i, time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=[ch])},
        ))
    return Score(metadata={}, movements=[], parts=[
        Part(part_id="s", name_display="S", instrument_id="violin",
             measures=measures),
    ])


class TestRangeDifficulty:
    def test_returns_1_to_5(self):
        d = _range_difficulty(_easy_part(2), 1, 2)
        assert 1.0 <= d <= 5.0

    def test_hard_above_easy(self):
        assert _range_difficulty(_hard_part(2), 1, 2) \
            > _range_difficulty(_easy_part(2), 1, 2)


class TestConverge:
    def test_converge_up_enriches(self):
        # 簡單的譜 + 高目標 → 應 enrich 加厚
        part = _easy_part(4)
        src = _source(4)
        before = _range_difficulty(part, 1, 4)
        result = converge_difficulty(part, src, 1, 4, 4.0)
        assert result is not None
        assert result[0] == "enrich"
        assert _range_difficulty(part, 1, 4) > before

    def test_converge_down_simplifies(self):
        # 厚和弦的譜 + 低目標 → 應 simplify 簡化
        part = _hard_part(4)
        src = _source(4)
        before = _range_difficulty(part, 1, 4)
        result = converge_difficulty(part, src, 1, 4, 1.0)
        assert result is not None
        assert result[0] == "simplify"
        assert _range_difficulty(part, 1, 4) < before

    def test_already_in_band_returns_none(self):
        part = _easy_part(2)
        src = _source(2)
        cur = _range_difficulty(part, 1, 2)
        # 目標就是現值 → 已達標 → 不動
        assert converge_difficulty(part, src, 1, 2, cur) is None


class TestLevel:
    def test_level_flattens_curve(self):
        # 前兩小節簡單、後兩小節困難 → 抹平後曲線應更平
        part = Part(
            part_id="v", name_display="V", instrument_id="violin",
            measures=[
                _easy_measure(1), _easy_measure(2),
                _hard_measure(3), _hard_measure(4),
            ],
        )
        src = _source(4)
        before = analyze_part_difficulty(part).measures
        spread_before = (max(m.score_1_to_5 for m in before)
                         - min(m.score_1_to_5 for m in before))

        leveled = level_difficulty(part, src, 1, 4, 3.0)
        assert leveled >= 1

        after = analyze_part_difficulty(part).measures
        spread_after = (max(m.score_1_to_5 for m in after)
                        - min(m.score_1_to_5 for m in after))
        assert spread_after <= spread_before

    def test_level_returns_zero_when_all_in_band(self):
        part = _easy_part(3)
        src = _source(3)
        cur = _range_difficulty(part, 1, 1)
        # 目標 = 現值 → 每小節都已達標 → 0 個被調整
        assert level_difficulty(part, src, 1, 3, cur) == 0

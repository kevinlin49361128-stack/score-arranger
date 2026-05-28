"""0.1.56 G — 大提琴 tenor clef 自動切換測試.

涵蓋 (對齊任務指定的 3-5 case):
1. Cello 整曲低音 → 整曲 BassClef, 無切換
2. Cello 整曲高音 → 切到 TenorClef
3. Cello 段落從低到高 → 中間有 BassClef → TenorClef 切換
4. Violin 任何音域 → 永遠 TrebleClef 預設 (不動)
5. 空小節保持 prev_clef (不亂切)

驗證範圍涵蓋 ir_to_music21 (回退路徑) 與 ir_to_musicxml (主路徑).
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from fractions import Fraction

from music21 import clef as m21_clef

from core.ir import Measure, NoteEvent, Part, Pitch, Score, Voice
from core.ir_to_music21 import (
    _decide_cello_clef_for_measure,
    _decide_clef_for_measure,
    ir_to_music21,
)
from core.ir_to_musicxml import score_to_musicxml


# ============================================================================
# Helpers
# ============================================================================

def _p(midi: int) -> Pitch:
    """造 sounding pitch; spelling 用簡化命名 (不影響 clef 邏輯)."""
    # 簡單 spelling: 用 C 系 + 八度數字 (測試只看 midi)
    octave = midi // 12 - 1
    return Pitch(midi_number=midi, spelling=f"C{octave}")


def _make_measure(number: int, midis: list[int]) -> Measure:
    """造一小節 (4/4), 每個 midi 一個四分音符."""
    events = [
        NoteEvent(
            pitch=_p(midi), duration=Fraction(1), onset=Fraction(i),
        )
        for i, midi in enumerate(midis)
    ]
    voice = Voice(voice_id=1, events=events)
    return Measure(
        number=number,
        voices={1: voice},
        time_signature=(4, 4) if number == 1 else None,
    )


def _make_cello_score(measure_midis: list[list[int]]) -> Score:
    measures = [
        _make_measure(i + 1, midis) for i, midis in enumerate(measure_midis)
    ]
    part = Part(
        part_id="cello_1", name_display="Violoncello",
        instrument_id="cello", measures=measures,
    )
    return Score(parts=[part])


def _make_violin_score(measure_midis: list[list[int]]) -> Score:
    measures = [
        _make_measure(i + 1, midis) for i, midis in enumerate(measure_midis)
    ]
    part = Part(
        part_id="violin_1", name_display="Violin",
        instrument_id="violin", measures=measures,
    )
    return Score(parts=[part])


def _measure_clefs_from_xml(xml_str: str) -> list[list[tuple[str, str]]]:
    """從 MusicXML 字串拉出每 measure 的 clef 列表.

    回傳 list, 每項對應一 measure, 內含該 measure 的 (sign, line) tuples.
    """
    root = ET.fromstring(xml_str)
    result: list[list[tuple[str, str]]] = []
    for measure in root.iter("measure"):
        clefs: list[tuple[str, str]] = []
        for clef_el in measure.iter("clef"):
            sign = clef_el.findtext("sign", default="")
            line = clef_el.findtext("line", default="")
            clefs.append((sign, line))
        result.append(clefs)
    return result


# ============================================================================
# 1. 單元: _decide_cello_clef_for_measure
# ============================================================================

class TestDecideCelloClef:
    def test_low_passage_stays_bass(self):
        # C2 (36) – A2 (45): 全部低音 → BassClef
        measure = _make_measure(2, [36, 40, 43, 45])
        result = _decide_cello_clef_for_measure(measure, m21_clef.BassClef())
        assert isinstance(result, m21_clef.BassClef)

    def test_high_passage_switches_to_tenor(self):
        # G4 (67) – C5 (72): avg=70, lo=67 → TenorClef
        measure = _make_measure(2, [67, 69, 71, 72])
        result = _decide_cello_clef_for_measure(measure, m21_clef.BassClef())
        assert isinstance(result, m21_clef.TenorClef)

    def test_high_avg_but_low_min_keeps_prev(self):
        # avg ≥ 60 但 min < 53 (F3) → 維持 prev (避免下加線兩面為敵)
        # [40, 72] avg=56, 低於 60 → 不滿足進 tenor 條件 → 保持
        measure = _make_measure(2, [40, 72])
        result = _decide_cello_clef_for_measure(measure, m21_clef.BassClef())
        assert isinstance(result, m21_clef.BassClef)

    def test_back_to_low_switches_back_to_bass(self):
        # 從 tenor 回到低音: avg=42 < 53 → BassClef
        measure = _make_measure(2, [36, 38, 43, 50])
        result = _decide_cello_clef_for_measure(measure, m21_clef.TenorClef())
        assert isinstance(result, m21_clef.BassClef)

    def test_mid_range_keeps_prev_clef(self):
        # avg=58 (中間區): 不夠高進 tenor, 也不夠低回 bass → 保持
        measure = _make_measure(2, [55, 57, 59, 61])
        prev = m21_clef.TenorClef()
        result = _decide_cello_clef_for_measure(measure, prev)
        assert isinstance(result, m21_clef.TenorClef)

    def test_empty_measure_keeps_prev(self):
        measure = Measure(number=2, voices={1: Voice(voice_id=1, events=[])})
        prev = m21_clef.BassClef()
        result = _decide_cello_clef_for_measure(measure, prev)
        assert result is prev


# ============================================================================
# 2. 單元: _decide_clef_for_measure (violin 不切)
# ============================================================================

class TestDecideViolinClef:
    def test_violin_returns_none_regardless_of_range(self):
        # violin 不在動態切換清單 → 一律 None
        for midis in ([60, 62, 64], [76, 78, 80], [55, 57]):
            measure = _make_measure(2, midis)
            assert _decide_clef_for_measure("violin", measure, None) is None


# ============================================================================
# 3. 端到端: ir_to_music21 (回退路徑)
# ============================================================================

class TestIrToMusic21Path:
    def test_low_cello_no_clef_change(self):
        score = _make_cello_score([
            [36, 40, 43, 45],
            [38, 41, 43, 45],
            [36, 38, 40, 43],
        ])
        m21_score = ir_to_music21(score)
        part = list(m21_score.parts)[0]
        # 第一小節有 BassClef, 後續不應再有 clef 元素
        clefs_per_measure = [
            [c for c in m.recurse().getElementsByClass(m21_clef.Clef)]
            for m in part.getElementsByClass("Measure")
        ]
        assert isinstance(clefs_per_measure[0][0], m21_clef.BassClef)
        # 第 2, 3 小節不該有 clef
        assert clefs_per_measure[1] == []
        assert clefs_per_measure[2] == []

    def test_high_cello_switches_to_tenor(self):
        # 第一小節仍走預設 BassClef (任務要求); 第 2 起切到 TenorClef
        score = _make_cello_score([
            [36, 40, 43, 45],  # bass — 預設
            [67, 69, 71, 72],  # high → TenorClef
            [68, 70, 72, 74],  # 維持 tenor
        ])
        m21_score = ir_to_music21(score)
        part = list(m21_score.parts)[0]
        measures = list(part.getElementsByClass("Measure"))
        m1_clefs = list(measures[0].recurse().getElementsByClass(m21_clef.Clef))
        m2_clefs = list(measures[1].recurse().getElementsByClass(m21_clef.Clef))
        m3_clefs = list(measures[2].recurse().getElementsByClass(m21_clef.Clef))
        assert isinstance(m1_clefs[0], m21_clef.BassClef)
        assert len(m2_clefs) == 1
        assert isinstance(m2_clefs[0], m21_clef.TenorClef)
        # 已切到 tenor 後不再重複插入
        assert m3_clefs == []

    def test_cello_low_to_high_switch_mid_score(self):
        score = _make_cello_score([
            [36, 40, 43, 45],
            [38, 41, 43, 48],
            [67, 69, 71, 72],  # 切 tenor
            [70, 72, 74, 76],
        ])
        m21_score = ir_to_music21(score)
        measures = list(list(m21_score.parts)[0].getElementsByClass("Measure"))
        clefs_per = [
            list(m.recurse().getElementsByClass(m21_clef.Clef))
            for m in measures
        ]
        assert isinstance(clefs_per[0][0], m21_clef.BassClef)
        assert clefs_per[1] == []
        assert len(clefs_per[2]) == 1
        assert isinstance(clefs_per[2][0], m21_clef.TenorClef)
        assert clefs_per[3] == []

    def test_violin_never_switches(self):
        score = _make_violin_score([
            [60, 62, 64, 65],
            [76, 78, 80, 82],
            [55, 57, 59, 60],
        ])
        m21_score = ir_to_music21(score)
        measures = list(list(m21_score.parts)[0].getElementsByClass("Measure"))
        # violin 連預設 clef 都不插 (走 music21 預設 TrebleClef)
        for m in measures[1:]:
            clefs = list(m.recurse().getElementsByClass(m21_clef.Clef))
            assert clefs == []


# ============================================================================
# 4. 端到端: ir_to_musicxml (主路徑)
# ============================================================================

class TestIrToMusicXmlPath:
    def test_low_cello_xml_only_first_measure_has_clef(self):
        score = _make_cello_score([
            [36, 40, 43, 45],
            [38, 41, 43, 45],
            [36, 38, 40, 43],
        ])
        xml = score_to_musicxml(score)
        clefs = _measure_clefs_from_xml(xml)
        # 第一小節 BassClef (F4); 後續 0 個
        assert clefs[0] == [("F", "4")]
        assert clefs[1] == []
        assert clefs[2] == []

    def test_high_cello_xml_switches_to_tenor(self):
        score = _make_cello_score([
            [36, 40, 43, 45],
            [67, 69, 71, 72],
            [70, 72, 74, 76],
        ])
        xml = score_to_musicxml(score)
        clefs = _measure_clefs_from_xml(xml)
        # 首小節 BassClef → 第 2 小節 TenorClef (C4)
        assert clefs[0] == [("F", "4")]
        assert clefs[1] == [("C", "4")]
        # 已切換, 不再重複
        assert clefs[2] == []

    def test_cello_low_to_high_mid_score_xml(self):
        score = _make_cello_score([
            [36, 40, 43, 45],
            [38, 41, 43, 48],
            [67, 69, 71, 72],
            [70, 72, 74, 76],
        ])
        xml = score_to_musicxml(score)
        clefs = _measure_clefs_from_xml(xml)
        assert clefs[0] == [("F", "4")]
        assert clefs[1] == []
        assert clefs[2] == [("C", "4")]
        assert clefs[3] == []

    def test_cello_high_then_back_to_low_xml(self):
        score = _make_cello_score([
            [36, 40, 43, 45],
            [67, 69, 71, 72],  # tenor
            [36, 38, 40, 43],  # 回 bass
        ])
        xml = score_to_musicxml(score)
        clefs = _measure_clefs_from_xml(xml)
        assert clefs[0] == [("F", "4")]
        assert clefs[1] == [("C", "4")]
        assert clefs[2] == [("F", "4")]

    def test_violin_xml_never_switches(self):
        score = _make_violin_score([
            [60, 62, 64, 65],
            [76, 78, 80, 82],
            [55, 57, 59, 60],
        ])
        xml = score_to_musicxml(score)
        clefs = _measure_clefs_from_xml(xml)
        # 首小節高音譜
        assert clefs[0] == [("G", "2")]
        # 後續無切換
        assert clefs[1] == []
        assert clefs[2] == []

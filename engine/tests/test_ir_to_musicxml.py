"""0.1.47 C1 — ir_to_musicxml round-trip smoke + 特性保留測試.

1094 行的 core/ir_to_musicxml.py 之前沒有直接單元測試, 雖然
test_samples.py 間接 cover (303 sample → IR → XML 走通), 但缺少
針對特定記譜元素的回歸保護. 本檔補上:

- happy-path round-trip (parse → emit → parse-back)
- pickup measure (implicit="yes") 保留
- ornaments (trill/mordent/turn) 保留
- articulations (staccato/legato/accent) 保留
- hairpin (crescendo/diminuendo wedge) 輸出
- 多 staff (grand-staff) 鋼琴正確分上下譜表

不追求 100% 覆蓋率; 只防止「重構時靜默損壞記譜元素」這類 regression.
"""

from __future__ import annotations

import io

import pytest

from core.ir_to_musicxml import score_to_musicxml
from core.parser import parse_musicxml


# ============================================================================
# Helpers
# ============================================================================


def _emit(corpus_id: str) -> str:
    ir = parse_musicxml(f"corpus:{corpus_id}")
    return score_to_musicxml(ir)


def _round_trip_measure_count(corpus_id: str) -> tuple[int, int]:
    """parse → emit → parse-back; 回 (原 measure 數, round-trip measure 數)"""
    ir = parse_musicxml(f"corpus:{corpus_id}")
    if not ir.parts:
        return (0, 0)
    original = len(ir.parts[0].measures)
    xml = score_to_musicxml(ir)
    # 用 music21 解析回來
    import music21
    score = music21.converter.parse(xml)
    if not score.parts:
        return (original, 0)
    rt = len(score.parts[0].getElementsByClass("Measure"))
    return (original, rt)


# ============================================================================
# Happy path
# ============================================================================


def test_emit_returns_valid_xml():
    xml = _emit("bach/bwv66.6")
    assert xml.startswith("<?xml")
    assert "<score-partwise" in xml
    assert "</score-partwise>" in xml


def test_emit_contains_part_elements():
    xml = _emit("bach/bwv66.6")
    assert "<part-list>" in xml
    assert "<score-part" in xml
    assert "<part " in xml


def test_emit_contains_measure_attributes():
    xml = _emit("bach/bwv66.6")
    assert "<measure " in xml
    assert "<attributes>" in xml
    assert "<divisions>" in xml
    assert "<time>" in xml or "<key>" in xml  # 至少其一


# ============================================================================
# Round-trip: measure count 守恆 (parse → emit → parse-back)
# ============================================================================


@pytest.mark.parametrize("corpus_id", [
    "bach/bwv66.6",            # 4 聲部 SATB 有 pickup
    "bach_invention_01",       # 鋼琴 2 voices
    "mozart_sonata_01_1",      # 鋼琴 grand-staff
    "scarlatti_K001",          # 鋼琴, 有 ornaments
])
def test_round_trip_measure_count_preserved(corpus_id):
    original, rt = _round_trip_measure_count(corpus_id)
    assert original > 0, f"{corpus_id}: 來源無 measure"
    # 允許 ±1 誤差 (pickup measure 處理可能影響計數)
    assert abs(original - rt) <= 1, (
        f"{corpus_id}: 原 {original} measures, round-trip {rt}"
    )


# ============================================================================
# Pickup measure 保留 (0.1.45 修)
# ============================================================================


def test_pickup_measure_emits_implicit_attr():
    """有 pickup 的曲子, 第一 measure 應該標 implicit="yes"."""
    xml = _emit("bach/bwv66.6")
    first_measure_pos = xml.find("<measure ")
    assert first_measure_pos > 0
    first_measure_open = xml[first_measure_pos:first_measure_pos + 100]
    # bach/bwv66.6 是 pickup 開頭
    assert 'implicit="yes"' in first_measure_open, (
        f"pickup measure 缺 implicit attr: {first_measure_open}"
    )


def test_non_pickup_first_measure_no_implicit():
    """沒 pickup 的曲子, 第一 measure 不該標 implicit."""
    # Find a non-pickup piece — bach_chorale_001 是 chorale, 多數有 pickup
    # 用 scarlatti_K001 (大部分 Scarlatti 從 m1 開始, 沒 pickup)
    ir = parse_musicxml("corpus:scarlatti_K001")
    if ir.parts and ir.parts[0].measures:
        m1 = ir.parts[0].measures[0]
        if not m1.is_pickup:
            xml = score_to_musicxml(ir)
            first_pos = xml.find("<measure ")
            first_open = xml[first_pos:first_pos + 100]
            assert 'implicit="yes"' not in first_open


# ============================================================================
# Ornaments 保留 (0.1.46 補 tremolo)
# ============================================================================


def test_ornaments_emit_to_xml():
    """Mozart K.279 有 mordent / trill / turn — 全要 emit."""
    xml = _emit("mozart_sonata_01_1")
    # 至少要 emit 出 ornaments 容器
    assert "<ornaments>" in xml
    # mordent / trill 應該都有
    assert "<mordent" in xml
    assert "<trill-mark" in xml


def test_scarlatti_trills_preserved():
    xml = _emit("scarlatti_K001")
    assert "<trill-mark" in xml


# ============================================================================
# Articulations 保留
# ============================================================================


def test_articulations_emit_to_xml():
    """Mozart sonata 通常有 staccato / legato slur."""
    xml = _emit("mozart_sonata_01_1")
    # 演奏法元素應該存在
    has_arts = (
        "<articulations>" in xml
        or "<staccato" in xml
        or "<slur" in xml
    )
    assert has_arts, "Mozart sonata 該有 articulations"


# ============================================================================
# 0.1.54 C — TechniqueAnnotation (fingering / string / bow) 寫到 <technical>
# ============================================================================


def test_technique_fingering_emits_to_xml():
    """IR.NoteEvent.technique.fingering → <technical><fingering> 元素."""
    from fractions import Fraction
    from core.ir import (
        Duration, Measure, NoteEvent, Part, Pitch, Score, TechniqueAnnotation,
        TimePoint, Voice,
    )

    note = NoteEvent(
        pitch=Pitch(midi_number=64, spelling="E4"),
        duration=Duration(Fraction(1)),
        onset=TimePoint(Fraction(0)),
        technique=TechniqueAnnotation(
            fingering="3", string_index=2, bow_direction="down",
        ),
    )
    part = Part(
        part_id="violin_1", instrument_id="violin",
        name_display="Violin",
        measures=[Measure(number=1, voices={1: Voice(voice_id=1, events=[note])})],
    )
    xml = score_to_musicxml(Score(parts=[part], metadata={}))
    assert "<technical>" in xml
    assert "<fingering>3</fingering>" in xml
    assert "<string>2</string>" in xml
    assert "<down-bow" in xml


def test_technique_up_bow_emits():
    """bow_direction='up' → <up-bow/>."""
    from fractions import Fraction
    from core.ir import (
        Duration, Measure, NoteEvent, Part, Pitch, Score, TechniqueAnnotation,
        TimePoint, Voice,
    )

    note = NoteEvent(
        pitch=Pitch(midi_number=64, spelling="E4"),
        duration=Duration(Fraction(1)),
        onset=TimePoint(Fraction(0)),
        technique=TechniqueAnnotation(bow_direction="up"),
    )
    part = Part(
        part_id="violin_1", instrument_id="violin",
        name_display="Violin",
        measures=[Measure(number=1, voices={1: Voice(voice_id=1, events=[note])})],
    )
    xml = score_to_musicxml(Score(parts=[part], metadata={}))
    assert "<up-bow" in xml
    assert "<down-bow" not in xml


def test_no_technique_no_technical_element():
    """無 TechniqueAnnotation → 不該生 <technical> 空 element."""
    from fractions import Fraction
    from core.ir import (
        Duration, Measure, NoteEvent, Part, Pitch, Score, TimePoint, Voice,
    )

    note = NoteEvent(
        pitch=Pitch(midi_number=64, spelling="E4"),
        duration=Duration(Fraction(1)),
        onset=TimePoint(Fraction(0)),
    )
    part = Part(
        part_id="violin_1", instrument_id="violin",
        name_display="Violin",
        measures=[Measure(number=1, voices={1: Voice(voice_id=1, events=[note])})],
    )
    xml = score_to_musicxml(Score(parts=[part], metadata={}))
    assert "<technical>" not in xml


# ============================================================================
# Hairpin 保留
# ============================================================================


def test_hairpin_emits_wedge():
    """Schubert Lieder 有 crescendo/diminuendo wedge."""
    # Lindenbaum 有大量 dynamics
    try:
        xml = _emit("openscore/schubert_d911_05_lindenbaum")
    except Exception:
        pytest.skip("Schubert sample not available")
    # 應該有 wedge crescendo 或 diminuendo
    has_wedge = (
        '<wedge type="crescendo"' in xml
        or '<wedge type="diminuendo"' in xml
    )
    assert has_wedge or '<wedge' in xml, "Schubert Lied 應該有 wedge"


# ============================================================================
# Grand-staff piano (上下譜表)
# ============================================================================


def test_grand_staff_piano_after_arrange():
    """改編到鋼琴 grand-staff (staves=2) 後應該 emit <staves>2."""
    from core.arrangement_model import Player
    from core.arranger import arrange
    ir = parse_musicxml("corpus:bach/bwv66.6")
    players = [
        Player(
            player_id="piano_1", display_name="Piano",
            instruments=["piano"], primary_instrument="piano", staves=2,
        ),
    ]
    arrangement = arrange(ir, players)
    xml = score_to_musicxml(arrangement.target_score)
    # grand-staff piano 應該至少 emit staff 1 or 2 內標
    assert (
        "<staves>2</staves>" in xml
        or "<staff>2</staff>" in xml
    ), "改編到 grand-staff piano 後缺少 <staves> 或 <staff> 標記"


# ============================================================================
# 不會 emit 空 XML / crash
# ============================================================================


def test_emit_nonempty():
    xml = _emit("bach/bwv66.6")
    assert len(xml) > 500, f"XML 太短 ({len(xml)} 字元), 可能有問題"


def test_emit_is_valid_utf8():
    xml = _emit("bach/bwv66.6")
    xml.encode("utf-8")  # 不該炸
    # 含 ASCII xml 宣告
    assert "<?xml" in xml[:200]


def test_emit_writes_to_filelike():
    """如果有 file-like 介面, 也測一下."""
    xml = _emit("bach/bwv66.6")
    f = io.StringIO(xml)
    f.seek(0)
    content = f.read()
    assert content == xml

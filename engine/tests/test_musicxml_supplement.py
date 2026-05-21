"""MusicXML 補充解析器測試 — music21 丟掉的 wedge / ornament 補回 IR。"""

from __future__ import annotations

import tempfile

from core.ir import NoteEvent
from core.musicxml_supplement import enrich_score
from core.musicxml_writer import write_musicxml_string
from core.parser import clear_parse_cache, parse_musicxml


def _count_ornaments(score) -> int:
    return sum(
        1
        for p in score.parts
        for m in p.measures
        for v in m.voices.values()
        for e in v.events
        if getattr(e, "ornament", None) is not None
    )


def test_captures_hairpins_music21_drops():
    """opus132 有上百個 wedge — music21 import 全丟, 補充解析器要補回。"""
    clear_parse_cache()
    ir = parse_musicxml("corpus:beethoven/opus132")
    assert len(ir.hairpins) > 0
    hp = ir.hairpins[0]
    assert hp.kind in ("crescendo", "diminuendo")
    assert hp.part_id
    # start / end 為 (measure, offset)
    assert hp.start[0] >= 1 and hp.end[0] >= hp.start[0]


def test_captures_ornaments():
    """trill-mark 等 ornament 應掛回對應的 NoteEvent。"""
    clear_parse_cache()
    ir = parse_musicxml("corpus:beethoven/opus132")
    assert _count_ornaments(ir) > 0


def test_hairpin_ornament_roundtrip():
    """補回的 hairpin / ornament 經 寫出 → 再 parse 應數量一致。"""
    clear_parse_cache()
    ir = parse_musicxml("corpus:beethoven/opus132")
    n_hair = len(ir.hairpins)
    n_orn = _count_ornaments(ir)
    xml = write_musicxml_string(ir)
    # 每條 hairpin 寫成 start + stop 兩個 <wedge>
    assert xml.count("<wedge") == n_hair * 2
    assert xml.count("<ornaments>") == n_orn

    with tempfile.NamedTemporaryFile(
        suffix=".musicxml", delete=False, mode="w", encoding="utf-8",
    ) as f:
        f.write(xml)
        tmp = f.name
    ir2 = parse_musicxml(tmp)
    assert len(ir2.hairpins) == n_hair
    assert _count_ornaments(ir2) == n_orn


def test_enrich_non_musicxml_is_safe():
    """非 MusicXML 來源 (不存在 / .mid) → enrich 靜默跳過, 不丟例外。"""
    from core.ir import Score
    enrich_score(Score(), "/nonexistent/path.musicxml")
    enrich_score(Score(), "/tmp/whatever.mid")
    enrich_score(Score(), "corpus:does/not/exist")  # 不應丟例外


def test_ornament_attached_to_note_event():
    """ornament 應掛在 NoteEvent 上, 且 kind 合法。"""
    clear_parse_cache()
    ir = parse_musicxml("corpus:beethoven/opus132")
    valid = {
        "trill", "mordent", "inverted_mordent",
        "turn", "inverted_turn", "tremolo",
    }
    found = False
    for p in ir.parts:
        for m in p.measures:
            for v in m.voices.values():
                for e in v.events:
                    orn = getattr(e, "ornament", None)
                    if orn is not None:
                        assert isinstance(e, NoteEvent)
                        assert orn.kind in valid
                        found = True
    assert found

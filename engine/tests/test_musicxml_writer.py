"""
MusicXML Writer 測試 — 含 round-trip (parse → write → re-parse) 結構保留驗證。
"""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.ir import (
    ChordEvent,
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Section,
    Voice,
)
from core.musicxml_writer import write_musicxml_file, write_musicxml_string
from core.parser import parse_stream


# ============================================================================
# Helpers
# ============================================================================

def _note(midi: int, dur=Fraction(1), onset=Fraction(0)) -> NoteEvent:
    return NoteEvent(pitch=Pitch(midi, _spell(midi)), duration=dur, onset=onset)


def _spell(midi: int) -> str:
    """簡易 MIDI → spelling (供測試用)。"""
    names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    octave = midi // 12 - 1
    return f"{names[midi % 12]}{octave}"


def _minimal_score() -> Score:
    return Score(
        metadata={"title": "Test", "composer": "Anon"},
        movements=[Movement(
            movement_id=1, measure_count=2,
            sections=[Section(0, 1, 2)],
        )],
        parts=[Part(
            part_id="violin_1", name_display="Violin",
            instrument_id="violin",
            measures=[
                Measure(
                    number=1, time_signature=(4, 4),
                    voices={1: Voice(voice_id=1, events=[
                        _note(72), _note(74, onset=Fraction(1)),
                        _note(76, onset=Fraction(2)), _note(77, onset=Fraction(3)),
                    ])},
                ),
                Measure(
                    number=2,
                    voices={1: Voice(voice_id=1, events=[
                        _note(79), _note(77, onset=Fraction(1)),
                        _note(76, onset=Fraction(2)), _note(74, onset=Fraction(3)),
                    ])},
                ),
            ],
        )],
    )


# ============================================================================
# 基本輸出
# ============================================================================

def test_write_returns_xml_string():
    score = _minimal_score()
    xml = write_musicxml_string(score)
    assert "<?xml" in xml
    assert "<score-partwise" in xml.lower() or "<score-timewise" in xml.lower()


def test_write_to_file(tmp_path):
    score = _minimal_score()
    out_path = tmp_path / "out.musicxml"
    write_musicxml_file(score, out_path)
    assert out_path.exists()
    content = out_path.read_text(encoding="utf-8")
    assert "<?xml" in content


def test_write_includes_metadata():
    score = _minimal_score()
    xml = write_musicxml_string(score)
    assert "Test" in xml
    assert "Anon" in xml


def test_write_includes_pitches():
    score = _minimal_score()
    xml = write_musicxml_string(score)
    # 用音名 + step 與 octave 驗證
    assert "<step>C</step>" in xml
    assert "<octave>5</octave>" in xml


# ============================================================================
# Round-trip: IR → MusicXML → IR
# ============================================================================

def test_roundtrip_preserves_structure():
    """寫入 MusicXML 後重新 parse,結構應大致相同。"""
    original = _minimal_score()
    xml = write_musicxml_string(original)

    # 重新 parse
    from music21 import converter
    m21_score = converter.parseData(xml, format="musicxml")
    restored = parse_stream(m21_score)

    # 比較關鍵屬性
    assert len(restored.parts) == len(original.parts)
    assert len(restored.parts[0].measures) == len(original.parts[0].measures)

    # 第一小節的音符 midi 應相同
    orig_events = original.parts[0].measures[0].voices[1].events
    restored_voices = restored.parts[0].measures[0].voices
    # 取第一個 voice (音樂21 可能改了 voice ID)
    restored_events = list(restored_voices.values())[0].events

    orig_midis = [
        e.pitch.midi_number for e in orig_events
        if isinstance(e, NoteEvent)
    ]
    restored_midis = [
        e.pitch.midi_number for e in restored_events
        if isinstance(e, NoteEvent)
    ]
    assert restored_midis == orig_midis


def test_roundtrip_chord():
    """ChordEvent 寫出後仍為 ChordEvent"""
    score = Score(
        movements=[Movement(
            movement_id=1, measure_count=1,
            sections=[Section(0, 1, 1)],
        )],
        parts=[Part(
            part_id="piano_1", name_display="Piano",
            instrument_id="piano",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    ChordEvent(
                        pitches=[
                            Pitch(60, "C4"), Pitch(64, "E4"), Pitch(67, "G4"),
                        ],
                        duration=Fraction(4),
                        onset=Fraction(0),
                    ),
                ])},
            )],
        )],
    )
    xml = write_musicxml_string(score)
    from music21 import converter
    restored = parse_stream(converter.parseData(xml, format="musicxml"))
    events = list(restored.parts[0].measures[0].voices.values())[0].events
    assert len(events) == 1
    assert isinstance(events[0], ChordEvent)
    midis = sorted(p.midi_number for p in events[0].pitches)
    assert midis == [60, 64, 67]


def test_roundtrip_rest():
    score = Score(
        movements=[Movement(
            movement_id=1, measure_count=1,
            sections=[Section(0, 1, 1)],
        )],
        parts=[Part(
            part_id="v", name_display="V",
            instrument_id="violin",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    _note(60), RestEvent(duration=Fraction(1), onset=Fraction(1)),
                    _note(64, onset=Fraction(2)),
                    RestEvent(duration=Fraction(1), onset=Fraction(3)),
                ])},
            )],
        )],
    )
    xml = write_musicxml_string(score)
    from music21 import converter
    restored = parse_stream(converter.parseData(xml, format="musicxml"))
    events = list(restored.parts[0].measures[0].voices.values())[0].events
    rests = [e for e in events if isinstance(e, RestEvent)]
    assert len(rests) == 2


def test_roundtrip_triplet():
    from core.ir import Tuplet
    score = Score(
        movements=[Movement(
            movement_id=1, measure_count=1,
            sections=[Section(0, 1, 1)],
        )],
        parts=[Part(
            part_id="v", name_display="V",
            instrument_id="violin",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    NoteEvent(
                        pitch=Pitch(60, "C4"),
                        duration=Fraction(1, 3),
                        onset=Fraction(0),
                        tuplet=Tuplet(actual=3, normal=2, bracket_id=0),
                    ),
                    NoteEvent(
                        pitch=Pitch(62, "D4"),
                        duration=Fraction(1, 3),
                        onset=Fraction(1, 3),
                        tuplet=Tuplet(actual=3, normal=2, bracket_id=0),
                    ),
                    NoteEvent(
                        pitch=Pitch(64, "E4"),
                        duration=Fraction(1, 3),
                        onset=Fraction(2, 3),
                        tuplet=Tuplet(actual=3, normal=2, bracket_id=0),
                    ),
                    NoteEvent(
                        pitch=Pitch(65, "F4"),
                        duration=Fraction(1),
                        onset=Fraction(1),
                    ),
                    NoteEvent(
                        pitch=Pitch(67, "G4"),
                        duration=Fraction(1),
                        onset=Fraction(2),
                    ),
                    NoteEvent(
                        pitch=Pitch(69, "A4"),
                        duration=Fraction(1),
                        onset=Fraction(3),
                    ),
                ])},
            )],
        )],
    )
    xml = write_musicxml_string(score)
    from music21 import converter
    restored = parse_stream(converter.parseData(xml, format="musicxml"))
    events = list(restored.parts[0].measures[0].voices.values())[0].events
    triplet_events = [
        e for e in events
        if isinstance(e, NoteEvent) and e.tuplet is not None
    ]
    assert len(triplet_events) >= 3


# ============================================================================
# 整合: parse Bach → 改編 → write → 再 parse
# ============================================================================

def test_full_pipeline_with_writer():
    """parse → tag → arrange → write → re-parse 應全程成功"""
    from music21 import corpus, converter
    from core.parser import parse_stream
    from core.analyzer.function import tag_all_sections
    from core.arranger import arrange
    from core.arrangement_model import violin_piano_ensemble

    m21_score = corpus.parse("bach/bwv66.6")
    ir = parse_stream(m21_score)
    tag_all_sections(ir)
    arrangement = arrange(ir, violin_piano_ensemble())

    assert arrangement.target_score is not None
    xml = write_musicxml_string(arrangement.target_score)
    assert len(xml) > 1000  # 應有實質內容

    # 再 parse 不應失敗
    restored = parse_stream(converter.parseData(xml, format="musicxml"))
    assert len(restored.parts) > 0


# ============================================================================
# 直接序列化器 (ir_to_musicxml) — 繞過 music21 的快速路徑
# ============================================================================

def test_direct_serializer_produces_partwise():
    """直接序列化器輸出合法的 score-partwise (含 DOCTYPE)。"""
    from core.ir_to_musicxml import score_to_musicxml
    xml = score_to_musicxml(_minimal_score())
    assert "<!DOCTYPE score-partwise" in xml
    assert "<score-partwise" in xml


def test_overlapping_events_split_into_voices():
    """同一 IR voice 內同時發聲的兩個音 → greedy 切成多 MusicXML 聲部,
    round-trip 後兩個音都還在。"""
    score = Score(
        movements=[Movement(
            movement_id=1, measure_count=1, sections=[Section(0, 1, 1)],
        )],
        parts=[Part(
            part_id="piano_1", name_display="Piano", instrument_id="piano",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    NoteEvent(
                        pitch=Pitch(72, "C5"), duration=Fraction(4),
                        onset=Fraction(0),
                    ),
                    NoteEvent(
                        pitch=Pitch(60, "C4"), duration=Fraction(4),
                        onset=Fraction(0),
                    ),
                ])},
            )],
        )],
    )
    xml = write_musicxml_string(score)
    from music21 import converter
    restored = parse_stream(converter.parseData(xml, format="musicxml"))
    midis: set[int] = set()
    for v in restored.parts[0].measures[0].voices.values():
        for e in v.events:
            if isinstance(e, NoteEvent):
                midis.add(e.pitch.midi_number)
            elif isinstance(e, ChordEvent):
                midis.update(p.midi_number for p in e.pitches)
    assert {60, 72} <= midis


def test_ties_emitted():
    """is_tied_to/from → 同時輸出 <tie> (發聲) 與 <tied> (記號)。"""
    score = Score(
        movements=[Movement(
            movement_id=1, measure_count=1, sections=[Section(0, 1, 1)],
        )],
        parts=[Part(
            part_id="v", name_display="V", instrument_id="violin",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    NoteEvent(
                        pitch=Pitch(60, "C4"), duration=Fraction(2),
                        onset=Fraction(0), is_tied_to=True,
                    ),
                    NoteEvent(
                        pitch=Pitch(60, "C4"), duration=Fraction(2),
                        onset=Fraction(2), is_tied_from=True,
                    ),
                ])},
            )],
        )],
    )
    xml = write_musicxml_string(score)
    assert '<tie type="start"' in xml
    assert '<tied type="start"' in xml
    assert '<tie type="stop"' in xml


@pytest.mark.parametrize("corpus_id", [
    "bach/bwv66.6",            # 小
    "mozart/k80/movement1",    # 中
    "beethoven/opus132",       # 大 (1124 小節)
])
def test_corpus_roundtrip_preserves_notes(corpus_id):
    """corpus → IR → 直接序列化 → 再 parse, 音符/和弦總數需一致。"""
    from core.parser import parse_musicxml

    def note_chord_count(score):
        n = 0
        for p in score.parts:
            for m in p.measures:
                for v in m.voices.values():
                    for e in v.events:
                        if isinstance(e, (NoteEvent, ChordEvent)):
                            n += 1
        return n

    ir = parse_musicxml(f"corpus:{corpus_id}")
    xml = write_musicxml_string(ir)
    from music21 import converter
    restored = parse_stream(converter.parseData(xml, format="musicxml"))
    assert len(restored.parts) == len(ir.parts)
    before, after = note_chord_count(ir), note_chord_count(restored)
    assert before == after, (
        f"{corpus_id}: 音符數 {before} → {after}"
    )


def test_piano_exports_as_grand_staff():
    """含鋼琴的改編 → 鋼琴的 upper/lower 兩個 IR part 合成一個大譜表
    (一個 score-part / <staves>2</staves> / <staff> 標記)。"""
    from core.analyzer.function import tag_all_sections
    from core.arrangement_model import build_ensemble
    from core.arranger import arrange as run_arrange
    from core.parser import parse_musicxml

    score = parse_musicxml("corpus:mozart/k80/movement1")
    tag_all_sections(score)
    arr = run_arrange(score, build_ensemble("violin_piano"))
    xml = write_musicxml_string(arr.target_score)

    assert "<staves>2</staves>" in xml
    assert "<staff>1</staff>" in xml
    assert "<staff>2</staff>" in xml
    # violin_piano → violin + piano(大譜表) = 2 個 score-part, 不是 3
    assert xml.count("<score-part ") == 2

    # 仍是合法 MusicXML — 再 parse 不應失敗
    from music21 import converter
    restored = parse_stream(converter.parseData(xml, format="musicxml"))
    assert len(restored.parts) > 0


def test_grand_staff_grouping():
    """_group_parts: X_upper + X_lower 配成 grand, 其餘為 single。"""
    from core.ir_to_musicxml import _group_parts

    def mk(pid):
        return Part(part_id=pid, name_display=pid, instrument_id="piano")

    groups = _group_parts([
        mk("violin_1"), mk("piano_1_upper"), mk("piano_1_lower"),
    ])
    kinds = [g[0] for g in groups]
    assert kinds == ["single", "grand"]
    grand = next(g for g in groups if g[0] == "grand")
    assert grand[1].part_id == "piano_1_upper"
    assert grand[2].part_id == "piano_1_lower"

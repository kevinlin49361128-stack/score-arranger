"""移調樂器 sounding ↔ written 鏈路測試 (0.1.55).

涵蓋:
1. parser 對 transposing instruments 把 m21 pitch 正確分離成
   midi_number=sounding / written_midi=written.
2. ir_to_musicxml 在第一小節 <attributes> 寫出 <transpose> 元素,
   音符 <pitch> 用 written.
3. round-trip (IR → MusicXML → music21 解析回來) 玩家拿到的譜上是
   written pitch, 實音是 sounding.

對非移調樂器 (violin), written_midi 必為 None, 不寫 <transpose>.
"""

from __future__ import annotations

import pytest
from music21 import converter, instrument, meter, note, stream

from core.ir_to_musicxml import score_to_musicxml
from core.parser import clear_parse_cache, parse_stream


# ============================================================================
# Helpers
# ============================================================================

def _make_one_note_score(m21_inst, pitch_name: str):
    """造一個只含一個音的 m21 score, 給定樂器與譜上音名."""
    sc = stream.Score()
    p = stream.Part()
    p.insert(0, m21_inst)
    m = stream.Measure(number=1)
    m.timeSignature = meter.TimeSignature("4/4")
    m.append(note.Note(pitch_name, quarterLength=4))
    p.append(m)
    sc.append(p)
    return sc


def _first_note_pitch(ir):
    return ir.parts[0].measures[0].voices[1].events[0].pitch


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_parse_cache()


# ============================================================================
# Parser — sounding 與 written 分離
# ============================================================================

class TestParserTransposing:
    def test_clarinet_bb_written_c4_to_sounding_bb3(self):
        # 譜上 C4 (midi 60) → 實音 Bb3 (midi 58)
        ir = parse_stream(_make_one_note_score(instrument.Clarinet(), "C4"))
        p = _first_note_pitch(ir)
        assert p.midi_number == 58, f"sounding expect 58, got {p.midi_number}"
        assert p.written_midi == 60, f"written expect 60, got {p.written_midi}"
        assert p.spelling == "Bb3"
        assert p.written_spelling == "C4"

    def test_trumpet_bb_written_c4_to_sounding_bb3(self):
        # Trumpet Bb 與 Clarinet Bb 同 transposition
        ir = parse_stream(_make_one_note_score(instrument.Trumpet(), "C4"))
        p = _first_note_pitch(ir)
        assert p.midi_number == 58
        assert p.written_midi == 60

    def test_horn_f_written_c4_to_sounding_f3(self):
        # 譜上 C4 (60) → 實音 F3 (53), 純五度下行
        ir = parse_stream(_make_one_note_score(instrument.Horn(), "C4"))
        p = _first_note_pitch(ir)
        assert p.midi_number == 53, f"horn sounding expect 53, got {p.midi_number}"
        assert p.written_midi == 60
        assert p.spelling == "F3"
        assert p.written_spelling == "C4"

    def test_alto_sax_written_c4_to_sounding_eb3(self):
        # Alto Sax (Eb): 譜上 C4 → 實音 Eb3 (大六度下行, midi 51)
        # 註: 本專案目前無 alto_sax InstrumentProfile, 但 parser 從 m21
        # 拿 transposition 仍能正確處理 — 證明分離邏輯不依賴 profile registry.
        ir = parse_stream(
            _make_one_note_score(instrument.AltoSaxophone(), "C4"),
        )
        p = _first_note_pitch(ir)
        assert p.midi_number == 51, f"alto sax sounding expect 51, got {p.midi_number}"
        assert p.written_midi == 60

    def test_violin_non_transposing_written_midi_none(self):
        ir = parse_stream(_make_one_note_score(instrument.Violin(), "C4"))
        p = _first_note_pitch(ir)
        assert p.midi_number == 60
        assert p.written_midi is None
        assert p.written_spelling is None


# ============================================================================
# Writer — <transpose> 元素 + written pitch
# ============================================================================

class TestWriterTranspose:
    def test_clarinet_emits_transpose_element(self):
        ir = parse_stream(_make_one_note_score(instrument.Clarinet(), "C4"))
        xml = score_to_musicxml(ir)
        assert "<transpose>" in xml, "Clarinet 應寫出 <transpose> 元素"
        assert "<chromatic>-2</chromatic>" in xml
        assert "<diatonic>-1</diatonic>" in xml

    def test_horn_emits_correct_transpose(self):
        ir = parse_stream(_make_one_note_score(instrument.Horn(), "C4"))
        xml = score_to_musicxml(ir)
        assert "<chromatic>-7</chromatic>" in xml
        assert "<diatonic>-4</diatonic>" in xml

    def test_violin_no_transpose_element(self):
        ir = parse_stream(_make_one_note_score(instrument.Violin(), "C4"))
        xml = score_to_musicxml(ir)
        assert "<transpose>" not in xml, "Violin 不該寫 <transpose>"

    def test_clarinet_pitch_is_written(self):
        # written C4 應寫成 <step>C</step><octave>4</octave>
        ir = parse_stream(_make_one_note_score(instrument.Clarinet(), "C4"))
        xml = score_to_musicxml(ir)
        # 找第一個 <pitch>
        import re
        m = re.search(
            r"<pitch>\s*<step>(\w)</step>\s*"
            r"(?:<alter>(-?\d+)</alter>\s*)?<octave>(\d+)</octave>",
            xml,
        )
        assert m is not None, "找不到 <pitch>"
        step, alter, octave = m.group(1), m.group(2) or "0", m.group(3)
        assert step == "C" and int(octave) == 4 and int(alter) == 0, (
            f"clarinet 譜上應是 C4, 寫成 {step}{alter}{octave}"
        )

    def test_horn_pitch_is_written_c4_not_sounding_f3(self):
        # Horn sounding F3, 但譜上應寫 C4 (帶 <transpose>)
        ir = parse_stream(_make_one_note_score(instrument.Horn(), "C4"))
        xml = score_to_musicxml(ir)
        import re
        m = re.search(
            r"<pitch>\s*<step>(\w)</step>\s*"
            r"(?:<alter>(-?\d+)</alter>\s*)?<octave>(\d+)</octave>",
            xml,
        )
        assert m is not None
        step, alter, octave = m.group(1), m.group(2) or "0", m.group(3)
        assert step == "C" and int(octave) == 4, (
            f"horn 譜上應是 C4 (記譜音), 寫成 {step}{alter}{octave}"
        )


# ============================================================================
# E2E round-trip — 玩家拿到譜 = written, 實音 = sounding
# ============================================================================

class TestRoundTrip:
    def test_clarinet_round_trip(self):
        ir = parse_stream(_make_one_note_score(instrument.Clarinet(), "C4"))
        xml = score_to_musicxml(ir)
        # music21 解析回來
        sc = converter.parseData(xml, format="musicxml")
        parts = list(sc.parts)
        assert len(parts) == 1
        inst = parts[0].getInstrument(returnDefault=False)
        assert inst is not None
        # transposition 應 ≈ M-2 (大二度下行 = -2 半音)
        assert inst.transposition is not None
        assert int(inst.transposition.semitones) == -2
        # 譜上音 (written) = C4
        notes = list(parts[0].recurse().notes)
        assert len(notes) == 1
        assert notes[0].pitch.nameWithOctave == "C4"
        # toSoundingPitch → 實音 Bb3 (midi 58)
        sounded = sc.toSoundingPitch(inPlace=False)
        for p in sounded.parts:
            for n in p.recurse().notes:
                assert n.pitch.midi == 58, (
                    f"sounding expect 58, got {n.pitch.midi}"
                )

    def test_horn_round_trip(self):
        ir = parse_stream(_make_one_note_score(instrument.Horn(), "C4"))
        xml = score_to_musicxml(ir)
        sc = converter.parseData(xml, format="musicxml")
        parts = list(sc.parts)
        inst = parts[0].getInstrument(returnDefault=False)
        assert inst is not None
        assert int(inst.transposition.semitones) == -7
        notes = list(parts[0].recurse().notes)
        assert notes[0].pitch.nameWithOctave == "C4"
        sounded = sc.toSoundingPitch(inPlace=False)
        for p in sounded.parts:
            for n in p.recurse().notes:
                assert n.pitch.midi == 53

    def test_violin_round_trip_no_transpose(self):
        ir = parse_stream(_make_one_note_score(instrument.Violin(), "C4"))
        xml = score_to_musicxml(ir)
        assert "<transpose>" not in xml
        sc = converter.parseData(xml, format="musicxml")
        parts = list(sc.parts)
        notes = list(parts[0].recurse().notes)
        assert notes[0].pitch.midi == 60

    def test_clarinet_double_reparse_idempotent(self):
        """parse → emit → 再 parse_stream → 再 emit, 結果穩定.

        防止「每次 round-trip pitch 都漂一次」這種無聲 regression — IR 的
        midi_number/written_midi 必須兩輪都相同.
        """
        ir1 = parse_stream(_make_one_note_score(instrument.Clarinet(), "C4"))
        xml1 = score_to_musicxml(ir1)
        sc1 = converter.parseData(xml1, format="musicxml")
        ir2 = parse_stream(sc1)
        p2 = _first_note_pitch(ir2)
        assert p2.midi_number == 58, (
            f"reparse sounding 應穩定為 58, got {p2.midi_number}"
        )
        assert p2.written_midi == 60, (
            f"reparse written 應穩定為 60, got {p2.written_midi}"
        )

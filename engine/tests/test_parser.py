"""
Parser 整合測試 — music21 stream / MusicXML → IR

使用程式化建構的 music21 stream 作為測試輸入 (避免依賴外部檔案),
另用 music21.corpus 的小作品做 smoke test。
"""

from __future__ import annotations

from fractions import Fraction

import pytest
from music21 import (
    articulations,
    chord as m21_chord,
    dynamics as m21_dynamics,
    expressions,
    instrument,
    meter,
    note as m21_note,
    spanner,
    stream as m21_stream,
    tie,
)

from core.ir import ChordEvent, NoteEvent, RestEvent
from core.ir_validate import validate
from core.parser import parse_stream


# ============================================================================
# 輔助函式
# ============================================================================

def _build_simple_score(
    notes_per_measure: list[list[str]],
    instrument_obj=None,
) -> m21_stream.Score:
    """建立單聲部 music21 Score, 每元素為音名字串 (如 'C4', '#G3') 或 'r' 表休止。"""
    score = m21_stream.Score()
    part = m21_stream.Part()
    if instrument_obj is not None:
        part.insert(0, instrument_obj)

    for i, measure_notes in enumerate(notes_per_measure):
        m = m21_stream.Measure(number=i + 1)
        if i == 0:
            m.append(meter.TimeSignature("4/4"))
        for n in measure_notes:
            if n == "r":
                m.append(m21_note.Rest(quarterLength=1.0))
            else:
                m.append(m21_note.Note(n, quarterLength=1.0))
        part.append(m)

    score.insert(0, part)
    return score


# ============================================================================
# 基本解析
# ============================================================================

def test_parse_single_note():
    score = _build_simple_score([["C4"]], instrument.Violin())
    ir = parse_stream(score)

    assert len(ir.parts) == 1
    part = ir.parts[0]
    assert part.instrument_id == "violin"
    assert len(part.measures) == 1
    events = part.measures[0].voices[1].events
    assert len(events) == 1
    assert isinstance(events[0], NoteEvent)
    assert events[0].pitch.midi_number == 60
    assert events[0].pitch.spelling == "C4"
    assert events[0].duration == Fraction(1)


def test_parse_full_measure():
    """4 個四分音符 + 休止符 + 移調拼寫"""
    score = _build_simple_score([["C4", "D4", "F#4", "Bb4"]], instrument.Violin())
    ir = parse_stream(score)
    events = ir.parts[0].measures[0].voices[1].events
    assert len(events) == 4
    spellings = [e.pitch.spelling for e in events]
    assert spellings == ["C4", "D4", "F#4", "Bb4"]


def test_parse_rest():
    score = _build_simple_score([["C4", "r", "D4"]])
    ir = parse_stream(score)
    events = ir.parts[0].measures[0].voices[1].events
    rest = events[1]
    assert isinstance(rest, RestEvent)
    assert rest.duration == Fraction(1)


def test_parse_time_signature():
    score = m21_stream.Score()
    part = m21_stream.Part()
    m1 = m21_stream.Measure(number=1)
    m1.append(meter.TimeSignature("3/4"))
    m1.append(m21_note.Note("C4", quarterLength=1.0))
    m1.append(m21_note.Note("D4", quarterLength=1.0))
    m1.append(m21_note.Note("E4", quarterLength=1.0))
    part.append(m1)
    score.insert(0, part)

    ir = parse_stream(score)
    assert ir.parts[0].measures[0].time_signature == (3, 4)
    assert ir.default_time_signature == (3, 4)


def test_parse_chord():
    score = m21_stream.Score()
    part = m21_stream.Part()
    m = m21_stream.Measure(number=1)
    m.append(meter.TimeSignature("4/4"))
    m.append(m21_chord.Chord(["C4", "E4", "G4"], quarterLength=4.0))
    part.append(m)
    score.insert(0, part)

    ir = parse_stream(score)
    events = ir.parts[0].measures[0].voices[1].events
    assert len(events) == 1
    assert isinstance(events[0], ChordEvent)
    assert len(events[0].pitches) == 3
    assert events[0].pitches[0].midi_number == 60


def test_single_pitch_chord_becomes_note():
    """spec §4.1.1: 單音 Chord wrapper → NoteEvent"""
    score = m21_stream.Score()
    part = m21_stream.Part()
    m = m21_stream.Measure(number=1)
    m.append(meter.TimeSignature("4/4"))
    m.append(m21_chord.Chord(["C4"], quarterLength=4.0))  # 單音 Chord
    part.append(m)
    score.insert(0, part)

    ir = parse_stream(score)
    events = ir.parts[0].measures[0].voices[1].events
    assert len(events) == 1
    assert isinstance(events[0], NoteEvent)  # 轉成 NoteEvent
    assert events[0].pitch.midi_number == 60


def test_chord_dedups_duplicate_midi_numbers():
    """regression: notation→MIDI 匯出常在同一和弦塞重複/同 MIDI 音高;
    ChordEvent 不允許重複 midi_number → parser 須去重。"""
    score = m21_stream.Score()
    part = m21_stream.Part()
    m = m21_stream.Measure(number=1)
    m.append(meter.TimeSignature("4/4"))
    # C#4 與 Db4 是異名同音 (MIDI 61); 整顆和弦 MIDI = {61, 61, 64}
    m.append(m21_chord.Chord(["C#4", "D-4", "E4"], quarterLength=4.0))
    part.append(m)
    score.insert(0, part)

    ir = parse_stream(score)
    events = ir.parts[0].measures[0].voices[1].events
    assert len(events) == 1
    assert isinstance(events[0], ChordEvent)
    midis = [p.midi_number for p in events[0].pitches]
    assert midis == [61, 64]  # 去重後保留首次出現
    # IR 必須通過驗證 (ChordEvent 不可有重複 midi_number)
    assert validate(ir).errors == []


def test_chord_all_duplicate_midi_becomes_note():
    """去重後只剩單音 → 退化為 NoteEvent。"""
    score = m21_stream.Score()
    part = m21_stream.Part()
    m = m21_stream.Measure(number=1)
    m.append(meter.TimeSignature("4/4"))
    m.append(m21_chord.Chord(["C#4", "D-4"], quarterLength=4.0))  # 全為 MIDI 61
    part.append(m)
    score.insert(0, part)

    ir = parse_stream(score)
    events = ir.parts[0].measures[0].voices[1].events
    assert len(events) == 1
    assert isinstance(events[0], NoteEvent)
    assert events[0].pitch.midi_number == 61


# ============================================================================
# Articulations / Dynamics
# ============================================================================

def test_parse_articulation():
    score = m21_stream.Score()
    part = m21_stream.Part()
    m = m21_stream.Measure(number=1)
    m.append(meter.TimeSignature("4/4"))
    n = m21_note.Note("C4", quarterLength=1.0)
    n.articulations.append(articulations.Staccato())
    n.articulations.append(articulations.Accent())
    m.append(n)
    part.append(m)
    score.insert(0, part)

    ir = parse_stream(score)
    event = ir.parts[0].measures[0].voices[1].events[0]
    assert "staccato" in event.articulations
    assert "accent" in event.articulations


def test_parse_fermata():
    score = m21_stream.Score()
    part = m21_stream.Part()
    m = m21_stream.Measure(number=1)
    m.append(meter.TimeSignature("4/4"))
    n = m21_note.Note("C4", quarterLength=4.0)
    n.expressions.append(expressions.Fermata())
    m.append(n)
    part.append(m)
    score.insert(0, part)

    ir = parse_stream(score)
    event = ir.parts[0].measures[0].voices[1].events[0]
    assert "fermata" in event.articulations


def test_parse_dynamic_propagation():
    """Dynamic 後的音符應繼承力度直到下一個 Dynamic"""
    score = m21_stream.Score()
    part = m21_stream.Part()
    m = m21_stream.Measure(number=1)
    m.append(meter.TimeSignature("4/4"))
    m.append(m21_dynamics.Dynamic("ff"))
    m.append(m21_note.Note("C4", quarterLength=1.0))
    m.append(m21_note.Note("D4", quarterLength=1.0))
    m.append(m21_dynamics.Dynamic("p"))
    m.append(m21_note.Note("E4", quarterLength=1.0))
    m.append(m21_note.Note("F4", quarterLength=1.0))
    part.append(m)
    score.insert(0, part)

    ir = parse_stream(score)
    events = ir.parts[0].measures[0].voices[1].events
    assert events[0].dynamic == "ff"
    assert events[1].dynamic == "ff"
    assert events[2].dynamic == "p"
    assert events[3].dynamic == "p"


# ============================================================================
# Ties / Slurs
# ============================================================================

def test_parse_tie():
    score = m21_stream.Score()
    part = m21_stream.Part()
    m1 = m21_stream.Measure(number=1)
    m1.append(meter.TimeSignature("4/4"))
    n1 = m21_note.Note("C4", quarterLength=4.0)
    n1.tie = tie.Tie("start")
    m1.append(n1)
    m2 = m21_stream.Measure(number=2)
    n2 = m21_note.Note("C4", quarterLength=4.0)
    n2.tie = tie.Tie("stop")
    m2.append(n2)
    part.append(m1)
    part.append(m2)
    score.insert(0, part)

    ir = parse_stream(score)
    e1 = ir.parts[0].measures[0].voices[1].events[0]
    e2 = ir.parts[0].measures[1].voices[1].events[0]
    assert e1.is_tied_to
    assert not e1.is_tied_from
    assert e2.is_tied_from
    assert not e2.is_tied_to


def test_parse_slur():
    score = m21_stream.Score()
    part = m21_stream.Part()
    m = m21_stream.Measure(number=1)
    m.append(meter.TimeSignature("4/4"))
    n1 = m21_note.Note("C4", quarterLength=1.0)
    n2 = m21_note.Note("D4", quarterLength=1.0)
    n3 = m21_note.Note("E4", quarterLength=1.0)
    n4 = m21_note.Note("F4", quarterLength=1.0)
    m.append([n1, n2, n3, n4])
    part.append(m)

    slur = spanner.Slur([n1, n2, n3, n4])
    part.append(slur)
    score.insert(0, part)

    ir = parse_stream(score)
    events = ir.parts[0].measures[0].voices[1].events
    slur_ids = {e.slur_group for e in events}
    assert len(slur_ids) == 1  # 同一 slur group
    assert None not in slur_ids


# ============================================================================
# Tuplets
# ============================================================================

def test_parse_triplet():
    score = m21_stream.Score()
    part = m21_stream.Part()
    m = m21_stream.Measure(number=1)
    m.append(meter.TimeSignature("4/4"))
    # 三連音四分音符 (在 2 個四分音符的時間內彈 3 個音)
    triplet_notes = [m21_note.Note(p, quarterLength=Fraction(2, 3)) for p in ["C4", "D4", "E4"]]
    for n in triplet_notes:
        m.append(n)
    # 補上其他 2 個四分音符
    m.append(m21_note.Note("F4", quarterLength=1.0))
    m.append(m21_note.Note("G4", quarterLength=1.0))
    part.append(m)
    score.insert(0, part)

    ir = parse_stream(score)
    events = ir.parts[0].measures[0].voices[1].events
    assert len(events) == 5
    # 前 3 個應有 tuplet 標記
    for i in range(3):
        assert events[i].tuplet is not None
        assert events[i].tuplet.actual == 3
        assert events[i].tuplet.normal == 2
    # 後 2 個無 tuplet
    assert events[3].tuplet is None
    assert events[4].tuplet is None


# ============================================================================
# Instruments
# ============================================================================

def test_parse_multiple_parts():
    score = m21_stream.Score()

    p1 = m21_stream.Part()
    p1.insert(0, instrument.Violin())
    m1 = m21_stream.Measure(number=1)
    m1.append(meter.TimeSignature("4/4"))
    m1.append(m21_note.Note("C5", quarterLength=4.0))
    p1.append(m1)

    p2 = m21_stream.Part()
    p2.insert(0, instrument.Piano())
    m2 = m21_stream.Measure(number=1)
    m2.append(meter.TimeSignature("4/4"))
    m2.append(m21_chord.Chord(["C3", "E3", "G3"], quarterLength=4.0))
    p2.append(m2)

    score.insert(0, p1)
    score.insert(0, p2)

    ir = parse_stream(score)
    assert len(ir.parts) == 2
    inst_ids = {p.instrument_id for p in ir.parts}
    assert "violin" in inst_ids
    assert "piano" in inst_ids


def test_parse_metadata():
    score = m21_stream.Score()
    score.insert(0, m21_stream.Part())
    score.metadata = type(score.metadata)() if score.metadata else None
    from music21 import metadata
    score.metadata = metadata.Metadata()
    score.metadata.title = "Test Title"
    score.metadata.composer = "Test Composer"

    ir = parse_stream(score)
    assert ir.metadata.get("title") == "Test Title"
    assert ir.metadata.get("composer") == "Test Composer"
    assert ir.metadata.get("source_format") == "musicxml"


# ============================================================================
# 整合: 解析後 IR 必須通過驗證
# ============================================================================

def test_parsed_ir_passes_validation():
    """解析後產出的 IR 應通過 ir_validate (硬不變式無錯誤)"""
    score = _build_simple_score(
        [["C4", "D4", "E4", "F4"], ["G4", "A4", "B4", "C5"]],
        instrument.Violin(),
    )
    ir = parse_stream(score)
    result = validate(ir)
    assert result.ok, f"驗證錯誤: {[e.message for e in result.errors]}"


# ============================================================================
# music21 corpus smoke test
# ============================================================================

def test_parse_corpus_bach_chorale():
    """smoke test: 用 music21 內建語料庫解析一首巴赫聖詠"""
    from music21 import corpus
    m21_score = corpus.parse("bach/bwv66.6")
    ir = parse_stream(m21_score)

    assert len(ir.parts) == 4  # SATB
    assert ir.movements[0].measure_count > 0
    # 每個 part 都應有音符
    for part in ir.parts:
        assert len(part.measures) > 0
        total_events = sum(
            len(v.events)
            for m in part.measures
            for v in m.voices.values()
        )
        assert total_events > 0

    # 解析後通過驗證
    result = validate(ir)
    # 容許 warning, 但不應有 error
    if result.errors:
        # 列出前幾個錯誤幫助除錯
        msgs = "\n".join(f"  {e.code}: {e.message}" for e in result.errors[:5])
        pytest.fail(f"Bach chorale 解析後驗證失敗:\n{msgs}")


def test_parse_musicxml_corpus_prefix():
    """parse_musicxml 支援 'corpus:xxx' 路徑前綴"""
    from core.parser import parse_musicxml
    ir = parse_musicxml("corpus:bach/bwv66.6")
    assert len(ir.parts) == 4
    # SATB 應該被偵測為對應的 voice profile
    instrument_ids = {p.instrument_id for p in ir.parts}
    assert "soprano" in instrument_ids
    assert "bass_voice" in instrument_ids


# ============================================================================
# Title metadata fallback (#52)
# ============================================================================

class TestTitleFallback:
    """確認標題不會落到 music21 預設 'Music21 Fragment'"""

    def test_mozart_uses_movement_name(self):
        from music21 import corpus
        from core.parser import parse_stream
        m = corpus.parse("mozart/k80/movement1")
        ir = parse_stream(m)
        title = ir.metadata.get("title")
        assert title
        assert "Music21 Fragment" not in title
        assert "Quartet" in title

    def test_bach_falls_back_to_corpus_path(self):
        from music21 import corpus
        from core.parser import parse_stream
        # Bach chorale: title=None, movementName 是檔名, opusTitle 也沒
        m = corpus.parse("bach/bwv66.6")
        ir = parse_stream(m)
        title = ir.metadata.get("title")
        assert title
        # 不應該漏出 .mxl 副檔名
        assert not title.endswith(".mxl")
        # 應該是 'bach/bwv66.6' 樣式
        assert "bwv66" in title.lower()

    def test_no_filename_extension_in_title(self):
        from music21 import corpus
        from core.parser import parse_stream
        for pid in ["bach/bwv7.7", "mozart/k80/movement1"]:
            m = corpus.parse(pid)
            ir = parse_stream(m)
            t = ir.metadata.get("title", "")
            for ext in (".mxl", ".xml", ".musicxml"):
                assert not t.lower().endswith(ext), (
                    f"{pid}: title leaked extension: {t!r}"
                )


# ============================================================================
# 解析快取 (parse cache) — 避免同檔被 music21 重複解析
# ============================================================================

class TestParseCache:
    """parser 的 (path, mtime, size) 快取。"""

    def test_repeated_parse_returns_independent_copies(self):
        """同檔連續 parse_musicxml → 內容相同, 但物件互相獨立 (deepcopy)。"""
        from core.parser import clear_parse_cache, parse_musicxml
        clear_parse_cache()
        ir1 = parse_musicxml("corpus:bach/bwv66.6")
        ir2 = parse_musicxml("corpus:bach/bwv66.6")  # 命中快取
        assert ir1 is not ir2
        assert len(ir1.parts) == len(ir2.parts)
        original_parts = len(ir1.parts)
        # 就地清空第一份不應污染快取 / 後續解析
        ir1.parts.clear()
        ir3 = parse_musicxml("corpus:bach/bwv66.6")
        assert len(ir3.parts) == original_parts

    def test_m21_cache_returns_same_object(self):
        """load_m21 命中快取回傳同一個 m21 Score (consumer 皆唯讀)。"""
        from core.parser import clear_parse_cache, load_m21
        clear_parse_cache()
        a = load_m21("corpus:bach/bwv66.6")
        b = load_m21("corpus:bach/bwv66.6")
        assert a is b

    def test_mtime_change_invalidates_cache(self, tmp_path):
        """檔案內容變動 (mtime/size 變) → 快取失效, 重新解析。"""
        import os
        import shutil
        import time

        from core.parser import clear_parse_cache, parse_musicxml
        from core.samples import resolve as resolve_sample
        clear_parse_cache()
        sample_a = resolve_sample("bach/bwv66.6")        # 短聖詠
        sample_b = resolve_sample("beethoven/opus132")    # 長弦樂四重奏樂章
        assert sample_a is not None and sample_b is not None

        target = tmp_path / "score.musicxml"
        shutil.copy(sample_a, target)
        ir_a = parse_musicxml(str(target))
        # 覆寫成另一首 + 強制改 mtime (防檔案系統 mtime 解析度過粗)
        shutil.copy(sample_b, target)
        future = time.time() + 5
        os.utime(target, (future, future))
        ir_b = parse_musicxml(str(target))
        # 小節數差很多 → 證明第二次沒回傳舊快取
        assert ir_a.movements[0].measure_count != ir_b.movements[0].measure_count

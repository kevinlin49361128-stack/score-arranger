"""
IR → music21 stream 轉換

對應 parser.py 的反向操作。用於:
- 匯出 MusicXML (透過 music21 的 m21ToXml exporter)
- 互通其他 music21 工具 (e.g. SoundFont 播放、和聲分析)

Phase 1 範圍:
- Note, Chord, Rest
- 時值 (含 Tuplet)
- Articulations、Dynamics、Ties、Slurs
- Time/Key signature、Tempo、Barlines、Rehearsal marks

Phase 2 留 TODO:
- Hairpins (cresc./dim. 範圍)
- Ornaments 展開
- Repeats (Volta, Coda, Segno, D.C.)
- Pedal marks
"""

from __future__ import annotations

from fractions import Fraction
from typing import Any, Optional

from music21 import (
    articulations,
    chord as m21_chord,
    duration,
    dynamics as m21_dynamics,
    expressions,
    instrument,
    key as m21_key,
    metadata,
    meter,
    note as m21_note,
    spanner,
    stream as m21_stream,
    tempo as m21_tempo,
    tie,
)

from .ir import (
    ChordEvent,
    Measure,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Tuplet,
    Voice,
)


# ============================================================================
# Instrument lookup
# ============================================================================

# 注意: 只列 canonical IDs (見 instruments/canonical.py)。
# 若上游傳入 alias, 由 _make_instrument() 先 normalize 再查表。
_INSTRUMENT_FACTORY: dict[str, type] = {
    "violin": instrument.Violin,
    "viola": instrument.Viola,
    "cello": instrument.Violoncello,
    "double_bass": instrument.Contrabass,
    "piano": instrument.Piano,
    "harpsichord": instrument.Harpsichord,
    "flute": instrument.Flute,
    "oboe": instrument.Oboe,
    "clarinet_bb": instrument.Clarinet,
    "bassoon": instrument.Bassoon,
    "horn_f": instrument.Horn,
    "trumpet_bb": instrument.Trumpet,
    "trombone": instrument.Trombone,
    "tuba": instrument.Tuba,
    "harp": instrument.Harp,
    "timpani": instrument.Timpani,
}


# 每種樂器預設譜號 (依 instrument_id 給 music21 clef factory)
def _default_clef_for(instrument_id: str):
    """傳入 instrument_id, 回傳 music21 Clef 物件 (或 None 不指定)。

    依公認的譜記慣例:
    - cello, double_bass, bassoon, tuba, trombone → 低音譜
    - viola → 中音譜
    - horn → 高音譜 (移調樂器, 譜記實際偏高)
    - 其他預設高音譜 (music21 預設行為)
    """
    from music21 import clef as _clef
    from .instruments import normalize_instrument_id
    table = {
        "cello": _clef.BassClef,
        "double_bass": _clef.Bass8vbClef,
        "bassoon": _clef.BassClef,
        "tuba": _clef.BassClef,
        "trombone": _clef.BassClef,
        "viola": _clef.AltoClef,
    }
    canonical = normalize_instrument_id(instrument_id)
    factory = table.get(canonical)
    return factory() if factory else None


def _make_instrument(instrument_id: str) -> Optional[Any]:
    # 先 normalize 再查 factory, 容忍上游傳入別名
    from .instruments import normalize_instrument_id
    canonical = normalize_instrument_id(instrument_id)
    factory = _INSTRUMENT_FACTORY.get(canonical)
    if factory is not None:
        return factory()
    # Fallback: generic
    return instrument.Instrument(instrumentName=instrument_id)


# ============================================================================
# 主轉換函式
# ============================================================================

def ir_to_music21(score: Score) -> m21_stream.Score:
    """Score → music21 Score。"""
    m21_score = m21_stream.Score()

    # Metadata
    md = metadata.Metadata()
    for key in ("title", "composer", "arranger", "copyright"):
        if key in score.metadata:
            setattr(md, key, score.metadata[key])
    # 同時設 movementName, 避免 OSMD/music21 viewer 用 "Music21 Fragment" 預設值
    if "title" in score.metadata:
        md.movementName = score.metadata["title"]
    m21_score.insert(0, md)

    # Parts
    slur_groups: dict[int, list[m21_note.Note]] = {}
    for part in score.parts:
        m21_part = _build_part(part, slur_groups)
        m21_score.insert(0, m21_part)

    # 將 slur 群組加為 spanner。
    # 先建 note → part 索引 (一次 O(N) 掃描), 再用 id() 查 owner part。
    # 舊作法 (_find_part_containing) 對每條 slur 都全域 recurse 掃描,
    # 是 O(slur 數 × 音符數) — op132 這種上千 slur 的大譜會讓 ir_to_music21
    # 慢到 ~28 秒。索引化後降為 O(N)。
    if slur_groups:
        note_to_part: dict[int, m21_stream.Part] = {}
        for part in m21_score.parts:
            for n in part.recurse().notes:
                note_to_part[id(n)] = part
        for notes in slur_groups.values():
            if len(notes) >= 2:
                owner = note_to_part.get(id(notes[0]))
                if owner is not None:
                    owner.append(spanner.Slur(notes))

    return m21_score


# ============================================================================
# Part / Measure
# ============================================================================

def _build_part(
    part: Part, slur_groups: dict[int, list[m21_note.Note]]
) -> m21_stream.Part:
    m21_part = m21_stream.Part()
    m21_part.partName = part.name_display

    inst = _make_instrument(part.instrument_id)
    if inst is not None:
        m21_part.insert(0, inst)

    # 為樂器設定預設譜號 (e.g. cello → bass clef)
    default_clef = _default_clef_for(part.instrument_id)

    for idx, measure in enumerate(part.measures):
        m21_measure = _build_measure(measure, slur_groups)
        # 在第一小節開頭插入譜號 (若有指定)
        if idx == 0 and default_clef is not None:
            m21_measure.insert(0, default_clef)
        m21_part.append(m21_measure)

    return m21_part


def _build_measure(
    measure: Measure, slur_groups: dict[int, list[m21_note.Note]]
) -> m21_stream.Measure:
    m = m21_stream.Measure(number=measure.number)

    # 拍號 / 調號
    if measure.time_signature is not None:
        num, denom = measure.time_signature
        m.insert(0, meter.TimeSignature(f"{num}/{denom}"))
    if measure.key_signature is not None:
        ks = _parse_key_signature(measure.key_signature)
        if ks is not None:
            m.insert(0, ks)

    # 速度
    if measure.tempo_bpm is not None or measure.tempo_text is not None:
        mm = m21_tempo.MetronomeMark(
            number=measure.tempo_bpm,
            text=measure.tempo_text,
        )
        m.insert(0, mm)

    # 排練記號
    if measure.rehearsal_mark is not None:
        m.insert(0, expressions.RehearsalMark(measure.rehearsal_mark))

    # 條線
    if measure.barline_right in ("double", "final"):
        from music21 import bar
        bl = bar.Barline()
        bl.type = (
            "final" if measure.barline_right == "final" else "double"
        )
        m.rightBarline = bl

    # Voices
    voices = list(measure.voices.values())
    if len(voices) == 1 and not voices[0].is_divisi:
        # 單聲部: 直接 append 到 measure
        prev_dynamic: Optional[str] = None
        for event in voices[0].events:
            obj = _build_event(event, slur_groups)
            if obj is None:
                continue
            # 力度變化插入 Dynamic
            if hasattr(event, "dynamic") and event.dynamic and \
                    event.dynamic != prev_dynamic:
                m.insert(float(event.onset), m21_dynamics.Dynamic(event.dynamic))
                prev_dynamic = event.dynamic
            m.insert(float(event.onset), obj)
    else:
        for voice in voices:
            if voice.is_divisi:
                # Phase 1 簡化: 把 divisi 兩個 sub-voice 合併為 chord
                # Phase 2 應正確處理為 voice subdivision
                continue
            v = m21_stream.Voice(id=str(voice.voice_id))
            prev_dynamic = None
            for event in voice.events:
                obj = _build_event(event, slur_groups)
                if obj is None:
                    continue
                if hasattr(event, "dynamic") and event.dynamic and \
                        event.dynamic != prev_dynamic:
                    v.insert(
                        float(event.onset),
                        m21_dynamics.Dynamic(event.dynamic),
                    )
                    prev_dynamic = event.dynamic
                v.insert(float(event.onset), obj)
            m.insert(0, v)

    return m


def _parse_key_signature(name: str) -> Optional[m21_key.KeySignature]:
    """'D major' / 'F# minor' → m21 KeySignature。"""
    if " " not in name:
        return None
    parts = name.split()
    if len(parts) != 2:
        return None
    tonic_raw, mode = parts
    tonic = tonic_raw.replace("b", "-")
    try:
        return m21_key.Key(tonic=tonic, mode=mode)
    except Exception:
        return None


# ============================================================================
# Events
# ============================================================================

def _build_event(
    event: Any, slur_groups: dict[int, list[m21_note.Note]]
) -> Optional[Any]:
    if isinstance(event, NoteEvent):
        return _build_note(event, slur_groups)
    if isinstance(event, ChordEvent):
        return _build_chord(event, slur_groups)
    if isinstance(event, RestEvent):
        return _build_rest(event)
    return None


def _build_note(
    event: NoteEvent, slur_groups: dict[int, list[m21_note.Note]]
) -> m21_note.Note:
    n = m21_note.Note(_spell_for_m21(event.pitch.spelling))
    n.duration = _build_duration(event.duration, event.tuplet)

    _apply_articulations(n, event.articulations)

    if event.is_tied_to and event.is_tied_from:
        n.tie = tie.Tie("continue")
    elif event.is_tied_to:
        n.tie = tie.Tie("start")
    elif event.is_tied_from:
        n.tie = tie.Tie("stop")

    if event.slur_group is not None:
        slur_groups.setdefault(event.slur_group, []).append(n)

    if event.lyric:
        n.addLyric(event.lyric)

    return n


def _build_chord(
    event: ChordEvent, slur_groups: dict[int, list[m21_note.Note]]
) -> m21_chord.Chord:
    pitches = [_spell_for_m21(p.spelling) for p in event.pitches]
    c = m21_chord.Chord(pitches)
    c.duration = _build_duration(event.duration, event.tuplet)

    _apply_articulations(c, event.articulations)

    if event.is_tied_to and event.is_tied_from:
        c.tie = tie.Tie("continue")
    elif event.is_tied_to:
        c.tie = tie.Tie("start")
    elif event.is_tied_from:
        c.tie = tie.Tie("stop")

    if event.slur_group is not None:
        slur_groups.setdefault(event.slur_group, []).append(c)

    return c


def _build_rest(event: RestEvent) -> m21_note.Rest:
    r = m21_note.Rest()
    r.duration = duration.Duration(quarterLength=event.duration)
    if event.fermata:
        r.expressions.append(expressions.Fermata())
    return r


def _build_duration(
    ql: Fraction, tuplet: Optional[Tuplet]
) -> duration.Duration:
    """Fraction 時值 + Tuplet → music21 Duration。"""
    d = duration.Duration(quarterLength=ql)
    if tuplet is not None:
        # music21 需要 normalQuarterLength (Tuplet 內單個音的「標準」時值)
        t = duration.Tuplet(
            numberNotesActual=tuplet.actual,
            numberNotesNormal=tuplet.normal,
        )
        d.appendTuplet(t)
    return d


def _spell_for_m21(spelling: str) -> str:
    """IR 拼寫 'Bb4' → music21 'B-4' (music21 用 '-' 表降)。"""
    return spelling.replace("b", "-")


_ARTICULATION_FACTORY: dict[str, type] = {
    "staccato": articulations.Staccato,
    "staccatissimo": articulations.Staccatissimo,
    "tenuto": articulations.Tenuto,
    "accent": articulations.Accent,
    "marcato": articulations.StrongAccent,
    "pizzicato": articulations.Pizzicato,
    "spiccato": articulations.Spiccato,
    "breath": articulations.BreathMark,
}


def _apply_articulations(obj: Any, names: list[str]) -> None:
    for name in names:
        if name == "fermata":
            obj.expressions.append(expressions.Fermata())
            continue
        factory = _ARTICULATION_FACTORY.get(name)
        if factory is not None:
            obj.articulations.append(factory())

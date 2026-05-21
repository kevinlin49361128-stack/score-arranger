"""
IR → MusicXML 直接序列化器

對應 musicxml_writer.write_musicxml_string 的快速路徑。

為何不走 music21:
  music21 的 m21ToXml 匯出器靠 Stream 逐元素走訪, 對大譜 (1000+ 小節、
  數千音符/slur) 會慢到數十秒 (per-element overhead + spanner O(E×S) 查找)。
  本模組直接把 IR 寫成 MusicXML 字串 (ElementTree), 是 O(events) 線性,
  大譜可從 ~30 秒降到 <1 秒。

涵蓋範圍 (與 ir_to_music21 對齊):
  Note / Chord / Rest、時值 (含 Tuplet 與附點)、Tie、Slur、
  Articulations、Dynamics、Time/Key signature、Clef、Tempo、
  Rehearsal mark、Barline、多聲部 (greedy voice split + backup)、Grace note。

無法安全處理的譜面 → 由 musicxml_writer 回退 music21 路徑 (見該檔)。
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from fractions import Fraction
from math import lcm
from typing import Optional

from .ir import (
    ChordEvent,
    Measure,
    NoteEvent,
    Pitch,
    RestEvent,
    Score,
)

# ============================================================================
# 常數表
# ============================================================================

# 音符 type 名 → 基本時值 (quarterLength)
_BASE_TYPES: list[tuple[str, Fraction]] = [
    ("breve", Fraction(8)),
    ("whole", Fraction(4)),
    ("half", Fraction(2)),
    ("quarter", Fraction(1)),
    ("eighth", Fraction(1, 2)),
    ("16th", Fraction(1, 4)),
    ("32nd", Fraction(1, 8)),
    ("64th", Fraction(1, 16)),
    ("128th", Fraction(1, 32)),
]

# (quarterLength) → (type_name, dots) — 含 0~2 附點
_DURATION_MAP: dict[Fraction, tuple[str, int]] = {}
for _name, _base in _BASE_TYPES:
    for _dots in (0, 1, 2):
        _mult = Fraction(2) - Fraction(1, 2 ** _dots)  # 0→1, 1→3/2, 2→7/4
        _DURATION_MAP[_base * _mult] = (_name, _dots)

# 大調主音 → fifths
_MAJOR_FIFTHS: dict[str, int] = {
    "C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5, "F#": 6, "C#": 7,
    "F": -1, "Bb": -2, "Eb": -3, "Ab": -4, "Db": -5, "Gb": -6, "Cb": -7,
}
# 小調主音 → fifths
_MINOR_FIFTHS: dict[str, int] = {
    "A": 0, "E": 1, "B": 2, "F#": 3, "C#": 4, "G#": 5, "D#": 6, "A#": 7,
    "D": -1, "G": -2, "C": -3, "F": -4, "Bb": -5, "Eb": -6, "Ab": -7,
}

# MusicXML <dynamics> 的合法子元素
_DYNAMIC_ELEMENTS = {
    "p", "pp", "ppp", "pppp", "ppppp", "pppppp",
    "f", "ff", "fff", "ffff", "fffff", "ffffff",
    "mp", "mf", "sf", "sfp", "sfpp", "fp", "rf", "rfz",
    "sfz", "sffz", "fz", "n", "pf", "sfzp",
}

# IR articulation 名 → MusicXML <articulations> 子元素
_ARTICULATION_XML: dict[str, str] = {
    "staccato": "staccato",
    "staccatissimo": "staccatissimo",
    "tenuto": "tenuto",
    "accent": "accent",
    "marcato": "strong-accent",
    "spiccato": "spiccato",
    "breath": "breath-mark",
}

# IR Ornament.kind → MusicXML <ornaments> 子元素
_ORNAMENT_XML: dict[str, str] = {
    "trill": "trill-mark",
    "mordent": "mordent",
    "inverted_mordent": "inverted-mordent",
    "turn": "turn",
    "inverted_turn": "inverted-turn",
    "tremolo": "tremolo",
}

# instrument_id → clef (sign, line, octave-change)
_CLEF_TABLE: dict[str, tuple[str, int, int]] = {
    "cello": ("F", 4, 0),
    "double_bass": ("F", 4, -1),
    "bassoon": ("F", 4, 0),
    "tuba": ("F", 4, 0),
    "trombone": ("F", 4, 0),
    "viola": ("C", 3, 0),
}

# MIDI pitch class → (step, alter) — 黑鍵一律用升記號
_MIDI_PC: list[tuple[str, int]] = [
    ("C", 0), ("C", 1), ("D", 0), ("D", 1), ("E", 0), ("F", 0),
    ("F", 1), ("G", 0), ("G", 1), ("A", 0), ("A", 1), ("B", 0),
]

_SPELLING_RE = re.compile(r"^([A-Ga-g])([#b]*)(-?\d+)$")


# ============================================================================
# 主入口
# ============================================================================

def score_to_musicxml(score: Score) -> str:
    """IR Score → MusicXML (score-partwise) 字串。"""
    divisions = _compute_divisions(score)

    root = ET.Element("score-partwise", version="4.0")
    _build_header(root, score)

    # part-list
    part_list = ET.SubElement(root, "part-list")
    for idx, part in enumerate(score.parts):
        sp = ET.SubElement(part_list, "score-part", id=f"P{idx + 1}")
        ET.SubElement(sp, "part-name").text = part.name_display or part.part_id

    # 漸強/漸弱 (DynamicHairpin) → {part_id: {小節: [(offset, type)]}}
    hairpin_index = _index_hairpins(score)

    # parts
    for idx, part in enumerate(score.parts):
        _build_part(
            root, part, idx, divisions,
            hairpin_index.get(part.part_id, {}),
        )

    xml_body = ET.tostring(root, encoding="unicode")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE score-partwise PUBLIC '
        '"-//Recordare//DTD MusicXML 4.0 Partwise//EN" '
        '"http://www.musicxml.org/dtds/partwise.dtd">\n'
        + xml_body
    )


# ============================================================================
# Header / metadata
# ============================================================================

def _build_header(root: ET.Element, score: Score) -> None:
    md = score.metadata or {}
    title = md.get("title")
    if title:
        work = ET.SubElement(root, "work")
        ET.SubElement(work, "work-title").text = title

    ident = ET.SubElement(root, "identification")
    if md.get("composer"):
        ET.SubElement(
            ident, "creator", type="composer",
        ).text = md["composer"]
    if md.get("arranger"):
        ET.SubElement(
            ident, "creator", type="arranger",
        ).text = md["arranger"]
    if md.get("copyright"):
        ET.SubElement(ident, "rights").text = md["copyright"]
    encoding = ET.SubElement(ident, "encoding")
    ET.SubElement(encoding, "software").text = "Score Arranger"


# ============================================================================
# divisions — 讓所有時值/onset 都能化為整數
# ============================================================================

def _compute_divisions(score: Score) -> int:
    """divisions = 所有時值與 onset 分母的 LCM (上限保護)。"""
    denoms: set[int] = {1}
    for part in score.parts:
        for measure in part.measures:
            for voice in measure.voices.values():
                if voice.is_divisi:
                    continue
                for ev in voice.events:
                    for frac in (
                        Fraction(ev.duration), Fraction(ev.onset),
                    ):
                        denoms.add(frac.denominator)
                    tup = getattr(ev, "tuplet", None)
                    if tup is not None:
                        denoms.add(tup.normal)
    result = 1
    for d in denoms:
        result = lcm(result, d)
        if result > 100_000:  # 病態 tuplet 保護
            return 100_000
    return result


def _index_hairpins(
    score: Score,
) -> dict[str, dict[int, list[tuple[Fraction, str]]]]:
    """DynamicHairpin → {part_id: {小節: [(offset_ql, wedge_type), ...]}}。

    每條 hairpin 拆成「起點 (crescendo/diminuendo)」與「終點 (stop)」兩個標記。
    """
    index: dict[str, dict[int, list[tuple[Fraction, str]]]] = {}
    for hp in score.hairpins:
        pid = hp.part_id
        if not pid or hp.kind not in ("crescendo", "diminuendo"):
            continue
        per_measure = index.setdefault(pid, {})
        s_m, s_off = hp.start
        e_m, e_off = hp.end
        per_measure.setdefault(s_m, []).append((Fraction(s_off), hp.kind))
        per_measure.setdefault(e_m, []).append((Fraction(e_off), "stop"))
    for per_measure in index.values():
        for marks in per_measure.values():
            marks.sort(key=lambda t: t[0])
    return index


# ============================================================================
# Part / Measure
# ============================================================================

def _build_part(
    root: ET.Element, part, part_index: int, divisions: int,
    wedge_measures: dict[int, list[tuple[Fraction, str]]],
) -> None:
    part_el = ET.SubElement(root, "part", id=f"P{part_index + 1}")
    clef = _CLEF_TABLE.get(part.instrument_id, ("G", 2, 0))

    cur_time_sig: tuple[int, int] = (4, 4)
    first = True
    for measure in part.measures:
        if measure.time_signature is not None:
            cur_time_sig = measure.time_signature
        _build_measure(
            part_el, measure, divisions, cur_time_sig,
            clef if first else None, first,
            wedge_measures.get(measure.number, []),
        )
        first = False


def _build_measure(
    part_el: ET.Element,
    measure: Measure,
    divisions: int,
    time_sig: tuple[int, int],
    clef: Optional[tuple[str, int, int]],
    is_first: bool,
    wedges: list[tuple[Fraction, str]],
) -> None:
    m_el = ET.SubElement(part_el, "measure", number=str(measure.number))

    # <attributes> — 第一小節, 或拍號/調號變更時
    need_attr = is_first or (
        measure.time_signature is not None
        or measure.key_signature is not None
    )
    if need_attr:
        attr = ET.Element("attributes")
        if is_first:
            ET.SubElement(attr, "divisions").text = str(divisions)
        if measure.key_signature is not None or is_first:
            fifths, mode = _key_to_fifths(measure.key_signature)
            key_el = ET.SubElement(attr, "key")
            ET.SubElement(key_el, "fifths").text = str(fifths)
            if mode:
                ET.SubElement(key_el, "mode").text = mode
        if measure.time_signature is not None or is_first:
            time_el = ET.SubElement(attr, "time")
            ET.SubElement(time_el, "beats").text = str(time_sig[0])
            ET.SubElement(time_el, "beat-type").text = str(time_sig[1])
        if clef is not None:
            sign, line, oct_change = clef
            clef_el = ET.SubElement(attr, "clef")
            ET.SubElement(clef_el, "sign").text = sign
            ET.SubElement(clef_el, "line").text = str(line)
            if oct_change:
                ET.SubElement(
                    clef_el, "clef-octave-change",
                ).text = str(oct_change)
        if len(attr):
            m_el.append(attr)

    # 速度 / 排練記號 (measure 起點)
    if measure.tempo_bpm is not None or measure.tempo_text is not None:
        _append_tempo(m_el, measure)
    if measure.rehearsal_mark is not None:
        _append_rehearsal(m_el, measure.rehearsal_mark)

    # 漸強/漸弱記號 (wedge) — 以 <offset> 標出在小節內的位置
    for (offset_ql, wtype) in wedges:
        _append_wedge(m_el, wtype, offset_ql, divisions)

    # 收集事件 → greedy 切成不重疊的 MusicXML 聲部
    events = _collect_events(measure)
    measure_ql = Fraction(time_sig[0] * 4, time_sig[1])
    voices = _split_voices(events)

    if not voices:
        # 空小節 → 整小節休止
        _append_full_measure_rest(m_el, divisions, measure_ql)
    else:
        for vi, vevents in enumerate(voices):
            if vi > 0:
                # 退回小節開頭, 換下一聲部
                _append_backup(m_el, divisions, measure_ql)
            _emit_voice(
                m_el, vevents, vi + 1, divisions, measure_ql,
            )

    # 條線
    _append_barlines(m_el, measure)


# ============================================================================
# 事件收集 + 聲部切割
# ============================================================================

def _collect_events(measure: Measure) -> list:
    """把小節內所有非 divisi 聲部的事件併成一串, 依 onset 排序。"""
    out: list = []
    for voice in measure.voices.values():
        if voice.is_divisi:
            continue
        out.extend(voice.events)
    out.sort(key=lambda e: (Fraction(e.onset), Fraction(e.duration)))
    return out


def _split_voices(events: list) -> list[list]:
    """Greedy interval partition: 把重疊事件分到不同 MusicXML 聲部。"""
    voices: list[list] = []
    ends: list[Fraction] = []
    for ev in events:
        onset = Fraction(ev.onset)
        placed = False
        for i, end in enumerate(ends):
            if onset >= end:
                voices[i].append(ev)
                ends[i] = onset + Fraction(ev.duration)
                placed = True
                break
        if not placed:
            voices.append([ev])
            ends.append(onset + Fraction(ev.duration))
    return voices


# ============================================================================
# 單一聲部輸出
# ============================================================================

def _emit_voice(
    m_el: ET.Element,
    events: list,
    voice_num: int,
    divisions: int,
    measure_ql: Fraction,
) -> None:
    cursor = Fraction(0)
    prev_dynamic: Optional[str] = None
    # tuplet bracket: bracket_id → (first_event, last_event)
    open_slurs: dict[int, int] = {}  # slur_group → slur number
    slur_first, slur_last = _slur_bounds(events)
    tup_first, tup_last = _tuplet_bounds(events)

    for idx, ev in enumerate(events):
        onset = Fraction(ev.onset)
        # onset 之前的空隙 → 補休止
        if onset > cursor:
            _append_rest(
                m_el, onset - cursor, voice_num, divisions,
            )
            cursor = onset

        if isinstance(ev, RestEvent):
            _append_rest(
                m_el, Fraction(ev.duration), voice_num, divisions,
                fermata=ev.fermata,
            )
        else:
            dyn = getattr(ev, "dynamic", None)
            if dyn and dyn != prev_dynamic:
                _append_dynamic(m_el, dyn)
                prev_dynamic = dyn
            _append_note_event(
                m_el, ev, idx, voice_num, divisions,
                open_slurs, slur_first, slur_last,
                tup_first, tup_last,
            )
        cursor += Fraction(ev.duration)

    # 聲部尾端若不足整小節 → 補休止 (讓 backup 對齊)
    if cursor < measure_ql:
        _append_rest(m_el, measure_ql - cursor, voice_num, divisions)


def _slur_bounds(events: list) -> tuple[dict[int, int], dict[int, int]]:
    """slur_group → 首/末事件 index。"""
    first: dict[int, int] = {}
    last: dict[int, int] = {}
    for i, ev in enumerate(events):
        sg = getattr(ev, "slur_group", None)
        if sg is None:
            continue
        if sg not in first:
            first[sg] = i
        last[sg] = i
    return first, last


def _tuplet_bounds(events: list) -> tuple[dict[int, int], dict[int, int]]:
    """tuplet bracket_id → 首/末事件 index。"""
    first: dict[int, int] = {}
    last: dict[int, int] = {}
    for i, ev in enumerate(events):
        tup = getattr(ev, "tuplet", None)
        if tup is None:
            continue
        bid = tup.bracket_id
        if bid not in first:
            first[bid] = i
        last[bid] = i
    return first, last


# ============================================================================
# <note> 系列
# ============================================================================

def _append_note_event(
    m_el: ET.Element,
    ev,
    idx: int,
    voice_num: int,
    divisions: int,
    open_slurs: dict[int, int],
    slur_first: dict[int, int],
    slur_last: dict[int, int],
    tup_first: dict[int, int],
    tup_last: dict[int, int],
) -> None:
    pitches = (
        ev.pitches if isinstance(ev, ChordEvent) else [ev.pitch]
    )
    dur_units = _dur_units(ev.duration, divisions)
    type_name, dots = _note_type(ev.duration, getattr(ev, "tuplet", None))

    # grace notes (主音前)
    for grace in getattr(ev, "grace_before", []) or []:
        _append_grace(m_el, grace, voice_num)

    for ci, pitch in enumerate(pitches):
        note = ET.SubElement(m_el, "note")
        if ci > 0:
            ET.SubElement(note, "chord")
        _append_pitch(note, pitch)
        ET.SubElement(note, "duration").text = str(dur_units)
        # tie (發聲) — 只在第一個 pitch 之後皆同
        if ev.is_tied_from:
            ET.SubElement(note, "tie", type="stop")
        if ev.is_tied_to:
            ET.SubElement(note, "tie", type="start")
        ET.SubElement(note, "voice").text = str(voice_num)
        if type_name:
            ET.SubElement(note, "type").text = type_name
        for _ in range(dots):
            ET.SubElement(note, "dot")
        tup = getattr(ev, "tuplet", None)
        if tup is not None:
            tm = ET.SubElement(note, "time-modification")
            ET.SubElement(tm, "actual-notes").text = str(tup.actual)
            ET.SubElement(tm, "normal-notes").text = str(tup.normal)
        # notations 只掛在和弦的第一個音
        if ci == 0:
            _append_notations(
                note, ev, idx, open_slurs,
                slur_first, slur_last, tup_first, tup_last,
            )
        # 歌詞
        lyric = getattr(ev, "lyric", None)
        if lyric and ci == 0:
            ly = ET.SubElement(note, "lyric")
            ET.SubElement(ly, "text").text = lyric


def _append_notations(
    note: ET.Element,
    ev,
    idx: int,
    open_slurs: dict[int, int],
    slur_first: dict[int, int],
    slur_last: dict[int, int],
    tup_first: dict[int, int],
    tup_last: dict[int, int],
) -> None:
    notations = ET.Element("notations")

    # tied (記號)
    if ev.is_tied_from:
        ET.SubElement(notations, "tied", type="stop")
    if ev.is_tied_to:
        ET.SubElement(notations, "tied", type="start")

    # slur
    sg = getattr(ev, "slur_group", None)
    if sg is not None:
        if slur_first.get(sg) == idx and slur_last.get(sg) != idx:
            num = _alloc_slur(open_slurs)
            open_slurs[sg] = num
            ET.SubElement(
                notations, "slur", type="start", number=str(num),
            )
        elif slur_last.get(sg) == idx and slur_first.get(sg) != idx:
            num = open_slurs.pop(sg, 1)
            ET.SubElement(
                notations, "slur", type="stop", number=str(num),
            )

    # tuplet 括號
    tup = getattr(ev, "tuplet", None)
    if tup is not None:
        bid = tup.bracket_id
        if tup_first.get(bid) == idx:
            ET.SubElement(notations, "tuplet", type="start")
        elif tup_last.get(bid) == idx:
            ET.SubElement(notations, "tuplet", type="stop")

    # ornaments (trill / mordent / turn ...)
    ornament = getattr(ev, "ornament", None)
    if ornament is not None:
        orn_tag = _ORNAMENT_XML.get(ornament.kind)
        if orn_tag is not None:
            orn_el = ET.SubElement(notations, "ornaments")
            ET.SubElement(orn_el, orn_tag)

    # articulations / fermata
    arts = list(getattr(ev, "articulations", []) or [])
    art_xml = [
        _ARTICULATION_XML[a] for a in arts if a in _ARTICULATION_XML
    ]
    if art_xml:
        art_el = ET.SubElement(notations, "articulations")
        for tag in art_xml:
            ET.SubElement(art_el, tag)
    if "fermata" in arts:
        ET.SubElement(notations, "fermata")

    if len(notations):
        note.append(notations)


def _alloc_slur(open_slurs: dict[int, int]) -> int:
    """配一個目前沒被佔用的 slur number (1-6 循環)。"""
    used = set(open_slurs.values())
    for n in range(1, 7):
        if n not in used:
            return n
    return 1


def _append_pitch(note: ET.Element, pitch: Pitch) -> None:
    step, alter, octave = _pitch_parts(pitch)
    p_el = ET.SubElement(note, "pitch")
    ET.SubElement(p_el, "step").text = step
    if alter:
        ET.SubElement(p_el, "alter").text = str(alter)
    ET.SubElement(p_el, "octave").text = str(octave)


def _append_grace(m_el: ET.Element, grace, voice_num: int) -> None:
    note = ET.SubElement(m_el, "note")
    ET.SubElement(note, "grace")
    _append_pitch(note, grace.pitch)
    ET.SubElement(note, "voice").text = str(voice_num)
    ET.SubElement(note, "type").text = "eighth"


def _append_rest(
    m_el: ET.Element,
    ql: Fraction,
    voice_num: int,
    divisions: int,
    fermata: bool = False,
) -> None:
    note = ET.SubElement(m_el, "note")
    ET.SubElement(note, "rest")
    ET.SubElement(note, "duration").text = str(_dur_units(ql, divisions))
    ET.SubElement(note, "voice").text = str(voice_num)
    type_name, dots = _note_type(ql, None)
    if type_name:
        ET.SubElement(note, "type").text = type_name
        for _ in range(dots):
            ET.SubElement(note, "dot")
    if fermata:
        notations = ET.SubElement(note, "notations")
        ET.SubElement(notations, "fermata")


def _append_full_measure_rest(
    m_el: ET.Element, divisions: int, measure_ql: Fraction,
) -> None:
    note = ET.SubElement(m_el, "note")
    ET.SubElement(note, "rest", measure="yes")
    ET.SubElement(note, "duration").text = str(
        _dur_units(measure_ql, divisions),
    )
    ET.SubElement(note, "voice").text = "1"


def _append_backup(
    m_el: ET.Element, divisions: int, ql: Fraction,
) -> None:
    backup = ET.SubElement(m_el, "backup")
    ET.SubElement(backup, "duration").text = str(_dur_units(ql, divisions))


# ============================================================================
# Direction (dynamics / tempo / rehearsal)
# ============================================================================

def _append_dynamic(m_el: ET.Element, dyn: str) -> None:
    direction = ET.SubElement(m_el, "direction", placement="below")
    dtype = ET.SubElement(direction, "direction-type")
    dyn_el = ET.SubElement(dtype, "dynamics")
    if dyn in _DYNAMIC_ELEMENTS:
        ET.SubElement(dyn_el, dyn)
    else:
        ET.SubElement(dyn_el, "other-dynamics").text = dyn


def _append_tempo(m_el: ET.Element, measure: Measure) -> None:
    direction = ET.SubElement(m_el, "direction", placement="above")
    dtype = ET.SubElement(direction, "direction-type")
    if measure.tempo_text:
        ET.SubElement(dtype, "words").text = measure.tempo_text
    if measure.tempo_bpm is not None:
        ET.SubElement(
            direction, "sound", tempo=str(round(measure.tempo_bpm, 2)),
        )


def _append_rehearsal(m_el: ET.Element, mark: str) -> None:
    direction = ET.SubElement(m_el, "direction", placement="above")
    dtype = ET.SubElement(direction, "direction-type")
    ET.SubElement(dtype, "rehearsal").text = mark


def _append_wedge(
    m_el: ET.Element, wtype: str, offset_ql: Fraction, divisions: int,
) -> None:
    """漸強/漸弱記號 — <direction> 內含 <wedge>, 以 <offset> 定位。"""
    direction = ET.SubElement(m_el, "direction", placement="below")
    dtype = ET.SubElement(direction, "direction-type")
    ET.SubElement(dtype, "wedge", type=wtype, number="1")
    off = int(Fraction(offset_ql) * divisions)
    if off:
        ET.SubElement(direction, "offset").text = str(off)


def _append_barlines(m_el: ET.Element, measure: Measure) -> None:
    left = measure.barline_left
    right = measure.barline_right
    if left == "repeat_start":
        bl = ET.SubElement(m_el, "barline", location="left")
        ET.SubElement(bl, "bar-style").text = "heavy-light"
        ET.SubElement(bl, "repeat", direction="forward")
    if right in ("double", "final", "repeat_end"):
        bl = ET.SubElement(m_el, "barline", location="right")
        style = {
            "double": "light-light",
            "final": "light-heavy",
            "repeat_end": "light-heavy",
        }[right]
        ET.SubElement(bl, "bar-style").text = style
        if right == "repeat_end":
            ET.SubElement(bl, "repeat", direction="backward")


# ============================================================================
# 小工具
# ============================================================================

def _dur_units(ql, divisions: int) -> int:
    """quarterLength → MusicXML <duration> 整數單位。"""
    frac = Fraction(ql) * divisions
    return max(1, round(frac))


def _note_type(
    ql, tuplet,
) -> tuple[str, int]:
    """時值 → (type 名, 附點數)。tuplet 時換算回視覺時值。"""
    display = Fraction(ql)
    if tuplet is not None and tuplet.actual > 0:
        display = display * tuplet.actual / tuplet.normal
    hit = _DURATION_MAP.get(display)
    if hit is not None:
        return hit
    # 不是標準時值 → 取最接近的 (timing 仍由 <duration> 保證精準)
    best_name, best_dots, best_diff = "", 0, None
    for key_ql, (name, dots) in _DURATION_MAP.items():
        diff = abs(key_ql - display)
        if best_diff is None or diff < best_diff:
            best_diff, best_name, best_dots = diff, name, dots
    return best_name, best_dots


def _pitch_parts(pitch: Pitch) -> tuple[str, int, int]:
    """Pitch → (step, alter, octave)。優先用 spelling, 失敗用 midi。"""
    spelling = (pitch.spelling or "").strip()
    m = _SPELLING_RE.match(spelling)
    if m:
        step = m.group(1).upper()
        accs = m.group(2)
        octave = int(m.group(3))
        alter = accs.count("#") - accs.count("b")
        return step, alter, octave
    # fallback: 從 midi_number 推
    midi = pitch.midi_number
    step, alter = _MIDI_PC[midi % 12]
    octave = midi // 12 - 1
    return step, alter, octave


def _key_to_fifths(name: Optional[str]) -> tuple[int, Optional[str]]:
    """'D major' / 'F# minor' → (fifths, mode)。預設 C major。"""
    if not name or " " not in name:
        return 0, "major"
    tonic, _, mode = name.partition(" ")
    mode = mode.strip().lower()
    tonic = tonic.strip()
    if mode == "minor":
        return _MINOR_FIFTHS.get(tonic, 0), "minor"
    if mode == "major":
        return _MAJOR_FIFTHS.get(tonic, 0), "major"
    # 其他調式: 用大調表近似, 不輸出 mode
    return _MAJOR_FIFTHS.get(tonic, 0), None

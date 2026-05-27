"""
MusicXML 補充解析器 — 補回 music21 在 import 時丟掉的記譜元素。

music21 的 MusicXML reader 會整個丟棄 `<wedge>` (漸強/漸弱) 與部分
`<ornaments>` (顫音等), 導致 IR 拿不到這些資訊 (實測一首 op18 有 1800+
個 wedge, music21 解析後得到 0 個 Crescendo)。

本模組繞過 music21, 用 ElementTree 直接掃原始 MusicXML, 只抽取 music21
漏掉的元素, 再「補」回既有的 IR Score (parse_stream 的產物):

  <wedge>          → Score.hairpins (DynamicHairpin)
  <ornaments> 子項 → NoteEvent.ornament (Ornament)

對齊方式: <part> 依序對 IR part; <measure number> 對 IR measure.number;
小節內累計 <duration> (divisions) 算出 onset, 與 IR 事件的 onset 比對。

任何失敗都靜默跳過 — 補充解析不可影響主解析流程。
"""

from __future__ import annotations

import os
import xml.etree.ElementTree as ET
import zipfile
from fractions import Fraction
from typing import Optional

from .ir import (
    ChordEvent,
    DynamicHairpin,
    NoteEvent,
    Ornament,
    Score,
)

# <step> → semitone (C 基準)
_STEP_SEMITONE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

# MusicXML ornaments 子元素 tag → IR Ornament.kind
_ORNAMENT_KIND = {
    "trill-mark": "trill",
    "mordent": "mordent",
    "inverted-mordent": "inverted_mordent",
    "turn": "turn",
    "inverted-turn": "inverted_turn",
    "delayed-turn": "turn",
    "tremolo": "tremolo",
}


def enrich_score(score: Score, path: str) -> None:
    """從原始 MusicXML 補回 hairpin / ornament 到既有 IR (就地修改)。"""
    root = _get_musicxml_root(path)
    if root is None or root.tag != "score-partwise":
        return

    parts_xml = root.findall("part")
    for pi, part_xml in enumerate(parts_xml):
        if pi >= len(score.parts):
            break
        _enrich_part(score, score.parts[pi], part_xml)


# ============================================================================
# 取得原始 XML 樹
# ============================================================================

def _get_musicxml_root(path: str) -> Optional[ET.Element]:
    """把各種來源路徑解析成 ElementTree root; 非 MusicXML → None。"""
    real = path
    if path.startswith("corpus:"):
        from .samples import resolve as resolve_sample
        resolved = resolve_sample(path[len("corpus:"):])
        if resolved is None:
            return None
        real = str(resolved)
    low = real.lower()
    try:
        if low.endswith(".mxl"):
            with zipfile.ZipFile(real) as zf:
                cand = [
                    n for n in zf.namelist()
                    if n.lower().endswith((".xml", ".musicxml"))
                    and "META-INF" not in n
                ]
                if not cand:
                    return None
                return ET.fromstring(zf.read(cand[0]))
        if low.endswith((".xml", ".musicxml")) and os.path.exists(real):
            return ET.parse(real).getroot()
    except Exception:
        return None
    return None


# ============================================================================
# 單一 part 的補充
# ============================================================================

def _enrich_part(score: Score, ir_part, part_xml: ET.Element) -> None:
    # IR 事件索引: measure_number → [(onset, midi, NoteEvent), ...]
    note_index = _build_note_index(ir_part)

    divisions = 1
    # wedge 開合配對: 收集所有 (measure, onset, type)
    wedge_marks: list[tuple[int, Fraction, str]] = []

    # 0.1.50 E2.MVP: 收集 figured-bass 元素, 之後寫回 ir_part.measures
    # measure_num → onset (Fraction) → "5/3" / "6" / "6/4" / "7"
    figured_collected: dict[int, dict[Fraction, str]] = {}

    for measure_xml in part_xml.findall("measure"):
        try:
            measure_num = int(measure_xml.get("number", "0"))
        except ValueError:
            continue
        cursor = 0  # divisions 單位
        for child in measure_xml:
            tag = child.tag
            if tag == "attributes":
                d = child.findtext("divisions")
                if d:
                    try:
                        divisions = max(1, int(d))
                    except ValueError:
                        pass
            elif tag == "note":
                is_chord = child.find("chord") is not None
                is_grace = child.find("grace") is not None
                onset = Fraction(cursor, divisions)
                # ornament → 掛到對應 IR 音符
                orn_kind = _read_ornament(child)
                if orn_kind is not None and not is_grace:
                    midi = _note_midi(child)
                    _attach_ornament(
                        note_index, measure_num, onset, midi, orn_kind,
                    )
                # 推進 cursor (chord 成員與 grace 不推進)
                if not is_chord and not is_grace:
                    cursor += _int_text(child.findtext("duration"))
            elif tag == "backup":
                cursor -= _int_text(child.findtext("duration"))
            elif tag == "forward":
                cursor += _int_text(child.findtext("duration"))
            elif tag == "direction":
                off = _int_text(child.findtext("offset"))
                for wedge in child.findall("direction-type/wedge"):
                    wtype = wedge.get("type", "")
                    if wtype:
                        wedge_marks.append((
                            measure_num,
                            Fraction(cursor + off, divisions),
                            wtype,
                        ))
            elif tag == "figured-bass":
                figure_str = _parse_figured_bass(child)
                if figure_str:
                    onset = Fraction(cursor, divisions)
                    figured_collected.setdefault(measure_num, {})[onset] = figure_str

    _build_hairpins(score, ir_part.part_id, wedge_marks)

    # 寫回 figured-bass — 找對應 measure 並 merge
    if figured_collected:
        for measure in ir_part.measures:
            collected = figured_collected.get(measure.number)
            if collected:
                measure.figured_bass.update(collected)


def _parse_figured_bass(el: ET.Element) -> Optional[str]:
    """從 <figured-bass> XML 解析成 IR 字串. 多個 <figure> → 用 / 連接.

    Examples:
      <figured-bass><figure><figure-number>6</figure-number></figure>
                    <figure><figure-number>4</figure-number></figure></figured-bass>
      → "6/4"
      <figured-bass><figure><figure-number>7</figure-number></figure></figured-bass>
      → "7"
    """
    numbers: list[str] = []
    for fig in el.findall("figure"):
        n = fig.findtext("figure-number")
        prefix = fig.findtext("prefix") or ""  # "sharp", "flat", "natural"
        suffix = fig.findtext("suffix") or ""
        if n is None:
            continue
        sign = ""
        if prefix == "flat":
            sign = "b"
        elif prefix == "sharp":
            sign = "#"
        elif prefix == "natural":
            sign = "n"
        token = f"{sign}{n}{suffix}"
        numbers.append(token)
    if not numbers:
        return None
    return "/".join(numbers)


def _build_note_index(ir_part) -> dict[int, list[tuple[Fraction, int, object]]]:
    """measure_number → [(onset, 代表 midi, event), ...] 供 ornament 對齊。"""
    index: dict[int, list[tuple[Fraction, int, object]]] = {}
    for measure in ir_part.measures:
        entries: list[tuple[Fraction, int, object]] = []
        for voice in measure.voices.values():
            if voice.is_divisi:
                continue
            for ev in voice.events:
                if isinstance(ev, NoteEvent):
                    entries.append(
                        (Fraction(ev.onset), ev.pitch.midi_number, ev),
                    )
                elif isinstance(ev, ChordEvent):
                    top = max(p.midi_number for p in ev.pitches)
                    entries.append((Fraction(ev.onset), top, ev))
        index[measure.number] = entries
    return index


def _attach_ornament(
    note_index: dict[int, list[tuple[Fraction, int, object]]],
    measure_num: int,
    onset: Fraction,
    midi: Optional[int],
    kind: str,
) -> None:
    """把 ornament 掛到 (measure, onset, midi) 對應的 IR 事件。"""
    entries = note_index.get(measure_num)
    if not entries:
        return
    # 先比對 onset + midi; 找不到再只比對 onset
    best = None
    for (ev_onset, ev_midi, ev) in entries:
        if ev_onset != onset:
            continue
        if midi is not None and ev_midi == midi:
            best = ev
            break
        if best is None:
            best = ev
    if best is not None and hasattr(best, "ornament"):
        if best.ornament is None:
            best.ornament = Ornament(kind=kind)  # type: ignore[arg-type]


def _build_hairpins(
    score: Score,
    part_id: str,
    wedge_marks: list[tuple[int, Fraction, str]],
) -> None:
    """把 wedge 的 crescendo/diminuendo + stop 配成 DynamicHairpin。"""
    open_wedge: Optional[tuple[int, Fraction, str]] = None
    next_id = len(score.hairpins)
    for (measure, onset, wtype) in wedge_marks:
        if wtype in ("crescendo", "diminuendo"):
            open_wedge = (measure, onset, wtype)
        elif wtype == "stop" and open_wedge is not None:
            sm, so, kind = open_wedge
            score.hairpins.append(DynamicHairpin(
                hairpin_id=next_id,
                start=(sm, so),
                end=(measure, onset),
                kind=kind,  # type: ignore[arg-type]
                part_id=part_id,
            ))
            next_id += 1
            open_wedge = None


# ============================================================================
# 小工具
# ============================================================================

def _int_text(text: Optional[str]) -> int:
    if not text:
        return 0
    try:
        return int(text)
    except ValueError:
        return 0


def _read_ornament(note_xml: ET.Element) -> Optional[str]:
    """讀 <note> 的第一個 ornament, 回傳 IR kind; 無 → None。"""
    orn = note_xml.find("notations/ornaments")
    if orn is None:
        return None
    for child in orn:
        kind = _ORNAMENT_KIND.get(child.tag)
        if kind is not None:
            return kind
    return None


def _note_midi(note_xml: ET.Element) -> Optional[int]:
    """從 <note><pitch> 算 MIDI; 休止符/無音高 → None。"""
    pitch = note_xml.find("pitch")
    if pitch is None:
        return None
    step = (pitch.findtext("step") or "").strip().upper()
    if step not in _STEP_SEMITONE:
        return None
    alter = _int_text(pitch.findtext("alter"))
    octave = _int_text(pitch.findtext("octave"))
    return _STEP_SEMITONE[step] + alter + (octave + 1) * 12

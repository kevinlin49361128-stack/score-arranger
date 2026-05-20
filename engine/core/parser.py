"""
Score Parser — MusicXML / music21 stream → IR

對應規格書: docs/ir-spec.md §4 (music21 → IR 對應表)

Phase 1 範圍:
- Note, Chord (含單音 Chord → NoteEvent 轉換), Rest
- TimeSignature, KeySignature, MetronomeMark
- Articulations (staccato, accent, tenuto, fermata, marcato, pizzicato 等)
- Dynamics (傳遞給後續音符)
- Ties, Slurs
- Tuplet (bracket_id 同群組)
- Barlines (double, final, repeat)
- Grace notes (附加到後續主音符的 grace_before)
- Rehearsal marks

Phase 2 範圍 (留 TODO):
- Ornaments (Trill 等及其展開)
- Hairpins (crescendo/diminuendo 範圍)
- Pedal marks
- Repeat structures (Coda, Segno, D.C.)
- 移調樂器 (concert pitch 與 written pitch 分離)
- Divisi
"""

from __future__ import annotations

import copy
import os
import sys
from collections import OrderedDict
from fractions import Fraction
from typing import Any, Optional

from music21 import (
    chord as m21_chord,
    converter,
    dynamics as m21_dynamics,
    key as m21_key,
    meter,
    note as m21_note,
    spanner,
    stream as m21_stream,
    tempo as m21_tempo,
)

from .ir import (
    ChordEvent,
    GraceNote,
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Tuplet,
    Voice,
)


# ============================================================================
# Instrument name → canonical ID
# ============================================================================
#
# 統一走 instruments.normalize_instrument_id, 不再保留各自的對照表。
# 過去 _INSTRUMENT_ID_MAP 與 registry/ensemble 的命名不一致, 已合併到
# core/instruments/canonical.py。

from core.instruments import normalize_instrument_id  # noqa: E402

# music21 在某些 corpus 作品 (e.g. Bach 聖詠) 用 generic Instrument,
# instrumentName 形如 "Instrument 1" 而 partName 才是 "Soprano"。
# 此 pattern 判斷 instrumentName 是否為 generic placeholder。
_GENERIC_INSTRUMENT_PATTERNS = [
    "Instrument ",
    "Part ",
]


def _is_generic_instrument_name(name: str | None) -> bool:
    if not name:
        return True
    return any(name.startswith(p) for p in _GENERIC_INSTRUMENT_PATTERNS)


# ============================================================================
# Public API
# ============================================================================

# ── 解析快取 ────────────────────────────────────────────────────────────────
#
# music21 解析大譜很慢, 而同一個檔案在一次工作流程中會被多個 RPC handler
# 各自重新解析 (score_info / to_musicxml / arrange / analyze ...)。
# 用 (絕對路徑, mtime, size) 當 key 快取結果; 檔案被外部編輯器改動 → mtime
# 變 → 自動失效, 與 auto-reimport 相容。引擎是單執行緒, 不需鎖。
#
#   _M21_CACHE — load_m21 的 music21 Score。consumer 皆唯讀: parse_stream
#                只讀, GeneralObjectExporter 匯出時內部自行 deepcopy。
#   _IR_CACHE  — parse_musicxml 的 IR Score。命中一律回 deepcopy, 因 caller
#                可能就地標記/修改 IR (e.g. tag_functions / arrange)。

_CACHE_MAX = 4
_M21_CACHE: "OrderedDict[Any, m21_stream.Score]" = OrderedDict()
_IR_CACHE: "OrderedDict[Any, Score]" = OrderedDict()


def _cache_key(path: str) -> Any:
    """快取 key。corpus: 內容不變 → 用字串本身; 一般檔案 → 綁 mtime/size。"""
    if path.startswith("corpus:"):
        return path
    try:
        st = os.stat(path)
        return (os.path.abspath(path), st.st_mtime_ns, st.st_size)
    except OSError:
        # 取不到 stat (檔案不存在等) → 用路徑本身, 讓後續解析自然報錯
        return os.path.abspath(path)


def _cache_get(cache: "OrderedDict[Any, Any]", key: Any) -> Any:
    val = cache.get(key)
    if val is not None:
        cache.move_to_end(key)  # LRU: 最近用到的移到尾端
    return val


def _cache_put(cache: "OrderedDict[Any, Any]", key: Any, val: Any) -> None:
    cache[key] = val
    cache.move_to_end(key)
    while len(cache) > _CACHE_MAX:
        cache.popitem(last=False)  # 淘汰最久未用


def clear_parse_cache() -> None:
    """清空解析快取 (測試用; 一般執行不需手動呼叫, mtime 變動會自動失效)。"""
    _M21_CACHE.clear()
    _IR_CACHE.clear()


# ============================================================================
# Public API
# ============================================================================

def load_m21(path: str) -> m21_stream.Score:
    """把來源路徑載入為 music21 Score (帶快取)。

    支援的 path 格式:
    - 一般檔案路徑 (e.g. "/path/to/score.musicxml", .mxl, .mid, .krn)
    - "corpus:<id>" → 先查隨 app 出貨的範例 (core/samples.py),
      找不到才 fallback 到 music21 內建 corpus (僅開發模式可靠;
      凍結後 corpus 路徑會壞)。
    """
    key = _cache_key(path)
    cached = _cache_get(_M21_CACHE, key)
    if cached is not None:
        return cached
    score = _load_m21_uncached(path)
    _cache_put(_M21_CACHE, key, score)
    return score


def _load_m21_uncached(path: str) -> m21_stream.Score:
    if path.startswith("corpus:"):
        corpus_id = path[len("corpus:"):]
        from core.samples import resolve as resolve_sample
        sample_path = resolve_sample(corpus_id)
        if sample_path is not None:
            return converter.parse(str(sample_path))
        # 找不到隨附範例。打包版沒有完整 music21 corpus —
        # 給明確錯誤而非讓 music21 噴 '/music21' 之類的破路徑。
        if getattr(sys, "frozen", False):
            raise FileNotFoundError(
                f"範例 '{corpus_id}' 不在隨附清單中 "
                f"(打包版只含內建精選範例)",
            )
        from music21 import corpus as m21_corpus  # 開發模式 fallback
        return m21_corpus.parse(corpus_id)
    return converter.parse(path)


def parse_musicxml(path: str) -> Score:
    """從 MusicXML 檔案路徑解析為 IR Score (帶快取)。

    支援的 path 格式:
    - 一般檔案路徑 (e.g. "/path/to/score.musicxml", .mxl, .mid, .krn)
    - "corpus:bach/bwv66.6" → 隨附範例 / music21 corpus

    命中快取時回傳 deepcopy — caller 可安全就地修改/標記 IR。
    """
    key = _cache_key(path)
    cached = _cache_get(_IR_CACHE, key)
    if cached is not None:
        return copy.deepcopy(cached)
    ir = parse_stream(load_m21(path))
    _cache_put(_IR_CACHE, key, ir)
    return copy.deepcopy(ir)


def parse_stream(m21_score: m21_stream.Score) -> Score:
    """從 music21 stream.Score 解析為 IR Score。"""
    return _Parser().parse(m21_score)


# ============================================================================
# Parser implementation
# ============================================================================

class _Parser:
    def __init__(self) -> None:
        self._slur_id_map: dict[int, int] = {}     # id(m21_note) → ir slur_group
        self._next_slur_id = 0
        self._next_tuplet_bracket_id = 0
        self._warnings: list[str] = []

    def parse(self, m21_score: m21_stream.Score) -> Score:
        score = Score()

        # Metadata
        if m21_score.metadata is not None:
            md = m21_score.metadata
            # 一般欄位
            for key in ("composer", "arranger", "copyright"):
                value = getattr(md, key, None)
                if value:
                    score.metadata[key] = str(value)
            # 標題: music21 把樂章名稱放在 movementName 而非 title 是常見情況
            # (尤其 corpus 內 Mozart/Beethoven 等). Fallback chain:
            #   title → movementName → opusTitle → 'Untitled'
            # 過濾掉看起來像檔名的值 (bwv66.6.mxl 等), 避免 Bach 等 Bach corpus
            # 漏出檔名當標題.
            def _looks_like_filename(s: str) -> bool:
                s = s.lower().strip()
                return s.endswith((
                    ".mxl", ".xml", ".musicxml", ".mid", ".midi",
                    ".krn", ".abc",
                ))
            title = None
            for attr in ("title", "movementName", "opusTitle"):
                v = getattr(md, attr, None)
                if v and not _looks_like_filename(str(v)):
                    title = str(v)
                    break
            # 最後手段: 從 corpusFilePath 推 (例: bach/bwv66.6.mxl → 'bach/bwv66.6')
            if not title:
                all_md = dict(md.all()) if hasattr(md, "all") else {}
                corpus_path = all_md.get("corpusFilePath") or ""
                if corpus_path:
                    stem = corpus_path
                    for ext in (".mxl", ".xml", ".musicxml", ".mid"):
                        if stem.lower().endswith(ext):
                            stem = stem[: -len(ext)]
                            break
                    if stem:
                        title = stem
            if title:
                score.metadata["title"] = title
            score.metadata.setdefault("source_format", "musicxml")

        # 預先建立 slur 對應表
        self._collect_slurs(m21_score)

        # Parts
        for i, m21_part in enumerate(m21_score.parts):
            score.parts.append(self._parse_part(m21_part, i))

        # 從第一個 part 的第一個 measure 推導預設值
        if score.parts and score.parts[0].measures:
            first = score.parts[0].measures[0]
            if first.tempo_bpm is not None:
                score.default_tempo_bpm = first.tempo_bpm
            if first.key_signature is not None:
                score.default_key = first.key_signature
            if first.time_signature is not None:
                score.default_time_signature = first.time_signature

        # Phase 1: 單樂章包裝
        measure_count = max(
            (len(p.measures) for p in score.parts), default=0
        )
        score.movements = [Movement(
            movement_id=1,
            title=score.metadata.get("title"),
            measure_count=measure_count,
        )]

        score.parse_warnings.extend(self._warnings)
        return score

    # ------------------------------------------------------------------ slurs
    def _collect_slurs(self, m21_score: m21_stream.Score) -> None:
        for slur in m21_score.recurse().getElementsByClass(spanner.Slur):
            slur_id = self._next_slur_id
            self._next_slur_id += 1
            for elem in slur.getSpannedElements():
                self._slur_id_map[id(elem)] = slur_id

    # ------------------------------------------------------------------ Part
    def _parse_part(self, m21_part: m21_stream.Part, index: int) -> Part:
        instrument = m21_part.getInstrument(returnDefault=False)
        raw_inst_name = instrument.instrumentName if instrument else None
        part_name = m21_part.partName

        # 若 instrumentName 是 generic ("Instrument N" 等),改用 partName
        # 這對 Bach 聖詠等 corpus 作品很重要 — 它們的 partName 是 "Soprano" 等。
        if _is_generic_instrument_name(raw_inst_name):
            inst_name = part_name or raw_inst_name or f"Part {index + 1}"
        else:
            inst_name = raw_inst_name

        from core.instruments import CANONICAL_IDS as _CIDS
        # 優先用 partName (顯示名通常最精確, e.g. "Violino I." > music21 推測的
        # 通用樂器物件名稱 "AriaPlayer"). 若 partName 不對才 fallback 到 inst_name.
        candidates = [part_name, inst_name]
        instrument_id = "unknown"
        for cand in candidates:
            if not cand:
                continue
            normalized = normalize_instrument_id(cand)
            if normalized in _CIDS:
                instrument_id = normalized
                break
        if instrument_id == "unknown":
            # 兩個都沒 hit canonical → 用 inst_name 標準化結果 (至少 lowercase)
            instrument_id = normalize_instrument_id(inst_name)
        display_name = (
            (instrument.partName if instrument else None)
            or part_name
            or inst_name
        )
        part_id = f"{instrument_id}_{index + 1}"

        measures: list[Measure] = []
        for m21_measure in m21_part.getElementsByClass(m21_stream.Measure):
            measures.append(self._parse_measure(m21_measure))

        return Part(
            part_id=part_id,
            name_display=display_name,
            instrument_id=instrument_id,
            measures=measures,
        )

    # ----------------------------------------------------------------- Measure
    def _parse_measure(self, m21_measure: m21_stream.Measure) -> Measure:
        measure = Measure(number=m21_measure.number)

        if m21_measure.timeSignature is not None:
            ts = m21_measure.timeSignature
            measure.time_signature = (ts.numerator, ts.denominator)

        if m21_measure.keySignature is not None:
            measure.key_signature = self._format_key(m21_measure.keySignature)

        # Tempo / rehearsal marks: 在 measure 內搜尋
        for tempo_mark in m21_measure.recurse().getElementsByClass(m21_tempo.MetronomeMark):
            if tempo_mark.number is not None:
                measure.tempo_bpm = float(tempo_mark.number)
            if tempo_mark.text is not None:
                measure.tempo_text = str(tempo_mark.text)
            break

        # 排練記號 (music21 用 RehearsalMark)
        try:
            from music21 import expressions
            for rm in m21_measure.recurse().getElementsByClass(expressions.RehearsalMark):
                measure.rehearsal_mark = rm.content
                break
        except (ImportError, AttributeError):
            pass

        # 條線
        if m21_measure.leftBarline is not None:
            measure.barline_left = self._convert_barline(m21_measure.leftBarline.type)
        if m21_measure.rightBarline is not None:
            measure.barline_right = self._convert_barline(m21_measure.rightBarline.type)

        # Voices
        m21_voices = list(m21_measure.voices)
        if m21_voices:
            for vi, m21_voice in enumerate(m21_voices):
                voice_id = self._parse_voice_id(m21_voice, vi + 1)
                events = self._parse_events(m21_voice)
                measure.voices[voice_id] = Voice(voice_id=voice_id, events=events)
        else:
            events = self._parse_events(m21_measure)
            measure.voices[1] = Voice(voice_id=1, events=events)

        return measure

    @staticmethod
    def _convert_barline(m21_type: str) -> str:
        mapping = {
            "double": "double",
            "final": "final",
            "regular": "normal",
            "heavy": "final",
            "none": "normal",
        }
        return mapping.get(m21_type, "normal")

    @staticmethod
    def _format_key(m21_ks: m21_key.KeySignature) -> str:
        """KeySignature → 'D major' / 'F# minor' / 'no key sig'。"""
        if isinstance(m21_ks, m21_key.Key):
            return f"{m21_ks.tonic.name.replace('-', 'b')} {m21_ks.mode}"
        # fallback: 用 sharps 數
        return f"{m21_ks.sharps} sharps" if m21_ks.sharps else "no key sig"

    @staticmethod
    def _parse_voice_id(m21_voice: m21_stream.Voice, fallback: int) -> int:
        try:
            return int(m21_voice.id)
        except (TypeError, ValueError):
            return fallback

    # ------------------------------------------------------------------ Events
    def _parse_events(self, m21_container: Any) -> list:
        events: list = []
        pending_grace: list[GraceNote] = []
        current_dynamic: Optional[str] = None

        for element in m21_container:
            if isinstance(element, m21_dynamics.Dynamic):
                current_dynamic = element.value
                continue

            if isinstance(element, m21_note.Note):
                if self._is_grace(element):
                    pending_grace.append(GraceNote(
                        pitch=self._make_pitch(element.pitch),
                        grace_type=self._grace_type(element),
                    ))
                else:
                    ev = self._parse_note(element, current_dynamic)
                    if pending_grace:
                        ev.grace_before = pending_grace
                        pending_grace = []
                    events.append(ev)
                continue

            if isinstance(element, m21_chord.Chord):
                if len(element.pitches) == 1:
                    # spec §4.1.1: 單音 Chord wrapper → NoteEvent
                    ev_n = self._parse_chord_as_note(element, current_dynamic)
                    if pending_grace:
                        ev_n.grace_before = pending_grace
                        pending_grace = []
                    events.append(ev_n)
                else:
                    ev_c = self._parse_chord(element, current_dynamic)
                    if pending_grace:
                        ev_c.grace_before = pending_grace
                        pending_grace = []
                    events.append(ev_c)
                continue

            if isinstance(element, m21_note.Rest):
                events.append(self._parse_rest(element))
                continue

            # 其他元素 (Clef, Barline, KeySig 等) 忽略,由 measure-level 處理

        return events

    @staticmethod
    def _is_grace(m21_n: m21_note.Note) -> bool:
        return m21_n.duration.isGrace or m21_n.duration.quarterLength == 0

    @staticmethod
    def _grace_type(m21_n: m21_note.Note) -> str:
        # music21 grace note 的 slash 屬性區分 acciaccatura (有斜線) 與 appoggiatura
        try:
            if getattr(m21_n.duration, "slash", True):
                return "acciaccatura"
            return "appoggiatura"
        except AttributeError:
            return "acciaccatura"

    def _parse_note(
        self, m21_n: m21_note.Note, dynamic: Optional[str]
    ) -> NoteEvent:
        return NoteEvent(
            pitch=self._make_pitch(m21_n.pitch),
            duration=_to_fraction(m21_n.duration.quarterLength),
            onset=_to_fraction(m21_n.offset),
            articulations=self._get_articulations(m21_n),
            dynamic=dynamic,
            is_tied_from=self._tie_from(m21_n),
            is_tied_to=self._tie_to(m21_n),
            slur_group=self._slur_id_map.get(id(m21_n)),
            tuplet=self._get_tuplet(m21_n),
        )

    def _parse_chord_as_note(
        self, m21_c: m21_chord.Chord, dynamic: Optional[str]
    ) -> NoteEvent:
        return NoteEvent(
            pitch=self._make_pitch(m21_c.pitches[0]),
            duration=_to_fraction(m21_c.duration.quarterLength),
            onset=_to_fraction(m21_c.offset),
            articulations=self._get_articulations(m21_c),
            dynamic=dynamic,
            is_tied_from=self._tie_from(m21_c),
            is_tied_to=self._tie_to(m21_c),
            slur_group=self._slur_id_map.get(id(m21_c)),
            tuplet=self._get_tuplet(m21_c),
        )

    def _parse_chord(
        self, m21_c: m21_chord.Chord, dynamic: Optional[str]
    ) -> ChordEvent | NoteEvent:
        # 去重: notation→MIDI 匯出常在同一和弦內出現重複/重疊的相同音高,
        # 而 ChordEvent 不允許重複 midi_number。保留首次出現的那顆。
        seen: set[int] = set()
        uniq: list = []
        for p in m21_c.pitches:
            pitch = self._make_pitch(p)
            if pitch.midi_number in seen:
                continue
            seen.add(pitch.midi_number)
            uniq.append(pitch)
        # 去重後只剩單音 → 退化為 NoteEvent (pitches[0] 必為保留的那顆)
        if len(uniq) == 1:
            return self._parse_chord_as_note(m21_c, dynamic)
        return ChordEvent(
            pitches=uniq,
            duration=_to_fraction(m21_c.duration.quarterLength),
            onset=_to_fraction(m21_c.offset),
            articulations=self._get_articulations(m21_c),
            dynamic=dynamic,
            is_tied_from=self._tie_from(m21_c),
            is_tied_to=self._tie_to(m21_c),
            slur_group=self._slur_id_map.get(id(m21_c)),
            tuplet=self._get_tuplet(m21_c),
        )

    def _parse_rest(self, m21_r: m21_note.Rest) -> RestEvent:
        return RestEvent(
            duration=_to_fraction(m21_r.duration.quarterLength),
            onset=_to_fraction(m21_r.offset),
            fermata=self._has_fermata(m21_r),
        )

    @staticmethod
    def _make_pitch(m21_pitch: Any) -> Pitch:
        spelling = m21_pitch.nameWithOctave.replace("-", "b")
        return Pitch(midi_number=int(m21_pitch.midi), spelling=spelling)

    @staticmethod
    def _get_articulations(m21_obj: Any) -> list[str]:
        result = [a.name.lower().replace(" ", "_") for a in m21_obj.articulations]
        # Fermata 在 expressions, 不在 articulations
        for expr in getattr(m21_obj, "expressions", []):
            cls_name = type(expr).__name__.lower()
            if "fermata" in cls_name:
                result.append("fermata")
        return result

    @staticmethod
    def _has_fermata(m21_obj: Any) -> bool:
        for expr in getattr(m21_obj, "expressions", []):
            if "fermata" in type(expr).__name__.lower():
                return True
        return False

    @staticmethod
    def _tie_from(m21_obj: Any) -> bool:
        return bool(m21_obj.tie and m21_obj.tie.type in ("continue", "stop"))

    @staticmethod
    def _tie_to(m21_obj: Any) -> bool:
        return bool(m21_obj.tie and m21_obj.tie.type in ("start", "continue"))

    def _get_tuplet(self, m21_obj: Any) -> Optional[Tuplet]:
        tuplets = m21_obj.duration.tuplets
        if not tuplets:
            return None
        t = tuplets[0]
        # 同一連音群組 (同 measure、同 actual:normal、type 為 start/continue/stop)
        # 簡化: 用 (m21_obj.measureNumber, t.numberNotesActual, t.numberNotesNormal) 當 key
        key_tuple = (
            getattr(m21_obj, "measureNumber", 0),
            t.numberNotesActual,
            t.numberNotesNormal,
        )
        bracket_id = self._get_bracket_id(key_tuple, t.type)
        return Tuplet(
            actual=t.numberNotesActual,
            normal=t.numberNotesNormal,
            bracket_id=bracket_id,
        )

    _tuplet_cache: dict[tuple, int] = {}

    def _get_bracket_id(self, key_tuple: tuple, t_type: Optional[str]) -> int:
        """同一連音 bracket 共用 ID。`type='start'` 開啟新 bracket。"""
        if t_type == "start" or key_tuple not in self._tuplet_cache:
            self._tuplet_cache[key_tuple] = self._next_tuplet_bracket_id
            self._next_tuplet_bracket_id += 1
        return self._tuplet_cache[key_tuple]


# ============================================================================
# Fraction conversion helper
# ============================================================================

def _to_fraction(value: Any) -> Fraction:
    """music21 quarterLength → Fraction, 支援連音的有理數。"""
    if isinstance(value, Fraction):
        return value
    if isinstance(value, int):
        return Fraction(value)
    # float / Decimal → Fraction with reasonable denominator limit
    return Fraction(value).limit_denominator(2520)  # 支援 9 連音等

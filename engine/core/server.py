"""
持久 Engine Server — JSON-Lines over stdio 協定

對應 architecture.md §3.1 (前後端通訊). 取代每次 spawn child_process 的成本。

Protocol:
  Server 啟動時送出 ready 訊息: `{"type": "ready", "version": "0.1.0"}`
  Client 送請求 (一行 JSON):     `{"id": "<str>", "method": "<str>", "params": {...}}`
  Server 回應 (一行 JSON):       `{"id": "<str>", "ok": true, "data": ...}`
                            或: `{"id": "<str>", "ok": false, "error": "...", "traceback": "..."}`

每行 JSON 必須以 \\n 結尾且不含 \\n 在中間 (json.dumps 預設行為)。
"""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any, Callable

from core.analyzer import (
    analyze_harmony,
    detect_phrases,
    tag_all_sections,
)
from core.arrangement_model import build_ensemble, violin_piano_ensemble
from core.arranger import arrange as run_arrange
from core.transcriber import (
    TranscriptionTarget,
    suggest_transposition,
    transcribe as run_transcribe,
)
from core.evaluation import evaluate_phrase_detection, load_annotation
from core.ir import Score, Section, VoiceFunction
from core.ir_serialize import to_dict
from core.ir_validate import validate
from core.musicxml_writer import write_musicxml_string
from core.parser import parse_musicxml, parse_stream
from core.repair import (
    LocatedIssue,
    collect_issues,
    repair_loop,
    severity_score,
    strategy_octave_shift,
    strategy_omit_note,
    strategy_split_to_other_hand,
)


SERVER_VERSION = "0.1.0"
_DEFAULT_SESSION_ID = "default"
_HISTORY_LIMIT = 50

# Session 持久化目錄 (auto-snapshot 寫入此處,跨 server 重啟還原)
from pathlib import Path as _Path
_SESSION_DIR = _Path.home() / ".score-arranger" / "sessions"

# Default session 的全域 state (向後相容: 舊測試直接 srv._CURRENT_ARRANGEMENT)
_CURRENT_ARRANGEMENT = None
_HISTORY: list = []
_REDO_STACK: list = []

# 命名 session 的獨立 state
_SESSIONS_BY_ID: dict[str, dict[str, Any]] = {}


class _SessionView:
    """Session 代理: 讀寫透明地路由到 default (module-level) 或具名 session 字典。"""

    def __init__(self, session_id: Optional[str]):
        self.session_id = session_id or _DEFAULT_SESSION_ID
        self._is_default = self.session_id == _DEFAULT_SESSION_ID
        if not self._is_default and self.session_id not in _SESSIONS_BY_ID:
            _SESSIONS_BY_ID[self.session_id] = {
                "arrangement": None, "history": [], "redo_stack": [],
            }

    @property
    def current_arrangement(self):
        if self._is_default:
            return _CURRENT_ARRANGEMENT
        return _SESSIONS_BY_ID[self.session_id]["arrangement"]

    @current_arrangement.setter
    def current_arrangement(self, value):
        if self._is_default:
            global _CURRENT_ARRANGEMENT
            _CURRENT_ARRANGEMENT = value
        else:
            _SESSIONS_BY_ID[self.session_id]["arrangement"] = value

    @property
    def history(self) -> list:
        if self._is_default:
            return _HISTORY
        return _SESSIONS_BY_ID[self.session_id]["history"]

    @history.setter
    def history(self, value: list):
        if self._is_default:
            global _HISTORY
            _HISTORY = value
        else:
            _SESSIONS_BY_ID[self.session_id]["history"] = value

    @property
    def redo_stack(self) -> list:
        if self._is_default:
            return _REDO_STACK
        return _SESSIONS_BY_ID[self.session_id]["redo_stack"]

    @redo_stack.setter
    def redo_stack(self, value: list):
        if self._is_default:
            global _REDO_STACK
            _REDO_STACK = value
        else:
            _SESSIONS_BY_ID[self.session_id]["redo_stack"] = value


def _session(params: dict[str, Any]) -> _SessionView:
    sid = params.get("session_id")
    if sid and sid != _DEFAULT_SESSION_ID:
        # 若記憶體沒有,試從 disk 還原
        if sid not in _SESSIONS_BY_ID:
            _try_load_session_from_disk(sid)
    return _SessionView(sid)


def _session_disk_path(session_id: str) -> _Path:
    return _SESSION_DIR / f"{session_id}.json"


def _persist_session(session_id: Optional[str]) -> None:
    """把指定 session 的 current_arrangement 自動寫到 disk。

    Default session 不持久化 (向後相容)。
    """
    if not session_id or session_id == _DEFAULT_SESSION_ID:
        return
    sess = _SessionView(session_id)
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        return
    try:
        _SESSION_DIR.mkdir(parents=True, exist_ok=True)
        arrangement = sess.current_arrangement
        data = {
            "format": "score-arranger-session",
            "version": "0.1.0",
            "session_id": session_id,
            "arrangement": {
                "arrangement_id": arrangement.arrangement_id,
                "name": arrangement.name,
                "source_id": arrangement.source_id,
                "players": [
                    {
                        "player_id": p.player_id,
                        "display_name": p.display_name,
                        "instruments": p.instruments,
                        "primary_instrument": p.primary_instrument,
                        "staves": p.staves,
                    }
                    for p in arrangement.players
                ],
                "assignments": [
                    {
                        "assignment_id": a.assignment_id,
                        "source_part_id": a.source_part_id,
                        "target_player_id": a.target_player_id,
                        "target_instrument": a.target_instrument,
                        "target_staff": a.target_staff,
                        "span": list(a.span),
                        "function": a.function.value,
                        "is_user_edited": a.is_user_edited,
                    }
                    for a in arrangement.assignments
                ],
            },
            "target_score": to_dict(arrangement.target_score),
        }
        _session_disk_path(session_id).write_text(
            json.dumps(data, ensure_ascii=False), encoding="utf-8",
        )
    except Exception as e:
        print(f"[session persist] {session_id}: {e}", flush=True)


def _try_load_session_from_disk(session_id: str) -> bool:
    path = _session_disk_path(session_id)
    if not path.exists():
        return False
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if data.get("format") != "score-arranger-session":
            return False
        from core.ir_serialize import from_dict
        from core.arrangement_model import Arrangement, Assignment, Player
        from core.ir import VoiceFunction
        target_score = from_dict(data["target_score"])
        arr_data = data["arrangement"]
        arrangement = Arrangement(
            arrangement_id=arr_data["arrangement_id"],
            name=arr_data["name"],
            source_id=arr_data["source_id"],
            players=[
                Player(
                    player_id=p["player_id"],
                    display_name=p["display_name"],
                    instruments=p["instruments"],
                    primary_instrument=p["primary_instrument"],
                    staves=p["staves"],
                )
                for p in arr_data["players"]
            ],
            assignments=[
                Assignment(
                    assignment_id=a["assignment_id"],
                    source_part_id=a["source_part_id"],
                    target_player_id=a["target_player_id"],
                    target_instrument=a["target_instrument"],
                    target_staff=a["target_staff"],
                    span=tuple(a["span"]),
                    function=VoiceFunction(a["function"]),
                    is_user_edited=a.get("is_user_edited", False),
                )
                for a in arr_data["assignments"]
            ],
            target_score=target_score,
        )
        sess = _SessionView(session_id)
        sess.current_arrangement = arrangement
        sess.history = []
        sess.redo_stack = []
        return True
    except Exception as e:
        print(f"[session restore] {session_id}: {e}", flush=True)
        return False


def _delete_session_disk(session_id: str) -> None:
    path = _session_disk_path(session_id)
    try:
        if path.exists():
            path.unlink()
    except OSError:
        pass


# ============================================================================
# Method handlers
# ============================================================================

def _method_parse(params: dict[str, Any]) -> Any:
    score = parse_musicxml(params["path"])
    return to_dict(score)


def _method_to_musicxml(params: dict[str, Any]) -> str:
    """Score 路徑 → MusicXML 字串.

    可選 max_measures: 若指定且 > 0, 只回傳前 N 個小節的切片 (大譜預覽用,
    OSMD 對 >800 小節的譜常 freeze). 改編引擎仍走完整譜, 這只影響 viewer.
    """
    from music21 import musicxml as m21_musicxml
    from core.parser import load_m21
    path = params["path"]
    max_measures = params.get("max_measures")
    m21_score = load_m21(path)

    if max_measures and max_measures > 0:
        try:
            m21_score = _slice_measures(m21_score, int(max_measures))
        except Exception:
            pass  # 切片失敗時退回完整譜

    exporter = m21_musicxml.m21ToXml.GeneralObjectExporter(m21_score)
    return exporter.parse().decode("utf-8")


def _slice_measures(m21_score, max_measures: int):
    """回傳只含前 max_measures 個小節的新 Score (拷貝, 不 mutate)."""
    from music21 import stream as m21_stream, metadata as m21_metadata
    new_score = m21_stream.Score()
    # 保留 metadata
    md = m21_score.getElementsByClass(m21_metadata.Metadata)
    if md:
        new_score.insert(0, md[0])
    for part in m21_score.parts:
        new_part = m21_stream.Part()
        new_part.partName = part.partName
        new_part.id = part.id
        # 複製 part 級別的 instrument / clef 等
        for el in part.iter().getElementsByClass(("Instrument",)):
            new_part.insert(0, el)
        measures = list(part.getElementsByClass(m21_stream.Measure))
        for m in measures[:max_measures]:
            new_part.append(m)
        new_score.insert(0, new_part)
    return new_score


def _method_score_info(params: dict[str, Any]) -> dict[str, Any]:
    """快速 metadata: 小節數 / part 數 — 給 UI 在載入前判斷是否該切片."""
    from music21 import stream as m21_stream
    from core.parser import load_m21
    path = params["path"]
    m21_score = load_m21(path)
    measure_count = 0
    for part in m21_score.parts:
        n = len(list(part.getElementsByClass(m21_stream.Measure)))
        measure_count = max(measure_count, n)
    return {
        "measure_count": measure_count,
        "part_count": len(list(m21_score.parts)),
    }


def _method_list_style_presets(_params: dict[str, Any]) -> list[dict]:
    """回傳所有可用 style preset, 給 UI 下拉選單."""
    from .style_presets import list_presets
    return list_presets()


def _method_list_available_instruments(_params: dict[str, Any]) -> list[dict]:
    """回傳所有已註冊 instrument profile 的簡要資訊, 給自訂 ensemble UI 用."""
    from .instruments import get_profile, list_profiles
    result = []
    for iid in list_profiles():
        profile = get_profile(iid)
        if profile is None:
            continue
        # 鍵盤類 default 2 staves, 其他單譜
        default_staves = 2 if profile.family == "keyboard" else 1
        result.append({
            "instrument_id": iid,
            "display_name": profile.display_name,
            "family": profile.family,
            "range_comfortable_low": profile.range_comfortable[0],
            "range_comfortable_high": profile.range_comfortable[1],
            "default_staves": default_staves,
        })
    return result


def _method_arrange_custom(params: dict[str, Any]) -> dict:
    """跟 _method_arrange 一樣, 但接受自訂 players list 取代 ensemble template.

    params["players"]: list of {
        player_id, display_name, instrument_id, staves?, skill_level?
    }
    """
    from .arrangement_model import Player
    sess = _session(params)
    sess.history = []
    sess.redo_stack = []
    score = parse_musicxml(params["path"])
    do_repair = bool(params.get("repair", False))
    skill_level = params.get("skill_level", "professional")
    if skill_level not in ("amateur", "intermediate", "professional"):
        skill_level = "professional"
    style_preset = params.get("style_preset", "none")

    raw_players = params.get("players") or []
    if not raw_players:
        raise ValueError("自訂編制需要至少 1 個 player")

    players: list[Player] = []
    for i, p in enumerate(raw_players):
        instr = p.get("instrument_id") or "piano"
        players.append(Player(
            player_id=p.get("player_id") or f"{instr}_{i + 1}",
            display_name=p.get("display_name") or instr,
            instruments=[instr],
            primary_instrument=instr,
            staves=int(p.get("staves") or 1),
            skill_level=p.get("skill_level") or skill_level,
        ))

    tag_all_sections(score)
    arrangement = run_arrange(score, players)

    if style_preset and style_preset != "none":
        try:
            from .style_presets import apply_preset
            apply_preset(arrangement, style_preset)
        except Exception:
            pass

    repair_info = None
    if do_repair:
        before = severity_score(collect_issues(arrangement.target_score))
        report = repair_loop(
            arrangement,
            strategies=_ordered_strategies(params.get("strategy_order")),
        )
        after = severity_score(collect_issues(arrangement.target_score))
        repair_info = _build_repair_info(report, before, after)

    target_xml = None
    if arrangement.target_score is not None:
        try:
            target_xml = write_musicxml_string(arrangement.target_score)
        except Exception:
            target_xml = None

    sess.current_arrangement = arrangement
    _persist_session(params.get("session_id"))

    return {
        "arrangement_id": arrangement.arrangement_id,
        "name": arrangement.name,
        "source_id": arrangement.source_id,
        "players": [
            {
                "player_id": p.player_id,
                "display_name": p.display_name,
                "primary_instrument": p.primary_instrument,
                "staves": p.staves,
            }
            for p in arrangement.players
        ],
        "assignments": [
            {
                "id": a.assignment_id,
                "source_part": a.source_part_id,
                "target": f"{a.target_player_id}/{a.target_staff}",
                "target_player_id": a.target_player_id,
                "target_instrument": a.target_instrument,
                "target_staff": a.target_staff,
                "function": a.function.value,
            }
            for a in arrangement.assignments
        ],
        "target_musicxml": target_xml,
        "issues": _serialize_issues(
            collect_issues(arrangement.target_score)
        ),
        "repair": repair_info,
    }


def _method_amt_status(_params: dict[str, Any]) -> dict[str, Any]:
    """檢查 basic-pitch (AMT) 環境."""
    from .amt import detect_basic_pitch
    s = detect_basic_pitch()
    return {
        "available": s.available,
        "version": s.version,
        "missing": s.missing,
        "install_hints": s.install_hints,
    }


def _method_audio_to_musicxml(params: dict[str, Any]) -> dict[str, Any]:
    """音訊 → MusicXML (basic-pitch). Caller 拿到 path 後再 toMusicXML 載入內容."""
    from .amt import AMTError, audio_to_musicxml, detect_basic_pitch
    audio_path = params["path"]
    output_dir = params.get("output_dir")
    try:
        out = audio_to_musicxml(audio_path, output_dir=output_dir)
    except AMTError as e:
        raise RuntimeError(f"AMT 失敗: {e}") from e
    status = detect_basic_pitch()
    return {"musicxml_path": out, "basic_pitch_version": status.version}


def _method_omr_status(_params: dict[str, Any]) -> dict[str, Any]:
    """檢查 OMR (Audiveris) 環境. 給 UI 在匯入 PDF 前判斷是否能用."""
    from .omr import detect_audiveris
    s = detect_audiveris()
    return {
        "available": s.available,
        "java_ok": s.java_ok,
        "audiveris_path": s.audiveris_path,
        "version": s.version,
        "missing": s.missing,
        "install_hints": s.install_hints,
    }


def _method_pdf_to_musicxml(params: dict[str, Any]) -> dict[str, Any]:
    """把 PDF 透過 Audiveris 轉成 MusicXML 檔.

    回傳 {"musicxml_path": str, "audiveris_version": str}.
    Caller 拿到路徑後再呼叫 to_musicxml 載入內容; 兩階段是因為 OMR 可能要 1-2 分鐘,
    主程式想顯示 progress, 拆開比較清楚.
    """
    from .omr import AudiverisError, pdf_to_musicxml, detect_audiveris
    pdf_path = params["path"]
    output_dir = params.get("output_dir")
    timeout = int(params.get("timeout_sec", 300))
    try:
        out = pdf_to_musicxml(
            pdf_path, output_dir=output_dir, timeout_sec=timeout
        )
    except AudiverisError as e:
        raise RuntimeError(f"OMR 失敗: {e}") from e
    status = detect_audiveris()
    return {
        "musicxml_path": out,
        "audiveris_version": status.version,
    }


def _method_list_corpus(_params: dict[str, Any]) -> list[dict[str, str]]:
    """列出可用的範例樂譜。

    回傳隨 app 出貨的精選範例 (core/samples.py)。凍結後 music21 corpus
    路徑會壞, 故不再用 m21_corpus.search — 一律以隨附範例為準。
    """
    from core.samples import list_samples
    return list_samples()


def _method_validate(params: dict[str, Any]) -> dict:
    score = parse_musicxml(params["path"])
    result = validate(score)
    return {
        "ok": result.ok,
        "errors": [
            {"code": e.code, "message": e.message, "location": e.location}
            for e in result.errors
        ],
        "warnings": [
            {"code": w.code, "message": w.message, "location": w.location}
            for w in result.warnings
        ],
    }


def _method_phrases(params: dict[str, Any]) -> dict:
    score = parse_musicxml(params["path"])
    sections = _ensure_default_sections(score)
    use_harmony = bool(params.get("use_harmony", False))

    cadences = None
    if use_harmony:
        try:
            cadences = analyze_harmony(score).cadences
        except Exception:
            cadences = None

    out: dict[str, list] = {}
    for part in score.parts:
        out[part.part_id] = []
        for section in sections:
            phrases = detect_phrases(part, section, cadences=cadences)
            out[part.part_id].append({
                "section_id": section.section_id,
                "section_name": section.name,
                "start": section.start_measure,
                "end": section.end_measure,
                "phrases": [
                    {
                        "phrase_id": p.phrase_id,
                        "start": p.start[0],
                        "end": p.end[0],
                        "confidence": round(p.detection_confidence, 3),
                    }
                    for p in phrases
                ],
            })
    return out


def _method_tag_functions(params: dict[str, Any]) -> dict:
    score = parse_musicxml(params["path"])
    reports = tag_all_sections(score)
    return {
        str(sid): {
            "tags": {pid: tag.value for pid, tag in r.tags.items()},
            "melody_scores": {
                pid: round(s, 3) for pid, s in r.melody_scores.items()
            },
            "bass_scores": {
                pid: round(s, 3) for pid, s in r.bass_scores.items()
            },
        }
        for sid, r in reports.items()
    }


def _method_analyze_harmony(params: dict[str, Any]) -> dict:
    score = parse_musicxml(params["path"])
    report = analyze_harmony(score)
    return {
        "detected_key": report.detected_key,
        "key_confidence": report.key_confidence,
        "cadences": [
            {
                "measure": c.measure,
                "kind": c.kind,
                "from": c.from_chord,
                "to": c.to_chord,
            }
            for c in report.cadences
        ],
        "chord_count": len(report.chords),
    }


def _method_list_source_parts(params: dict[str, Any]) -> list[dict]:
    """列出 source 樂譜的所有 part 與其樂器 (給 TranscribePanel UI 用).

    params: { "path": str } — 'corpus:...' 或本機路徑
    回傳: [{ part_id, instrument_id, display_name }, ...]
    """
    path = params["path"]
    score = parse_musicxml(path)
    return [
        {
            "part_id": p.part_id,
            "instrument_id": p.instrument_id,
            "display_name": p.name_display or p.instrument_id,
        }
        for p in score.parts
    ]


def _method_suggest_transposition(params: dict[str, Any]) -> dict:
    """給 (source_instrument, target_instrument) 推薦 semitones."""
    return {
        "semitones": suggest_transposition(
            params["source"],
            params["target"],
            preserve_octave=bool(params.get("preserve_octave", True)),
        ),
    }


def _method_transcribe(params: dict[str, Any]) -> dict:
    """1→1 / N→N 樂器替換 + 移調 (跟 arrange 並列).

    params: {
        "path": str,             # source 樂譜
        "mapping": {             # key 可為 part_id 或 instrument_id
            "<key>": {
                "instrument": str,      # canonical or alias
                "semitones": int | null,  # null → 自動推
                "fit_to_range": bool,
                "preserve_octave": bool,
            },
            ...
        },
    }

    結果存到 session.current_arrangement, 之後可走 edit / export / 等
    所有現有 API (跟 arrange 的工作流一致).
    """
    from core.arrangement_model import Arrangement, Assignment, Player
    sess = _session(params)
    sess.history = []
    sess.redo_stack = []

    source = parse_musicxml(params["path"])
    raw_mapping = params.get("mapping") or {}

    mapping: dict[str, TranscriptionTarget] = {}
    for k, v in raw_mapping.items():
        if not isinstance(v, dict):
            continue
        mapping[k] = TranscriptionTarget(
            instrument=v["instrument"],
            semitones=v.get("semitones"),
            fit_to_range=bool(v.get("fit_to_range", True)),
            preserve_octave=bool(v.get("preserve_octave", True)),
        )

    result = run_transcribe(source, mapping)

    # 構造一個「樂器替換型」的 Arrangement, 讓 edit/export/issue 工具
    # 可繼續工作
    players = [
        Player(
            player_id=p.part_id,
            display_name=p.name_display or p.instrument_id,
            instruments=[p.instrument_id],
            primary_instrument=p.instrument_id,
            staves=1,
        )
        for p in result.score.parts
    ]
    max_measure = max(
        (max((m.number for m in p.measures), default=0)
         for p in result.score.parts),
        default=1,
    )
    assignments = []
    for i, src_part in enumerate(source.parts):
        # 對應的 target part (同 index)
        if i < len(result.score.parts):
            tgt = result.score.parts[i]
            assignments.append(Assignment(
                assignment_id=i,
                source_part_id=src_part.part_id,
                target_player_id=tgt.part_id,
                target_instrument=tgt.instrument_id,
                target_staff="main",
                span=(1, max_measure),
                function=VoiceFunction.UNASSIGNED,
            ))

    arrangement = Arrangement(
        arrangement_id="transcribed_v1",
        name="樂器替換 / 移調",
        source_id=source.metadata.get("title", "source"),
        players=players,
        assignments=assignments,
        target_score=result.score,
        source_score=source,
    )

    target_xml = None
    if arrangement.target_score is not None:
        try:
            target_xml = write_musicxml_string(arrangement.target_score)
        except Exception:
            target_xml = None

    sess.current_arrangement = arrangement
    _persist_session(params.get("session_id"))

    return {
        "arrangement_id": arrangement.arrangement_id,
        "name": arrangement.name,
        "source_id": arrangement.source_id,
        "players": [
            {
                "player_id": p.player_id,
                "display_name": p.display_name,
                "primary_instrument": p.primary_instrument,
                "staves": p.staves,
            }
            for p in arrangement.players
        ],
        "assignments": [
            {
                "id": a.assignment_id,
                "source_part": a.source_part_id,
                "target": f"{a.target_player_id}/{a.target_staff}",
                "function": a.function.value,
                "span": list(a.span),
            }
            for a in arrangement.assignments
        ],
        "target_musicxml": target_xml,
        "issues": _serialize_issues(
            collect_issues(arrangement.target_score)
            if arrangement.target_score is not None else []
        ),
        "semitones_used": result.semitones_used,
        "adjustments_count": len(result.adjustments),
        "adjustments": [
            {
                "part_id": a.part_id,
                "measure": a.measure,
                "voice_id": a.voice_id,
                "event_index": a.event_index,
                "original_midi": a.original_midi,
                "final_midi": a.final_midi,
                "reason": a.reason,
            }
            for a in result.adjustments[:50]  # 太多時截掉前 50 個
        ],
        "warnings": result.warnings[:20],
    }


def _method_arrange(params: dict[str, Any]) -> dict:
    sess = _session(params)
    # 新改編 → 清空歷史
    sess.history = []
    sess.redo_stack = []
    score = parse_musicxml(params["path"])
    target = params.get("target", "violin_piano")
    do_repair = bool(params.get("repair", False))
    skill_level = params.get("skill_level", "professional")
    if skill_level not in ("amateur", "intermediate", "professional"):
        skill_level = "professional"
    style_preset = params.get("style_preset", "none")

    players = build_ensemble(target, skill_level=skill_level)

    tag_all_sections(score)
    arrangement = run_arrange(score, players)

    # 套用 style preset post-hooks (e.g. film_score_piano 強化旋律 / bass)
    if style_preset and style_preset != "none":
        try:
            from .style_presets import apply_preset
            apply_preset(arrangement, style_preset)
        except Exception:
            pass

    repair_info = None
    if do_repair:
        before = severity_score(collect_issues(arrangement.target_score))
        report = repair_loop(
            arrangement,
            strategies=_ordered_strategies(params.get("strategy_order")),
        )
        after = severity_score(collect_issues(arrangement.target_score))
        repair_info = _build_repair_info(report, before, after)

    target_xml = None
    if arrangement.target_score is not None:
        try:
            target_xml = write_musicxml_string(arrangement.target_score)
        except Exception:
            target_xml = None

    # 儲存目前 arrangement 給 apply_suggestion 後續使用
    sess.current_arrangement = arrangement
    _persist_session(params.get("session_id"))

    return {
        "arrangement_id": arrangement.arrangement_id,
        "name": arrangement.name,
        "source_id": arrangement.source_id,
        "players": [
            {
                "player_id": p.player_id,
                "display_name": p.display_name,
                "primary_instrument": p.primary_instrument,
                "staves": p.staves,
            }
            for p in arrangement.players
        ],
        "assignments": [
            {
                "id": a.assignment_id,
                "source_part": a.source_part_id,
                "target": f"{a.target_player_id}/{a.target_staff}",
                "function": a.function.value,
                "span": list(a.span),
            }
            for a in arrangement.assignments
        ],
        "target_musicxml": target_xml,
        "repair": repair_info,
        "issues": _serialize_issues(
            collect_issues(arrangement.target_score)
            if arrangement.target_score is not None else []
        ),
        "difficulty": _serialize_difficulty(arrangement),
        "quality": _serialize_quality(arrangement),
    }


def _serialize_quality(arrangement) -> Optional[dict]:
    """整體改編品質 (melody/harmony/playability) — 給 A/B 版本比較用。"""
    if arrangement is None or arrangement.target_score is None \
            or getattr(arrangement, "source_score", None) is None:
        return None
    from core.quality import compute_quality, quality_to_dict
    try:
        issues = collect_issues(arrangement.target_score)
        return quality_to_dict(compute_quality(
            arrangement.source_score, arrangement.target_score, issues,
        ))
    except Exception:
        return None


def _serialize_difficulty(arrangement) -> dict:
    """為 arrangement 各 part 計算難度, 回傳 dict[part_id, payload]。"""
    if arrangement is None or arrangement.target_score is None:
        return {}
    from core.difficulty import analyze_score_difficulty, difficulty_to_dict
    try:
        per_part = analyze_score_difficulty(arrangement.target_score)
        return {pid: difficulty_to_dict(d) for pid, d in per_part.items()}
    except Exception:
        return {}


def _ordered_strategies(order):
    """依使用者偏好的策略名順序重排 PHASE_1_STRATEGIES。

    order: 前端依偏好學習推導的策略名清單 (e.g. ["omit_note", ...])。
    回傳重排後的 strategies; 無偏好 → None (repair_loop 沿用預設順序)。
    candidate-collection 的 _pick_best_candidate 在品質同分時取較前者,
    故偏好的策略會在「問題與品質皆同分」時勝出。
    """
    if not order or not isinstance(order, list):
        return None
    from core.repair import PHASE_1_STRATEGIES
    by_name = {pair[0]: pair for pair in PHASE_1_STRATEGIES}
    ranked = [by_name[n] for n in order if n in by_name]
    if not ranked:
        return None
    rest = [p for p in PHASE_1_STRATEGIES if p not in ranked]
    return ranked + rest


def _build_repair_info(report, before: float, after: float) -> dict:
    """把 RepairReport 轉成含時間軸 (per-iteration 快照) 的 dict."""
    from core.quality import quality_to_dict
    return {
        "iterations": len(report.iterations),
        "converged": report.converged,
        "severity_before": before,
        "severity_after": after,
        # 修復前後的改編品質 (melody/harmony/playability) — 讓 UI 顯示
        # 修復對音樂品質的實際影響, 而不只是 issue 數。
        "quality_before": (
            quality_to_dict(report.quality_before)
            if report.quality_before is not None else None
        ),
        "quality_after": (
            quality_to_dict(report.quality_after)
            if report.quality_after is not None else None
        ),
        # 時間軸 — 每步的修復細節 + MusicXML 快照, 給 scrubber UI
        "timeline": [
            {
                "iteration": it.iteration,
                "issue_code": it.issue_code,
                "issue_location": it.issue_location,
                "applied_strategy": it.applied_strategy,
                "score_before": it.score_before,
                "score_after": it.score_after,
                "target_musicxml": it.target_musicxml,
            }
            for it in report.iterations
        ],
    }


def _serialize_issues(issues: list[LocatedIssue]) -> list[dict]:
    return [
        {
            "part_id": i.part_id,
            "measure": i.measure_number,
            "voice_id": i.voice_id,
            "event_index": i.event_index,
            "severity": i.result.severity,
            "code": i.result.code,
            "params": i.result.params,
            "difficulty": round(i.result.difficulty_score, 3),
            "suggestions": [
                {"code": s.code, "params": s.params}
                for s in i.result.suggestions
            ],
        }
        for i in issues
    ]


# 建議 code → strategy 映射 (用於 apply_suggestion)
_SUGGESTION_STRATEGY = {
    "S_OCTAVE_UP": strategy_octave_shift,
    "S_OCTAVE_DOWN": strategy_octave_shift,
    "S_OMIT_NOTE": strategy_omit_note,
    "S_OMIT_INNER_VOICE": strategy_omit_note,
    "S_REDISTRIBUTE_HANDS": strategy_split_to_other_hand,
    "S_OCTAVE_TRANSPOSE_OUTER": strategy_split_to_other_hand,
}


def _method_apply_suggestion(params: dict[str, Any]) -> dict:
    """對當前 arrangement 套用一個建議。

    params:
      - session_id: (optional) tab session
      - part_id: 目標 part
      - measure: 小節編號
      - voice_id: voice (optional, default 1)
      - event_index: voice 內事件 index (optional, default 0)
      - suggestion_code: "S_OCTAVE_DOWN" 等
    """
    sess = _session(params)
    import copy as _copy
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement; 請先呼叫 arrange")

    # 推入歷史 (在套用前)
    new_history = list(sess.history)
    new_history.append(_copy.deepcopy(sess.current_arrangement.target_score))
    if len(new_history) > _HISTORY_LIMIT:
        new_history = new_history[-_HISTORY_LIMIT:]
    sess.history = new_history
    sess.redo_stack = []  # 新動作使 redo 失效

    target = sess.current_arrangement.target_score
    part_id = params["part_id"]
    measure_num = int(params["measure"])
    voice_id = int(params.get("voice_id", 1))
    event_index = int(params.get("event_index", 0))
    suggestion_code = params["suggestion_code"]

    strategy = _SUGGESTION_STRATEGY.get(suggestion_code)
    if strategy is None:
        raise ValueError(f"不支援的 suggestion: {suggestion_code}")

    # 重新偵測該位置的 issue (確保結構與當前 target_score 一致)
    all_issues = collect_issues(target)
    matching = [
        i for i in all_issues
        if i.part_id == part_id
        and i.measure_number == measure_num
        and i.voice_id == voice_id
        and i.event_index == event_index
    ]
    if not matching:
        raise ValueError(
            f"在 {part_id}/m.{measure_num}/v{voice_id}#{event_index} "
            f"找不到匹配的 issue"
        )

    issue = matching[0]
    success = strategy(target, issue)
    if not success:
        raise ValueError("策略無法套用 (條件不符或已修正)")

    # 重新驗證與輸出
    new_issues = collect_issues(target)
    try:
        new_xml = write_musicxml_string(target)
    except Exception as e:
        new_xml = None
        traceback_text = str(e)
    else:
        traceback_text = None

    _persist_session(params.get("session_id"))
    return {
        "applied": True,
        "suggestion_code": suggestion_code,
        "target_musicxml": new_xml,
        "issues": _serialize_issues(new_issues),
        "musicxml_error": traceback_text,
        "can_undo": len(sess.history) > 0,
        "can_redo": len(sess.redo_stack) > 0,
    }


def _method_list_measure_events(params: dict[str, Any]) -> dict:
    """列出 target_score 指定 (part_id, measure) 的所有事件,供編輯面板使用。"""
    sess = _session(params)
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")

    measure_num = int(params["measure"])
    part_id = params.get("part_id")  # None = 所有 parts

    from core.ir import ChordEvent, NoteEvent, RestEvent
    result: list[dict] = []
    for part in sess.current_arrangement.target_score.parts:
        if part_id and part.part_id != part_id:
            continue
        for measure in part.measures:
            if measure.number != measure_num:
                continue
            for voice_id, voice in measure.voices.items():
                if voice.is_divisi:
                    continue
                for idx, event in enumerate(voice.events):
                    entry = {
                        "part_id": part.part_id,
                        "voice_id": voice_id,
                        "event_index": idx,
                        "onset": str(event.onset),
                        "duration": str(event.duration),
                    }
                    if isinstance(event, NoteEvent):
                        entry["kind"] = "note"
                        entry["pitch"] = event.pitch.spelling
                        entry["midi"] = event.pitch.midi_number
                        entry["dynamic"] = event.dynamic
                        entry["articulations"] = list(event.articulations)
                        entry["is_locked"] = event.is_locked
                    elif isinstance(event, ChordEvent):
                        entry["kind"] = "chord"
                        entry["pitches"] = [p.spelling for p in event.pitches]
                        entry["midis"] = [p.midi_number for p in event.pitches]
                        entry["dynamic"] = event.dynamic
                        entry["articulations"] = list(event.articulations)
                        entry["is_locked"] = event.is_locked
                    elif isinstance(event, RestEvent):
                        entry["kind"] = "rest"
                    result.append(entry)
    return {"events": result, "measure": measure_num}


def _method_set_measure_articulation(params: dict[str, Any]) -> dict:
    """對一個 part 的整個 measure 套用 articulation (staccato / legato / pizzicato).

    參數:
      part_id, measure, articulation (string), voice_id (optional, 預設 1)
      mode: "set" (取代既有) | "add" (附加) | "clear" (移除所有)

    Side effect: 寫 history, 觸發 target_score 重新匯出.
    """
    import copy as _copy
    sess = _session(params)
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")

    part_id = params["part_id"]
    measure_num = int(params["measure"])
    voice_id = int(params.get("voice_id", 1))
    articulation = params.get("articulation", "")
    mode = params.get("mode", "set")

    target = sess.current_arrangement.target_score
    from core.ir import ChordEvent, NoteEvent

    part = next((p for p in target.parts if p.part_id == part_id), None)
    if part is None:
        raise ValueError(f"找不到 part_id={part_id}")
    measure = next((m for m in part.measures if m.number == measure_num), None)
    if measure is None:
        raise ValueError(f"找不到 m.{measure_num}")
    voice = measure.voices.get(voice_id)
    if voice is None:
        return {"changed": 0, "target_musicxml": None}

    # history snapshot
    new_history = list(sess.history)
    new_history.append(_copy.deepcopy(target))
    if len(new_history) > _HISTORY_LIMIT:
        new_history = new_history[-_HISTORY_LIMIT:]
    sess.history = new_history
    sess.redo_stack = []

    changed = 0
    for ev in voice.events:
        if not isinstance(ev, (NoteEvent, ChordEvent)):
            continue
        if mode == "clear":
            if ev.articulations:
                ev.articulations = []
                changed += 1
        elif mode == "set":
            new_list = [articulation] if articulation else []
            if ev.articulations != new_list:
                ev.articulations = new_list
                changed += 1
        elif mode == "add":
            if articulation and articulation not in ev.articulations:
                ev.articulations.append(articulation)
                changed += 1

    target_xml = None
    try:
        target_xml = write_musicxml_string(target)
    except Exception:
        target_xml = None
    _persist_session(params.get("session_id"))

    return {
        "changed": changed,
        "target_musicxml": target_xml,
        "issues": _serialize_issues(collect_issues(target)),
        "can_undo": len(sess.history) > 0,
        "can_redo": len(sess.redo_stack) > 0,
    }


def _method_edit_event(params: dict[str, Any]) -> dict:
    """編輯 target_score 中的單一事件。

    action:
      - "octave_up" / "octave_down": ±12 半音
      - "transpose": ±N 半音 (params["semitones"])
      - "delete": 替換為 RestEvent
      - "set_dynamic": params["dynamic"] = "p" / "mf" / etc.
      - "toggle_articulation": params["articulation"] toggle 加/刪
    """
    import copy as _copy
    sess = _session(params)
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")

    part_id = params["part_id"]
    measure_num = int(params["measure"])
    voice_id = int(params.get("voice_id", 1))
    event_index = int(params.get("event_index", 0))
    action = params["action"]

    target = sess.current_arrangement.target_score
    from core.ir import ChordEvent, NoteEvent, Pitch, RestEvent

    part = next((p for p in target.parts if p.part_id == part_id), None)
    if part is None:
        raise ValueError(f"找不到 part_id={part_id}")
    measure = next((m for m in part.measures if m.number == measure_num), None)
    if measure is None:
        raise ValueError(f"找不到 m.{measure_num}")
    voice = measure.voices.get(voice_id)
    if voice is None or event_index >= len(voice.events):
        raise ValueError(f"找不到 voice {voice_id} #{event_index}")

    # history snapshot 在改動前
    new_history = list(sess.history)
    new_history.append(_copy.deepcopy(target))
    if len(new_history) > _HISTORY_LIMIT:
        new_history = new_history[-_HISTORY_LIMIT:]
    sess.history = new_history
    sess.redo_stack = []

    event = voice.events[event_index]

    def shift_midi(midi: int, delta: int) -> int:
        return max(0, min(127, midi + delta))

    def shift_pitch(p: Pitch, delta_semitones: int) -> Pitch:
        new_midi = shift_midi(p.midi_number, delta_semitones)
        # 簡化拼寫: 用八度位移更新數字
        import re as _re
        m = _re.match(r"^([A-G][#b]*)(\-?\d+)$", p.spelling)
        if m and abs(delta_semitones) % 12 == 0:
            name, octave = m.groups()
            new_octave = int(octave) + (delta_semitones // 12)
            return Pitch(midi_number=new_midi, spelling=f"{name}{new_octave}")
        # 非整數八度的拼寫不重要,fallback 用 MIDI → 拼寫
        names = ["C", "C#", "D", "Eb", "E", "F", "F#",
                 "G", "Ab", "A", "Bb", "B"]
        return Pitch(
            midi_number=new_midi,
            spelling=f"{names[new_midi % 12]}{new_midi // 12 - 1}",
        )

    if action in ("octave_up", "octave_down", "transpose"):
        delta = 12 if action == "octave_up" \
            else -12 if action == "octave_down" \
            else int(params.get("semitones", 0))
        if isinstance(event, NoteEvent):
            event.pitch = shift_pitch(event.pitch, delta)
        elif isinstance(event, ChordEvent):
            event.pitches = [shift_pitch(p, delta) for p in event.pitches]

    elif action == "delete":
        voice.events[event_index] = RestEvent(
            duration=event.duration, onset=event.onset,
        )

    elif action == "set_dynamic":
        new_dyn = params.get("dynamic")
        if isinstance(event, (NoteEvent, ChordEvent)):
            event.dynamic = new_dyn

    elif action == "toggle_articulation":
        art = params.get("articulation")
        if isinstance(event, (NoteEvent, ChordEvent)) and art:
            if art in event.articulations:
                event.articulations.remove(art)
            else:
                event.articulations.append(art)

    elif action == "toggle_lock":
        # 使用者鎖定/解鎖此事件 — 鎖定後 repair 不會覆寫
        if isinstance(event, (NoteEvent, ChordEvent)):
            event.is_locked = not getattr(event, "is_locked", False)

    elif action in ("halve_duration", "double_duration",
                    "add_dot", "remove_dot"):
        # 節奏編輯: 只改 event.duration, 但要小心溢出小節 → 必要時用 RestEvent
        # 補足空缺或截斷.
        from fractions import Fraction as _F
        cur = event.duration
        if action == "halve_duration":
            new_dur = cur / 2
        elif action == "double_duration":
            new_dur = cur * 2
        elif action == "add_dot":
            # 附點: dur * 3/2
            new_dur = cur * _F(3, 2)
        else:  # remove_dot
            # 解附點: dur * 2/3 (只有原本是 3/2 倍數時才合理)
            new_dur = cur * _F(2, 3)
        # 計算後面其他事件的總長
        rest_after = sum(
            (e.duration for e in voice.events[event_index + 1:]),
            _F(0),
        )
        # 預估該小節容量 (簡化: 用 time_signature)
        ts = measure.time_signature or (4, 4)
        bar_capacity = _F(ts[0], ts[1]) * 4
        before_total = sum(
            (e.duration for e in voice.events[:event_index]), _F(0),
        )
        max_for_this = bar_capacity - before_total
        if new_dur > max_for_this:
            new_dur = max_for_this
        if new_dur <= 0:
            sess.history = sess.history[:-1]
            raise ValueError("時值改變後 <=0, 取消操作")
        event.duration = new_dur
        # 如果新時值縮短: 在後面插 RestEvent 補足 (避免後面音符提前進入)
        # 如果新時值加長: 砍掉被覆蓋的後面事件
        new_after = max_for_this - new_dur
        if new_after < rest_after:
            # 砍掉部分後面事件直到不超過 new_after
            running = _F(0)
            keep_idx = event_index + 1
            for j in range(event_index + 1, len(voice.events)):
                running += voice.events[j].duration
                if running > new_after:
                    keep_idx = j
                    break
                keep_idx = j + 1
            voice.events = voice.events[:keep_idx]
            running = sum(
                (e.duration for e in voice.events[event_index + 1:]),
                _F(0),
            )
            if running < new_after:
                # 補一個 rest 填滿
                from core.ir import RestEvent as _R
                voice.events.append(_R(
                    duration=new_after - running,
                    onset=event.onset + new_dur + running,
                ))
        elif new_after > rest_after:
            # 縮短了 → 補 rest
            from core.ir import RestEvent as _R
            voice.events.insert(event_index + 1, _R(
                duration=new_after - rest_after,
                onset=event.onset + new_dur,
            ))

    else:
        # 回滾 history
        sess.history = sess.history[:-1]
        raise ValueError(f"未知 action: {action}")

    new_issues = collect_issues(target)
    try:
        new_xml = write_musicxml_string(target)
    except Exception:
        new_xml = None

    _persist_session(params.get("session_id"))
    return {
        "edited": True,
        "action": action,
        "target_musicxml": new_xml,
        "issues": _serialize_issues(new_issues),
        "can_undo": len(sess.history) > 0,
        "can_redo": len(sess.redo_stack) > 0,
    }


# 自然語言改譜可用的 articulation / dynamic 白名單 — 拒絕 LLM 幻覺值
_NL_ARTICULATIONS = {
    "staccato", "staccatissimo", "tenuto", "accent",
    "marcato", "spiccato", "legato", "pizzicato",
}
_NL_DYNAMICS = {"ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sf", "fp"}


def _method_apply_edit_ops(params: dict[str, Any]) -> dict:
    """套用一批「自然語言改譜」操作 — 由 LLM 產生, 使用者確認後送出。

    params["ops"]: list[dict], 每個 op 為以下之一 (皆作用於 measure 區間):
      - {"op": "transpose",    part_id, measure_start, measure_end,
         semitones}            — 區間內所有音符 / 和弦移調
      - {"op": "articulation", part_id, measure_start, measure_end,
         articulation, mode}   — set / add / clear 演奏法
      - {"op": "dynamic",      part_id, measure_start, measure_end,
         dynamic}              — 區間內所有音符 / 和弦設定力度
      - {"op": "rest",         part_id, measure_start, measure_end}
                               — 區間內所有音符 / 和弦變成休止符

    語意:
      - 整批 ops 共用「一次」history snapshot → 一次 undo 可全部還原
      - 任何一個 op 驗證失敗 → 整批拒絕, 不留半套狀態
      - 鎖定 (is_locked) 的事件一律跳過, 不被批次操作覆寫
    回傳每個 op 實際影響的事件數 + 新 target_musicxml + issues。
    """
    import copy as _copy
    import re as _re
    sess = _session(params)
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")

    ops = params.get("ops") or []
    if not isinstance(ops, list) or not ops:
        raise ValueError("ops 為空")

    target = sess.current_arrangement.target_score
    from core.ir import ChordEvent, NoteEvent, Pitch, RestEvent

    _names = ["C", "C#", "D", "Eb", "E", "F", "F#",
              "G", "Ab", "A", "Bb", "B"]

    def shift_pitch(p: Pitch, delta: int) -> Pitch:
        new_midi = max(0, min(127, p.midi_number + delta))
        m = _re.match(r"^([A-G][#b]*)(\-?\d+)$", p.spelling)
        if m and abs(delta) % 12 == 0:
            name, octave = m.groups()
            return Pitch(
                midi_number=new_midi,
                spelling=f"{name}{int(octave) + delta // 12}",
            )
        return Pitch(
            midi_number=new_midi,
            spelling=f"{_names[new_midi % 12]}{new_midi // 12 - 1}",
        )

    def part_by_id(pid: str):
        return next((p for p in target.parts if p.part_id == pid), None)

    # ── 階段一: 驗證全部 ops (整批 all-or-nothing) ────────────────────
    for i, op in enumerate(ops):
        if not isinstance(op, dict):
            raise ValueError(f"op #{i}: 格式錯誤")
        kind = op.get("op")
        if kind not in ("transpose", "articulation", "dynamic", "rest"):
            raise ValueError(f"op #{i}: 未知 op 類型 {kind!r}")
        if part_by_id(op.get("part_id", "")) is None:
            raise ValueError(
                f"op #{i}: 找不到 part_id={op.get('part_id')!r}")
        try:
            m_start = int(op["measure_start"])
            m_end = int(op["measure_end"])
        except (KeyError, TypeError, ValueError):
            raise ValueError(
                f"op #{i}: measure_start/measure_end 無效",
            ) from None
        if m_start > m_end:
            raise ValueError(f"op #{i}: measure_start > measure_end")
        if kind == "transpose":
            if not isinstance(op.get("semitones"), int):
                raise ValueError(f"op #{i}: transpose 缺整數 semitones")
            if not -48 <= op["semitones"] <= 48:
                raise ValueError(f"op #{i}: semitones 超出 ±48 範圍")
        elif kind == "articulation":
            mode = op.get("mode", "set")
            if mode not in ("set", "add", "clear"):
                raise ValueError(f"op #{i}: 無效 mode {mode!r}")
            art = op.get("articulation", "")
            if mode != "clear" and art not in _NL_ARTICULATIONS:
                raise ValueError(
                    f"op #{i}: 無效 articulation {art!r}")
        elif kind == "dynamic":
            if op.get("dynamic") not in _NL_DYNAMICS:
                raise ValueError(
                    f"op #{i}: 無效 dynamic {op.get('dynamic')!r}")

    # ── 階段二: 一次 history snapshot, 然後套用 ───────────────────────
    new_history = list(sess.history)
    new_history.append(_copy.deepcopy(target))
    if len(new_history) > _HISTORY_LIMIT:
        new_history = new_history[-_HISTORY_LIMIT:]
    sess.history = new_history
    sess.redo_stack = []

    results: list[dict] = []
    for op in ops:
        kind = op["op"]
        part = part_by_id(op["part_id"])
        m_start = int(op["measure_start"])
        m_end = int(op["measure_end"])
        changed = 0
        for measure in part.measures:
            if not m_start <= measure.number <= m_end:
                continue
            for voice in measure.voices.values():
                if getattr(voice, "is_divisi", False):
                    continue
                for idx, ev in enumerate(voice.events):
                    if not isinstance(ev, (NoteEvent, ChordEvent)):
                        continue
                    if getattr(ev, "is_locked", False):
                        continue
                    if kind == "transpose":
                        delta = int(op["semitones"])
                        if isinstance(ev, NoteEvent):
                            ev.pitch = shift_pitch(ev.pitch, delta)
                        else:
                            ev.pitches = [
                                shift_pitch(p, delta) for p in ev.pitches
                            ]
                        changed += 1
                    elif kind == "articulation":
                        mode = op.get("mode", "set")
                        art = op.get("articulation", "")
                        if mode == "clear":
                            if ev.articulations:
                                ev.articulations = []
                                changed += 1
                        elif mode == "set":
                            new_list = [art] if art else []
                            if ev.articulations != new_list:
                                ev.articulations = new_list
                                changed += 1
                        elif art and art not in ev.articulations:
                            ev.articulations.append(art)
                            changed += 1
                    elif kind == "dynamic":
                        if ev.dynamic != op["dynamic"]:
                            ev.dynamic = op["dynamic"]
                            changed += 1
                    elif kind == "rest":
                        voice.events[idx] = RestEvent(
                            duration=ev.duration, onset=ev.onset,
                        )
                        changed += 1
        results.append({
            "op": kind,
            "part_id": op["part_id"],
            "measure_start": m_start,
            "measure_end": m_end,
            "changed": changed,
        })

    try:
        new_xml = write_musicxml_string(target)
    except Exception:
        new_xml = None

    _persist_session(params.get("session_id"))
    return {
        "applied": True,
        "results": results,
        "target_musicxml": new_xml,
        "issues": _serialize_issues(collect_issues(target)),
        "can_undo": len(sess.history) > 0,
        "can_redo": len(sess.redo_stack) > 0,
    }


def _method_reassign(params: dict[str, Any]) -> dict:
    """把指定 source_part_id 改路由到新的 (target_player_id, target_staff)。

    需要 arrangement.source_score 存在 (Phase 1 的 arrange 已保留)。
    重建整個 target_score, 並推入 history 以供 undo。
    """
    import copy as _copy
    sess = _session(params)
    arrangement = sess.current_arrangement
    if arrangement is None or arrangement.target_score is None:
        raise ValueError("尚無 arrangement; 請先呼叫 arrange")
    if arrangement.source_score is None:
        raise ValueError(
            "此 arrangement 缺少 source_score (可能是舊版 .sarr 載入,"
            "請重新執行 arrange)"
        )

    source_part_id = params["source_part_id"]
    target_player_id = params["target_player_id"]
    target_staff = params.get("target_staff", "main")

    # 找對應 assignments
    matching = [
        a for a in arrangement.assignments
        if a.source_part_id == source_part_id
    ]
    if not matching:
        raise ValueError(
            f"找不到 source_part_id={source_part_id} 的 assignment"
        )

    # 驗證目標 player 存在
    target_player = next(
        (p for p in arrangement.players if p.player_id == target_player_id),
        None,
    )
    if target_player is None:
        raise ValueError(f"找不到 player_id={target_player_id}")

    # history snapshot (在改動前)
    new_history = list(sess.history)
    new_history.append(_copy.deepcopy(arrangement.target_score))
    if len(new_history) > _HISTORY_LIMIT:
        new_history = new_history[-_HISTORY_LIMIT:]
    sess.history = new_history
    sess.redo_stack = []

    # 更新 assignment
    for a in matching:
        a.target_player_id = target_player_id
        a.target_staff = target_staff  # type: ignore
        a.target_instrument = target_player.primary_instrument
        a.is_user_edited = True

    # 重建 target_score
    from core.arranger import build_target_score
    from core.ir import Section as _Section
    spans = [a.span for a in arrangement.assignments]
    if spans:
        start_m = min(s[0] for s in spans)
        end_m = max(s[1] for s in spans)
    else:
        start_m, end_m = 1, 1
    section = _Section(
        section_id=0, start_measure=start_m, end_measure=end_m,
    )
    arrangement.target_score = build_target_score(
        arrangement.source_score,
        arrangement.players,
        arrangement.assignments,
        section,
    )

    new_issues = collect_issues(arrangement.target_score)
    try:
        new_xml = write_musicxml_string(arrangement.target_score)
    except Exception:
        new_xml = None

    _persist_session(params.get("session_id"))
    return {
        "reassigned": True,
        "source_part_id": source_part_id,
        "target_player_id": target_player_id,
        "target_staff": target_staff,
        "target_musicxml": new_xml,
        "issues": _serialize_issues(new_issues),
        "can_undo": len(sess.history) > 0,
        "can_redo": len(sess.redo_stack) > 0,
    }


def _method_preview_suggestion(params: dict[str, Any]) -> dict:
    """在不修改 _CURRENT_ARRANGEMENT 的情況下預覽建議結果。

    用於 A/B 預覽: 使用者點建議後可先試聽,確認再呼叫 apply_suggestion。
    """
    sess = _session(params)
    import copy as _copy
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement; 請先呼叫 arrange")

    target_preview = _copy.deepcopy(sess.current_arrangement.target_score)
    part_id = params["part_id"]
    measure_num = int(params["measure"])
    voice_id = int(params.get("voice_id", 1))
    event_index = int(params.get("event_index", 0))
    suggestion_code = params["suggestion_code"]

    strategy = _SUGGESTION_STRATEGY.get(suggestion_code)
    if strategy is None:
        raise ValueError(f"不支援的 suggestion: {suggestion_code}")

    all_issues = collect_issues(target_preview)
    matching = [
        i for i in all_issues
        if i.part_id == part_id
        and i.measure_number == measure_num
        and i.voice_id == voice_id
        and i.event_index == event_index
    ]
    if not matching:
        raise ValueError(
            f"在 {part_id}/m.{measure_num}/v{voice_id}#{event_index} "
            f"找不到匹配的 issue"
        )

    success = strategy(target_preview, matching[0])
    if not success:
        return {
            "previewable": False,
            "reason": "策略無法套用 (條件不符)",
        }

    new_issues = collect_issues(target_preview)
    try:
        new_xml = write_musicxml_string(target_preview)
    except Exception:
        new_xml = None

    return {
        "previewable": True,
        "suggestion_code": suggestion_code,
        "target_musicxml": new_xml,
        "issues": _serialize_issues(new_issues),
    }


def _method_undo(params: dict[str, Any]) -> dict:
    """回上一步 arrangement.target_score。"""
    sess = _session(params)
    import copy as _copy
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")
    if not sess.history:
        raise ValueError("無可 undo 的狀態")

    # 將當前狀態推入 redo
    new_redo = list(sess.redo_stack)
    new_redo.append(_copy.deepcopy(sess.current_arrangement.target_score))
    sess.redo_stack = new_redo
    # 從歷史 pop 出最近狀態
    new_history = list(sess.history)
    sess.current_arrangement.target_score = new_history.pop()
    sess.history = new_history

    new_issues = collect_issues(sess.current_arrangement.target_score)
    try:
        new_xml = write_musicxml_string(sess.current_arrangement.target_score)
    except Exception:
        new_xml = None

    _persist_session(params.get("session_id"))
    return {
        "target_musicxml": new_xml,
        "issues": _serialize_issues(new_issues),
        "can_undo": len(sess.history) > 0,
        "can_redo": len(sess.redo_stack) > 0,
    }


def _method_redo(params: dict[str, Any]) -> dict:
    """前進至下一步 (僅在 undo 後可用)。"""
    sess = _session(params)
    import copy as _copy
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")
    if not sess.redo_stack:
        raise ValueError("無可 redo 的狀態")

    new_history = list(sess.history)
    new_history.append(_copy.deepcopy(sess.current_arrangement.target_score))
    sess.history = new_history
    new_redo = list(sess.redo_stack)
    sess.current_arrangement.target_score = new_redo.pop()
    sess.redo_stack = new_redo

    new_issues = collect_issues(sess.current_arrangement.target_score)
    try:
        new_xml = write_musicxml_string(sess.current_arrangement.target_score)
    except Exception:
        new_xml = None

    _persist_session(params.get("session_id"))
    return {
        "target_musicxml": new_xml,
        "issues": _serialize_issues(new_issues),
        "can_undo": len(sess.history) > 0,
        "can_redo": len(sess.redo_stack) > 0,
    }


def _method_history_status(params: dict[str, Any]) -> dict:
    sess = _session(params)
    return {
        "can_undo": len(sess.history) > 0,
        "can_redo": len(sess.redo_stack) > 0,
        "history_depth": len(sess.history),
        "redo_depth": len(sess.redo_stack),
    }


def _method_save_project(params: dict[str, Any]) -> dict:
    """把當前 arrangement + 來源路徑寫成 .sarr (JSON) 檔。"""
    from pathlib import Path
    sess = _session(params)
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement; 請先呼叫 arrange")

    output_path = params["path"]
    source_path = params.get("source_path", "")

    arrangement = sess.current_arrangement
    project = {
        "format": "score-arranger-project",
        "version": "0.1.0",
        "source_path": source_path,
        "arrangement": {
            "arrangement_id": arrangement.arrangement_id,
            "name": arrangement.name,
            "source_id": arrangement.source_id,
            "players": [
                {
                    "player_id": p.player_id,
                    "display_name": p.display_name,
                    "instruments": p.instruments,
                    "primary_instrument": p.primary_instrument,
                    "staves": p.staves,
                }
                for p in arrangement.players
            ],
            "assignments": [
                {
                    "assignment_id": a.assignment_id,
                    "source_part_id": a.source_part_id,
                    "target_player_id": a.target_player_id,
                    "target_instrument": a.target_instrument,
                    "target_staff": a.target_staff,
                    "span": list(a.span),
                    "function": a.function.value,
                    "is_user_edited": a.is_user_edited,
                }
                for a in arrangement.assignments
            ],
        },
        "target_score": to_dict(arrangement.target_score),
    }
    Path(output_path).write_text(
        json.dumps(project, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return {
        "saved_to": output_path,
        "size_bytes": Path(output_path).stat().st_size,
    }


def _method_load_project(params: dict[str, Any]) -> dict:
    """從 .sarr 檔載入。

    回傳 source_path + 解析出的 target_musicxml,以便前端立即渲染。
    伺服器端的 session.current_arrangement 也會被重建,但僅含 target_score
    (Phase 1 不還原完整 source IR,使用者若要進一步改編需重新呼叫 arrange)。
    """
    from pathlib import Path
    sess = _session(params)

    input_path = params["path"]
    raw = Path(input_path).read_text(encoding="utf-8")
    project = json.loads(raw)

    if project.get("format") != "score-arranger-project":
        raise ValueError("不是有效的 .sarr 專案檔")

    from core.ir_serialize import from_dict
    from core.arrangement_model import Arrangement, Player, Assignment
    from core.ir import VoiceFunction

    target_score = from_dict(project["target_score"])
    arr_data = project["arrangement"]
    players = [
        Player(
            player_id=p["player_id"],
            display_name=p["display_name"],
            instruments=p["instruments"],
            primary_instrument=p["primary_instrument"],
            staves=p["staves"],
        )
        for p in arr_data["players"]
    ]
    assignments = [
        Assignment(
            assignment_id=a["assignment_id"],
            source_part_id=a["source_part_id"],
            target_player_id=a["target_player_id"],
            target_instrument=a["target_instrument"],
            target_staff=a["target_staff"],
            span=tuple(a["span"]),
            function=VoiceFunction(a["function"]),
            is_user_edited=a.get("is_user_edited", False),
        )
        for a in arr_data["assignments"]
    ]

    arrangement = Arrangement(
        arrangement_id=arr_data["arrangement_id"],
        name=arr_data["name"],
        source_id=arr_data["source_id"],
        players=players,
        assignments=assignments,
        target_score=target_score,
    )
    sess.current_arrangement = arrangement
    sess.history = []
    sess.redo_stack = []

    target_xml = None
    try:
        target_xml = write_musicxml_string(target_score)
    except Exception:
        pass

    new_issues = collect_issues(target_score)

    return {
        "source_path": project.get("source_path", ""),
        "arrangement": {
            "arrangement_id": arrangement.arrangement_id,
            "name": arrangement.name,
            "source_id": arrangement.source_id,
            "players": arr_data["players"],
            "assignments": [
                {
                    "id": a.assignment_id,
                    "source_part": a.source_part_id,
                    "target": f"{a.target_player_id}/{a.target_staff}",
                    "function": a.function.value,
                    "span": list(a.span),
                }
                for a in arrangement.assignments
            ],
        },
        "target_musicxml": target_xml,
        "issues": _serialize_issues(new_issues),
    }


def _method_export_target_musicxml(params: dict[str, Any]) -> dict:
    """寫出當前 arrangement.target_score 為 MusicXML 檔。"""
    from pathlib import Path
    sess = _session(params)
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")
    output_path = params["path"]
    xml = write_musicxml_string(sess.current_arrangement.target_score)
    Path(output_path).write_text(xml, encoding="utf-8")
    return {
        "exported_to": output_path,
        "size_bytes": Path(output_path).stat().st_size,
    }


def _method_list_navigation(params: dict[str, Any]) -> dict:
    """回傳當前 arrangement 的 movements / sections / rehearsal marks。

    用於前端 SectionNavigator 下拉, jump 到指定小節。
    """
    sess = _session(params)
    arrangement = sess.current_arrangement
    if arrangement is None:
        return {"movements": [], "sections": [], "rehearsal_marks": []}
    score = arrangement.target_score or arrangement.source_score
    if score is None:
        return {"movements": [], "sections": [], "rehearsal_marks": []}

    movements = [
        {
            "movement_id": m.movement_id,
            "title": m.title or f"樂章 {m.movement_id}",
            "measure_count": m.measure_count,
            "sections": [
                {
                    "section_id": s.section_id,
                    "name": s.name or f"段 {s.section_id}",
                    "start": s.start_measure,
                    "end": s.end_measure,
                }
                for s in m.sections
            ],
        }
        for m in score.movements
    ]

    # 蒐集 rehearsal marks
    rehearsal: list[dict] = []
    seen: set[int] = set()
    for part in score.parts:
        for measure in part.measures:
            if measure.rehearsal_mark and measure.number not in seen:
                seen.add(measure.number)
                rehearsal.append({
                    "measure": measure.number,
                    "mark": measure.rehearsal_mark,
                })
    rehearsal.sort(key=lambda r: r["measure"])
    # 全曲總小節數 (fallback 當沒 movement 結構時)
    max_measure = max(
        (max((m.number for m in p.measures), default=0)
         for p in score.parts),
        default=0,
    )
    return {
        "movements": movements,
        "rehearsal_marks": rehearsal,
        "total_measures": max_measure,
    }


def _method_compute_quality(params: dict[str, Any]) -> dict:
    """計算改編品質 (melody/harmony/playability 三項分數)。

    需要 sess.current_arrangement 含 source_score 與 target_score。
    """
    sess = _session(params)
    arrangement = sess.current_arrangement
    if arrangement is None \
            or arrangement.target_score is None \
            or arrangement.source_score is None:
        return {}
    from core.quality import compute_quality, quality_to_dict
    try:
        issues = collect_issues(arrangement.target_score)
        report = compute_quality(
            arrangement.source_score,
            arrangement.target_score,
            issues,
        )
        return quality_to_dict(report)
    except Exception as e:
        return {"error": str(e)}


def _method_compute_difficulty(params: dict[str, Any]) -> dict:
    """為目前 arrangement 各 part 重新計算難度。

    回傳 { part_id: { score, label, factors, ... } }。
    """
    sess = _session(params)
    return _serialize_difficulty(sess.current_arrangement)


def _method_target_part_musicxml(params: dict[str, Any]) -> dict:
    """取得單一 player 的 MusicXML (只含該 player 對應的 target parts)。

    params: { "player_id": str } — 對應 Arrangement.players[i].player_id。
    回傳 { "musicxml": str, "player_id": str, "display_name": str }。
    """
    sess = _session(params)
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")
    player_id = params["player_id"]
    arrangement = sess.current_arrangement
    target_score = arrangement.target_score

    # 找出該 player
    player = next(
        (p for p in arrangement.players if p.player_id == player_id),
        None,
    )
    if player is None:
        raise ValueError(f"找不到 player_id: {player_id}")

    # 過濾出該 player 對應的 target Parts
    # Part.instrument_id 對應 player.primary_instrument; 但同一樂器多 player
    # 時要靠 part.part_id 命名規則 (build_target_score 寫成 f"{player_id}_{staff}")。
    matching_parts = []
    for p in target_score.parts:
        # part_id 形如 "violin_1_main" / "piano_1_upper" / "piano_1_lower"
        if p.part_id.startswith(f"{player_id}_") or p.part_id == player_id:
            matching_parts.append(p)
    if not matching_parts:
        raise ValueError(f"player {player_id} 沒有對應的 target parts")

    # 構造只含這些 parts 的 Score
    from copy import deepcopy
    from core.ir import Score as IrScore
    filtered = IrScore(
        metadata={
            **target_score.metadata,
            "title": (
                target_score.metadata.get("title", "")
                + f" — {player.display_name}"
            ).strip(" —"),
        },
        parts=[deepcopy(p) for p in matching_parts],
        movements=deepcopy(target_score.movements),
    )
    xml = write_musicxml_string(filtered)
    return {
        "musicxml": xml,
        "player_id": player_id,
        "display_name": player.display_name,
    }


def _method_export_target_midi(params: dict[str, Any]) -> dict:
    """寫出當前 arrangement.target_score 為 .mid 檔。"""
    from pathlib import Path
    sess = _session(params)
    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")
    output_path = params["path"]
    from core.ir_to_music21 import ir_to_music21
    m21 = ir_to_music21(sess.current_arrangement.target_score)
    m21.write("midi", fp=output_path)
    return {
        "exported_to": output_path,
        "size_bytes": Path(output_path).stat().st_size,
    }


def _method_to_midi(params: dict[str, Any]) -> dict:
    """匯出當前 arrangement.target_score 為 base64 MIDI 字串。

    Track 名稱會帶入 instrument_id (e.g. "violin", "piano"),
    供前端 PlaybackControls 路由到對應音色。
    """
    sess = _session(params)
    import base64
    import tempfile
    import os as _os

    if sess.current_arrangement is None \
            or sess.current_arrangement.target_score is None:
        raise ValueError("尚無 arrangement")

    from core.ir_to_music21 import ir_to_music21
    m21 = ir_to_music21(sess.current_arrangement.target_score)

    # 確保每個 part 有可辨識的 track name (對應 IR Part.instrument_id)
    for ir_part, m21_part in zip(
        sess.current_arrangement.target_score.parts, m21.parts,
    ):
        m21_part.partName = ir_part.instrument_id

    fd, path = tempfile.mkstemp(suffix=".mid")
    try:
        _os.close(fd)
        m21.write("midi", fp=path)
        with open(path, "rb") as f:
            data = f.read()
    finally:
        try:
            _os.unlink(path)
        except OSError:
            pass

    return {
        "midi_base64": base64.b64encode(data).decode("ascii"),
        "size_bytes": len(data),
    }


def _method_to_source_midi(params: dict[str, Any]) -> dict:
    """匯出 source 樂譜 (原譜) 為 base64 MIDI.

    優先順序:
      1. 若 session 內已有 arrangement.source_score → 用該 IR
      2. 否則用 params["path"] 重新 parse
    """
    sess = _session(params)
    import base64
    import tempfile
    import os as _os

    source_score = None
    if sess.current_arrangement is not None \
            and sess.current_arrangement.source_score is not None:
        source_score = sess.current_arrangement.source_score
    elif params.get("path"):
        source_score = parse_musicxml(params["path"])
    else:
        raise ValueError("尚無 source_score; 請提供 path 參數")

    from core.ir_to_music21 import ir_to_music21
    m21 = ir_to_music21(source_score)
    for ir_part, m21_part in zip(source_score.parts, m21.parts):
        m21_part.partName = ir_part.instrument_id

    fd, path = tempfile.mkstemp(suffix=".mid")
    try:
        _os.close(fd)
        m21.write("midi", fp=path)
        with open(path, "rb") as f:
            data = f.read()
    finally:
        try:
            _os.unlink(path)
        except OSError:
            pass

    return {
        "midi_base64": base64.b64encode(data).decode("ascii"),
        "size_bytes": len(data),
    }


def _method_analyze(params: dict[str, Any]) -> dict:
    """整合報告 (對應 CLI analyze)。"""
    from core.cli import _build_playability_report
    score = parse_musicxml(params["path"])
    validation = validate(score)
    phrase_data = _method_phrases(params)
    playability_data = _build_playability_report(score)
    return {
        "metadata": score.metadata,
        "summary": {
            "movement_count": len(score.movements),
            "measure_count": max(
                (len(p.measures) for p in score.parts), default=0,
            ),
            "part_count": len(score.parts),
            "parts": [
                {
                    "part_id": p.part_id,
                    "name": p.name_display,
                    "instrument_id": p.instrument_id,
                    "measure_count": len(p.measures),
                }
                for p in score.parts
            ],
        },
        "validation": {
            "ok": validation.ok,
            "error_count": len(validation.errors),
            "warning_count": len(validation.warnings),
            "errors": [
                {"code": e.code, "message": e.message, "location": e.location}
                for e in validation.errors
            ],
            "warnings": [
                {"code": w.code, "message": w.message, "location": w.location}
                for w in validation.warnings
            ],
        },
        "phrases": phrase_data,
        "playability": playability_data,
        "parse_warnings": score.parse_warnings,
    }


def _method_ping(_params: dict[str, Any]) -> dict:
    return {"pong": True, "version": SERVER_VERSION}


def _method_close_session(params: dict[str, Any]) -> dict:
    """關閉指定 session,釋放其 arrangement + history。

    對 default session 此操作不會清掉 module-level 變數 (避免影響舊 API)。
    """
    sid = params.get("session_id")
    if sid and sid != _DEFAULT_SESSION_ID:
        existed = sid in _SESSIONS_BY_ID
        if existed:
            del _SESSIONS_BY_ID[sid]
        _delete_session_disk(sid)
        return {"closed": existed, "session_id": sid}
    return {"closed": False, "reason": "session not found or default"}


METHODS: dict[str, Callable[[dict[str, Any]], Any]] = {
    "ping": _method_ping,
    "close_session": _method_close_session,
    "parse": _method_parse,
    "to_musicxml": _method_to_musicxml,
    "score_info": _method_score_info,
    "omr_status": _method_omr_status,
    "pdf_to_musicxml": _method_pdf_to_musicxml,
    "amt_status": _method_amt_status,
    "audio_to_musicxml": _method_audio_to_musicxml,
    "list_style_presets": _method_list_style_presets,
    "list_available_instruments": _method_list_available_instruments,
    "arrange_custom": _method_arrange_custom,
    "list_corpus": _method_list_corpus,
    "validate": _method_validate,
    "phrases": _method_phrases,
    "tag_functions": _method_tag_functions,
    "analyze_harmony": _method_analyze_harmony,
    "analyze": _method_analyze,
    "arrange": _method_arrange,
    "transcribe": _method_transcribe,
    "list_source_parts": _method_list_source_parts,
    "suggest_transposition": _method_suggest_transposition,
    "apply_suggestion": _method_apply_suggestion,
    "preview_suggestion": _method_preview_suggestion,
    "reassign": _method_reassign,
    "list_measure_events": _method_list_measure_events,
    "edit_event": _method_edit_event,
    "apply_edit_ops": _method_apply_edit_ops,
    "set_measure_articulation": _method_set_measure_articulation,
    "undo": _method_undo,
    "redo": _method_redo,
    "history_status": _method_history_status,
    "to_midi": _method_to_midi,
    "to_source_midi": _method_to_source_midi,
    "save_project": _method_save_project,
    "load_project": _method_load_project,
    "export_target_musicxml": _method_export_target_musicxml,
    "export_target_midi": _method_export_target_midi,
    "target_part_musicxml": _method_target_part_musicxml,
    "compute_difficulty": _method_compute_difficulty,
    "compute_quality": _method_compute_quality,
    "list_navigation": _method_list_navigation,
}


# ============================================================================
# Helpers
# ============================================================================

def _ensure_default_sections(score: Score) -> list[Section]:
    sections: list[Section] = []
    measure_count = max((len(p.measures) for p in score.parts), default=0)
    for movement in score.movements:
        if movement.sections:
            sections.extend(movement.sections)
        elif measure_count > 0:
            sections.append(Section(
                section_id=movement.movement_id,
                name=movement.title or f"Movement {movement.movement_id}",
                start_measure=1,
                end_measure=measure_count,
            ))
    if not sections and measure_count > 0:
        sections.append(Section(
            section_id=0, start_measure=1, end_measure=measure_count,
        ))
    return sections


# ============================================================================
# Main loop
# ============================================================================

def handle_request(request: dict[str, Any]) -> dict[str, Any]:
    """處理單一請求,回傳 response dict (不寫出)。"""
    req_id = request.get("id", "")
    method_name = request.get("method")
    params = request.get("params") or {}

    if not method_name:
        return {"id": req_id, "ok": False, "error": "missing 'method'"}
    method = METHODS.get(method_name)
    if method is None:
        return {
            "id": req_id, "ok": False,
            "error": f"unknown method: {method_name}",
        }

    try:
        data = method(params)
        return {"id": req_id, "ok": True, "data": data}
    except Exception as e:
        return {
            "id": req_id,
            "ok": False,
            "error": f"{type(e).__name__}: {e}",
            "traceback": traceback.format_exc(),
        }


def serve(stdin=None, stdout=None) -> None:
    """從 stdin 讀 JSON-line 請求, 寫 JSON-line 回應到 stdout。"""
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout

    # ready 訊息
    print(json.dumps({"type": "ready", "version": SERVER_VERSION}), file=stdout, flush=True)

    for raw_line in stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            response = {"id": "", "ok": False, "error": f"invalid JSON: {e}"}
        else:
            response = handle_request(request)

        print(json.dumps(response, ensure_ascii=False), file=stdout, flush=True)


if __name__ == "__main__":
    serve()

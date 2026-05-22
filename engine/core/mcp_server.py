"""
MCP Server — 暴露 Score Arranger engine 給外部 LLM (Claude Desktop / Cursor 等)

定位:
- 不是 Electron app 的替代; 是 *第二個 entry point*, 讓 AI 透過 Model Context
  Protocol 直接呼叫改編引擎, 不需要打開 GUI。
- Use case: "幫我把 Bach BWV 66.6 改編成弦樂四重奏, 存到桌面" — Claude Desktop
  接到請求後依序呼叫:
    1. list_corpus / parse_score
    2. arrange_score
    3. apply_repair (optional)
    4. get_metrics
    5. export_score
  最後使用者拿到一個 .musicxml 檔。

啟動 (從 engine 目錄):
    .venv/bin/python -m core.mcp_server

Claude Desktop 設定 (~/Library/Application Support/Claude/claude_desktop_config.json):
    {
      "mcpServers": {
        "score-arranger": {
          "command": "/Users/kevinlin/樂譜改編/engine/.venv/bin/python",
          "args": ["-m", "core.mcp_server"],
          "cwd": "/Users/kevinlin/樂譜改編/engine"
        }
      }
    }

設計選擇:
- session_id 預設 "mcp-default", 讓多個 tool call 串起來;
  stateful tool 可帶 session_id 參數 → 並行多個改編 workspace (A/B 比較)
- 直接 import core.server.handle_request 重用既有 dispatcher (DRY)
- Tools 命名以「動作 + 對象」風格, 對 LLM 更直覺
- 另提供 MCP Prompts (analyze_unplayable / suggest_reduction /
  compare_ensembles) 把常用工作場景封裝成模板
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

import mcp.types as types
from mcp.server import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

from core.server import handle_request


# 預設 session_id — tool 未指定 session_id 時使用, 讓 tool calls 串聯。
# tool 可帶 session_id 參數 → 並行多個改編 workspace (A/B 比較)。
_SESSION_ID = "mcp-default"

# 給 tool inputSchema 重用的 session_id 屬性定義
_SESSION_ID_PROP = {
    "session_id": {
        "type": "string",
        "description": (
            "工作區 ID。省略 = 'mcp-default'。用不同 ID 可並行多個改編 "
            "(例如同時比較弦樂四重奏 vs 木管五重奏的結果)。"
        ),
    },
}


# ============================================================================
# Tool definitions
# ============================================================================

ENSEMBLES = [
    "violin_piano",
    "string_quartet",
    "piano_solo",
    "woodwind_quintet",
    "brass_quintet",
]


TOOLS: list[types.Tool] = [
    types.Tool(
        name="list_corpus",
        description=(
            "列出 music21 內建可用的古典樂譜 (Bach, Mozart, Beethoven, Schubert 等). "
            "每筆結果含 corpus_path (e.g. 'bach/bwv66.6') 與 display_name."
        ),
        inputSchema={
            "type": "object",
            "properties": {},
        },
    ),
    types.Tool(
        name="arrange_and_export",
        description=(
            "**一次完成改編工作流** — 從輸入 (corpus path 或本機 MusicXML 檔) "
            "解析 → 自動分析聲部 → 改編到目標編制 → 修復可演奏性問題 → 匯出檔案。"
            "回傳: { output_path, target_path, issue_count, quality }. "
            "適合單次自動化呼叫, 不需逐步控制時用這個."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": (
                        "來源樂譜. 用 'corpus:bach/bwv66.6' 引用 music21 corpus, "
                        "或直接給本機 .musicxml/.xml 檔的絕對路徑."
                    ),
                },
                "target_ensemble": {
                    "type": "string",
                    "enum": ENSEMBLES,
                    "description": (
                        "目標編制. violin_piano=小提琴+鋼琴, string_quartet=弦樂四重奏, "
                        "piano_solo=鋼琴獨奏, woodwind_quintet=木管五重奏, "
                        "brass_quintet=銅管五重奏."
                    ),
                },
                "output_path": {
                    "type": "string",
                    "description": (
                        "輸出檔絕對路徑. 副檔名決定格式 (.musicxml / .xml / .mid)."
                    ),
                },
                "repair": {
                    "type": "boolean",
                    "default": True,
                    "description": "是否自動跑修復迴圈 (預設 true).",
                },
                **_SESSION_ID_PROP,
            },
            "required": ["source", "target_ensemble", "output_path"],
        },
    ),
    types.Tool(
        name="analyze_score",
        description=(
            "對一份樂譜跑完整分析: 偵測樂句邊界、標記聲部功能 (主旋律/低音/和聲填充等)、"
            "和聲分析、各 part 的可演奏性 issues. 不會改變 session state."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": (
                        "'corpus:bach/bwv66.6' 或本機路徑."
                    ),
                },
            },
            "required": ["source"],
        },
    ),
    types.Tool(
        name="arrange_score",
        description=(
            "改編一份樂譜到指定編制, 結果保存於目前 session (可後續 edit/export). "
            "需要先 call 過或這次呼叫指定 source. "
            "回傳: { arrangement: { players, assignments, name }, "
            "target_musicxml (字串), issues, metrics }."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "'corpus:...' 或本機路徑.",
                },
                "target_ensemble": {
                    "type": "string",
                    "enum": ENSEMBLES,
                },
                "repair": {"type": "boolean", "default": True},
                **_SESSION_ID_PROP,
            },
            "required": ["source", "target_ensemble"],
        },
    ),
    types.Tool(
        name="get_arrangement_status",
        description=(
            "取得當前 session 改編結果的快照: target_musicxml, assignments, "
            "未解決的 issues 列表, 品質 metric, 各 part 難度. "
            "若尚未改編 (arrange_score 還沒 call), 回傳空狀態."
        ),
        inputSchema={
            "type": "object",
            "properties": {**_SESSION_ID_PROP},
        },
    ),
    types.Tool(
        name="apply_suggestion",
        description=(
            "對某個 issue 套用一個修復建議. 通常在 LLM 看了 issues 後, 想精確控制"
            "某條的修法時用; 大部分情況用 arrange_and_export 或 arrange_score "
            "搭配 repair=true 即可."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "part_id": {"type": "string"},
                "measure": {"type": "integer"},
                "voice_id": {"type": "integer"},
                "event_index": {"type": "integer"},
                "suggestion_code": {
                    "type": "string",
                    "description": "e.g. 'S_OCTAVE_DOWN', 'S_OMIT_NOTE'.",
                },
                **_SESSION_ID_PROP,
            },
            "required": [
                "part_id", "measure", "voice_id",
                "event_index", "suggestion_code",
            ],
        },
    ),
    types.Tool(
        name="edit_event",
        description=(
            "編輯目前 arrangement 內的單一事件 (transpose 半音 / 移八度 / 改力度 / "
            "改時值 / 刪除). 用於 LLM 想做精細手動微調時."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "part_id": {"type": "string"},
                "measure": {"type": "integer"},
                "voice_id": {"type": "integer"},
                "event_index": {"type": "integer"},
                "action": {
                    "type": "string",
                    "enum": [
                        "transpose", "octave_up", "octave_down",
                        "set_dynamic", "delete",
                        "halve_duration", "double_duration",
                        "add_dot", "remove_dot",
                    ],
                },
                "extra": {
                    "type": "object",
                    "description": (
                        "對應 action 的額外參數. transpose 用 {semitones: N}, "
                        "set_dynamic 用 {dynamic: 'mf'} 等."
                    ),
                },
                **_SESSION_ID_PROP,
            },
            "required": ["part_id", "measure", "voice_id",
                         "event_index", "action"],
        },
    ),
    types.Tool(
        name="export_arrangement",
        description=(
            "把當前 session 的改編結果寫到磁碟. 副檔名決定格式: "
            ".musicxml/.xml → MusicXML; .mid → MIDI."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "output_path": {
                    "type": "string",
                    "description": "絕對路徑.",
                },
                **_SESSION_ID_PROP,
            },
            "required": ["output_path"],
        },
    ),
    types.Tool(
        name="transcribe_score",
        description=(
            "**樂器替換 + 移調** (跟 arrange 並列的第二種改編模式)。"
            "把 source 的某些 parts 換到另一種樂器, 並自動處理移調與音域. "
            "適用情境: Bach 大提琴組曲 → 小提琴版, 小提琴協奏曲 → 中提琴版, "
            "弦樂四重奏 → 木管四重奏 等. "
            "結果存至 session, 可後續 edit / export / 等。"
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "'corpus:bach/cello/...' 或本機路徑.",
                },
                "mapping": {
                    "type": "object",
                    "description": (
                        "Key 為 part_id 或 canonical instrument_id "
                        "(e.g. 'cello' 或 'violin_1'). Value 為 "
                        "{ instrument: target_id, semitones?: int, "
                        "fit_to_range?: bool, preserve_octave?: bool }. "
                        "semitones 留空則自動推算 (cello→violin 預設 +19 等). "
                        "part_id 比 instrument_id 優先, 適合協奏曲只動獨奏的場景."
                    ),
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "instrument": {"type": "string"},
                            "semitones": {"type": ["integer", "null"]},
                            "fit_to_range": {"type": "boolean"},
                            "preserve_octave": {"type": "boolean"},
                        },
                        "required": ["instrument"],
                    },
                },
                **_SESSION_ID_PROP,
            },
            "required": ["source", "mapping"],
        },
    ),
    types.Tool(
        name="list_source_parts",
        description=(
            "列出指定樂譜的所有 part 與其樂器 (含 part_id, instrument_id, "
            "display_name). 設計 transcribe mapping 之前先 call 這個."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "source": {"type": "string"},
            },
            "required": ["source"],
        },
    ),
    types.Tool(
        name="suggest_transposition",
        description=(
            "推算 (source_instrument → target_instrument) 的合理移調半音數. "
            "優先查慣例表 (cello→violin = +19 等), 否則用兩樂器音域中位差."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "source": {"type": "string"},
                "target": {"type": "string"},
            },
            "required": ["source", "target"],
        },
    ),
    types.Tool(
        name="export_all_parts",
        description=(
            "**分譜匯出** — 對改編結果的每位演奏者各寫一個 .musicxml 檔到指定資料夾, "
            "適合給演奏團體 (每人拿自己那份)。檔名為 '{player_display_name}.musicxml' "
            "(空白會被換成底線). 回傳寫出的所有路徑清單. "
            "PDF 版分譜目前需在 GUI 內匯出 (verovio 在 renderer 跑)."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "output_dir": {
                    "type": "string",
                    "description": (
                        "輸出資料夾絕對路徑. 不存在會建立."
                    ),
                },
                **_SESSION_ID_PROP,
            },
            "required": ["output_dir"],
        },
    ),
    types.Tool(
        name="apply_edit_ops",
        description=(
            "**批次套用結構化編輯** — 對目前 session 改編結果套用一組編輯操作, "
            "整批一次套用、一次可復原 (undo). 8 種操作:\n"
            "  transpose: 移調區間音符 (semitones ±48)\n"
            "  articulation: 設定演奏法 (staccato/spiccato/legato/...; "
            "mode=set/add/clear)\n"
            "  dynamic: 設定力度 (pp/p/mp/mf/f/ff/...)\n"
            "  rest: 把區間清成休止符\n"
            "  reassign: 把來源聲部重新分配給其他演奏者 / 譜表\n"
            "  enrich: 加厚 — 從原曲和聲補和弦 "
            "(density=light/medium/full, texture=block/arpeggio/strum/octave)\n"
            "  simplify: 降難度 — 和弦瘦身 / 八度收摺 / 去裝飾 / 簡化弓法 "
            "(level=light/medium/full; 旋律保留)\n"
            "  level: 抹平到目標難度 (target_difficulty 1-5; 雙向收斂, "
            "自動加厚或簡化)\n"
            "全部經樂器可演奏性檢查. 適合 agent 規劃完整改編工作流."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "ops": {
                    "type": "array",
                    "description": (
                        "編輯操作清單 — 整批 all-or-nothing, "
                        "任一個無效則整批拒絕."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "op": {
                                "type": "string",
                                "enum": [
                                    "transpose", "articulation", "dynamic",
                                    "rest", "reassign", "enrich",
                                    "simplify", "level",
                                ],
                            },
                            "part_id": {"type": "string"},
                            "measure_start": {"type": "integer"},
                            "measure_end": {"type": "integer"},
                            "semitones": {"type": "integer"},
                            "articulation": {"type": "string"},
                            "mode": {
                                "type": "string",
                                "enum": ["set", "add", "clear"],
                            },
                            "dynamic": {"type": "string"},
                            "source_part_id": {"type": "string"},
                            "target_part_id": {"type": "string"},
                            "density": {
                                "type": "string",
                                "enum": ["light", "medium", "full"],
                            },
                            "texture": {
                                "type": "string",
                                "enum": [
                                    "block", "arpeggio", "strum", "octave",
                                ],
                            },
                            "level": {
                                "type": "string",
                                "enum": ["light", "medium", "full"],
                            },
                            "target_difficulty": {
                                "type": "number",
                                "minimum": 1, "maximum": 5,
                            },
                            "reason": {"type": "string"},
                        },
                        "required": ["op"],
                    },
                },
                **_SESSION_ID_PROP,
            },
            "required": ["ops"],
        },
    ),
    types.Tool(
        name="compute_difficulty",
        description=(
            "計算目前 session 改編結果各 part 的演奏難度 (5 因子: 音域 / 密度 / "
            "和弦 / 節奏 / 技巧, 含 per-measure breakdown). 分數 1-5 "
            "(1=業餘初級, 3=業餘進階, 5=職業). 回傳 part_id → DifficultyEntry."
        ),
        inputSchema={
            "type": "object",
            "properties": {**_SESSION_ID_PROP},
        },
    ),
    types.Tool(
        name="compute_quality",
        description=(
            "計算改編品質: melody_preservation (旋律保留) / "
            "harmony_completeness (和聲完整) / playability (可演奏性) / "
            "overall, 各項 0-1. agent 可用此驗證編輯沒破壞旋律."
        ),
        inputSchema={
            "type": "object",
            "properties": {**_SESSION_ID_PROP},
        },
    ),
]


# ============================================================================
# Dispatch: MCP tool name + args  →  engine.handle_request
# ============================================================================

def _engine_call(
    method: str, params: dict[str, Any], session: str | None = None,
) -> Any:
    """Helper: 呼叫 engine handle_request, 失敗 → raise.

    session: 工作區 id; None → 預設 _SESSION_ID。
    """
    params = {**params, "session_id": session or _SESSION_ID}
    resp = handle_request({
        "id": f"mcp-{method}",
        "method": method,
        "params": params,
    })
    if not resp.get("ok"):
        raise RuntimeError(resp.get("error", "unknown engine error"))
    return resp.get("data")


def _session_of(args: dict[str, Any]) -> str:
    """從 tool args 取 session_id, 省略 → 'mcp-default'。"""
    sid = args.get("session_id")
    return sid if isinstance(sid, str) and sid else _SESSION_ID


def _do_arrange_and_export(args: dict[str, Any]) -> dict[str, Any]:
    source = args["source"]
    ensemble = args["target_ensemble"]
    output_path = args["output_path"]
    repair = args.get("repair", True)
    sid = _session_of(args)

    # 1. arrange (含可選 repair)
    arr = _engine_call("arrange", {
        "path": source,
        "target": ensemble,
        "repair": repair,
    }, session=sid)

    # 2. 取 quality + difficulty
    try:
        quality = _engine_call("compute_quality", {}, session=sid)
    except Exception:
        quality = None
    try:
        difficulty = _engine_call("compute_difficulty", {}, session=sid)
    except Exception:
        difficulty = None

    # 3. 匯出
    is_midi = output_path.lower().endswith((".mid", ".midi"))
    if is_midi:
        export = _engine_call(
            "export_target_midi", {"path": output_path}, session=sid)
    else:
        export = _engine_call(
            "export_target_musicxml", {"path": output_path}, session=sid)

    return {
        "output_path": export.get("exported_to", output_path),
        "size_bytes": export.get("size_bytes"),
        "format": "midi" if is_midi else "musicxml",
        "arrangement": {
            "name": arr.get("arrangement", {}).get("name"),
            "players": [
                p.get("display_name") for p in arr.get("players", [])
            ],
            "assignments": [
                {
                    "source": a.get("source_part_id"),
                    "target_player": a.get("target_player_id"),
                    "target_staff": a.get("target_staff"),
                    "function": a.get("function"),
                }
                for a in arr.get("assignments", [])
            ],
        },
        "issue_count": len(arr.get("issues", [])),
        "issues_by_severity": _count_by_severity(arr.get("issues", [])),
        "quality": quality,
        "difficulty_summary": _difficulty_summary(difficulty)
            if difficulty else None,
        "repair_applied": bool(arr.get("repair_info")),
    }


def _count_by_severity(issues: list[dict]) -> dict[str, int]:
    counts = {"error": 0, "warning": 0, "info": 0}
    for i in issues:
        s = i.get("severity", "info")
        counts[s] = counts.get(s, 0) + 1
    return counts


def _difficulty_summary(diff: dict[str, dict]) -> list[dict]:
    return [
        {
            "part_id": pid,
            "score": d.get("score"),
            "label": d.get("label"),
        }
        for pid, d in diff.items()
    ]


def _do_analyze_score(args: dict[str, Any]) -> dict[str, Any]:
    return _engine_call("analyze", {"path": args["source"]})


def _do_arrange_score(args: dict[str, Any]) -> dict[str, Any]:
    sid = _session_of(args)
    arr = _engine_call("arrange", {
        "path": args["source"],
        "target": args["target_ensemble"],
        "repair": args.get("repair", True),
    }, session=sid)
    try:
        metrics = _engine_call("compute_quality", {}, session=sid)
    except Exception:
        metrics = None
    return {**arr, "metrics": metrics, "session_id": sid}


def _do_get_status(args: dict[str, Any]) -> dict[str, Any]:
    sid = _session_of(args)
    try:
        diff = _engine_call("compute_difficulty", {}, session=sid)
    except Exception:
        diff = None
    try:
        quality = _engine_call("compute_quality", {}, session=sid)
    except Exception:
        quality = None
    return {
        "difficulty": diff,
        "quality": quality,
        "session_id": sid,
    }


def _do_apply_suggestion(args: dict[str, Any]) -> dict[str, Any]:
    return _engine_call("apply_suggestion", {
        "part_id": args["part_id"],
        "measure": args["measure"],
        "voice_id": args["voice_id"],
        "event_index": args["event_index"],
        "suggestion_code": args["suggestion_code"],
    }, session=_session_of(args))


def _do_edit_event(args: dict[str, Any]) -> dict[str, Any]:
    return _engine_call("edit_event", {
        "part_id": args["part_id"],
        "measure": args["measure"],
        "voice_id": args["voice_id"],
        "event_index": args["event_index"],
        "action": args["action"],
        "extra": args.get("extra", {}),
    }, session=_session_of(args))


def _do_export_arrangement(args: dict[str, Any]) -> dict[str, Any]:
    path = args["output_path"]
    sid = _session_of(args)
    if path.lower().endswith((".mid", ".midi")):
        return _engine_call("export_target_midi", {"path": path}, session=sid)
    return _engine_call(
        "export_target_musicxml", {"path": path}, session=sid)


def _do_transcribe(args: dict[str, Any]) -> dict[str, Any]:
    return _engine_call("transcribe", {
        "path": args["source"],
        "mapping": args.get("mapping") or {},
    }, session=_session_of(args))


def _do_list_source_parts(args: dict[str, Any]) -> Any:
    return _engine_call("list_source_parts", {"path": args["source"]})


def _do_suggest_transposition(args: dict[str, Any]) -> dict[str, Any]:
    return _engine_call("suggest_transposition", {
        "source": args["source"],
        "target": args["target"],
    })


def _do_export_all_parts(args: dict[str, Any]) -> dict[str, Any]:
    """對每位演奏者寫一份 .musicxml 到 output_dir."""
    from pathlib import Path
    output_dir = Path(args["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    sid = _session_of(args)
    # 透過 get_status (任一含 difficulty) 拿不到 players 列表; 改用內部 session
    from core.server import _SessionView
    sess = _SessionView(sid)
    if sess.current_arrangement is None:
        raise RuntimeError("尚無 arrangement, 請先 arrange_score")
    players = sess.current_arrangement.players
    written: list[dict[str, Any]] = []
    for p in players:
        result = _engine_call(
            "target_part_musicxml",
            {"player_id": p.player_id},
            session=sid,
        )
        safe_name = result["display_name"].replace(" ", "_").replace("/", "_")
        out = output_dir / f"{safe_name}.musicxml"
        out.write_text(result["musicxml"], encoding="utf-8")
        written.append({
            "player_id": p.player_id,
            "display_name": result["display_name"],
            "path": str(out),
            "size_bytes": out.stat().st_size,
        })
    return {
        "output_dir": str(output_dir),
        "parts": written,
        "count": len(written),
    }


def _do_apply_edit_ops(args: dict[str, Any]) -> dict[str, Any]:
    """批次套用結構化編輯 — 走 server 的 apply_edit_ops 方法."""
    sid = _session_of(args)
    return _engine_call("apply_edit_ops", {"ops": args["ops"]}, session=sid)


def _do_compute_difficulty(args: dict[str, Any]) -> Any:
    """計算各 part 的演奏難度 (5 因子)."""
    sid = _session_of(args)
    return _engine_call("compute_difficulty", {}, session=sid)


def _do_compute_quality(args: dict[str, Any]) -> Any:
    """計算改編品質: 旋律保留 / 和聲完整 / 可演奏性."""
    sid = _session_of(args)
    return _engine_call("compute_quality", {}, session=sid)


DISPATCH = {
    "list_corpus": lambda _: _engine_call("list_corpus", {}),
    "arrange_and_export": _do_arrange_and_export,
    "analyze_score": _do_analyze_score,
    "arrange_score": _do_arrange_score,
    "get_arrangement_status": _do_get_status,
    "apply_suggestion": _do_apply_suggestion,
    "edit_event": _do_edit_event,
    "export_arrangement": _do_export_arrangement,
    "export_all_parts": _do_export_all_parts,
    "transcribe_score": _do_transcribe,
    "list_source_parts": _do_list_source_parts,
    "suggest_transposition": _do_suggest_transposition,
    # F: 暴露難度閉環 / 結構化編輯 / 品質指標給外部 agent
    "apply_edit_ops": _do_apply_edit_ops,
    "compute_difficulty": _do_compute_difficulty,
    "compute_quality": _do_compute_quality,
}


# ============================================================================
# MCP server hooks
# ============================================================================

app: Server = Server("score-arranger")


@app.list_tools()
async def _list_tools() -> list[types.Tool]:
    return TOOLS


@app.call_tool()
async def _call_tool(
    name: str, arguments: dict[str, Any] | None,
) -> list[types.TextContent]:
    arguments = arguments or {}
    handler = DISPATCH.get(name)
    if handler is None:
        return [
            types.TextContent(
                type="text",
                text=json.dumps(
                    {"error": f"unknown tool: {name}"},
                    ensure_ascii=False,
                ),
            ),
        ]
    try:
        result = handler(arguments)
    except Exception as e:
        return [
            types.TextContent(
                type="text",
                text=json.dumps(
                    {"error": str(e), "tool": name},
                    ensure_ascii=False,
                ),
            ),
        ]
    return [
        types.TextContent(
            type="text",
            text=json.dumps(result, ensure_ascii=False, default=str),
        ),
    ]


# ============================================================================
# MCP Prompts — 把常用工作場景封裝成可直接帶入的提示模板
# ============================================================================

PROMPTS: list[types.Prompt] = [
    types.Prompt(
        name="analyze_unplayable",
        description=(
            "診斷目前 session 改編結果為何無法演奏 — 逐條解釋演奏性問題並建議修法。"
        ),
        arguments=[],
    ),
    types.Prompt(
        name="suggest_reduction",
        description=(
            "針對目前改編結果, 建議如何精簡和聲 (省略哪些次要音) 以提升可演奏性, "
            "同時保留旋律與和聲骨幹。"
        ),
        arguments=[],
    ),
    types.Prompt(
        name="compare_ensembles",
        description="把同一份樂譜改編成兩種編制並比較品質 / 難度, 給出推薦。",
        arguments=[
            types.PromptArgument(
                name="source", description="來源樂譜 (corpus:... 或路徑)",
                required=True,
            ),
            types.PromptArgument(
                name="ensemble_a", description="編制 A", required=True,
            ),
            types.PromptArgument(
                name="ensemble_b", description="編制 B", required=True,
            ),
        ],
    ),
]

_PROMPT_TEXT = {
    "analyze_unplayable": (
        "請診斷目前改編結果的可演奏性問題:\n"
        "1. 呼叫 get_arrangement_status 取得 issues 列表與各 part 難度。\n"
        "2. 對每一條 error / warning, 用演奏者聽得懂的話解釋為什麼這樣寫"
        "無法演奏或很困難 — 例如『小提琴四音和弦需要跨越不相鄰的弦』、"
        "『這個音超出長笛音域下限』。\n"
        "3. 針對每條問題, 從 issue 附帶的 suggestions 挑出最合適的修法, "
        "說明取捨 (移八度會改變音色、省略音會少一個和聲音等)。\n"
        "4. 最後總結: 哪些問題建議自動修 (apply_suggestion), "
        "哪些需要人類作曲判斷。"
    ),
    "suggest_reduction": (
        "請針對目前改編結果提出和聲精簡建議:\n"
        "1. 呼叫 get_arrangement_status 看目前的 assignments 與 issues。\n"
        "2. 找出和聲過厚 / 超出樂器多音能力 / 難度過高的小節。\n"
        "3. 建議每處該省略哪個音 — 原則: 優先保留旋律與低音 (bass), "
        "次要的是內聲部的重複音 (doubling) 與和弦五音。\n"
        "4. 對可直接執行的, 給出 edit_event (action=delete) 或 "
        "apply_suggestion 的具體呼叫參數。"
    ),
    "compare_ensembles": (
        "請比較把樂譜「{source}」改編成「{ensemble_a}」與「{ensemble_b}」"
        "兩種編制的結果:\n"
        "1. 呼叫 arrange_score 兩次, 分別帶 session_id='cmp-a' "
        "(target_ensemble={ensemble_a}) 與 session_id='cmp-b' "
        "(target_ensemble={ensemble_b})。兩個獨立 session 不會互相覆蓋。\n"
        "2. 對兩個 session 各呼叫 get_arrangement_status, "
        "比較 quality metric 與各 part 難度。\n"
        "3. 給出推薦: 哪個編制更適合這份素材, 理由 "
        "(旋律完整度、和聲保留度、演奏難度的取捨)。"
    ),
}


@app.list_prompts()
async def _list_prompts() -> list[types.Prompt]:
    return PROMPTS


@app.get_prompt()
async def _get_prompt(
    name: str, arguments: dict[str, str] | None,
) -> types.GetPromptResult:
    arguments = arguments or {}
    template = _PROMPT_TEXT.get(name)
    if template is None:
        raise ValueError(f"unknown prompt: {name}")
    try:
        text = template.format(**arguments)
    except KeyError as e:
        raise ValueError(f"prompt {name} 缺少參數: {e}") from e
    return types.GetPromptResult(
        description=f"score-arranger prompt: {name}",
        messages=[
            types.PromptMessage(
                role="user",
                content=types.TextContent(type="text", text=text),
            ),
        ],
    )


async def _main() -> None:
    async with stdio_server() as (read, write):
        await app.run(
            read,
            write,
            InitializationOptions(
                server_name="score-arranger",
                server_version="0.1.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)

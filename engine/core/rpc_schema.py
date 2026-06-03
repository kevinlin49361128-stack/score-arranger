"""Phase 0 (架構改造): schema-first RPC 契約 — 薄鷹架。

單一事實來源: 每個 RPC method 的 Request / Response 用 TypedDict 宣告,
`CONTRACTS` 對應 method 名稱。codegen (`scripts/gen_rpc_types.py`) 由此生成
前端 TS 型別 (`src/renderer/generated/rpc-types.ts`), 讓 renderer/main/engine
三層共享同一份契約 —— 取代目前 python-bridge.call 回傳 `unknown` 的失型別邊界。

漸進遷移 (這就是「薄」的意思):
  先放代表性 method, 其餘維持舊的 unknown 路徑; 架構改造各 Phase 碰到哪個
  method (e.g. Phase A 動 to_midi、Phase B 動 save/load_project) 就補哪個契約。
  `test_rpc_schema` 守住兩件事:
    (1) CONTRACTS 的 method 名稱都真的存在於 server.METHODS。
    (2) 生成的 rpc-types.ts 不過時 (改了 schema 沒重跑 codegen → 測試失敗)。

慣例:
  - Request TypedDict 用 total=False (params 多為選用 / session_id 自動注入)。
  - Response TypedDict 用 total=True (回傳欄位是契約, 該齊全)。
  - 命名: <Method>Req / <Method>Res (PascalCase)。
"""
from __future__ import annotations

from typing import TypedDict


# ── ping ────────────────────────────────────────────────────────────────
class PingReq(TypedDict, total=False):
    pass


class PingRes(TypedDict):
    pong: bool
    version: str


# ── history_status ────────────────────────────────────────────────────────
class HistoryStatusReq(TypedDict, total=False):
    session_id: str


class HistoryStatusRes(TypedDict):
    can_undo: bool
    can_redo: bool
    history_depth: int
    redo_depth: int


# ── score_info ────────────────────────────────────────────────────────────
class ScoreInfoReq(TypedDict, total=False):
    session_id: str
    path: str


class ScoreInfoRes(TypedDict):
    measure_count: int
    part_count: int


# ── score_clock (Phase A: 統一時間模型 ScoreClock/TimeMap) ─────────────────
class ScoreClockReq(TypedDict, total=False):
    session_id: str
    path: str


class TimeSig(TypedDict):
    numerator: int
    denominator: int


class TimeMapEntry(TypedDict):
    measure_number: int
    is_pickup: bool
    quarter_offset: float
    duration_quarters: float
    second_offset: float
    tick_offset: int
    bpm: float
    numerator: int
    denominator: int


class ScoreClockRes(TypedDict):
    ppq: int
    default_bpm: float
    default_time_signature: TimeSig
    total_quarters: float
    total_seconds: float
    entries: list[TimeMapEntry]


# method 名稱 → (Request TypedDict, Response TypedDict)。
# 補新 method: 上面加 <Method>Req/<Method>Res, 這裡加一行, 重跑 codegen。
CONTRACTS: dict[str, tuple[type, type]] = {
    "ping": (PingReq, PingRes),
    "history_status": (HistoryStatusReq, HistoryStatusRes),
    "score_info": (ScoreInfoReq, ScoreInfoRes),
    "score_clock": (ScoreClockReq, ScoreClockRes),
}

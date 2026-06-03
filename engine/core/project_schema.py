"""Phase B: Project Schema v2 — .sarr 升級成完整專案模型。

現況 (v0.1.0, 見 server._method_save_project): 只存單一 arrangement + 頂層
target_score + source_path (不存 source IR)。tab session / localStorage /
Python session 各存一份, 彼此分裂。

v2 目標: 一個 Project 收斂全部 —
  Project = sources + arrangements(多/variants) + active + layouts +
            practice + rehearsal_notes

本模組只定義 v2 envelope 形狀 + v1→v2 遷移 (純函式, 有測試)。
**先不動 live save/load (零風險)** — 由後續 slice 漸進接上 (load 改用 coerce_to_v2、
save 改吐 v2、前端把 practice/variants/layout 收進 project)。版本化讓舊 .sarr 永遠載得進。
"""
from __future__ import annotations

from typing import Any

PROJECT_FORMAT = "score-arranger-project"
PROJECT_VERSION_V2 = "2"
PROJECT_VERSION_V1 = "0.1.0"


def detect_version(data: dict[str, Any]) -> str:
    """讀 .sarr dict 的版本 (無 version 欄位 → 視為最舊 v1)。"""
    return str(data.get("version", PROJECT_VERSION_V1))


def migrate_v1_to_v2(data: dict[str, Any]) -> dict[str, Any]:
    """把 v0.1.0 (單一 arrangement) 包進 v2 envelope, 不丟任何資料。

    - source_path → sources[0].path (source IR 暫不內嵌, 留 None; v2 之後可選擇內嵌)。
    - arrangement + 頂層 target_score → arrangements[0] (target_score 收進 arrangement 內)。
    - active 指向該唯一 arrangement。其餘 (layouts/practice/rehearsal) 開空集。
    """
    arr = dict(data.get("arrangement") or {})
    arr_id = arr.get("arrangement_id", "arr_1")
    arr["target_score"] = data.get("target_score")
    return {
        "format": PROJECT_FORMAT,
        "version": PROJECT_VERSION_V2,
        "sources": [
            {
                "source_id": arr.get("source_id", ""),
                "path": data.get("source_path", ""),
                "ir": None,
            },
        ],
        "arrangements": [arr],
        "active": {"arrangement_id": arr_id},
        "layouts": {},
        "practice": {},
        "rehearsal_notes": [],
        "variants": [],
    }


def coerce_to_v2(data: dict[str, Any]) -> dict[str, Any]:
    """不論輸入是 v1 還是 v2, 一律回傳 v2 envelope (供 load_project 統一處理)。"""
    if data.get("format") != PROJECT_FORMAT:
        raise ValueError("不是有效的 .sarr 專案檔")
    version = detect_version(data)
    if version == PROJECT_VERSION_V2:
        return data
    if version == PROJECT_VERSION_V1:
        return migrate_v1_to_v2(data)
    raise ValueError(f"不支援的 .sarr 版本: {version}")


def make_project_v2(
    *,
    sources: list[dict[str, Any]],
    arrangements: list[dict[str, Any]],
    active_arrangement_id: str,
    layouts: dict[str, Any] | None = None,
    practice: dict[str, Any] | None = None,
    rehearsal_notes: list[Any] | None = None,
    variants: list[Any] | None = None,
) -> dict[str, Any]:
    """組一個 v2 envelope (給未來 save_project v2 / 前端 project state 用)。

    variants: A/B 版本快照 (前端 ArrangementVariant[], 含完整 target XML), 不透明帶過。
    """
    return {
        "format": PROJECT_FORMAT,
        "version": PROJECT_VERSION_V2,
        "sources": sources,
        "arrangements": arrangements,
        "active": {"arrangement_id": active_arrangement_id},
        "layouts": layouts or {},
        "practice": practice or {},
        "rehearsal_notes": rehearsal_notes or [],
        "variants": variants or [],
    }

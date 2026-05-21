"""
隨 app 出貨的範例樂譜。

為何不直接用 music21 corpus:
  PyInstaller 凍結後 music21 的 corpus 路徑解析會壞 (corpus.parse /
  corpus.search 找不到資料目錄)。所以把前端 PresetLibrary 精選的範例
  先匯出成獨立 .musicxml 檔, 隨 app 一起打包, 由本模組解析 `corpus:<id>`。

corpus_id 對應前端 PresetLibrary / OnboardingWizard 的 'corpus:<id>'。
檔名規則: corpus_id 的 '/' → '_', '.' → '-', 加 .musicxml。
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

# 隨附的範例 corpus_id —— 必須與前端 PresetLibrary 的 PRESETS 一致。
SAMPLE_CORPUS_IDS: list[str] = [
    # Baroque
    "bach/bwv66.6",
    "bach/bwv7.7",
    "bach/bwv57.8",
    "bach/bwv4.8",
    "bach/bwv227.7",
    "bach/bwv281",
    "bach/bwv344",
    "bach/bwv1.6",
    "corelli/opus3no1/1grave",
    "handel/rinaldo/Lascia_chio_pianga",
    # Classical — 弦樂四重奏
    "mozart/k80/movement1",
    "mozart/k80/movement2",
    "mozart/k80/movement3",
    "mozart/k80/movement4",
    "mozart/k155/movement1",
    "mozart/k155/movement2",
    "mozart/k155/movement3",
    "mozart/k156/movement1",
    "mozart/k156/movement2",
    "mozart/k156/movement3",
    "mozart/k156/movement4",
    "mozart/k458/movement1",
    "mozart/k458/movement2",
    "mozart/k458/movement3",
    "mozart/k458/movement4",
    "haydn/opus1no1/movement1",
    "haydn/opus1no1/movement2",
    "haydn/opus74no1/movement1",
    "haydn/opus74no1/movement2",
    "haydn/opus74no1/movement3",
    "haydn/opus74no1/movement4",
    "beethoven/opus18no1/movement1",
    "beethoven/opus18no1/movement2",
    "beethoven/opus18no1/movement3",
    "beethoven/opus18no1/movement4",
    "beethoven/opus59no1/movement1",
    "beethoven/opus132",
    # Classical — 鋼琴
    "mozart/k545/movement1_exposition",
    # Romantic
    "chopin/mazurka06-2",
    "joplin/maple_leaf_rag",
    "schubert/Lindenbaum",
    "schumann_clara/opus17/movement3",
    "schumann_robert/dichterliebe_no2",
    "schumann_robert/opus48no2",
    "verdi/laDonnaEMobile",
]

_SET = set(SAMPLE_CORPUS_IDS)

_COMPOSER = {
    "bach": "J. S. Bach",
    "corelli": "Corelli",
    "handel": "Handel",
    "mozart": "Mozart",
    "haydn": "Haydn",
    "beethoven": "Beethoven",
    "chopin": "Chopin",
    "joplin": "Joplin",
    "schubert": "Schubert",
    "schumann_clara": "Clara Schumann",
    "schumann_robert": "Schumann",
    "verdi": "Verdi",
}


def _slug(corpus_id: str) -> str:
    return corpus_id.replace("/", "_").replace(".", "-")


def _sample_dir() -> Path:
    """範例檔目錄 — 凍結模式走 PyInstaller _MEIPASS, 否則走原始碼目錄。"""
    if getattr(sys, "frozen", False):
        base = getattr(sys, "_MEIPASS", None)
        if base:
            return Path(base) / "core" / "sample_scores"
    return Path(__file__).parent / "sample_scores"


def resolve(corpus_id: str) -> Optional[Path]:
    """corpus_id → 隨附 .musicxml 路徑; 不在清單或檔案不存在 → None。"""
    if corpus_id not in _SET:
        return None
    path = _sample_dir() / f"{_slug(corpus_id)}.musicxml"
    return path if path.exists() else None


def list_samples() -> list[dict[str, str]]:
    """給 list_corpus 用 — 只列出實際存在的隨附範例。"""
    out: list[dict[str, str]] = []
    for cid in SAMPLE_CORPUS_IDS:
        if resolve(cid) is not None:
            composer = _COMPOSER.get(cid.split("/")[0], cid.split("/")[0])
            out.append({
                "corpus_path": cid,
                "composer": composer,
                "title": cid,
            })
    return out

#!/usr/bin/env python3
"""build_cloud_corpus — music21 corpus 曲目 → 線上 corpus-v1 manifest + assets。

B1 線上曲庫的擴充管線。把 music21 內建 corpus 的曲目 (本批: 弦樂四重奏樂章)
匯出成獨立 MusicXML、用引擎自家 parser 驗證可解析、算 sha256/bytes/measures、
生成 catalog.json 的 manifest entry, 合併進現有 catalog.json。

為何走線上而非 bundle 進 DMG:
  弦四是 4 部、多樂章, 檔案比聖詠大; 線上層隨需下載 + LRU 快取, 不增肥安裝檔。

為何不用 OpenScore/StringQuartets repo:
  該 repo 存 .mscx (MuseScore 原生格式, 需 MuseScore CLI 轉檔) 且每檔是整首
  ~10MB 多樂章, 超過線上單檔上限也不利渲染。music21 corpus 的弦四是逐樂章、
  乾淨 MusicXML、music21 原生解析 —— 乾淨得多。授權: music21 corpus 與既有
  41 個 bundle 樣本同源 (PD 樂曲 + 學術編碼), NOTICE §3 已涵蓋。

用法:
  cd engine && .venv/bin/python3 scripts/build_cloud_corpus.py
產出:
  engine/corpus/catalog.json               合併後 manifest (版控)
  engine/corpus/dist/cloud_<slug>.musicxml 上傳用 assets (gitignore)
之後:
  gh release upload corpus-v1 engine/corpus/dist/*.musicxml engine/corpus/catalog.json --clobber
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

# 讓 `core.*` import 得到 (用引擎自家 parser 驗證)
sys.path.insert(0, str(Path(__file__).parent.parent))

OWNER = "kevinlin49361128-stack"
REPO = "score-arranger"
CORPUS_TAG = "corpus-v1"
RELEASE_BASE = (
    f"https://github.com/{OWNER}/{REPO}/releases/download/{CORPUS_TAG}"
)

CORPUS_DIR = Path(__file__).parent.parent / "corpus"
CATALOG = CORPUS_DIR / "catalog.json"
DIST = CORPUS_DIR / "dist"

# 渲染防護: 樂章超過此小節數就跳過 (避免大譜 freeze; 教學上也太長)
MAX_MEASURES = 480

# (m21_path, slug, title, composer, dates, year, henle, tags)
# 全為弦樂四重奏樂章 — form="Quartet", ensemble="String Quartet",
# instruments=["strings"], era="Classical"。
QUARTETS: list[tuple[str, str, str, str, str, int, int, list[str]]] = [
    # ─── Beethoven (1770-1827) ───────────────────────────────────
    ("beethoven/opus18no1/movement1", "beethoven_op18no1_mvt1",
     "String Quartet No.1 in F major, Op.18 No.1 — I. Allegro con brio",
     "Ludwig van Beethoven", "1770-1827", 1799, 6, ["ensemble", "expression"]),
    ("beethoven/opus18no1/movement2", "beethoven_op18no1_mvt2",
     "String Quartet No.1 in F major, Op.18 No.1 — "
     "II. Adagio affettuoso ed appassionato",
     "Ludwig van Beethoven", "1770-1827", 1799, 6, ["ensemble", "legato"]),
    ("beethoven/opus59no1/movement1", "beethoven_op59no1_mvt1",
     "String Quartet No.7 in F major, Op.59 No.1 'Razumovsky' — I. Allegro",
     "Ludwig van Beethoven", "1770-1827", 1806, 8, ["ensemble", "expression"]),
    ("beethoven/opus59no2/movement1", "beethoven_op59no2_mvt1",
     "String Quartet No.8 in E minor, Op.59 No.2 'Razumovsky' — I. Allegro",
     "Ludwig van Beethoven", "1770-1827", 1806, 8, ["ensemble", "expression"]),
    ("beethoven/opus59no2/movement2", "beethoven_op59no2_mvt2",
     "String Quartet No.8 in E minor, Op.59 No.2 'Razumovsky' — "
     "II. Molto Adagio",
     "Ludwig van Beethoven", "1770-1827", 1806, 8, ["ensemble", "legato"]),
    ("beethoven/opus59no3/movement1", "beethoven_op59no3_mvt1",
     "String Quartet No.9 in C major, Op.59 No.3 'Razumovsky' — "
     "I. Introduzione: Andante con moto - Allegro vivace",
     "Ludwig van Beethoven", "1770-1827", 1806, 8, ["ensemble"]),
    ("beethoven/opus59no3/movement4", "beethoven_op59no3_mvt4",
     "String Quartet No.9 in C major, Op.59 No.3 'Razumovsky' — "
     "IV. Allegro molto",
     "Ludwig van Beethoven", "1770-1827", 1806, 9, ["ensemble", "counterpoint"]),

    # ─── Mozart (1756-1791) ──────────────────────────────────────
    ("mozart/k155/movement1", "mozart_k155_mvt1",
     "String Quartet No.2 in D major, K.155 — I. Allegro",
     "Wolfgang Amadeus Mozart", "1756-1791", 1772, 5, ["ensemble"]),
    ("mozart/k156/movement1", "mozart_k156_mvt1",
     "String Quartet No.3 in G major, K.156 — I. Presto",
     "Wolfgang Amadeus Mozart", "1756-1791", 1772, 5, ["ensemble"]),
    ("mozart/k458/movement1", "mozart_k458_mvt1",
     "String Quartet No.17 in B-flat major, K.458 'The Hunt' — "
     "I. Allegro vivace assai",
     "Wolfgang Amadeus Mozart", "1756-1791", 1784, 6, ["ensemble", "expression"]),
    ("mozart/k458/movement4", "mozart_k458_mvt4",
     "String Quartet No.17 in B-flat major, K.458 'The Hunt' — "
     "IV. Allegro assai",
     "Wolfgang Amadeus Mozart", "1756-1791", 1784, 6, ["ensemble"]),

    # ─── Haydn (1732-1809) ───────────────────────────────────────
    ("haydn/opus74no1/movement1", "haydn_op74no1_mvt1",
     "String Quartet in C major, Op.74 No.1 — I. Allegro moderato",
     "Joseph Haydn", "1732-1809", 1793, 6, ["ensemble"]),
    ("haydn/opus74no1/movement4", "haydn_op74no1_mvt4",
     "String Quartet in C major, Op.74 No.1 — IV. Vivace",
     "Joseph Haydn", "1732-1809", 1793, 6, ["ensemble"]),
    ("haydn/opus1no1/movement1", "haydn_op1no1_mvt1",
     "String Quartet in B-flat major, Op.1 No.1 'La chasse' — I. Presto",
     "Joseph Haydn", "1732-1809", 1762, 5, ["ensemble"]),
]


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_entry(
    m21_path: str, slug: str, title: str, composer: str, dates: str,
    year: int, henle: int, tags: list[str],
) -> dict | None:
    """匯出 + 驗證一首, 回傳 manifest entry dict (失敗回 None)。"""
    import music21  # noqa: PLC0415 — script-only

    from core.parser import parse_musicxml  # noqa: PLC0415

    asset_name = f"cloud_{slug}.musicxml"
    out = DIST / asset_name
    try:
        score = music21.corpus.parse(m21_path)
        score.write("musicxml", fp=str(out))
    except Exception as e:  # noqa: BLE001
        print(f"✗ {slug}: 匯出失敗 {type(e).__name__}: {e}")
        return None

    data = out.read_bytes()
    if len(data) < 500:
        print(f"✗ {slug}: 檔案過小 {len(data)}B")
        out.unlink(missing_ok=True)
        return None

    # 用引擎自家 parser 驗證可解析 (與 app 線上載入走同一條 parse 路徑)
    try:
        ir = parse_musicxml(str(out))
        n_parts = len(ir.parts)
        n_meas = len(ir.parts[0].measures) if n_parts else 0
    except Exception as e:  # noqa: BLE001
        print(f"✗ {slug}: 引擎解析失敗 {type(e).__name__}: {e}")
        out.unlink(missing_ok=True)
        return None

    if n_parts < 3:
        print(f"✗ {slug}: 聲部數異常 ({n_parts}p) — 非四重奏?")
        out.unlink(missing_ok=True)
        return None
    if n_meas > MAX_MEASURES:
        print(f"⊘ {slug}: {n_meas}m > {MAX_MEASURES} 上限 — 跳過 (大譜防護)")
        out.unlink(missing_ok=True)
        return None

    flag = " ⚠大" if n_meas > 300 else ""
    print(f"✓ {slug}: {n_parts}p / {n_meas}m ({len(data)//1024}KB){flag}")
    return {
        "corpus_path": f"cloud/{slug}",
        "title": title,
        "composer": composer,
        "composer_dates": dates,
        "era": "Classical",
        "form": "Quartet",
        "ensemble": "String Quartet",
        "instruments": ["strings"],
        "year": year,
        "measures": n_meas,
        "henle_level": henle,
        "tags": tags,
        "popular_tags": [],
        "url": f"{RELEASE_BASE}/{asset_name}",
        "sha256": sha256_hex(data),
        "bytes": len(data),
    }


def main() -> int:
    DIST.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_path: dict[str, dict] = {e["corpus_path"]: e for e in catalog["entries"]}

    added = 0
    for row in QUARTETS:
        entry = build_entry(*row)
        if entry is None:
            continue
        is_new = entry["corpus_path"] not in by_path
        by_path[entry["corpus_path"]] = entry
        added += int(is_new)

    catalog["entries"] = sorted(by_path.values(), key=lambda e: e["corpus_path"])
    CATALOG.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    quartets = [e for e in catalog["entries"] if e.get("form") == "Quartet"]
    print(f"\n=== Summary ===")
    print(f"新增 {added} 首; manifest 共 {len(catalog['entries'])} 首 "
          f"(其中弦四 {len(quartets)})")
    print(f"catalog → {CATALOG}")
    print(f"assets  → {DIST}/cloud_*.musicxml")
    return 0


if __name__ == "__main__":
    sys.exit(main())

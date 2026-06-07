#!/usr/bin/env python3
"""build_cloud_corpus — 多來源 → 線上 corpus-v1 manifest + assets。

B1 線上曲庫的擴充管線。兩種來源:
  1. music21 內建 corpus (corpus.parse) — 弦樂四重奏樂章。
  2. Humdrum `.krn` GitHub repo (craigsapp / josquin-research-project) — 下載
     .krn → music21 解析 → 匯出 MusicXML。標題/作曲家直接讀 .krn 自帶的
     `!!!OTL`/`!!!COM` reference record (權威, 不必硬編)。

每首都用引擎自家 parser 驗證可解析、算 sha256/bytes/measures、生成 catalog.json
manifest entry, 合併進現有 catalog.json (跳過已存在的 corpus_path, 不重做)。

為何走線上而非 bundle: 多為多部 / 大檔, 線上層隨需下載 + LRU 快取, 不增肥 DMG。
授權: music21 corpus 與 Humdrum 編碼皆 PD 樂曲 + 學術編碼, NOTICE §3 已涵蓋
(CCARH / craigsapp / Josquin Research Project, 非商業可自由散佈)。

用法:
  cd engine && .venv/bin/python3 scripts/build_cloud_corpus.py
產出:
  engine/corpus/catalog.json               合併後 manifest (版控)
  engine/corpus/dist/cloud_<slug>.musicxml 上傳用 assets (gitignore)
之後 (GitHub 單 release 上限 1000 資產; v1 已滿 → 新資產溢出到 ACTIVE_TAG):
  gh release upload corpus-v2 engine/corpus/dist/*.musicxml --clobber   # 新資產 → 溢出 release
  gh release upload corpus-v1 engine/corpus/catalog.json --clobber       # manifest 永遠在 v1 (app 從這抓)
ACTIVE_TAG 撞 1000 時 → 開 corpus-v3, 把 ACTIVE_TAG 指過去即可 (舊 entry 各自帶 url 不受影響)。
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

OWNER = "kevinlin49361128-stack"
REPO = "score-arranger"
# GitHub 單 release 上限 1000 資產。catalog.json (app 抓的 manifest) 永遠住 MANIFEST_TAG;
# 新的 .musicxml 資產上傳到 ACTIVE_TAG (溢出 release)。每筆 entry 自帶絕對 url,
# 所以舊曲目留在 v1、新曲目進 v2, 混在同一份 catalog 也完全相容。
MANIFEST_TAG = "corpus-v1"   # catalog.json 的家 (app hardcode 從這抓 manifest)
ACTIVE_TAG = "corpus-v2"     # 新資產上傳目標; 撞 1000 時改指 corpus-v3
RELEASE_BASE = (
    f"https://github.com/{OWNER}/{REPO}/releases/download/{ACTIVE_TAG}"
)

CORPUS_DIR = Path(__file__).parent.parent / "corpus"
CATALOG = CORPUS_DIR / "catalog.json"
DIST = CORPUS_DIR / "dist"

MAX_MEASURES = 480  # 大譜防護: 超過就跳過 (避免 OSMD freeze + 教學上太長)

# ── 來源 1: music21 corpus 弦樂四重奏 (m21_path, slug, title, dates, year, henle, tags) ──
QUARTETS: list[tuple[str, str, str, str, int, int, list[str]]] = [
    ("beethoven/opus18no1/movement1", "beethoven_op18no1_mvt1",
     "String Quartet No.1 in F major, Op.18 No.1 — I. Allegro con brio",
     "1770-1827", 1799, 6, ["ensemble", "expression"]),
    ("beethoven/opus18no1/movement2", "beethoven_op18no1_mvt2",
     "String Quartet No.1 in F major, Op.18 No.1 — "
     "II. Adagio affettuoso ed appassionato", "1770-1827", 1799, 6,
     ["ensemble", "legato"]),
    ("beethoven/opus59no1/movement1", "beethoven_op59no1_mvt1",
     "String Quartet No.7 in F major, Op.59 No.1 'Razumovsky' — I. Allegro",
     "1770-1827", 1806, 8, ["ensemble", "expression"]),
    ("beethoven/opus59no3/movement1", "beethoven_op59no3_mvt1",
     "String Quartet No.9 in C major, Op.59 No.3 'Razumovsky' — "
     "I. Introduzione: Andante con moto - Allegro vivace", "1770-1827", 1806,
     8, ["ensemble"]),
    ("beethoven/opus59no3/movement4", "beethoven_op59no3_mvt4",
     "String Quartet No.9 in C major, Op.59 No.3 'Razumovsky' — "
     "IV. Allegro molto", "1770-1827", 1806, 9, ["ensemble", "counterpoint"]),
    ("mozart/k155/movement1", "mozart_k155_mvt1",
     "String Quartet No.2 in D major, K.155 — I. Allegro", "1756-1791", 1772,
     5, ["ensemble"]),
    ("mozart/k156/movement1", "mozart_k156_mvt1",
     "String Quartet No.3 in G major, K.156 — I. Presto", "1756-1791", 1772,
     5, ["ensemble"]),
    ("mozart/k458/movement1", "mozart_k458_mvt1",
     "String Quartet No.17 in B-flat major, K.458 'The Hunt' — "
     "I. Allegro vivace assai", "1756-1791", 1784, 6, ["ensemble", "expression"]),
    ("mozart/k458/movement4", "mozart_k458_mvt4",
     "String Quartet No.17 in B-flat major, K.458 'The Hunt' — "
     "IV. Allegro assai", "1756-1791", 1784, 6, ["ensemble"]),
    ("haydn/opus74no1/movement1", "haydn_op74no1_mvt1",
     "String Quartet in C major, Op.74 No.1 — I. Allegro moderato",
     "1732-1809", 1793, 6, ["ensemble"]),
    ("haydn/opus74no1/movement4", "haydn_op74no1_mvt4",
     "String Quartet in C major, Op.74 No.1 — IV. Vivace", "1732-1809", 1793,
     6, ["ensemble"]),
    ("haydn/opus1no1/movement1", "haydn_op1no1_mvt1",
     "String Quartet in B-flat major, Op.1 No.1 'La chasse' — I. Presto",
     "1732-1809", 1762, 5, ["ensemble"]),
]
QUARTET_META = dict(
    composer="(from list)", era="Classical", form="Quartet",
    ensemble="String Quartet", instruments=["strings"],
)

# ── 來源 2: Humdrum .krn repos ──
# 每個 source: repo / subdir / limit / 顯示用 metadata。標題+作曲家從 .krn 讀。
KRN_SOURCES = [
    dict(key="bsq", repo="craigsapp/beethoven-string-quartets", subdir="kern",
         limit=999, composer_dates="1770-1827", era="Classical", form="Quartet",
         ensemble="String Quartet", instruments=["strings"], year=1800,
         henle=7, tags=["ensemble"], popular_tags=[]),
    dict(key="scarlatti", repo="craigsapp/scarlatti-keyboard-sonatas",
         subdir="kern", limit=999, composer_dates="1685-1757", era="Baroque",
         form="Sonata", ensemble="Piano Solo", instruments=["piano"], year=1740,
         henle=4, tags=["scales"], popular_tags=["amateur_pianist"]),
    dict(key="mazurka", repo="craigsapp/chopin-mazurkas", subdir="kern",
         limit=999, composer_dates="1810-1849", era="Romantic", form="Mazurka",
         ensemble="Piano Solo", instruments=["piano"], year=1840, henle=5,
         tags=["expression", "rhythm"], popular_tags=[]),
    dict(key="joplin", repo="craigsapp/joplin", subdir="kern", limit=999,
         composer_dates="1868-1917", era="Romantic", form="Rag",
         ensemble="Piano Solo", instruments=["piano"], year=1902, henle=4,
         tags=["rhythm", "staccato"], popular_tags=["popular"]),
    dict(key="josquin", repo="josquin-research-project/Jos", subdir="",
         limit=50, composer_dates="c.1450-1521", era="Renaissance", form="Mass",
         ensemble="SATB", instruments=["voice"], year=1500, henle=None,
         tags=["counterpoint"], popular_tags=[]),
    # ── batch 2 (繼續加) ──
    dict(key="bps", repo="craigsapp/beethoven-piano-sonatas", subdir="kern",
         limit=999, composer_dates="1770-1827", era="Classical", form="Sonata",
         ensemble="Piano Solo", instruments=["piano"], year=1800, henle=7,
         tags=["expression", "rhythm"], popular_tags=[]),
    dict(key="mps", repo="craigsapp/mozart-piano-sonatas", subdir="kern",
         limit=999, composer_dates="1756-1791", era="Classical", form="Sonata",
         ensemble="Piano Solo", instruments=["piano"], year=1780, henle=5,
         tags=["scales", "legato"], popular_tags=["amateur_pianist"]),
    # 文藝復興: 補作曲家多樣性 (form 依標題 Missa→Mass 否則 Motet)。
    dict(key="ock", repo="josquin-research-project/Ock", subdir="", limit=30,
         composer_dates="c.1410-1497", era="Renaissance", form="Motet",
         ensemble="SATB", instruments=["voice"], year=1470, henle=None,
         tags=["counterpoint"], popular_tags=[], dynamic_form=True),
    dict(key="obr", repo="josquin-research-project/Obr", subdir="", limit=999,
         composer_dates="c.1457-1505", era="Renaissance", form="Motet",
         ensemble="SATB", instruments=["voice"], year=1490, henle=None,
         tags=["counterpoint"], popular_tags=[], dynamic_form=True),
    dict(key="bus", repo="josquin-research-project/Bus", subdir="", limit=20,
         composer_dates="c.1430-1492", era="Renaissance", form="Motet",
         ensemble="SATB", instruments=["voice"], year=1470, henle=None,
         tags=["counterpoint"], popular_tags=[], dynamic_form=True),
    # ── batch 3 (2026-06-04): 補古典鋼琴三巨頭 Haydn + 業餘友善 + 文藝復興多樣性 ──
    dict(key="hps", repo="craigsapp/haydn-piano-sonatas", subdir="kern",
         limit=999, composer="Franz Joseph Haydn", composer_dates="1732-1809",
         era="Classical", form="Sonata", ensemble="Piano Solo",
         instruments=["piano"], year=1780, henle=4,
         tags=["scales", "legato"], popular_tags=["amateur_pianist"]),
    dict(key="hummel", repo="craigsapp/hummel-preludes", subdir="kern",
         limit=999, composer="Johann Nepomuk Hummel", composer_dates="1778-1837",
         era="Classical", form="Prelude", ensemble="Piano Solo",
         instruments=["piano"], year=1815, henle=3,
         tags=["scales", "expression"], popular_tags=["amateur_pianist"]),
    dict(key="dufay", repo="josquin-research-project/Duf", subdir="", limit=999,
         composer_dates="c.1397-1474", era="Renaissance", form="Motet",
         ensemble="SATB", instruments=["voice"], year=1440, henle=None,
         tags=["counterpoint"], popular_tags=[], dynamic_form=True),
    dict(key="larue", repo="josquin-research-project/Rue", subdir="", limit=60,
         composer_dates="c.1452-1518", era="Renaissance", form="Motet",
         ensemble="SATB", instruments=["voice"], year=1500, henle=None,
         tags=["counterpoint"], popular_tags=[], dynamic_form=True),
    dict(key="isaac", repo="josquin-research-project/Isa", subdir="", limit=999,
         composer_dates="c.1450-1517", era="Renaissance", form="Motet",
         ensemble="SATB", instruments=["voice"], year=1490, henle=None,
         tags=["counterpoint"], popular_tags=[], dynamic_form=True),
    # ── batch 4 (2026-06-07): Bach 370 四部聖詠 — 補最大缺口 (Bach),
    # 教和聲/聲部進行的標準教材, 正對應引擎的 voice-leading DP。
    dict(key="bachchorale", repo="craigsapp/bach-370-chorales", subdir="kern",
         limit=999, composer="Johann Sebastian Bach", composer_dates="1685-1750",
         era="Baroque", form="Chorale", ensemble="SATB", instruments=["voice"],
         year=1730, henle=None, tags=["counterpoint", "harmony"],
         popular_tags=[]),
    # ── batch 5 (2026-06-07): KernScores 補缺 — 巴洛克器樂/對位 + 近代鋼琴。
    # 新資產進 corpus-v2 (ACTIVE_TAG)。
    dict(key="vivaldi", repo="craigsapp/vivaldi-op6", subdir="kern", limit=999,
         composer="Antonio Vivaldi", composer_dates="1678-1741", era="Baroque",
         form="Concerto", ensemble="String Ensemble", instruments=["strings"],
         year=1719, henle=None, tags=["baroque", "ensemble"], popular_tags=[]),
    dict(key="artfugue", repo="craigsapp/art-of-the-fugue", subdir="kern",
         limit=999, composer="Johann Sebastian Bach", composer_dates="1685-1750",
         era="Baroque", form="Fugue", ensemble="Keyboard",
         instruments=["keyboard"], year=1750, henle=None,
         tags=["counterpoint", "fugue"], popular_tags=[]),
    dict(key="musoffering", repo="craigsapp/bach-musical-offering",
         subdir="kern", limit=999, composer="Johann Sebastian Bach",
         composer_dates="1685-1750", era="Baroque", form="Ricercar",
         ensemble="Keyboard", instruments=["keyboard"], year=1747, henle=None,
         tags=["counterpoint"], popular_tags=[]),
    dict(key="scriabin", repo="craigsapp/scriabin", subdir="ccarh_kern",
         limit=999, composer="Alexander Scriabin", composer_dates="1872-1915",
         era="Romantic", form="Character Piece", ensemble="Piano Solo",
         instruments=["piano"], year=1900, henle=None, tags=["expression"],
         popular_tags=[], dynamic_form="piano"),
]


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# Humdrum `.krn` reference records 常含 music21 不展開的標記 (`@{OTL}` 自我參照、
# `<i>`/`<sup>` HTML 標籤、`&szlig;` HTML entity、latin-1↔utf-8 mojibake)。
# 這些不清會直接漏進 catalog 標題 (見 2026-06-04 修正)。
_MOJI = {
    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú", "Ã±": "ñ",
    "Ã ": "à", "Ã¨": "è", "Ã¬": "ì", "Ã²": "ò", "Ã¹": "ù", "Ã¤": "ä",
    "Ã«": "ë", "Ã¯": "ï", "Ã¶": "ö", "Ã¼": "ü", "ÃŸ": "ß", "Ã¢": "â",
    "Ãª": "ê", "Ã®": "î", "Ã´": "ô", "Ã»": "û", "Ã§": "ç", "Ã‰": "É",
    "Ã„": "Ä", "Ã–": "Ö", "Ãœ": "Ü",
}
_HUMDRUM_REF = [
    re.compile(r",\s*mvmt\.\s*@\{OMV\}"),
    re.compile(r",\s*@\{OTL\}(?:\s*\(<i>@\{OTP\}</i>\))?"),
    re.compile(r",\s*@\{SCT1\}"),
]


def clean_text(s: str) -> str:
    """去除 Humdrum/HTML/mojibake 雜訊, 回傳乾淨的人類可讀標題/作曲家。"""
    if not s:
        return s
    for bad, good in _MOJI.items():
        s = s.replace(bad, good)
    s = re.sub(r"\\[nrt]", " ", s)             # 字面 \n \r \t escape
    for pat in _HUMDRUM_REF:
        s = pat.sub("", s)
    s = re.sub(r"@\{[^}]*\}", "", s)          # 任何殘留 @{...} token
    s = html.unescape(s)                       # &szlig; → ß 等
    s = re.sub(r"</?[A-Za-z][^>]*>", "", s)     # 去 <i> <sup> 等標籤
    s = re.sub(r",\s*UE(?=\s|—|$)", "", s)      # Universal Edition 版本標記 (Haydn .krn)
    s = re.sub(r"\(\s*\)", "", s)               # token 拿掉後留下的空括號
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+,", ",", s)                 # 逗號前多餘空白
    s = re.sub(r"\s*,\s*(?=,|—|$)", "", s)      # 逗號緊接 , — 或結尾 → 多餘
    return s.strip(" ,;")


def norm_composer(name: str) -> str:
    """'Beethoven, Ludwig van' → 'Ludwig van Beethoven'; 無逗號原樣回傳。"""
    name = clean_text(name)
    if ", " in name:
        last, first = name.split(", ", 1)
        return f"{first} {last}"
    return name


def slugify(stem: str) -> str:
    out = "".join(c if c.isalnum() else "_" for c in stem.lower())
    while "__" in out:
        out = out.replace("__", "_")
    return out.strip("_")


def gh_download_urls(repo: str, subdir: str, limit: int) -> list[tuple[str, str]]:
    """回傳 [(filename, download_url)] (只取 .krn)。"""
    path = f"contents/{subdir}" if subdir else "contents"
    out = subprocess.run(
        ["gh", "api", f"repos/{repo}/{path}", "--paginate",
         "--jq", '.[]|select(.name|endswith(".krn"))|[.name,.download_url]|@tsv'],
        capture_output=True, text=True,
    )
    rows = []
    for line in out.stdout.splitlines():
        if "\t" in line:
            name, url = line.split("\t", 1)
            rows.append((name, url))
    return rows[:limit]


def _validate_and_entry(
    out: Path, asset_name: str, slug: str, title: str, composer: str,
    src: dict,
) -> dict | None:
    """共用: 引擎驗證 + 組 entry。out 須已寫好 musicxml。"""
    from core.parser import parse_musicxml  # noqa: PLC0415

    data = out.read_bytes()
    if len(data) < 500:
        out.unlink(missing_ok=True)
        return None
    try:
        ir = parse_musicxml(str(out))
        n_parts = len(ir.parts)
        n_meas = len(ir.parts[0].measures) if n_parts else 0
    except Exception as e:  # noqa: BLE001
        print(f"  ✗ {slug}: 引擎解析失敗 {type(e).__name__}")
        out.unlink(missing_ok=True)
        return None
    if n_parts < 1 or n_meas < 4 or n_meas > MAX_MEASURES:
        print(f"  ⊘ {slug}: {n_parts}p/{n_meas}m 出界, 跳過")
        out.unlink(missing_ok=True)
        return None

    entry = {
        "corpus_path": f"cloud/{slug}", "title": title, "composer": composer,
        "composer_dates": src["composer_dates"], "era": src["era"],
        "form": src["form"], "ensemble": src["ensemble"],
        "instruments": src["instruments"], "year": src["year"],
        "measures": n_meas, "tags": src["tags"],
        "popular_tags": src.get("popular_tags", []),
        "url": f"{RELEASE_BASE}/{asset_name}", "sha256": sha256_hex(data),
        "bytes": len(data),
    }
    if src.get("henle") is not None:
        entry["henle_level"] = src["henle"]
    print(f"  ✓ {slug}: {n_parts}p/{n_meas}m — {title[:50]}")
    return entry


def process_krn(src: dict, have: set[str]) -> list[dict]:
    import music21  # noqa: PLC0415

    entries: list[dict] = []
    urls = gh_download_urls(src["repo"], src["subdir"], src["limit"])
    print(f"\n── {src['key']} ({src['repo']}): {len(urls)} 檔 ──")
    with tempfile.TemporaryDirectory() as td:
        for name, url in urls:
            stem = name[:-4] if name.endswith(".krn") else name
            slug = f"{src['key']}_{slugify(stem)}"
            if f"cloud/{slug}" in have:
                continue
            krn = Path(td) / name
            r = subprocess.run(["curl", "-sL", url, "-o", str(krn)],
                               capture_output=True)
            if r.returncode != 0 or not krn.exists():
                continue
            asset_name = f"cloud_{slug}.musicxml"
            out = DIST / asset_name
            try:
                score = music21.converter.parse(str(krn))
                md = score.metadata
                base = clean_text(md.title if md and md.title else stem)
                mvt = clean_text(md.movementName if md and md.movementName else "")
                title = f"{base} — {mvt}" if mvt and mvt not in base else base
                composer = norm_composer(
                    md.composer if md and md.composer else src.get("composer", "")
                )
                score.write("musicxml", fp=str(out))
            except Exception as e:  # noqa: BLE001
                print(f"  ✗ {slug}: 匯出失敗 {type(e).__name__}")
                out.unlink(missing_ok=True)
                continue
            eff = src
            dyn = src.get("dynamic_form")
            if dyn == "piano":
                # 鋼琴小品: 由標題關鍵字定 form (Scriabin op.11 前奏曲 / op.8 練習曲…)
                t = title.lower()
                form = next(
                    (f for kw, f in (
                        ("etude", "Etude"), ("prelude", "Prelude"),
                        ("poem", "Poem"), ("poème", "Poem"), ("sonata", "Sonata"),
                        ("mazurka", "Mazurka"), ("nocturne", "Nocturne"),
                        ("waltz", "Waltz"), ("valse", "Waltz"),
                        ("impromptu", "Impromptu"),
                    ) if kw in t),
                    "Character Piece",
                )
                eff = {**src, "form": form}
            elif dyn:  # 文藝復興: Missa→Mass 否則 Motet
                form = "Mass" if "missa" in title.lower() else "Motet"
                eff = {**src, "form": form}
            entry = _validate_and_entry(out, asset_name, slug, title, composer, eff)
            if entry:
                entries.append(entry)
                have.add(entry["corpus_path"])
    return entries


def process_quartets(have: set[str]) -> list[dict]:
    import music21  # noqa: PLC0415

    entries: list[dict] = []
    print("\n── music21 quartets ──")
    for m21_path, slug, title, dates, year, henle, tags in QUARTETS:
        if f"cloud/{slug}" in have:
            continue
        asset_name = f"cloud_{slug}.musicxml"
        out = DIST / asset_name
        try:
            score = music21.corpus.parse(m21_path)
            composer = norm_composer(
                score.metadata.composer if score.metadata
                and score.metadata.composer else ""
            )
            score.write("musicxml", fp=str(out))
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {slug}: 匯出失敗 {type(e).__name__}")
            continue
        src = {**QUARTET_META, "composer_dates": dates, "year": year,
               "henle": henle, "tags": tags, "popular_tags": []}
        entry = _validate_and_entry(out, asset_name, slug, title, composer, src)
        if entry:
            entries.append(entry)
            have.add(entry["corpus_path"])
    return entries


def main() -> int:
    DIST.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_path = {e["corpus_path"]: e for e in catalog["entries"]}
    have = set(by_path)
    before = len(have)

    new_entries = process_quartets(have)
    for src in KRN_SOURCES:
        new_entries += process_krn(src, have)

    for e in new_entries:
        by_path[e["corpus_path"]] = e
    catalog["entries"] = sorted(by_path.values(), key=lambda e: e["corpus_path"])
    CATALOG.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"\n=== Summary ===")
    print(f"新增 {len(new_entries)} 首 (catalog {before} → {len(catalog['entries'])})")
    by_form: dict[str, int] = {}
    for e in catalog["entries"]:
        by_form[e.get("form", "?")] = by_form.get(e.get("form", "?"), 0) + 1
    print("form 分布:", by_form)
    return 0


if __name__ == "__main__":
    sys.exit(main())

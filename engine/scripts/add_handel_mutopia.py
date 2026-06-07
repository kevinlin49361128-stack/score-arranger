#!/usr/bin/env python3
"""add_handel — 把韓德爾器樂/聲樂作品加進線上 corpus。

兩個來源:
  1. Mutopia Project (mutopiaproject.org) 的小提琴奏鳴曲 MIDI。
     音樂本身 PD (Handel 1685-1759), 但 Mutopia 的「打譜編碼」是 CC-BY-SA 2.5
     → 需署名 + share-alike。腳本會讀每首 .ly 的 maintainer(打譜者)/license,
     列印成 NOTICE 用的署名清單 (見輸出末端 ATTRIBUTION 段)。
     Mutopia 的 *-score.mid 是條縮節版; 真正全曲在各樂章 *-score-N.mid → 串接。
  2. music21 內建 corpus 的 Handel (PD, 乾淨 MusicXML, 免署名)。

只有這兩首奏鳴曲 (HWV 361 / 370) 在 Mutopia 有可直接下載的 MIDI;
其餘 (HWV 360/365/369) 只有 .ly 原始碼 (需 LilyPond toolchain, 本機未裝) → 略過。

用法: cd engine && .venv/bin/python3 scripts/add_handel_mutopia.py
之後: gh release upload corpus-v1 engine/corpus/dist/cloud_handel_*.musicxml \
        engine/corpus/catalog.json --clobber
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_cloud_corpus import (  # noqa: E402
    CATALOG, DIST, _validate_and_entry, norm_composer,
)

FTP = "https://www.mutopiaproject.org/ftp/HandelGF"

# Mutopia: 有可直接下載 MIDI 的小提琴奏鳴曲。各樂章 score-N.mid 串接成全曲。
MUTOPIA = [
    dict(hwv="361", slug="handel_hwv361_violin_sonata_a",
         title="Violin Sonata in A major, HWV 361 (Op.1 No.3)",
         instruments=["violin", "piano"], ensemble="violin_piano"),
    dict(hwv="370", slug="handel_hwv370_violin_sonata_f",
         title="Violin Sonata in F major, HWV 370 (Op.1 No.12)",
         instruments=["violin", "piano"], ensemble="violin_piano"),
]

# music21 內建 corpus: PD, 免署名。
M21 = [
    dict(path="handel/rinaldo/Lascia_chio_pianga.mxl",
         slug="handel_lascia_chio_pianga",
         title="Lascia ch'io pianga (from Rinaldo, HWV 7)",
         instruments=["voice", "piano"], ensemble="voice_piano",
         form="Aria", year=1711),
]

_LY_FIELD = re.compile(
    r'mutopia(\w+)\s*=\s*"([^"]*)"|(\bmaintainer|license|date)\s*=\s*"([^"]*)"'
)


def fetch(url: str, dest: Path) -> bool:
    r = subprocess.run(["curl", "-sL", url, "-o", str(dest)], capture_output=True)
    return r.returncode == 0 and dest.exists() and dest.stat().st_size > 200


def read_ly_meta(lys_zip: Path) -> dict:
    meta: dict[str, str] = {}
    try:
        with zipfile.ZipFile(lys_zip) as z:
            for n in sorted(x for x in z.namelist() if x.endswith(".ly")):
                txt = z.read(n).decode("utf-8", "ignore")
                for m in _LY_FIELD.finditer(txt):
                    key = (m.group(1) or m.group(3) or "").lower()
                    val = (m.group(2) or m.group(4) or "").strip()
                    if key and val and key not in meta:
                        meta[key] = val
                if "maintainer" in meta:
                    break
    except Exception:  # noqa: BLE001
        pass
    return meta


def concat_movements(mids_zip: Path, hwv: str, work: Path):
    """串接各樂章 score-N.mid → 全曲 Score; 樂章檔缺則退回 score.mid。

    music21 從 BytesIO 認不出 MIDI, 必須落地成 .mid 檔再 parse。
    """
    import music21  # noqa: PLC0415
    from music21 import stream  # noqa: PLC0415

    def _parse(name: str, data: bytes):
        p = work / Path(name).name
        p.write_bytes(data)
        return music21.converter.parse(str(p))

    with zipfile.ZipFile(mids_zip) as z:
        names = z.namelist()
        movs = sorted(n for n in names
                      if re.search(rf"HWV{hwv}-score-\d+\.mid$", n, re.I))
        if not movs:
            single = next((n for n in names
                           if n.lower().endswith("score.mid")), None)
            return _parse(single, z.read(single))
        parsed = [_parse(m, z.read(m)) for m in movs]

    n_parts = max(len(p.parts) for p in parsed)
    combined = stream.Score()
    for pi in range(n_parts):
        part = stream.Part()
        num = 0
        for mv in parsed:
            if pi < len(mv.parts):
                for meas in mv.parts[pi].getElementsByClass("Measure"):
                    num += 1
                    meas.number = num  # 各樂章都從 1 起算 → 重編連續
                    part.append(meas)
        combined.insert(0, part)
    return combined


def main() -> int:
    import music21  # noqa: PLC0415
    from music21 import metadata as m21meta  # noqa: PLC0415

    DIST.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_path = {e["corpus_path"]: e for e in catalog["entries"]}
    before = len(by_path)
    attribution: list[str] = []
    tmp = Path("/tmp/handel_mutopia")
    tmp.mkdir(exist_ok=True)

    def finalize(slug, title, src, score):
        asset = f"cloud_{slug}.musicxml"
        out = DIST / asset
        if score.metadata is None:
            score.insert(0, m21meta.Metadata())
        score.metadata.title = title
        score.metadata.composer = "George Frideric Handel"
        score.write("musicxml", fp=str(out))
        entry = _validate_and_entry(
            out, asset, slug, title,
            norm_composer("George Frideric Handel"), src)
        if entry:
            by_path[entry["corpus_path"]] = entry
        return entry

    # ── 來源 1: Mutopia 小提琴奏鳴曲 (CC-BY-SA) ──
    print("── Mutopia violin sonatas ──")
    for h in MUTOPIA:
        hwv, slug = h["hwv"], h["slug"]
        mids = tmp / f"hwv{hwv}-mids.zip"
        lys = tmp / f"hwv{hwv}-lys.zip"
        base = f"{FTP}/HWV{hwv}/hwv{hwv}/hwv{hwv}"
        if not fetch(f"{base}-mids.zip", mids):
            print(f"  ✗ {slug}: mids.zip 抓不到")
            continue
        fetch(f"{base}-lys.zip", lys)
        meta = read_ly_meta(lys) if lys.exists() else {}
        try:
            score = concat_movements(mids, hwv, tmp)
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {slug}: 串接/解析失敗 {type(e).__name__}: {e}")
            continue
        src = {
            "composer_dates": "1685-1759", "era": "Baroque", "form": "Sonata",
            "ensemble": h["ensemble"], "instruments": h["instruments"],
            "year": 1730, "tags": ["baroque", "sonata", "mutopia", "violin"],
            "popular_tags": [], "henle": None,
        }
        if finalize(slug, h["title"], src, score):
            who = meta.get("maintainer", "Mutopia contributor")
            lic = meta.get("license", "CC-BY-SA 2.5")
            attribution.append(f"  - {h['title']} — typeset by {who}; {lic}")

    # ── 來源 2: music21 corpus (PD) ──
    print("── music21 corpus ──")
    for h in M21:
        slug = h["slug"]
        try:
            score = music21.corpus.parse(h["path"])
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {slug}: corpus.parse 失敗 {type(e).__name__}")
            continue
        src = {
            "composer_dates": "1685-1759", "era": "Baroque", "form": h["form"],
            "ensemble": h["ensemble"], "instruments": h["instruments"],
            "year": h["year"], "tags": ["baroque", h["form"].lower(), "aria"],
            "popular_tags": ["famous"], "henle": None,
        }
        finalize(slug, h["title"], src, score)

    catalog["entries"] = sorted(by_path.values(), key=lambda e: e["corpus_path"])
    CATALOG.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\n=== Summary ===  catalog {before} → {len(by_path)}")
    print("\n=== ATTRIBUTION (貼進 NOTICE.md) ===")
    print("Mutopia Project (mutopiaproject.org) typesetting — CC-BY-SA 2.5:")
    for line in attribution:
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())

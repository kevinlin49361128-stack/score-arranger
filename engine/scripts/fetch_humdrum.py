#!/usr/bin/env python3
"""
fetch_humdrum — 0.1.44 從 humdrum-tools / craigsapp GitHub repos 抓 .krn,
透過 music21 export 成 MusicXML 放進 sample_scores/.

License: 音樂本身全 PD (composer 死 ≥ 70 年), encoding 由 Stanford CCARH /
David Huron / Craig Sapp 提供, "freely redistributable for non-commercial
use" — 跟我們 41 個 music21 corpus 樣本同等灰色地帶, NOTICE.md §3 已涵蓋.

選曲: 挑各時代教學上的核心曲目, 不抓全集 (Scarlatti 555 首太多, 挑代表).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

DEST = Path(__file__).parent.parent / "core" / "sample_scores"
TMP = Path("/tmp/sa_humdrum_krn")

# (github_repo, krn_filename_in_repo_kern_subdir, output_slug, era)
# era: Baroque / Classical / Romantic / Modern
PIECES: list[tuple[str, str, str, str]] = [
    # ─── Bach Two-Part Inventions BWV 772-786 (全 15 首) ─────────
    # 對位入門經典, 兩聲部, 鋼琴必修. Henle 3-4 / ABRSM 5-6.
    *[
        ("humdrum-tools/inventions", f"inven{i:02d}.krn",
         f"bach_invention_{i:02d}", "Baroque")
        for i in range(1, 16)
    ],

    # ─── Beethoven 32 Piano Sonatas (mvt 1 各 1 首) ─────────────
    # 全 32 首奏鳴曲第一樂章, 含: 8 "Pathétique", 14/2 "Moonlight",
    # 21 "Waldstein", 23 "Appassionata", 29 "Hammerklavier", 32 (晚期)
    *[
        ("craigsapp/beethoven-piano-sonatas", f"sonata{i:02d}-1.krn",
         f"beethoven_sonata_{i:02d}_1", "Classical")
        for i in range(1, 33)
    ],

    # ─── Beethoven 16 String Quartets (mvt 1 全套) ──────────────
    # 補完我們缺的 op.18 No.2-6, op.59, op.74, op.95, op.127, op.130-135.
    # 16 首 × 1 樂章 = 16. (我們已有的 op.18 No.1 / op.59 No.1 / op.132
    # 走 music21 corpus, 不衝突 — 因為 Sapp 編號 1-16 對映 op.18/1 (#1)
    # ~ op.135 (#16), 我們重複的會跳過或新增別 entry)
    *[
        ("craigsapp/beethoven-string-quartets", f"quartet{i:02d}-1.krn",
         f"beethoven_quartet_{i:02d}_1", "Classical")
        for i in range(1, 17)
    ],

    # ─── Mozart Piano Sonatas (mvt 1, ~18 首) ────────────────
    # K.279-K.576 全套, 含 K.331 (Alla Turca), K.545 (Sonata facile,
    # 我們已有 K.545 mvt 1 exposition, 不重複加完整版).
    # Sapp 編號 1-18 對映 K.279 / K.280 / K.281 / K.282 / K.283 / K.284 /
    # K.309 / K.310 / K.311 / K.330 / K.331 / K.332 / K.333 / K.457 /
    # K.533 / K.545 (skip) / K.570 / K.576
    *[
        ("craigsapp/mozart-piano-sonatas", f"sonata{i:02d}-1.krn",
         f"mozart_sonata_{i:02d}_1", "Classical")
        for i in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18)
        # skip 16 = K.545 (我們已有)
    ],

    # ─── Chopin 24 Preludes Op.28 (全套) ───────────────────────
    # 經典浪漫派鋼琴小品, 每首 8-50 小節, 教學/演奏皆宜.
    *[
        ("craigsapp/chopin-preludes", f"prelude28-{i:02d}.krn",
         f"chopin_prelude_28_{i:02d}", "Romantic")
        for i in range(1, 25)
    ],

    # ─── Chopin Mazurkas — 挑 10 首名作 ────────────────────────
    # 我們已有 op.6 No.2 (走 music21 corpus). Sapp 編號用 op-no.
    ("craigsapp/chopin-mazurkas", "mazurka06-1.krn",
     "chopin_mazurka_06_1", "Romantic"),
    ("craigsapp/chopin-mazurkas", "mazurka07-1.krn",
     "chopin_mazurka_07_1", "Romantic"),
    ("craigsapp/chopin-mazurkas", "mazurka07-2.krn",
     "chopin_mazurka_07_2", "Romantic"),
    ("craigsapp/chopin-mazurkas", "mazurka17-4.krn",
     "chopin_mazurka_17_4", "Romantic"),
    ("craigsapp/chopin-mazurkas", "mazurka24-2.krn",
     "chopin_mazurka_24_2", "Romantic"),
    ("craigsapp/chopin-mazurkas", "mazurka33-2.krn",
     "chopin_mazurka_33_2", "Romantic"),
    ("craigsapp/chopin-mazurkas", "mazurka67-4.krn",
     "chopin_mazurka_67_4", "Romantic"),
    ("craigsapp/chopin-mazurkas", "mazurka68-4.krn",
     "chopin_mazurka_68_4", "Romantic"),

    # ─── Joplin — 6 首代表 rag ─────────────────────────────────
    # 我們已有 maple_leaf_rag, 加幾首其他著名 rag.
    ("craigsapp/joplin", "entertainer.krn",
     "joplin_entertainer", "Romantic"),
    ("craigsapp/joplin", "elite-syncopations.krn",
     "joplin_elite_syncopations", "Romantic"),
    ("craigsapp/joplin", "easy-winners.krn",
     "joplin_easy_winners", "Romantic"),
    ("craigsapp/joplin", "solace.krn",
     "joplin_solace", "Romantic"),
    ("craigsapp/joplin", "pineapple-rag.krn",
     "joplin_pineapple_rag", "Romantic"),

    # ─── Scarlatti Keyboard Sonatas — 0.1.45 修檔名 + 加碼到 15 首 ───
    # 巴洛克晚期, 義大利 / 西班牙風味, 大鍵琴鋼琴皆可演.
    # 0.1.44 用 kk###.krn 是錯的, repo 實際格式: L<longo>K<kirkpatrick>.krn
    # repo 只有 65 首 (非全 555), 從中挑 15 首教學常用代表.
    ("craigsapp/scarlatti-keyboard-sonatas", "L366K001.krn",
     "scarlatti_K001", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L335K055.krn",
     "scarlatti_K055", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L010K084.krn",
     "scarlatti_K084", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L345K113.krn",
     "scarlatti_K113", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L006K139.krn",
     "scarlatti_K139", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L349K146.krn",
     "scarlatti_K146", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L052K165.krn",
     "scarlatti_K165", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L054K200.krn",
     "scarlatti_K200", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L027K238.krn",
     "scarlatti_K238", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L055K330.krn",
     "scarlatti_K330", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L002K384.krn",
     "scarlatti_K384", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L005K406.krn",
     "scarlatti_K406", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L164K491.krn",
     "scarlatti_K491", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L003K502.krn",
     "scarlatti_K502", "Baroque"),
    ("craigsapp/scarlatti-keyboard-sonatas", "L011K534.krn",
     "scarlatti_K534", "Baroque"),

    # ─── Bach 370 Chorales — 0.1.45 新增 50 首代表 ────────────────
    # craigsapp/bach-370-chorales (370 首 SATB 聖詠合輯, BWV chor001-371).
    # 聲部進行教材經典, 內聲部運動範例庫. 全 PD, encoding 同 grey-zone.
    # 50 首均勻取樣 (每 7-8 首取 1), 涵蓋 BWV 全曲目範圍.
    *[
        ("craigsapp/bach-370-chorales", f"chor{i:03d}.krn",
         f"bach_chorale_{i:03d}", "Baroque")
        for i in (
            1, 8, 16, 24, 32, 40, 48, 56, 64, 72,
            80, 88, 96, 104, 112, 120, 128, 136, 144, 152,
            160, 168, 176, 184, 192, 200, 208, 216, 224, 232,
            240, 248, 256, 264, 272, 280, 288, 296, 304, 312,
            320, 328, 336, 344, 352, 360, 365, 367, 369, 371,
        )
    ],

    # ─── Haydn Piano Sonatas — 挑 8 首 ─────────────────────────
    # Hob.XVI 編號 1-62. 名作含 Hob.XVI/35 (C major), 50 (C major),
    # 52 (Eb major) 等. Sapp 編號用 sonata01-50+. 挑代表.
    ("craigsapp/haydn-piano-sonatas", "sonata35-1.krn",
     "haydn_sonata_35_1", "Classical"),
    ("craigsapp/haydn-piano-sonatas", "sonata37-1.krn",
     "haydn_sonata_37_1", "Classical"),
    ("craigsapp/haydn-piano-sonatas", "sonata50-1.krn",
     "haydn_sonata_50_1", "Classical"),
    ("craigsapp/haydn-piano-sonatas", "sonata52-1.krn",
     "haydn_sonata_52_1", "Classical"),
]


def main() -> int:
    import music21  # noqa: PLC0415

    DEST.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    ok = 0
    fail: list[tuple[str, str]] = []
    skip = 0
    for (repo, krn_name, slug, era) in PIECES:
        out = DEST / f"{slug}.musicxml"
        if out.exists():
            skip += 1
            continue
        # 抓 .krn (krn 通常在 kern/ subdir)
        # humdrum-tools/inventions kern/ subdir; craigsapp/* 也都 kern/
        url = f"https://raw.githubusercontent.com/{repo}/master/kern/{krn_name}"
        # 嘗試 main + master
        krn_local = TMP / f"{slug}.krn"
        urls_to_try = [
            f"https://raw.githubusercontent.com/{repo}/master/kern/{krn_name}",
            f"https://raw.githubusercontent.com/{repo}/main/kern/{krn_name}",
        ]
        fetched = False
        for try_url in urls_to_try:
            try:
                r = subprocess.run(
                    ["curl", "-sSL", "-o", str(krn_local),
                     "-A", "Score-Arranger/0.1.44",
                     "--fail", try_url],
                    capture_output=True, timeout=30,
                )
                if r.returncode == 0 and krn_local.stat().st_size > 200:
                    fetched = True
                    break
            except Exception:
                continue
        if not fetched:
            fail.append((slug, f"download failed both branches"))
            continue
        # 用 music21 parse + export to MusicXML
        try:
            score = music21.converter.parse(str(krn_local))
            score.write("musicxml", fp=str(out))
            size = out.stat().st_size if out.exists() else 0
            if size < 1000:
                fail.append((slug, f"export too small: {size}"))
                out.unlink(missing_ok=True)
                continue
            n_parts = len(score.parts) if hasattr(score, "parts") else 0
            n_meas = (
                len(score.parts[0].getElementsByClass("Measure"))
                if n_parts else 0
            )
            print(f"✓ {slug}: {n_parts}p / {n_meas}m ({size // 1024} KB)")
            ok += 1
        except Exception as e:
            fail.append((slug, f"{type(e).__name__}: {str(e)[:100]}"))

    print(f"\n=== Summary ===")
    print(f"OK: {ok} / {len(PIECES) - skip} (skipped existing: {skip})")
    if fail:
        print(f"FAILED ({len(fail)}):")
        for slug, err in fail[:20]:
            print(f"  - {slug}: {err}")
    return 0 if not fail else 1


if __name__ == "__main__":
    sys.exit(main())

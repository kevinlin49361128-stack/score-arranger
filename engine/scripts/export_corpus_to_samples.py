#!/usr/bin/env python3
"""
export_corpus_to_samples — 0.1.42 從 music21 corpus 抽額外曲目.

策略: music21 corpus 體積巨大 (~120MB) 不適合 bundle 進 frozen engine
(PyInstaller 瘦身時排除). 但 corpus 內有大量 PD 古典曲目, 我們挑教學上
有用的 export 成獨立 MusicXML 放進 sample_scores/, 隨 binary 一起 ship.

選曲原則:
- 補時代覆蓋: 文藝復興 (Ciconia/Palestrina/Monteverdi) + Modern (Schoenberg/Webern)
- 補地理多樣: 美國浪漫 (Beach) + 夏威夷 (Liliuokalani)
- 補 Bach 聖詠教學經典 (10 首加碼)
- 全部 < 200 measures, 避免大譜性能問題

執行: cd engine && .venv/bin/python3 scripts/export_corpus_to_samples.py
"""

from __future__ import annotations

import sys
from pathlib import Path

DEST = Path(__file__).parent.parent / "core" / "sample_scores"

# (corpus_path, output_slug, format)
# format: musicxml (預設) / 既有 OK
PIECES: list[tuple[str, str]] = [
    # ─── Bach 聖詠 (10 首加碼, 全部 4 部 SATB) ────────────────
    ("bach/bwv269", "bach_bwv269"),       # Aus meines Herzens Grunde
    ("bach/bwv347", "bach_bwv347"),       # Ich dank' dir, lieber Herre
    ("bach/bwv267", "bach_bwv267"),       # Ein Lämmlein geht
    ("bach/bwv17.7", "bach_bwv17_7"),     # Nun lob', mein' Seel'
    ("bach/bwv40.8", "bach_bwv40_8"),     # Freuet euch
    ("bach/bwv38.6", "bach_bwv38_6"),     # Aus tiefer Not
    ("bach/bwv33.6", "bach_bwv33_6"),     # Allein zu dir
    ("bach/bwv277", "bach_bwv277"),       # Christ lag in Todesbanden (alternate)
    ("bach/bwv178.7", "bach_bwv178_7"),   # Was Gott tut, das ist wohlgetan
    ("bach/bwv32.6", "bach_bwv32_6"),     # Mein Gott, öffne mir die Pforten

    # ─── 文藝復興 (Renaissance, ~1400-1600) ────────────────
    # Ciconia 1370-1412, 早期文藝復興過渡期
    ("ciconia/quod_jactatur", "ciconia_quod_jactatur"),
    # Palestrina Pope Marcellus Mass (~1562) — 對位範本
    ("palestrina/Kyrie", "palestrina_kyrie"),
    ("palestrina/Agnus", "palestrina_agnus"),
    # Monteverdi Madrigali — Book 3 + 5 (從 polyphony 到 monody 過渡)
    ("monteverdi/madrigal.3.1", "monteverdi_madrigal_3_1"),
    ("monteverdi/madrigal.5.1", "monteverdi_madrigal_5_1"),

    # ─── 巴洛克補充 ────────────────
    # CPE Bach (1714-1788) — 古典時期過渡, JS Bach 之子
    ("cpebach/h186", "cpebach_h186"),

    # ─── 浪漫補充 ────────────────
    # Amy Beach (1867-1944) — 美國第一位主流女性作曲家
    ("beach/prayer_of_a_tired_child", "beach_prayer"),
    # Liliuokalani (1838-1917) — 夏威夷末代女王作曲, 民族多樣性
    ("liliuokalani/aloha_oe", "liliuokalani_aloha_oe"),

    # ─── 現代 (Modern, 20 世紀初) ────────────────
    # Schoenberg Op.19 6 Little Piano Pieces (1911) — 自由無調性入門
    ("schoenberg/opus19/movement2", "schoenberg_op19_movement2"),
    ("schoenberg/opus19/movement6", "schoenberg_op19_movement6"),
    # Webern Op.16 No.2 (1924) — 序列主義
    ("webern/webern_dormi_jesu_op_16_no_2", "webern_op16_no2"),
]


def main() -> int:
    import music21  # noqa: PLC0415 — script-only import

    DEST.mkdir(parents=True, exist_ok=True)
    ok = 0
    fail: list[tuple[str, str]] = []
    for (corpus_path, slug) in PIECES:
        out = DEST / f"{slug}.musicxml"
        if out.exists():
            print(f"skip (已有): {slug}")
            ok += 1
            continue
        try:
            score = music21.corpus.parse(corpus_path)
            # 直接寫 musicxml (uncompressed for grep-ability)
            score.write("musicxml", fp=str(out))
            size = out.stat().st_size if out.exists() else 0
            if size < 500:
                fail.append((slug, f"too small: {size} bytes"))
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
            fail.append((slug, f"{type(e).__name__}: {e}"))

    print(f"\n=== Summary ===")
    print(f"OK: {ok} / {len(PIECES)}")
    if fail:
        print(f"FAILED:")
        for slug, err in fail:
            print(f"  - {slug}: {err}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

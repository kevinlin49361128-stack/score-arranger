#!/usr/bin/env python3
"""
fetch_openscore_lieder — 0.1.40 從 OpenScore/Lieder (CC0) 抓 MusicXML.

OpenScore 是 MuseScore 的官方公版 corpus, 全部 CC0 公領域貢獻, 商業 / 教學
使用都 OK. 檔案是 .mxl (壓縮 MusicXML), 直接放進 core/sample_scores/ 即用.

策略: 不是抓全部 (700+ Lieder 太多), 而是挑教學上常用 + 教師熟悉的曲目.
每首約 5-15KB, 30 首約 200KB - 0.5MB, DMG 體積影響可忽略.

選曲原則:
- Schubert: 知名 + 簡單 (給 Grade 2-3 學生伴奏)
- Beethoven Op.48/52: 完整 cycle, 小品教學
- Schumann Op.48 Dichterliebe: 已有 No.2, 補幾首
- Brahms Wiegenlied (Op.49 No.4): 搖籃曲, 必教
- Boulanger Lili: 20 世紀, 補曲目時代多樣性

用法: bash, 或 python this_script.py
輸出: engine/core/sample_scores/openscore_*.mxl
"""

from __future__ import annotations

import subprocess
import sys
import urllib.parse
from pathlib import Path

BASE = "https://raw.githubusercontent.com/OpenScore/Lieder/main/scores/"
DEST = Path(__file__).parent.parent / "core" / "sample_scores"

# (composer_dir, work, piece_subdir, file_id, slug, era)
# slug 是我們最終的檔名 (不含 .mxl), 留 alphanumeric_underscore 風格
PIECES = [
    # ─── Beethoven Op.48 6 Lieder (sacred poetry, Gellert texts) ──
    ("Beethoven,_Ludwig_van", "6_Lieder,_Op.48", "1_Bitten",
     "lc5115311", "beethoven_op48_1_bitten", "Classical"),
    ("Beethoven,_Ludwig_van", "6_Lieder,_Op.48",
     "2_Die_Liebe_des_Nächsten",
     "lc5115316", "beethoven_op48_2_liebe", "Classical"),
    ("Beethoven,_Ludwig_van", "6_Lieder,_Op.48", "3_Vom_Tode",
     "lc5115321", "beethoven_op48_3_tode", "Classical"),
    ("Beethoven,_Ludwig_van", "6_Lieder,_Op.48",
     "4_Die_Ehre_Gottes_aus_der_Natur",
     "lc5115326", "beethoven_op48_4_ehre", "Classical"),
    # ─── Beethoven Op.52 8 Lieder (lighter, more accessible) ──
    ("Beethoven,_Ludwig_van", "8_Lieder,_Op.52", "3_Das_Liedchen_von_der_Ruhe",
     "lc5115341", "beethoven_op52_3_ruhe", "Classical"),
    # ─── Schubert Op.3 (early standalone) ──
    ("Schubert,_Franz", "Op.3", "1_Schäfers_Klagelied,_D.121",
     "lc5135421", "schubert_op3_1_klagelied", "Romantic"),
    # ─── Schubert Op.22 (incl Sei mir gegrüßt) ──
    ("Schubert,_Franz", "Op.22", "1_Sei_mir_gegrüßt,_D.741",
     "lc5135441", "schubert_op22_1_seimir", "Romantic"),
    # ─── Schubert Die schöne Müllerin 選 3 首 ──
    ("Schubert,_Franz", "Die_schöne_Müllerin,_D.795", "1_Das_Wandern",
     "lc5135301", "schubert_d795_1_wandern", "Romantic"),
    ("Schubert,_Franz", "Die_schöne_Müllerin,_D.795", "2_Wohin",
     "lc5135306", "schubert_d795_2_wohin", "Romantic"),
    ("Schubert,_Franz", "Die_schöne_Müllerin,_D.795", "20_Des_Baches_Wiegenlied",
     "lc5135401", "schubert_d795_20_wiegenlied", "Romantic"),
    # ─── Schubert 4 Lieder Op.96 (Wanderers Nachtlied II 等) ──
    ("Schubert,_Franz", "4_Lieder,_Op.96", "3_Nachthelle,_D.768",
     "lc5135401b", "schubert_op96_3_nachthelle", "Romantic"),
    # ─── Schumann Liederkreis Op.39 — 5 首 ──
    ("Schumann,_Robert", "Liederkreis,_Op.39", "1_In_der_Fremde",
     "lc5135501", "schumann_op39_1_fremde", "Romantic"),
    ("Schumann,_Robert", "Liederkreis,_Op.39", "5_Mondnacht",
     "lc5135521", "schumann_op39_5_mondnacht", "Romantic"),
    # ─── Schumann Dichterliebe — 補 No.1, 3, 7 ──
    ("Schumann,_Robert", "Dichterliebe,_Op.48",
     "1_Im_wunderschönen_Monat_Mai",
     "lc5135561", "schumann_op48_1_mai", "Romantic"),
    ("Schumann,_Robert", "Dichterliebe,_Op.48",
     "3_Die_Rose,_die_Lilie,_die_Taube,_die_Sonne",
     "lc5135571", "schumann_op48_3_rose", "Romantic"),
    ("Schumann,_Robert", "Dichterliebe,_Op.48",
     "7_Ich_grolle_nicht",
     "lc5135591", "schumann_op48_7_grolle", "Romantic"),
    # ─── Schumann Frauenliebe und Leben — 開首 ──
    ("Schumann,_Robert", "Frauenliebe_und_Leben,_Op.42",
     "1_Seit_ich_ihn_gesehen",
     "lc5135601", "schumann_op42_1_seitich", "Romantic"),
    # ─── Brahms — 著名搖籃曲 ──
    # (Wiegenlied Op.49 No.4 — 找正確 path)
    # ─── Brahms Op.43 — 4 Songs ──
    ("Brahms,_Johannes", "4_Songs,_Op.43", "1_Von_ewiger_Liebe",
     "lc5135701", "brahms_op43_1_ewigeliebe", "Romantic"),
    # ─── Mendelssohn 6 Gesänge Op.86 ──
    ("Mendelssohn,_Felix", "6_Gesänge,_Op.86", "1_Es_lauschte_das_Laub",
     "lc5135801", "mendelssohn_op86_1_laub", "Romantic"),
    # ─── Lili Boulanger ──
    ("Boulanger,_Lili", "Clairières_dans_le_ciel", "1_Elle_était_descendue",
     "lc5135901", "boulanger_clairieres_1", "Romantic"),

    # ─── 0.1.43 加碼 — 大師名曲補完 ────────────────────────────────
    # Brahms 名曲: Wiegenlied (搖籃曲 必教), Die Mainacht, Op.121 嚴肅之歌
    ("Brahms,_Johannes", "5_Lieder,_Op.49", "4_Wiegenlied",
     "", "brahms_op49_4_wiegenlied", "Romantic"),
    ("Brahms,_Johannes", "4_Songs,_Op.43", "2_Die_Mainacht",
     "", "brahms_op43_2_mainacht", "Romantic"),
    ("Brahms,_Johannes", "4_Serious_Songs,_Op.121",
     "3_O_Tod,_wie_bitter_bist_du!",
     "", "brahms_op121_3_otod", "Romantic"),
    # Schubert 名曲: Heidenröslein, Ave Maria, Du bist die Ruh
    ("Schubert,_Franz", "Op.3", "3_Heidenröslein,_D.257",
     "", "schubert_op3_3_heidenroeslein", "Romantic"),
    ("Schubert,_Franz", "Op.52", "6_Ellens_Gesang_III,_D.839_(Ave_Maria)",
     "", "schubert_d839_ave_maria", "Romantic"),
    ("Schubert,_Franz", "Op.59", "3_Du_bist_die_Ruh",
     "", "schubert_op59_3_dubist", "Romantic"),
    ("Schubert,_Franz", "Op.59", "4_Lachen_und_Weinen",
     "", "schubert_op59_4_lachen", "Romantic"),
    # Schumann R 補幾首
    ("Schumann,_Robert", "Liederkreis,_Op.39", "3_Waldesgespräch",
     "", "schumann_op39_3_waldes", "Romantic"),
    ("Schumann,_Robert", "Liederkreis,_Op.39", "12_Frühlingsnacht",
     "", "schumann_op39_12_fruhling", "Romantic"),
    ("Schumann,_Robert", "Dichterliebe,_Op.48",
     "13_Ich_hab’_im_Traum_geweinet",
     "", "schumann_op48_13_traum", "Romantic"),
    ("Schumann,_Robert", "Frauenliebe_und_Leben,_Op.42",
     "2_Er,_der_Herrlichste_von_allen",
     "", "schumann_op42_2_herrlichste", "Romantic"),
    # Mahler — Kindertotenlieder + Lieder eines fahrenden Gesellen
    ("Mahler,_Gustav", "Kindertotenlieder",
     "1_Nun_will_die_Sonn’_so_hell_aufgeh’n",
     "", "mahler_kinder_1_sonn", "Romantic"),
    ("Mahler,_Gustav", "Kindertotenlieder",
     "4_Oft_denk’_ich,_sie_sind_nur_ausgegangen",
     "", "mahler_kinder_4_oft", "Romantic"),
    ("Mahler,_Gustav", "Lieder_eines_fahrenden_Gesellen",
     "2_Gieng_heut_morgen_übers_Feld",
     "", "mahler_gesellen_2_gieng", "Romantic"),
    ("Mahler,_Gustav", "Lieder_eines_fahrenden_Gesellen",
     "4_Die_zwei_blauen_Augen_von_meinem_Schatz",
     "", "mahler_gesellen_4_augen", "Romantic"),
    # Wolf Mörike-Lieder 名曲
    ("Wolf,_Hugo", "Mörike-Lieder", "12_Verborgenheit",
     "", "wolf_morike_12_verbor", "Romantic"),
    ("Wolf,_Hugo", "Mörike-Lieder", "5_Der_Tambour",
     "", "wolf_morike_5_tambour", "Romantic"),
    ("Wolf,_Hugo", "Mörike-Lieder", "9_Nimmersatte_Liebe",
     "", "wolf_morike_9_nimmer", "Romantic"),
    # Strauss R — Op.27 名歌 (Morgen! 必教)
    ("Strauss,_Richard", "4_Lieder,_Op.27", "2_Cäcilie",
     "", "strauss_op27_2_caecilie", "Romantic"),
    ("Strauss,_Richard", "4_Lieder,_Op.27", "3_Heimliche_Aufforderung",
     "", "strauss_op27_3_heimliche", "Romantic"),
    ("Strauss,_Richard", "4_Lieder,_Op.27", "4_Morgen!",
     "", "strauss_op27_4_morgen", "Romantic"),
    # Fauré — Chanson d'amour
    ("Fauré,_Gabriel", "Op.27", "1_Chanson_d’amour",
     "", "faure_op27_1_chanson", "Romantic"),
    # Debussy — Ariettes Oubliées, Bilitis (Modern 印象主義)
    ("Debussy,_Claude", "Ariettes_Oubliées",
     "2_Il_pleure_dans_mon_coeur",
     "", "debussy_ariettes_2_ilpleure", "Modern"),
    ("Debussy,_Claude", "Trois_Chansons_de_Bilitis",
     "1_La_flûte_de_Pan",
     "", "debussy_bilitis_1_flute", "Modern"),
    # Berlioz — Les nuits d'été (法國名套曲)
    ("Berlioz,_Hector", "Les_nuits_d’été,_Op.7", "1_Villanelle",
     "", "berlioz_nuits_1_villanelle", "Romantic"),
    # Berg — Op.2 (極早期, 將進入無調性)
    ("Berg,_Alban", "4_Gesänge,_Op.2", "1_Schlafen,_schlafen,_nichts_als_schlafen!",
     "", "berg_op2_1_schlafen", "Modern"),
]


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    ok = 0
    fail: list[tuple[str, str]] = []
    for (composer, work, piece, file_id, slug, era) in PIECES:
        # OpenScore 每首作品的 .mxl 檔名是 MuseScore corpus ID (e.g. lc5115311),
        # 各曲不同, 沒法寫死. 用 GitHub HTML directory listing 自動發現.
        dir_url = (
            "https://github.com/OpenScore/Lieder/tree/main/scores/"
            + urllib.parse.quote(composer, safe="") + "/"
            + urllib.parse.quote(work, safe="") + "/"
            + urllib.parse.quote(piece, safe="")
        )
        listing = subprocess.run(
            ["curl", "-sSL", "-A", "Mozilla/5.0", dir_url],
            capture_output=True, timeout=15,
        )
        import re as _re
        m = _re.search(
            r'"path":"scores/[^"]+/(lc\d+\.mxl)"', listing.stdout.decode(
                "utf-8", "replace"
            ),
        )
        if not m:
            fail.append((slug, "no .mxl in directory listing"))
            continue
        real_id = m.group(1)
        url = (
            BASE
            + urllib.parse.quote(composer, safe="") + "/"
            + urllib.parse.quote(work, safe="") + "/"
            + urllib.parse.quote(piece, safe="") + "/"
            + real_id
        )
        _ = file_id  # unused (kept for future override capability)
        out = DEST / f"openscore_{slug}.mxl"
        if out.exists():
            print(f"skip (已有): {slug}")
            ok += 1
            continue
        # 用 curl (macOS python ssl 缺 root CA 時 urllib 會炸).
        try:
            r = subprocess.run(
                ["curl", "-sSL", "-o", str(out),
                 "-A", "Score-Arranger/0.1.40",
                 "--fail", url],
                capture_output=True, timeout=20,
            )
            if r.returncode != 0:
                fail.append((slug, r.stderr.decode("utf-8", "replace")[:120]))
                continue
            size = out.stat().st_size if out.exists() else 0
            if size < 500:
                fail.append((slug, f"too small: {size} bytes"))
                out.unlink(missing_ok=True)
                continue
            print(f"✓ {slug} — {size // 1024} KB ({era})")
            ok += 1
        except Exception as e:
            fail.append((slug, str(e)))
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

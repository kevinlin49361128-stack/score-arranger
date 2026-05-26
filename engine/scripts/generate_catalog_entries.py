#!/usr/bin/env python3
"""Generate samples.py corpus IDs + catalog.ts entries for humdrum fetches."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent / "core" / "sample_scores"

# Beethoven Sonata No → opus + nickname (educational use)
BEETHOVEN_SONATAS = {
    1: ("Op.2 No.1 in F minor", "Classical", 6, 4),
    2: ("Op.2 No.2 in A major", "Classical", 7, 5),
    3: ("Op.2 No.3 in C major", "Classical", 7, 6),
    4: ("Op.7 in E♭ major", "Classical", 7, 6),
    5: ("Op.10 No.1 in C minor", "Classical", 6, 5),
    6: ("Op.10 No.2 in F major", "Classical", 6, 5),
    7: ("Op.10 No.3 in D major", "Classical", 7, 6),
    8: ("Op.13 \"Pathétique\"", "Classical", 7, 6),
    9: ("Op.14 No.1 in E major", "Classical", 6, 4),
    10: ("Op.14 No.2 in G major", "Classical", 6, 4),
    11: ("Op.22 in B♭ major", "Classical", 7, 6),
    12: ("Op.26 \"Funeral March\"", "Classical", 7, 6),
    13: ("Op.27 No.1 quasi una fantasia", "Classical", 7, 6),
    14: ("Op.27 No.2 \"Moonlight\"", "Classical", 6, 5),
    15: ("Op.28 \"Pastoral\"", "Classical", 7, 6),
    16: ("Op.31 No.1 in G major", "Classical", 7, 6),
    17: ("Op.31 No.2 \"Tempest\"", "Classical", 8, 7),
    18: ("Op.31 No.3 in E♭ major", "Classical", 7, 6),
    19: ("Op.49 No.1 (easy)", "Classical", 4, 3),
    20: ("Op.49 No.2 (easy)", "Classical", 4, 3),
    21: ("Op.53 \"Waldstein\"", "Classical", 8, 7),
    22: ("Op.54 in F major", "Classical", 7, 6),
    23: ("Op.57 \"Appassionata\"", "Classical", 8, 8),
    24: ("Op.78 in F♯ major", "Classical", 7, 6),
    25: ("Op.79 in G major (easy)", "Classical", 5, 4),
    26: ("Op.81a \"Les Adieux\"", "Classical", 7, 6),
    27: ("Op.90 in E minor", "Classical", 7, 6),
    28: ("Op.101 in A major (late)", "Classical", 8, 7),
    29: ("Op.106 \"Hammerklavier\"", "Classical", 9, 9),
    30: ("Op.109 in E major (late)", "Classical", 8, 8),
    31: ("Op.110 in A♭ major (late)", "Classical", 8, 8),
    32: ("Op.111 in C minor (late)", "Classical", 9, 9),
}

# Beethoven Quartet No → opus + nickname
BEETHOVEN_QUARTETS = {
    1: "Op.18 No.1 in F major",
    2: "Op.18 No.2 in G major",
    3: "Op.18 No.3 in D major",
    4: "Op.18 No.4 in C minor",
    5: "Op.18 No.5 in A major",
    7: "Op.59 No.1 \"Razumovsky 1\"",
    8: "Op.59 No.2 \"Razumovsky 2\"",
    9: "Op.59 No.3 \"Razumovsky 3\"",
    10: "Op.74 \"Harp\"",
    11: "Op.95 \"Serioso\"",
    12: "Op.127 (late)",
    13: "Op.130 (late)",
    14: "Op.131 in C♯ minor (late)",
    15: "Op.132 in A minor (late)",
    16: "Op.135 (late)",
}

# Mozart Sonata No → K. number + key
MOZART_SONATAS = {
    1: ("K.279 in C major", 5, 3),
    2: ("K.280 in F major", 5, 3),
    3: ("K.281 in B♭ major", 5, 3),
    4: ("K.282 in E♭ major", 5, 4),
    5: ("K.283 in G major", 5, 4),
    6: ("K.284 in D major \"Dürnitz\"", 6, 5),
    7: ("K.309 in C major", 6, 5),
    8: ("K.310 in A minor", 7, 6),
    9: ("K.311 in D major", 6, 5),
    10: ("K.330 in C major", 6, 5),
    11: ("K.331 in A major \"Alla Turca\"", 6, 5),
    12: ("K.332 in F major", 6, 5),
    13: ("K.333 in B♭ major", 6, 5),
    14: ("K.457 in C minor", 7, 6),
    15: ("K.533/494 in F major", 7, 6),
    17: ("K.570 in B♭ major", 6, 5),
    18: ("K.576 in D major", 7, 6),
}

# Haydn Sonata Hob.XVI No → key
HAYDN_SONATAS = {
    37: "Hob.XVI/37 in D major", # 著名
    50: "Hob.XVI/50 in C major",
}

# Chopin Mazurka op-no → catalog title
CHOPIN_MAZURKAS = {
    (6, 1): "Op.6 No.1 in F♯ minor",
    (7, 1): "Op.7 No.1 in B♭ major",
    (7, 2): "Op.7 No.2 in A minor",
    (17, 4): "Op.17 No.4 in A minor",
    (24, 2): "Op.24 No.2 in C major",
    (33, 2): "Op.33 No.2 in D major",
    (67, 4): "Op.67 No.4 in A minor",
    (68, 4): "Op.68 No.4 in F minor",
}

JOPLIN_RAGS = {
    "entertainer": "The Entertainer",
    "solace": "Solace (A Mexican Serenade)",
}


def get_measures(file_path: Path) -> int:
    """Quick read measure count from MusicXML header."""
    try:
        text = file_path.read_text(encoding="utf-8", errors="replace")
        # 數 <measure ...> 出現次數 (用 part 0 大略 — 全 part 平均)
        match_count = len(re.findall(r"<measure\s+number=", text))
        # 通常是 num_parts × num_measures, 但這比較快粗略
        # 用 first part's measures as approximation: count up to "</part>"
        first_part = text.split("</part>")[0] if "</part>" in text else text
        return len(re.findall(r"<measure\s+number=", first_part))
    except Exception:
        return 0


def gen_entries() -> tuple[list[str], list[str]]:
    """Return (corpus_id list for samples.py, TS entries for catalog.ts)."""
    corpus_ids: list[str] = []
    ts_entries: list[str] = []

    files = sorted(ROOT.glob("*.musicxml"))

    for f in files:
        slug = f.stem
        ts_entry: str | None = None

        # ── Bach Inventions ──
        m = re.match(r"^bach_invention_(\d{2})$", slug)
        if m:
            n = int(m.group(1))
            measures = get_measures(f)
            corpus_ids.append(slug)
            ts_entry = f'''  {{
    corpus_path: "{slug}",
    title: "Two-Part Invention No.{n} (BWV {771 + n})",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Sonata", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1723, measures: {measures},
    grade: 5, henle_level: 3,
    tags: ["counterpoint", "scales"],
  }},'''

        # ── Beethoven Sonatas ──
        m = re.match(r"^beethoven_sonata_(\d{2})_1$", slug)
        if m:
            n = int(m.group(1))
            info = BEETHOVEN_SONATAS.get(n)
            if info:
                title, era, grade, henle = info
                measures = get_measures(f)
                corpus_ids.append(slug)
                ts_entry = f'''  {{
    corpus_path: "{slug}",
    title: "Piano Sonata No.{n} {title} mvt.1",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "{era}", form: "Sonata", ensemble: "Piano Solo",
    instruments: ["piano"], year: {1795 + n}, measures: {measures},
    grade: {grade}, henle_level: {henle},
    tags: ["expression", "rhythm"],
  }},'''

        # ── Beethoven Quartets ──
        m = re.match(r"^beethoven_quartet_(\d{2})_1$", slug)
        if m:
            n = int(m.group(1))
            title = BEETHOVEN_QUARTETS.get(n)
            if title:
                measures = get_measures(f)
                # 早期 op.18 grade 7 / henle 6, 中期 op.59-95 grade 8 / henle 7,
                # 晚期 op.127-135 grade 9 / henle 9
                if n <= 6:
                    grade, henle = 7, 6
                elif n <= 11:
                    grade, henle = 8, 7
                else:
                    grade, henle = 9, 9
                corpus_ids.append(slug)
                ts_entry = f'''  {{
    corpus_path: "{slug}",
    title: "String Quartet No.{n} {title} mvt.1",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: {1798 + n * 2}, measures: {measures},
    henle_level: {henle},
    tags: ["expression", "ensemble"],
  }},'''

        # ── Mozart Sonatas ──
        m = re.match(r"^mozart_sonata_(\d{2})_1$", slug)
        if m:
            n = int(m.group(1))
            info = MOZART_SONATAS.get(n)
            if info:
                title, grade, henle = info
                measures = get_measures(f)
                corpus_ids.append(slug)
                ts_entry = f'''  {{
    corpus_path: "{slug}",
    title: "Piano Sonata {title} mvt.1",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Sonata", ensemble: "Piano Solo",
    instruments: ["piano"], year: {1774 + n}, measures: {measures},
    grade: {grade}, henle_level: {henle},
    tags: ["scales", "legato"],
  }},'''

        # ── Chopin Preludes Op.28 ──
        m = re.match(r"^chopin_prelude_28_(\d{2})$", slug)
        if m:
            n = int(m.group(1))
            measures = get_measures(f)
            corpus_ids.append(slug)
            # 短 prelude (<20m) 入門級 5, 長且難 (>50m) 高 7
            grade = 5 if measures < 20 else (7 if measures > 50 else 6)
            henle = 4 if measures < 30 else 5
            ts_entry = f'''  {{
    corpus_path: "{slug}",
    title: "Prelude Op.28 No.{n}",
    composer: "Frédéric Chopin", composer_dates: "1810-1849",
    era: "Romantic", form: "Character Piece", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1839, measures: {measures},
    grade: {grade}, henle_level: {henle},
    tags: ["expression", "legato"],
  }},'''

        # ── Chopin Mazurkas ──
        m = re.match(r"^chopin_mazurka_(\d{2})_(\d)$", slug)
        if m:
            op = int(m.group(1))
            no = int(m.group(2))
            title = CHOPIN_MAZURKAS.get((op, no))
            if title:
                measures = get_measures(f)
                corpus_ids.append(slug)
                ts_entry = f'''  {{
    corpus_path: "{slug}",
    title: "Mazurka {title}",
    composer: "Frédéric Chopin", composer_dates: "1810-1849",
    era: "Romantic", form: "Mazurka", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1832, measures: {measures},
    grade: 6, henle_level: 5,
    tags: ["expression", "rhythm"],
  }},'''

        # ── Joplin Rags ──
        m = re.match(r"^joplin_(.+)$", slug)
        if m and m.group(1) in JOPLIN_RAGS:
            key = m.group(1)
            title = JOPLIN_RAGS[key]
            measures = get_measures(f)
            corpus_ids.append(slug)
            ts_entry = f'''  {{
    corpus_path: "{slug}",
    title: "{title}",
    composer: "Scott Joplin", composer_dates: "1868-1917",
    era: "Romantic", form: "Rag", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1902, measures: {measures},
    grade: 6, henle_level: 4,
    tags: ["rhythm", "staccato"],
  }},'''

        # ── Haydn Sonatas ──
        m = re.match(r"^haydn_sonata_(\d{2})_1$", slug)
        if m:
            n = int(m.group(1))
            title = HAYDN_SONATAS.get(n)
            if title:
                measures = get_measures(f)
                corpus_ids.append(slug)
                ts_entry = f'''  {{
    corpus_path: "{slug}",
    title: "Piano Sonata {title} mvt.1",
    composer: "Joseph Haydn", composer_dates: "1732-1809",
    era: "Classical", form: "Sonata", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1780, measures: {measures},
    grade: 6, henle_level: 5,
    tags: ["scales", "expression"],
  }},'''

        if ts_entry:
            ts_entries.append(ts_entry)

    return corpus_ids, ts_entries


if __name__ == "__main__":
    corpus_ids, ts_entries = gen_entries()
    print(f"// Generated {len(corpus_ids)} entries")
    print()
    print("// === Python (samples.py SAMPLE_CORPUS_IDS additions) ===")
    for c in corpus_ids:
        print(f'    "{c}",')
    print()
    print("// === TypeScript (catalog.ts REPERTOIRE additions) ===")
    print("\n".join(ts_entries))

#!/usr/bin/env python3
"""grade_corpus_difficulty — 用引擎的 difficulty.py 把線上 corpus 缺難度的曲子補滿。

現況: catalog 1103 首裡 ~469 有 henle_level (build 腳本寫死), ~634 沒有。
本腳本對沒有的: 抓 MusicXML → parse → analyze_score_difficulty → 取「最難聲部」
的 score_1_to_5 (演奏者實際面對的難度) → 映射成 Henle 1-9 → 寫回 henle_level,
並標 difficulty_auto=True 以區分「引擎估算」與「官方 Henle」。

只填空白, 不覆蓋既有的 469 筆 (那些是有來源依據的)。
前端 RepertoireDialog 的篩選讀 grade ?? henle_level → 補滿後 1103 首全可依難度篩。

用法: cd engine && .venv/bin/python3 scripts/grade_corpus_difficulty.py
之後: gh release upload corpus-v1 engine/corpus/catalog.json --clobber
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from core.difficulty import analyze_score_difficulty  # noqa: E402
from core.parser import parse_musicxml  # noqa: E402

CATALOG = Path(__file__).parent.parent / "corpus" / "catalog.json"


def henle_from_score(s: float) -> int:
    """引擎 1-5 → Henle 1-9 線性映射 (1→1, 3→5, 5→9)。"""
    return max(1, min(9, round(1 + (s - 1) / 4 * 8)))


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    miss = [e for e in catalog["entries"] if e.get("henle_level") is None]
    print(f"要評分: {len(miss)} 首")

    tmp = Path(tempfile.mkdtemp(prefix="gradecorpus_"))
    graded = failed = 0
    dist: Counter[int] = Counter()

    for i, e in enumerate(miss):
        url = e.get("url")
        if not url:
            failed += 1
            continue
        f = tmp / f"g{i}.musicxml"
        r = subprocess.run(["curl", "-sL", url, "-o", str(f)], capture_output=True)
        if r.returncode != 0 or not f.exists() or f.stat().st_size < 200:
            failed += 1
            continue
        try:
            score = parse_musicxml(str(f))
            diffs = analyze_score_difficulty(score)
            if not diffs:
                failed += 1
                continue
            # 整曲難度 = 最難聲部 (演奏者實際面對的)
            piece = max(d.score_1_to_5 for d in diffs.values())
            e["henle_level"] = henle_from_score(piece)
            e["difficulty_auto"] = True
            dist[e["henle_level"]] += 1
            graded += 1
        except Exception as ex:  # noqa: BLE001
            print(f"  ✗ {e['corpus_path']}: {type(ex).__name__}")
            failed += 1
        finally:
            f.unlink(missing_ok=True)
        if (i + 1) % 50 == 0:
            print(f"  …{i + 1}/{len(miss)} (graded {graded}, failed {failed})")

    CATALOG.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    total_have = sum(1 for e in catalog["entries"]
                     if e.get("henle_level") is not None)
    print(f"\n=== 完成: 評分 {graded}, 失敗 {failed} ===")
    print(f"catalog henle 覆蓋: {total_have}/{len(catalog['entries'])}")
    print("本次估算的 Henle 分布:", dict(sorted(dist.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())

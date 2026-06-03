"""C2: 分頁 OMR 拼接 — 把多個涵蓋部分頁面的 MusicXML 串成一份完整樂譜。

大型 PDF 分頁 (chunk) OMR 後, 各 chunk 產出涵蓋自己那段頁面的 MusicXML;
本模組依序串接各 chunk 的 measures (依 part index 對齊) 成一份 IR Score,
再序列化回 MusicXML。

假設: 各 chunk 的聲部結構一致 (同樂器、同順序) —— 多頁總譜成立。
若某 chunk 聲部數不一致, 以最少者為準保守對齊 (多出的 part 略過)。
"""
from __future__ import annotations

from core.ir import Score
from core.ir_to_musicxml import score_to_musicxml
from core.parser import parse_musicxml


def stitch_scores(chunk_paths: list[str]) -> Score:
    """把多個 chunk 的 MusicXML 依序拼成一份 IR Score。"""
    if not chunk_paths:
        raise ValueError("無 chunk 可拼接")
    scores = [parse_musicxml(p) for p in chunk_paths]
    base = scores[0]
    for s in scores[1:]:
        for i, part in enumerate(s.parts):
            if i >= len(base.parts):
                break  # 後續 chunk 多出的 part → 結構不一致, 保守略過
            base.parts[i].measures.extend(part.measures)
    _renumber(base)
    return base


def stitch_to_musicxml(chunk_paths: list[str], out_path: str) -> str:
    """拼接後序列化成 MusicXML 檔, 回傳 out_path。"""
    score = stitch_scores(chunk_paths)
    xml = score_to_musicxml(score)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(xml)
    return out_path


def _renumber(score: Score) -> None:
    """串接後重新編號 measures + 修 movement 計數。

    只有全曲第一小節可保留 pickup (number=0); 其餘一律連續編號。
    OMR 不切樂章, 全曲視為單一 movement。
    """
    for part in score.parts:
        n = 1
        for idx, m in enumerate(part.measures):
            if idx == 0 and getattr(m, "is_pickup", False):
                m.number = 0  # 起拍保持 0, 不佔正式編號
            else:
                m.is_pickup = False
                m.number = n
                n += 1
    total = max((len(p.measures) for p in score.parts), default=0)
    if score.movements:
        score.movements = score.movements[:1]
        score.movements[0].measure_count = total
        score.movements[0].sections = []  # 跨 chunk 後 section span 失效, 清掉

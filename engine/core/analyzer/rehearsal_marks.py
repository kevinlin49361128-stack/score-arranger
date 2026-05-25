"""
rehearsal_marks — 0.1.38 改編完成後自動加 [A][B][C] 排練記號.

對音樂老師的痛點:「我跟學生說『從 B 段第 3 小節再來』, 學生看不到 B 段在哪.」

策略:
  1. 第一優先: 用 melody part 的 phrase boundaries (analyze 過的話)
  2. fallback: 每 N 小節插一個 (default N=16 — 古典樂常見的樂段長度)
  3. 太短 (<8 小節) 不插, 太密 (>15 marks) 退回 every-N

字母規則: A B C D E F G H J K L M N P Q R S T U V W X Y Z
  跳 I (易混 1) 跳 O (易混 0). 26 - 2 = 24 個字母, 超過用 AA AB AC...
  (但實務 24 段已超出絕大多數曲目)

寫入位置: Measure.rehearsal_mark — IR 已支援, ir_to_musicxml 已序列化
  <direction> <direction-type><rehearsal>A</rehearsal></direction-type></direction>
"""

from __future__ import annotations

from typing import Optional

from ..ir import Score


# 跳 I / O 避免跟 1 / 0 混淆 (Dorico / Sibelius / 出版業界慣例)
_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

# 預設每 N 小節插一個 — 16 涵蓋古典 4-bar phrase × 4 個典型結構
_DEFAULT_INTERVAL_MEASURES = 16
# 樂句邊界數超過此值 → 改用 every-N (避免每 4 小節一個 mark, 太密)
_MAX_PHRASE_MARKS = 15
# 譜 < 此長度就不加排練記號
_MIN_MEASURES_FOR_MARKS = 8


def _letter_for_index(idx: int) -> str:
    """0 → "A", 1 → "B", ..., 24 → "AA", 25 → "AB", ..."""
    n = len(_LETTERS)
    if idx < n:
        return _LETTERS[idx]
    # double letter: AA, AB, AC ...
    first = idx // n - 1
    second = idx % n
    return _LETTERS[first] + _LETTERS[second]


def _pick_mark_measures(
    total_measures: int,
    phrase_starts: Optional[list[int]] = None,
    interval: int = _DEFAULT_INTERVAL_MEASURES,
) -> list[int]:
    """選哪些 measure 要放排練記號.

    回傳 sorted measure_numbers (1-indexed).
    不包含 measure 1 — 開頭不需要 mark (起點本來就是起點).
    """
    if total_measures < _MIN_MEASURES_FOR_MARKS:
        return []

    # 樂句模式: 用提供的 phrase_starts (1-indexed measure numbers)
    if phrase_starts and len(phrase_starts) <= _MAX_PHRASE_MARKS:
        # 過濾掉 measure 1 (起點不需要 mark) + 排序去重
        marks = sorted({m for m in phrase_starts if m > 1})
        if marks and len(marks) <= _MAX_PHRASE_MARKS:
            return marks

    # Fallback: every-N
    marks = list(range(interval + 1, total_measures + 1, interval))
    return marks


def insert_rehearsal_marks(
    score: Score,
    interval: int = _DEFAULT_INTERVAL_MEASURES,
    phrase_starts: Optional[list[int]] = None,
) -> int:
    """在所有 part 同步插 rehearsal marks (A/B/C/...).

    所有 part 在同一小節 number 插同一個字母 — 指揮 / 演奏者讀譜時方便對齊.

    回傳: 實際寫入的 mark 數量.
    """
    if not score.parts:
        return 0
    # 用第一個 part 算總小節數
    total = len(score.parts[0].measures)
    mark_measures = _pick_mark_measures(
        total, phrase_starts=phrase_starts, interval=interval,
    )
    if not mark_measures:
        return 0

    # 對每個 part 同步寫入
    count = 0
    for part in score.parts:
        # measure_number → measure 索引
        by_num = {m.number: m for m in part.measures}
        for i, mnum in enumerate(mark_measures):
            measure = by_num.get(mnum)
            if measure is None:
                continue
            # 不覆蓋已存在的 rehearsal_mark (使用者可能手動加過)
            if measure.rehearsal_mark is None:
                measure.rehearsal_mark = _letter_for_index(i)
                count += 1
    return count


def detect_phrase_starts(score: Score) -> list[int]:
    """從第一個 melody part 偵測樂句起始 measure (1-indexed).

    用既有 analyzer.phrase.detect_phrases. 失敗回空 list, 走 every-N fallback.
    """
    try:
        from .phrase import detect_phrases
    except Exception:
        return []
    if not score.parts:
        return []
    # 用第一個 part 推斷樂句 (通常是 melody / soprano)
    part = score.parts[0]
    # 用 Score 第一 section, 如果沒有 section 就建一個全曲 section
    movements = getattr(score, "movements", None)
    if not movements:
        return []
    sections: list = []
    for m in movements:
        sections.extend(getattr(m, "sections", []))
    if not sections:
        return []
    starts: set[int] = set()
    for section in sections:
        try:
            phrases = detect_phrases(part, section)
        except Exception:
            continue
        # Phrase.start = (measure_number, TimePoint)
        for ph in phrases:
            starts.add(int(ph.start[0]))
    return sorted(starts)

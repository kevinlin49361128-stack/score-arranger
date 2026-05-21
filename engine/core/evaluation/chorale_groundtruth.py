"""
Bach 聖詠樂句邊界「客觀」Ground Truth — 由延長記號 (fermata) 推導。

對應規格: docs/phrase-detection-spec.md §8 (Phase 0 通過標準)

動機
----
Phrase detection 評估框架 (`phrase_eval.py`) 已備齊, 但缺少實際的
ground-truth 標註集, 因此無法系統性量測偵測器準確度。

Bach 四部聖詠在 music21 corpus 中以**延長記號**標示樂句結尾: 每個樂句
最後一個音 (或和弦) 上有一個 fermata, 下一樂句從之後的小節開始。因此可
**客觀地**從 fermata 位置推導樂句邊界, 不需人工標註。

Fermata → boundary 規則
-----------------------
1. 掃描每個聲部, 找出「含至少一個 fermata 的小節」(fermata 在音符的
   ``articulations`` 或 RestEvent 的 ``fermata`` 旗標)。聖詠四部通常在
   同一小節同時收尾, 故對所有聲部取聯集。
2. 每個 fermata 小節代表一個樂句的**結尾**。對應的 boundary =「該 fermata
   小節之後、下一個有內容的小節編號」(= 下一樂句的起始小節)。
   - 聖詠小節編號為連續整數, 故實務上 boundary = fermata_measure 之後第一個
     存在的小節。以實際小節清單查找, 對小節編號跳號保持穩健。
3. **最後一個 fermata** 位於全曲最後一小節 → 它是樂曲終點, 不是內部邊界,
   略過 (其「下一小節」不存在)。
4. **小節中段的 fermata**: 聖詠 fermata 落在結構性的樂句結尾音上 (常在第
   3 拍), 不一定是小節最後一拍。無論 fermata 在小節何處, 下一樂句都從下一
   小節開始 → 規則一致, 不需特例。
5. **連續小節皆有 fermata** (例: bwv245.40 第 22、23 小節): 每個 fermata
   小節各自結束一個樂句, 規則 2 自然產生一個 1 小節長的樂句, 不需特例。
6. **弱起小節 / anacrusis**: 弱起小節 (IR 中常為小節 0) 屬於第一個樂句,
   第一樂句從最小小節編號開始。fermata 不會落在弱起小節, 故 boundary 永遠
   ≥ 1, 與「內部邊界 = 第 i>0 個樂句的起始小節」定義一致。

內部邊界定義與 ``evaluate_phrase_detection`` 一致: 非第一個樂句的起始小節。
"""

from __future__ import annotations

from dataclasses import dataclass

from core.ir import ChordEvent, NoteEvent, Part, RestEvent, Score
from core.parser import parse_stream

# music21 為選用相依 — 僅在實際用到 corpus 載入時才匯入。

# ============================================================================
# Curated 四部聖詠清單
# ============================================================================
#
# 經 music21 corpus 掃描驗證: 皆為 4 聲部、含 fermata 標記的聖詠。
# 涵蓋多種情形 — 弱起 (m0) 與非弱起 (m1)、短曲 (~9 小節) 與長曲 (~32 小節)、
# 連續 fermata (bwv245.40)。固定清單以維持測試時間可預期。
CURATED_BACH_CHORALES: list[str] = [
    "bach/bwv66.6",
    "bach/bwv7.7",
    "bach/bwv26.6",
    "bach/bwv40.8",
    "bach/bwv57.8",
    "bach/bwv151.5",
    "bach/bwv245.40",
    "bach/bwv267",
    "bach/bwv281",
    "bach/bwv294",
    "bach/bwv318",
    "bach/bwv321",
    "bach/bwv347",
    "bach/bwv356",
    "bach/bwv386",
    "bach/bwv419",
]


# ============================================================================
# Data types
# ============================================================================

@dataclass
class ChoraleGroundTruth:
    """單首聖詠由 fermata 推導的樂句邊界 ground truth。"""

    piece_id: str                  # e.g. "bach/bwv66.6"
    start_measure: int             # 全曲最小小節編號 (弱起時為 0)
    end_measure: int               # 全曲最大小節編號
    fermata_measures: list[int]    # 含 fermata 的小節 (含最後一個)
    boundaries: list[int]          # 內部邊界 (排除終曲 fermata)


# ============================================================================
# Fermata 偵測
# ============================================================================

def _measure_has_fermata(part: Part, measure_number: int) -> bool:
    """判斷指定聲部的指定小節是否含 fermata。"""
    for measure in part.measures:
        if measure.number != measure_number:
            continue
        for voice in measure.voices.values():
            if voice.is_divisi:
                continue
            for event in voice.events:
                if isinstance(event, RestEvent) and event.fermata:
                    return True
                if (
                    isinstance(event, (NoteEvent, ChordEvent))
                    and "fermata" in event.articulations
                ):
                    return True
    return False


def fermata_measures(score: Score) -> list[int]:
    """回傳整首樂譜中含 fermata 的小節編號 (所有聲部聯集, 由小到大)。"""
    found: set[int] = set()
    for part in score.parts:
        for measure in part.measures:
            if _measure_has_fermata(part, measure.number):
                found.add(measure.number)
    return sorted(found)


def _all_measure_numbers(score: Score) -> list[int]:
    """回傳全曲出現過的小節編號 (所有聲部聯集, 由小到大)。"""
    numbers: set[int] = set()
    for part in score.parts:
        for measure in part.measures:
            numbers.add(measure.number)
    return sorted(numbers)


# ============================================================================
# Ground truth 推導
# ============================================================================

def derive_ground_truth(score: Score, piece_id: str) -> ChoraleGroundTruth:
    """從一首已解析的聖詠 IR 推導樂句邊界 ground truth。

    見模組 docstring 的「Fermata → boundary 規則」。
    """
    measure_numbers = _all_measure_numbers(score)
    if not measure_numbers:
        raise ValueError(f"{piece_id}: 樂譜沒有任何小節")

    start_measure = measure_numbers[0]
    end_measure = measure_numbers[-1]
    measure_set = set(measure_numbers)

    ferm = fermata_measures(score)

    boundaries: list[int] = []
    for fm in ferm:
        # 規則 3: 終曲 fermata (落在最後一小節) 不是內部邊界。
        if fm >= end_measure:
            continue
        # 規則 2: boundary = fermata 小節之後第一個存在的小節。
        nxt = fm + 1
        while nxt not in measure_set and nxt <= end_measure:
            nxt += 1
        # 下一小節須存在且非樂曲終點才算內部邊界。
        if nxt in measure_set and nxt < end_measure + 1:
            boundaries.append(nxt)

    # 去重並排序 (連續 fermata 不會碰撞, 但防禦性處理)。
    boundaries = sorted(set(boundaries))

    return ChoraleGroundTruth(
        piece_id=piece_id,
        start_measure=start_measure,
        end_measure=end_measure,
        fermata_measures=ferm,
        boundaries=boundaries,
    )


def load_chorale_ground_truth(corpus_id: str) -> tuple[Score, ChoraleGroundTruth]:
    """從 music21 corpus 載入一首聖詠並推導 ground truth。

    回傳 (已解析的 IR Score, ChoraleGroundTruth)。
    Score 一併回傳, 讓 caller 不必重新解析即可跑 detect_phrases。
    """
    from music21 import corpus as m21_corpus

    m21_score = m21_corpus.parse(corpus_id)
    ir_score = parse_stream(m21_score)
    gt = derive_ground_truth(ir_score, piece_id=corpus_id)
    return ir_score, gt

"""
和聲分析 (Harmonic Analysis)

對應規格: architecture.md §4.2.2

Phase 1 範圍:
- 自動偵測整曲調性 (music21 key detection)
- 用 chordify 取得每小節主要和弦
- 識別 Roman numeral
- 偵測終止式 (V→I 完全終止、V→vi 假終止)

Phase 2 留 TODO:
- 二級屬七 (V/V) 與屬準和弦
- 增六和弦、拿坡里
- 半音和聲 (Chopin/Wagner 風格)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from music21 import chord as m21_chord, key as m21_key, roman, stream as m21_stream

from core.ir import Score
from core.ir_to_music21 import ir_to_music21


# ============================================================================
# 報告資料模型
# ============================================================================

@dataclass
class ChordEntry:
    """單一和弦的位置與功能標記。"""
    measure: int
    offset: float                    # 小節內 offset (quarter)
    roman_numeral: Optional[str]     # "I", "V7", "ii", ...
    quality: Optional[str]           # "major", "minor", "dominant-seventh", ...
    bass: Optional[str]              # 最低音


@dataclass
class CadenceMarker:
    """終止式標記。"""
    measure: int                     # 終止解決所在小節
    kind: str                        # "authentic" / "half" / "deceptive" / "plagal"
    from_chord: str                  # 例如 "V"
    to_chord: str                    # 例如 "I"


@dataclass
class HarmonyReport:
    detected_key: str                # "C major" 等
    key_confidence: float            # music21 key analysis 信心
    chords: list[ChordEntry] = field(default_factory=list)
    cadences: list[CadenceMarker] = field(default_factory=list)


# ============================================================================
# 主分析流程
# ============================================================================

def analyze_harmony(score: Score) -> HarmonyReport:
    """對 Score 進行和聲分析,回傳和弦序列與終止式。"""
    m21 = ir_to_music21(score)

    # 1. 調性偵測
    try:
        key_obj = m21.analyze("key")
        key_str = f"{key_obj.tonic.name} {key_obj.mode}"
        confidence = float(getattr(key_obj, "correlationCoefficient", 0.0))
    except Exception:
        key_obj = m21_key.Key("C")
        key_str = "C major"
        confidence = 0.0

    # 2. Chordify
    try:
        chordified = m21.chordify()
    except Exception:
        return HarmonyReport(
            detected_key=key_str, key_confidence=confidence,
        )

    chords: list[ChordEntry] = []
    for m in chordified.getElementsByClass(m21_stream.Measure):
        for c in m.flatten().getElementsByClass(m21_chord.Chord):
            entry = _build_chord_entry(c, m.number, key_obj)
            if entry is not None:
                chords.append(entry)

    # 3. 終止式偵測 (look for V→I, V→vi, V→V, IV→I 之類)
    cadences = _detect_cadences(chords)

    return HarmonyReport(
        detected_key=key_str,
        key_confidence=confidence,
        chords=chords,
        cadences=cadences,
    )


def _build_chord_entry(
    c: m21_chord.Chord, measure_number: int, key_obj
) -> Optional[ChordEntry]:
    try:
        rn = roman.romanNumeralFromChord(c, key_obj)
        rn_str = rn.romanNumeralAlone  # 不含轉位數字
    except Exception:
        rn_str = None

    return ChordEntry(
        measure=measure_number,
        offset=float(c.offset),
        roman_numeral=rn_str,
        quality=c.quality if hasattr(c, "quality") else None,
        bass=c.bass().nameWithOctave if c.bass() else None,
    )


def _detect_cadences(chords: list[ChordEntry]) -> list[CadenceMarker]:
    """從和弦序列偵測終止式。

    Phase 1 簡化規則:
    - V → I 或 V → i : authentic
    - V → vi 或 V → VI : deceptive
    - I → V 或 i → V (停在 V 末尾, 樂句結束): half
    - IV → I 或 iv → i : plagal
    """
    cadences: list[CadenceMarker] = []
    if len(chords) < 2:
        return cadences

    AUTHENTIC = {("V", "I"), ("V", "i"), ("V7", "I"), ("V7", "i")}
    DECEPTIVE = {("V", "vi"), ("V", "VI"), ("V7", "vi"), ("V7", "VI")}
    PLAGAL = {("IV", "I"), ("iv", "i")}

    # 取每小節最後一個與下小節第一個和弦
    by_measure: dict[int, list[ChordEntry]] = {}
    for c in chords:
        by_measure.setdefault(c.measure, []).append(c)

    measures = sorted(by_measure.keys())
    for i in range(len(measures) - 1):
        curr_m = measures[i]
        next_m = measures[i + 1]
        if next_m - curr_m > 2:  # 跳超過 2 小節不視為連續
            continue
        last_curr = by_measure[curr_m][-1].roman_numeral
        first_next = by_measure[next_m][0].roman_numeral

        if last_curr is None or first_next is None:
            continue

        pair = (last_curr, first_next)
        if pair in AUTHENTIC:
            cadences.append(CadenceMarker(
                measure=next_m, kind="authentic",
                from_chord=last_curr, to_chord=first_next,
            ))
        elif pair in DECEPTIVE:
            cadences.append(CadenceMarker(
                measure=next_m, kind="deceptive",
                from_chord=last_curr, to_chord=first_next,
            ))
        elif pair in PLAGAL:
            cadences.append(CadenceMarker(
                measure=next_m, kind="plagal",
                from_chord=last_curr, to_chord=first_next,
            ))

    return cadences

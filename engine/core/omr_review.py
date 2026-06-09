"""omr_review — OMR 後校正「標可疑音給人複檢」層 (③ 路線)。

決策 docs/decision-pdf-omr.html + PoC 結論: harmony-aware 偵測能標出疑似 OMR
辨識錯誤的音, 但**不能自動套用** (約半數錯誤落在調內音, 符號層無法與合法 NCT
區分; 且偶會把合法半音誤判要改)。故本模組只「**標記 + 建議**」, 交由人複檢,
絕不自動改譜。

純讀取: 吃 IR Score, 回 list[SuspiciousNote]。不變動 score, 不依賴策略/迴圈。
和聲 context 走 analyze_harmony(key_window=...) 的轉調感知路徑 (#3), 以降假陽性。
"""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Optional

from .analyzer.harmony_function import (
    analyze_harmony,
    classify_note_function,
    find_region_at,
)
from .ir import NoteEvent, Score

# 預設局部 key 視窗半徑 (quarters) — PoC 實測對轉調曲目降假陽性。
DEFAULT_KEY_WINDOW = 8

_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def _note_name(midi: int) -> str:
    return f"{_NAMES[midi % 12]}{midi // 12 - 1}"


@dataclass
class SuspiciousNote:
    """一個疑似 OMR 辨識錯誤的音 (給人複檢, 不自動套用)。"""
    part_id: str
    measure_number: int
    voice_id: int
    event_index: int
    midi: int
    note_name: str
    local_key: str            # 局部調性, e.g. "B minor"
    roman: str                # 該處和弦, e.g. "iv", "V7"
    suggested_midi: Optional[int]   # 提議的正確音高 (None = 給不出建議)
    suggested_name: Optional[str]
    confidence: float         # 0-1, 越高越像真錯誤
    reason: str               # 人類可讀理由


def _per_part_starts(score: Score):
    # 動態 import 避循環; 與 analyze_harmony 同一套累積 measure 起點。
    from .analyzer.harmony_function import _per_part_cumulative_starts
    return _per_part_cumulative_starts(score)


def find_suspicious_notes(
    score: Score, key_window: Optional[int] = DEFAULT_KEY_WINDOW,
) -> list[SuspiciousNote]:
    """掃出疑似 OMR 辨識錯誤的音 (harmony-aware), 依信心排序高→低。

    判定: 在 (轉調感知的) 局部和聲下被 classify_note_function 判為自由非和弦音
    ('other') 的音 = 可疑。信心: 若 ±1 半音即可落入和弦音 (典型臨時記號誤判)
    → 高; 僅 ±2 可達 → 中; 給不出鄰近和弦音 → 低 (可能是八度誤判或真 NCT)。
    """
    regions = analyze_harmony(score, key_window=key_window)
    if not regions:
        return []
    from .analyzer.harmony_function import _region_starts_float
    starts_float = _region_starts_float(regions)
    cum = _per_part_starts(score)

    out: list[SuspiciousNote] = []
    for pi, part in enumerate(score.parts):
        mstarts = cum[pi]
        for measure in part.measures:
            mstart = mstarts.get(measure.number, Fraction(0))
            for vid, voice in measure.voices.items():
                seq = [(i, ev) for i, ev in enumerate(voice.events)
                       if isinstance(ev, NoteEvent)]
                gons = [mstart + ev.onset for _, ev in seq]
                for k, (i, ev) in enumerate(seq):
                    midi = ev.pitch.midi_number
                    region = find_region_at(regions, gons[k], starts_float)
                    if region is None:
                        continue
                    prev_midi = seq[k - 1][1].pitch.midi_number if k > 0 else None
                    next_midi = (seq[k + 1][1].pitch.midi_number
                                 if k + 1 < len(seq) else None)
                    prev_region = (find_region_at(regions, gons[k - 1], starts_float)
                                   if k > 0 else None)
                    cls = classify_note_function(
                        midi, region, prev_midi, prev_region, next_midi)
                    if cls != "other":
                        continue
                    # 提議修正 + 信心: ±1 命中和弦音最像臨時記號誤判
                    suggested = None
                    conf = 0.3
                    reason = "不在當前和弦, 也非經過/鄰/掛留音"
                    for d in (1, -1):
                        if (midi + d) % 12 in region.ideal_pitch_classes:
                            suggested = midi + d
                            conf = 0.75
                            reason = "半音之差即為和弦音 (疑似臨時記號/半音誤判)"
                            break
                    if suggested is None:
                        for d in (2, -2):
                            if (midi + d) % 12 in region.ideal_pitch_classes:
                                suggested = midi + d
                                conf = 0.5
                                reason = "全音之差為和弦音 (疑似線間誤判)"
                                break
                    out.append(SuspiciousNote(
                        part_id=part.part_id,
                        measure_number=measure.number,
                        voice_id=vid,
                        event_index=i,
                        midi=midi,
                        note_name=_note_name(midi),
                        local_key=region.key.name,
                        roman=region.roman.figure_string,
                        suggested_midi=suggested,
                        suggested_name=_note_name(suggested) if suggested else None,
                        confidence=conf,
                        reason=reason,
                    ))
    out.sort(key=lambda s: s.confidence, reverse=True)
    return out

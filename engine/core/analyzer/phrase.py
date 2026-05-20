"""
Phrase Detection — 樂句邊界偵測

對應規格書: docs/phrase-detection-spec.md v0.1.0

流程: 訊號收集 (§3) → 合併 → DP 切分 (§5) → 建構 Phrase 物件 (§5.3)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Callable, Literal, Optional

from core.ir import (
    ChordEvent,
    Measure,
    NoteEvent,
    Part,
    Phrase,
    RestEvent,
    Section,
)

# 用 TYPE_CHECKING 避免循環匯入 (harmony 內 import phrase 的場景目前沒有,
# 但若未來有就有保險)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .harmony import CadenceMarker


# ============================================================================
# Internal data types
# ============================================================================

@dataclass
class BoundarySignal:
    """單一邊界候選訊號。多個訊號可在同一 measure 累積權重。"""
    measure: int
    weight: float
    reasons: list[str] = field(default_factory=list)


# 力度等級對照 (§3.3 dynamic_reset 用)
_DYNAMIC_LEVELS: dict[str, int] = {
    "ppp": 0, "pp": 1, "p": 2, "mp": 3,
    "mf": 4, "f": 5, "ff": 6, "fff": 7,
}


# ============================================================================
# Public API
# ============================================================================

StyleHint = Literal["auto", "chorale", "classical", "romantic"]


def detect_phrases(
    part: Part,
    section: Section,
    phrase_id_start: int = 0,
    style_hint: StyleHint = "auto",
    cadences: Optional[list["CadenceMarker"]] = None,
) -> list[Phrase]:
    """偵測單聲部單段落內的樂句邊界。

    依規格 §5 流程: 訊號收集 → 合併 → DP 切分 → 建構 Phrase。

    style_hint:
    - "auto": 從 fermata 密度自動推斷風格
    - "chorale": 聖詠類, 偏好 2-小節樂句 (peak at 2)
    - "classical": 古典時期 (預設), 偏好 4-小節樂句 (peak at 4)
    - "romantic": 浪漫派, 偏好 8-小節樂句 (peak at 8)

    cadences: 從 harmony.analyze_harmony 取得的終止式列表。
       若提供,authentic / half cadence 會作為中強度訊號加入。
    """
    signals: list[BoundarySignal] = []
    for detector in _DETECTORS:
        signals.extend(detector(part, section))

    if cadences:
        signals.extend(cadence_signals(cadences, section))

    merged = merge_signals(signals)

    if style_hint == "auto":
        style_hint = detect_style(part, section)

    prior_fn = STYLE_PRIORS[style_hint]
    boundaries = dp_segment(
        merged, section.start_measure, section.end_measure,
        prior_fn=prior_fn,
    )
    return build_phrases(boundaries, merged, phrase_id_start)


def detect_style(
    part: Part, section: Section
) -> Literal["chorale", "classical", "romantic"]:
    """從 fermata 密度啟發式判斷風格。"""
    n_measures = section.end_measure - section.start_measure + 1
    if n_measures < 4:
        return "classical"

    fermata_measures = 0
    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        for _, event in _iter_events(measure):
            if isinstance(event, RestEvent) and event.fermata:
                fermata_measures += 1
                break
            if isinstance(event, (NoteEvent, ChordEvent)) \
                    and "fermata" in event.articulations:
                fermata_measures += 1
                break

    density = fermata_measures / n_measures
    if density >= 0.3:
        return "chorale"
    # Phase 1: 不偵測 romantic, 預設 classical
    return "classical"


# ============================================================================
# Helpers
# ============================================================================

def _measures_in_range(part: Part, start: int, end: int) -> list[Measure]:
    return [m for m in part.measures if start <= m.number <= end]


def _iter_events(measure: Measure):
    """Yield (voice_id, event), 跳過 divisi voice。"""
    for voice in measure.voices.values():
        if voice.is_divisi:
            continue
        for event in voice.events:
            yield voice.voice_id, event


# ============================================================================
# §3.1 強訊號 (weight = 1.0)
# ============================================================================

def detect_long_rests(
    part: Part,
    section: Section,
    min_duration: Fraction = Fraction(1),
) -> list[BoundarySignal]:
    """休止符 ≥ min_duration 拍 → 邊界候選 (休止後一小節)"""
    results: list[BoundarySignal] = []
    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        for _, event in _iter_events(measure):
            if isinstance(event, RestEvent) and event.duration >= min_duration:
                if measure.number < section.end_measure:
                    results.append(BoundarySignal(
                        measure=measure.number + 1,
                        weight=1.0,
                        reasons=[f"long_rest@m{measure.number}:{event.duration}"],
                    ))
                break  # 每小節最多一個此訊號
    return results


def detect_slur_endings(part: Part, section: Section) -> list[BoundarySignal]:
    """圓滑線結束 → 邊界候選 (圓滑線後一小節)"""
    last_slur_measure: dict[int, int] = {}

    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        for _, event in _iter_events(measure):
            if isinstance(event, (NoteEvent, ChordEvent)) and event.slur_group is not None:
                last_slur_measure[event.slur_group] = measure.number

    results: list[BoundarySignal] = []
    for slur_id, last_m in last_slur_measure.items():
        if last_m < section.end_measure:
            results.append(BoundarySignal(
                measure=last_m + 1,
                weight=1.0,
                reasons=[f"slur_end:{slur_id}"],
            ))
    return results


def detect_double_barlines(part: Part, section: Section) -> list[BoundarySignal]:
    """雙縱線或終止線 → 邊界候選"""
    results: list[BoundarySignal] = []
    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        if (measure.barline_right in ("double", "final")
                and measure.number < section.end_measure):
            results.append(BoundarySignal(
                measure=measure.number + 1,
                weight=1.0,
                reasons=[f"double_barline@m{measure.number}"],
            ))
    return results


def detect_fermatas(part: Part, section: Section) -> list[BoundarySignal]:
    """延長記號 → 邊界候選"""
    results: list[BoundarySignal] = []
    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        for _, event in _iter_events(measure):
            has_fermata = False
            if isinstance(event, RestEvent) and event.fermata:
                has_fermata = True
            elif (isinstance(event, (NoteEvent, ChordEvent))
                    and "fermata" in event.articulations):
                has_fermata = True

            if has_fermata:
                if measure.number < section.end_measure:
                    results.append(BoundarySignal(
                        measure=measure.number + 1,
                        weight=1.0,
                        reasons=[f"fermata@m{measure.number}"],
                    ))
                break
    return results


# ============================================================================
# §3.2 中訊號 (weight = 0.6)
# ============================================================================

def detect_tempo_changes(part: Part, section: Section) -> list[BoundarySignal]:
    """速度標記變化 (tempo_bpm 或 tempo_text)"""
    results: list[BoundarySignal] = []
    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        if measure.number == section.start_measure:
            continue
        if measure.tempo_bpm is not None or measure.tempo_text is not None:
            results.append(BoundarySignal(
                measure=measure.number,
                weight=0.6,
                reasons=[f"tempo:{measure.tempo_text or measure.tempo_bpm}"],
            ))
    return results


def detect_time_signature_changes(part: Part, section: Section) -> list[BoundarySignal]:
    """拍號變化"""
    results: list[BoundarySignal] = []
    prev_ts: Optional[tuple[int, int]] = None
    first = True
    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        if measure.time_signature is not None:
            if not first and measure.time_signature != prev_ts:
                results.append(BoundarySignal(
                    measure=measure.number,
                    weight=0.6,
                    reasons=[f"time_sig:{measure.time_signature}"],
                ))
            prev_ts = measure.time_signature
        first = False
    return results


def detect_rehearsal_marks(part: Part, section: Section) -> list[BoundarySignal]:
    """排練記號"""
    results: list[BoundarySignal] = []
    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        if measure.number == section.start_measure:
            continue
        if measure.rehearsal_mark is not None:
            results.append(BoundarySignal(
                measure=measure.number,
                weight=0.6,
                reasons=[f"rehearsal:{measure.rehearsal_mark}"],
            ))
    return results


# ============================================================================
# §3.3 弱訊號 (weight = 0.3)
# ============================================================================

def detect_large_leaps(
    part: Part,
    section: Section,
    threshold_semitones: int = 12,
) -> list[BoundarySignal]:
    """跨小節大跳音程 ≥ threshold (預設 12 半音 = 八度)"""
    results: list[BoundarySignal] = []
    prev_pitch: Optional[int] = None
    prev_measure: Optional[int] = None

    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        for _, event in _iter_events(measure):
            curr_pitch: Optional[int] = None
            if isinstance(event, NoteEvent):
                curr_pitch = event.pitch.midi_number
            elif isinstance(event, ChordEvent):
                curr_pitch = max(p.midi_number for p in event.pitches)

            if curr_pitch is not None:
                if (prev_pitch is not None and prev_measure is not None
                        and measure.number != prev_measure
                        and abs(curr_pitch - prev_pitch) >= threshold_semitones):
                    results.append(BoundarySignal(
                        measure=measure.number,
                        weight=0.3,
                        reasons=[f"large_leap:{abs(curr_pitch - prev_pitch)}st"],
                    ))
                prev_pitch = curr_pitch
                prev_measure = measure.number
    return results


def detect_dynamic_resets(
    part: Part,
    section: Section,
    threshold_levels: int = 4,
) -> list[BoundarySignal]:
    """力度驟變 (e.g. ff → p) → 邊界候選"""
    results: list[BoundarySignal] = []
    prev_level: Optional[int] = None
    prev_measure: Optional[int] = None

    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        for _, event in _iter_events(measure):
            if (isinstance(event, (NoteEvent, ChordEvent))
                    and event.dynamic in _DYNAMIC_LEVELS):
                level = _DYNAMIC_LEVELS[event.dynamic]
                if (prev_level is not None and prev_measure is not None
                        and measure.number != prev_measure
                        and abs(level - prev_level) >= threshold_levels):
                    results.append(BoundarySignal(
                        measure=measure.number,
                        weight=0.3,
                        reasons=[f"dynamic_reset:{abs(level - prev_level)}lvl"],
                    ))
                prev_level = level
                prev_measure = measure.number
                break  # 每小節僅取第一個力度
    return results


def detect_contour_inflections(
    part: Part,
    section: Section,
    min_run: int = 4,
) -> list[BoundarySignal]:
    """連續上行或下行 ≥ min_run 音後反向 → 邊界候選"""
    notes_with_measure: list[tuple[int, int]] = []
    for measure in _measures_in_range(part, section.start_measure, section.end_measure):
        for _, event in _iter_events(measure):
            if isinstance(event, NoteEvent):
                notes_with_measure.append((measure.number, event.pitch.midi_number))
            elif isinstance(event, ChordEvent):
                notes_with_measure.append((
                    measure.number,
                    max(p.midi_number for p in event.pitches),
                ))

    if len(notes_with_measure) < min_run + 1:
        return []

    results: list[BoundarySignal] = []
    direction = 0
    run_length = 0

    for i in range(1, len(notes_with_measure)):
        prev_m, prev_p = notes_with_measure[i - 1]
        curr_m, curr_p = notes_with_measure[i]
        delta = curr_p - prev_p
        new_direction = 1 if delta > 0 else (-1 if delta < 0 else 0)

        if new_direction != 0 and new_direction == direction:
            run_length += 1
        else:
            if (direction != 0 and new_direction != 0
                    and new_direction != direction
                    and run_length >= min_run
                    and curr_m > prev_m):
                results.append(BoundarySignal(
                    measure=curr_m,
                    weight=0.3,
                    reasons=[f"contour_inflection:run={run_length}"],
                ))
            direction = new_direction
            run_length = 1

    return results


# 偵測器註冊表
def cadence_signals(
    cadences: list["CadenceMarker"],
    section: Section,
) -> list[BoundarySignal]:
    """從 cadences 產生 boundary signals (規格 §3.2 中訊號)。

    Authentic / half cadence: weight 0.6 (與 tempo change 同級)
    Deceptive cadence: weight 0.3 (繼續樂句而非結束)
    Plagal: 0.5 (amen-style 結束)
    """
    results: list[BoundarySignal] = []
    for c in cadences:
        # 樂句結束於 cadence 解決 (c.measure),新 phrase 始於下一小節
        boundary = c.measure + 1
        if boundary < section.start_measure or boundary > section.end_measure:
            continue
        if c.kind == "authentic":
            weight = 0.6
        elif c.kind == "half":
            weight = 0.6
        elif c.kind == "plagal":
            weight = 0.5
        elif c.kind == "deceptive":
            weight = 0.3
        else:
            weight = 0.3
        results.append(BoundarySignal(
            measure=boundary,
            weight=weight,
            reasons=[f"cadence_{c.kind}:{c.from_chord}→{c.to_chord}@m{c.measure}"],
        ))
    return results


_DETECTORS: list[Callable[[Part, Section], list[BoundarySignal]]] = [
    detect_long_rests,
    detect_slur_endings,
    detect_double_barlines,
    detect_fermatas,
    detect_tempo_changes,
    detect_time_signature_changes,
    detect_rehearsal_marks,
    detect_large_leaps,
    detect_dynamic_resets,
    detect_contour_inflections,
]


# ============================================================================
# Signal merging
# ============================================================================

def merge_signals(signals: list[BoundarySignal]) -> dict[int, BoundarySignal]:
    """同一 measure 的訊號權重累加, reasons 合併。"""
    merged: dict[int, BoundarySignal] = {}
    for s in signals:
        if s.measure not in merged:
            merged[s.measure] = BoundarySignal(
                measure=s.measure,
                weight=s.weight,
                reasons=list(s.reasons),
            )
        else:
            merged[s.measure].weight += s.weight
            merged[s.measure].reasons.extend(s.reasons)
    return merged


# ============================================================================
# §4 Length prior
# ============================================================================

def length_log_prior(n: int) -> float:
    """古典時期混合高斯先驗 (peak at 4, 預設)。"""
    if n < 1:
        return float("-inf")

    p = (0.40 * _gaussian(n, 4.0, 1.5)
         + 0.30 * _gaussian(n, 8.0, 2.0)
         + 0.05 * _gaussian(n, 16.0, 4.0)
         + 0.001)  # baseline 避免 log(0)
    return math.log(p)


def length_log_prior_chorale(n: int) -> float:
    """聖詠類先驗: peak at 2,次峰 4 (Bach 聖詠典型樂句結構)。"""
    if n < 1:
        return float("-inf")
    p = (0.50 * _gaussian(n, 2.0, 1.0)
         + 0.30 * _gaussian(n, 4.0, 1.5)
         + 0.10 * _gaussian(n, 8.0, 2.0)
         + 0.001)
    return math.log(p)


def length_log_prior_romantic(n: int) -> float:
    """浪漫派先驗: peak at 8,長樂句較常見。"""
    if n < 1:
        return float("-inf")
    p = (0.20 * _gaussian(n, 4.0, 1.5)
         + 0.40 * _gaussian(n, 8.0, 2.5)
         + 0.25 * _gaussian(n, 16.0, 4.0)
         + 0.001)
    return math.log(p)


STYLE_PRIORS: dict[str, Callable[[int], float]] = {
    "chorale": length_log_prior_chorale,
    "classical": length_log_prior,
    "romantic": length_log_prior_romantic,
}


def _gaussian(x: float, mu: float, sigma: float) -> float:
    z = (x - mu) / sigma
    return math.exp(-0.5 * z * z) / (sigma * math.sqrt(2 * math.pi))


# ============================================================================
# §5.2 DP segmentation
# ============================================================================

def dp_segment(
    merged_signals: dict[int, BoundarySignal],
    start_measure: int,
    end_measure: int,
    min_phrase_len: int = 2,
    max_phrase_len: int = 32,
    phrase_bonus: float = 2.0,
    prior_fn: Optional[Callable[[int], float]] = None,
) -> list[int]:
    """DP 求最佳切分。返回邊界小節列表 (含起點與 end+1)。

    所有 section 內的 measure 都納入候選 (無訊號者 weight=0),
    讓 length_prior 在「規律切分」與「跟隨訊號」之間平衡。

    phrase_bonus: 每個 phrase 的固定獎勵分數,抵銷 length_prior 對「少切」的偏好。
    在無訊號的 8-16 小節 section 中,bonus=2.0 使 4-measure phrase 成為偏好。
    """
    section_len = end_measure - start_measure + 1

    # 太短: 整段視為一個 phrase
    if section_len < min_phrase_len:
        return [start_measure, end_measure + 1]

    # 建構候選序列 B
    B: list[BoundarySignal] = [
        BoundarySignal(measure=start_measure, weight=0.0, reasons=["section_start"])
    ]
    for m in range(start_measure + 1, end_measure + 1):
        sig = merged_signals.get(m)
        B.append(BoundarySignal(
            measure=m,
            weight=sig.weight if sig else 0.0,
            reasons=list(sig.reasons) if sig else [],
        ))
    B.append(BoundarySignal(
        measure=end_measure + 1, weight=0.0, reasons=["section_end"]
    ))

    n = len(B)
    NEG_INF = float("-inf")
    dp = [NEG_INF] * n
    parent = [-1] * n
    dp[0] = 0.0

    for i in range(1, n):
        for j in range(i):
            length = B[i].measure - B[j].measure
            if length < min_phrase_len:
                continue
            if length > max_phrase_len:
                continue
            prior = (prior_fn or length_log_prior)(length)
            score = dp[j] + B[i].weight + prior + phrase_bonus
            if score > dp[i]:
                dp[i] = score
                parent[i] = j

    # 找不到有效切分: section_len > max_phrase_len 且 DP 無解 (極罕見)
    # Fallback: 強制在中點切一刀
    if dp[n - 1] == NEG_INF:
        mid = (start_measure + end_measure + 1) // 2
        return [start_measure, mid, end_measure + 1]

    # 回溯
    path: list[int] = []
    i = n - 1
    while i != -1:
        path.append(B[i].measure)
        i = parent[i]
    path.reverse()
    return path


# ============================================================================
# §5.3 Confidence & Phrase building
# ============================================================================

def confidence(weight: float) -> float:
    """訊號權重 → 信心分數 ∈ [0, 1]"""
    return 1.0 - math.exp(-weight)


def build_phrases(
    boundaries: list[int],
    merged_signals: dict[int, BoundarySignal],
    phrase_id_start: int = 0,
) -> list[Phrase]:
    """從邊界列表建構 Phrase 物件。

    使用半開區間: phrase [start, end), end 為下一 phrase 起點。
    Confidence 使用 phrase end boundary 的訊號權重;
    最後一個 phrase 的 end 為 section 強制邊界,固定 conf=1.0。
    """
    phrases: list[Phrase] = []
    for i in range(len(boundaries) - 1):
        start_m = boundaries[i]
        end_m = boundaries[i + 1]

        if i < len(boundaries) - 2:
            signal = merged_signals.get(end_m)
            conf = confidence(signal.weight) if signal else 0.0
        else:
            conf = 1.0  # section 終點為強制邊界

        phrases.append(Phrase(
            phrase_id=phrase_id_start + i,
            start=(start_m, Fraction(0)),
            end=(end_m, Fraction(0)),
            detection_confidence=conf,
        ))
    return phrases

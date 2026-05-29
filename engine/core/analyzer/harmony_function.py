"""
harmony_function — 羅馬數字和聲分析 (A1b)

完整規格見 docs/harmony-analysis-spec.md.

0.1.31 MVP 實作:
  - KK (Krumhansl-Kessler) profile key detection
  - 簡易和弦分段 (按各聲部 onset 切片)
  - 直接套用模板: PC set → scale degree + chord quality → RomanNumeral
  - essential_pitch_classes 含調式根音 + 三度音 + (七和弦的) 七度音

未做 (留下一輪):
  - HMM viterbi 平滑 (用 chord 之間的 transition probability)
  - 副屬和弦 / 那不勒斯 / 增六的精確分類
  - 轉調區段切換

A1a 啟發式 (0.1.27) 仍是 fallback — analyze_harmony 回空 list 時 repair
會走啟發式路徑.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Literal, Optional


# ============================================================================
# Data models
# ============================================================================

@dataclass
class Key:
    """調性. tonic_pc = pitch class 0-11; mode = 'major' / 'minor'."""
    tonic_pc: int
    mode: Literal["major", "minor"]

    @property
    def name(self) -> str:
        pc_names = ["C", "C#", "D", "Eb", "E", "F",
                    "F#", "G", "Ab", "A", "Bb", "B"]
        tonic = pc_names[self.tonic_pc]
        return f"{tonic} {self.mode}"


@dataclass
class RomanNumeral:
    """羅馬數字標記. 例如 V7 / vii°6 / IV6/4 / N6 (拿坡里六和弦)."""
    degree: int  # 1-7
    quality: Literal[
        "major", "minor", "diminished", "augmented",
        "dominant7", "minor7", "major7", "half_diminished",
        "fully_diminished",
    ]
    inversion: int = 0          # 0 = 原位, 1 = 第一轉位, 2, 3
    applied_to: Optional[int] = None  # 副屬: V7/V → applied_to=5
    figure_string: str = ""     # 人類可讀, 例 "V7", "vii°6/V"


@dataclass
class HarmonicRegion:
    """一個和弦在時間軸上的區間."""
    start_quarter: Fraction
    end_quarter: Fraction
    key: Key
    roman: RomanNumeral
    confidence: float = 0.0
    # 該和弦的「理想 pitches」(MIDI pitch class set), 用於 quality / repair
    ideal_pitch_classes: list[int] = field(default_factory=list)
    # 「致音」(必留) — 用於 repair 決定不可省的音
    essential_pitch_classes: list[int] = field(default_factory=list)


# ============================================================================
# KK profiles — Krumhansl-Kessler key-finding (1990)
# ============================================================================

# 大調 / 小調 12 pc 權重. 來自 Krumhansl & Kessler 1990 心理實驗.
_KK_MAJOR = [
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
    2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
]
_KK_MINOR = [
    6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
    2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
]


def _rotate(profile: list[float], shift: int) -> list[float]:
    return profile[-shift % 12:] + profile[:-shift % 12]


def _pearson(x: list[float], y: list[float]) -> float:
    n = len(x)
    mx = sum(x) / n
    my = sum(y) / n
    num = sum((x[i] - mx) * (y[i] - my) for i in range(n))
    dx = sum((x[i] - mx) ** 2 for i in range(n)) ** 0.5
    dy = sum((y[i] - my) ** 2 for i in range(n)) ** 0.5
    if dx == 0 or dy == 0:
        return 0.0
    return float(num / (dx * dy))


def detect_key(pc_histogram: list[float]) -> tuple[Key, float]:
    """KK key detection. 回傳 (best_key, confidence 0-1).

    pc_histogram: 長度 12, 各 pc 的累積 duration / count.
    """
    best_key = Key(tonic_pc=0, mode="major")
    best_corr = -2.0
    for tonic in range(12):
        for mode, profile in (("major", _KK_MAJOR), ("minor", _KK_MINOR)):
            rotated = _rotate(profile, tonic)
            corr = _pearson(pc_histogram, rotated)
            if corr > best_corr:
                best_corr = corr
                best_key = Key(
                    tonic_pc=tonic,
                    mode="major" if mode == "major" else "minor",
                )
    # 正規化到 0-1 (corr 通常落在 0.4-0.9)
    confidence = max(0.0, min(1.0, (best_corr + 1) / 2))
    return best_key, confidence


# ============================================================================
# Chord identification — PC set → RomanNumeral
# ============================================================================

# 模板: (scale_degree (0-indexed for major) → relative semitone offset from tonic)
_MAJOR_DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]  # I ii iii IV V vi vii°
_MINOR_DEGREE_SEMITONES = [0, 2, 3, 5, 7, 8, 10]  # i ii° III iv v VI VII

# 各 degree 在大/小調的預設品質
_MAJOR_QUALITIES: list[str] = [
    "major", "minor", "minor", "major",
    "major", "minor", "diminished",
]
_MINOR_QUALITIES: list[str] = [
    "minor", "diminished", "major", "minor",
    "minor", "major", "major",
]


def _build_triad_pcs(root_pc: int, quality: str) -> set[int]:
    """三和弦的 3 個 pc."""
    if quality == "major":
        return {root_pc, (root_pc + 4) % 12, (root_pc + 7) % 12}
    if quality == "minor":
        return {root_pc, (root_pc + 3) % 12, (root_pc + 7) % 12}
    if quality == "diminished":
        return {root_pc, (root_pc + 3) % 12, (root_pc + 6) % 12}
    if quality == "augmented":
        return {root_pc, (root_pc + 4) % 12, (root_pc + 8) % 12}
    return {root_pc}


def _build_seventh_pcs(root_pc: int, quality: str) -> set[int]:
    """七和弦的 4 個 pc."""
    if quality == "dominant7":
        return {root_pc, (root_pc + 4) % 12,
                (root_pc + 7) % 12, (root_pc + 10) % 12}
    if quality == "minor7":
        return {root_pc, (root_pc + 3) % 12,
                (root_pc + 7) % 12, (root_pc + 10) % 12}
    if quality == "major7":
        return {root_pc, (root_pc + 4) % 12,
                (root_pc + 7) % 12, (root_pc + 11) % 12}
    if quality == "half_diminished":
        return {root_pc, (root_pc + 3) % 12,
                (root_pc + 6) % 12, (root_pc + 10) % 12}
    if quality == "fully_diminished":
        return {root_pc, (root_pc + 3) % 12,
                (root_pc + 6) % 12, (root_pc + 9) % 12}
    return _build_triad_pcs(root_pc, quality)


def _figure_string(degree: int, quality: str, mode: str) -> str:
    """e.g. (5, 'dominant7', 'major') → 'V7'; (7, 'diminished', 'major')→'vii°'"""
    # 大寫 = 大調系列; 小寫 = 小調系列
    rn_chars = ["", "I", "II", "III", "IV", "V", "VI", "VII"]
    base = rn_chars[degree]
    if quality in ("minor", "minor7", "diminished",
                   "half_diminished", "fully_diminished"):
        base = base.lower()
    suffix = ""
    if quality == "diminished":
        suffix = "°"
    elif quality == "half_diminished":
        suffix = "ø"
    elif quality == "fully_diminished":
        suffix = "°7"
    elif quality == "dominant7":
        suffix = "7"
    elif quality == "minor7":
        suffix = "7"
    elif quality == "major7":
        suffix = "M7"
    return base + suffix


def identify_chord(
    pcs: set[int], key: Key,
) -> Optional[RomanNumeral]:
    """根據音類集合 + 調性, 找最佳 RomanNumeral 候選.

    策略: 對 1-7 度每個 degree 試 triad / 七和弦 quality, 算 PC 集合相似度
    (Jaccard), 挑最高分.
    """
    if not pcs:
        return None
    degrees = (_MAJOR_DEGREE_SEMITONES if key.mode == "major"
               else _MINOR_DEGREE_SEMITONES)
    qualities = (_MAJOR_QUALITIES if key.mode == "major"
                 else _MINOR_QUALITIES)

    best_rn: Optional[RomanNumeral] = None
    best_score = -1.0
    for i, semi in enumerate(degrees):
        root_pc = (key.tonic_pc + semi) % 12
        # 試 triad 與 7 種七和弦
        triad_q = qualities[i]
        candidates: list[str] = [triad_q]
        # V (5 度) 在大小調都加 dominant7 候選
        if i == 4:
            candidates.append("dominant7")
        # ii (2 度) 大調加 minor7 候選
        if i == 1 and key.mode == "major":
            candidates.append("minor7")
        # vii° (7 度) 大調加 fully/half diminished7 候選
        if i == 6 and key.mode == "major":
            candidates.extend(["half_diminished", "fully_diminished"])
        for q in candidates:
            if q in ("dominant7", "minor7", "major7",
                     "half_diminished", "fully_diminished"):
                template = _build_seventh_pcs(root_pc, q)
            else:
                template = _build_triad_pcs(root_pc, q)
            # Jaccard: |intersect| / |union|
            inter = len(pcs & template)
            union = len(pcs | template)
            score = inter / union if union > 0 else 0.0
            if score > best_score:
                best_score = score
                best_rn = RomanNumeral(
                    degree=i + 1,
                    quality=q,  # type: ignore[arg-type]
                    inversion=0,
                    applied_to=None,
                    figure_string=_figure_string(i + 1, q, key.mode),
                )
    return best_rn


# ============================================================================
# Public API
# ============================================================================

def analyze_harmony(score: object) -> list[HarmonicRegion]:
    """分析整首曲子的和聲, 回傳 list[HarmonicRegion].

    0.1.31 MVP: KK key detection (整曲一個 key) + 按 onset 切片 chord ID.
    無 HMM 平滑, 無轉調偵測 — 那留下一輪.
    """
    # 動態 import 避開循環 (core.analyzer ← core.ir ← ...)
    try:
        from ..ir import ChordEvent, NoteEvent, Score
    except ImportError:
        return []
    if not hasattr(score, "parts"):
        return []
    assert isinstance(score, Score)

    # 1) 收所有有音高的 (global_onset, pc, duration) 給 KK + chord segment
    pc_histogram = [0.0] * 12
    # onset_pcs[global_onset] = set of pc 在那個 onset 同時響的
    onset_pcs: dict[Fraction, set[int]] = defaultdict(set)

    cumulative_starts = _per_part_cumulative_starts(score)
    for part_idx, part in enumerate(score.parts):
        measure_starts = cumulative_starts[part_idx]
        for measure in part.measures:
            m_start = measure_starts.get(measure.number, Fraction(0))
            for voice in measure.voices.values():
                for ev in voice.events:
                    pitches = []
                    if isinstance(ev, NoteEvent):
                        pitches = [ev.pitch.midi_number]
                    elif isinstance(ev, ChordEvent):
                        pitches = [p.midi_number for p in ev.pitches]
                    if not pitches:
                        continue
                    dur = float(ev.duration)
                    g_onset = m_start + ev.onset
                    for midi in pitches:
                        pc = midi % 12
                        pc_histogram[pc] += dur
                        onset_pcs[g_onset].add(pc)

    if sum(pc_histogram) == 0:
        return []

    key, confidence = detect_key(pc_histogram)

    # 2) 按 onset 切片, 每個 onset 區間給一個 RomanNumeral
    sorted_onsets = sorted(onset_pcs.keys())
    regions: list[HarmonicRegion] = []
    for idx, onset in enumerate(sorted_onsets):
        next_onset = (
            sorted_onsets[idx + 1] if idx + 1 < len(sorted_onsets)
            else onset + Fraction(4)  # 最後一個 region 保 4 拍
        )
        pcs = onset_pcs[onset]
        rn = identify_chord(pcs, key)
        if rn is None:
            continue
        # 從 figure_string 推 ideal/essential PCs
        degrees = (_MAJOR_DEGREE_SEMITONES if key.mode == "major"
                   else _MINOR_DEGREE_SEMITONES)
        root_pc = (key.tonic_pc + degrees[rn.degree - 1]) % 12
        if rn.quality in ("dominant7", "minor7", "major7",
                          "half_diminished", "fully_diminished"):
            template = _build_seventh_pcs(root_pc, rn.quality)
        else:
            template = _build_triad_pcs(root_pc, rn.quality)
        # essential: 根音 + 三度音 (定品質); 七和弦再加七音 (傾向音)
        essential: list[int] = [root_pc]
        # 三度
        if rn.quality in ("major", "major7", "dominant7", "augmented"):
            essential.append((root_pc + 4) % 12)
        elif rn.quality in ("minor", "minor7",
                            "diminished", "half_diminished",
                            "fully_diminished"):
            essential.append((root_pc + 3) % 12)
        # 七和弦的七音 (V7 → fa 是傾向音, 必留)
        if rn.quality == "dominant7":
            essential.append((root_pc + 10) % 12)
        elif rn.quality == "major7":
            essential.append((root_pc + 11) % 12)
        elif rn.quality in ("minor7", "half_diminished"):
            essential.append((root_pc + 10) % 12)
        elif rn.quality == "fully_diminished":
            essential.append((root_pc + 9) % 12)
        regions.append(HarmonicRegion(
            start_quarter=onset,
            end_quarter=next_onset,
            key=key,
            roman=rn,
            confidence=confidence,
            ideal_pitch_classes=sorted(template),
            essential_pitch_classes=sorted(set(essential)),
        ))
    return regions


def detect_unresolved_tendency_tones(score: object):
    """偵測未解決的導音 / 七和弦七度.

    傳統聲部書寫:
    - 大調 V (含 V7) 中的「導音」(key tonic + 11, mod 12) 必須上行解決
      到主音 (tonic). 內聲部下行三度也常接受 (退而求其次).
    - V7 的「七度」(key tonic + 5, mod 12 — 即 fa) 必須下行解決到主和弦
      的三度 (mi).

    本函式針對「V → I」相鄰區段做檢查; 在 V 區段裡找到 leading tone 或
    chord 7th 的聲部, 看下一個 I 區段同一聲部的音是否做出正確解決.
    回傳 LocatedIssue (W_UNRESOLVED_LEADING_TONE / W_UNRESOLVED_CHORD7TH).
    """
    try:
        from ..ir import ChordEvent, NoteEvent, Score
        from ..repair import LocatedIssue
        from ..instruments.base import CheckResult
    except ImportError:
        return []
    if not hasattr(score, "parts"):
        return []
    assert isinstance(score, Score)

    regions = analyze_harmony(score)
    if not regions:
        return []

    # 0.1.59 perf: 預算 region 起點 float key 一次, 給 find_region_at bisect
    # 重複用 (避免每次呼叫重建 + 線性掃 → 2000 萬次 Fraction 比較).
    region_starts = _region_starts_float(regions)
    cumulative_starts = _per_part_cumulative_starts(score)
    issues: list = []

    for part_idx, part in enumerate(score.parts):
        measure_starts = cumulative_starts[part_idx]
        # 收這個 part 所有有音高的事件 (global_onset, midi, ref)
        events: list[tuple[Fraction, int, int, int, int]] = []
        # (global_onset, midi, measure_number, voice_id, event_index)
        for measure in part.measures:
            m_start = measure_starts.get(measure.number, Fraction(0))
            for voice in measure.voices.values():
                for idx, ev in enumerate(voice.events):
                    midi: Optional[int] = None
                    if isinstance(ev, NoteEvent):
                        midi = ev.pitch.midi_number
                    elif isinstance(ev, ChordEvent):
                        # 取最高音當聲部線
                        midi = max(p.midi_number for p in ev.pitches)
                    if midi is None:
                        continue
                    g_onset = m_start + ev.onset
                    events.append((
                        g_onset, midi,
                        measure.number, voice.voice_id, idx,
                    ))
        events.sort(key=lambda e: e[0])

        # 跨事件: 若 events[k] 在 V (含 V7) 區段, events[k+1] 在 I 區段,
        # 檢查解決
        for k in range(len(events) - 1):
            g1, m1, meas1, vid1, idx1 = events[k]
            g2, m2, _, _, _ = events[k + 1]
            r1 = find_region_at(regions, g1, region_starts)
            r2 = find_region_at(regions, g2, region_starts)
            if r1 is None or r2 is None:
                continue
            # 只在 V → I 看 (大調; 小調 V 通常為了導音也是大三和弦, 一併)
            if r1.roman.degree != 5 or r2.roman.degree != 1:
                continue
            key = r1.key
            leading_tone_pc = (key.tonic_pc + 11) % 12
            chord7th_pc = (key.tonic_pc + 5) % 12
            tonic_pc = key.tonic_pc
            third_of_tonic = (
                (key.tonic_pc + 4) % 12 if key.mode == "major"
                else (key.tonic_pc + 3) % 12
            )
            pc1 = m1 % 12
            pc2 = m2 % 12
            # 導音 → 主音 (上行小二度 / 下行大三度都接受)
            if pc1 == leading_tone_pc and pc2 != tonic_pc:
                # 真正未解決
                semitone_dist = m2 - m1
                if not (semitone_dist == 1):  # 上行半音才是正解
                    issues.append(LocatedIssue(
                        part_id=part.part_id,
                        measure_number=meas1,
                        voice_id=vid1,
                        event_index=idx1,
                        result=CheckResult(
                            severity="warning",
                            code="W_UNRESOLVED_LEADING_TONE",
                            params={
                                "key": key.name,
                                "from_pc": pc1,
                                "to_pc": pc2,
                            },
                            difficulty_score=0.0,
                        ),
                    ))
            # V7 的七度 → 主和弦三度 (下行半音 / 全音)
            if r1.roman.quality == "dominant7" and pc1 == chord7th_pc \
                    and pc2 != third_of_tonic:
                semitone_dist = m2 - m1
                if not (semitone_dist == -1 or semitone_dist == -2):
                    issues.append(LocatedIssue(
                        part_id=part.part_id,
                        measure_number=meas1,
                        voice_id=vid1,
                        event_index=idx1,
                        result=CheckResult(
                            severity="warning",
                            code="W_UNRESOLVED_CHORD7TH",
                            params={
                                "key": key.name,
                                "from_pc": pc1,
                                "to_pc": pc2,
                            },
                            difficulty_score=0.0,
                        ),
                    ))
    return issues


def classify_note_function(
    midi: int,
    region: HarmonicRegion,
    prev_midi: Optional[int] = None,
    prev_region: Optional[HarmonicRegion] = None,
    next_midi: Optional[int] = None,
) -> Literal["chord_tone", "suspension", "passing", "neighbor", "other"]:
    """根據 RomanNumeral 區段, 分類一個音的功能.

    - chord_tone: pc 屬於 region.ideal_pitch_classes
    - suspension (掛留音): 前一個音是上一個 region 的和弦音, 且
      跟當前音同 midi (持平 / 同音延伸); 當前音 NOT 在當前 region 和弦內;
      下行解決 (next_midi 比現在低 1-2 半音 → 解決到和弦音)
    - passing (經過音): 前後音都是和弦音, 三音級進連續上行 / 下行
    - neighbor (鄰音): 前後音是同一個和弦音, 當前音是相鄰半 / 全音
    - other: 都不是 — 自由的 NCT 或裝飾音
    """
    pc = midi % 12
    if pc in region.ideal_pitch_classes:
        return "chord_tone"
    # Suspension 條件
    if prev_midi is not None and prev_region is not None:
        prev_pc = prev_midi % 12
        if prev_pc in prev_region.ideal_pitch_classes \
                and prev_midi == midi:
            # 下行解決才算真 suspension
            if next_midi is not None:
                dist = next_midi - midi
                if -2 <= dist <= -1 and next_midi % 12 \
                        in region.ideal_pitch_classes:
                    return "suspension"
            else:
                # 沒下一音時保守標 suspension
                return "suspension"
    # Passing tone: prev + next 都和弦音, 級進向同一方向
    if prev_midi is not None and next_midi is not None:
        prev_pc = prev_midi % 12
        next_pc = next_midi % 12
        if prev_pc in region.ideal_pitch_classes \
                and next_pc in region.ideal_pitch_classes:
            d1 = midi - prev_midi
            d2 = next_midi - midi
            if 1 <= abs(d1) <= 2 and 1 <= abs(d2) <= 2 \
                    and ((d1 > 0) == (d2 > 0)):
                return "passing"
            if prev_midi == next_midi and 1 <= abs(d1) <= 2:
                return "neighbor"
    return "other"


def _region_starts_float(regions: list[HarmonicRegion]) -> list[float]:
    """0.1.59 perf: 預算 region 起點的 float key, 給 find_region_at bisect 用.

    呼叫端 (detect_unresolved_tendency_tones) 對每個音呼叫 find_region_at,
    舊版每次線性掃全部 region + Fraction 比較 (O(events×regions) × 昂貴比較),
    Beethoven 弦四→鋼琴的密集和聲讓 region 數暴增, 造成 2000 萬次 Fraction
    比較 / 單次 collect_issues 3.3s → repair_loop 70 次呼叫 = 5 分鐘 timeout.
    """
    return [float(r.start_quarter) for r in regions]


def find_region_at(
    regions: list[HarmonicRegion], quarter_offset: Fraction,
    starts_float: Optional[list[float]] = None,
) -> Optional[HarmonicRegion]:
    """給定整曲時間軸 offset, 二分查 region. 回傳 None → 走 fallback.

    0.1.59 perf: 改 bisect (O(log n)) + float key 比較, 取代舊版線性掃 +
    Fraction 比較. starts_float 可由呼叫端預算一次重複用 (見上).
    region 依 start_quarter 遞增 (analyze_harmony 順序產出), bisect 前提成立.
    """
    if not regions:
        return None
    import bisect
    starts = starts_float if starts_float is not None \
        else _region_starts_float(regions)
    q = float(quarter_offset)
    i = bisect.bisect_right(starts, q) - 1
    if i < 0:
        # offset 在第一個 region 之前 — 邊緣寬鬆: 回第一個
        return regions[0] if quarter_offset >= Fraction(0) else None
    r = regions[i]
    # 命中 region 內 (含 gap 防呆: q 落在 region 之間就往最後一個靠)
    if r.start_quarter <= quarter_offset < r.end_quarter:
        return r
    # 落在 region[i] 結束之後 (gap 或最末): 最後一個 region 邊緣寬鬆
    if i == len(regions) - 1:
        return r
    return None


# ============================================================================
# Helpers
# ============================================================================

def _per_part_cumulative_starts(score: object) -> list[dict[int, Fraction]]:
    """每個 part 算 measure_number → global_onset (四分音符)."""
    results: list[dict[int, Fraction]] = []
    if not hasattr(score, "parts"):
        return results
    for part in score.parts:
        starts: dict[int, Fraction] = {}
        cumulative = Fraction(0)
        current_ts: tuple[int, int] = (4, 4)
        for measure in part.measures:
            if measure.time_signature:
                current_ts = measure.time_signature
            starts[measure.number] = cumulative
            num, denom = current_ts
            cumulative += Fraction(num * 4, denom)
        results.append(starts)
    return results

"""
演奏難度評分 — 依改編結果為每個 part 計算難度等級 (1-5)

對應規格: architecture.md §4.6 (Phase 3 探索性, 提早實作以協助使用者)

評分因子 (每項 0-1):
1. range_factor: 音高超出 comfortable 比例
2. density_factor: 音符密度 (events / total beats), 標準化到 0-1
3. chord_factor: 多音事件比例 (含和弦)
4. rhythm_factor: 短時值 (< 1/8) 事件比例
5. technique_factor: 技巧難度 — 高把位音 + 困難弓法 + 三/四音和弦比例

總分 = 加權平均, 對應到 1-5 等級:
- 1.0: 業餘初學 (簡單)
- 2.0: 業餘中等
- 3.0: 業餘進階
- 4.0: 半專業
- 5.0: 職業 / 演奏家
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction

from .instruments import get_profile
from .ir import ChordEvent, NoteEvent, Part, Score


@dataclass
class MeasureDifficulty:
    """單一小節難度 (給譜面熱圖用)。"""
    measure: int
    score_1_to_5: float
    range_factor: float
    density_factor: float
    chord_factor: float
    rhythm_factor: float
    technique_factor: float
    note_count: int


@dataclass
class PartDifficulty:
    """單一 part 的難度分析。"""
    part_id: str
    instrument_id: str
    score_1_to_5: float           # 最終難度 1-5
    range_factor: float           # 0-1
    density_factor: float
    chord_factor: float
    rhythm_factor: float
    technique_factor: float
    raw_score: float              # 加權平均 0-1
    note_count: int
    chord_count: int
    measures: list[MeasureDifficulty] = None  # type: ignore[assignment]

    def __post_init__(self):
        if self.measures is None:
            self.measures = []

    def label(self) -> str:
        """繁體中文難度標籤。"""
        s = self.score_1_to_5
        if s < 1.5:
            return "業餘初級"
        if s < 2.5:
            return "業餘中級"
        if s < 3.5:
            return "業餘進階"
        if s < 4.5:
            return "半專業"
        return "職業"


# 各因子的權重 (sum = 1)
_WEIGHTS = {
    "range": 0.25,
    "density": 0.15,
    "chord": 0.20,
    "rhythm": 0.20,
    "technique": 0.20,
}

# 密度標準化: 1 note/beat = 0.2, 4 notes/beat = 0.8
_DENSITY_NORM = 5.0

# 短時值閾值: 八分音符以下
_SHORT_DURATION = Fraction(1, 2)  # 半拍

# 弓法 / 技巧上偏難的演奏法 — 計入 technique_factor
_DEMANDING_ARTICULATIONS = {
    "spiccato", "staccatissimo", "marcato", "martele", "martellato",
    "ricochet", "col_legno", "sul_ponticello", "up_bow_staccato",
    "flying_staccato", "jete",
}

# 高把位門檻 = 最高空弦音 + 此偏移 (約 4 把位以上, 需明顯換把)
_POSITION_OFFSET = 12

# technique_factor 三個成分的內部權重
_TECH_POSITION_W = 0.45
_TECH_ARTICULATION_W = 0.35
_TECH_MULTISTOP_W = 0.20


def _is_demanding(articulations) -> bool:
    """事件是否帶有困難弓法 / 演奏法。"""
    if not articulations:
        return False
    return any(a in _DEMANDING_ARTICULATIONS for a in articulations)


def analyze_part_difficulty(part: Part) -> PartDifficulty:
    """計算單一 part 的難度 (含 per-measure breakdown)。"""
    profile = get_profile(part.instrument_id)

    # 弦樂 (有定義空弦) 才計入「高把位」「多音弦樂和弦」技巧難度
    is_string = bool(profile is not None and getattr(profile, "strings", None))
    position_threshold: int | None = None
    if is_string and profile is not None and profile.strings:
        highest_open = max(s.open_pitch.midi_number for s in profile.strings)
        position_threshold = highest_open + _POSITION_OFFSET

    note_count = 0
    chord_count = 0
    out_of_comfort = 0
    short_notes = 0
    high_notes = 0
    demanding_notes = 0
    multistop_notes = 0
    total_events = 0
    total_beats = Fraction(0)

    measure_results: list[MeasureDifficulty] = []

    for measure in part.measures:
        # === per-measure 計數器 ===
        m_notes = 0
        m_chords = 0
        m_out = 0
        m_short = 0
        m_high = 0
        m_demanding = 0
        m_multi = 0
        ts = measure.time_signature or (4, 4)
        measure_beats = Fraction(ts[0], ts[1]) * 4
        total_beats += measure_beats
        voices_iter = (
            measure.voices.values()
            if isinstance(measure.voices, dict)
            else measure.voices
        )
        for voice in voices_iter:
            if voice.is_divisi:
                branches = voice.divisi_branches or []
            else:
                branches = [voice]
            for v in branches:
                for event in v.events:
                    if isinstance(event, NoteEvent):
                        note_count += 1
                        m_notes += 1
                        total_events += 1
                        if event.duration < _SHORT_DURATION:
                            short_notes += 1
                            m_short += 1
                        if profile is not None:
                            cmf_lo, cmf_hi = profile.range_comfortable
                            if not (cmf_lo <= event.pitch.midi_number <= cmf_hi):
                                out_of_comfort += 1
                                m_out += 1
                        if (position_threshold is not None
                                and event.pitch.midi_number
                                > position_threshold):
                            high_notes += 1
                            m_high += 1
                        if _is_demanding(event.articulations):
                            demanding_notes += 1
                            m_demanding += 1
                    elif isinstance(event, ChordEvent):
                        chord_count += 1
                        m_chords += 1
                        total_events += 1
                        if event.duration < _SHORT_DURATION:
                            short_notes += 1
                            m_short += 1
                        top_midi = max(
                            (p.midi_number for p in event.pitches),
                            default=0,
                        )
                        if profile is not None:
                            cmf_lo, cmf_hi = profile.range_comfortable
                            for p in event.pitches:
                                if not (cmf_lo <= p.midi_number <= cmf_hi):
                                    out_of_comfort += 1
                                    m_out += 1
                                    break
                        if (position_threshold is not None
                                and top_midi > position_threshold):
                            high_notes += 1
                            m_high += 1
                        if _is_demanding(event.articulations):
                            demanding_notes += 1
                            m_demanding += 1
                        # 三/四音弦樂和弦 — 真正的技巧難點
                        if is_string and len(event.pitches) >= 3:
                            multistop_notes += 1
                            m_multi += 1
                    # RestEvent 不計入 events
        # 計算該小節難度
        m_pitched = m_notes + m_chords
        m_range = (m_out / m_pitched) if m_pitched > 0 else 0.0
        m_density = (
            min((m_pitched / float(measure_beats)) / _DENSITY_NORM, 1.0)
            if measure_beats > 0 else 0.0
        )
        m_chord_f = (m_chords / m_pitched) if m_pitched > 0 else 0.0
        if (profile is not None and profile.max_simultaneous_notes == 1
                and m_chords > 0):
            m_chord_f = max(m_chord_f, 0.9)
        m_rhythm = (m_short / m_pitched) if m_pitched > 0 else 0.0
        m_technique = _technique_factor(
            m_pitched, m_high, m_demanding, m_multi, is_string,
        )
        m_raw = (
            _WEIGHTS["range"] * m_range
            + _WEIGHTS["density"] * m_density
            + _WEIGHTS["chord"] * m_chord_f
            + _WEIGHTS["rhythm"] * m_rhythm
            + _WEIGHTS["technique"] * m_technique
        )
        measure_results.append(MeasureDifficulty(
            measure=measure.number,
            score_1_to_5=round(1.0 + 4.0 * (m_raw ** 0.7), 2),
            range_factor=round(m_range, 3),
            density_factor=round(m_density, 3),
            chord_factor=round(m_chord_f, 3),
            rhythm_factor=round(m_rhythm, 3),
            technique_factor=round(m_technique, 3),
            note_count=m_pitched,
        ))

    total_pitched = note_count + chord_count

    # === Factor 1: range ===
    range_factor = 0.0
    if total_pitched > 0:
        range_factor = min(out_of_comfort / total_pitched, 1.0)

    # === Factor 2: density ===
    density = 0.0
    if total_beats > 0:
        density = total_pitched / float(total_beats)
    density_factor = min(density / _DENSITY_NORM, 1.0)

    # === Factor 3: chord (多音比例) ===
    chord_factor = 0.0
    if total_pitched > 0:
        chord_factor = chord_count / total_pitched
        # 單音樂器若出現任何和弦就拉到極高 (因為要拆分)
        if profile is not None and profile.max_simultaneous_notes == 1 \
                and chord_count > 0:
            chord_factor = max(chord_factor, 0.9)

    # === Factor 4: rhythm (短時值比例) ===
    rhythm_factor = 0.0
    if total_pitched > 0:
        rhythm_factor = short_notes / total_pitched

    # === Factor 5: technique (高把位 + 困難弓法 + 多音弦樂和弦) ===
    technique_factor = _technique_factor(
        total_pitched, high_notes, demanding_notes, multistop_notes,
        is_string,
    )

    # === 加權平均 ===
    raw = (
        _WEIGHTS["range"] * range_factor
        + _WEIGHTS["density"] * density_factor
        + _WEIGHTS["chord"] * chord_factor
        + _WEIGHTS["rhythm"] * rhythm_factor
        + _WEIGHTS["technique"] * technique_factor
    )
    # 0-1 → 1-5 (略偏向中間, 用平方根讓低分更容易進入中段)
    score_1_to_5 = 1.0 + 4.0 * (raw ** 0.7)

    return PartDifficulty(
        part_id=part.part_id,
        instrument_id=part.instrument_id,
        score_1_to_5=round(score_1_to_5, 2),
        range_factor=round(range_factor, 3),
        density_factor=round(density_factor, 3),
        chord_factor=round(chord_factor, 3),
        rhythm_factor=round(rhythm_factor, 3),
        technique_factor=round(technique_factor, 3),
        raw_score=round(raw, 3),
        note_count=note_count,
        chord_count=chord_count,
        measures=measure_results,
    )


def _technique_factor(
    total_pitched: int,
    high_notes: int,
    demanding_notes: int,
    multistop_notes: int,
    is_string: bool,
) -> float:
    """把高把位 / 困難弓法 / 多音弦樂和弦三個比例融合成 0-1 技巧難度。

    高把位與多音弦樂和弦僅對弦樂計分; 困難弓法 / 演奏法對所有樂器計分。
    """
    if total_pitched <= 0:
        return 0.0
    pos = (high_notes / total_pitched) if is_string else 0.0
    art = demanding_notes / total_pitched
    multi = (multistop_notes / total_pitched) if is_string else 0.0
    return min(
        _TECH_POSITION_W * pos
        + _TECH_ARTICULATION_W * art
        + _TECH_MULTISTOP_W * multi,
        1.0,
    )


def analyze_score_difficulty(score: Score) -> dict[str, PartDifficulty]:
    """為 Score 內所有 parts 計算難度, 回傳 part_id → PartDifficulty。"""
    return {p.part_id: analyze_part_difficulty(p) for p in score.parts}


def difficulty_to_dict(d: PartDifficulty) -> dict:
    """序列化為 JSON-safe dict, 供 server / 前端用。"""
    return {
        "measures": [
            {
                "measure": m.measure,
                "score": m.score_1_to_5,
                "range": m.range_factor,
                "density": m.density_factor,
                "chord": m.chord_factor,
                "rhythm": m.rhythm_factor,
                "technique": m.technique_factor,
                "note_count": m.note_count,
            }
            for m in d.measures
        ],
        "part_id": d.part_id,
        "instrument_id": d.instrument_id,
        "score": d.score_1_to_5,
        "label": d.label(),
        "factors": {
            "range": d.range_factor,
            "density": d.density_factor,
            "chord": d.chord_factor,
            "rhythm": d.rhythm_factor,
            "technique": d.technique_factor,
        },
        "raw_score": d.raw_score,
        "note_count": d.note_count,
        "chord_count": d.chord_count,
    }

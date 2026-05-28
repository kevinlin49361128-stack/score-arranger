"""brass_endurance — 銅管嘴形耐力預算測試"""

from __future__ import annotations

from fractions import Fraction

from core.brass_endurance import analyze_brass_endurance
from core.ir import (
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Section,
    Voice,
)


def _note(midi: int, dur=Fraction(1), onset=Fraction(0)) -> NoteEvent:
    name = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][midi % 12]
    octave = midi // 12 - 1
    return NoteEvent(
        pitch=Pitch(midi, f"{name}{octave}"),
        duration=dur, onset=onset,
    )


def _brass_score(
    instrument_id: str,
    midi_per_measure: list[int],
    note_dur: Fraction = Fraction(4),
) -> Score:
    """每小節一個 4-拍長音 (預設 dur=4 即一整小節 4/4)."""
    measures = []
    for i, midi in enumerate(midi_per_measure):
        measures.append(Measure(
            number=i + 1,
            time_signature=(4, 4) if i == 0 else None,
            voices={1: Voice(voice_id=1, events=[_note(midi, dur=note_dur)])},
        ))
    return Score(
        movements=[Movement(
            movement_id=1, measure_count=len(midi_per_measure),
            sections=[Section(0, 1, len(midi_per_measure))],
        )],
        parts=[Part(
            part_id=f"{instrument_id}_1",
            name_display=instrument_id,
            instrument_id=instrument_id,
            measures=measures,
        )],
    )


# ============================================================================
# Trumpet (range_comfortable[1] = 77 = F5)
# ============================================================================

def test_trumpet_full_high_range_triggers_amateur():
    """16 小節全部 high range (G5=79) — 應觸發 amateur warning."""
    # 整段 G5 (79 > 77)
    score = _brass_score("trumpet_bb", [79] * 16)
    issues = analyze_brass_endurance(score, skill_level="amateur")
    fatigue = [i for i in issues if i.result.code == "W_BRASS_EMBOUCHURE_FATIGUE"]
    assert len(fatigue) >= 1
    assert fatigue[0].result.severity == "warning"
    assert fatigue[0].result.params["instrument"] == "trumpet_bb"
    # ratio 應該接近 1.0 (整段都 high)
    assert fatigue[0].result.params["high_range_ratio"] >= 0.5


def test_trumpet_mid_range_no_issue():
    """整段中音域 (C4=60) — 無 issue."""
    score = _brass_score("trumpet_bb", [60] * 16)
    issues = analyze_brass_endurance(score, skill_level="amateur")
    fatigue = [i for i in issues if i.result.code == "W_BRASS_EMBOUCHURE_FATIGUE"]
    assert fatigue == []


def test_trumpet_professional_skipped():
    """skill_level=professional → 不檢查."""
    score = _brass_score("trumpet_bb", [79] * 16)
    issues = analyze_brass_endurance(score, skill_level="professional")
    fatigue = [i for i in issues if i.result.code == "W_BRASS_EMBOUCHURE_FATIGUE"]
    assert fatigue == []


def test_trumpet_30pct_high_below_threshold():
    """16 小節中 high range 占 ~31% (5/16) — 低於 amateur 50% threshold, 無 issue."""
    # 前 5 小節 high (G5=79), 後 11 小節中音 (C4=60)
    midis = [79] * 5 + [60] * 11
    score = _brass_score("trumpet_bb", midis)
    issues = analyze_brass_endurance(score, skill_level="amateur")
    fatigue = [i for i in issues if i.result.code == "W_BRASS_EMBOUCHURE_FATIGUE"]
    assert fatigue == []


def test_non_brass_skipped():
    """非銅管 (例如 violin) 不檢查."""
    score = _brass_score("violin", [88] * 16)  # violin 高 E6=88
    issues = analyze_brass_endurance(score, skill_level="amateur")
    fatigue = [i for i in issues if i.result.code == "W_BRASS_EMBOUCHURE_FATIGUE"]
    assert fatigue == []


def test_horn_high_range_triggers():
    """French Horn (range_comfortable[1] = 70 = B♭4): 整段 C5+ 觸發."""
    score = _brass_score("horn_f", [72] * 16)  # C5 > 70
    issues = analyze_brass_endurance(score, skill_level="amateur")
    fatigue = [i for i in issues if i.result.code == "W_BRASS_EMBOUCHURE_FATIGUE"]
    assert len(fatigue) >= 1
    assert fatigue[0].result.params["instrument"] == "horn_f"


def test_collect_issues_integration():
    """repair.collect_issues 帶 skill_level → 應包含 brass endurance issue."""
    from core.repair import collect_issues
    score = _brass_score("trumpet_bb", [79] * 16)
    # 不帶 skill_level → 無 brass endurance issue
    issues_no_skill = collect_issues(score)
    no_skill_fatigue = [
        i for i in issues_no_skill
        if i.result.code == "W_BRASS_EMBOUCHURE_FATIGUE"
    ]
    assert no_skill_fatigue == []
    # 帶 skill_level=amateur → 應出現 brass endurance issue
    issues_amateur = collect_issues(score, skill_level="amateur")
    amateur_fatigue = [
        i for i in issues_amateur
        if i.result.code == "W_BRASS_EMBOUCHURE_FATIGUE"
    ]
    assert len(amateur_fatigue) >= 1

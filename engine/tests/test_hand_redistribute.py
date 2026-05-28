"""Hand redistribute strategy 單元測試 (H — 鋼琴 grand-staff 重分配)。

範圍:
- Upper voice 跨度 13 半音 + lower 同 onset 空 → 期望最低音搬到 lower
- 無 span 問題 → 不動
- Lower voice 同拍已有實質音 → 不動 (保留既有結構)
- Lower voice span 過寬 → 搬最高音到 upper
- 同 onset 有 RestEvent → 視為空, 可搬
"""

from __future__ import annotations

from fractions import Fraction

from core.ir import (
    ChordEvent,
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Section,
    Voice,
)
from core.repair import (
    collect_issues,
    repair_loop,
    strategy_hand_redistribute,
)
from core.arrangement_model import Arrangement, violin_piano_ensemble


# ============================================================================
# Helpers
# ============================================================================

def _pitch(midi: int) -> Pitch:
    name = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][midi % 12]
    octave = midi // 12 - 1
    return Pitch(midi, f"{name}{octave}")


def _chord(midis: list[int], dur=Fraction(1), onset=Fraction(0)) -> ChordEvent:
    return ChordEvent(
        pitches=[_pitch(m) for m in midis], duration=dur, onset=onset,
    )


def _note(midi: int, dur=Fraction(1), onset=Fraction(0)) -> NoteEvent:
    return NoteEvent(pitch=_pitch(midi), duration=dur, onset=onset)


def _grand_staff_score(upper_events: list, lower_events: list) -> Score:
    """Piano grand-staff target — 2 parts, 1 measure 各裝給定 events."""
    return Score(
        movements=[Movement(
            movement_id=1, measure_count=1,
            sections=[Section(0, 1, 1)],
        )],
        parts=[
            Part(
                part_id="piano_1_upper", name_display="Piano R.H.",
                instrument_id="piano",
                measures=[Measure(
                    number=1, time_signature=(4, 4),
                    voices={1: Voice(voice_id=1, events=upper_events)},
                )],
            ),
            Part(
                part_id="piano_1_lower", name_display="Piano L.H.",
                instrument_id="piano",
                measures=[Measure(
                    number=1, time_signature=(4, 4),
                    voices={1: Voice(voice_id=1, events=lower_events)},
                )],
            ),
        ],
    )


def _make_arrangement(target: Score) -> Arrangement:
    return Arrangement(
        arrangement_id="hand_redist_test",
        name="hand-redist",
        source_id="src",
        players=violin_piano_ensemble(),
        assignments=[],
        target_score=target,
    )


def _hand_span_issues(score: Score, part_id: str) -> list:
    return [
        i for i in collect_issues(score)
        if i.part_id == part_id and "PIANO_HAND_SPAN" in i.result.code
    ]


# ============================================================================
# Case 1: upper 13 半音 + lower 空 → 最低音移到 lower
# ============================================================================

def test_upper_wide_span_redistributes_lowest_to_empty_lower():
    """C4 + Db5 = 13 半音 > comfortable 10 → 最低音 C4 搬到 lower."""
    upper_chord = _chord([60, 73], dur=Fraction(2))  # C4 + Db5, span=13
    score = _grand_staff_score([upper_chord], [])

    issues = _hand_span_issues(score, "piano_1_upper")
    assert issues, "前提: upper 應有 hand span warning/error"
    span_issue = issues[0]

    ok = strategy_hand_redistribute(score, span_issue)
    assert ok, "策略應成功"

    upper_events = score.parts[0].measures[0].voices[1].events
    lower_events = score.parts[1].measures[0].voices[1].events

    # Upper 剩 Db5 (單音 → NoteEvent), Lower 新增 C4
    assert len(upper_events) == 1
    up_ev = upper_events[0]
    assert isinstance(up_ev, NoteEvent)
    assert up_ev.pitch.midi_number == 73

    assert len(lower_events) == 1
    lo_ev = lower_events[0]
    assert isinstance(lo_ev, NoteEvent)
    assert lo_ev.pitch.midi_number == 60
    assert lo_ev.onset == Fraction(0)
    assert lo_ev.duration == Fraction(2)


# ============================================================================
# Case 2: 無 span 問題 → 策略不動 (issue 不觸發)
# ============================================================================

def test_no_span_issue_strategy_not_invoked():
    """C4 + E4 (span=4) 沒問題, collect_issues 不該生 hand span issue."""
    upper_chord = _chord([60, 64], dur=Fraction(2))
    score = _grand_staff_score([upper_chord], [])
    issues = _hand_span_issues(score, "piano_1_upper")
    assert not issues, "comfortable span 內不應有 issue"


# ============================================================================
# Case 3: lower 同拍已有實質音 → 不貿然合併
# ============================================================================

def test_lower_busy_at_same_onset_strategy_declines():
    """Lower 同 onset 已有 NoteEvent → 策略回 False, 保留既有結構."""
    upper_chord = _chord([60, 73], dur=Fraction(2))  # span=13
    lower_existing = _note(36, dur=Fraction(2))      # C2 同 onset
    score = _grand_staff_score([upper_chord], [lower_existing])

    issues = _hand_span_issues(score, "piano_1_upper")
    assert issues
    span_issue = issues[0]

    ok = strategy_hand_redistribute(score, span_issue)
    assert not ok, "Lower 被佔, 策略應退讓"

    # Upper 仍為原 chord, lower 仍為原 note
    upper_events = score.parts[0].measures[0].voices[1].events
    lower_events = score.parts[1].measures[0].voices[1].events
    assert isinstance(upper_events[0], ChordEvent)
    assert {p.midi_number for p in upper_events[0].pitches} == {60, 73}
    assert len(lower_events) == 1
    assert isinstance(lower_events[0], NoteEvent)
    assert lower_events[0].pitch.midi_number == 36


# ============================================================================
# Case 4: lower span 過寬 → 搬最高音到上手
# ============================================================================

def test_lower_wide_span_redistributes_highest_to_empty_upper():
    """Lower C3 + F4 = 17 半音 > max 12 → 最高音 F4 搬到 upper."""
    # span = 17 觸發 E_PIANO_HAND_SPAN_EXCEED
    lower_chord = _chord([48, 65], dur=Fraction(2))  # C3 + F4
    score = _grand_staff_score([], [lower_chord])

    issues = _hand_span_issues(score, "piano_1_lower")
    assert issues
    span_issue = issues[0]

    ok = strategy_hand_redistribute(score, span_issue)
    assert ok

    upper_events = score.parts[0].measures[0].voices[1].events
    lower_events = score.parts[1].measures[0].voices[1].events

    assert len(upper_events) == 1
    assert isinstance(upper_events[0], NoteEvent)
    assert upper_events[0].pitch.midi_number == 65  # F4 搬上去
    assert len(lower_events) == 1
    assert isinstance(lower_events[0], NoteEvent)
    assert lower_events[0].pitch.midi_number == 48  # 留 C3


# ============================================================================
# Case 5: 同 onset 為 RestEvent → 視為空, 可搬
# ============================================================================

def test_lower_rest_at_same_onset_treated_as_free():
    """Lower 同 onset 是 RestEvent → 策略可正常搬, 並消掉 rest."""
    upper_chord = _chord([60, 73], dur=Fraction(2))
    lower_rest = RestEvent(onset=Fraction(0), duration=Fraction(2))
    score = _grand_staff_score([upper_chord], [lower_rest])

    issues = _hand_span_issues(score, "piano_1_upper")
    assert issues
    span_issue = issues[0]

    ok = strategy_hand_redistribute(score, span_issue)
    assert ok

    lower_events = score.parts[1].measures[0].voices[1].events
    # rest 應被移除, 換成 NoteEvent C4
    note_events = [e for e in lower_events if isinstance(e, NoteEvent)]
    rest_events = [e for e in lower_events if isinstance(e, RestEvent)]
    assert len(note_events) == 1
    assert note_events[0].pitch.midi_number == 60
    assert not rest_events, "同 onset 的 rest 應被新音取代"


# ============================================================================
# Repair loop 整合測試: 大跨度上手 + 空閒下手 → 收斂
# ============================================================================

def test_repair_loop_uses_hand_redistribute_when_applicable():
    """Repair loop 應自動套用 redistribute, 消掉 hand span issue."""
    upper_chord = _chord([60, 73], dur=Fraction(2))  # C4+Db5 span=13
    score = _grand_staff_score([upper_chord], [])
    arrangement = _make_arrangement(score)

    before = _hand_span_issues(score, "piano_1_upper")
    assert before

    report = repair_loop(arrangement, max_iterations=5)
    after_issues = collect_issues(arrangement.target_score)
    after_span = [i for i in after_issues if "PIANO_HAND_SPAN" in i.result.code]
    assert not after_span, "redistribute 後不應再有 hand span 問題"
    # 應有一輪 applied=hand_redistribute
    assert any(it.applied_strategy == "hand_redistribute" for it in report.iterations)


# ============================================================================
# Case 6: 非 grand-staff (沒 _upper/_lower 後綴) → 策略退讓
# ============================================================================

def test_single_staff_piano_strategy_declines():
    """Part id 沒 _upper/_lower → 不是 grand-staff, redistribute 不適用."""
    big_chord = _chord([60, 73], dur=Fraction(2))
    score = Score(
        movements=[Movement(
            movement_id=1, measure_count=1, sections=[Section(0, 1, 1)],
        )],
        parts=[Part(
            part_id="piano_1", name_display="Piano",
            instrument_id="piano",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[big_chord])},
            )],
        )],
    )
    issues = [
        i for i in collect_issues(score)
        if "PIANO_HAND_SPAN" in i.result.code
    ]
    if issues:
        ok = strategy_hand_redistribute(score, issues[0])
        assert not ok, "non-grand-staff 應退讓給其他策略"

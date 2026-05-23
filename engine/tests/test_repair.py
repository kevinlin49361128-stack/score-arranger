"""Repair Loop 單元測試"""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.arrangement_model import (
    Arrangement,
    Player,
    violin_piano_ensemble,
)
from core.ir import (
    ChordEvent,
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Section,
    Voice,
)
from core.repair import (
    LocatedIssue,
    collect_issues,
    repair_loop,
    severity_score,
    strategy_octave_shift,
    strategy_omit_note,
    strategy_split_chord_to_parts,
    strategy_split_to_other_hand,
    _shift_pitch_octave,
)


# ============================================================================
# Helpers
# ============================================================================

def _note(midi: int, dur=Fraction(1), onset=Fraction(0)) -> NoteEvent:
    name = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][midi % 12]
    octave = midi // 12 - 1
    return NoteEvent(
        pitch=Pitch(midi, f"{name}{octave}"),
        duration=dur, onset=onset,
    )


def _chord(midis: list[int], dur=Fraction(1), onset=Fraction(0)) -> ChordEvent:
    pitches = []
    for m in midis:
        name = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][m % 12]
        octave = m // 12 - 1
        pitches.append(Pitch(m, f"{name}{octave}"))
    return ChordEvent(pitches=pitches, duration=dur, onset=onset)


def _single_part_score(part_id: str, instrument_id: str, events: list) -> Score:
    return Score(
        movements=[Movement(
            movement_id=1, measure_count=1,
            sections=[Section(0, 1, 1)],
        )],
        parts=[Part(
            part_id=part_id, name_display=part_id,
            instrument_id=instrument_id,
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=events)},
            )],
        )],
    )


def _make_arrangement(target_score: Score) -> Arrangement:
    return Arrangement(
        arrangement_id="test",
        name="Test",
        source_id="src",
        players=violin_piano_ensemble(),
        assignments=[],
        target_score=target_score,
    )


def _quartet_score(v1: list, v2: list, va: list, vc: list) -> Score:
    """弦樂四重奏 target score — 每個參數是該聲部第 1 小節 voice 1 的 events。"""
    def _p(pid: str, inst: str, events: list) -> Part:
        return Part(
            part_id=pid, name_display=pid, instrument_id=inst,
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=events)},
            )],
        )
    return Score(
        movements=[Movement(
            movement_id=1, measure_count=1, sections=[Section(0, 1, 1)],
        )],
        parts=[
            _p("violin_1", "violin", v1),
            _p("violin_2", "violin", v2),
            _p("viola_3", "viola", va),
            _p("cello_4", "cello", vc),
        ],
    )


# ============================================================================
# _shift_pitch_octave
# ============================================================================

class TestShiftPitchOctave:
    def test_shift_up(self):
        p = Pitch(60, "C4")
        new = _shift_pitch_octave(p, +1)
        assert new.midi_number == 72
        assert new.spelling == "C5"

    def test_shift_down(self):
        p = Pitch(60, "C4")
        new = _shift_pitch_octave(p, -1)
        assert new.midi_number == 48
        assert new.spelling == "C3"

    def test_preserves_accidental(self):
        p = Pitch(73, "C#5")
        new = _shift_pitch_octave(p, -1)
        assert new.midi_number == 61
        assert new.spelling == "C#4"


# ============================================================================
# Issue collection
# ============================================================================

class TestCollectIssues:
    def test_clean_score_no_issues(self):
        score = _single_part_score("v", "violin", [
            _note(72, dur=Fraction(4)),  # C5 in violin comfortable range
        ])
        assert len(collect_issues(score)) == 0

    def test_out_of_range_detected(self):
        score = _single_part_score("v", "violin", [
            _note(30, dur=Fraction(4)),  # 太低
        ])
        issues = collect_issues(score)
        assert len(issues) == 1
        assert issues[0].result.code == "E_PITCH_BELOW_RANGE"

    def test_violin_chord_exceed_detected(self):
        score = _single_part_score("v", "violin", [
            _chord([55, 62, 69, 76, 81], dur=Fraction(4)),  # 5 音
        ])
        issues = collect_issues(score)
        assert len(issues) >= 1
        assert any(i.result.code == "E_STRING_CHORD_EXCEED" for i in issues)


# ============================================================================
# Strategy: octave shift
# ============================================================================

class TestStrategyOctaveShift:
    def test_low_note_shifted_up(self):
        score = _single_part_score("v", "violin", [
            _note(48, dur=Fraction(4)),  # C3, 低於 violin G3=55
        ])
        issues = collect_issues(score)
        assert len(issues) == 1
        success = strategy_octave_shift(score, issues[0])
        assert success
        # 音符應已上移八度
        event = score.parts[0].measures[0].voices[1].events[0]
        assert event.pitch.midi_number == 60  # C4

    def test_chord_issue_not_handled(self):
        """策略 1 不應處理和弦問題"""
        score = _single_part_score("v", "violin", [
            _chord([55, 62, 69, 76, 81], dur=Fraction(4)),
        ])
        issues = collect_issues(score)
        violin_chord_issue = next(
            i for i in issues if i.result.code == "E_STRING_CHORD_EXCEED"
        )
        success = strategy_octave_shift(score, violin_chord_issue)
        assert not success


# ============================================================================
# Strategy: omit note
# ============================================================================

class TestStrategyOmitNote:
    def test_5_note_chord_reduced_to_4(self):
        score = _single_part_score("v", "violin", [
            _chord([55, 62, 69, 76, 81], dur=Fraction(4)),
        ])
        issues = collect_issues(score)
        chord_issue = next(
            i for i in issues if i.result.code == "E_STRING_CHORD_EXCEED"
        )
        success = strategy_omit_note(score, chord_issue)
        assert success
        event = score.parts[0].measures[0].voices[1].events[0]
        assert isinstance(event, ChordEvent)
        assert len(event.pitches) == 4

    def test_octave_issue_not_handled(self):
        score = _single_part_score("v", "violin", [
            _note(30, dur=Fraction(4)),
        ])
        issues = collect_issues(score)
        success = strategy_omit_note(score, issues[0])
        assert not success


# ============================================================================
# Strategy: split to other hand
# ============================================================================

class TestStrategySplitToOtherHand:
    def _make_two_staff_piano_score(self, upper_events, lower_events) -> Score:
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

    def test_upper_chord_span_split(self):
        """上手 chord 跨度 21 半音 → 切分,部分移到下手"""
        big_chord = _chord([60, 65, 70, 75, 81], dur=Fraction(4))
        score = self._make_two_staff_piano_score([big_chord], [])
        issues = collect_issues(score)
        # 找上手的 hand span 問題
        upper_issue = next(
            i for i in issues
            if i.part_id == "piano_1_upper" and "PIANO_HAND_SPAN" in i.result.code
        )
        success = strategy_split_to_other_hand(score, upper_issue)
        assert success

        upper_events = score.parts[0].measures[0].voices[1].events
        lower_events = score.parts[1].measures[0].voices[1].events
        assert len(lower_events) >= 1  # 下手新增了音

        # 全部音的合計應仍為 5
        upper_count = (
            len(upper_events[0].pitches)
            if isinstance(upper_events[0], ChordEvent)
            else 1
        )
        lower_count = sum(
            len(e.pitches) if isinstance(e, ChordEvent) else 1
            for e in lower_events
        )
        assert upper_count + lower_count == 5

    def test_non_piano_issue_not_handled(self):
        score = _single_part_score("v", "violin", [
            _chord([55, 62, 69, 76, 81], dur=Fraction(4)),
        ])
        issues = collect_issues(score)
        violin_issue = next(
            i for i in issues if i.result.code == "E_STRING_CHORD_EXCEED"
        )
        success = strategy_split_to_other_hand(score, violin_issue)
        assert not success


# ============================================================================
# Strategy: split chord across parts (跨聲部拆分)
# ============================================================================

class TestStrategySplitToParts:
    def test_overfull_chord_split_across_quartet(self):
        """violin I 的 5 音和弦 → 拆分: 頂部留 violin I, 移出音散到其他聲部。"""
        score = _quartet_score(
            [_chord([55, 62, 69, 76, 81], dur=Fraction(4))], [], [], [],
        )
        target = next(
            i for i in collect_issues(score)
            if i.part_id == "violin_1"
            and i.result.code == "E_STRING_CHORD_EXCEED"
        )
        assert strategy_split_chord_to_parts(score, target)

        v1_ev = score.parts[0].measures[0].voices[1].events[0]
        v1_count = len(v1_ev.pitches) if isinstance(v1_ev, ChordEvent) else 1
        assert v1_count <= 4, "violin I 應縮減到弦數內"

        total = v1_count
        for p in score.parts[1:]:
            for v in p.measures[0].voices.values():
                for e in v.events:
                    total += len(e.pitches) if isinstance(e, ChordEvent) else 1
        assert total == 5, "拆分不應丟音"
        assert all(
            i.severity != "error" for i in collect_issues(score)
        ), "拆分後不應殘留 error"

    def test_split_preserves_top_melody_note(self):
        """最高音 (旋律輪廓) 必須留在 violin I。"""
        score = _quartet_score(
            [_chord([55, 62, 69, 76, 81], dur=Fraction(4))], [], [], [],
        )
        target = next(
            i for i in collect_issues(score) if i.part_id == "violin_1"
        )
        assert strategy_split_chord_to_parts(score, target)
        v1_ev = score.parts[0].measures[0].voices[1].events[0]
        v1_midis = (
            [p.midi_number for p in v1_ev.pitches]
            if isinstance(v1_ev, ChordEvent)
            else [v1_ev.pitch.midi_number]
        )
        assert max(v1_midis) == 81

    def test_non_adjacent_chord_split(self):
        """跨非相鄰弦和弦 (使用者實際遇到的錯誤) → 可拆分修掉, 不丟音。"""
        score = _quartet_score(
            [_chord([56, 62, 67], dur=Fraction(4))], [], [], [],
        )
        target = next(
            i for i in collect_issues(score) if i.part_id == "violin_1"
        )
        assert target.result.code == "E_NON_ADJACENT_STRINGS"
        assert strategy_split_chord_to_parts(score, target)
        total = 0
        for p in score.parts:
            for v in p.measures[0].voices.values():
                for e in v.events:
                    total += len(e.pitches) if isinstance(e, ChordEvent) else 1
        assert total == 3, "拆分不應丟音"
        assert all(i.severity != "error" for i in collect_issues(score))

    def test_no_receivers_returns_false(self):
        """單一聲部 (無鄰近弦樂可分) → 策略放棄。"""
        score = _single_part_score("violin_1", "violin", [
            _chord([55, 62, 69, 76, 81], dur=Fraction(4)),
        ])
        target = next(
            i for i in collect_issues(score)
            if i.result.code == "E_STRING_CHORD_EXCEED"
        )
        assert not strategy_split_chord_to_parts(score, target)

    def test_non_trigger_code_returns_false(self):
        """非弦樂和弦問題 → 此策略不處理。"""
        score = _quartet_score([_note(30, dur=Fraction(4))], [], [], [])
        target = next(
            i for i in collect_issues(score) if i.part_id == "violin_1"
        )
        assert not strategy_split_chord_to_parts(score, target)

    def test_repair_loop_improves_quartet_chord(self):
        """repair_loop 對四重奏裡演奏不了的和弦 — 整體嚴重度應下降。"""
        score = _quartet_score([_chord([56, 62, 67], dur=Fraction(4))], [], [], [])
        arr = _make_arrangement(score)
        before = severity_score(collect_issues(arr.target_score))
        repair_loop(arr)
        after = severity_score(collect_issues(arr.target_score))
        assert after < before


# ============================================================================
# Repair loop 整合
# ============================================================================

class TestRepairLoop:
    def test_converges_on_clean_score(self):
        score = _single_part_score("v", "violin", [
            _note(72, dur=Fraction(4)),
        ])
        arrangement = _make_arrangement(score)
        report = repair_loop(arrangement)
        assert report.converged
        assert report.final_issue_count == 0
        assert len(report.iterations) == 0

    def test_fixes_octave_out_of_range(self):
        score = _single_part_score("v", "violin", [
            _note(30, dur=Fraction(4)),  # 太低
        ])
        arrangement = _make_arrangement(score)
        report = repair_loop(arrangement)
        # 修復後應收斂或顯著改善
        final_issues = collect_issues(arrangement.target_score)
        assert all(i.result.code != "E_PITCH_BELOW_RANGE" for i in final_issues)
        assert len(report.iterations) >= 1
        assert report.iterations[0].applied_strategy == "octave_shift"

    def test_locked_event_not_repaired(self):
        """is_locked=True 的音域外音符, repair 不應動它。"""
        bad = _note(30, dur=Fraction(4))  # 太低, 正常會被 octave_shift
        bad.is_locked = True
        score = _single_part_score("v", "violin", [bad])
        arrangement = _make_arrangement(score)
        report = repair_loop(arrangement)
        # 鎖定 → 不該有任何 iteration 動到它
        ev = arrangement.target_score.parts[0].measures[0].voices[1].events[0]
        assert ev.pitch.midi_number == 30, "鎖定的音不應被 repair 移動"
        # 沒有可修的 actionable issue → 應收斂
        assert report.converged

    def test_unlocked_event_still_repaired(self):
        """對照組: 同樣的音沒鎖定 → 仍會被修。"""
        bad = _note(30, dur=Fraction(4))
        bad.is_locked = False
        score = _single_part_score("v", "violin", [bad])
        arrangement = _make_arrangement(score)
        repair_loop(arrangement)
        ev = arrangement.target_score.parts[0].measures[0].voices[1].events[0]
        assert ev.pitch.midi_number != 30, "未鎖定的音應被 repair 移動"

    def test_reduces_5_note_chord(self):
        score = _single_part_score("v", "violin", [
            _chord([55, 62, 69, 76, 81], dur=Fraction(4)),
        ])
        arrangement = _make_arrangement(score)
        report = repair_loop(arrangement)
        # 至少有一次省略音
        applied = {it.applied_strategy for it in report.iterations}
        assert "omit_note" in applied

    def test_severity_score_decreases(self):
        score = _single_part_score("v", "violin", [
            _note(30, dur=Fraction(4)),
            _note(120, dur=Fraction(4), onset=Fraction(1)),  # 超高
        ])
        arrangement = _make_arrangement(score)
        initial = severity_score(collect_issues(arrangement.target_score))
        repair_loop(arrangement)
        final = severity_score(collect_issues(arrangement.target_score))
        assert final < initial

    def test_max_iterations_terminates(self):
        """無解問題不應導致無限迴圈"""
        # 建立一個 100 音和弦,沒有策略能修
        score = _single_part_score("piano", "piano", [
            _chord([60 + i for i in range(50)], dur=Fraction(4)),
        ])
        arrangement = _make_arrangement(score)
        report = repair_loop(arrangement, max_iterations=5)
        assert len(report.iterations) <= 5


class TestManualKeyPersistence:
    """Reviewer 建議: manual issue 必須跨輪持久, 用 5-tuple key 維護"""

    def test_issue_key_stable_across_collect(self):
        """同位置同 code 的 issue 不論何時 collect_issues 都產生相同 key"""
        from core.repair import collect_issues, issue_key

        # 建一個必定有問題的譜: violin 跨非相鄰弦
        # 用 C3 (低於 violin 最低弦 G3) → 必出 E_PITCH_BELOW_RANGE / similar
        events = [_note(40)]  # E2 (太低)
        score = _single_part_score("violin_1", "violin", events)
        issues1 = collect_issues(score)
        issues2 = collect_issues(score)
        assert len(issues1) > 0
        keys1 = {issue_key(i) for i in issues1}
        keys2 = {issue_key(i) for i in issues2}
        assert keys1 == keys2, "issue_key 應在多次 collect 後一致"

    def test_mark_manual_by_keys_applies_to_new_issues(self):
        """mark_manual_by_keys 對重新 collect 的 issues 套用 manual 標記"""
        from core.repair import (
            collect_issues,
            issue_key,
            mark_manual_by_keys,
        )

        events = [_note(40)]  # E2 太低
        score = _single_part_score("violin_1", "violin", events)
        first = collect_issues(score)
        assert len(first) > 0
        key = issue_key(first[0])
        manual_keys = {key}
        # 第二次 collect → mark
        second = collect_issues(score)
        mark_manual_by_keys(second, manual_keys)
        # 找到同 key 的 issue, 它應該已標為 manual
        target = next(i for i in second if issue_key(i) == key)
        assert target.is_manual is True

    def test_manual_loop_does_not_oscillate(self):
        """若所有策略皆失敗 (用空策略列表模擬), manual_keys 累積後
        後續輪次過濾掉同 issue, repair_loop 應在 1-2 輪內收斂收尾."""
        from core.repair import repair_loop

        events = [_note(40)]  # E2 — violin 無法接受
        score = _single_part_score("violin_1", "violin", events)
        arrangement = _make_arrangement(score)
        report = repair_loop(
            arrangement, max_iterations=10, strategies=[],
        )
        # 行為驗證:
        # - 至少嘗試一輪 (iteration 0 → applied=None → mark manual)
        assert len(report.iterations) >= 1
        # - 該輪 applied_strategy=None (因策略列表空)
        assert report.iterations[0].applied_strategy is None
        # - 在第二輪 manual_keys 已包含此 issue → actionable=[] → converged
        assert report.converged is True
        assert len(report.iterations) <= 2, (
            f"超過 2 輪表示沒套用 manual_keys 過濾, iters={len(report.iterations)}"
        )
        # - 應記錄 manual issue
        assert len(report.manual_issues) >= 1


# ============================================================================
# 整合 Bach 全 pipeline
# ============================================================================

def test_bach_arrangement_repair():
    """Bach 聖詠 → 改編 → 修復: 修復後問題數 ≤ 修復前"""
    from music21 import corpus
    from core.analyzer.function import tag_all_sections
    from core.arranger import arrange
    from core.parser import parse_stream

    m21_score = corpus.parse("bach/bwv66.6")
    ir = parse_stream(m21_score)
    tag_all_sections(ir)
    arrangement = arrange(ir, violin_piano_ensemble())

    initial_issues = collect_issues(arrangement.target_score)
    initial_score = severity_score(initial_issues)

    report = repair_loop(arrangement)

    final_issues = collect_issues(arrangement.target_score)
    final_score = severity_score(final_issues)

    assert final_score <= initial_score, \
        f"修復未改善: {initial_score} → {final_score}"


# ============================================================================
# 品質感知修復 (quality-aware repair)
# ============================================================================

def test_repair_reports_quality():
    """repair_loop 應在 report 帶入修復前/後的品質分數。"""
    from core.analyzer.function import tag_all_sections
    from core.arrangement_model import build_ensemble
    from core.arranger import arrange as run_arrange
    from core.parser import parse_musicxml
    from core.quality import QualityReport
    from core.repair import repair_loop

    score = parse_musicxml("corpus:mozart/k155/movement1")
    tag_all_sections(score)
    arr = run_arrange(
        score, build_ensemble("violin_piano", skill_level="amateur"),
    )
    report = repair_loop(arr)
    assert isinstance(report.quality_before, QualityReport)
    assert isinstance(report.quality_after, QualityReport)
    for q in (report.quality_before, report.quality_after):
        assert 0.0 <= q.melody_preservation <= 1.0
        assert 0.0 <= q.harmony_completeness <= 1.0
        assert 0.0 <= q.playability <= 1.0


def test_pick_best_candidate_lower_issue_score_wins():
    """_pick_best_candidate: issue 分數低的候選優先 (品質只是同分時的次鍵)。"""
    from core.ir import Score
    from core.repair import _pick_best_candidate

    arr = Arrangement(
        arrangement_id="x", name="x", source_id="x",
        players=[], assignments=[], target_score=None,
    )
    cands = [
        ("omit_note", 8.0, Score()),
        ("octave_shift", 3.0, Score()),
    ]
    name, score_after, _ = _pick_best_candidate(arr, cands)
    assert name == "octave_shift"
    assert score_after == 3.0


def test_pick_best_candidate_single():
    """單一候選 → 直接回傳, 不需 source_score。"""
    from core.ir import Score
    from core.repair import _pick_best_candidate

    arr = Arrangement(
        arrangement_id="x", name="x", source_id="x",
        players=[], assignments=[], target_score=None,
    )
    name, _, _ = _pick_best_candidate(arr, [("omit_note", 5.0, Score())])
    assert name == "omit_note"


# ============================================================================
# 管樂換氣檢測 (W_WIND_NO_BREATH)
# ============================================================================

def _wind_score(instrument_id: str, events: list, measure_count: int = 1) -> Score:
    """單管樂 part, events 在 measure 1 voice 1. 若 measure_count > 1 重複."""
    from core.ir import RestEvent
    measures = []
    for m_num in range(1, measure_count + 1):
        # 把 events 依小節切 — 每小節最多 4 拍.
        measures.append(Measure(
            number=m_num, time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=list(events))},
        ))
    return Score(
        movements=[Movement(
            movement_id=1, measure_count=measure_count,
            sections=[Section(0, 1, measure_count)],
        )],
        parts=[Part(
            part_id="flute_1", name_display="Flute",
            instrument_id=instrument_id, measures=measures,
        )],
    )


def test_wind_breathing_within_limit_ok():
    """連續吹奏未超過 max_sustained_beats (flute=16): 不報警告."""
    # 8 拍長音 — 遠低於 flute 16 拍上限
    score = _wind_score("flute", [_note(72, dur=Fraction(8))])
    issues = collect_issues(score)
    wind_issues = [i for i in issues if i.result.code == "W_WIND_NO_BREATH"]
    assert wind_issues == []


def test_wind_breathing_exceed_emits_warning():
    """連續 20 拍 (flute 上限 16): 應產生 warning."""
    # 5 個 4-拍長音 = 20 拍, 中間無休止
    events = [_note(72, dur=Fraction(4))] * 5
    # 一個 measure 也行 — _detect_wind_breathing 不依賴 measure 切分.
    score = _wind_score("flute", events, measure_count=1)
    issues = collect_issues(score)
    wind_issues = [i for i in issues if i.result.code == "W_WIND_NO_BREATH"]
    assert len(wind_issues) == 1
    assert wind_issues[0].result.severity == "warning"
    assert wind_issues[0].result.params["instrument"] == "flute"


def test_wind_breathing_rest_resets():
    """休止符後重置累積; 兩段 12 拍中間有 rest → 不報警."""
    from core.ir import RestEvent
    events = [
        _note(72, dur=Fraction(4)),
        _note(72, dur=Fraction(4)),
        _note(72, dur=Fraction(4)),
        RestEvent(duration=Fraction(1), onset=Fraction(0)),
        _note(72, dur=Fraction(4)),
        _note(72, dur=Fraction(4)),
        _note(72, dur=Fraction(4)),
    ]
    score = _wind_score("flute", events)
    issues = collect_issues(score)
    wind_issues = [i for i in issues if i.result.code == "W_WIND_NO_BREATH"]
    assert wind_issues == []


def test_wind_breathing_breath_articulation_resets():
    """音符上有 'breath' articulation → 視為換氣點, 重置累積."""
    # 第 4 個音 (累積 16 拍) 帶 breath articulation; 之後再 8 拍應不報警.
    breath_note = _note(72, dur=Fraction(4))
    breath_note.articulations.append("breath")
    events = [
        _note(72, dur=Fraction(4)),
        _note(72, dur=Fraction(4)),
        _note(72, dur=Fraction(4)),
        breath_note,
        _note(72, dur=Fraction(4)),
        _note(72, dur=Fraction(4)),
    ]
    score = _wind_score("flute", events)
    issues = collect_issues(score)
    wind_issues = [i for i in issues if i.result.code == "W_WIND_NO_BREATH"]
    assert wind_issues == []


def test_wind_breathing_non_wind_skipped():
    """弦樂 (sustain_type=bow, breath_required=False) 應跳過此檢查."""
    score = _wind_score("violin", [_note(72, dur=Fraction(40))])
    issues = collect_issues(score)
    wind_issues = [i for i in issues if i.result.code == "W_WIND_NO_BREATH"]
    assert wind_issues == []

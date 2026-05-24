"""層次 B 動態驗證器測試"""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.instruments import VIOLIN_PROFILE, get_profile
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
from core.validator_dynamic import (
    StringPositionSimulator,
    calculate_violin_position,
    collect_dynamic_issues,
)


# ============================================================================
# Helpers
# ============================================================================

def _note(midi: int, dur=Fraction(1), onset=Fraction(0)) -> NoteEvent:
    return NoteEvent(pitch=Pitch(midi, "n"), duration=dur, onset=onset)


def _make_part(events_per_measure: list[list]) -> Part:
    measures = []
    for i, events in enumerate(events_per_measure):
        measures.append(Measure(
            number=i + 1,
            time_signature=(4, 4) if i == 0 else None,
            voices={1: Voice(voice_id=1, events=events)},
        ))
    return Part(
        part_id="violin_1", name_display="Violin",
        instrument_id="violin", measures=measures,
    )


# ============================================================================
# Position calculation
# ============================================================================

class TestCalculatePosition:
    def test_open_g_string_position_1(self):
        # G3 (MIDI 55) = open G string = 1st position
        pos = calculate_violin_position(Pitch(55, "G3"), VIOLIN_PROFILE)
        assert pos == 1

    def test_e5_open_string_position_1(self):
        # E5 (MIDI 76) on E string = open = 1st position
        pos = calculate_violin_position(Pitch(76, "E5"), VIOLIN_PROFILE)
        assert pos == 1

    def test_high_note_higher_position(self):
        # A6 (MIDI 93) on E string = 17 半音上
        pos = calculate_violin_position(Pitch(93, "A6"), VIOLIN_PROFILE)
        assert pos is not None
        assert pos > 5  # 較高把位

    def test_below_range_returns_none(self):
        pos = calculate_violin_position(Pitch(40, "E2"), VIOLIN_PROFILE)
        assert pos is None


# ============================================================================
# Position jump simulation
# ============================================================================

class TestStringPositionSimulator:
    def test_slow_passage_no_issues(self):
        """全音符大跳, 速度慢, 應無問題"""
        part = _make_part([
            [_note(55, dur=Fraction(4))],  # G3 (1st pos)
            [_note(88, dur=Fraction(4))],  # E6 (high pos)
        ])
        sim = StringPositionSimulator(profile=VIOLIN_PROFILE)
        issues = sim.simulate_part(part, tempo_bpm=60)
        assert len(issues) == 0  # 4 拍時間足夠任何把位跳

    def test_fast_large_jump_warns(self):
        """快速 16 分音符大跳 → 應警告"""
        part = _make_part([
            [
                _note(55, dur=Fraction(1, 4), onset=Fraction(0)),    # G3
                _note(88, dur=Fraction(1, 4), onset=Fraction(1, 4)), # E6
            ],
        ])
        sim = StringPositionSimulator(profile=VIOLIN_PROFILE)
        issues = sim.simulate_part(part, tempo_bpm=120)
        # 16 分音符 @120bpm = 0.125 秒, 把位跳數需要更多時間
        assert any(
            i.result.code in (
                "E_VIOLIN_POSITION_JUMP_TOO_FAST",
                "W_VIOLIN_POSITION_JUMP_DIFFICULT",
            )
            for i in issues
        )

    def test_same_position_no_issue(self):
        """相同把位內音符不應產生 issue"""
        part = _make_part([[
            _note(55), _note(57, onset=Fraction(1)),
            _note(59, onset=Fraction(2)), _note(60, onset=Fraction(3)),
        ]])
        sim = StringPositionSimulator(profile=VIOLIN_PROFILE)
        issues = sim.simulate_part(part, tempo_bpm=120)
        assert len(issues) == 0

    def test_long_sequence_dp_path(self):
        """跨事件 viterbi DP 接線 — 長序列 (13 音上行) 慢速下不該產生跳躍問題,
        且 DP 路徑須能無誤跑完整段。"""
        part = _make_part([
            [_note(m, dur=Fraction(4))] for m in range(55, 68)
        ])
        sim = StringPositionSimulator(profile=VIOLIN_PROFILE)
        issues = sim.simulate_part(part, tempo_bpm=60)
        assert len(issues) == 0


# ============================================================================
# Integration
# ============================================================================

def test_collect_dynamic_issues_skips_non_string():
    """鋼琴部分不應觸發弦樂把位檢查 (Phase 2 才有 keyboard simulator)"""
    score = Score(
        parts=[Part(
            part_id="piano_1", name_display="Piano",
            instrument_id="piano",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    _note(60), _note(96, onset=Fraction(1, 4)),  # 跨度大
                ])},
            )],
        )],
    )
    issues = collect_dynamic_issues(score, tempo_bpm=120)
    assert len(issues) == 0  # piano 不在 Phase 1 範圍


# ============================================================================
# 0.1.31 樂理深化 #3: 撥弦 (吉他/魯特琴) 跨事件指法 DP
# ============================================================================

class TestFrettedPositionSimulator:
    """吉他/魯特琴跨事件指法 DP 模擬器 — 結構鏡像弦樂版."""

    def _make_guitar_part(self, events: list) -> Part:
        return Part(
            part_id="guitar_1", name_display="Guitar",
            instrument_id="guitar",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=events)},
            )],
        )

    def test_slow_passage_no_issue(self):
        """全音符慢速 (60bpm) → 不論怎麼跑都不該產生 issue."""
        from core.validator_dynamic import FrettedPositionSimulator
        profile = get_profile("guitar")
        part = self._make_guitar_part([
            _note(40, dur=Fraction(4)),
            _note(70, dur=Fraction(4), onset=Fraction(4)),
        ])
        sim = FrettedPositionSimulator(profile=profile, max_fret=19)
        issues = sim.simulate_part(part, tempo_bpm=60)
        assert len(issues) == 0

    def test_fast_fret_jump_flagged(self):
        """16 分音符快速跨幅大 fret 跳 → 應觸發 fret jump issue."""
        from core.validator_dynamic import FrettedPositionSimulator
        profile = get_profile("guitar")
        # 1st fret 附近 (E4=64=open 6, F4=65=fret1 on 6) → 高把位 (~fret 14)
        # 中間沒有 rest, 32 分音符給的時間極少
        part = self._make_guitar_part([
            _note(41, dur=Fraction(1, 16)),    # F2, low fret
            _note(78, onset=Fraction(1, 16),    # F#5, fret ~14
                  dur=Fraction(1, 16)),
        ])
        sim = FrettedPositionSimulator(profile=profile, max_fret=19)
        issues = sim.simulate_part(part, tempo_bpm=180)
        codes = {i.result.code for i in issues}
        assert any("FRETTED_POSITION_JUMP" in c for c in codes)

    def test_collect_dynamic_issues_processes_guitar(self):
        """collect_dynamic_issues 應對 plucked family 跑 simulator."""
        score = Score(
            default_tempo_bpm=200,
            parts=[Part(
                part_id="guitar_1", name_display="Guitar",
                instrument_id="guitar",
                measures=[Measure(
                    number=1, time_signature=(4, 4),
                    voices={1: Voice(voice_id=1, events=[
                        _note(41, dur=Fraction(1, 16)),
                        _note(78, onset=Fraction(1, 16),
                              dur=Fraction(1, 16)),
                    ])},
                )],
            )],
        )
        issues = collect_dynamic_issues(score)
        codes = {i.result.code for i in issues}
        assert any("FRETTED_POSITION_JUMP" in c for c in codes)

    def test_lute_uses_lower_max_fret(self):
        """魯特琴 max_fret=12, 超過會無 fingering. 但本測試只確認執行不崩."""
        from core.validator_dynamic import FrettedPositionSimulator
        profile = get_profile("lute")
        # 普通的中段把位序列
        part = Part(
            part_id="lute_1", name_display="Lute",
            instrument_id="lute",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    _note(55, dur=Fraction(2)),
                    _note(60, onset=Fraction(2), dur=Fraction(2)),
                ])},
            )],
        )
        sim = FrettedPositionSimulator(profile=profile, max_fret=12)
        issues = sim.simulate_part(part, tempo_bpm=80)
        # 不該崩, issue 數量不限
        assert isinstance(issues, list)


def test_collect_dynamic_issues_processes_violin():
    score = Score(
        default_tempo_bpm=240,  # 極快速度
        parts=[Part(
            part_id="violin_1", name_display="Violin",
            instrument_id="violin",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    _note(55, dur=Fraction(1, 8)),
                    _note(95, onset=Fraction(1, 8), dur=Fraction(1, 8)),  # G3 → B6 32分音符
                ])},
            )],
        )],
    )
    issues = collect_dynamic_issues(score)
    assert len(issues) >= 1
    assert any("VIOLIN_POSITION_JUMP" in i.result.code for i in issues)

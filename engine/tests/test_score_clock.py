"""ScoreClock / TimeMap (架構改造 Phase A) 測試。

驗證以 quarter 為基準的統一時間模型: 簡單 / pickup / 變拍 / 變速 + 各換算。
"""
from fractions import Fraction

import pytest

from core.ir import Measure, NoteEvent, Part, Pitch, Score, Voice
from core.score_clock import PPQ, build_score_clock, serialize_score_clock


def _note(onset: float, dur: float) -> NoteEvent:
    return NoteEvent(
        pitch=Pitch(midi_number=60, spelling="C4"),
        duration=Fraction(dur).limit_denominator(),
        onset=Fraction(onset).limit_denominator(),
    )


def _measure(number, events, ts=None, bpm=None, pickup=False):
    return Measure(
        number=number, is_pickup=pickup,
        voices={1: Voice(voice_id=1, events=events)},
        time_signature=ts, tempo_bpm=bpm,
    )


def _score(measures, bpm=120.0, ts=(4, 4)):
    p = Part(part_id="v1", name_display="V", instrument_id="violin",
             measures=measures)
    return Score(parts=[p], default_tempo_bpm=bpm, default_time_signature=ts)


def test_simple_4_4():
    # 3 個 4/4 小節, 120bpm → 每小節 4 quarter / 2 秒
    s = _score([
        _measure(1, [_note(0, 4)]),
        _measure(2, [_note(0, 4)]),
        _measure(3, [_note(0, 4)]),
    ])
    clk = build_score_clock(s)
    assert [e.quarter_offset for e in clk.entries] == [0.0, 4.0, 8.0]
    assert [e.second_offset for e in clk.entries] == [0.0, 2.0, 4.0]
    assert clk.total_quarters == 12.0
    assert clk.total_seconds == 6.0
    assert clk.quarter_to_second(4.0) == 2.0
    assert clk.quarter_to_measure(5.0) == (2, 1.0)      # 第2小節, 內 1 quarter
    assert clk.second_to_measure(3.0) == (2, 1.0)       # 3秒 → 第2小節內 1秒
    assert clk.quarter_to_ticks(4.0) == 4 * PPQ


def test_pickup_uses_content_length():
    # pickup(m0) 只有 1 quarter 內容 → 後續小節以 1 起算, 不是整小節 4
    s = _score([
        _measure(0, [_note(0, 1)], pickup=True),
        _measure(1, [_note(0, 4)]),
        _measure(2, [_note(0, 4)]),
    ])
    clk = build_score_clock(s)
    assert clk.entries[0].duration_quarters == 1.0
    assert [e.quarter_offset for e in clk.entries] == [0.0, 1.0, 5.0]
    assert clk.quarter_to_measure(0.5) == (0, 0.5)      # pickup 內
    assert clk.quarter_to_measure(1.0) == (1, 0.0)      # 正好進第1小節


def test_time_signature_change():
    # m2 變 3/4 → duration 3 quarter
    s = _score([
        _measure(1, [_note(0, 4)]),
        _measure(2, [_note(0, 3)], ts=(3, 4)),
        _measure(3, [_note(0, 3)]),
    ])
    clk = build_score_clock(s)
    assert clk.entries[1].duration_quarters == 3.0
    assert [e.quarter_offset for e in clk.entries] == [0.0, 4.0, 7.0]
    assert clk.entries[1].numerator == 3 and clk.entries[1].denominator == 4


def test_tempo_change_affects_seconds_not_quarters():
    # m2 變 60bpm → quarter 不變, 但秒翻倍
    s = _score([
        _measure(1, [_note(0, 4)]),
        _measure(2, [_note(0, 4)], bpm=60.0),
    ])
    clk = build_score_clock(s)
    # quarter 恆定
    assert [e.quarter_offset for e in clk.entries] == [0.0, 4.0]
    # m1: 4q@120 = 2s; m2 從 2s 起, 4q@60 = 4s → 共 6s
    assert clk.entries[1].second_offset == 2.0
    assert clk.total_seconds == 6.0
    assert clk.quarter_to_second(8.0) == pytest.approx(6.0)


def test_serialize_shape():
    s = _score([_measure(1, [_note(0, 4)])])
    d = serialize_score_clock(build_score_clock(s))
    assert d["ppq"] == PPQ
    assert d["default_bpm"] == 120.0
    assert d["entries"][0]["measure_number"] == 1
    assert set(d["entries"][0]) >= {
        "measure_number", "quarter_offset", "second_offset",
        "duration_quarters", "bpm", "numerator", "denominator", "tick_offset",
    }

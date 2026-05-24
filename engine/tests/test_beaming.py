"""自動 beam (連桿) — ir_to_musicxml._compute_beams 測試 (0.1.34).

慣例: 同一拍內連續 8th / 16th 應該以 <beam> 連起來.
- 簡單拍 (2/4, 3/4, 4/4): beat = quarter
- 複合拍 (6/8, 9/8, 12/8): beat = dotted quarter
"""

from __future__ import annotations

from fractions import Fraction

from core.ir import NoteEvent, Pitch, RestEvent
from core.ir_to_musicxml import _compute_beams


def _n(midi: int, dur, onset) -> NoteEvent:
    return NoteEvent(
        pitch=Pitch(midi_number=midi, spelling=f"n{midi}"),
        duration=Fraction(dur),
        onset=Fraction(onset),
    )


def _r(dur, onset) -> RestEvent:
    return RestEvent(duration=Fraction(dur), onset=Fraction(onset))


class TestComputeBeams:
    def test_two_eighths_same_beat_get_beam(self):
        """4/4 第 1 拍兩個 8th — begin / end."""
        events = [_n(60, Fraction(1, 2), 0), _n(62, Fraction(1, 2), Fraction(1, 2))]
        beams = _compute_beams(events, (4, 4))
        assert beams[0] == [(1, "begin")]
        assert beams[1] == [(1, "end")]

    def test_four_eighths_one_beat_in_two_four(self):
        """2/4 中四個 8th 落在兩拍 — 每拍各自 begin/end."""
        # 2/4: beat = quarter. 4 個 8th = 2 拍.
        events = [
            _n(60, Fraction(1, 2), Fraction(0)),    # beat 0
            _n(62, Fraction(1, 2), Fraction(1, 2)),  # beat 0
            _n(64, Fraction(1, 2), Fraction(1)),     # beat 1
            _n(65, Fraction(1, 2), Fraction(3, 2)),  # beat 1
        ]
        beams = _compute_beams(events, (2, 4))
        assert beams[0] == [(1, "begin")]
        assert beams[1] == [(1, "end")]
        assert beams[2] == [(1, "begin")]
        assert beams[3] == [(1, "end")]

    def test_three_eighths_in_compound_meter(self):
        """6/8 一拍 (dotted quarter) 內三個 8th — begin / continue / end."""
        events = [
            _n(60, Fraction(1, 2), Fraction(0)),
            _n(62, Fraction(1, 2), Fraction(1, 2)),
            _n(64, Fraction(1, 2), Fraction(1)),
        ]
        beams = _compute_beams(events, (6, 8))
        assert beams[0] == [(1, "begin")]
        assert beams[1] == [(1, "continue")]
        assert beams[2] == [(1, "end")]

    def test_rest_breaks_beam(self):
        """8th + rest + 8th — 不該連 (group 各只 1 個 → 全略過)."""
        events = [
            _n(60, Fraction(1, 2), Fraction(0)),
            _r(Fraction(1, 2), Fraction(1, 2)),
            _n(62, Fraction(1, 2), Fraction(1)),
        ]
        beams = _compute_beams(events, (4, 4))
        assert beams == {}  # 沒任何 group 達 2 個

    def test_quarter_breaks_beam(self):
        """8th + quarter + 8th — quarter (beam_count=0) 把 group 截開."""
        events = [
            _n(60, Fraction(1, 2), Fraction(0)),
            _n(62, Fraction(1), Fraction(1, 2)),     # quarter
            _n(64, Fraction(1, 2), Fraction(3, 2)),
        ]
        beams = _compute_beams(events, (4, 4))
        assert beams == {}

    def test_four_sixteenths_get_two_beams(self):
        """4/4 中一拍 4 個 16th — 每音 [(1, X), (2, X)]."""
        events = [
            _n(60, Fraction(1, 4), Fraction(0)),
            _n(62, Fraction(1, 4), Fraction(1, 4)),
            _n(64, Fraction(1, 4), Fraction(2, 4)),
            _n(65, Fraction(1, 4), Fraction(3, 4)),
        ]
        beams = _compute_beams(events, (4, 4))
        assert beams[0] == [(1, "begin"), (2, "begin")]
        assert beams[1] == [(1, "continue"), (2, "continue")]
        assert beams[2] == [(1, "continue"), (2, "continue")]
        assert beams[3] == [(1, "end"), (2, "end")]

    def test_mixed_eighth_and_sixteenth_run(self):
        """4/4 一拍: 8th + 2x16th — level 1 涵蓋三個, level 2 只連最後兩個."""
        events = [
            _n(60, Fraction(1, 2), Fraction(0)),     # 8th: count=1
            _n(62, Fraction(1, 4), Fraction(1, 2)),  # 16th: count=2
            _n(64, Fraction(1, 4), Fraction(3, 4)),  # 16th: count=2
        ]
        beams = _compute_beams(events, (4, 4))
        assert beams[0] == [(1, "begin")]  # 8th 沒 level 2
        # 中間 16th: level 1 continue, level 2 begin (左 8th 沒 level 2)
        assert (1, "continue") in beams[1]
        assert (2, "begin") in beams[1]
        # 結尾 16th: level 1 end, level 2 end
        assert (1, "end") in beams[2]
        assert (2, "end") in beams[2]

    def test_single_eighth_no_beam(self):
        """孤立 8th — group 才 1 個, 不輸出 beam."""
        events = [_n(60, Fraction(1, 2), Fraction(0)),
                  _n(62, Fraction(1), Fraction(1, 2))]  # quarter 截開
        beams = _compute_beams(events, (4, 4))
        assert beams == {}

    def test_empty_events(self):
        assert _compute_beams([], (4, 4)) == {}

    def test_no_time_sig_defaults_to_quarter(self):
        """time_sig=None → 預設 quarter 拍."""
        events = [
            _n(60, Fraction(1, 2), Fraction(0)),
            _n(62, Fraction(1, 2), Fraction(1, 2)),
        ]
        beams = _compute_beams(events, None)
        assert beams[0] == [(1, "begin")]
        assert beams[1] == [(1, "end")]


class TestBeamsInOutput:
    """測試 score → MusicXML 字串實際包含 <beam> 標記."""

    def test_xml_contains_beam_for_consecutive_eighths(self):
        from core.ir import Measure, Part, Score, Voice
        from core.ir_to_musicxml import score_to_musicxml

        events = [
            _n(60, Fraction(1, 2), Fraction(0)),
            _n(62, Fraction(1, 2), Fraction(1, 2)),
            _n(64, Fraction(1, 2), Fraction(1)),
            _n(65, Fraction(1, 2), Fraction(3, 2)),
        ]
        part = Part(
            part_id="violin_1", name_display="Violin", instrument_id="violin",
            measures=[Measure(
                number=1, time_signature=(2, 4),
                voices={1: Voice(voice_id=1, events=events)},
            )],
        )
        xml = score_to_musicxml(Score(metadata={}, movements=[], parts=[part]))
        assert "<beam number=\"1\">begin</beam>" in xml
        assert "<beam number=\"1\">end</beam>" in xml

    def test_xml_no_beam_for_quarter_notes(self):
        from core.ir import Measure, Part, Score, Voice
        from core.ir_to_musicxml import score_to_musicxml

        events = [
            _n(60, Fraction(1), Fraction(0)),
            _n(62, Fraction(1), Fraction(1)),
        ]
        part = Part(
            part_id="violin_1", name_display="Violin", instrument_id="violin",
            measures=[Measure(
                number=1, time_signature=(2, 4),
                voices={1: Voice(voice_id=1, events=events)},
            )],
        )
        xml = score_to_musicxml(Score(metadata={}, movements=[], parts=[part]))
        # quarter notes 不應有 beam
        assert "<beam" not in xml

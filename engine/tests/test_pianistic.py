"""Pianistic texture 引擎測試"""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.arrangement_model import Arrangement, Player
from core.ir import (
    ChordEvent, Measure, Movement, NoteEvent, Part, Pitch, Score, Voice,
)
from core.pianistic import apply_pianistic_texture


def _chord(midis: list[int], dur: float, onset: float = 0.0) -> ChordEvent:
    return ChordEvent(
        pitches=[Pitch(m, f"n{m}") for m in midis],
        duration=Fraction(dur),
        onset=Fraction(onset),
    )


def _piano_lower_arrangement(events: list) -> Arrangement:
    """建一個只有 piano_1_lower part 的 arrangement."""
    lower = Part(
        part_id="piano_1_lower",
        name_display="Piano (L.H.)",
        instrument_id="piano",
        measures=[Measure(
            number=1, time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=events)},
        )],
    )
    target = Score(metadata={}, movements=[], parts=[lower])
    return Arrangement(
        arrangement_id="t", name="t", source_id="s",
        players=[Player(
            player_id="piano_1", display_name="Piano",
            instruments=["piano"], primary_instrument="piano", staves=2,
        )],
        assignments=[],
        target_score=target,
    )


class TestPianisticTexture:
    def test_alberti_expands_block_chord(self):
        # 一個 4-beat C major 三和弦 → 阿爾貝蒂低音
        arr = _piano_lower_arrangement([_chord([48, 52, 55], dur=4.0)])
        res = apply_pianistic_texture(arr, "alberti")
        assert res.chords_expanded == 1
        assert res.notes_generated == 8  # 4 beats / 0.5 subdivision
        events = arr.target_score.parts[0].measures[0].voices[1].events
        assert all(isinstance(e, NoteEvent) for e in events)
        # 阿爾貝蒂圖樣: 低-高-中-高 → midi 48,55,52,55,48,55,52,55
        midis = [e.pitch.midi_number for e in events]
        assert midis == [48, 55, 52, 55, 48, 55, 52, 55]

    def test_broken_chord_pattern(self):
        arr = _piano_lower_arrangement([_chord([48, 52, 55], dur=2.0)])
        res = apply_pianistic_texture(arr, "broken")
        assert res.chords_expanded == 1
        midis = [
            e.pitch.midi_number
            for e in arr.target_score.parts[0].measures[0].voices[1].events
        ]
        # 分解: 低-中-高-中 → 48,52,55,52
        assert midis == [48, 52, 55, 52]

    def test_octave_tremolo(self):
        arr = _piano_lower_arrangement([_chord([48, 55], dur=2.0)])
        res = apply_pianistic_texture(arr, "octave_tremolo")
        assert res.chords_expanded == 1
        midis = [
            e.pitch.midi_number
            for e in arr.target_score.parts[0].measures[0].voices[1].events
        ]
        # 八度震音: 低音(48) 與 低音+12(60) 交替
        assert midis == [48, 60, 48, 60]

    def test_short_chord_not_expanded(self):
        # 時值 < half note (2.0) → 不展開
        arr = _piano_lower_arrangement([_chord([48, 52, 55], dur=1.0)])
        res = apply_pianistic_texture(arr, "alberti")
        assert res.chords_expanded == 0
        events = arr.target_score.parts[0].measures[0].voices[1].events
        assert len(events) == 1
        assert isinstance(events[0], ChordEvent)

    def test_note_events_untouched(self):
        # 單音 NoteEvent 不受影響
        note = NoteEvent(
            pitch=Pitch(48, "C3"), duration=Fraction(4), onset=Fraction(0),
        )
        arr = _piano_lower_arrangement([note])
        res = apply_pianistic_texture(arr, "alberti")
        assert res.chords_expanded == 0
        events = arr.target_score.parts[0].measures[0].voices[1].events
        assert len(events) == 1 and isinstance(events[0], NoteEvent)

    def test_onsets_are_sequential(self):
        arr = _piano_lower_arrangement([_chord([48, 52, 55], dur=4.0)])
        apply_pianistic_texture(arr, "alberti")
        events = arr.target_score.parts[0].measures[0].voices[1].events
        onsets = [e.onset for e in events]
        # 應為 0, 0.5, 1.0, ... 遞增
        assert onsets == [Fraction(i, 2) for i in range(8)]

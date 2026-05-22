"""簡化 (core/simplify.py) 測試"""

from __future__ import annotations

from fractions import Fraction

from core.ir import (
    ChordEvent, GraceNote, Measure, NoteEvent, Ornament, Pitch, RestEvent,
    Voice,
)
from core.simplify import simplify_part


def _p(midi: int) -> Pitch:
    return Pitch(midi_number=midi, spelling=f"n{midi}")


def _measures(events: list) -> list[Measure]:
    return [Measure(
        number=1, time_signature=(4, 4),
        voices={1: Voice(voice_id=1, events=events)},
    )]


class TestChordThinning:
    def test_four_note_chord_thinned_light(self):
        # light → 目標 3 音 (留三和弦)
        measures = _measures([ChordEvent(
            pitches=[_p(60), _p(64), _p(67), _p(72)],
            duration=Fraction(4), onset=Fraction(0),
        )])
        changed = simplify_part(measures, 1, 1, "light", "violin")
        assert changed == 1
        ev = measures[0].voices[1].events[0]
        assert isinstance(ev, ChordEvent)
        assert len(ev.pitches) == 3
        assert max(p.midi_number for p in ev.pitches) == 72  # 旋律保留

    def test_full_collapses_to_single_note(self):
        # full → 目標 1 音, 和弦退回 NoteEvent
        measures = _measures([ChordEvent(
            pitches=[_p(60), _p(64), _p(67), _p(72)],
            duration=Fraction(4), onset=Fraction(0),
        )])
        changed = simplify_part(measures, 1, 1, "full", "violin")
        assert changed == 1
        ev = measures[0].voices[1].events[0]
        assert isinstance(ev, NoteEvent)
        assert ev.pitch.midi_number == 72  # 旋律 (最高音) 保留

    def test_two_note_chord_untouched_at_light(self):
        # 雙音 (2) ≤ light 目標 (3) → 不動
        measures = _measures([ChordEvent(
            pitches=[_p(60), _p(72)],
            duration=Fraction(4), onset=Fraction(0),
        )])
        changed = simplify_part(measures, 1, 1, "light", "violin")
        assert changed == 0

    def test_melody_top_note_always_survives(self):
        # 旋律保護 — 任何 level 下最高音恆存
        for level in ("light", "medium", "full"):
            measures = _measures([ChordEvent(
                pitches=[_p(55), _p(59), _p(62), _p(79)],
                duration=Fraction(4), onset=Fraction(0),
            )])
            simplify_part(measures, 1, 1, level, "violin")
            ev = measures[0].voices[1].events[0]
            if isinstance(ev, ChordEvent):
                assert max(p.midi_number for p in ev.pitches) == 79
            else:
                assert ev.pitch.midi_number == 79


class TestDeOrnament:
    def test_ornament_cleared(self):
        measures = _measures([NoteEvent(
            pitch=_p(69), duration=Fraction(4), onset=Fraction(0),
            ornament=Ornament(kind="trill"),
        )])
        changed = simplify_part(measures, 1, 1, "medium", "violin")
        assert changed == 1
        assert measures[0].voices[1].events[0].ornament is None

    def test_grace_notes_cleared(self):
        measures = _measures([NoteEvent(
            pitch=_p(69), duration=Fraction(4), onset=Fraction(0),
            grace_before=[GraceNote(pitch=_p(71),
                                    grace_type="acciaccatura")],
        )])
        changed = simplify_part(measures, 1, 1, "medium", "violin")
        assert changed == 1
        assert measures[0].voices[1].events[0].grace_before == []


class TestArticulationSimplify:
    def test_demanding_stripped_ordinary_kept(self):
        measures = _measures([NoteEvent(
            pitch=_p(69), duration=Fraction(4), onset=Fraction(0),
            articulations=["spiccato", "staccato"],
        )])
        changed = simplify_part(measures, 1, 1, "medium", "violin")
        assert changed == 1
        arts = measures[0].voices[1].events[0].articulations
        assert "spiccato" not in arts   # 困難弓法剝除
        assert "staccato" in arts       # 一般演奏法保留


class TestOctaveFold:
    def test_above_comfortable_range_folded_in(self):
        # violin comfortable 上界 100; 104 收回低八度 = 92
        measures = _measures([NoteEvent(
            pitch=_p(104), duration=Fraction(4), onset=Fraction(0),
        )])
        changed = simplify_part(measures, 1, 1, "medium", "violin")
        assert changed == 1
        ev = measures[0].voices[1].events[0]
        assert ev.pitch.midi_number == 92
        assert ev.pitch.midi_number % 12 == 104 % 12  # 音級不變

    def test_in_range_note_untouched(self):
        measures = _measures([NoteEvent(
            pitch=_p(69), duration=Fraction(4), onset=Fraction(0),
        )])
        changed = simplify_part(measures, 1, 1, "medium", "violin")
        assert changed == 0


class TestGuards:
    def test_locked_event_untouched(self):
        measures = _measures([NoteEvent(
            pitch=_p(69), duration=Fraction(4), onset=Fraction(0),
            ornament=Ornament(kind="trill"), is_locked=True,
        )])
        changed = simplify_part(measures, 1, 1, "medium", "violin")
        assert changed == 0
        assert measures[0].voices[1].events[0].ornament is not None

    def test_rest_untouched(self):
        measures = _measures([RestEvent(
            duration=Fraction(4), onset=Fraction(0),
        )])
        changed = simplify_part(measures, 1, 1, "full", "violin")
        assert changed == 0

    def test_measure_out_of_range_skipped(self):
        measures = _measures([NoteEvent(
            pitch=_p(69), duration=Fraction(4), onset=Fraction(0),
            ornament=Ornament(kind="trill"),
        )])
        changed = simplify_part(measures, 2, 5, "medium", "violin")
        assert changed == 0


class TestLevelDepth:
    def test_light_keeps_triad_full_collapses(self):
        def big() -> list:
            return [ChordEvent(
                pitches=[_p(55), _p(59), _p(62), _p(67), _p(79)],
                duration=Fraction(4), onset=Fraction(0),
            )]

        m_light = _measures(big())
        simplify_part(m_light, 1, 1, "light", "violin")
        ev_light = m_light[0].voices[1].events[0]
        assert isinstance(ev_light, ChordEvent)
        assert len(ev_light.pitches) == 3

        m_full = _measures(big())
        simplify_part(m_full, 1, 1, "full", "violin")
        assert isinstance(m_full[0].voices[1].events[0], NoteEvent)

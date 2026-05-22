"""諧波豐富化 (core/enrich.py) 測試"""

from __future__ import annotations

from fractions import Fraction

from core.enrich import choose_density, enrich_part
from core.instruments.guitar import check_guitar_chord
from core.ir import (
    ChordEvent, Measure, NoteEvent, Part, Pitch, RestEvent, Score, Voice,
)


def _p(midi: int) -> Pitch:
    return Pitch(midi_number=midi, spelling=f"n{midi}")


def _src_with_chord(midis: list[int], dur: float = 4.0) -> Score:
    """建一個原始 score: 第 1 小節有一個涵蓋整小節的和弦。"""
    part = Part(
        part_id="strings", name_display="Strings", instrument_id="violin",
        measures=[Measure(
            number=1, time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=[ChordEvent(
                pitches=[_p(m) for m in midis],
                duration=Fraction(dur), onset=Fraction(0),
            )])},
        )],
    )
    return Score(metadata={}, movements=[], parts=[part])


def _guitar_measure(events: list) -> list[Measure]:
    return [Measure(
        number=1, time_signature=(4, 4),
        voices={1: Voice(voice_id=1, events=events)},
    )]


class TestEnrichPart:
    def test_melody_note_becomes_chord(self):
        # source: C major 三和弦; 吉他: 單音 C5
        src = _src_with_chord([48, 52, 55])  # C3 E3 G3 → 音級 {0,4,7}
        measures = _guitar_measure([
            NoteEvent(pitch=_p(72), duration=Fraction(4), onset=Fraction(0)),
        ])
        changed = enrich_part(measures, src, 1, 1, "full")
        assert changed == 1
        ev = measures[0].voices[1].events[0]
        assert isinstance(ev, ChordEvent)
        midis = sorted(p.midi_number for p in ev.pitches)
        # 旋律音 C5=72 保留, 且在和弦頂端
        assert max(midis) == 72
        assert 72 in midis
        # 補上的音級應來自 source 的 {4, 7} (E, G)
        assert {m % 12 for m in midis} <= {0, 4, 7}
        assert len(midis) >= 2

    def test_result_chord_is_guitar_playable(self):
        src = _src_with_chord([48, 52, 55])
        measures = _guitar_measure([
            NoteEvent(pitch=_p(67), duration=Fraction(4), onset=Fraction(0)),
        ])
        enrich_part(measures, src, 1, 1, "full")
        ev = measures[0].voices[1].events[0]
        assert isinstance(ev, ChordEvent)
        # enrich 已過可演奏性閘門 — 產出的和弦不該是 error
        assert check_guitar_chord(list(ev.pitches)).severity != "error"

    def test_bass_note_left_alone(self):
        # 低音域的音 (midi < 52) 視為低音聲部, 不加和弦
        src = _src_with_chord([48, 52, 55])
        measures = _guitar_measure([
            NoteEvent(pitch=_p(43), duration=Fraction(4), onset=Fraction(0)),
        ])
        changed = enrich_part(measures, src, 1, 1, "full")
        assert changed == 0
        assert isinstance(measures[0].voices[1].events[0], NoteEvent)

    def test_locked_note_untouched(self):
        src = _src_with_chord([48, 52, 55])
        measures = _guitar_measure([
            NoteEvent(
                pitch=_p(72), duration=Fraction(4), onset=Fraction(0),
                is_locked=True,
            ),
        ])
        changed = enrich_part(measures, src, 1, 1, "full")
        assert changed == 0
        assert isinstance(measures[0].voices[1].events[0], NoteEvent)

    def test_density_light_only_downbeat(self):
        # density=light → 只動第一拍的音
        src = _src_with_chord([48, 52, 55])
        measures = _guitar_measure([
            NoteEvent(pitch=_p(72), duration=Fraction(2), onset=Fraction(0)),
            NoteEvent(pitch=_p(74), duration=Fraction(2), onset=Fraction(2)),
        ])
        changed = enrich_part(measures, src, 1, 1, "light")
        assert changed == 1
        evs = measures[0].voices[1].events
        assert isinstance(evs[0], ChordEvent)   # 第一拍 → 和弦
        assert isinstance(evs[1], NoteEvent)    # 第三拍 → 不動

    def test_no_source_harmony_no_change(self):
        # source 在該時間點沒有任何音 → 不加和弦
        src_part = Part(
            part_id="s", name_display="S", instrument_id="violin",
            measures=[Measure(
                number=1, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    RestEvent(duration=Fraction(4), onset=Fraction(0)),
                ])},
            )],
        )
        src = Score(metadata={}, movements=[], parts=[src_part])
        measures = _guitar_measure([
            NoteEvent(pitch=_p(72), duration=Fraction(4), onset=Fraction(0)),
        ])
        changed = enrich_part(measures, src, 1, 1, "full")
        assert changed == 0
        assert isinstance(measures[0].voices[1].events[0], NoteEvent)

    def test_existing_chord_not_re_enriched(self):
        # 已是和弦的事件不重複加料
        src = _src_with_chord([48, 52, 55])
        measures = _guitar_measure([
            ChordEvent(
                pitches=[_p(60), _p(67)], duration=Fraction(4),
                onset=Fraction(0),
            ),
        ])
        changed = enrich_part(measures, src, 1, 1, "full")
        assert changed == 0


class TestTexture:
    """Phase B — 織體 (block / arpeggio / strum)"""

    def test_arpeggio_splits_into_notes(self):
        src = _src_with_chord([48, 52, 55])
        measures = _guitar_measure([
            NoteEvent(pitch=_p(72), duration=Fraction(4), onset=Fraction(0)),
        ])
        changed = enrich_part(measures, src, 1, 1, "full", "arpeggio")
        assert changed == 1
        evs = measures[0].voices[1].events
        # 拆成多個 NoteEvent (琶音)
        assert len(evs) >= 2
        assert all(isinstance(e, NoteEvent) for e in evs)
        # 第一個是旋律音 (最高), 落在原拍點
        assert evs[0].pitch.midi_number == 72
        assert evs[0].onset == Fraction(0)
        # 時值總和 == 原本; onset 遞增
        assert sum((e.duration for e in evs), Fraction(0)) == Fraction(4)
        assert [e.onset for e in evs] == sorted(e.onset for e in evs)

    def test_strum_adds_arpeggio_ornament(self):
        src = _src_with_chord([48, 52, 55])
        measures = _guitar_measure([
            NoteEvent(pitch=_p(72), duration=Fraction(4), onset=Fraction(0)),
        ])
        enrich_part(measures, src, 1, 1, "full", "strum")
        ev = measures[0].voices[1].events[0]
        assert isinstance(ev, ChordEvent)
        assert ev.ornament is not None
        assert ev.ornament.kind == "arpeggio_up"


class TestChooseDensity:
    """Phase C — 難度目標自動挑密度"""

    @staticmethod
    def _guitar_part(events: list) -> Part:
        return Part(
            part_id="guitar_1", name_display="Guitar",
            instrument_id="guitar", measures=_guitar_measure(events),
        )

    def test_returns_valid_density(self):
        src = _src_with_chord([48, 52, 55])
        part = self._guitar_part([
            NoteEvent(pitch=_p(72), duration=Fraction(4), onset=Fraction(0)),
        ])
        d = choose_density(part, src, 1, 1, 2.5, "block")
        assert d in ("light", "medium", "full")

    def test_high_target_falls_back_to_full(self):
        # 目標難度 5 — 單小節小譜湊不到 → 退回 full
        src = _src_with_chord([48, 52, 55])
        part = self._guitar_part([
            NoteEvent(pitch=_p(72), duration=Fraction(4), onset=Fraction(0)),
        ])
        assert choose_density(part, src, 1, 1, 5.0, "block") == "full"

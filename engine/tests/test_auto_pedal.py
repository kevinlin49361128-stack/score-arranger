"""0.1.56 L1 — 鋼琴自動 pedal 標記 (chord-change heuristic) 單元測試."""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.arrangement_model import Arrangement, Player
from core.ir import (
    ChordEvent, Measure, Movement, NoteEvent, Part, Pitch, Score, Voice,
)
from core.pianistic import _post_auto_pedal


def _note(midi: int, dur: float, onset: float) -> NoteEvent:
    return NoteEvent(
        pitch=Pitch(midi, f"n{midi}"),
        duration=Fraction(dur),
        onset=Fraction(onset),
    )


def _chord(midis: list[int], dur: float, onset: float) -> ChordEvent:
    return ChordEvent(
        pitches=[Pitch(m, f"n{m}") for m in midis],
        duration=Fraction(dur),
        onset=Fraction(onset),
    )


def _piano_arrangement(
    upper_events: list,
    lower_events: list,
    instrument_id: str = "piano",
) -> Arrangement:
    """建一個 piano upper + lower 的 arrangement (或 harpsichord)."""
    upper = Part(
        part_id="piano_1_upper" if instrument_id == "piano" else f"{instrument_id}_1_upper",
        name_display="Piano (R.H.)",
        instrument_id=instrument_id,
        measures=[Measure(
            number=1, time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=upper_events)},
        )],
    )
    lower = Part(
        part_id="piano_1_lower" if instrument_id == "piano" else f"{instrument_id}_1_lower",
        name_display="Piano (L.H.)",
        instrument_id=instrument_id,
        measures=[Measure(
            number=1, time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=lower_events)},
        )],
    )
    target = Score(metadata={}, movements=[], parts=[upper, lower])
    player_id = "piano_1" if instrument_id == "piano" else f"{instrument_id}_1"
    return Arrangement(
        arrangement_id="t", name="t", source_id="s",
        players=[Player(
            player_id=player_id, display_name="Piano",
            instruments=[instrument_id], primary_instrument=instrument_id,
            staves=2,
        )],
        assignments=[],
        target_score=target,
    )


class TestAutoPedal:
    def test_single_harmony_one_pedal_pair(self):
        """整段同和聲 (C major triad 維持) → 1 對 down/up (1 個 PedalMark span)."""
        # 全段都是 C-E-G 持續, 沒有和聲變化
        upper = [
            _note(72, 1, 0), _note(76, 1, 1),
            _note(79, 1, 2), _note(72, 1, 3),
        ]
        lower = [_chord([48, 52, 55], 4, 0)]
        arr = _piano_arrangement(upper, lower)
        n = _post_auto_pedal(arr)
        assert n == 1, "整段同和聲應只生成 1 個 PedalMark span (1 對 down/up)"
        assert len(arr.target_score.pedals) == 1
        mark = arr.target_score.pedals[0]
        assert mark.kind == "sustain"
        assert mark.part_id == "piano_1_lower"

    def test_four_harmony_changes_four_pairs(self):
        """4 個不同和聲 (I-IV-V-I 整段) → 4 對 down/up."""
        # 小節 1: C(0) → F(1) → G(2) → C(3) 每拍變
        upper_events = [_note(72, 1, i) for i in range(4)]
        lower_events = [
            _chord([48, 52, 55], 1, 0),  # C major (C-E-G)
            _chord([53, 57, 60], 1, 1),  # F major (F-A-C)
            _chord([55, 59, 62], 1, 2),  # G major (G-B-D)
            _chord([48, 52, 55], 1, 3),  # C major (回到 I)
        ]
        arr = _piano_arrangement(upper_events, lower_events)
        n = _post_auto_pedal(arr)
        assert n == 4, f"4 次和聲變化應生成 4 個 PedalMark span, got {n}"

    def test_harpsichord_skipped(self):
        """大鍵琴 sustain_type='decay' → 完全跳過, 不寫 pedal."""
        upper = [_note(72, 4, 0)]
        lower = [_chord([48, 52, 55], 4, 0)]
        arr = _piano_arrangement(upper, lower, instrument_id="harpsichord")
        n = _post_auto_pedal(arr, target_player_id="harpsichord_1")
        assert n == 0
        assert arr.target_score.pedals == []

    def test_empty_arrangement_returns_zero(self):
        """空 arrangement / 無 piano part → 不出錯, 回 0."""
        target = Score(metadata={}, movements=[], parts=[])
        arr = Arrangement(
            arrangement_id="t", name="t", source_id="s",
            players=[],
            target_score=target,
        )
        n = _post_auto_pedal(arr)
        assert n == 0

    def test_chopin_nocturne_produces_pedal_marks(self):
        """Chopin nocturne sample 跑 auto_pedal 應產生 ≥ 1 個 PedalMark.

        基本 sanity — 真實樂曲必有多個和聲變化點.
        """
        from music21 import converter
        from core.parser import parse_stream
        from core.arranger import arrange
        from core.arrangement_model import piano_solo_ensemble
        from core.samples import resolve

        # 用內建 sample_scores 的 Chopin nocturne (浪漫鋼琴小品代表)
        path = resolve("chopin/nocturne_op9_no2")
        if path is None:
            pytest.skip("chopin nocturne sample 不可用")
        try:
            m21 = converter.parse(str(path))
            score = parse_stream(m21)
        except Exception as e:
            pytest.skip(f"sample parse 失敗: {e}")
        arr = arrange(score, piano_solo_ensemble())
        n = _post_auto_pedal(arr)
        assert n > 0, "Chopin 浪漫鋼琴 sample 應產生至少 1 個 PedalMark"

    def test_repeated_call_replaces_old_marks(self):
        """連續呼叫 _post_auto_pedal → 第二次應覆寫前一次的 marks, 不累加."""
        upper = [_note(72, 4, 0)]
        lower = [_chord([48, 52, 55], 4, 0)]
        arr = _piano_arrangement(upper, lower)
        _post_auto_pedal(arr)
        first_count = len(arr.target_score.pedals)
        _post_auto_pedal(arr)
        second_count = len(arr.target_score.pedals)
        assert first_count == second_count, "重複呼叫應覆寫, 不累加"

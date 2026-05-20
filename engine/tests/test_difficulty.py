"""演奏難度評分 (difficulty.py) 的單元測試"""

from __future__ import annotations

from fractions import Fraction

from core.difficulty import (
    analyze_part_difficulty,
    analyze_score_difficulty,
    difficulty_to_dict,
)
from core.ir import (
    ChordEvent,
    Measure,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Voice,
)


def _make_simple_part(
    notes: list[tuple[int, str]],  # (midi, duration_fraction_pair)
    instrument: str = "violin",
    duration_default: Fraction = Fraction(1, 1),
) -> Part:
    """快速建構單一聲部、單一小節的 Part 用於測試。"""
    events = []
    onset = Fraction(0)
    for midi, pair in notes:
        dur = Fraction(*pair) if isinstance(pair, tuple) else duration_default
        events.append(
            NoteEvent(
                pitch=Pitch(midi, str(midi)),
                duration=dur,
                onset=onset,
            )
        )
        onset += dur
    voice = Voice(voice_id=1, events=events)
    measure = Measure(
        number=1,
        voices={1: voice},
        time_signature=(4, 4),
    )
    return Part(
        part_id="test",
        name_display="Test",
        instrument_id=instrument,
        measures=[measure],
    )


class TestDifficulty:
    def test_empty_part_zero_difficulty(self):
        part = Part(
            part_id="empty",
            name_display="Empty",
            instrument_id="violin",
            measures=[Measure(number=1, voices={}, time_signature=(4, 4))],
        )
        d = analyze_part_difficulty(part)
        assert d.note_count == 0
        assert d.chord_count == 0
        assert d.range_factor == 0.0
        # raw_score 0 → score = 1.0
        assert d.score_1_to_5 == 1.0

    def test_simple_in_range_low_difficulty(self):
        # 4 個全音符在 violin comfortable range → 低難度
        part = _make_simple_part(
            [(69, (1, 1)), (71, (1, 1)), (72, (1, 1)), (74, (1, 1))],
            instrument="violin",
        )
        d = analyze_part_difficulty(part)
        assert d.note_count == 4
        assert d.range_factor == 0.0  # 全部在 comfortable
        assert d.score_1_to_5 < 2.5
        assert d.label() in ("業餘初級", "業餘中級")

    def test_extreme_high_pitch_increases_difficulty(self):
        # E7 (MIDI 100) 接近 violin comfortable 上界, A7 (105) 在 professional
        part = _make_simple_part(
            [(100, (1, 4)), (102, (1, 4)), (104, (1, 4)), (105, (1, 4))],
            instrument="violin",
        )
        d = analyze_part_difficulty(part)
        # E7 (100) 在 comfortable 內(<=100), 102/104/105 在 prof 內但超出 comfortable
        assert d.range_factor > 0.0  # 至少幾個超出舒適區
        assert d.score_1_to_5 > 1.5

    def test_chord_increases_difficulty(self):
        chord_event_factory = lambda o: ChordEvent(
            pitches=[
                Pitch(60, "C4"), Pitch(64, "E4"),
                Pitch(67, "G4"), Pitch(72, "C5"),
            ],
            duration=Fraction(1, 1),
            onset=Fraction(o),
        )
        voice = Voice(
            voice_id=1,
            events=[chord_event_factory(i) for i in range(4)],
        )
        m = Measure(number=1, voices={1: voice}, time_signature=(4, 4))
        part = Part(part_id="t", name_display="t", instrument_id="violin", measures=[m])
        d = analyze_part_difficulty(part)
        assert d.chord_count == 4
        assert d.chord_factor == 1.0
        assert d.score_1_to_5 > 1.8

    def test_short_notes_increase_rhythm_factor(self):
        # 32 分音符 = Fraction(1,8) < SHORT_DURATION (1/2)
        part = _make_simple_part(
            [(60, (1, 8))] * 16,  # 16 個 32nd 音符
            instrument="violin",
        )
        d = analyze_part_difficulty(part)
        assert d.rhythm_factor == 1.0

    def test_flute_chord_makes_chord_factor_high(self):
        # 單音樂器若譜上有 chord 就硬拉到極高
        chord_event = ChordEvent(
            pitches=[Pitch(72, "C5"), Pitch(76, "E5")],
            duration=Fraction(1, 1),
            onset=Fraction(0),
        )
        voice = Voice(voice_id=1, events=[chord_event])
        m = Measure(number=1, voices={1: voice}, time_signature=(4, 4))
        part = Part(part_id="t", name_display="t", instrument_id="flute", measures=[m])
        d = analyze_part_difficulty(part)
        # flute max_simultaneous_notes == 1 → chord_factor 強制 ≥ 0.9
        assert d.chord_factor >= 0.9

    def test_difficulty_to_dict_keys(self):
        part = _make_simple_part([(60, (1, 1))], instrument="violin")
        d = analyze_part_difficulty(part)
        out = difficulty_to_dict(d)
        assert set(out.keys()) >= {
            "part_id", "instrument_id", "score", "label",
            "factors", "raw_score", "note_count", "chord_count",
        }
        assert set(out["factors"].keys()) == {
            "range", "density", "chord", "rhythm",
        }

    def test_score_difficulty_returns_per_part(self):
        p1 = _make_simple_part([(69, (1, 1))], instrument="violin")
        p1.part_id = "p1"
        p2 = _make_simple_part([(60, (1, 1))], instrument="piano")
        p2.part_id = "p2"
        score = Score(parts=[p1, p2])
        result = analyze_score_difficulty(score)
        assert set(result.keys()) == {"p1", "p2"}


class TestDifficultyLabels:
    def test_label_thresholds(self):
        from core.difficulty import PartDifficulty
        cases = [
            (1.0, "業餘初級"),
            (2.0, "業餘中級"),
            (3.0, "業餘進階"),
            (4.0, "半專業"),
            (4.8, "職業"),
        ]
        for score, expected in cases:
            d = PartDifficulty(
                part_id="t", instrument_id="violin",
                score_1_to_5=score,
                range_factor=0, density_factor=0,
                chord_factor=0, rhythm_factor=0,
                raw_score=0, note_count=0, chord_count=0,
            )
            assert d.label() == expected, (
                f"score={score} expected {expected}, got {d.label()}"
            )

"""B2: 慣用音型 (figuration.apply_figuration) 測試 — 保守: 只長塊狀和弦。"""
from fractions import Fraction

from core.arrangement_model import violin_piano_ensemble
from core.arranger import arrange
from core.figuration import apply_figuration
from core.ir import ChordEvent, Measure, NoteEvent, Part, Pitch, Score, Voice
from core.parser import parse_musicxml


def _chord(midis, onset, ql):
    return ChordEvent(
        pitches=[Pitch(midi_number=m, spelling="X") for m in midis],
        duration=Fraction(ql), onset=Fraction(onset),
    )


def _violin_score(chord):
    m = Measure(number=1, voices={1: Voice(1, [chord])}, time_signature=(4, 4))
    return Score(parts=[Part("violin_1", "Violin", "violin", [m])])


def test_long_block_chord_broken_into_arpeggio():
    score = _violin_score(_chord([60, 64, 67], 0, 4))  # 全音符三音和弦
    n = apply_figuration(score)
    assert n == 1
    evs = score.parts[0].measures[0].voices[1].events
    assert all(isinstance(e, NoteEvent) for e in evs)  # 全變單音
    assert len(evs) == 8  # 4.0 / 0.5
    # 總時值保留
    assert sum((e.duration for e in evs), Fraction(0)) == Fraction(4)
    # 第一段上行 = 排序後的和弦音
    assert [e.pitch.midi_number for e in evs[:3]] == [60, 64, 67]
    assert len({e.slur_group for e in evs}) == 1  # 整段連弓


def test_short_chord_untouched():
    score = _violin_score(_chord([60, 64, 67], 0, 1))  # 四分音符 < 二分
    assert apply_figuration(score) == 0
    assert isinstance(score.parts[0].measures[0].voices[1].events[0], ChordEvent)


def test_piano_untouched():
    m = Measure(number=1, voices={1: Voice(1, [_chord([60, 64, 67], 0, 4)])},
                time_signature=(4, 4))
    score = Score(parts=[Part("piano_1", "Piano", "piano", [m])])
    assert apply_figuration(score) == 0


def test_e2e_no_crash_on_real_arrangement():
    score = parse_musicxml("core/sample_scores/corelli_opus3no1_1grave.musicxml")
    arr = arrange(score, violin_piano_ensemble())
    n = apply_figuration(arr.target_score)
    assert n >= 0

"""B3: 建議弓法 / 圓滑線 (bowing.apply_bowing) 測試。"""
from fractions import Fraction

from core.arrangement_model import violin_piano_ensemble
from core.arranger import arrange
from core.bowing import apply_bowing
from core.ir import Measure, NoteEvent, Part, Pitch, Score, Voice
from core.parser import parse_musicxml


def _eighth(midi, onset):
    return NoteEvent(pitch=Pitch(midi_number=midi, spelling="X"),
                     duration=Fraction(1, 2), onset=Fraction(onset))


def _violin_run_score():
    # 一小節: C-D-E-F 八分音符級進 (應連弓 + 首音下弓)
    evs = [_eighth(60, 0), _eighth(62, "1/2"), _eighth(64, 1), _eighth(65, "3/2")]
    m = Measure(number=1, voices={1: Voice(1, evs)}, time_signature=(4, 4))
    return Score(parts=[Part("violin_1", "Violin", "violin", [m])])


def test_bow_down_on_measure_start():
    score = _violin_run_score()
    apply_bowing(score)
    first = score.parts[0].measures[0].voices[1].events[0]
    assert first.technique is not None
    assert first.technique.bow_direction == "down"


def test_slur_on_stepwise_run():
    score = _violin_run_score()
    apply_bowing(score)
    evs = score.parts[0].measures[0].voices[1].events
    groups = {e.slur_group for e in evs}
    assert len(groups) == 1 and None not in groups  # 四音同一條圓滑線


def test_piano_untouched():
    m = Measure(number=1, voices={1: Voice(1, [_eighth(60, 0)])},
                time_signature=(4, 4))
    score = Score(parts=[Part("piano_1", "Piano", "piano", [m])])
    assert apply_bowing(score) == 0


def test_e2e_on_real_arrangement():
    score = parse_musicxml("core/sample_scores/mozart_k545_movement1_full.musicxml")
    arr = arrange(score, violin_piano_ensemble())
    changes = apply_bowing(arr.target_score)
    assert changes > 0

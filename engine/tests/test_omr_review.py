"""omr_review (③ 後校正複檢層) 單元測試。"""
from fractions import Fraction

from core.ir import (
    ChordEvent,
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Section,
    Voice,
)
from core.omr_review import SuspiciousNote, find_suspicious_notes


def _make_score(melody_m2_midis: list[int]) -> Score:
    """2 小節 C 大調 I 和弦 (錨定調性) + 一條旋律聲部; M2 旋律可注入錯音。"""
    def cmaj_chord():
        return ChordEvent(
            pitches=[Pitch(48, "C3"), Pitch(60, "C4"),
                     Pitch(64, "E4"), Pitch(67, "G4")],
            duration=Fraction(4), onset=Fraction(0),
        )

    def melody(midis):
        return Voice(voice_id=2, events=[
            NoteEvent(pitch=Pitch(m, "x"), duration=Fraction(1),
                      onset=Fraction(j))
            for j, m in enumerate(midis)
        ])

    return Score(
        movements=[Movement(movement_id=1, measure_count=2,
                            sections=[Section(0, 1, 2)])],
        parts=[Part(
            part_id="piano_1", name_display="Piano", instrument_id="piano",
            measures=[
                Measure(number=1, time_signature=(4, 4),
                        key_signature="C major",
                        voices={1: Voice(voice_id=1, events=[cmaj_chord()]),
                                2: melody([72, 76, 79, 76])}),
                Measure(number=2,
                        voices={1: Voice(voice_id=1, events=[cmaj_chord()]),
                                2: melody(melody_m2_midis)}),
            ],
        )],
    )


def test_flags_obvious_wrong_note_with_fix():
    # M2 旋律: C5, C#5(錯, 應為 C5), E5, G5 — C#5 在 C 大調 I 上是自由非和弦音
    score = _make_score([72, 73, 76, 79])
    susp = find_suspicious_notes(score)
    assert all(isinstance(s, SuspiciousNote) for s in susp)
    hit = [s for s in susp if s.measure_number == 2 and s.midi == 73]
    assert hit, f"C#5 應被標可疑, got {[(s.measure_number, s.midi) for s in susp]}"
    s = hit[0]
    assert s.suggested_midi == 72          # 半音之下即和弦音 C
    assert s.confidence >= 0.7             # ±1 命中 → 高信心
    assert s.part_id == "piano_1" and s.voice_id == 2


def test_clean_chord_tones_not_flagged():
    # M2 全是 C 大調和弦音 → 不該把這些標成可疑
    score = _make_score([72, 76, 79, 76])
    susp = find_suspicious_notes(score)
    assert not [s for s in susp if s.measure_number == 2], \
        f"乾淨和弦音不應被標, got {[(s.measure_number, s.midi) for s in susp]}"


def test_never_mutates_score():
    score = _make_score([72, 73, 76, 79])
    before = score.parts[0].measures[1].voices[2].events[1].pitch.midi_number
    find_suspicious_notes(score)
    after = score.parts[0].measures[1].voices[2].events[1].pitch.midi_number
    assert before == after == 73  # 只標記, 絕不改譜

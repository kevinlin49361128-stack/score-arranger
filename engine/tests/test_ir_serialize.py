"""序列化 round-trip 測試 — 規格 §7 的關鍵驗證。"""

from __future__ import annotations

import json
from fractions import Fraction

from core.ir import (
    ChordEvent,
    DynamicHairpin,
    Measure,
    Movement,
    NoteEvent,
    Ornament,
    Part,
    Phrase,
    Pitch,
    RepeatStructure,
    RestEvent,
    Score,
    Section,
    Tuplet,
    Voice,
    VoiceFunction,
)
from core.ir_serialize import from_dict, from_json, to_dict, to_json


# ============================================================================
# Fraction encoding
# ============================================================================

def test_fraction_encoding():
    d = to_dict(Fraction(3, 8))
    assert d == "3/8"


def test_integer_fraction_encoding():
    d = to_dict(Fraction(2))
    assert d == "2"


def test_fraction_decoding():
    from core.ir_serialize import _str_to_fraction
    assert _str_to_fraction("3/8") == Fraction(3, 8)
    assert _str_to_fraction("2") == Fraction(2)


# ============================================================================
# Round-trip: 單一物件
# ============================================================================

def test_pitch_roundtrip():
    p = Pitch(midi_number=60, spelling="C4")
    d = to_dict(p)
    assert d == {"__type__": "Pitch", "midi_number": 60, "spelling": "C4",
                 "written_midi": None, "written_spelling": None}
    restored = from_dict(d)
    assert restored == p


def test_pitch_with_transposition_roundtrip():
    p = Pitch(midi_number=53, spelling="F3", written_midi=60, written_spelling="C4")
    restored = from_dict(to_dict(p))
    assert restored == p
    assert restored.written_midi == 60


def test_note_event_roundtrip():
    n = NoteEvent(
        pitch=Pitch(60, "C4"),
        duration=Fraction(1, 2),
        onset=Fraction(0),
        articulations=["staccato", "accent"],
        dynamic="ff",
    )
    restored = from_dict(to_dict(n))
    assert restored.pitch.midi_number == 60
    assert restored.duration == Fraction(1, 2)
    assert restored.articulations == ["staccato", "accent"]
    assert restored.dynamic == "ff"


def test_chord_event_roundtrip():
    c = ChordEvent(
        pitches=[Pitch(60, "C4"), Pitch(64, "E4"), Pitch(67, "G4")],
        duration=Fraction(1),
        onset=Fraction(0),
    )
    restored = from_dict(to_dict(c))
    assert len(restored.pitches) == 3
    assert restored.pitches[0].midi_number == 60


def test_tuplet_roundtrip():
    t = Tuplet(actual=3, normal=2, bracket_id=5)
    restored = from_dict(to_dict(t))
    assert restored == t


def test_ornament_roundtrip():
    o = Ornament(
        kind="trill",
        upper_aux=Pitch(62, "D4"),
    )
    restored = from_dict(to_dict(o))
    assert restored.kind == "trill"
    assert restored.upper_aux.midi_number == 62


# ============================================================================
# Round-trip: Voice / Measure (含 enum, tuple, dict)
# ============================================================================

def test_measure_with_voices_roundtrip():
    m = Measure(
        number=5,
        time_signature=(3, 4),
        key_signature="D major",
        tempo_bpm=120.0,
        rehearsal_mark="A",
        voices={
            1: Voice(voice_id=1, events=[
                NoteEvent(pitch=Pitch(62, "D4"), duration=Fraction(1), onset=Fraction(0)),
                NoteEvent(pitch=Pitch(66, "F#4"), duration=Fraction(1), onset=Fraction(1)),
                RestEvent(duration=Fraction(1), onset=Fraction(2)),
            ]),
        },
    )
    restored = from_dict(to_dict(m))
    assert restored.number == 5
    assert restored.time_signature == (3, 4)
    assert restored.key_signature == "D major"
    assert restored.rehearsal_mark == "A"
    assert len(restored.voices) == 1
    assert len(restored.voices[1].events) == 3


def test_divisi_voice_roundtrip():
    v = Voice(
        voice_id=1,
        is_divisi=True,
        divisi_branches=[
            Voice(voice_id=11, events=[
                NoteEvent(pitch=Pitch(72, "C5"), duration=Fraction(1), onset=Fraction(0))
            ]),
            Voice(voice_id=12, events=[
                NoteEvent(pitch=Pitch(64, "E4"), duration=Fraction(1), onset=Fraction(0))
            ]),
        ],
    )
    restored = from_dict(to_dict(v))
    assert restored.is_divisi
    assert len(restored.divisi_branches) == 2
    assert restored.divisi_branches[0].events[0].pitch.midi_number == 72


# ============================================================================
# Round-trip: Section / Phrase (Phrase 含 tuple[int, Fraction])
# ============================================================================

def test_phrase_roundtrip():
    p = Phrase(
        phrase_id=3,
        start=(1, Fraction(0)),
        end=(8, Fraction(7, 2)),
        detection_confidence=0.85,
        is_user_edited=True,
    )
    restored = from_dict(to_dict(p))
    assert restored.phrase_id == 3
    assert restored.start == (1, Fraction(0))
    assert restored.end == (8, Fraction(7, 2))
    assert restored.is_user_edited


def test_section_with_phrases_roundtrip():
    s = Section(
        section_id=0,
        name="呈示部",
        start_measure=1,
        end_measure=24,
        phrases=[
            Phrase(phrase_id=0, start=(1, Fraction(0)), end=(8, Fraction(0))),
            Phrase(phrase_id=1, start=(9, Fraction(0)), end=(16, Fraction(0))),
        ],
    )
    restored = from_dict(to_dict(s))
    assert restored.name == "呈示部"
    assert len(restored.phrases) == 2


# ============================================================================
# Round-trip: Part with function_tags (dict[int, Enum])
# ============================================================================

def test_part_with_function_tags():
    p = Part(
        part_id="violin_1",
        name_display="Violin I",
        instrument_id="violin",
        function_tags={
            0: VoiceFunction.MELODY,
            1: VoiceFunction.COUNTERMELODY,
        },
    )
    restored = from_dict(to_dict(p))
    assert restored.part_id == "violin_1"
    assert restored.function_tags[0] == VoiceFunction.MELODY
    assert restored.function_tags[1] == VoiceFunction.COUNTERMELODY


# ============================================================================
# Round-trip: 全域元素
# ============================================================================

def test_hairpin_roundtrip():
    h = DynamicHairpin(
        hairpin_id=0,
        start=(1, Fraction(0)),
        end=(4, Fraction(0)),
        kind="crescendo",
        start_dynamic="p",
        end_dynamic="f",
    )
    restored = from_dict(to_dict(h))
    assert restored.kind == "crescendo"
    assert restored.start == (1, Fraction(0))


def test_repeat_roundtrip():
    r = RepeatStructure(
        repeat_id=0,
        kind="volta",
        span=(3, 4),
        volta_number=1,
    )
    restored = from_dict(to_dict(r))
    assert restored.kind == "volta"
    assert restored.volta_number == 1


# ============================================================================
# Round-trip: 整個 Score (含 JSON 字串階段)
# ============================================================================

def _build_complete_score() -> Score:
    return Score(
        metadata={"title": "Test", "composer": "Anon"},
        movements=[Movement(
            movement_id=1,
            title="I. Allegro",
            measure_count=2,
            sections=[Section(
                section_id=0,
                start_measure=1,
                end_measure=2,
                phrases=[Phrase(
                    phrase_id=0,
                    start=(1, Fraction(0)),
                    end=(2, Fraction(4)),
                    detection_confidence=0.8,
                )],
            )],
        )],
        parts=[Part(
            part_id="violin_1",
            name_display="Violin",
            instrument_id="violin",
            measures=[
                Measure(
                    number=1,
                    time_signature=(4, 4),
                    voices={1: Voice(voice_id=1, events=[
                        NoteEvent(
                            pitch=Pitch(72, "C5"),
                            duration=Fraction(1),
                            onset=Fraction(0),
                            tuplet=Tuplet(actual=3, normal=2, bracket_id=0),
                        ),
                    ])},
                ),
                Measure(
                    number=2,
                    voices={1: Voice(voice_id=1, events=[
                        ChordEvent(
                            pitches=[Pitch(60, "C4"), Pitch(64, "E4")],
                            duration=Fraction(4),
                            onset=Fraction(0),
                        ),
                    ])},
                ),
            ],
            function_tags={0: VoiceFunction.MELODY},
        )],
        hairpins=[DynamicHairpin(
            hairpin_id=0,
            start=(1, Fraction(0)),
            end=(2, Fraction(0)),
            kind="crescendo",
        )],
        repeats=[RepeatStructure(repeat_id=0, kind="simple_repeat", span=(1, 2))],
    )


def test_full_score_dict_roundtrip():
    original = _build_complete_score()
    d = to_dict(original)
    restored = from_dict(d)

    assert restored.metadata == original.metadata
    assert len(restored.movements) == 1
    assert restored.movements[0].title == "I. Allegro"
    assert len(restored.parts) == 1
    assert restored.parts[0].function_tags[0] == VoiceFunction.MELODY
    assert len(restored.parts[0].measures) == 2
    # 三連音
    note = restored.parts[0].measures[0].voices[1].events[0]
    assert note.tuplet.actual == 3
    # 和弦
    chord = restored.parts[0].measures[1].voices[1].events[0]
    assert len(chord.pitches) == 2


def test_full_score_json_roundtrip():
    """關鍵測試: 經過 JSON 字串階段後資料完整"""
    original = _build_complete_score()
    json_str = to_json(original)

    # 確認真的是合法 JSON
    parsed = json.loads(json_str)
    assert parsed["__type__"] == "Score"

    restored = from_json(json_str)
    assert restored.metadata == original.metadata
    assert restored.parts[0].measures[0].voices[1].events[0].duration == Fraction(1)


def test_json_is_human_readable():
    """JSON 輸出應為人類可讀 (繁體中文不轉 \\u 編碼)"""
    score = Score(metadata={"title": "貝多芬第五"})
    json_str = to_json(score, indent=2)
    assert "貝多芬第五" in json_str  # 不被轉成 \uXXXX

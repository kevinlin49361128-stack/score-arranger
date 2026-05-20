"""
大提琴 (Violoncello) profile + 和弦可行性檢查

大提琴比中提琴再低八度。
- 四弦 (低到高): C2, G2, D3, A3
- 譜記用低音譜號為主, 高把位轉次中音譜號 / 高音譜號
- 因為琴頸長, 高把位伸展比小/中提琴更困難 (semitones 倍率更大)
"""

from __future__ import annotations

from core.ir import Pitch

from .base import (
    CheckResult,
    InstrumentProfile,
    StringDef,
    SuggestionStub,
    check_pitch_in_range,
)


CELLO_PROFILE = InstrumentProfile(
    instrument_id="cello",
    display_name="Violoncello",
    family="string_bowed",

    # C2 (MIDI 36) — A5 (含高把位)
    range_absolute=(36, 81),       # C2 — A5
    range_comfortable=(36, 69),    # C2 — A4
    range_professional=(36, 77),   # C2 — F5

    max_simultaneous_notes=4,

    strings=[
        StringDef(open_pitch=Pitch(36, "C2"), index=0),
        StringDef(open_pitch=Pitch(43, "G2"), index=1),
        StringDef(open_pitch=Pitch(50, "D3"), index=2),
        StringDef(open_pitch=Pitch(57, "A3"), index=3),
    ],
    # 大提琴琴頸較長, 伸展對應的半音數比 violin 緊
    max_stretch_semitones=5,
    comfortable_stretch_semitones=3,

    available_techniques=[
        "arco", "pizz", "tremolo", "harmonic",
        "spiccato", "staccato", "legato",
        "double_stop", "triple_stop", "quadruple_stop",
        "thumb_position",  # 大提琴特有: 拇指把位
    ],
    sustain_type="bow",
    transposition=0,
)


def check_cello_chord(chord_pitches: list[Pitch]) -> CheckResult:
    """大提琴和弦檢查 — 邏輯同小/中提琴, 但伸展閾值較緊。"""
    profile = CELLO_PROFILE
    assert profile.strings is not None
    strings = profile.strings

    if len(chord_pitches) == 0:
        return CheckResult(severity="ok")
    if len(chord_pitches) == 1:
        return check_pitch_in_range(chord_pitches[0], profile)
    if len(chord_pitches) > len(strings):
        return CheckResult(
            severity="error",
            code="E_STRING_CHORD_EXCEED",
            params={"instrument": "cello", "chord_size": len(chord_pitches),
                    "max": len(strings)},
            suggestions=[
                SuggestionStub(code="S_OMIT_NOTE"),
                SuggestionStub(code="S_ARPEGGIATE"),
            ],
        )

    sorted_chord = sorted(chord_pitches, key=lambda p: p.midi_number)
    assignments: list[tuple[int, int, Pitch]] = []
    for note, string in zip(sorted_chord, strings):
        if note.midi_number < string.open_pitch.midi_number:
            return CheckResult(
                severity="error",
                code="E_NOTE_BELOW_STRING",
                params={"instrument": "cello", "note": note.spelling,
                        "string": string.open_pitch.spelling},
                suggestions=[SuggestionStub(code="S_OCTAVE_UP")],
            )
        fret = note.midi_number - string.open_pitch.midi_number
        if fret > 24:
            return CheckResult(
                severity="error",
                code="E_CELLO_FRET_TOO_HIGH",
                params={"note": note.spelling, "fret": fret},
            )
        assignments.append((string.index, fret, note))

    used = [a[0] for a in assignments]
    for i in range(len(used) - 1):
        if used[i + 1] - used[i] > 1:
            return CheckResult(
                severity="error",
                code="E_NON_ADJACENT_STRINGS",
                params={"instrument": "cello"},
                suggestions=[SuggestionStub(code="S_REVOICE_CHORD")],
            )

    frets = [a[1] for a in assignments if a[1] > 0]
    if len(frets) >= 2:
        stretch = max(frets) - min(frets)
        if stretch > profile.max_stretch_semitones:
            return CheckResult(
                severity="error",
                code="E_CELLO_STRETCH_EXCEED",
                params={"stretch": stretch, "max": profile.max_stretch_semitones},
            )
        if stretch > profile.comfortable_stretch_semitones:
            return CheckResult(
                severity="warning",
                code="W_CELLO_STRETCH_LARGE",
                params={"stretch": stretch},
                difficulty_score=stretch / profile.max_stretch_semitones,
            )

    if len(chord_pitches) >= 3:
        return CheckResult(
            severity="warning",
            code="W_CELLO_TRIPLE_QUAD_STOP",
            params={"chord_size": len(chord_pitches)},
            difficulty_score=0.4 + (len(chord_pitches) - 3) * 0.2,
        )

    avg_fret = sum(a[1] for a in assignments) / max(len(assignments), 1)
    return CheckResult(severity="ok", difficulty_score=min(avg_fret / 12.0, 1.0))

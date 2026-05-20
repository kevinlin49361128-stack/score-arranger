"""
中提琴 (Viola) profile + 和弦可行性檢查

中提琴比小提琴低完全五度, 用中音譜號 (alto clef)。
- 四弦 (低到高): C3, G3, D4, A4 (比小提琴各弦低 5 度)
- 演奏技巧與小提琴大致相同, 但音色偏暗、響應較慢, 弓法略需更多重量
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


VIOLA_PROFILE = InstrumentProfile(
    instrument_id="viola",
    display_name="Viola",
    family="string_bowed",

    # C3 (MIDI 48) — E6 ~ A6 高把位
    range_absolute=(48, 93),       # C3 — A6
    range_comfortable=(48, 84),    # C3 — C6
    range_professional=(48, 91),   # C3 — G6

    max_simultaneous_notes=4,

    strings=[
        StringDef(open_pitch=Pitch(48, "C3"), index=0),
        StringDef(open_pitch=Pitch(55, "G3"), index=1),
        StringDef(open_pitch=Pitch(62, "D4"), index=2),
        StringDef(open_pitch=Pitch(69, "A4"), index=3),
    ],
    max_stretch_semitones=6,
    comfortable_stretch_semitones=4,

    available_techniques=[
        "arco", "pizz", "tremolo", "harmonic",
        "spiccato", "staccato", "legato",
        "double_stop", "triple_stop", "quadruple_stop",
    ],
    sustain_type="bow",
    transposition=0,
)


def check_viola_chord(chord_pitches: list[Pitch]) -> CheckResult:
    """中提琴和弦檢查 — 邏輯同小提琴, 用 VIOLA_PROFILE 的弦。"""
    profile = VIOLA_PROFILE
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
            params={"instrument": "viola", "chord_size": len(chord_pitches),
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
                params={"instrument": "viola", "note": note.spelling,
                        "string": string.open_pitch.spelling},
                suggestions=[SuggestionStub(code="S_OCTAVE_UP")],
            )
        fret = note.midi_number - string.open_pitch.midi_number
        if fret > 24:
            return CheckResult(
                severity="error",
                code="E_VIOLA_FRET_TOO_HIGH",
                params={"note": note.spelling, "fret": fret},
            )
        assignments.append((string.index, fret, note))

    used = [a[0] for a in assignments]
    for i in range(len(used) - 1):
        if used[i + 1] - used[i] > 1:
            return CheckResult(
                severity="error",
                code="E_NON_ADJACENT_STRINGS",
                params={"instrument": "viola"},
                suggestions=[SuggestionStub(code="S_REVOICE_CHORD")],
            )

    frets = [a[1] for a in assignments if a[1] > 0]
    if len(frets) >= 2:
        stretch = max(frets) - min(frets)
        if stretch > profile.max_stretch_semitones:
            return CheckResult(
                severity="error",
                code="E_VIOLA_STRETCH_EXCEED",
                params={"stretch": stretch, "max": profile.max_stretch_semitones},
            )
        if stretch > profile.comfortable_stretch_semitones:
            return CheckResult(
                severity="warning",
                code="W_VIOLA_STRETCH_LARGE",
                params={"stretch": stretch},
                difficulty_score=stretch / profile.max_stretch_semitones,
            )

    if len(chord_pitches) >= 3:
        return CheckResult(
            severity="warning",
            code="W_VIOLA_TRIPLE_QUAD_STOP",
            params={"chord_size": len(chord_pitches)},
            difficulty_score=0.35 + (len(chord_pitches) - 3) * 0.2,
        )

    avg_fret = sum(a[1] for a in assignments) / max(len(assignments), 1)
    return CheckResult(severity="ok", difficulty_score=min(avg_fret / 12.0, 1.0))

"""
低音大提琴 (Double Bass / Contrabass) profile + 和弦可行性檢查

低音大提琴是弦樂家族中音域最低的成員, 也是管弦樂與爵士樂常見低音支柱。
- 標準四弦, 五度 (E1, A1, D2, G2). 跟其他擦弦樂器 (4 度) 不同 — 為了把巨大琴頸
  的伸展壓在可彈範圍.
- 五弦版本 (低弦 B0) 在管弦樂與某些 jazz 圈使用, 此處先建模標準四弦.
- 移調樂器: 譜記比實音高八度 (e.g. 寫 G2 實際發 G1). transposition = -12
  (與 guitar 同語意: 譜記音 → 實音 偏移 -12 半音).
- 業餘級採 1-3 把位友善上限 D3 (50).
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


# 一般指板可用把位 (相對於空弦) 對應到的 fret 半音上限. 琴頸長, 高把位手指需用
# 拇指, 跟大提琴 thumb position 同概念但更難.
DOUBLE_BASS_MAX_FRET: int = 24


DOUBLE_BASS_PROFILE = InstrumentProfile(
    instrument_id="double_bass",
    display_name="Double Bass",
    family="string_bowed",

    # 音域以實音 (sounding) 為準. E1 (28) — C4 (60) 含拇指把位.
    range_absolute=(28, 60),         # E1 — C4
    range_comfortable=(28, 55),      # E1 — G3
    range_professional=(28, 60),     # E1 — C4
    range_amateur=(28, 50),          # E1 — D3 (1-3 把位友善)

    # 大部分時段業餘只玩雙弦 (double stop), 偶有 chord 是進階技巧.
    max_simultaneous_notes=2,

    strings=[
        StringDef(open_pitch=Pitch(28, "E1"), index=0),
        StringDef(open_pitch=Pitch(33, "A1"), index=1),
        StringDef(open_pitch=Pitch(38, "D2"), index=2),
        StringDef(open_pitch=Pitch(43, "G2"), index=3),
    ],
    # 琴頸極長, 同把位伸展對應的半音數比 cello 還緊.
    max_stretch_semitones=4,
    comfortable_stretch_semitones=2,

    available_techniques=[
        "arco", "pizz", "slap", "col_legno",
        "tremolo", "harmonic", "spiccato", "staccato", "legato",
    ],
    sustain_type="bow",
    # 譜記比實音高八度 (寫 G2 實際發 G1) → 譜記音轉實音為 -12 半音
    transposition=-12,
)


# ============================================================================
# 低音大提琴和弦可行性檢查
# ============================================================================

def check_double_bass_chord(chord_pitches: list[Pitch]) -> CheckResult:
    """低音大提琴和弦檢查 — 與大提琴邏輯類似但更緊:
    - 預設僅允許 double stop (max_simultaneous_notes=2), 三/四音直接 error.
    - 弦調為 5 度而非 4 度, 仍要求相鄰弦.
    - 伸展閾值更窄 (琴頸長).
    """
    profile = DOUBLE_BASS_PROFILE
    assert profile.strings is not None
    strings = profile.strings

    if len(chord_pitches) == 0:
        return CheckResult(severity="ok")
    if len(chord_pitches) == 1:
        return check_pitch_in_range(chord_pitches[0], profile)
    if len(chord_pitches) > profile.max_simultaneous_notes:
        return CheckResult(
            severity="error",
            code="E_STRING_CHORD_EXCEED",
            params={
                "instrument": "double_bass",
                "chord_size": len(chord_pitches),
                "max": profile.max_simultaneous_notes,
            },
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
                params={
                    "instrument": "double_bass",
                    "note": note.spelling,
                    "string": string.open_pitch.spelling,
                },
                suggestions=[SuggestionStub(code="S_OCTAVE_UP")],
            )
        fret = note.midi_number - string.open_pitch.midi_number
        if fret > DOUBLE_BASS_MAX_FRET:
            return CheckResult(
                severity="error",
                code="E_DOUBLE_BASS_FRET_TOO_HIGH",
                params={"note": note.spelling, "fret": fret},
            )
        assignments.append((string.index, fret, note))

    used = [a[0] for a in assignments]
    for i in range(len(used) - 1):
        if used[i + 1] - used[i] > 1:
            return CheckResult(
                severity="error",
                code="E_NON_ADJACENT_STRINGS",
                params={"instrument": "double_bass"},
                suggestions=[SuggestionStub(code="S_REVOICE_CHORD")],
            )

    frets = [a[1] for a in assignments if a[1] > 0]
    if len(frets) >= 2:
        stretch = max(frets) - min(frets)
        if stretch > profile.max_stretch_semitones:
            return CheckResult(
                severity="error",
                code="E_DOUBLE_BASS_STRETCH_EXCEED",
                params={
                    "stretch": stretch,
                    "max": profile.max_stretch_semitones,
                },
            )
        if stretch > profile.comfortable_stretch_semitones:
            return CheckResult(
                severity="warning",
                code="W_DOUBLE_BASS_STRETCH_LARGE",
                params={"stretch": stretch},
                difficulty_score=stretch / profile.max_stretch_semitones,
            )

    avg_fret = sum(a[1] for a in assignments) / max(len(assignments), 1)
    return CheckResult(severity="ok", difficulty_score=min(avg_fret / 12.0, 1.0))

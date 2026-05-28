"""
小提琴 (Violin) profile + 和弦可行性檢查

對應規格: architecture.md §4.3.2 (Violin profile) + §4.3.3 (弦樂和弦可行性)
"""

from __future__ import annotations

from core.ir import Pitch

from .base import (
    CheckResult,
    InstrumentProfile,
    StringDef,
    SuggestionStub,
)


# ============================================================================
# Violin profile
# ============================================================================

VIOLIN_PROFILE = InstrumentProfile(
    instrument_id="violin",
    display_name="Violin",
    family="string_bowed",

    # 音域 (architecture.md §4.3.2)
    range_absolute=(55, 108),       # G3 (MIDI 55) — C8 (含泛音)
    range_comfortable=(55, 100),    # G3 — E7
    range_professional=(55, 105),   # G3 — A7
    # 0.1.54 B: 業餘級 (1-3 把位友善) — E string 3rd position 最高 G6/A6 附近,
    # 給 amateur 用 E6 (88) 上限留些空間, 多數早期業餘曲目都打不到 E6 以上.
    range_amateur=(55, 88),         # G3 — E6


    max_simultaneous_notes=4,

    strings=[
        StringDef(open_pitch=Pitch(55, "G3"), index=0),
        StringDef(open_pitch=Pitch(62, "D4"), index=1),
        StringDef(open_pitch=Pitch(69, "A4"), index=2),
        StringDef(open_pitch=Pitch(76, "E5"), index=3),
    ],
    max_stretch_semitones=6,             # 含伸展
    comfortable_stretch_semitones=4,     # 一般

    available_techniques=[
        "arco", "pizz", "tremolo", "harmonic",
        "spiccato", "staccato", "legato",
        "col_legno", "sul_ponticello", "sul_tasto",
        "double_stop", "triple_stop", "quadruple_stop",
    ],
    sustain_type="bow",
    transposition=0,
)


# ============================================================================
# 弦樂和弦可行性檢查 (architecture.md §4.3.3)
# ============================================================================

def check_violin_chord(chord_pitches: list[Pitch]) -> CheckResult:
    """驗證和弦在小提琴上是否可行。

    檢查項目:
    1. 音數 ≤ 弦數 (4)
    2. 每個音 ≥ 對應弦的空弦音
    3. 使用的弦必須相鄰 (不可跨越空弦) — Phase 1 限制: 採用貪婪指派,
       永遠選最低 N 條弦,因此本檢查在實務上不會觸發。
       Phase 2 將改為最佳指派 (考慮 fret 距離與可達性),屆時此檢查會生效。
    4. 同把位伸展不超過極限
    """
    profile = VIOLIN_PROFILE
    assert profile.strings is not None
    strings = profile.strings

    if len(chord_pitches) == 0:
        return CheckResult(severity="ok")

    if len(chord_pitches) == 1:
        # 單音 — 委派給音域檢查
        from .base import check_pitch_in_range
        return check_pitch_in_range(chord_pitches[0], profile)

    if len(chord_pitches) > len(strings):
        return CheckResult(
            severity="error",
            code="E_STRING_CHORD_EXCEED",
            params={
                "instrument": "violin",
                "chord_size": len(chord_pitches),
                "max": len(strings),
            },
            suggestions=[
                SuggestionStub(code="S_SPLIT_TO_PARTS"),
                SuggestionStub(code="S_OMIT_NOTE"),
                SuggestionStub(code="S_ARPEGGIATE"),
                SuggestionStub(code="S_REASSIGN_TO_OTHER_PART"),
            ],
        )

    # Phase 2: 用 DP 找最佳指法 (考慮 fret 高度、stretch、相鄰弦)
    from .fingering import find_best_fingering

    fingering = find_best_fingering(
        chord_pitches,
        strings,
        max_fret=24,
        max_stretch_semitones=profile.max_stretch_semitones,
    )

    if fingering is None:
        # 找不到合法指法: 判斷原因
        sorted_chord = sorted(chord_pitches, key=lambda p: p.midi_number)
        lowest = sorted_chord[0]
        if lowest.midi_number < strings[0].open_pitch.midi_number:
            return CheckResult(
                severity="error",
                code="E_NOTE_BELOW_STRING",
                params={
                    "instrument": "violin",
                    "note": lowest.spelling,
                    "string": strings[0].open_pitch.spelling,
                },
                suggestions=[
                    SuggestionStub(code="S_SPLIT_TO_PARTS"),
                    SuggestionStub(code="S_OMIT_NOTE", params={"note": lowest.spelling}),
                    SuggestionStub(code="S_OCTAVE_UP", params={"note": lowest.spelling}),
                ],
            )
        return CheckResult(
            severity="error",
            code="E_NON_ADJACENT_STRINGS",
            params={"instrument": "violin"},
            suggestions=[
                SuggestionStub(code="S_SPLIT_TO_PARTS"),
                SuggestionStub(code="S_REVOICE_CHORD"),
                SuggestionStub(code="S_OMIT_NOTE"),
            ],
        )

    fret_positions = [a[2] for a in fingering.assignments if a[2] > 0]
    if len(fret_positions) >= 2:
        stretch = max(fret_positions) - min(fret_positions)
        if stretch > profile.comfortable_stretch_semitones:
            return CheckResult(
                severity="warning",
                code="W_VIOLIN_STRETCH_LARGE",
                params={
                    "stretch": stretch,
                    "comfortable": profile.comfortable_stretch_semitones,
                },
                difficulty_score=stretch / profile.max_stretch_semitones,
                suggestions=[SuggestionStub(code="S_REVOICE_CHORD")],
            )

    # 三音、四音和弦因弓法限制有額外注意事項
    if len(chord_pitches) >= 3:
        return CheckResult(
            severity="warning",
            code="W_VIOLIN_TRIPLE_QUAD_STOP",
            params={"chord_size": len(chord_pitches)},
            difficulty_score=0.3 + (len(chord_pitches) - 3) * 0.2,
        )

    # 雙音, 一切正常
    avg_fret = sum(a[2] for a in fingering.assignments) / max(
        len(fingering.assignments), 1,
    )
    return CheckResult(
        severity="ok",
        difficulty_score=min(avg_fret / 12.0, 1.0),
    )

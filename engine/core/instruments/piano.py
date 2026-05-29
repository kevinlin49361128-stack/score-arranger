"""
鋼琴 (Piano) profile + 手距檢查

對應規格: docs/architecture.md §4.3.2 (Piano profile) + §4.3.4 (手距檢查)
"""

from __future__ import annotations

from typing import Literal

from core.ir import Pitch

from .base import CheckResult, InstrumentProfile, SuggestionStub


# ============================================================================
# Piano profile
# ============================================================================

PIANO_PROFILE = InstrumentProfile(
    instrument_id="piano",
    display_name="Piano",
    family="keyboard",

    range_absolute=(21, 108),         # A0 — C8
    range_comfortable=(36, 96),       # C2 — C7 (大部分曲目)
    range_professional=(21, 108),     # 同 absolute

    max_simultaneous_notes=10,        # 理論值,實務單手 5

    max_hand_span_semitones=12,       # 物理極限 (大十度 +)
    comfortable_hand_span_semitones=10,
    independent_voices_per_hand=2,    # 每手最多 2 條獨立聲部

    available_techniques=[
        "legato", "staccato", "marcato", "tenuto",
        "arpeggio", "tremolo", "trill",
        "pedal_sustain", "pedal_una_corda", "pedal_sostenuto",
        "glissando", "cluster",
    ],
    sustain_type="pedal",
    transposition=0,
)


# ============================================================================
# 手距檢查 (docs/architecture.md §4.3.4)
# ============================================================================

Hand = Literal["left", "right"]


def check_piano_hand_span(
    pitches: list[Pitch], hand: Hand = "right"
) -> CheckResult:
    """檢查單手要彈奏的多個音是否在手距範圍內。

    輸入 pitches 應為「同時發聲」的音 (例如和弦的所有音、或須單手按住的所有音)。
    回傳:
    - span ≤ 舒適 (10): OK
    - span ≤ 極限 (12) 但 > 舒適: WARNING (需大手)
    - span > 極限: ERROR
    """
    if len(pitches) <= 1:
        return CheckResult(severity="ok")

    profile = PIANO_PROFILE
    sorted_pitches = sorted(pitches, key=lambda p: p.midi_number)
    span = sorted_pitches[-1].midi_number - sorted_pitches[0].midi_number

    if span > profile.max_hand_span_semitones:
        return CheckResult(
            severity="error",
            code="E_PIANO_HAND_SPAN_EXCEED",
            params={
                "hand": hand,
                "span_semitones": span,
                "max": profile.max_hand_span_semitones,
            },
            suggestions=[
                SuggestionStub(code="S_OMIT_INNER_VOICE"),
                SuggestionStub(code="S_OCTAVE_TRANSPOSE_OUTER"),
                SuggestionStub(code="S_REDISTRIBUTE_HANDS"),
                SuggestionStub(code="S_ARPEGGIATE"),
            ],
        )

    if span > profile.comfortable_hand_span_semitones:
        return CheckResult(
            severity="warning",
            code="W_PIANO_HAND_SPAN_LARGE",
            params={
                "hand": hand,
                "span_semitones": span,
                "comfortable": profile.comfortable_hand_span_semitones,
            },
            difficulty_score=(
                (span - profile.comfortable_hand_span_semitones)
                / max(profile.max_hand_span_semitones
                      - profile.comfortable_hand_span_semitones, 1)
            ),
            suggestions=[
                SuggestionStub(code="S_ARPEGGIATE"),
                SuggestionStub(code="S_OMIT_INNER_VOICE"),
            ],
        )

    # 在舒適範圍內
    return CheckResult(
        severity="ok",
        difficulty_score=span / profile.max_hand_span_semitones,
    )


def check_piano_chord_polyphony(
    pitches: list[Pitch], hand: Hand = "right"
) -> CheckResult:
    """檢查單手和弦音數是否超過 5 (實務上單手能按 5 音)。"""
    if len(pitches) <= 5:
        return check_piano_hand_span(pitches, hand)

    return CheckResult(
        severity="warning",
        code="W_PIANO_TOO_MANY_NOTES_ONE_HAND",
        params={"hand": hand, "count": len(pitches)},
        suggestions=[
            SuggestionStub(code="S_REDISTRIBUTE_HANDS"),
            SuggestionStub(code="S_OMIT_INNER_VOICE"),
        ],
    )

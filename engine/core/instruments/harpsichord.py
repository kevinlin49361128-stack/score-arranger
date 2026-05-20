"""
大鍵琴 (Harpsichord) profile + 手距 / 多音檢查

跟 Piano 主要差別:
- 音域較窄 (歷史樂器, 5-octave 為主, 巴洛克常見 4.5 octave)
- 無踏板 (sustain_type="decay" 而非 "pedal")
- 無 dynamics (每琴鍵力道一致, 但仍允許在 IR 標記 dynamic 給 timbre/manual 切換)
- 物理手距同鋼琴 (鍵盤尺寸相似)
- 通常雙鍵盤 (兩個 manual), 各自 staff, 可獨立分配

巴洛克 continuo 慣例: 通常配低音線 + 即興填充和聲, 但 Phase 1 把它當一般
key board 處理, 由 arranger.HARMONY_FILL 分配。
"""

from __future__ import annotations

from typing import Literal

from core.ir import Pitch

from .base import CheckResult, InstrumentProfile, SuggestionStub


HARPSICHORD_PROFILE = InstrumentProfile(
    instrument_id="harpsichord",
    display_name="Harpsichord",
    family="keyboard",

    # 5 octaves FF-f''' (~28-89): 大部分 Bach/Handel/Scarlatti 範圍
    # 一些大鍵琴擴到 GG-g''' (~31-91)
    range_absolute=(29, 89),         # F1 — F6
    range_comfortable=(36, 84),      # C2 — C6 (最常用)
    range_professional=(29, 89),

    max_simultaneous_notes=8,         # 兩手最多, 實務 6-8 音
    max_hand_span_semitones=12,       # 同 piano
    comfortable_hand_span_semitones=10,
    independent_voices_per_hand=2,

    available_techniques=[
        "legato", "staccato", "ornament",
        "trill", "mordent", "appoggiatura",
        "arpeggio",
        # 無 dynamic / pedal: 不列 marcato/tenuto/pedal_*
    ],
    sustain_type="decay",            # 鍵盤撥弦, 沒踏板
    transposition=0,
)


# ============================================================================
# 共用手距檢查 (跟 piano 邏輯一致, 但用 harpsichord profile)
# ============================================================================

Hand = Literal["left", "right"]


def check_harpsichord_hand_span(
    pitches: list[Pitch], hand: Hand = "right",
) -> CheckResult:
    """檢查單手要彈奏的多個音是否在手距範圍內 (邏輯同 piano)。"""
    if len(pitches) <= 1:
        return CheckResult(severity="ok")

    profile = HARPSICHORD_PROFILE
    sorted_pitches = sorted(pitches, key=lambda p: p.midi_number)
    span = sorted_pitches[-1].midi_number - sorted_pitches[0].midi_number

    if span > profile.max_hand_span_semitones:
        return CheckResult(
            severity="error",
            code="E_HARPSICHORD_HAND_SPAN_EXCEED",
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
            code="W_HARPSICHORD_HAND_SPAN_LARGE",
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

    return CheckResult(
        severity="ok",
        difficulty_score=span / profile.max_hand_span_semitones,
    )

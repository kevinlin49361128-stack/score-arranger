"""
木管樂器 profile — 長笛 (Flute) + 單簧管 (Clarinet)

兩者皆為單音 (monophonic) 樂器, 不支援和弦。
- 長笛: C 調, 不移調, 範圍 C4–C7
- 單簧管 (B♭): 譜記比實音高大 2 度 → transposition = -2 (譜上 C 對應實際 B♭)
  音域 (sounding): D3–C7 (常用 D3–G6)
  譜上 (written): E3–D7

呼吸限制: 兩者都需要換氣, 但每樂句長度與 dynamic 相關 (此處用粗略上限)
"""

from __future__ import annotations

from core.ir import Pitch

from .base import (
    CheckResult,
    InstrumentProfile,
    SuggestionStub,
    check_pitch_in_range,
)


# ============================================================================
# Flute (長笛)
# ============================================================================

FLUTE_PROFILE = InstrumentProfile(
    instrument_id="flute",
    display_name="Flute",
    family="woodwind",

    # C4 (MIDI 60) — D7 (MIDI 98), 標準現代長笛
    range_absolute=(60, 98),
    range_comfortable=(60, 91),     # C4 — G6
    range_professional=(60, 96),    # C4 — C7

    max_simultaneous_notes=1,       # 單音樂器

    breath_required=True,
    max_sustained_beats=16,         # 慢板下可撐到約 4 小節 4/4

    available_techniques=[
        "legato", "staccato", "double_tonguing", "triple_tonguing",
        "flutter_tongue", "vibrato", "harmonic",
    ],
    sustain_type="breath",
    transposition=0,                # C 調樂器, 不移調
)


# ============================================================================
# Clarinet (B♭ 單簧管, 最常用的調性)
# ============================================================================

CLARINET_PROFILE = InstrumentProfile(
    instrument_id="clarinet_bb",
    display_name="Clarinet (B♭)",
    family="woodwind",

    # === 音域以「實音 (sounding)」為準 ===
    # 譜記 (written) 範圍是 E3—G6, sounding 比寫的低大2度 → D3—F6
    # 含高音範圍延伸到 C7 sounding (難度極高)
    range_absolute=(50, 91),        # D3 — G6 sounding
    range_comfortable=(50, 79),     # D3 — G5
    range_professional=(50, 89),    # D3 — F6

    max_simultaneous_notes=1,

    breath_required=True,
    max_sustained_beats=20,

    available_techniques=[
        "legato", "staccato", "double_tonguing",
        "flutter_tongue", "vibrato", "glissando",
        "subtone", "altissimo",
    ],
    sustain_type="breath",
    # B♭ 樂器: 譜記 C 對應實際 B♭ → 譜→實音 為 -2 半音
    transposition=-2,
)


# ============================================================================
# 共用單音檢查
# ============================================================================

def check_monophonic(
    chord_pitches: list[Pitch],
    profile: InstrumentProfile,
) -> CheckResult:
    """單音樂器和弦檢查: 任何 ≥ 2 音皆為錯誤; 否則委派音域檢查。"""
    if len(chord_pitches) == 0:
        return CheckResult(severity="ok")
    if len(chord_pitches) > 1:
        return CheckResult(
            severity="error",
            code="E_MONOPHONIC_CHORD",
            params={
                "instrument": profile.instrument_id,
                "chord_size": len(chord_pitches),
            },
            suggestions=[
                SuggestionStub(code="S_REDUCE_TO_TOP"),
                SuggestionStub(code="S_REDUCE_TO_BOTTOM"),
                SuggestionStub(code="S_REASSIGN_TO_OTHER_PART"),
            ],
        )
    return check_pitch_in_range(chord_pitches[0], profile)


def check_flute(chord_pitches: list[Pitch]) -> CheckResult:
    return check_monophonic(chord_pitches, FLUTE_PROFILE)


def check_clarinet(chord_pitches: list[Pitch]) -> CheckResult:
    return check_monophonic(chord_pitches, CLARINET_PROFILE)


# ============================================================================
# Oboe (C 調, 不移調)
# ============================================================================

OBOE_PROFILE = InstrumentProfile(
    instrument_id="oboe",
    display_name="Oboe",
    family="woodwind",
    range_absolute=(58, 91),    # B♭3 — G6
    range_comfortable=(60, 84), # C4 — C6
    range_professional=(58, 89),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=16,
    available_techniques=["legato", "staccato", "vibrato", "double_tonguing"],
    sustain_type="breath",
    transposition=0,
)


def check_oboe(chord_pitches: list[Pitch]) -> CheckResult:
    return check_monophonic(chord_pitches, OBOE_PROFILE)


# ============================================================================
# Bassoon (C 調, 低音域)
# ============================================================================

BASSOON_PROFILE = InstrumentProfile(
    instrument_id="bassoon",
    display_name="Bassoon",
    family="woodwind",
    range_absolute=(34, 75),    # B♭1 — E♭5
    range_comfortable=(36, 65), # C2 — F4
    range_professional=(34, 72),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=12,
    available_techniques=["legato", "staccato", "double_tonguing"],
    sustain_type="breath",
    transposition=0,
)


def check_bassoon(chord_pitches: list[Pitch]) -> CheckResult:
    return check_monophonic(chord_pitches, BASSOON_PROFILE)

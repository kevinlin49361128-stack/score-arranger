"""銅管樂器 profiles — French Horn (F), Trumpet (B♭), Trombone, Tuba"""

from __future__ import annotations

from core.ir import Pitch

from .base import (
    CheckResult,
    InstrumentProfile,
    check_pitch_in_range,
)
from .woodwinds import check_monophonic


# French Horn in F: written 比 sounding 高完全五度, sounding 低 7 半音
HORN_PROFILE = InstrumentProfile(
    instrument_id="horn_f",
    display_name="French Horn (F)",
    family="brass",
    range_absolute=(34, 77),     # B♭1 — F5
    range_comfortable=(41, 70),  # F2 — B♭4
    range_professional=(36, 77),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=12,
    available_techniques=["legato", "staccato", "stopped", "muted"],
    sustain_type="breath",
    transposition=-7,
)

# Trumpet in B♭: written 比 sounding 高大二度, sounding 低 2 半音
TRUMPET_PROFILE = InstrumentProfile(
    instrument_id="trumpet_bb",
    display_name="Trumpet (B♭)",
    family="brass",
    range_absolute=(52, 82),    # E3 — B♭5
    range_comfortable=(55, 77), # G3 — F5
    range_professional=(52, 80),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=10,
    available_techniques=["legato", "staccato", "muted", "flutter_tongue"],
    sustain_type="breath",
    transposition=-2,
)

# Tenor Trombone: 不移調
TROMBONE_PROFILE = InstrumentProfile(
    instrument_id="trombone",
    display_name="Tenor Trombone",
    family="brass",
    range_absolute=(40, 72),    # E2 — C5
    range_comfortable=(43, 65), # G2 — F4
    range_professional=(40, 70),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=12,
    available_techniques=["legato", "staccato", "glissando", "muted"],
    sustain_type="breath",
    transposition=0,
)

# Tuba: 不移調
TUBA_PROFILE = InstrumentProfile(
    instrument_id="tuba",
    display_name="Tuba",
    family="brass",
    range_absolute=(28, 65),    # E1 — F4
    range_comfortable=(31, 55), # G1 — G3
    range_professional=(28, 60),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=8,      # 比其他銅管耗氣
    available_techniques=["legato", "staccato"],
    sustain_type="breath",
    transposition=0,
)


def check_horn(chord_pitches: list[Pitch]) -> CheckResult:
    return check_monophonic(chord_pitches, HORN_PROFILE)


def check_trumpet(chord_pitches: list[Pitch]) -> CheckResult:
    return check_monophonic(chord_pitches, TRUMPET_PROFILE)


def check_trombone(chord_pitches: list[Pitch]) -> CheckResult:
    return check_monophonic(chord_pitches, TROMBONE_PROFILE)


def check_tuba(chord_pitches: list[Pitch]) -> CheckResult:
    return check_monophonic(chord_pitches, TUBA_PROFILE)

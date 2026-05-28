"""樂器知識庫 — InstrumentProfile + 可演奏性檢查"""

from .base import (
    CheckResult,
    InstrumentProfile,
    StringDef,
    SuggestionStub,
    check_pitch_in_range,
)
from .canonical import (
    ALIASES,
    CANONICAL_IDS,
    normalize_instrument_id,
)
from .cello import CELLO_PROFILE, check_cello_chord
from .double_bass import DOUBLE_BASS_PROFILE, check_double_bass_chord
from .fretted_plucked import check_fretted_plucked
from .guitar import GUITAR_PROFILE, check_guitar_chord
from .harp import HARP_PROFILE, check_harp_chord
from .harpsichord import HARPSICHORD_PROFILE, check_harpsichord_hand_span
from .lute import LUTE_PROFILE, check_lute_chord
from .piano import PIANO_PROFILE, check_piano_hand_span
from .registry import get_profile, list_profiles, register_profile
from .viola import VIOLA_PROFILE, check_viola_chord
from .violin import VIOLIN_PROFILE, check_violin_chord
from .woodwinds import (
    CLARINET_PROFILE,
    FLUTE_PROFILE,
    check_clarinet,
    check_flute,
    check_monophonic,
)

__all__ = [
    "ALIASES",
    "CANONICAL_IDS",
    "CELLO_PROFILE",
    "CLARINET_PROFILE",
    "CheckResult",
    "DOUBLE_BASS_PROFILE",
    "FLUTE_PROFILE",
    "GUITAR_PROFILE",
    "HARP_PROFILE",
    "HARPSICHORD_PROFILE",
    "InstrumentProfile",
    "LUTE_PROFILE",
    "PIANO_PROFILE",
    "StringDef",
    "SuggestionStub",
    "VIOLA_PROFILE",
    "VIOLIN_PROFILE",
    "check_cello_chord",
    "check_clarinet",
    "check_double_bass_chord",
    "check_flute",
    "check_fretted_plucked",
    "check_guitar_chord",
    "check_harp_chord",
    "check_harpsichord_hand_span",
    "check_lute_chord",
    "check_monophonic",
    "check_piano_hand_span",
    "check_pitch_in_range",
    "check_viola_chord",
    "check_violin_chord",
    "get_profile",
    "list_profiles",
    "normalize_instrument_id",
    "register_profile",
]

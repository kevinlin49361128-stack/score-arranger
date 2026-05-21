"""
樂器註冊表 — 透過 instrument_id 查找 InstrumentProfile

對應規格: engine/instruments/registry.py (architecture.md §9)
"""

from __future__ import annotations

from typing import Optional

from .base import InstrumentProfile


_REGISTRY: dict[str, InstrumentProfile] = {}


def register_profile(profile: InstrumentProfile) -> None:
    """註冊一個樂器 profile。重複註冊會覆寫先前的設定。"""
    _REGISTRY[profile.instrument_id] = profile


def get_profile(instrument_id: str) -> Optional[InstrumentProfile]:
    """依 instrument_id 取得 profile,找不到時回傳 None。"""
    return _REGISTRY.get(instrument_id)


def list_profiles() -> list[str]:
    """列出已註冊的 instrument_id。"""
    return sorted(_REGISTRY.keys())


def require_profile(instrument_id: str) -> InstrumentProfile:
    """同 get_profile 但找不到時拋 KeyError。"""
    profile = _REGISTRY.get(instrument_id)
    if profile is None:
        raise KeyError(f"未註冊的樂器: {instrument_id}")
    return profile


# === 自動註冊內建 profile ===
def _bootstrap() -> None:
    from .cello import CELLO_PROFILE
    from .harpsichord import HARPSICHORD_PROFILE
    from .piano import PIANO_PROFILE
    from .viola import VIOLA_PROFILE
    from .violin import VIOLIN_PROFILE
    from .voice import (
        ALTO_PROFILE,
        BASS_VOICE_PROFILE,
        SOPRANO_PROFILE,
        TENOR_PROFILE,
    )
    from .brass import (
        HORN_PROFILE,
        TROMBONE_PROFILE,
        TRUMPET_PROFILE,
        TUBA_PROFILE,
    )
    from .woodwinds import (
        BASSOON_PROFILE,
        CLARINET_PROFILE,
        FLUTE_PROFILE,
        OBOE_PROFILE,
    )
    from .guitar import GUITAR_PROFILE
    from .lute import LUTE_PROFILE
    from .harp import HARP_PROFILE
    register_profile(VIOLIN_PROFILE)
    register_profile(VIOLA_PROFILE)
    register_profile(CELLO_PROFILE)
    register_profile(PIANO_PROFILE)
    register_profile(HARPSICHORD_PROFILE)
    register_profile(FLUTE_PROFILE)
    register_profile(OBOE_PROFILE)
    register_profile(CLARINET_PROFILE)
    register_profile(BASSOON_PROFILE)
    register_profile(HORN_PROFILE)
    register_profile(TRUMPET_PROFILE)
    register_profile(TROMBONE_PROFILE)
    register_profile(TUBA_PROFILE)
    register_profile(SOPRANO_PROFILE)
    register_profile(ALTO_PROFILE)
    register_profile(TENOR_PROFILE)
    register_profile(BASS_VOICE_PROFILE)
    register_profile(GUITAR_PROFILE)
    register_profile(LUTE_PROFILE)
    register_profile(HARP_PROFILE)


_bootstrap()

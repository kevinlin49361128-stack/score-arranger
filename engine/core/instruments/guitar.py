"""
古典吉他 (Classical Guitar) profile + 和弦可行性檢查

對應規格: docs/architecture.md §4.3 (樂器知識庫) — 撥弦樂器 (plucked) 家族首批成員。

與擦弦樂器 (violin/viola/cello) 的差異:
- 撥弦樂器各弦獨立撥動, 可略過 / 悶住中間的弦 → 使用的弦「不需相鄰」。
- 一次最多六根弦同時發聲 (六音和弦)。
- 移調樂器: 古典吉他記譜比實音高八度 (treble clef), transposition = -12
  (譜記音 → 實音 偏移 -12 半音)。

六弦空弦 (低到高), 實音 (concert pitch):
  E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
"""

from __future__ import annotations

from core.ir import Pitch

from .base import (
    CheckResult,
    InstrumentProfile,
    StringDef,
)


# ============================================================================
# Classical Guitar profile
# ============================================================================

# 古典吉他可達把位 (一般 19 格指板)
GUITAR_MAX_FRET: int = 19


GUITAR_PROFILE = InstrumentProfile(
    instrument_id="guitar",
    display_name="Classical Guitar",
    family="plucked",

    # 音域以實音 (sounding) 為準。E2 (最低空弦) — 19 格高音 + 泛音延伸。
    range_absolute=(40, 88),        # E2 — E6
    range_comfortable=(40, 79),     # E2 — G5
    range_professional=(40, 84),    # E2 — C6

    max_simultaneous_notes=6,       # 六弦

    strings=[
        StringDef(open_pitch=Pitch(40, "E2"), index=0),
        StringDef(open_pitch=Pitch(45, "A2"), index=1),
        StringDef(open_pitch=Pitch(50, "D3"), index=2),
        StringDef(open_pitch=Pitch(55, "G3"), index=3),
        StringDef(open_pitch=Pitch(59, "B3"), index=4),
        StringDef(open_pitch=Pitch(64, "E4"), index=5),
    ],
    max_stretch_semitones=7,             # 含極限伸展
    comfortable_stretch_semitones=5,     # 一般

    available_techniques=[
        "arpeggio", "rasgueado", "tremolo", "harmonic",
        "pizzicato", "legato", "staccato", "slur",
    ],
    sustain_type="decay",
    # 記譜比實音高八度 → 譜記音轉實音為 -12 半音
    transposition=-12,
)


# ============================================================================
# 古典吉他和弦可行性檢查
# ============================================================================

def check_guitar_chord(chord_pitches: list[Pitch]) -> CheckResult:
    """驗證和弦在古典吉他上是否可行 (撥弦樂器: 弦不需相鄰)。"""
    from .fretted_plucked import check_fretted_plucked

    return check_fretted_plucked(
        chord_pitches, GUITAR_PROFILE, max_fret=GUITAR_MAX_FRET,
    )

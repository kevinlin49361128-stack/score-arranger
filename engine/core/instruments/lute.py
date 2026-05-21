"""
文藝復興魯特琴 (Renaissance Lute, 六組弦, G 調) profile + 和弦可行性檢查

對應規格: architecture.md §4.3 (樂器知識庫) — 撥弦樂器 (plucked) 家族成員。

魯特琴的「組弦」(course):
- 一個 course 是「成對的兩根弦」, 演奏時當作一根弦處理 (齊奏同音或八度)。
- 本模型把「一組」course 用單一 StringDef 表示 (簡化, 不展開成對弦)。

六組弦 (六組 = six-course), 文藝復興 G 調定弦, 實音 (concert pitch):
  G2=43, C3=48, F3=53, A3=57, D4=62, G4=67
  音程間距: 4-4-3-4-4 (完全四度三次 / 大三度一次 / 完全四度兩次)
  — 與吉他不同, 不可沿用吉他的 MIDI 列表。

不移調 (transposition = 0)。指板較短, 一般只用到約 12 格。
"""

from __future__ import annotations

from core.ir import Pitch

from .base import (
    CheckResult,
    InstrumentProfile,
    StringDef,
)


# ============================================================================
# Renaissance Lute profile (6-course, G tuning)
# ============================================================================

# 魯特琴指板較短, 約 12 格
LUTE_MAX_FRET: int = 12


LUTE_PROFILE = InstrumentProfile(
    instrument_id="lute",
    display_name="Renaissance Lute",
    family="plucked",

    # 音域以實音為準。G2 (最低組弦) — 約 12 格高音 + 延伸。
    range_absolute=(43, 79),        # G2 — G5
    range_comfortable=(43, 72),     # G2 — C5
    range_professional=(43, 76),    # G2 — E5

    max_simultaneous_notes=6,       # 六組弦

    # 六組弦 G 調定弦, 間距 4-4-3-4-4 (逐項輸入, 不沿用吉他)
    strings=[
        StringDef(open_pitch=Pitch(43, "G2"), index=0),
        StringDef(open_pitch=Pitch(48, "C3"), index=1),
        StringDef(open_pitch=Pitch(53, "F3"), index=2),
        StringDef(open_pitch=Pitch(57, "A3"), index=3),
        StringDef(open_pitch=Pitch(62, "D4"), index=4),
        StringDef(open_pitch=Pitch(67, "G4"), index=5),
    ],
    max_stretch_semitones=6,             # 含極限伸展
    comfortable_stretch_semitones=4,     # 一般

    available_techniques=[
        "arpeggio", "campanella", "ornament", "slur", "harmonic",
    ],
    sustain_type="decay",
    transposition=0,
)


# ============================================================================
# 魯特琴和弦可行性檢查
# ============================================================================

def check_lute_chord(chord_pitches: list[Pitch]) -> CheckResult:
    """驗證和弦在魯特琴上是否可行 (撥弦樂器: 組弦不需相鄰)。"""
    from .fretted_plucked import check_fretted_plucked

    return check_fretted_plucked(
        chord_pitches, LUTE_PROFILE, max_fret=LUTE_MAX_FRET,
    )

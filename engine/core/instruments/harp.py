"""
音樂會踏板豎琴 (Concert Pedal Harp) profile + 和弦可行性檢查

對應規格: architecture.md §4.3 (樂器知識庫) — 撥弦樂器 (plucked) 家族成員。

踏板豎琴的關鍵特性:
- 47 根弦, 每個字母音名 (C/D/E/F/G/A/B) 每個八度只有「一根」弦。
- 七個踏板各有三段位置 (♭ / ♮ / ♯) 統一改變該字母名所有八度的弦。
- 因此「同一個字母名 + 同八度」只有一根弦 → 不能讓 C♮4 與 C♯4 同時發聲
  (兩者都會落在同一根 C 弦上)。
- 也因為一弦一音, 不像吉他有「按格」概念 → 本 profile 不給 StringDef
  列表, 改用鍵盤式建模 (手距 / 雙手分配)。
- 雙手各最多約四音 → 兩手合計 max_simultaneous_notes = 8。

注意: 本模組只檢查「同弦撞音」與「音數上限」。完整的踏板圖
(pedal diagram) 驗證 — 確認某個和弦/段落能用一組踏板設定彈奏, 不需要
中途換踏板 — 屬於更深的可演奏性分析, 不在本 Phase 範圍內。
"""

from __future__ import annotations

import re
from typing import Literal, Optional

from core.ir import Pitch

from .base import CheckResult, InstrumentProfile, SuggestionStub


# ============================================================================
# Concert Pedal Harp profile
# ============================================================================

HARP_PROFILE = InstrumentProfile(
    instrument_id="harp",
    display_name="Concert Pedal Harp",
    family="plucked",

    # 47 弦音域。最低 C♭1 (踏板全降時 ≈ B0, MIDI 23), 最高 G♯7 (MIDI 104)。
    range_absolute=(23, 104),       # ~C♭1 (B0) — G♯7
    range_comfortable=(28, 96),     # E1 — C7
    range_professional=(24, 103),   # C1 — G7

    # 雙手各約 4 音 → 合計 8
    max_simultaneous_notes=8,

    # 鍵盤式建模 (不給 strings 列表)。豎琴手橫跨範圍比鋼琴略大。
    max_hand_span_semitones=19,
    comfortable_hand_span_semitones=14,
    independent_voices_per_hand=2,

    available_techniques=[
        "arpeggio", "glissando", "harmonic",
        "pres-de-la-table", "bisbigliando",
    ],
    sustain_type="decay",
    transposition=0,
)


# 每隻手最多按弦數 (雙手合計 = max_simultaneous_notes)
HARP_MAX_NOTES_PER_HAND: int = 4


# ============================================================================
# 同弦撞音檢查
# ============================================================================

_PITCH_SPELLING_RE = re.compile(r"^([A-G])([#b]*)(-?\d+)$")


def _letter_and_octave(pitch: Pitch) -> Optional[tuple[str, int]]:
    """從 Pitch.spelling 解析 (字母音名, 八度)。

    必須用 spelling 而非 midi_number — MIDI 數字無法區分 C♯ 與 D♭
    (兩者同 MIDI 但落在不同的豎琴弦上)。解析失敗回傳 None。
    """
    m = _PITCH_SPELLING_RE.match(pitch.spelling.strip())
    if not m:
        return None
    letter, _accidental, octave = m.groups()
    return letter, int(octave)


def check_harp_chord(chord_pitches: list[Pitch]) -> CheckResult:
    """驗證和弦在踏板豎琴上是否可行。

    檢查項目:
      1. 同弦撞音: 兩個音共用同一個 (字母名, 八度) → 落在同一根弦, 無法
         同時發聲 (例如 C♮4 與 C♯4)。回傳 E_HARP_SAME_STRING。
      2. 音數上限: 超過 max_simultaneous_notes (雙手合計)。
    """
    profile = HARP_PROFILE

    if len(chord_pitches) == 0:
        return CheckResult(severity="ok")

    if len(chord_pitches) == 1:
        from .base import check_pitch_in_range
        return check_pitch_in_range(chord_pitches[0], profile)

    # 1. 同弦撞音 — 依 (字母名, 八度) 分組
    by_string: dict[tuple[str, int], list[Pitch]] = {}
    for p in chord_pitches:
        key = _letter_and_octave(p)
        if key is None:
            # 拼寫無法解析 → 退回用 midi 推字母名, 不阻擋 (寬鬆處理)
            continue
        by_string.setdefault(key, []).append(p)

    for (letter, octave), pitches in by_string.items():
        if len(pitches) >= 2:
            spellings = sorted(p.spelling for p in pitches)
            return CheckResult(
                severity="error",
                code="E_HARP_SAME_STRING",
                params={
                    "instrument": "harp",
                    "letter": letter,
                    "octave": octave,
                    "pitches": spellings,
                },
                suggestions=[
                    # 改用等音拼寫 (e.g. C♯4 → D♭4) 讓兩音落在不同弦
                    SuggestionStub(
                        code="S_RESPELL_ENHARMONIC",
                        params={"pitches": spellings},
                    ),
                    SuggestionStub(code="S_OMIT_NOTE"),
                    SuggestionStub(code="S_REASSIGN_TO_OTHER_PART"),
                ],
            )

    # 2. 音數上限 (雙手合計)
    if len(chord_pitches) > profile.max_simultaneous_notes:
        return CheckResult(
            severity="error",
            code="E_HARP_TOO_MANY_NOTES",
            params={
                "instrument": "harp",
                "chord_size": len(chord_pitches),
                "max": profile.max_simultaneous_notes,
            },
            suggestions=[
                SuggestionStub(code="S_OMIT_INNER_VOICE"),
                SuggestionStub(code="S_ARPEGGIATE"),
                SuggestionStub(code="S_SPLIT_TO_PARTS"),
            ],
        )

    # 跨度過大 → 提示需分手 / 琶音 (warning)
    sorted_pitches = sorted(chord_pitches, key=lambda p: p.midi_number)
    span = sorted_pitches[-1].midi_number - sorted_pitches[0].midi_number
    if span > profile.max_hand_span_semitones:
        # 一塊和弦跨度超過雙手能涵蓋 → 通常須琶音
        return CheckResult(
            severity="warning",
            code="W_HARP_WIDE_SPAN",
            params={"instrument": "harp", "span_semitones": span},
            difficulty_score=min(span / 36.0, 1.0),
            suggestions=[SuggestionStub(code="S_ARPEGGIATE")],
        )

    return CheckResult(
        severity="ok",
        difficulty_score=min(span / 36.0, 0.5),
    )

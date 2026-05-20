"""
樂器知識庫基礎類別 — InstrumentProfile + CheckResult

對應規格: architecture.md §4.3.1 + docs/i18n-spec.md (錯誤代碼結構)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

from core.ir import Pitch


# ============================================================================
# Check result (供可演奏性驗證使用)
# ============================================================================

Severity = Literal["ok", "warning", "error"]


@dataclass
class SuggestionStub:
    """修復建議的識別 stub。實際應用邏輯在 ArrangementEngine。"""
    code: str                              # "S_OMIT_NOTE", "S_ARPEGGIATE", ...
    params: dict = field(default_factory=dict)


@dataclass
class CheckResult:
    """可演奏性檢查結果。前端透過 code + params 翻譯訊息。"""
    severity: Severity
    code: str = ""
    params: dict = field(default_factory=dict)
    difficulty_score: float = 0.0          # 0 = 容易, 1 = 困難
    suggestions: list[SuggestionStub] = field(default_factory=list)

    @property
    def is_ok(self) -> bool:
        return self.severity == "ok"

    @property
    def is_error(self) -> bool:
        return self.severity == "error"

    @property
    def is_warning(self) -> bool:
        return self.severity == "warning"


# ============================================================================
# 樂器資料模型
# ============================================================================

@dataclass
class StringDef:
    """弦樂器單弦定義"""
    open_pitch: Pitch                      # 空弦音高
    index: int                             # 弦序號 (0 = 最低弦)


@dataclass
class InstrumentProfile:
    """樂器規格 (architecture.md §4.3.1)。

    instrument_id 必須與 Part.instrument_id 一致, 用於 registry 查找。
    """
    instrument_id: str
    display_name: str                      # 內部除錯用,UI 顯示走 i18n
    family: Literal[
        "string_bowed", "keyboard", "woodwind", "brass",
        "percussion", "voice", "plucked",
    ]

    # === 音域 (MIDI numbers) ===
    range_absolute: tuple[int, int]        # 物理極限
    range_comfortable: tuple[int, int]     # 常用舒適音域
    range_professional: tuple[int, int]    # 專業級可用音域

    # === 多音能力 ===
    max_simultaneous_notes: int            # violin=4, piano=10, flute=1

    # === 弦樂特有 ===
    strings: Optional[list[StringDef]] = None
    max_stretch_semitones: int = 0         # 同把位最大伸展 (含極限伸展)
    comfortable_stretch_semitones: int = 0 # 同把位舒適伸展

    # === 鍵盤特有 ===
    max_hand_span_semitones: int = 0
    comfortable_hand_span_semitones: int = 0
    independent_voices_per_hand: int = 0

    # === 管樂特有 ===
    breath_required: bool = False
    max_sustained_beats: int = 0           # 無換氣最大持續拍數

    # === 通用 ===
    available_techniques: list[str] = field(default_factory=list)
    sustain_type: Literal["bow", "breath", "pedal", "decay", "continuous"] = "decay"
    transposition: int = 0                 # 譜記音 → 實際音 的半音偏移 (0 = C 調)


# ============================================================================
# 通用音域檢查
# ============================================================================

def check_pitch_in_range(
    pitch: Pitch, profile: InstrumentProfile
) -> CheckResult:
    """檢查單一音高是否在樂器音域內。

    分三段判斷:
    - 在 comfortable 範圍內: OK
    - 在 professional 範圍但超過 comfortable: WARNING
    - 在 absolute 範圍但超過 professional: WARNING (難度更高)
    - 超出 absolute: ERROR
    """
    m = pitch.midi_number
    abs_lo, abs_hi = profile.range_absolute
    cmf_lo, cmf_hi = profile.range_comfortable
    prof_lo, prof_hi = profile.range_professional

    if m < abs_lo:
        return CheckResult(
            severity="error",
            code="E_PITCH_BELOW_RANGE",
            params={
                "instrument": profile.instrument_id,
                "pitch": pitch.spelling,
                "lowest": abs_lo,
            },
            suggestions=[
                SuggestionStub(code="S_OCTAVE_UP"),
                SuggestionStub(code="S_REASSIGN_PART"),
            ],
        )
    if m > abs_hi:
        return CheckResult(
            severity="error",
            code="E_PITCH_ABOVE_RANGE",
            params={
                "instrument": profile.instrument_id,
                "pitch": pitch.spelling,
                "highest": abs_hi,
            },
            suggestions=[
                SuggestionStub(code="S_OCTAVE_DOWN"),
                SuggestionStub(code="S_REASSIGN_PART"),
            ],
        )

    if cmf_lo <= m <= cmf_hi:
        return CheckResult(severity="ok", difficulty_score=0.0)

    # 在舒適範圍外但仍在絕對範圍內
    if prof_lo <= m <= prof_hi:
        # 專業範圍內 (高難度但可行)
        if m < cmf_lo:
            distance = cmf_lo - m
        else:
            distance = m - cmf_hi
        return CheckResult(
            severity="warning",
            code="W_PITCH_OUT_OF_COMFORTABLE",
            params={
                "instrument": profile.instrument_id,
                "pitch": pitch.spelling,
            },
            difficulty_score=min(distance / 12.0, 1.0),
        )

    # 超出專業範圍,但在絕對極限內
    return CheckResult(
        severity="warning",
        code="W_PITCH_EXTREME",
        params={
            "instrument": profile.instrument_id,
            "pitch": pitch.spelling,
        },
        difficulty_score=0.9,
        suggestions=[
            SuggestionStub(
                code="S_OCTAVE_DOWN" if m > prof_hi else "S_OCTAVE_UP"
            ),
        ],
    )

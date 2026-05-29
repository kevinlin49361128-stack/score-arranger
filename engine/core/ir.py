"""
Score Arranger — Internal Representation (IR) 資料模型

對應規格書: docs/ir-spec.md v0.1.0

本模組定義所有後續模組共用的樂譜資料模型。設計原則:
1. 時間用 Fraction (避免浮點誤差)
2. 音高分離 concert pitch / written pitch
3. 全域元素 (反覆、漸變、踏板) 放在 Score 層級
4. 音樂術語用英文/義大利文,中文化在 UI 層做
"""

from __future__ import annotations

from dataclasses import dataclass, field, is_dataclass, fields
from enum import Enum
from fractions import Fraction
from typing import Any, Literal, Optional, Union

# ============================================================================
# §3.1 基礎型別
# ============================================================================

TimePoint = Fraction  # 小節內 offset, 以四分音符為 1.0
Duration = Fraction   # 音符時值, 以四分音符為 1.0


# ============================================================================
# Enums
# ============================================================================

class VoiceFunction(str, Enum):
    """聲部在音樂結構中的功能角色 (對應 docs/architecture.md §4.2.3)"""
    MELODY = "melody"
    BASS = "bass"
    COUNTERMELODY = "countermelody"
    HARMONY_FILL = "harmony_fill"
    PEDAL = "pedal"
    ORNAMENTAL = "ornamental"
    UNASSIGNED = "unassigned"


class IssueSeverity(str, Enum):
    """可演奏性問題嚴重度"""
    ERROR = "error"      # 紅: 物理上不可能演奏
    WARNING = "warning"  # 黃: 技術上可行但難度很高
    INFO = "info"        # 綠: 建議改善但非必要


# Issue 加權分數 (見 docs/architecture.md §修復迴圈收斂指標)
ISSUE_WEIGHTS: dict[IssueSeverity, float] = {
    IssueSeverity.ERROR: 10.0,
    IssueSeverity.WARNING: 3.0,
    IssueSeverity.INFO: 1.0,
}


# ============================================================================
# Pitch (frozen, 不可變)
# ============================================================================

@dataclass(frozen=True)
class Pitch:
    """音高表示。

    - midi_number: 實際發聲音高 (concert pitch), 一律以此為分析依據
    - spelling: 音名拼寫 (英文制 + ASCII), 如 "C4", "F#5", "Bb3", "C##4"
    - written_midi / written_spelling: 移調樂器的譜上記譜音 (None = 同 concert)
    """
    midi_number: int
    spelling: str
    written_midi: Optional[int] = None
    written_spelling: Optional[str] = None

    def __post_init__(self) -> None:
        if not (0 <= self.midi_number <= 127):
            raise ValueError(f"midi_number {self.midi_number} 超出 0-127")
        if self.written_midi is not None and not (0 <= self.written_midi <= 127):
            raise ValueError(f"written_midi {self.written_midi} 超出 0-127")


# ============================================================================
# §3.2 音樂事件 (Events)
# ============================================================================

@dataclass
class GraceNote:
    """裝飾音 (前倚音)"""
    pitch: Pitch
    grace_type: Literal["acciaccatura", "appoggiatura"]


@dataclass
class Ornament:
    """奧納門特 (顫音、漣音、迴音等)"""
    kind: Literal[
        "trill", "mordent", "inverted_mordent",
        "turn", "inverted_turn", "tremolo",
        "arpeggio_up", "arpeggio_down",
    ]
    upper_aux: Optional[Pitch] = None
    lower_aux: Optional[Pitch] = None
    # Analysis Engine 展開後的實際音符序列
    realization: Optional[list["NoteEvent"]] = None


@dataclass
class Tuplet:
    """連音標記。同一連音群組的所有音符共用 bracket_id。"""
    actual: int       # e.g. 3 (三連音)
    normal: int       # e.g. 2 (在 2 個音的時間裡)
    bracket_id: int   # 此小節內的連音群組編號

    def __post_init__(self) -> None:
        if not (self.actual > self.normal > 0):
            raise ValueError(f"Tuplet 需 actual > normal > 0, 收到 {self.actual}:{self.normal}")


@dataclass
class TechniqueAnnotation:
    """演奏法標註。Phase 1 多為 None, Phase 2 由 validator/使用者填入。"""
    bow_direction: Optional[Literal["up", "down"]] = None
    string_index: Optional[int] = None
    position: Optional[int] = None       # 把位 (1-based)
    fingering: Optional[str] = None
    breath_mark_after: bool = False
    pedal_action: Optional[Literal["down", "up", "change"]] = None


@dataclass
class NoteEvent:
    """單一音符事件"""
    pitch: Pitch
    duration: Duration
    onset: TimePoint
    articulations: list[str] = field(default_factory=list)
    dynamic: Optional[str] = None
    is_tied_from: bool = False
    is_tied_to: bool = False
    slur_group: Optional[int] = None
    grace_before: list[GraceNote] = field(default_factory=list)
    ornament: Optional[Ornament] = None
    tuplet: Optional[Tuplet] = None
    technique: Optional[TechniqueAnnotation] = None
    lyric: Optional[str] = None
    # 使用者鎖定: True 時 repair / 自動演算法不可覆寫此事件
    is_locked: bool = False

    def __post_init__(self) -> None:
        if self.duration <= 0:
            raise ValueError(f"NoteEvent.duration 必須 > 0, 收到 {self.duration}")


@dataclass
class ChordEvent:
    """同時發聲的多個音 (≥ 2)。

    與 NoteEvent 差異: 多個音同時開始且時值相同。
    若是琶音或不同時開始,應拆為多個 NoteEvent。
    """
    pitches: list[Pitch]
    duration: Duration
    onset: TimePoint
    articulations: list[str] = field(default_factory=list)
    dynamic: Optional[str] = None
    is_tied_from: bool = False
    is_tied_to: bool = False
    slur_group: Optional[int] = None
    grace_before: list[GraceNote] = field(default_factory=list)
    ornament: Optional[Ornament] = None
    tuplet: Optional[Tuplet] = None
    technique: Optional[TechniqueAnnotation] = None
    # 使用者鎖定: True 時 repair / 自動演算法不可覆寫此事件
    is_locked: bool = False

    def __post_init__(self) -> None:
        if self.duration <= 0:
            raise ValueError(f"ChordEvent.duration 必須 > 0")
        if len(self.pitches) < 2:
            raise ValueError(f"ChordEvent 需 ≥ 2 個音, 收到 {len(self.pitches)}")
        midi_set = {p.midi_number for p in self.pitches}
        if len(midi_set) != len(self.pitches):
            raise ValueError("ChordEvent 不可有重複 midi_number")


@dataclass
class RestEvent:
    """休止符"""
    duration: Duration
    onset: TimePoint
    fermata: bool = False

    def __post_init__(self) -> None:
        if self.duration <= 0:
            raise ValueError(f"RestEvent.duration 必須 > 0")


Event = Union[NoteEvent, ChordEvent, RestEvent]


# ============================================================================
# §3.3 聲部與小節
# ============================================================================

@dataclass
class Voice:
    """單一聲部內的事件序列。

    Divisi (弦樂分部): is_divisi=True 時 events 為空, divisi_branches 含 2 個 Voice。
    """
    voice_id: int
    events: list[Event] = field(default_factory=list)
    is_divisi: bool = False
    divisi_branches: Optional[list["Voice"]] = None

    def __post_init__(self) -> None:
        if self.is_divisi:
            if self.events:
                raise ValueError("Divisi voice 的 events 必須為空")
            if not self.divisi_branches or len(self.divisi_branches) != 2:
                raise ValueError("Divisi voice 需 2 個 divisi_branches")


@dataclass
class Measure:
    """小節"""
    number: int                                          # 見規格 §5.1 編號規則
    is_pickup: bool = False
    voices: dict[int, Voice] = field(default_factory=dict)
    time_signature: Optional[tuple[int, int]] = None     # None = 沿用前一小節
    key_signature: Optional[str] = None                  # "D major", "F# minor"
    tempo_bpm: Optional[float] = None
    tempo_text: Optional[str] = None                     # "Allegro con brio"
    rehearsal_mark: Optional[str] = None
    barline_left: Literal["normal", "double", "final", "repeat_start"] = "normal"
    barline_right: Literal["normal", "double", "final", "repeat_end"] = "normal"
    # 0.1.50 E2.MVP: figured-bass 數字 (小節內 onset 四分音符 → "5/3" / "6" / "6/4")
    # 來自 MusicXML <figured-bass><figure><figure-number>. 用於 continuo
    # realization 取代 diatonic 預設.
    figured_bass: dict[Fraction, str] = field(default_factory=dict)


# ============================================================================
# §3.4 樂句、段落、聲部功能
# ============================================================================

@dataclass
class Phrase:
    """樂句邊界 (主旋律不可跨聲部切換的最小單位)"""
    phrase_id: int
    start: tuple[int, TimePoint]   # (measure_number, offset)
    end: tuple[int, TimePoint]
    detection_confidence: float = 0.0
    is_user_edited: bool = False


@dataclass
class Section:
    """段落 (全曲層級, e.g. 呈示部/發展部/再現部)"""
    section_id: int
    start_measure: int
    end_measure: int
    name: Optional[str] = None
    phrases: list[Phrase] = field(default_factory=list)


@dataclass
class MelodyTrack:
    """同一 section 內可能存在的多條旋律線"""
    track_id: int
    source_part_id: str
    span: tuple[int, int]
    role: Literal["primary", "secondary", "antiphonal"]
    paired_with: Optional[int] = None
    salience_score: float = 0.0


# ============================================================================
# §3.5 樂譜層級
# ============================================================================

@dataclass
class Part:
    """單一樂器聲部 (對應總譜上一行五線譜)"""
    part_id: str                  # 蛇形, e.g. "violin_1"
    name_display: str             # 顯示名, e.g. "Violin I"
    instrument_id: str            # 標準樂器識別, e.g. "violin"
    measures: list[Measure] = field(default_factory=list)
    # Analysis Engine 填入: section_id → 功能標記
    function_tags: dict[int, VoiceFunction] = field(default_factory=dict)


@dataclass
class DynamicHairpin:
    """力度漸變"""
    hairpin_id: int
    start: tuple[int, TimePoint]
    end: tuple[int, TimePoint]
    kind: Literal["crescendo", "diminuendo", "subito"]
    part_id: Optional[str] = None   # None = 全部聲部
    start_dynamic: Optional[str] = None
    end_dynamic: Optional[str] = None


@dataclass
class RepeatStructure:
    """反覆記號與跳躍結構"""
    repeat_id: int
    kind: Literal[
        "simple_repeat", "volta", "dc", "ds", "coda", "segno", "fine"
    ]
    span: Optional[tuple[int, int]] = None
    volta_number: Optional[int] = None
    jump_target: Optional[str] = None
    target_measure: Optional[int] = None


@dataclass
class PedalMark:
    """鋼琴踏板"""
    part_id: str
    span: tuple[tuple[int, TimePoint], tuple[int, TimePoint]]
    kind: Literal["sustain", "una_corda", "sostenuto"] = "sustain"


@dataclass
class Movement:
    """樂章 (多樂章作品)"""
    movement_id: int                  # 1-based
    title: Optional[str] = None
    measure_count: int = 0
    sections: list[Section] = field(default_factory=list)


@dataclass
class Score:
    """完整樂譜"""
    metadata: dict[str, str] = field(default_factory=dict)
    movements: list[Movement] = field(default_factory=list)
    parts: list[Part] = field(default_factory=list)

    # 全域元素
    hairpins: list[DynamicHairpin] = field(default_factory=list)
    repeats: list[RepeatStructure] = field(default_factory=list)
    pedals: list[PedalMark] = field(default_factory=list)
    melody_tracks: list[MelodyTrack] = field(default_factory=list)

    # 預設值 (第一小節未指定時使用)
    default_tempo_bpm: float = 120.0
    default_key: str = "C major"
    default_time_signature: tuple[int, int] = (4, 4)

    # Parser 警告
    parse_warnings: list[str] = field(default_factory=list)

    # IR 版本
    ir_version: str = "0.1.0"

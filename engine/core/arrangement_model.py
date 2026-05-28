"""
Arrangement 資料模型 — Player / Source / Assignment / Arrangement

對應規格: docs/player-layout-spec.md §2

Phase 1 簡化:
- 不實作完整 Project / Layout (留至 Phase 2)
- 每個 Player 對應 target_score 中一或多個 Part (依 staff 數)
- 對 piano 等多五線譜樂器, 使用 "upper" / "lower" 兩個 staff
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

from .ir import Score, VoiceFunction


# ============================================================================
# Player (使用者編制中的一個演奏者)
# ============================================================================

Staff = Literal["main", "upper", "lower"]
SkillLevel = Literal["amateur", "intermediate", "professional"]


@dataclass
class Player:
    player_id: str                                # 蛇形 e.g. "violin_1", "piano_1"
    display_name: str
    instruments: list[str]                        # instrument_id 列表
    primary_instrument: str
    staves: int = 1                               # 1 = main, 2 = upper+lower
    skill_level: SkillLevel = "professional"


def get_staves_for(player: Player) -> list[Staff]:
    """依 player.staves 回傳 staff 標籤列表。"""
    if player.staves == 2:
        return ["upper", "lower"]
    return ["main"]


# ============================================================================
# Assignment (單一聲部 → 目標 staff 的映射)
# ============================================================================

@dataclass
class Assignment:
    assignment_id: int
    source_part_id: str
    target_player_id: str
    target_instrument: str
    target_staff: Staff
    span: tuple[int, int]                          # (start_measure, end_measure)
    function: VoiceFunction
    source_voice_id: Optional[int] = None          # None = 整個 Part
    is_phrase_locked: bool = False
    is_user_edited: bool = False
    is_auto_generated: bool = True


# ============================================================================
# Arrangement (一次改編 = Players + Assignments + 產出 Score)
# ============================================================================

@dataclass
class Arrangement:
    arrangement_id: str
    name: str
    source_id: str
    players: list[Player]
    assignments: list[Assignment] = field(default_factory=list)
    target_score: Optional[Score] = None
    # 改編原始 source IR (供 reassign 重建用; Phase 1 開始持有)
    source_score: Optional[Score] = None
    parent_arrangement_id: Optional[str] = None
    created_at: str = ""

    def get_player(self, player_id: str) -> Optional[Player]:
        for p in self.players:
            if p.player_id == player_id:
                return p
        return None


# ============================================================================
# Phase 1 預設編制範本
# ============================================================================

def violin_piano_ensemble() -> list[Player]:
    """Phase 1 預設目標編制: 小提琴 + 鋼琴。"""
    return [
        Player(
            player_id="violin_1",
            display_name="Violin",
            instruments=["violin"],
            primary_instrument="violin",
            staves=1,
        ),
        Player(
            player_id="piano_1",
            display_name="Piano",
            instruments=["piano"],
            primary_instrument="piano",
            staves=2,
        ),
    ]


def string_quartet_ensemble() -> list[Player]:
    """弦樂四重奏: 兩把小提琴 + 中提琴 + 大提琴。"""
    return [
        Player(
            player_id="violin_1",
            display_name="Violin I",
            instruments=["violin"],
            primary_instrument="violin",
            staves=1,
        ),
        Player(
            player_id="violin_2",
            display_name="Violin II",
            instruments=["violin"],
            primary_instrument="violin",
            staves=1,
        ),
        Player(
            player_id="viola_1",
            display_name="Viola",
            instruments=["viola"],
            primary_instrument="viola",
            staves=1,
        ),
        Player(
            player_id="cello_1",
            display_name="Violoncello",
            instruments=["cello"],
            primary_instrument="cello",
            staves=1,
        ),
    ]


def string_quintet_ensemble() -> list[Player]:
    """弦樂五重奏 (DB 版): 兩把小提琴 + 中提琴 + 大提琴 + 低音大提琴.

    這是 Boccherini / Schubert "鱒魚" 等作品的 SQ + DB 編制 (亦稱
    "double bass quintet"). 另一種五重奏編制 (兩把 viola) 為 Mozart
    K.515 等所用, 此處先建模 DB 版.
    """
    return [
        Player(
            player_id="violin_1",
            display_name="Violin I",
            instruments=["violin"],
            primary_instrument="violin",
            staves=1,
        ),
        Player(
            player_id="violin_2",
            display_name="Violin II",
            instruments=["violin"],
            primary_instrument="violin",
            staves=1,
        ),
        Player(
            player_id="viola_1",
            display_name="Viola",
            instruments=["viola"],
            primary_instrument="viola",
            staves=1,
        ),
        Player(
            player_id="cello_1",
            display_name="Violoncello",
            instruments=["cello"],
            primary_instrument="cello",
            staves=1,
        ),
        Player(
            player_id="double_bass_1",
            display_name="Double Bass",
            instruments=["double_bass"],
            primary_instrument="double_bass",
            staves=1,
        ),
    ]


def woodwind_quintet_ensemble() -> list[Player]:
    """傳統木管五重奏: flute / oboe / clarinet / bassoon / horn"""
    return [
        Player(
            player_id="flute_1", display_name="Flute",
            instruments=["flute"], primary_instrument="flute", staves=1,
        ),
        Player(
            player_id="oboe_1", display_name="Oboe",
            instruments=["oboe"], primary_instrument="oboe", staves=1,
        ),
        Player(
            player_id="clarinet_1", display_name="Clarinet (B♭)",
            instruments=["clarinet_bb"], primary_instrument="clarinet_bb",
            staves=1,
        ),
        Player(
            player_id="bassoon_1", display_name="Bassoon",
            instruments=["bassoon"], primary_instrument="bassoon", staves=1,
        ),
        Player(
            player_id="horn_1", display_name="French Horn",
            instruments=["horn_f"], primary_instrument="horn_f", staves=1,
        ),
    ]


def brass_quintet_ensemble() -> list[Player]:
    """傳統銅管五重奏: 2 trumpets / horn / trombone / tuba"""
    return [
        Player(
            player_id="trumpet_1", display_name="Trumpet I",
            instruments=["trumpet_bb"], primary_instrument="trumpet_bb",
            staves=1,
        ),
        Player(
            player_id="trumpet_2", display_name="Trumpet II",
            instruments=["trumpet_bb"], primary_instrument="trumpet_bb",
            staves=1,
        ),
        Player(
            player_id="horn_1", display_name="French Horn",
            instruments=["horn_f"], primary_instrument="horn_f", staves=1,
        ),
        Player(
            player_id="trombone_1", display_name="Trombone",
            instruments=["trombone"], primary_instrument="trombone", staves=1,
        ),
        Player(
            player_id="tuba_1", display_name="Tuba",
            instruments=["tuba"], primary_instrument="tuba", staves=1,
        ),
    ]


def piano_solo_ensemble() -> list[Player]:
    """鋼琴獨奏 (雙手大譜表)。"""
    return [
        Player(
            player_id="piano_1",
            display_name="Piano",
            instruments=["piano"],
            primary_instrument="piano",
            staves=2,
        ),
    ]


def harpsichord_solo_ensemble() -> list[Player]:
    """大鍵琴獨奏 (雙鍵盤大譜表, 巴洛克鍵盤作品標準)。"""
    return [
        Player(
            player_id="harpsichord_1",
            display_name="Harpsichord",
            instruments=["harpsichord"],
            primary_instrument="harpsichord",
            staves=2,
        ),
    ]


def violin_harpsichord_ensemble() -> list[Player]:
    """巴洛克奏鳴曲編制: 小提琴 + 大鍵琴 (continuo)。"""
    return [
        Player(
            player_id="violin_1",
            display_name="Violin",
            instruments=["violin"],
            primary_instrument="violin",
            staves=1,
        ),
        Player(
            player_id="harpsichord_1",
            display_name="Harpsichord",
            instruments=["harpsichord"],
            primary_instrument="harpsichord",
            staves=2,
        ),
    ]


def baroque_trio_sonata_ensemble() -> list[Player]:
    """巴洛克三重奏鳴曲: 兩把小提琴 + 大鍵琴 continuo (含大提琴低音線)。"""
    return [
        Player(
            player_id="violin_1",
            display_name="Violin I",
            instruments=["violin"],
            primary_instrument="violin",
            staves=1,
        ),
        Player(
            player_id="violin_2",
            display_name="Violin II",
            instruments=["violin"],
            primary_instrument="violin",
            staves=1,
        ),
        Player(
            player_id="cello_1",
            display_name="Violoncello",
            instruments=["cello"],
            primary_instrument="cello",
            staves=1,
        ),
        Player(
            player_id="harpsichord_1",
            display_name="Harpsichord",
            instruments=["harpsichord"],
            primary_instrument="harpsichord",
            staves=2,
        ),
    ]


def guitar_solo_ensemble() -> list[Player]:
    """古典吉他獨奏 (單一五線譜)。"""
    return [
        Player(
            player_id="guitar_1",
            display_name="Classical Guitar",
            instruments=["guitar"],
            primary_instrument="guitar",
            staves=1,
        ),
    ]


def lute_solo_ensemble() -> list[Player]:
    """文藝復興魯特琴獨奏 (單一五線譜)。"""
    return [
        Player(
            player_id="lute_1",
            display_name="Renaissance Lute",
            instruments=["lute"],
            primary_instrument="lute",
            staves=1,
        ),
    ]


def harp_solo_ensemble() -> list[Player]:
    """豎琴獨奏 (雙手大譜表, 與鋼琴相同採 2 個 staff)。"""
    return [
        Player(
            player_id="harp_1",
            display_name="Concert Pedal Harp",
            instruments=["harp"],
            primary_instrument="harp",
            staves=2,
        ),
    ]


def flute_guitar_ensemble() -> list[Player]:
    """長笛 + 吉他二重奏 (常見室內樂編制)。"""
    return [
        Player(
            player_id="flute_1",
            display_name="Flute",
            instruments=["flute"],
            primary_instrument="flute",
            staves=1,
        ),
        Player(
            player_id="guitar_1",
            display_name="Classical Guitar",
            instruments=["guitar"],
            primary_instrument="guitar",
            staves=1,
        ),
    ]


# 0.1.55 D: 中提琴 / 大提琴專用編制 — 服務 viola/cello amateur 入口.
# 之前只有 violin_piano + string_quartet, 中提琴/大提琴想當主聲部沒得選.
def viola_piano_ensemble() -> list[Player]:
    """中提琴 + 鋼琴 — Bach Suite viola transposition / Brahms Op.120 之類."""
    return [
        Player(
            player_id="viola_1", display_name="Viola",
            instruments=["viola"], primary_instrument="viola", staves=1,
        ),
        Player(
            player_id="piano_1", display_name="Piano",
            instruments=["piano"], primary_instrument="piano", staves=2,
        ),
    ]


def cello_solo_ensemble() -> list[Player]:
    """大提琴獨奏 — Bach Cello Suites 標配 (BWV 1007-1012)."""
    return [
        Player(
            player_id="cello_1", display_name="Violoncello",
            instruments=["cello"], primary_instrument="cello", staves=1,
        ),
    ]


def cello_piano_ensemble() -> list[Player]:
    """大提琴 + 鋼琴 — Beethoven Op.5 / Brahms Op.38 / 業餘 chamber 標配."""
    return [
        Player(
            player_id="cello_1", display_name="Violoncello",
            instruments=["cello"], primary_instrument="cello", staves=1,
        ),
        Player(
            player_id="piano_1", display_name="Piano",
            instruments=["piano"], primary_instrument="piano", staves=2,
        ),
    ]


# 編制 ID → 構造函式的對照表 (用於 server / CLI dispatch)
ENSEMBLE_TEMPLATES: dict[str, "callable"] = {  # type: ignore[name-defined]
    "violin_piano": violin_piano_ensemble,
    "viola_piano": viola_piano_ensemble,
    "cello_solo": cello_solo_ensemble,
    "cello_piano": cello_piano_ensemble,
    "string_quartet": string_quartet_ensemble,
    "string_quintet": string_quintet_ensemble,
    "piano_solo": piano_solo_ensemble,
    "harpsichord_solo": harpsichord_solo_ensemble,
    "violin_harpsichord": violin_harpsichord_ensemble,
    "baroque_trio_sonata": baroque_trio_sonata_ensemble,
    "woodwind_quintet": woodwind_quintet_ensemble,
    "brass_quintet": brass_quintet_ensemble,
    "guitar_solo": guitar_solo_ensemble,
    "lute_solo": lute_solo_ensemble,
    "harp_solo": harp_solo_ensemble,
    "flute_guitar": flute_guitar_ensemble,
}


def build_ensemble(
    target: str, skill_level: SkillLevel = "professional",
) -> list[Player]:
    """根據目標 ID 構造預設 player 清單。未知 ID 退回 violin_piano。

    skill_level 會被套用到所有 player, 讓下游 arranger / validator 可以據此
    調整 octave 範圍、和弦複雜度上限等 (e.g. amateur 不出現雙音以上和弦)。
    """
    fn = ENSEMBLE_TEMPLATES.get(target)
    players = fn() if fn else violin_piano_ensemble()
    for p in players:
        p.skill_level = skill_level
    return players

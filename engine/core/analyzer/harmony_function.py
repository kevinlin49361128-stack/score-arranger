"""
harmony_function — 羅馬數字和聲分析 (A1b skeleton)

完整規格見 docs/harmony-analysis-spec.md.

當下 (0.1.28) 只有 skeleton — 預留 API 形狀, 實作留給專注期 (1 週).
A1a 啟發式 (0.1.27) 仍在 repair.py 跑著, 守住 80% 場景.

下次 ship 時填:

  1. analyze_harmony(score) → list[HarmonicRegion]
     - 內部跑 KK profile key detection + HMM-based roman numeral analysis
     - 用 Bach BWV 1-371 chorales 當訓練集
  2. find_region_at(regions, quarter_offset) → HarmonicRegion | None
     - 給定整曲時間軸 offset, 二分查 region
  3. 把 HarmonicRegion 接到 repair._harmonic_omit_choice
     V7 致音 (七音) → penalty 極高 (絕對保留)
     N6 / aug6 等特殊和弦 → 也標 high-priority preservation
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from typing import Literal, Optional


@dataclass
class Key:
    """調性. tonic_pc = pitch class 0-11; mode = 'major' / 'minor'."""
    tonic_pc: int
    mode: Literal["major", "minor"]

    @property
    def name(self) -> str:
        pc_names = ["C", "C#", "D", "Eb", "E", "F",
                    "F#", "G", "Ab", "A", "Bb", "B"]
        tonic = pc_names[self.tonic_pc]
        return f"{tonic} {self.mode}"


@dataclass
class RomanNumeral:
    """羅馬數字標記. 例如 V7 / vii°6 / IV6/4 / N6 (拿坡里六和弦)."""
    degree: int  # 1-7
    quality: Literal[
        "major", "minor", "diminished", "augmented",
        "dominant7", "minor7", "major7", "half_diminished",
        "fully_diminished",
    ]
    inversion: int = 0          # 0 = 原位, 1 = 第一轉位, 2, 3
    applied_to: Optional[int] = None  # 副屬: V7/V → applied_to=5
    figure_string: str = ""     # 人類可讀, 例 "V7", "vii°6/V"


@dataclass
class HarmonicRegion:
    """一個和弦在時間軸上的區間."""
    start_quarter: Fraction
    end_quarter: Fraction
    key: Key
    roman: RomanNumeral
    confidence: float = 0.0
    # 該和弦的「理想 pitches」(MIDI pitch class set), 用於 quality / repair
    ideal_pitch_classes: list[int] = field(default_factory=list)
    # 「致音」(必留) — 用於 repair 決定不可省的音
    essential_pitch_classes: list[int] = field(default_factory=list)


# ============================================================================
# Public API — 0.1.28 skeleton only
# ============================================================================

def analyze_harmony(score: object) -> list[HarmonicRegion]:
    """分析整首曲子的和聲, 回傳 list[HarmonicRegion].

    TODO(A1b): 實作 — KK profile key detection + HMM viterbi roman numeral.
    現在回空 list, repair / quality 走 A1a 啟發式 fallback.
    """
    _ = score  # skeleton — 真實實作會吃 Score
    return []


def find_region_at(
    regions: list[HarmonicRegion], quarter_offset: Fraction,
) -> Optional[HarmonicRegion]:
    """給定整曲時間軸 offset, 二分查 region.

    TODO(A1b): regions 空時直接 None, 接到 A1a fallback.
    """
    for r in regions:
        if r.start_quarter <= quarter_offset < r.end_quarter:
            return r
    return None

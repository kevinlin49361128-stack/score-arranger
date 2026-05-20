"""
弦樂指法 DP 最佳化 — Phase 2 spec 補完

對於 violin/viola/cello 的多音和弦, 不再用貪婪 (低音給低弦),
改用窮舉所有合法指派並挑分數最低者。

合法性:
  1. 每個音 ≥ 對應弦的空弦音
  2. 一條弦最多一個音
  3. 使用的弦必須相鄰 (不可跨越未用的弦)
  4. fret ≤ 24

分數 (越低越好):
  - 平均把位高度 (低 fret 較容易)
  - 跨弦把位差 (stretch penalty)
  - 偏好「集中在中段把位」(極端把位扣分)
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations, permutations
from typing import Optional

from core.ir import Pitch

from .base import StringDef


@dataclass
class Fingering:
    """一組指法: 每個音 → (string_index, fret)"""
    assignments: list[tuple[Pitch, int, int]]  # (pitch, string_idx, fret)
    score: float

    @property
    def is_valid(self) -> bool:
        return len(self.assignments) > 0


def find_best_fingering(
    chord_pitches: list[Pitch],
    strings: list[StringDef],
    max_fret: int = 24,
    max_stretch_semitones: int = 6,
) -> Optional[Fingering]:
    """為和弦找出最佳 string→fret 指派。回傳 None 表示不可行。"""
    n = len(chord_pitches)
    if n == 0:
        return Fingering(assignments=[], score=0.0)
    if n > len(strings):
        return None
    if n == 1:
        # 單音: 任一可行弦上最低 fret
        p = chord_pitches[0]
        best: Optional[Fingering] = None
        for s in strings:
            fret = p.midi_number - s.open_pitch.midi_number
            if 0 <= fret <= max_fret:
                cand = Fingering(
                    assignments=[(p, s.index, fret)],
                    score=fret * 1.0,
                )
                if best is None or cand.score < best.score:
                    best = cand
        return best

    # n ≥ 2: 窮舉 n-string 子集 (必須相鄰), 再窮舉指派
    best: Optional[Fingering] = None
    string_count = len(strings)
    # 相鄰子集: 連續 n 條弦的所有起點
    for start in range(string_count - n + 1):
        subset = strings[start:start + n]
        # 在這 n 條弦上嘗試所有 pitch 排列
        for perm in permutations(chord_pitches):
            assignments: list[tuple[Pitch, int, int]] = []
            valid = True
            for pitch, string in zip(perm, subset):
                fret = pitch.midi_number - string.open_pitch.midi_number
                if fret < 0 or fret > max_fret:
                    valid = False
                    break
                assignments.append((pitch, string.index, fret))
            if not valid:
                continue
            # 計算分數
            non_open_frets = [a[2] for a in assignments if a[2] > 0]
            if len(non_open_frets) >= 2:
                stretch = max(non_open_frets) - min(non_open_frets)
                if stretch > max_stretch_semitones:
                    continue
            else:
                stretch = 0
            avg_fret = sum(a[2] for a in assignments) / n
            # 分數: 平均把位 + 伸展懲罰 + 極端把位懲罰
            score = avg_fret + stretch * 0.5
            if avg_fret > 7:  # 第 7 把位以上開始扣分
                score += (avg_fret - 7) * 0.8
            cand = Fingering(assignments=assignments, score=score)
            if best is None or cand.score < best.score:
                best = cand
    return best

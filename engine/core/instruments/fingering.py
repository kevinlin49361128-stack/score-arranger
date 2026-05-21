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

跨事件 Viterbi DP (find_best_fingering_sequence):
  - 狀態: event i 的一個候選指法
  - emission cost: 上述單和弦分數
  - transition cost: |手部中心把位差| × TRANSITION_WEIGHT
    手部中心 = 所有按弦 fret 的均值 (純空弦事件 = 0)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from itertools import combinations, permutations
from typing import Optional

from core.ir import Pitch

from .base import StringDef

# 跨事件換把位懲罰權重: 把位差每格 penalty TRANSITION_WEIGHT 分
TRANSITION_WEIGHT: float = 0.4


@dataclass
class Fingering:
    """一組指法: 每個音 → (string_index, fret)"""

    assignments: list[tuple[Pitch, int, int]]  # (pitch, string_idx, fret)
    score: float

    @property
    def is_valid(self) -> bool:
        return len(self.assignments) > 0

    @property
    def hand_center(self) -> float:
        """按弦 fret 均值, 用於跨事件換把位計算。純空弦 → 0.0"""
        stopped = [fret for _, _, fret in self.assignments if fret > 0]
        return sum(stopped) / len(stopped) if stopped else 0.0


# ---------------------------------------------------------------------------
# 內部共用 helper
# ---------------------------------------------------------------------------


def _enumerate_candidates(
    chord_pitches: list[Pitch],
    strings: list[StringDef],
    max_fret: int = 24,
    max_stretch_semitones: int = 6,
    require_adjacent: bool = True,
) -> list[Fingering]:
    """枚舉一個和弦所有合法 Fingering 候選, 依分數升序排列。

    空列表 chord_pitches → 回傳含單一 score=0 Fingering (休止符/空事件)。
    候選數不可行 → 回傳空列表。

    require_adjacent:
      True (預設) — 使用的弦必須相鄰 (擦弦樂器: violin/viola/cello 一弓只能
        掃過連續的弦)。維持既有行為, 對應 strings[start:start+n] 連續子集。
      False — 允許跨越未使用的弦 (撥弦樂器: 吉他/魯特琴可以略過/悶住中間弦,
        各弦獨立撥)。改為枚舉所有大小為 n 的弦子集。
    """
    n = len(chord_pitches)
    if n == 0:
        return [Fingering(assignments=[], score=0.0)]
    if n > len(strings):
        return []

    candidates: list[Fingering] = []

    if n == 1:
        p = chord_pitches[0]
        for s in strings:
            fret = p.midi_number - s.open_pitch.midi_number
            if 0 <= fret <= max_fret:
                score = fret * 1.0
                if fret > 7:
                    score += (fret - 7) * 0.8
                candidates.append(Fingering(assignments=[(p, s.index, fret)], score=score))
    else:
        string_count = len(strings)
        if require_adjacent:
            # 擦弦: 只取連續弦子集
            subsets = [
                strings[start : start + n]
                for start in range(string_count - n + 1)
            ]
        else:
            # 撥弦: 任意 n 條弦組合 (可跨越未用弦)
            subsets = [list(c) for c in combinations(strings, n)]
        for subset in subsets:
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
                non_open_frets = [a[2] for a in assignments if a[2] > 0]
                if len(non_open_frets) >= 2:
                    stretch = max(non_open_frets) - min(non_open_frets)
                    if stretch > max_stretch_semitones:
                        continue
                else:
                    stretch = 0
                avg_fret = sum(a[2] for a in assignments) / n
                score = avg_fret + stretch * 0.5
                if avg_fret > 7:
                    score += (avg_fret - 7) * 0.8
                candidates.append(Fingering(assignments=list(assignments), score=score))

    candidates.sort(key=lambda f: f.score)
    return candidates


# ---------------------------------------------------------------------------
# 公開 API — 單和弦 (保持原始簽名)
# ---------------------------------------------------------------------------


def find_best_fingering(
    chord_pitches: list[Pitch],
    strings: list[StringDef],
    max_fret: int = 24,
    max_stretch_semitones: int = 6,
    require_adjacent: bool = True,
) -> Optional[Fingering]:
    """為和弦找出最佳 string→fret 指派。回傳 None 表示不可行。

    require_adjacent: 見 _enumerate_candidates。預設 True 保留擦弦樂器行為。
    """
    candidates = _enumerate_candidates(
        chord_pitches,
        strings,
        max_fret=max_fret,
        max_stretch_semitones=max_stretch_semitones,
        require_adjacent=require_adjacent,
    )
    return candidates[0] if candidates else None


# ---------------------------------------------------------------------------
# 公開 API — 跨事件 Viterbi DP
# ---------------------------------------------------------------------------


def find_best_fingering_sequence(
    chords: list[list[Pitch]],
    strings: list[StringDef],
    max_fret: int = 24,
    max_stretch_semitones: int = 6,
    transition_weight: float = TRANSITION_WEIGHT,
) -> list[Optional[Fingering]]:
    """Viterbi DP: 對一段聲部的和弦序列找出總代價最低的指法路徑。

    Args:
        chords: 每個事件的音高列表 (空列表 = 休止符)。
        strings: 樂器弦定義。
        max_fret: 最大把位。
        max_stretch_semitones: 跨弦最大音程。
        transition_weight: 換把位懲罰係數 (把位差 × transition_weight)。

    Returns:
        長度與 chords 相同的列表; 若某事件無合法指法則回傳 None。
        None 事件會重置連續性 (視同換把位 0)。
    """
    T = len(chords)
    if T == 0:
        return []

    # 1. 枚舉每個時間步的候選
    all_candidates: list[list[Fingering]] = [
        _enumerate_candidates(
            chord, strings, max_fret=max_fret, max_stretch_semitones=max_stretch_semitones
        )
        for chord in chords
    ]

    # 若某步驟無候選 → 該位置一定是 None; 為了讓 DP 跨越斷點,
    # 用 sentinel Fingering(score=inf) 暫代, 最後再換回 None。
    _SENTINEL = Fingering(assignments=[], score=math.inf)

    processed: list[list[Fingering]] = [
        cands if cands else [_SENTINEL] for cands in all_candidates
    ]

    INF = math.inf

    # dp[i][k] = 到達 step i 選第 k 個候選時的累積最低代價
    # back[i][k] = 回溯指標 (step i-1 的最優前驅 index)
    dp: list[list[float]] = []
    back: list[list[int]] = []

    # 初始化 step 0
    dp.append([f.score for f in processed[0]])
    back.append([-1] * len(processed[0]))

    # 逐步 Viterbi
    for t in range(1, T):
        prev = processed[t - 1]
        curr = processed[t]
        dp_t: list[float] = []
        back_t: list[int] = []
        for k, cand in enumerate(curr):
            best_cost = INF
            best_prev = 0
            emission = cand.score
            if emission == INF:
                # 無合法指法 → sentinel, 不計算轉換代價
                dp_t.append(INF)
                back_t.append(0)
                continue
            for j, prev_cand in enumerate(prev):
                if dp[t - 1][j] == INF:
                    continue
                trans = (
                    abs(cand.hand_center - prev_cand.hand_center)
                    * transition_weight
                )
                total = dp[t - 1][j] + trans + emission
                if total < best_cost:
                    best_cost = total
                    best_prev = j
            if best_cost == INF:
                # 前一步全無合法指法 (斷點) → 此步重新起算, 不被 cascade 毒化
                best_cost = emission
                best_prev = 0
            dp_t.append(best_cost)
            back_t.append(best_prev)
        dp.append(dp_t)
        back.append(back_t)

    # 回溯: 從最後一步找最優結尾
    last_costs = dp[T - 1]
    best_last = int(min(range(len(last_costs)), key=lambda k: last_costs[k]))

    path: list[int] = [0] * T
    path[T - 1] = best_last
    for t in range(T - 2, -1, -1):
        path[t] = back[t + 1][path[t + 1]]

    # 組裝結果, sentinel → None
    result: list[Optional[Fingering]] = []
    for t in range(T):
        chosen = processed[t][path[t]]
        if chosen.score == INF:
            result.append(None)
        else:
            result.append(chosen)

    return result

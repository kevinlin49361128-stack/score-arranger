"""
Voice-leading 檢查 — 平行五度 / 平行八度 偵測.

古典樂理中, 兩個聲部以相同方向移動且維持完全五度 / 完全八度 (或同音),
是極為突兀的錯誤. 改編引擎自動分配聲部時容易不小心造成.

偵測演算法:
  1. 取所有 part 兩兩配對
  2. 對每一對, 取它們的 note onset 對齊點 (兩部都有音的時間點)
  3. 相鄰兩個對齊點之間: 若兩部同向移動 (都升或都降),
     且前後兩個垂直音程都是完全五度 (7 半音) 或完全八度 / 同音 (0 / 12),
     → 平行動進違規
  4. 純重複音 (兩部都沒動) 不算違規

輸出 LocatedIssue (warning), 掛在後一個對齊點、較高音部的事件上.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Optional

from .instruments.base import CheckResult
from .ir import ChordEvent, NoteEvent, Part, Score


@dataclass
class _Onset:
    """一個 part 在某時間點的代表音 (取最高音當聲部線條)."""
    measure: int
    onset: Fraction
    midi: int
    event_index: int
    voice_id: int


def _extract_line(part: Part) -> list[_Onset]:
    """抽出一個 part 的單聲部線條 (每個 onset 取最高音)."""
    line: list[_Onset] = []
    for measure in part.measures:
        for voice_id, voice in measure.voices.items():
            if voice.is_divisi:
                continue
            for idx, ev in enumerate(voice.events):
                midi: Optional[int] = None
                if isinstance(ev, NoteEvent):
                    midi = ev.pitch.midi_number
                elif isinstance(ev, ChordEvent):
                    midi = max(p.midi_number for p in ev.pitches)
                if midi is None:
                    continue
                line.append(_Onset(
                    measure=measure.number,
                    onset=ev.onset,
                    midi=midi,
                    event_index=idx,
                    voice_id=voice_id,
                ))
    line.sort(key=lambda o: (o.measure, o.onset))
    return line


def _is_perfect(interval: int) -> Optional[str]:
    """回傳 'fifth' / 'octave' / None — interval 為兩音 midi 差的絕對值."""
    mod = interval % 12
    if mod == 7:
        return "fifth"
    if mod == 0:
        return "octave"
    return None


def detect_parallel_motion(score: Score):
    """偵測平行五度 / 平行八度. 回傳 list[LocatedIssue]."""
    from .repair import LocatedIssue

    issues: list[LocatedIssue] = []
    parts = score.parts
    for i in range(len(parts)):
        for j in range(i + 1, len(parts)):
            line_a = _extract_line(parts[i])
            line_b = _extract_line(parts[j])
            issues.extend(
                _check_pair(parts[j], line_a, line_b, LocatedIssue)
            )
    return issues


def detect_hidden_parallels(score: Score):
    """偵測隱伏五度 / 隱伏八度 (hidden / direct parallels).

    古典樂理: 兩聲部以同向動進 (similar motion) 抵達一個完全五度或完全
    八度, 且至少一個聲部 (傳統上指上聲部) 是跳進 (leap, >2 半音) → 被
    視為違規, 因為聽起來像平行五/八度的「弱化版」.

    判斷:
    - 兩部同向
    - 目的音程是 P5 / P8 (mod 12 = 7 或 0)
    - 起始音程不是 P5 / P8 (否則就是真正的平行, 由 detect_parallel_motion 處理)
    - 至少一個聲部跳超過 2 半音
    """
    from .repair import LocatedIssue

    issues: list[LocatedIssue] = []
    parts = score.parts
    for i in range(len(parts)):
        for j in range(i + 1, len(parts)):
            line_a = _extract_line(parts[i])
            line_b = _extract_line(parts[j])
            issues.extend(
                _check_pair_hidden(parts[j], line_a, line_b, LocatedIssue)
            )
    return issues


def _check_pair_hidden(
    part_b: Part,
    line_a: list[_Onset],
    line_b: list[_Onset],
    LocatedIssue,
) -> list:
    """檢查兩聲部間的隱伏五/八度."""
    issues = []
    b_by_pos: dict[tuple[int, Fraction], _Onset] = {
        (o.measure, o.onset): o for o in line_b
    }
    common: list[tuple[_Onset, _Onset]] = []
    for oa in line_a:
        ob = b_by_pos.get((oa.measure, oa.onset))
        if ob is not None:
            common.append((oa, ob))
    common.sort(key=lambda pair: (pair[0].measure, pair[0].onset))

    for k in range(len(common) - 1):
        a1, b1 = common[k]
        a2, b2 = common[k + 1]
        move_a = a2.midi - a1.midi
        move_b = b2.midi - b1.midi
        # 必須兩部都動且同向 (similar motion)
        if move_a == 0 or move_b == 0:
            continue
        if (move_a > 0) != (move_b > 0):
            continue
        int1 = _is_perfect(abs(a1.midi - b1.midi))
        int2 = _is_perfect(abs(a2.midi - b2.midi))
        # 目的音程必須是 P5/P8, 起始音程不可是同類 P5/P8
        # (相同類型已歸真正平行, 由 detect_parallel_motion 處理)
        if int2 is None:
            continue
        if int1 is not None and int1 == int2:
            continue
        # 至少一聲部跳進 (>2 半音 = 大於大二度)
        if abs(move_a) <= 2 and abs(move_b) <= 2:
            continue
        code = (
            "W_HIDDEN_FIFTHS" if int2 == "fifth"
            else "W_HIDDEN_OCTAVES"
        )
        issues.append(LocatedIssue(
            part_id=part_b.part_id,
            measure_number=b2.measure,
            voice_id=b2.voice_id,
            event_index=b2.event_index,
            result=CheckResult(
                severity="warning",
                code=code,
                params={
                    "interval": int2,
                    "from_measure": b1.measure,
                    "to_measure": b2.measure,
                },
                difficulty_score=0.0,
            ),
        ))
    return issues


def _check_pair(
    part_b: Part,
    line_a: list[_Onset],
    line_b: list[_Onset],
    LocatedIssue,
) -> list:
    """檢查兩個聲部線條間的平行動進.

    issue 掛在 part_b (配對中後者) 的後一個對齊點事件上.
    """
    issues = []
    # 用 (measure, onset) 把 line_b 建索引
    b_by_pos: dict[tuple[int, Fraction], _Onset] = {
        (o.measure, o.onset): o for o in line_b
    }
    # 取兩部共同的對齊點 (sorted)
    common: list[tuple[_Onset, _Onset]] = []
    for oa in line_a:
        ob = b_by_pos.get((oa.measure, oa.onset))
        if ob is not None:
            common.append((oa, ob))
    common.sort(key=lambda pair: (pair[0].measure, pair[0].onset))

    for k in range(len(common) - 1):
        a1, b1 = common[k]
        a2, b2 = common[k + 1]
        # 兩部的移動方向
        move_a = a2.midi - a1.midi
        move_b = b2.midi - b1.midi
        # 都沒動 → 不算平行動進
        if move_a == 0 and move_b == 0:
            continue
        # 必須同向 (都升或都降)
        if (move_a > 0) != (move_b > 0):
            continue
        if move_a == 0 or move_b == 0:
            continue  # 一部不動 = 斜向, 不算平行
        int1 = _is_perfect(abs(a1.midi - b1.midi))
        int2 = _is_perfect(abs(a2.midi - b2.midi))
        # 前後都是同一種完全音程才算平行
        if int1 is None or int2 is None or int1 != int2:
            continue
        code = (
            "W_PARALLEL_FIFTHS" if int1 == "fifth"
            else "W_PARALLEL_OCTAVES"
        )
        issues.append(LocatedIssue(
            part_id=part_b.part_id,
            measure_number=b2.measure,
            voice_id=b2.voice_id,
            event_index=b2.event_index,
            result=CheckResult(
                severity="warning",
                code=code,
                params={
                    "interval": int1,
                    "from_measure": b1.measure,
                    "to_measure": b2.measure,
                },
                difficulty_score=0.0,
            ),
        ))
    return issues

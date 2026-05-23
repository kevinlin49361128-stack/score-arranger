"""
Voice-leading DP — 改編後對內聲部跑 Viterbi DP, 把每個音的八度選到
最小化平行五度 / 八度、聲部交叉、過大跳的位置。

設計選擇:
- 只對 HARMONY_FILL / COUNTERMELODY 等「內聲部」動手. MELODY / BASS
  的位置由 source 決定 (使用者已聽過 / 期待原樣), 不去動它。
- 候選只給「原音 ± 12 半音」 (上下八度). 不換音高 spelling, 不更動
  和聲, 只挑「擺哪個八度」這一維。這是最保守的 voice-leading 修飾,
  改動小, 不會誤改使用者的編輯。
- 越界候選 (instrument range_practical 外) 直接濾掉.
- 跟外聲部 (MELODY/BASS) 比對成本; 內聲部彼此之間先不互相影響
  (避免 O(N×M^k) 爆炸; 多 inner voice 是少數情況)。

cost 模型:
- W_PARALLEL = 1000 — 跟任一外聲部走平行 5/8 (致命錯誤)
- W_CROSS_MELODY = 100 — 高過 MELODY (內聲部越過外聲部, 鋼琴譜可,
  弦樂編制不可; MVP 用統一懲罰)
- W_CROSS_BASS = 100 — 低過 BASS
- W_LEAP = 1.0 * (semitones) — penalize 內聲部跳進
- W_OUT_OF_COMFORT = 5 — 超出 instrument comfortable range
- W_DIFF_FROM_ORIG = 0.5 * (semitones) — 平局時 prefer 不動原音
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .arrangement_model import Arrangement
from .instruments import get_profile
from .ir import (
    ChordEvent,
    NoteEvent,
    Part,
    Pitch,
    Score,
    VoiceFunction,
)


W_PARALLEL = 1000.0
W_CROSS_MELODY = 100.0
W_CROSS_BASS = 100.0
W_LEAP = 1.0
W_OUT_OF_COMFORT = 5.0
W_DIFF_FROM_ORIG = 0.5

# 平行音程: 完全五度 (7 半音) / 完全八度 / 同音 (0 / 12, mod 12 = 0)
_PERFECT_MODS = {0, 7}


@dataclass
class _Slot:
    """一個 (part_id, measure_idx, voice_id, event_idx) 的可優化位置."""
    part_id: str
    measure_number: int
    voice_id: int
    event_index: int
    original_midi: int
    # 該位置同時的外聲部音 (MELODY / BASS) — None 表示該外聲部此 onset 無音
    melody_midi: Optional[int]
    bass_midi: Optional[int]
    # v2: 已優化過的其他內聲部音, 用來檢測 inner ↔ inner 平行 / 交叉.
    # list[Optional[int]] 因為可能有多個 inner reference, 每個各自獨立比.
    other_inner_midis: list[Optional[int]] = field(default_factory=list)


@dataclass
class VoiceLeadingDPResult:
    optimized_count: int = 0
    skipped_parts: list[str] = None
    cost_before: float = 0.0
    cost_after: float = 0.0

    def __post_init__(self):
        if self.skipped_parts is None:
            self.skipped_parts = []


def optimize_inner_voices(arrangement: Arrangement) -> VoiceLeadingDPResult:
    """對 arrangement.target_score 內所有「內聲部」part 跑 Viterbi DP.

    Mutates arrangement.target_score in place. 安全地跳過 MELODY / BASS /
    使用者編輯過 (is_user_edited) 的 measure.
    """
    result = VoiceLeadingDPResult()
    target = arrangement.target_score
    if target is None or not target.parts:
        return result

    # 找出哪些 target part 是「內聲部」: 該 part 對應的 assignment 不是
    # MELODY / BASS / PEDAL. 用 (player_id, staff) 對照.
    inner_part_ids: set[str] = set()
    for part in target.parts:
        # 從 part_id 推 player_id + staff
        # build_target_score 規則: part_id = f"{player_id}_{staff}" (除 main 外)
        # main → part_id = player_id
        functions: set[VoiceFunction] = set()
        for a in arrangement.assignments:
            staff_suffix = "" if a.target_staff == "main" else f"_{a.target_staff}"
            candidate_pid = f"{a.target_player_id}{staff_suffix}"
            if candidate_pid == part.part_id:
                functions.add(a.function)
        if not functions:
            continue
        if (functions
                & {VoiceFunction.MELODY, VoiceFunction.BASS,
                   VoiceFunction.PEDAL}):
            continue
        if VoiceFunction.HARMONY_FILL in functions \
                or VoiceFunction.COUNTERMELODY in functions:
            inner_part_ids.add(part.part_id)

    if not inner_part_ids:
        result.skipped_parts.append("no inner voices to optimize")
        return result

    # 預算外聲部 (MELODY / BASS) 在每個 (measure, onset) 上的音 — 用來算平行/交叉
    melody_map = _build_outer_map(arrangement, VoiceFunction.MELODY)
    bass_map = _build_outer_map(arrangement, VoiceFunction.BASS)

    # v2: sequential greedy — 把已優化的 inner 當下一個 inner 的「outer」.
    # full joint DP 對 N inner * K cand 太貴 (O(K^N · M)); 依 part_id 排序後
    # sequential 是 O(N · K · M), 實用上效果接近. 順序固定 (sorted) 確保結果可重現.
    inner_optimized_maps: list[dict[tuple[int, float], int]] = []

    for part in sorted(
        (p for p in target.parts if p.part_id in inner_part_ids),
        key=lambda p: p.part_id,
    ):
        slots = _collect_slots(
            part, melody_map, bass_map, inner_optimized_maps,
        )
        if not slots:
            continue
        profile = get_profile(part.instrument_id)
        if profile is None:
            continue
        cmf_lo, cmf_hi = profile.range_comfortable
        prac_lo, prac_hi = profile.range_absolute

        # 對每個 slot 生候選 (原音 ± 12, 過濾出 practical range 內的)
        candidates_per_slot: list[list[int]] = []
        for slot in slots:
            cands = [slot.original_midi - 12, slot.original_midi,
                     slot.original_midi + 12]
            cands = [c for c in cands if prac_lo <= c <= prac_hi]
            if not cands:
                cands = [slot.original_midi]  # 保留原音 (out-of-range 的限制不動)
            candidates_per_slot.append(cands)

        # Viterbi: dp[i][cidx] = (min_cost, prev_cidx)
        n = len(slots)
        dp: list[list[tuple[float, int]]] = [
            [(float("inf"), -1) for _ in row] for row in candidates_per_slot
        ]
        # base layer
        for ci, c in enumerate(candidates_per_slot[0]):
            dp[0][ci] = (_state_cost(c, slots[0], cmf_lo, cmf_hi), -1)
        # forward
        for i in range(1, n):
            slot = slots[i]
            prev_slot = slots[i - 1]
            for ci, c in enumerate(candidates_per_slot[i]):
                best = (float("inf"), -1)
                for pci, pc in enumerate(candidates_per_slot[i - 1]):
                    prev_cost, _ = dp[i - 1][pci]
                    trans = _transition_cost(pc, c, prev_slot, slot)
                    state = _state_cost(c, slot, cmf_lo, cmf_hi)
                    total = prev_cost + trans + state
                    if total < best[0]:
                        best = (total, pci)
                dp[i][ci] = best

        # traceback
        final_costs = dp[n - 1]
        end_ci = min(range(len(final_costs)), key=lambda i: final_costs[i][0])
        chosen: list[int] = [0] * n
        chosen[n - 1] = candidates_per_slot[n - 1][end_ci]
        ci = end_ci
        for i in range(n - 1, 0, -1):
            _, prev_ci = dp[i][ci]
            ci = prev_ci
            chosen[i - 1] = candidates_per_slot[i - 1][ci]

        # 寫回 part — 只動 pitch.midi_number, spelling 不變 (留給 IR→XML 處理)
        for slot, new_midi in zip(slots, chosen):
            if new_midi == slot.original_midi:
                continue
            measure = next(
                (m for m in part.measures if m.number == slot.measure_number),
                None,
            )
            if measure is None:
                continue
            voice = measure.voices.get(slot.voice_id)
            if voice is None or slot.event_index >= len(voice.events):
                continue
            ev = voice.events[slot.event_index]
            if isinstance(ev, NoteEvent):
                # Pitch 是 frozen dataclass → 整個換掉新音高. 跨八度 spelling
                # 改變 (e.g. C4 → C5), 用簡易演算法重新算 (保留 # / b).
                ev.pitch = _shift_pitch(ev.pitch, new_midi)
                result.optimized_count += 1

        result.cost_before += _path_cost(
            [s.original_midi for s in slots], slots, cmf_lo, cmf_hi,
        )
        result.cost_after += _path_cost(chosen, slots, cmf_lo, cmf_hi)

        # v2: 把這一輪的結果寫進 inner_optimized_maps, 下個 inner 算成本時
        # 會把它當 outer reference, 一起檢測平行/交叉.
        optimized_map: dict[tuple[int, float], int] = {}
        for slot, new_midi in zip(slots, chosen):
            optimized_map[
                (slot.measure_number, float(_slot_onset(slot, part)))
            ] = new_midi
        inner_optimized_maps.append(optimized_map)

    return result


def _slot_onset(slot: _Slot, part: Part) -> float:
    """從 slot 拿到 onset (float). slot 沒存 onset, 從 part 反查."""
    for m in part.measures:
        if m.number != slot.measure_number:
            continue
        v = m.voices.get(slot.voice_id)
        if v is None or slot.event_index >= len(v.events):
            continue
        return float(v.events[slot.event_index].onset)
    return 0.0


def _build_outer_map(
    arrangement: Arrangement,
    function: VoiceFunction,
) -> dict[tuple[int, float], int]:
    """收集外聲部 (MELODY/BASS) 在每個 (measure, onset) 上的音.

    用 source_score 而非 target_score — source 是「使用者期待」的外聲部音,
    target 上 MELODY 可能還沒寫完。
    """
    out: dict[tuple[int, float], int] = {}
    source = arrangement.source_score
    if source is None:
        return out
    outer_part_ids = {
        a.source_part_id for a in arrangement.assignments
        if a.function == function
    }
    for part in source.parts:
        if part.part_id not in outer_part_ids:
            continue
        for measure in part.measures:
            voices_iter = (
                measure.voices.values()
                if isinstance(measure.voices, dict) else measure.voices
            )
            for voice in voices_iter:
                branches = (voice.divisi_branches
                            if voice.is_divisi and voice.divisi_branches
                            else [voice])
                for v in branches:
                    for ev in v.events:
                        midi: Optional[int] = None
                        if isinstance(ev, NoteEvent):
                            midi = ev.pitch.midi_number
                        elif isinstance(ev, ChordEvent):
                            # MELODY 取最高音, BASS 取最低音
                            if function == VoiceFunction.MELODY:
                                midi = max(p.midi_number for p in ev.pitches)
                            else:
                                midi = min(p.midi_number for p in ev.pitches)
                        if midi is None:
                            continue
                        key = (measure.number, float(ev.onset))
                        # 多 part 共有此 function → 取最高 (MELODY) / 最低 (BASS)
                        if key in out:
                            if function == VoiceFunction.MELODY:
                                out[key] = max(out[key], midi)
                            else:
                                out[key] = min(out[key], midi)
                        else:
                            out[key] = midi
    return out


def _collect_slots(
    part: Part,
    melody_map: dict[tuple[int, float], int],
    bass_map: dict[tuple[int, float], int],
    inner_optimized_maps: Optional[list[dict[tuple[int, float], int]]] = None,
) -> list[_Slot]:
    """從 part 抽出可優化的 NoteEvent 位置 (跳過 ChordEvent / Rest / divisi).

    inner_optimized_maps: v2 — 已優化過的其他 inner voices, 拿來算
        inner-inner 平行/交叉. 順序保留, 後續比對逐個獨立檢查.

    被使用者編輯過 (is_user_edited) 的 measure 不動 — 尊重使用者的選擇。
    """
    inner_optimized_maps = inner_optimized_maps or []
    slots: list[_Slot] = []
    for measure in part.measures:
        if getattr(measure, "is_user_edited", False):
            continue
        for voice_id, voice in measure.voices.items():
            if voice.is_divisi:
                continue
            for idx, ev in enumerate(voice.events):
                if not isinstance(ev, NoteEvent):
                    continue
                key = (measure.number, float(ev.onset))
                slots.append(_Slot(
                    part_id=part.part_id,
                    measure_number=measure.number,
                    voice_id=voice_id,
                    event_index=idx,
                    original_midi=ev.pitch.midi_number,
                    melody_midi=melody_map.get(key),
                    bass_midi=bass_map.get(key),
                    other_inner_midis=[
                        m.get(key) for m in inner_optimized_maps
                    ],
                ))
    return slots


def _state_cost(midi: int, slot: _Slot, cmf_lo: int, cmf_hi: int) -> float:
    """跟此 slot 的外聲部關係 + 音域 + 偏離原音的成本 (跟「前一音」無關)."""
    cost = 0.0
    if slot.melody_midi is not None and midi > slot.melody_midi:
        cost += W_CROSS_MELODY
    if slot.bass_midi is not None and midi < slot.bass_midi:
        cost += W_CROSS_BASS
    if midi < cmf_lo or midi > cmf_hi:
        cost += W_OUT_OF_COMFORT
    cost += W_DIFF_FROM_ORIG * abs(midi - slot.original_midi)
    return cost


def _transition_cost(
    prev_midi: int, midi: int,
    prev_slot: _Slot, slot: _Slot,
) -> float:
    """從 prev_midi → midi 的轉移成本 (大跳 + 平行 5/8).

    v2: 平行偵測除了 MELODY/BASS, 還包含「先前已優化過的內聲部」 — 修掉
    smoke test 0.1.16 發現的「25 個 V2↔Viola 平行八度」漏網。
    """
    cost = W_LEAP * abs(midi - prev_midi)
    # 收集要比的外聲部 pair (prev, curr): MELODY/BASS + 已優化內聲部
    ref_pairs: list[tuple[int, int]] = []
    if prev_slot.melody_midi is not None and slot.melody_midi is not None:
        ref_pairs.append((prev_slot.melody_midi, slot.melody_midi))
    if prev_slot.bass_midi is not None and slot.bass_midi is not None:
        ref_pairs.append((prev_slot.bass_midi, slot.bass_midi))
    for prev_inner, curr_inner in zip(
        prev_slot.other_inner_midis, slot.other_inner_midis,
    ):
        if prev_inner is not None and curr_inner is not None:
            ref_pairs.append((prev_inner, curr_inner))

    for outer_prev, outer_curr in ref_pairs:
        move_inner = midi - prev_midi
        move_outer = outer_curr - outer_prev
        if move_inner == 0 or move_outer == 0:
            continue
        if (move_inner > 0) != (move_outer > 0):
            continue  # 反向 / 斜向 OK
        int_prev = abs(outer_prev - prev_midi) % 12
        int_curr = abs(outer_curr - midi) % 12
        if int_prev in _PERFECT_MODS and int_curr in _PERFECT_MODS \
                and int_prev == int_curr:
            cost += W_PARALLEL
    return cost


def _shift_pitch(old: Pitch, new_midi: int) -> Pitch:
    """把 Pitch 換到 new_midi 八度. 保留 spelling 字母 + 變化音, 只更新數字."""
    new_octave = (new_midi // 12) - 1
    # spelling 形如 "C4" / "F#5" / "Bb3"; 取字母 + 變化音, 換 octave 數字
    letter_part = old.spelling.rstrip("0123456789-")
    return Pitch(
        midi_number=new_midi,
        spelling=f"{letter_part}{new_octave}",
        written_midi=old.written_midi,
        written_spelling=old.written_spelling,
    )


def _path_cost(
    midis: list[int], slots: list[_Slot], cmf_lo: int, cmf_hi: int,
) -> float:
    """整條路徑成本 (debug / metric 用)."""
    total = 0.0
    for i, (m, s) in enumerate(zip(midis, slots)):
        total += _state_cost(m, s, cmf_lo, cmf_hi)
        if i > 0:
            total += _transition_cost(midis[i - 1], m, slots[i - 1], s)
    return total

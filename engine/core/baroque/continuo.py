"""
Continuo realization — 從 bass line 自動生成大鍵琴右手和聲填充.

簡化策略 (Phase 1, 規則式):
  1. 找 source 的 BASS-tagged part (cello / bass_voice / double_bass / 8va bass).
  2. 偵測 source 整體調性 (music21 key analysis).
  3. 對 bass 的每個音, 用 figured bass 標記 (若有) 或 default 5-3 (root position
     diatonic triad) 推算上方和聲.
  4. 把和聲填到 target 的 harpsichord upper staff (player_id="harpsichord_1",
     staff="upper").

注意:
- 不嘗試「voice leading 完美」, 只求 functional 正確 (對應的 chord tone)
- 避免太密 (每拍一個和弦, 不分拍細放)
- 若 source 已標 figured bass, 優先用標記; 否則 fallback 為 diatonic 推測.

0.1.56 L2: 加 voice-leading post-process — 在寫入 ChordEvent 前用 viterbi-like
DP 對相鄰 chord 篩選 voicing, 懲罰平行五度/八度 (相鄰兩音上下聲部同方向走
完全 5/8 度 = baroque counterpoint 錯誤). 用 octave 位移生成候選, 不重新拼
和弦音高內容.

未來擴充:
- 解析 MusicXML 的 <figured-bass> 元素 (已實作)
- LLM-augmented voicing (給 baroque style examples)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from typing import Optional

from ..arrangement_model import Arrangement
from ..instruments import get_profile
from ..ir import (
    ChordEvent,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Voice,
    VoiceFunction,
)


@dataclass
class ContinuoRealizationResult:
    realized_chord_count: int = 0
    target_player_id: Optional[str] = None
    skipped_reason: Optional[str] = None
    notes: list[str] = field(default_factory=list)


# Diatonic triads (root, third, fifth) for each scale degree in major / minor
# Returns set of semitone offsets above the bass pitch.
# 大調: I = M3+P5, ii = m3+P5, iii = m3+P5, IV = M3+P5, V = M3+P5, vi = m3+P5, vii° = m3+TT
# 簡化: 直接用 diatonic 第三 + 五度 (上方七音內取最近)
_MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]  # ionian
_MINOR_SCALE_SEMITONES = [0, 2, 3, 5, 7, 8, 10]  # natural minor


def _diatonic_chord_above(
    bass_midi: int,
    tonic_pc: int,
    is_major: bool,
    scale_degrees: tuple[int, ...] = (3, 5),
) -> list[int]:
    """從調性 + bass 推 chord 的上方音 (預設 3rd + 5th = 5-3 triad).

    scale_degrees: 從 bass 算的「scale step 距離」, 例:
        (3, 5) → 預設 5-3 三和弦 (3rd + 5th)
        (3, 6) → 第一轉位 (6-3): 3rd + 6th
        (4, 6) → 第二轉位 (6-4): 4th + 6th
        (3, 5, 7) → 七和弦
    回傳對應 midi 數字 list; 若無法判定 (bass 不在音階上), 回傳 [].
    """
    scale = _MAJOR_SCALE_SEMITONES if is_major else _MINOR_SCALE_SEMITONES
    pc_offset = (bass_midi - tonic_pc) % 12
    if pc_offset not in scale:
        return []
    degree = scale.index(pc_offset)
    # scale step 1 → degree+0, scale step 3 → degree+2, scale step 5 → degree+4...
    out_pcs = [scale[(degree + (step - 1)) % 7] for step in scale_degrees]

    def first_above(target_pc: int) -> int:
        m = (bass_midi // 12) * 12 + ((tonic_pc + target_pc) % 12)
        while m <= bass_midi:
            m += 12
        return m
    return [first_above(pc) for pc in out_pcs]


def _diatonic_triad_above(
    bass_midi: int, tonic_pc: int, is_major: bool,
) -> list[int]:
    """5-3 三和弦的捷徑 — 留作後相容. 內部直接呼叫 _diatonic_chord_above."""
    return _diatonic_chord_above(bass_midi, tonic_pc, is_major, (3, 5))


def realize_continuo(
    arrangement: Arrangement,
    target_player_id: str = "harpsichord_1",
    target_staff: str = "upper",
) -> ContinuoRealizationResult:
    """從 source bass line 生成 continuo 和聲填充到 target.

    Mutates arrangement.target_score in place. 假設目標 (player_id, staff)
    存在於 target_score, 通常用 baroque_trio_sonata / violin_harpsichord ensemble.
    """
    result = ContinuoRealizationResult(target_player_id=target_player_id)

    if arrangement.target_score is None or arrangement.source_score is None:
        result.skipped_reason = "no source/target score"
        return result

    # 找目標 part
    target_part_id = (
        f"{target_player_id}_{target_staff}"
        if target_staff != "main" else target_player_id
    )
    target_part: Optional[Part] = next(
        (p for p in arrangement.target_score.parts
         if p.part_id == target_part_id),
        None,
    )
    if target_part is None:
        result.skipped_reason = f"target part {target_part_id} not found"
        return result

    # 偵測 key
    try:
        from music21 import key as m21_key
        from ..ir_to_music21 import ir_to_music21
        m21 = ir_to_music21(arrangement.source_score)
        key_obj = m21.analyze("key")
        is_major = key_obj.mode == "major"
        # tonic pitch class (C=0, C#=1, ...)
        tonic_pc = key_obj.tonic.pitchClass
    except Exception as e:
        result.skipped_reason = f"key analysis failed: {e}"
        return result

    # 找 source bass part — 偏好 BASS function tag, 否則最低音域的 part
    source = arrangement.source_score
    bass_part = _find_bass_part(source)
    if bass_part is None:
        result.skipped_reason = "no bass part found"
        return result

    profile = get_profile("harpsichord")
    range_lo, range_hi = profile.range_comfortable if profile else (36, 84)
    # upper staff: 偏好中音域 (C4-G5)
    upper_min = max(range_lo, 60)
    upper_max = min(range_hi, 79)

    # 0.1.50 E2.MVP: figured-bass 從 IR 拿 — musicxml_supplement.py 已
    # 在 parse 階段把 <figured-bass> 抽到 Measure.figured_bass dict.
    # 比舊版每次重讀 MusicXML 快, 也避免兩條 parse 路徑 drift.
    # Fallback: 若 IR 沒有 (e.g. 老 cache 沒這欄位) 再走舊路徑.
    figures: dict[tuple[int, Fraction], str] = {}
    for src_part in source.parts:
        for m in src_part.measures:
            for onset, fig in getattr(m, "figured_bass", {}).items():
                figures[(m.number, Fraction(onset))] = fig
    if not figures:
        src_path = source.metadata.get("source_path") if source.metadata else None
        if src_path:
            try:
                from .figured_bass_parser import parse_figured_bass
                figures = parse_figured_bass(src_path)
            except Exception:
                figures = {}
    if figures:
        result.notes.append(
            f"figured-bass: 讀到 {len(figures)} 個 <figured-bass> 標記"
        )

    # 對 bass 每個音生成 chord — 先收 candidate voicings, 再 DP 挑最佳.
    # candidates_by_onset[(mnum, onset)] = list of dict:
    #   {"bass_midi", "upper_midis": [int], "duration"}
    candidates_by_onset: dict[
        tuple[int, Fraction],
        list[dict],
    ] = {}
    for measure in bass_part.measures:
        for voice in measure.voices.values():
            for ev in voice.events:
                if not isinstance(ev, NoteEvent):
                    continue
                bass_midi = ev.pitch.midi_number
                # MVP figured-bass: 此 bass 位置有標 figure → 改用對應轉位
                # E2.Mid: 也讀 accidentals 套用 ±1 半音.
                fig_str = figures.get((measure.number, ev.onset))
                chord_steps: tuple[int, ...] = (3, 5)  # 預設 5-3
                alterations: dict[int, int] = {}
                if fig_str:
                    from .figured_bass_parser import interpret_figure_with_alts
                    interpreted, alterations = interpret_figure_with_alts(fig_str)
                    if interpreted is not None:
                        chord_steps = interpreted
                upper = _diatonic_chord_above(
                    bass_midi, tonic_pc, is_major, chord_steps,
                )
                # 套 alterations: chord_steps 的第 i 個音對應 step number,
                # 用 zip 對應 → 加 ±半音
                if upper and alterations:
                    upper = [
                        m + alterations.get(step, 0)
                        for m, step in zip(upper, chord_steps)
                    ]
                if not upper:
                    continue
                # 把 upper notes 調到 upper staff comfortable
                adjusted = []
                for m in upper:
                    while m < upper_min:
                        m += 12
                    while m > upper_max:
                        m -= 12
                    if upper_min <= m <= upper_max:
                        adjusted.append(m)
                if not adjusted:
                    continue
                upper_midis = sorted(set(adjusted))
                if len(upper_midis) < 2:
                    continue
                # L2: 生成 octave 位移候選 — 對每個音 ±0/±12 試 (在 upper_min/max
                # 範圍內), 形成 voicing alternatives. 上限 8 個避免爆炸.
                candidates_by_onset[(measure.number, ev.onset)] = (
                    _generate_voicing_candidates(
                        bass_midi, upper_midis,
                        upper_min, upper_max, ev.duration,
                    )
                )

    # L2: DP 挑 voicing 序列, 最小化 parallel 5/8 cost
    selected_voicings = _viterbi_select_voicings(candidates_by_onset)

    # 把 selected_voicings 變回 ChordEvent dict
    realized_chords: dict[tuple[int, Fraction], ChordEvent] = {}
    for (mnum, onset), voicing in selected_voicings.items():
        upper_midis = voicing["upper_midis"]
        if len(upper_midis) < 2:
            continue
        pitches = [
            Pitch(midi_number=m, spelling=_midi_to_name(m))
            for m in sorted(upper_midis)
        ]
        realized_chords[(mnum, onset)] = ChordEvent(
            pitches=pitches,
            duration=voicing["duration"],
            onset=onset,
        )

    # 寫入 target_part — 取代既有 voice 1 events
    for measure in target_part.measures:
        new_events = []
        beats_used = []
        # 收集這小節的 realized chords
        for (mnum, onset), chord in sorted(
            realized_chords.items(), key=lambda kv: (kv[0][0], kv[0][1]),
        ):
            if mnum == measure.number:
                new_events.append(chord)
                beats_used.append((onset, chord.duration))
                result.realized_chord_count += 1
        if new_events:
            voice = measure.voices.get(1)
            if voice is None:
                voice = Voice(voice_id=1, events=[])
                measure.voices[1] = voice
            voice.events = new_events

    return result


def _find_bass_part(source: Score) -> Optional[Part]:
    """找 source 的 bass: 優先 BASS function-tagged, 否則音域最低的 part."""
    # 1. function-tagged
    for part in source.parts:
        for func in part.function_tags.values():
            if func == VoiceFunction.BASS:
                return part
    # 2. fallback: 音域最低
    def part_low(p: Part) -> int:
        midis = [
            ev.pitch.midi_number
            for m in p.measures
            for v in m.voices.values()
            for ev in v.events
            if isinstance(ev, NoteEvent)
        ]
        return min(midis) if midis else 999
    if source.parts:
        return min(source.parts, key=part_low)
    return None


_PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F",
                "F#", "G", "G#", "A", "A#", "B"]


def _midi_to_name(midi: int) -> str:
    octave = (midi // 12) - 1
    name = _PITCH_NAMES[midi % 12]
    return f"{name}{octave}"


# ============================================================================
# 0.1.56 L2 — Voice-leading DP (parallel 5/8 penalty)
# ============================================================================

# Cost weights (調整這幾個就能換 voicing 風格)
_COST_PARALLEL_FIFTH = 10.0
_COST_PARALLEL_OCTAVE = 10.0
_COST_LARGE_LEAP = 0.5    # 每半音 leap > 7
_COST_PER_LEAP_SEMI = 0.1   # smooth voice leading 偏好


def _generate_voicing_candidates(
    bass_midi: int,
    upper_midis: list[int],
    upper_min: int,
    upper_max: int,
    duration,
) -> list[dict]:
    """對既定 upper_midis 生成 octave 位移 voicing 候選.

    策略: 對最高音 ±12 半音, 看是否仍在 [upper_min, upper_max] 內.
    其他音不動 (避免把和弦解構). 上限 4 個候選 — DP 規模平方, 別太多.

    回傳 list of dict: {"bass_midi", "upper_midis", "duration"}.
    保留原 voicing 為第一個 (anchor) — 確保至少有一個可選.
    """
    out: list[dict] = []
    base = {
        "bass_midi": bass_midi,
        "upper_midis": list(upper_midis),
        "duration": duration,
    }
    out.append(base)

    # 候選 2: 最高音降 8度
    if len(upper_midis) >= 1:
        top = max(upper_midis)
        new_top = top - 12
        if new_top >= upper_min and new_top > bass_midi:
            new_upper = [m for m in upper_midis if m != top] + [new_top]
            new_upper = sorted(set(new_upper))
            if len(new_upper) >= 2 and len(new_upper) == len(set(new_upper)):
                out.append({
                    "bass_midi": bass_midi,
                    "upper_midis": new_upper,
                    "duration": duration,
                })

    # 候選 3: 最低音升 8度
    if len(upper_midis) >= 1:
        bot = min(upper_midis)
        new_bot = bot + 12
        if new_bot <= upper_max:
            new_upper = [m for m in upper_midis if m != bot] + [new_bot]
            new_upper = sorted(set(new_upper))
            if len(new_upper) >= 2 and len(new_upper) == len(set(new_upper)):
                out.append({
                    "bass_midi": bass_midi,
                    "upper_midis": new_upper,
                    "duration": duration,
                })

    # 候選 4: 中間音轉位 — 若有 ≥3 音, 試把中間音升/降 8 度
    if len(upper_midis) >= 3:
        mid = sorted(upper_midis)[1]
        for delta in (12, -12):
            new_mid = mid + delta
            if upper_min <= new_mid <= upper_max and new_mid > bass_midi:
                new_upper = [m for m in upper_midis if m != mid] + [new_mid]
                new_upper = sorted(set(new_upper))
                if len(new_upper) >= 2 and len(new_upper) == len(set(new_upper)):
                    cand = {
                        "bass_midi": bass_midi,
                        "upper_midis": new_upper,
                        "duration": duration,
                    }
                    if cand not in out:
                        out.append(cand)
                        break  # 一個就夠, 避免候選爆炸

    # 去重 (依 (bass, sorted upper) tuple)
    seen: set[tuple] = set()
    unique: list[dict] = []
    for c in out:
        k = (c["bass_midi"], tuple(sorted(c["upper_midis"])))
        if k not in seen:
            seen.add(k)
            unique.append(c)
    return unique[:4]


def _is_parallel_fifth_or_octave(
    prev_bass: int, prev_top: int,
    curr_bass: int, curr_top: int,
) -> Optional[str]:
    """檢測前後兩個 chord 的最高聲部+bass 是否形成平行 5/8.

    定義 (baroque 嚴格):
      - 前後兩個間隔都是 7 (P5) 或 12 (P8) 的倍數中的同一個
      - 且 bass 與 top 都在「同方向」移動 (相反方向或保持不算)
      - 移動的距離不為 0 (重複同音不算)

    回傳 "5" / "8" / None.
    """
    prev_interval = (prev_top - prev_bass) % 12
    curr_interval = (curr_top - curr_bass) % 12

    bass_motion = curr_bass - prev_bass
    top_motion = curr_top - prev_top

    # 沒移動 = 不算平行 (oblique motion)
    if bass_motion == 0 or top_motion == 0:
        return None
    # 反向移動也不算
    if (bass_motion > 0) != (top_motion > 0):
        return None

    # 同方向 — 檢查兩端是否都是 P5 (7 semitones) 或 P8 (0 semitones)
    if prev_interval == 7 and curr_interval == 7:
        return "5"
    if prev_interval == 0 and curr_interval == 0:
        return "8"
    return None


def _voicing_transition_cost(prev: dict, curr: dict) -> float:
    """計算 prev → curr 的 voice-leading cost.

    包含:
      - parallel 5/8 (最高聲部 + bass): _COST_PARALLEL_FIFTH/_OCTAVE
      - 也檢查相鄰兩個 upper 聲部 (依 pitch 由低到高排序) 對 bass 的平行
      - voice leading smoothness: 每個聲部位移半音數 × _COST_PER_LEAP_SEMI
      - large leap: 任一聲部 > 7 半音額外加分
    """
    cost = 0.0

    prev_bass = prev["bass_midi"]
    curr_bass = curr["bass_midi"]
    prev_upper = sorted(prev["upper_midis"])
    curr_upper = sorted(curr["upper_midis"])

    # 平行檢查: 把每個 upper 與 bass 都當「上聲部」配 bass 來檢測 —
    # baroque 規則對所有 outer voice 都嚴格. 我們對每對 (upper_i, bass) 檢.
    # 只 check 對應位置 (相同 voice index), 不對 cross-voice 算.
    n_match = min(len(prev_upper), len(curr_upper))
    for i in range(n_match):
        kind = _is_parallel_fifth_or_octave(
            prev_bass, prev_upper[i],
            curr_bass, curr_upper[i],
        )
        if kind == "5":
            cost += _COST_PARALLEL_FIFTH
        elif kind == "8":
            cost += _COST_PARALLEL_OCTAVE

    # voice-leading smoothness — 每個對應位置的位移半音
    for i in range(n_match):
        leap = abs(curr_upper[i] - prev_upper[i])
        cost += leap * _COST_PER_LEAP_SEMI
        if leap > 7:
            cost += _COST_LARGE_LEAP

    return cost


def _viterbi_select_voicings(
    candidates_by_onset: dict[tuple[int, Fraction], list[dict]],
) -> dict[tuple[int, Fraction], dict]:
    """對每個 onset 從 candidates 挑一個 voicing, 用 viterbi DP 最小化
    累積 transition cost.

    若只有 1 個 onset (或沒有), 直接取每組第一個 candidate.
    回傳 (mnum, onset) → 選定的 voicing dict.
    """
    if not candidates_by_onset:
        return {}

    sorted_keys = sorted(candidates_by_onset.keys())
    if len(sorted_keys) == 1:
        k = sorted_keys[0]
        return {k: candidates_by_onset[k][0]}

    # Viterbi: dp[i][j] = (min_cost, prev_j) 到第 i 個 onset 選第 j 個候選的最小代價
    # 起點 dp[0][j] = 0 (沒前序, 不算 cost)
    n = len(sorted_keys)
    dp: list[list[tuple[float, int]]] = []
    cands_list = [candidates_by_onset[k] for k in sorted_keys]

    # 初始層
    dp.append([(0.0, -1) for _ in cands_list[0]])

    for i in range(1, n):
        prev_cands = cands_list[i - 1]
        curr_cands = cands_list[i]
        layer: list[tuple[float, int]] = []
        for j, curr in enumerate(curr_cands):
            best = (float("inf"), -1)
            for k, prev in enumerate(prev_cands):
                prev_cost = dp[i - 1][k][0]
                trans = _voicing_transition_cost(prev, curr)
                total = prev_cost + trans
                if total < best[0]:
                    best = (total, k)
            layer.append(best)
        dp.append(layer)

    # 回溯: 從最後一層挑 min cost 路徑
    last_idx = min(range(len(dp[-1])), key=lambda j: dp[-1][j][0])
    selected: list[int] = [last_idx]
    for i in range(n - 1, 0, -1):
        prev_idx = dp[i][selected[-1]][1]
        selected.append(prev_idx)
    selected.reverse()

    return {sorted_keys[i]: cands_list[i][selected[i]] for i in range(n)}

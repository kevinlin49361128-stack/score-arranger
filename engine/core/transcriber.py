"""
Transcriber — 樂器替換 + 移調改編 (1→1 或 N→N 同 cardinality)

跟 `core.arranger` 的差別:
- arranger: 「多對少」聲部分配 (管弦樂 → 弦樂四重奏)
- transcriber: 「同數量」樂器替換 (Bach 大提琴 → 小提琴 / 弦四 → 木管四重奏)

設計準則 (擴充性):
- pure function — `transcribe()` 不 mutate 輸入, 回傳新 Score
- 慣例移調表是 *data*, 不是寫死在程式邏輯 — 易擴充
- TranscriptionTarget 預留 hooks (apply_idiomatic, notes_override) 給 Phase 4
- 跟 arranger 可串接: transcribe → arrange → repair → export
- 結果含詳細 adjustments + warnings, 不只是新 Score
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Optional

from .instruments import get_profile, normalize_instrument_id
from .ir import ChordEvent, NoteEvent, Part, Score
from .pitch_util import find_octave_fit, shift_pitch


# ============================================================================
# Conventional transposition table
# ============================================================================
#
# (source_id, target_id) → semitones
#
# 出處: 主流樂譜出版社、教學機構的標準改編慣例。
# 不確定的對先不放, 寧可讓 suggest_transposition() fallback 到自動推算。

CONVENTIONAL_TRANSPOSITIONS: dict[tuple[str, str], int] = {
    # 弦樂內部 (五度系統)
    ("violin", "viola"): -7,    # 完全 5 度下行
    ("viola", "violin"): +7,
    ("violin", "cello"): -19,   # 八度 + 完全 5 度下行
    ("cello", "violin"): +19,   # Bach 大提琴組曲 → 小提琴標準
    ("cello", "viola"): +7,
    ("viola", "cello"): -7,

    # double bass ↔ 其他弦
    # cello ↔ double_bass: 兩者 sounding 音域差不大 (cello 高一個八度),
    # 但 db 譜記比實音高八度. 此處 semitones 是 *sounding* 差.
    # Bach 大提琴組曲移到 double bass 通常維持原 sounding 八度 (低音版).
    ("cello", "double_bass"): 0,
    ("double_bass", "cello"): 0,
    # violin 旋律 → double_bass 走低音線, 下移兩個八度當 backbone.
    ("violin", "double_bass"): -24,
    ("double_bass", "violin"): +24,
    ("viola", "double_bass"): -12,
    ("double_bass", "viola"): +12,

    # 雙簧管系
    ("clarinet_bb", "clarinet_bb"): 0,  # 同樂器, 不移調
    # 移調樂器互轉 (假設兩邊都是譜記)
    # 註: 此處 semitones 指 *concert pitch* (實音) 差, 與譜記移調無關

    # 木管 ↔ 鍵盤 (粗略, 主要用於試聽)
    ("flute", "violin"): 0,     # 同音域 / 同 concert pitch
    ("violin", "flute"): 0,

    # 銅管
    ("horn_f", "trumpet_bb"): +5,   # 較少見, 留作 example
}


def _conventional(source: str, target: str) -> Optional[int]:
    """查慣例表; 找不到回 None."""
    source = normalize_instrument_id(source)
    target = normalize_instrument_id(target)
    if source == target:
        return 0
    return CONVENTIONAL_TRANSPOSITIONS.get((source, target))


# ============================================================================
# Data models
# ============================================================================

@dataclass
class TranscriptionTarget:
    """單一 source part 要替換成什麼樂器 + 怎麼移調.

    擴充欄位 (apply_idiomatic / notes_override) 留給 Phase 4 — Phase 1 不處理。
    """
    instrument: str
    """目標 instrument_id (canonical 或 alias, 會 normalize)."""

    semitones: Optional[int] = None
    """移調半音數. None → 自動推算 (慣例 → range 中位差)."""

    fit_to_range: bool = True
    """超出目標樂器音域時, 嘗試以八度位移救回 (記在 adjustments)."""

    preserve_octave: bool = True
    """auto 模式時, 將自動推算的 semitones 取整到最近的 12 倍數
    (保留旋律輪廓; 關閉時可能出現 5 度等非八度移調)."""

    # === Phase 4 預留 hooks (目前無作用) ===
    apply_idiomatic: bool = False
    """是否套用樂器慣用法調整 (e.g. violin 雙音 → viola 改單音)."""

    notes_override: Optional[dict] = None
    """per-event 手動覆寫 (key 為 (measure, voice, idx) tuple)."""


@dataclass
class TranscriptionAdjustment:
    """記錄一個被自動 octave-shift 的音符 (透明度)."""
    part_id: str
    measure: int
    voice_id: int
    event_index: int
    original_midi: int
    final_midi: int
    reason: str
    """e.g. 'octave_up_for_range', 'octave_down_for_range', 'unable_to_fit'."""


@dataclass
class TranscriptionResult:
    """transcribe() 的完整結果."""
    score: Score
    """新的 Score (deep copy, 已套用移調/替換)."""

    semitones_used: dict[str, int] = field(default_factory=dict)
    """source_part_id → 實際套用的 semitones (含 auto 推算的結果)."""

    adjustments: list[TranscriptionAdjustment] = field(default_factory=list)
    """每個被 fit_to_range 修正的音符."""

    warnings: list[str] = field(default_factory=list)
    """非致命的訊息, e.g. 「2 個音無法擠進範圍, 已保留原音」."""


# ============================================================================
# Auto-transposition heuristic
# ============================================================================

def suggest_transposition(
    source_instrument: str,
    target_instrument: str,
    preserve_octave: bool = True,
) -> int:
    """推算合理的移調半音數.

    優先順序:
    1. 慣例表查表
    2. 兩樂器 comfortable range 中位差, 取最近八度 (或半音)
    3. 找不到 profile → 回 0 (不移調)
    """
    conv = _conventional(source_instrument, target_instrument)
    if conv is not None:
        return conv
    src = get_profile(normalize_instrument_id(source_instrument))
    tgt = get_profile(normalize_instrument_id(target_instrument))
    if not src or not tgt:
        return 0
    src_mid = (src.range_comfortable[0] + src.range_comfortable[1]) / 2
    tgt_mid = (tgt.range_comfortable[0] + tgt.range_comfortable[1]) / 2
    raw = tgt_mid - src_mid
    if preserve_octave:
        return round(raw / 12) * 12
    return round(raw)


# ============================================================================
# Main entry
# ============================================================================

def transcribe(
    score: Score,
    mapping: dict[str, TranscriptionTarget],
) -> TranscriptionResult:
    """把 score 內所有 instrument_id 或 part_id ∈ mapping.keys() 的 parts 替換 + 移調.

    Args:
        score: 來源樂譜 (不會被 mutate).
        mapping: key 可為兩種:
          - part_id (e.g. 'violin_1') — 只匹配該 part, **優先**
          - canonical instrument_id (e.g. 'violin') — 匹配所有同樂器 parts
          值為 TranscriptionTarget

    Returns:
        TranscriptionResult, 含新 Score + 詳細 adjustments + warnings.

    Notes:
        - 協奏曲案例: 用 part_id 只移植獨奏部 (e.g. {'violin_1': ...}),
          不影響 orchestral violins. 弦四案例: 用 instrument_id 一次轉換所有
          violin parts.
        - 不符合 mapping 的 parts 原樣保留
        - mapping 可空 → 等於深拷貝 score
        - 同時匹配 part_id 與 instrument_id 時, **part_id 優先**
    """
    # part_id 是字串原樣存; instrument_id 需要 normalize
    part_id_mapping: dict[str, TranscriptionTarget] = {}
    inst_mapping: dict[str, TranscriptionTarget] = {}
    score_part_ids = {p.part_id for p in score.parts}
    for k, v in mapping.items():
        if k in score_part_ids:
            part_id_mapping[k] = v
        else:
            inst_mapping[normalize_instrument_id(k)] = v

    new_score = copy.deepcopy(score)
    result = TranscriptionResult(score=new_score)
    # 記錄實際套用的 source → target 對, 給 metadata 用
    applied_pairs: list[tuple[str, str, int]] = []

    for part in new_score.parts:
        # part_id 優先
        target = part_id_mapping.get(part.part_id)
        part_inst = normalize_instrument_id(part.instrument_id)
        if target is None:
            target = inst_mapping.get(part_inst)
        if target is None:
            continue

        target_inst = normalize_instrument_id(target.instrument)
        target_profile = get_profile(target_inst)

        # 1. 決定 semitones
        semitones = target.semitones
        if semitones is None:
            semitones = suggest_transposition(
                part_inst, target_inst,
                preserve_octave=target.preserve_octave,
            )
        result.semitones_used[part.part_id] = semitones
        applied_pairs.append((part_inst, target_inst, semitones))

        # 2. 替換 instrument_id
        part.instrument_id = target_inst
        # name_display 若是舊樂器名 → 改為新 (簡單 heuristic)
        if part.name_display and part_inst.lower() in part.name_display.lower():
            part.name_display = target_profile.display_name \
                if target_profile else target_inst

        # 3. 對每個 event 移調 (含 range 適配)
        _shift_part(part, semitones, target_profile, target, result)

    # 4. metadata 標記 — 含具體映射細節
    if mapping and new_score.metadata is not None:
        existing = new_score.metadata.get("arranger", "")
        annot = _format_transcription_annotation(applied_pairs)
        if "Score Arranger" not in existing:
            new_score.metadata["arranger"] = (
                f"{existing.strip()} · {annot}" if existing.strip()
                else annot
            )

    return result


def _format_transcription_annotation(
    pairs: list[tuple[str, str, int]],
) -> str:
    """把 [(src, tgt, semi), ...] 格式化成可讀的 arranger 字串.

    範例:
      [("cello", "violin", 19)]
        → 'Transcribed cello → violin (+19) with Score Arranger'
      [("violin", "viola", -7), ("cello", "bassoon", -12)]
        → 'Transcribed [violin → viola (-7), cello → bassoon (-12)] with Score Arranger'
    """
    if not pairs:
        return "Transcribed with Score Arranger"
    # 去重 (同 (src, tgt, semi) 多 part 算一次)
    unique = sorted(set(pairs))

    def _fmt_one(src: str, tgt: str, semi: int) -> str:
        sign = f"+{semi}" if semi > 0 else (str(semi) if semi else "0")
        return f"{src} → {tgt} ({sign})"

    if len(unique) == 1:
        return (
            f"Transcribed {_fmt_one(*unique[0])} with Score Arranger"
        )
    inner = ", ".join(_fmt_one(*p) for p in unique)
    return f"Transcribed [{inner}] with Score Arranger"


def _shift_part(
    part: Part,
    semitones: int,
    target_profile: Any,
    target: TranscriptionTarget,
    result: TranscriptionResult,
) -> None:
    """In-place 對 part 內所有 event 套用移調 + 範圍適配."""
    range_lo = target_profile.range_absolute[0] if target_profile else 0
    range_hi = target_profile.range_absolute[1] if target_profile else 127

    for measure in part.measures:
        voices = (
            measure.voices.values()
            if isinstance(measure.voices, dict)
            else measure.voices
        )
        for voice in voices:
            branches = voice.divisi_branches if voice.is_divisi else [voice]
            for vb in branches or []:
                for idx, ev in enumerate(vb.events):
                    if isinstance(ev, NoteEvent):
                        new_pitch = shift_pitch(ev.pitch, semitones)
                        # 範圍適配
                        if target.fit_to_range:
                            extra = _fit_pitch_in_range(
                                new_pitch.midi_number, range_lo, range_hi,
                            )
                            if extra != 0:
                                new_pitch = shift_pitch(new_pitch, extra)
                                result.adjustments.append(
                                    TranscriptionAdjustment(
                                        part_id=part.part_id,
                                        measure=measure.number,
                                        voice_id=voice.voice_id,
                                        event_index=idx,
                                        original_midi=ev.pitch.midi_number,
                                        final_midi=new_pitch.midi_number,
                                        reason=(
                                            "octave_up_for_range" if extra > 0
                                            else "octave_down_for_range"
                                        ),
                                    ),
                                )
                            elif not (range_lo <= new_pitch.midi_number
                                      <= range_hi):
                                # 無法 octave fit → 留原音但記 warning
                                result.warnings.append(
                                    f"m.{measure.number} {part.part_id}"
                                    f" pitch {new_pitch.spelling} "
                                    f"無法擠進 {target.instrument} 音域, 保留",
                                )
                        ev.pitch = new_pitch
                    elif isinstance(ev, ChordEvent):
                        # 整個和弦同步移調; range fit 取 *單一* octave shift
                        # 套用到全和弦 (保留音程結構)
                        shifted = [
                            shift_pitch(p, semitones) for p in ev.pitches
                        ]
                        if target.fit_to_range and target_profile:
                            chord_shift = _chord_fit_shift(
                                [p.midi_number for p in shifted],
                                range_lo, range_hi,
                            )
                            if chord_shift != 0:
                                shifted = [
                                    shift_pitch(p, chord_shift) for p in shifted
                                ]
                                # 對每個音都記一筆 adjustment
                                for ci, (orig, new) in enumerate(
                                    zip(ev.pitches, shifted),
                                ):
                                    result.adjustments.append(
                                        TranscriptionAdjustment(
                                            part_id=part.part_id,
                                            measure=measure.number,
                                            voice_id=voice.voice_id,
                                            event_index=idx,
                                            original_midi=orig.midi_number,
                                            final_midi=new.midi_number,
                                            reason=(
                                                "chord_octave_shift"
                                                if chord_shift > 0 else
                                                "chord_octave_down"
                                            ),
                                        ),
                                    )
                        ev.pitches = shifted
                    # RestEvent: nothing to do


def _fit_pitch_in_range(midi: int, lo: int, hi: int) -> int:
    """單音 fit. 回傳要再套用的額外 semitones (0 = 已在範圍)."""
    if lo <= midi <= hi:
        return 0
    return find_octave_fit(midi, lo, hi) or 0


def _chord_fit_shift(
    midis: list[int], lo: int, hi: int,
) -> int:
    """和弦整體 octave shift 使全部音盡量在範圍.

    策略: 找到讓 (overflow above + overflow below) 最小的 12 倍數位移.
    """
    if not midis:
        return 0
    best_shift = 0
    best_overflow = _overflow(midis, lo, hi)
    if best_overflow == 0:
        return 0
    for k in (-2, -1, 1, 2):
        shifted = [m + 12 * k for m in midis]
        if any(m < 0 or m > 127 for m in shifted):
            continue
        of = _overflow(shifted, lo, hi)
        if of < best_overflow:
            best_overflow = of
            best_shift = 12 * k
    return best_shift


def _overflow(midis: list[int], lo: int, hi: int) -> int:
    return sum(
        max(0, lo - m) + max(0, m - hi)
        for m in midis
    )

"""
改編品質 metrics — 量化「這次改編做得好不好」

對應規格: docs/architecture.md §4.7 (Phase 3, 提早實作以協助使用者選擇變體)

三項分數 (0-1, 越高越好):

1. **melody_preservation**: 來源 MELODY function 的音符在 target 出現的比例
   - 比對 (mod 12) 音級, 不在意八度
   - 比對「序列」: 用 LCS 計算保留長度

2. **harmony_completeness**: 來源和聲 pitch-class set 在 target 的覆蓋率
   - 每小節算 |src_pcs ∩ tgt_pcs| / |src_pcs|
   - 平均所有小節

3. **playability**: 1 - (嚴重度加權後的問題 / target 事件數)
   - error = 1.0, warning = 0.3, info = 0.0
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .ir import ChordEvent, NoteEvent, Score, VoiceFunction


@dataclass
class QualityReport:
    """改編整體品質 (三個分數均 0-1)。"""
    melody_preservation: float
    harmony_completeness: float
    playability: float
    # 額外明細
    melody_matched: int = 0
    melody_total: int = 0
    measures_compared: int = 0
    issue_count_error: int = 0
    issue_count_warning: int = 0


# ============================================================================
# Helper: 抓出 pitch-class set & melody sequence
# ============================================================================

def _measure_pitch_classes(score: Score, measure_num: int) -> set[int]:
    """蒐集指定 measure 中 *所有 parts* 的 pitch class (mod 12)。"""
    result: set[int] = set()
    for part in score.parts:
        for m in part.measures:
            if m.number != measure_num:
                continue
            voices = (
                m.voices.values()
                if isinstance(m.voices, dict)
                else m.voices
            )
            for v in voices:
                branches = v.divisi_branches if v.is_divisi else [v]
                for vb in branches or []:
                    for e in vb.events:
                        if isinstance(e, NoteEvent):
                            result.add(e.pitch.midi_number % 12)
                        elif isinstance(e, ChordEvent):
                            for p in e.pitches:
                                result.add(p.midi_number % 12)
    return result


def _melody_pitch_classes(score: Score) -> list[int]:
    """抓出來源 MELODY function 的音符序列 (pitch class 序列, 跨小節串接)。"""
    seq: list[int] = []
    for part in score.parts:
        # 若 part 在多個 sections 都被標為 MELODY, 串接所有
        is_melody_anywhere = any(
            f == VoiceFunction.MELODY for f in part.function_tags.values()
        )
        if not is_melody_anywhere:
            continue
        for m in part.measures:
            voices = (
                m.voices.values()
                if isinstance(m.voices, dict)
                else m.voices
            )
            for v in voices:
                branches = v.divisi_branches if v.is_divisi else [v]
                for vb in branches or []:
                    for e in vb.events:
                        if isinstance(e, NoteEvent):
                            seq.append(e.pitch.midi_number % 12)
                        elif isinstance(e, ChordEvent) and e.pitches:
                            # 取最高音當 melody
                            seq.append(
                                max(p.midi_number for p in e.pitches) % 12
                            )
    return seq


def _all_pitch_classes_sequence(score: Score) -> list[int]:
    """fallback: 沒 melody tag → 取所有最高音當「melody」"""
    seq: list[int] = []
    for part in score.parts:
        for m in part.measures:
            voices = (
                m.voices.values()
                if isinstance(m.voices, dict)
                else m.voices
            )
            for v in voices:
                branches = v.divisi_branches if v.is_divisi else [v]
                for vb in branches or []:
                    for e in vb.events:
                        if isinstance(e, NoteEvent):
                            seq.append(e.pitch.midi_number % 12)
                        elif isinstance(e, ChordEvent) and e.pitches:
                            seq.append(
                                max(p.midi_number for p in e.pitches) % 12
                            )
    return seq


def _lcs_length(a: list[int], b: list[int]) -> int:
    """最長公共子序列長度 (O(n*m), 數百個音符是夠的)。"""
    if not a or not b:
        return 0
    # 用 1D rolling array
    n, m = len(a), len(b)
    prev = [0] * (m + 1)
    curr = [0] * (m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                curr[j] = prev[j - 1] + 1
            else:
                curr[j] = max(prev[j], curr[j - 1])
        prev, curr = curr, prev
        for k in range(m + 1):
            curr[k] = 0
    return prev[m]


# ============================================================================
# Main entry
# ============================================================================

def compute_quality(
    source: Score,
    target: Score,
    issues: Optional[list] = None,
) -> QualityReport:
    """計算改編品質三項分數。

    issues: collect_issues() 的結果 (有 severity 字串)
    """
    # === 1. melody_preservation ===
    src_melody = _melody_pitch_classes(source) or _all_pitch_classes_sequence(source)
    # target 可能多 part, 各自抓 melody — 但我們只關心「來源主旋律有沒有出現」
    # → 把 target 全 pitch sequence 串成大集合
    tgt_seq = _all_pitch_classes_sequence(target)
    if not src_melody:
        melody_score = 1.0
        melody_matched = 0
    else:
        # 用 LCS 比對
        matched = _lcs_length(src_melody, tgt_seq)
        melody_score = matched / len(src_melody)
        melody_matched = matched

    # === 2. harmony_completeness ===
    # 比對每小節的 pitch-class set
    max_measure = max(
        (max((m.number for m in p.measures), default=0)
         for p in source.parts),
        default=0,
    )
    overlaps = []
    measures_compared = 0
    for mnum in range(1, max_measure + 1):
        src_pcs = _measure_pitch_classes(source, mnum)
        if not src_pcs:
            continue
        tgt_pcs = _measure_pitch_classes(target, mnum)
        if not tgt_pcs:
            overlaps.append(0.0)
        else:
            overlaps.append(len(src_pcs & tgt_pcs) / len(src_pcs))
        measures_compared += 1
    harmony_score = (
        sum(overlaps) / len(overlaps) if overlaps else 1.0
    )

    # === 3. playability ===
    err = 0
    warn = 0
    if issues:
        for i in issues:
            sev = getattr(i, "severity", None) or (
                i.get("severity") if isinstance(i, dict) else None
            )
            if sev == "error":
                err += 1
            elif sev == "warning":
                warn += 1
    # 估算 target 總事件數
    tgt_events = 0
    for part in target.parts:
        for m in part.measures:
            voices = (
                m.voices.values()
                if isinstance(m.voices, dict)
                else m.voices
            )
            for v in voices:
                branches = v.divisi_branches if v.is_divisi else [v]
                for vb in branches or []:
                    tgt_events += sum(
                        1 for e in vb.events
                        if isinstance(e, (NoteEvent, ChordEvent))
                    )
    weighted = err * 1.0 + warn * 0.3
    if tgt_events == 0:
        play_score = 1.0
    else:
        play_score = max(0.0, 1.0 - weighted / tgt_events)

    return QualityReport(
        melody_preservation=round(melody_score, 3),
        harmony_completeness=round(harmony_score, 3),
        playability=round(play_score, 3),
        melody_matched=melody_matched,
        melody_total=len(src_melody),
        measures_compared=measures_compared,
        issue_count_error=err,
        issue_count_warning=warn,
    )


def quality_to_dict(q: QualityReport) -> dict:
    return {
        "melody_preservation": q.melody_preservation,
        "harmony_completeness": q.harmony_completeness,
        "playability": q.playability,
        "overall": round(
            (q.melody_preservation * 0.4
             + q.harmony_completeness * 0.3
             + q.playability * 0.3), 3,
        ),
        "details": {
            "melody_matched": q.melody_matched,
            "melody_total": q.melody_total,
            "measures_compared": q.measures_compared,
            "issue_count_error": q.issue_count_error,
            "issue_count_warning": q.issue_count_warning,
        },
    }

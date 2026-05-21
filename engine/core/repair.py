"""
Directed Repair Loop — 定向修復迴圈

對應規格: architecture.md §4.5 (Playability Validator + 修復迴圈)
       + i18n-spec.md (錯誤代碼結構)

Phase 1 範圍 (本檔案):
- 策略 1: 音高微調 (移八度) — 單一音符
- 策略 2: 省略次要音 — 單一和弦
- 策略 3: (留 stub, Phase 2 實作 — 需 voice 重分配機制)

收斂指標: 加權嚴重度 ERROR=10, WARNING=3, INFO=1。每次迭代需嚴格遞減
(差距 ≥ epsilon),否則回滾並嘗試下一策略。
"""

from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field
from typing import Callable, Optional

from .arrangement_model import Arrangement
from .instruments import (
    CheckResult,
    check_piano_hand_span,
    check_pitch_in_range,
    check_violin_chord,
    get_profile,
)
from .ir import (
    ChordEvent,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Voice,
)
from .quality import QualityReport, compute_quality


# ============================================================================
# 加權嚴重度
# ============================================================================

SEVERITY_WEIGHTS: dict[str, float] = {
    "error": 10.0,
    "warning": 3.0,
    "info": 1.0,
}

DEFAULT_EPSILON = 0.5
DEFAULT_MAX_ITERATIONS = 10


# ============================================================================
# 定位的問題
# ============================================================================

@dataclass
class LocatedIssue:
    """帶有 target_score 內位置資訊的可演奏性問題。"""
    part_id: str
    measure_number: int
    voice_id: int
    event_index: int
    result: CheckResult
    is_manual: bool = False                # 系統無法處理,需人工介入

    @property
    def severity(self) -> str:
        return self.result.severity

    @property
    def weight(self) -> float:
        return SEVERITY_WEIGHTS.get(self.severity, 0.0)


@dataclass
class RepairIteration:
    iteration: int
    issue_code: str
    issue_location: str
    applied_strategy: Optional[str]
    score_before: float
    score_after: float
    # 此 iteration 結束後的 target_score MusicXML 快照 (給時間軸 scrubber)
    target_musicxml: Optional[str] = None


@dataclass
class RepairReport:
    iterations: list[RepairIteration] = field(default_factory=list)
    final_issue_count: int = 0
    final_severity_score: float = 0.0
    converged: bool = False
    manual_issues: list[LocatedIssue] = field(default_factory=list)
    # 修復前/後的改編品質 (melody/harmony/playability) — 讓使用者看到
    # 修復除了減少 issue 數, 對音樂品質的實際影響。
    quality_before: Optional[QualityReport] = None
    quality_after: Optional[QualityReport] = None


# ============================================================================
# Issue collection
# ============================================================================

def collect_issues(score: Score) -> list[LocatedIssue]:
    """掃描整個 Score, 收集所有可演奏性問題。"""
    issues: list[LocatedIssue] = []
    for part in score.parts:
        profile = get_profile(part.instrument_id)
        if profile is None:
            continue
        for measure in part.measures:
            for voice_id, voice in measure.voices.items():
                if voice.is_divisi:
                    continue
                for idx, event in enumerate(voice.events):
                    result = _check_event(event, part.instrument_id)
                    if result is not None and not result.is_ok:
                        # 附上事件音高 (給弦樂指板模擬器 / UI 用)
                        if isinstance(event, ChordEvent):
                            result.params.setdefault(
                                "event_midis",
                                [p.midi_number for p in event.pitches],
                            )
                        elif isinstance(event, NoteEvent):
                            result.params.setdefault(
                                "event_midis", [event.pitch.midi_number],
                            )
                        issues.append(LocatedIssue(
                            part_id=part.part_id,
                            measure_number=measure.number,
                            voice_id=voice_id,
                            event_index=idx,
                            result=result,
                        ))
    # 跨聲部 voice-leading 檢查 (平行五度 / 八度)
    try:
        from .voice_leading import detect_parallel_motion
        issues.extend(detect_parallel_motion(score))
    except Exception:
        pass
    return issues


def _check_event(event, instrument_id: str) -> Optional[CheckResult]:
    """選擇合適的檢查函式。"""
    profile = get_profile(instrument_id)
    if profile is None:
        return None

    if isinstance(event, NoteEvent):
        return check_pitch_in_range(event.pitch, profile)
    if isinstance(event, ChordEvent):
        if instrument_id == "violin":
            return check_violin_chord(event.pitches)
        if instrument_id == "piano":
            # Phase 1 假設整個 chord 用單手
            return check_piano_hand_span(event.pitches, hand="right")
        # 其他樂器: 每個音檢查音域,回傳最嚴重的
        worst: Optional[CheckResult] = None
        for p in event.pitches:
            r = check_pitch_in_range(p, profile)
            if worst is None or _severity_rank(r.severity) > _severity_rank(worst.severity):
                worst = r
        return worst
    return None


def _severity_rank(s: str) -> int:
    return {"info": 1, "warning": 2, "error": 3}.get(s, 0)


def severity_score(issues: list[LocatedIssue]) -> float:
    return sum(i.weight for i in issues if not i.is_manual)


# Manual issue 的穩定識別: (part_id, measure, voice_id, event_index, code)
ManualKey = tuple[str, int, int, int, str]


def issue_key(issue: LocatedIssue) -> ManualKey:
    """為 issue 產生跨輪可比對的穩定 key。"""
    return (
        issue.part_id,
        issue.measure_number,
        issue.voice_id,
        issue.event_index,
        issue.result.code,
    )


def mark_manual_by_keys(
    issues: list[LocatedIssue],
    manual_keys: set[ManualKey],
) -> None:
    """依 manual_keys 把對應的 issues 標 is_manual=True (in-place)。"""
    for issue in issues:
        if issue_key(issue) in manual_keys:
            issue.is_manual = True


def actionable_issues(issues: list[LocatedIssue]) -> list[LocatedIssue]:
    """剔除 INFO 與已標記為 manual 的問題。"""
    return [
        i for i in issues
        if i.severity != "info" and not i.is_manual
    ]


def _exclude_locked(
    score: Score, issues: list[LocatedIssue]
) -> list[LocatedIssue]:
    """剔除指向 is_locked 事件的 issue — 使用者鎖定的音符不可被自動修復覆寫。"""
    kept: list[LocatedIssue] = []
    for i in issues:
        ev = _get_event(score, i)
        if ev is not None and getattr(ev, "is_locked", False):
            continue
        kept.append(i)
    return kept


# ============================================================================
# 修復策略
# ============================================================================

# 每個策略接收 (Score, LocatedIssue) 並回傳是否成功修改了 Score。
# 修改後 LocatedIssue 的 event_index 仍應指向相同位置 (策略不應重排序事件)。

RepairStrategy = Callable[[Score, LocatedIssue], bool]


def strategy_octave_shift(score: Score, issue: LocatedIssue) -> bool:
    """策略 1 (Phase 1 範圍): 對音域外的單音移八度。"""
    if issue.result.code not in (
        "E_PITCH_BELOW_RANGE",
        "E_PITCH_ABOVE_RANGE",
        "W_PITCH_OUT_OF_COMFORTABLE",
        "W_PITCH_EXTREME",
    ):
        return False

    event = _get_event(score, issue)
    if not isinstance(event, NoteEvent):
        return False

    part = _get_part(score, issue.part_id)
    if part is None:
        return False
    profile = get_profile(part.instrument_id)
    if profile is None:
        return False

    low, high = profile.range_comfortable
    abs_low, abs_high = profile.range_absolute
    midi = event.pitch.midi_number

    # 連續移動多個八度,直到進入 comfortable 範圍
    delta = 0
    new_midi = midi
    if midi > high:
        while new_midi > high and (new_midi - 12) >= abs_low:
            delta -= 1
            new_midi -= 12
    elif midi < low:
        while new_midi < low and (new_midi + 12) <= abs_high:
            delta += 1
            new_midi += 12
    else:
        return False

    if delta == 0:
        return False
    if not (abs_low <= new_midi <= abs_high):
        return False

    event.pitch = _shift_pitch_octave(event.pitch, delta)
    return True


def _harmonic_omit_choice(pitches: list) -> int:
    """挑出和弦中最該省略的音 — 回傳該音在 pitches 內的 index。

    原則 (和聲感知):
    - 保留外聲部 (最低音 = 低音根基, 最高音 = 旋律輪廓)
    - 內聲部中省略和聲上最不關鍵者:
        * 與其他音同 pitch-class 的疊音 → 最該省
        * 完全五度 / 八度 → 可省 (和聲上可被隱含)
        * 三度 (定大小調) / 七度 (定和弦屬性) → 應保留
    """
    order = sorted(range(len(pitches)), key=lambda i: pitches[i].midi_number)
    if len(order) < 3:
        return order[-1]  # 2 音 → 省最高, 保留低音根基

    root_midi = pitches[order[0]].midi_number
    pcs = [pitches[i].midi_number % 12 for i in range(len(pitches))]

    def essential(gi: int) -> int:
        """分數越低越該省。"""
        iv = (pitches[gi].midi_number - root_midi) % 12
        if pcs.count(pitches[gi].midi_number % 12) > 1:
            return 0  # 疊音
        if iv in (3, 4, 10, 11):
            return 3  # 三度 / 七度 — 定義和弦, 最該留
        if iv in (1, 2, 5, 6, 8, 9):
            return 2  # 其他和聲音
        return 1      # 完全五度 / 八度 — 可省

    inner = order[1:-1]  # 只在內聲部中挑
    return min(inner, key=essential)


def strategy_omit_note(score: Score, issue: LocatedIssue) -> bool:
    """策略 2 (Phase 1 範圍): 對和弦超載問題省略一個音。

    和聲感知啟發式: 保留外聲部, 內聲部中省略和聲上最不關鍵的音 (疊音 /
    完全五度 / 八度優先省, 三度與七度保留)。2 音和弦則省最高。
    """
    omit_codes = {
        "E_STRING_CHORD_EXCEED",
        "E_PIANO_HAND_SPAN_EXCEED",
        "W_PIANO_HAND_SPAN_LARGE",
        "W_VIOLIN_TRIPLE_QUAD_STOP",
        "W_VIOLIN_STRETCH_LARGE",
        "E_VIOLIN_STRETCH_EXCEED",
    }
    if issue.result.code not in omit_codes:
        return False

    event = _get_event(score, issue)
    if not isinstance(event, ChordEvent):
        return False
    if len(event.pitches) < 2:
        return False

    omit_idx = _harmonic_omit_choice(event.pitches)
    sorted_pitches = sorted(
        (p for i, p in enumerate(event.pitches) if i != omit_idx),
        key=lambda p: p.midi_number,
    )

    if len(sorted_pitches) < 2:
        # 變單音 → 改為 NoteEvent (in-place)
        new_event = NoteEvent(
            pitch=sorted_pitches[0],
            duration=event.duration,
            onset=event.onset,
            articulations=list(event.articulations),
            dynamic=event.dynamic,
            is_tied_from=event.is_tied_from,
            is_tied_to=event.is_tied_to,
            slur_group=event.slur_group,
        )
        _replace_event(score, issue, new_event)
    else:
        event.pitches = sorted_pitches

    return True


def strategy_split_to_other_hand(score: Score, issue: LocatedIssue) -> bool:
    """策略 3 (Phase 1 範圍): 鋼琴單手手距過大時, 把部分音移到另一隻手。

    僅適用於鋼琴的 *_upper / *_lower staff 配對。
    將和弦按音高中位數切分,把不屬於此手的音移到另一手對應小節。
    """
    if issue.result.code not in (
        "E_PIANO_HAND_SPAN_EXCEED",
        "W_PIANO_HAND_SPAN_LARGE",
        "W_PIANO_TOO_MANY_NOTES_ONE_HAND",
    ):
        return False

    event = _get_event(score, issue)
    if not isinstance(event, ChordEvent):
        return False

    current_part = _get_part(score, issue.part_id)
    if current_part is None:
        return False

    # 判斷當前手 (upper / lower)
    is_upper = current_part.part_id.endswith("_upper")
    is_lower = current_part.part_id.endswith("_lower")
    if not (is_upper or is_lower):
        return False

    other_suffix = "_lower" if is_upper else "_upper"
    own_suffix = "_upper" if is_upper else "_lower"
    other_part_id = current_part.part_id[: -len(own_suffix)] + other_suffix

    other_part = _get_part(score, other_part_id)
    if other_part is None:
        return False

    # 把和弦按音高中位數切分
    sorted_pitches = sorted(event.pitches, key=lambda p: p.midi_number)
    median_idx = len(sorted_pitches) // 2
    if is_upper:
        # 上手保留高音,低音移到下手
        keep_pitches = sorted_pitches[median_idx:]
        move_pitches = sorted_pitches[:median_idx]
    else:
        # 下手保留低音,高音移到上手
        keep_pitches = sorted_pitches[:median_idx + (len(sorted_pitches) % 2)]
        move_pitches = sorted_pitches[median_idx + (len(sorted_pitches) % 2):]

    if not keep_pitches or not move_pitches:
        return False

    # 更新當前事件 (保留部分)
    if len(keep_pitches) >= 2:
        event.pitches = keep_pitches
    else:
        # 變為單音 → 改為 NoteEvent
        new_event = NoteEvent(
            pitch=keep_pitches[0],
            duration=event.duration,
            onset=event.onset,
            articulations=list(event.articulations),
            dynamic=event.dynamic,
        )
        _replace_event(score, issue, new_event)

    # 在另一手對應小節插入移動的音
    other_measure = next(
        (m for m in other_part.measures if m.number == issue.measure_number),
        None,
    )
    if other_measure is None:
        return False

    if len(move_pitches) == 1:
        moved_event = NoteEvent(
            pitch=move_pitches[0],
            duration=event.duration,
            onset=event.onset,
            articulations=list(event.articulations),
            dynamic=event.dynamic,
        )
    else:
        moved_event = ChordEvent(
            pitches=move_pitches,
            duration=event.duration,
            onset=event.onset,
            articulations=list(event.articulations),
            dynamic=event.dynamic,
        )

    if 1 not in other_measure.voices:
        other_measure.voices[1] = Voice(voice_id=1, events=[moved_event])
    else:
        other_voice = other_measure.voices[1]
        other_voice.events.append(moved_event)
        other_voice.events.sort(key=lambda e: e.onset)

    return True


# Phase 1 註冊的策略 (按優先序: 影響從小到大)
PHASE_1_STRATEGIES: list[tuple[str, RepairStrategy]] = [
    ("octave_shift", strategy_octave_shift),
    ("omit_note", strategy_omit_note),
    ("split_to_other_hand", strategy_split_to_other_hand),
]


# ============================================================================
# Repair loop 主流程
# ============================================================================

def _safe_quality(arrangement: Arrangement) -> Optional[QualityReport]:
    """計算 arrangement 當前品質; 缺 source 或失敗 → None。"""
    src = getattr(arrangement, "source_score", None)
    tgt = arrangement.target_score
    if src is None or tgt is None:
        return None
    try:
        return compute_quality(src, tgt)
    except Exception:
        return None


def _pick_best_candidate(
    arrangement: Arrangement,
    candidates: list[tuple[str, float, Score]],
) -> tuple[str, float, Score]:
    """從合格候選 (皆已通過「問題嚴格減少」) 挑最佳。

    主鍵: 問題分數越低越好 (減越多)。同分時用品質當第二鍵 —— 旋律 + 和聲
    保留度越高越好, 避免「修掉 issue 卻把旋律/和聲弄爛」。
    """
    if len(candidates) == 1:
        return candidates[0]
    best_score = min(c[1] for c in candidates)
    tied = [c for c in candidates if c[1] <= best_score + 1e-9]
    if len(tied) == 1:
        return tied[0]
    src = getattr(arrangement, "source_score", None)
    if src is None:
        return tied[0]

    def quality_key(c: tuple[str, float, Score]) -> float:
        try:
            q = compute_quality(src, c[2])
            return q.melody_preservation + q.harmony_completeness
        except Exception:
            return 0.0

    return max(tied, key=quality_key)


def repair_loop(
    arrangement: Arrangement,
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
    epsilon: float = DEFAULT_EPSILON,
    strategies: Optional[list[tuple[str, RepairStrategy]]] = None,
) -> RepairReport:
    """執行定向修復迴圈,直接 in-place 修改 arrangement.target_score。

    收斂條件: actionable 問題清空, 或加權分數 < epsilon。
    """
    if arrangement.target_score is None:
        return RepairReport(converged=True)

    if strategies is None:
        strategies = PHASE_1_STRATEGIES

    report = RepairReport()
    target = arrangement.target_score
    report.quality_before = _safe_quality(arrangement)

    # 跨輪持久的 manual issue keys (reviewer 建議):
    # collect_issues 每輪重建 LocatedIssue 物件, 所以 is_manual 在物件上不持久;
    # 改用 (part_id, measure, voice, event_index, code) 5-tuple 維護。
    manual_keys: set[ManualKey] = set()

    for iteration in range(max_iterations):
        all_issues = collect_issues(target)
        # 把標為 manual 的標記回新建的 issues
        mark_manual_by_keys(all_issues, manual_keys)
        actionable = actionable_issues(all_issues)
        # 剔除使用者鎖定的事件 — 不被自動修復動到
        actionable = _exclude_locked(target, actionable)
        if not actionable:
            report.converged = True
            break

        # 排序: 嚴重度高優先, 同嚴重度 difficulty 高優先
        actionable.sort(
            key=lambda i: (-i.weight, -i.result.difficulty_score)
        )
        target_issue = actionable[0]
        score_before = severity_score(actionable)

        # 嘗試所有策略, 收集「能讓問題嚴格減少」的合格候選。
        # 收斂保證不變: 候選必過 new_score <= score_before - epsilon。
        # 多個合格時 _pick_best_candidate 用品質分數挑最佳 (有方向修復)。
        applied: Optional[str] = None
        score_after = score_before
        candidates: list[tuple[str, float, Score]] = []
        for name, strategy in strategies:
            snapshot = copy.deepcopy(target)
            if not strategy(target, target_issue):
                continue

            # 重新驗證 (同樣套用 manual 標記)
            new_issues = collect_issues(target)
            mark_manual_by_keys(new_issues, manual_keys)
            new_score = severity_score(actionable_issues(new_issues))
            if new_score <= score_before - epsilon:
                candidates.append((name, new_score, copy.deepcopy(target)))
            # 一律還原, 公平試下一個策略
            _restore_score(arrangement, snapshot)
            target = arrangement.target_score
            assert target is not None

        if candidates:
            applied, score_after, repaired = _pick_best_candidate(
                arrangement, candidates,
            )
            _restore_score(arrangement, repaired)
            target = arrangement.target_score
            assert target is not None

        # 此步結束後的 MusicXML 快照 (給時間軸 scrubber 檢視)
        iter_xml: Optional[str] = None
        try:
            from .musicxml_writer import write_musicxml_string
            iter_xml = write_musicxml_string(target)
        except Exception:
            iter_xml = None

        report.iterations.append(RepairIteration(
            iteration=iteration,
            issue_code=target_issue.result.code,
            issue_location=(
                f"{target_issue.part_id}/m.{target_issue.measure_number}"
                f"/v{target_issue.voice_id}#{target_issue.event_index}"
            ),
            applied_strategy=applied,
            score_before=score_before,
            score_after=score_after,
            target_musicxml=iter_xml,
        ))

        if applied is None:
            # 所有策略都失敗 — 永久標記 (跨輪持久)
            manual_keys.add(issue_key(target_issue))
            target_issue.is_manual = True

    # 最終狀態
    final_issues = collect_issues(target)
    mark_manual_by_keys(final_issues, manual_keys)
    report.final_issue_count = len(actionable_issues(final_issues))
    report.final_severity_score = severity_score(
        actionable_issues(final_issues)
    )
    report.manual_issues = [
        i for i in final_issues if i.is_manual
    ]
    report.quality_after = _safe_quality(arrangement)
    return report


def _restore_score(arrangement: Arrangement, snapshot: Score) -> None:
    arrangement.target_score = snapshot


# 註: 原 _find_and_mark_manual 改由 repair_loop 內的 manual_keys 集合處理,
# 因為 LocatedIssue 物件每輪由 collect_issues 重建, 直接 mutate 物件無法持久。


# ============================================================================
# 內部 helpers
# ============================================================================

def _get_part(score: Score, part_id: str) -> Optional[Part]:
    for p in score.parts:
        if p.part_id == part_id:
            return p
    return None


def _get_event(score: Score, issue: LocatedIssue):
    part = _get_part(score, issue.part_id)
    if part is None:
        return None
    for measure in part.measures:
        if measure.number != issue.measure_number:
            continue
        voice = measure.voices.get(issue.voice_id)
        if voice is None:
            return None
        if issue.event_index >= len(voice.events):
            return None
        return voice.events[issue.event_index]
    return None


def _replace_event(score: Score, issue: LocatedIssue, new_event) -> None:
    part = _get_part(score, issue.part_id)
    if part is None:
        return
    for measure in part.measures:
        if measure.number != issue.measure_number:
            continue
        voice = measure.voices.get(issue.voice_id)
        if voice is None or issue.event_index >= len(voice.events):
            return
        voice.events[issue.event_index] = new_event
        return


_SPELL_RE = re.compile(r"^([A-G][#b]*)(\-?\d+)$")


def _shift_pitch_octave(pitch: Pitch, delta_octaves: int) -> Pitch:
    """產生新的 Pitch (frozen),midi 與 spelling 都按八度更新。"""
    new_midi = pitch.midi_number + delta_octaves * 12
    new_spelling = pitch.spelling
    m = _SPELL_RE.match(pitch.spelling)
    if m:
        name, octave = m.groups()
        new_spelling = f"{name}{int(octave) + delta_octaves}"
    return Pitch(midi_number=new_midi, spelling=new_spelling)

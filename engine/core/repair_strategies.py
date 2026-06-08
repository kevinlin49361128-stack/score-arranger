"""repair_strategies — 定向修復策略 + 策略註冊表 (PHASE_1_STRATEGIES)。

從 repair.py (god file) 抽出。每個 strategy_* 接收 (Score, LocatedIssue) 並回傳
是否成功修改了 Score; 依賴 repair_ops (低階 score 定位/取代/移八度) 與
instruments (可演奏性檢查)。修復迴圈 (repair_loop) 仍由 repair.py 持有, 透過
PHASE_1_STRATEGIES 取用本模組。repair.py re-export 全部 strategy_* 與共用 helper
(_chord_severity / _reduce_chord_to_playable / _harmonic_omit_choice …),
維持 `from core.repair import strategy_octave_shift, ...` 相容。
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from .instruments import (
    check_cello_chord,
    check_guitar_chord,
    check_harp_chord,
    check_lute_chord,
    check_pitch_in_range,
    check_viola_chord,
    check_violin_chord,
    get_profile,
)
from .ir import ChordEvent, NoteEvent, Part, Pitch, RestEvent, Score, Voice
from .repair_ops import (
    _get_event,
    _get_part,
    _replace_event,
    _shift_pitch_octave,
)
from .repair_types import LocatedIssue, _severity_rank


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


def _harmonic_omit_choice(
    pitches: list,
    essential_pcs: Optional[list[int]] = None,
) -> int:
    """挑出和弦中最該省略的音 — 回傳該音在 pitches 內的 index。

    原則 (和聲感知):
    - 保留外聲部 (最低音 = 低音根基, 最高音 = 旋律輪廓)
    - 內聲部中省略和聲上最不關鍵者:
        * 與其他音同 pitch-class 的疊音 → 最該省
        * 完全五度 / 八度 → 可省 (和聲上可被隱含)
        * 三度 (定大小調) / 七度 (定和弦屬性) → 應保留
    - 0.1.31 樂理深化 #6: essential_pcs 來自 A1b harmony_function —
      若提供, 屬於 essential pc 的音額外大幅加分 (= 強制保留,
      包含掛留音解決後該留的根音 / 三音 / V7 七度).
    """
    order = sorted(range(len(pitches)), key=lambda i: pitches[i].midi_number)
    if len(order) < 3:
        return order[-1]  # 2 音 → 省最高, 保留低音根基

    root_midi = pitches[order[0]].midi_number
    pcs = [pitches[i].midi_number % 12 for i in range(len(pitches))]
    essential_set = set(essential_pcs or [])

    def essential(gi: int) -> int:
        """分數越低越該省。"""
        iv = (pitches[gi].midi_number - root_midi) % 12
        pc = pitches[gi].midi_number % 12
        base: int
        if pcs.count(pc) > 1:
            base = 0  # 疊音
        elif iv in (3, 4, 10, 11):
            base = 3  # 三度 / 七度 — 定義和弦, 最該留
        elif iv in (1, 2, 5, 6, 8, 9):
            base = 2  # 其他和聲音
        else:
            base = 1  # 完全五度 / 八度 — 可省
        # A1b essential PC 加分 (但不蓋過「疊音」, 疊音仍最該省)
        if pc in essential_set and base > 0:
            base += 5
        return base

    inner = order[1:-1]  # 只在內聲部中挑
    return min(inner, key=essential)


def _stretch_omit_choice(pitches: list, max_stretch_semitones: int) -> int:
    """對「跨度過大 (stretch)」問題挑該省的音 — 必須真能縮 stretch.

    `_harmonic_omit_choice` 的「保留外聲部」邏輯對 stretch 問題會失敗 —
    例 [64, 68, 71] span=7, 刪中間 68 → [64, 71] 仍 7. 對 stretch 必須
    刪「最外側的音之一」(最高 or 最低).

    策略:
    1. 嘗試刪最高音或最低音, 取能讓 new span <= max_stretch 的
    2. 若兩個都行, 依 _harmonic_omit_choice 的 essential 分數選較不關鍵
       (刪「離 essential 較遠」的音)
    3. 若兩個都不行 (即只刪一音 stretch 仍超 — 例 4 音 stretch 12), 仍刪
       能縮最多 stretch 的那個, 留給後續 repair 迭代再縮
    """
    order = sorted(range(len(pitches)), key=lambda i: pitches[i].midi_number)
    if len(order) < 2:
        return order[0]  # 退化保護
    if len(order) == 2:
        return order[-1]  # 2 音 → 省最高 (與 _harmonic_omit_choice 一致)

    lo_idx, hi_idx = order[0], order[-1]
    lo, hi = pitches[lo_idx].midi_number, pitches[hi_idx].midi_number
    # 刪 lo → 新 span = hi - 第二低
    new_span_no_lo = hi - pitches[order[1]].midi_number
    # 刪 hi → 新 span = 倒數第二高 - lo
    new_span_no_hi = pitches[order[-2]].midi_number - lo

    # 若至少一個能讓 span 達標 — 挑能達標的
    lo_ok = new_span_no_lo <= max_stretch_semitones
    hi_ok = new_span_no_hi <= max_stretch_semitones
    if lo_ok and not hi_ok:
        return lo_idx
    if hi_ok and not lo_ok:
        return hi_idx
    # 兩個都行 — 用 essential score 決定 (刪較不關鍵)
    if lo_ok and hi_ok:
        root_midi = lo
        pcs = [pitches[i].midi_number % 12 for i in range(len(pitches))]

        def essential(gi: int) -> int:
            iv = (pitches[gi].midi_number - root_midi) % 12
            if pcs.count(pitches[gi].midi_number % 12) > 1:
                return 0
            if iv in (3, 4, 10, 11):
                return 3
            if iv in (1, 2, 5, 6, 8, 9):
                return 2
            return 1

        return lo_idx if essential(lo_idx) <= essential(hi_idx) else hi_idx
    # 兩個都不行 — 挑縮最多的, 下一輪 repair 繼續處理
    return lo_idx if new_span_no_lo < new_span_no_hi else hi_idx


# Per-instrument 和弦 checker — lazy import 避免循環依賴
_CHORD_CHECKERS: dict[str, Optional[Callable]] = {}


def _get_chord_checker(instrument_id: str) -> Optional[Callable]:
    """Lazy 載入該樂器的 chord checker. None = 此樂器沒專屬 chord checker."""
    if instrument_id in _CHORD_CHECKERS:
        return _CHORD_CHECKERS[instrument_id]
    checker: Optional[Callable] = None
    try:
        if instrument_id.startswith("violin"):
            from .instruments import check_violin_chord as checker
        elif instrument_id.startswith("viola"):
            from .instruments import check_viola_chord as checker
        elif instrument_id.startswith("cello"):
            from .instruments import check_cello_chord as checker
    except ImportError:
        checker = None
    _CHORD_CHECKERS[instrument_id] = checker
    return checker


def _pick_best_stretch_omit(
    pitches: list, instrument_id: str,
) -> Optional[int]:
    """Brute-force: 試每個 omit, 重新跑 checker, 挑嚴重度降最低者.

    Stretch 計算用 fret 距離 (不是 pitch semitone), 而 fret 取決於弦 assignment
    邏輯. 為避免在 repair 裡 reimplement 整套 assignment, 直接呼叫 checker
    驗證每個 candidate, 選結果 severity 最佳者.

    Severity ranking: ok(0) < info(1) < warning(2) < error(3).
    若多個 candidate severity 相同, 選保留外聲部者 (與 _harmonic_omit_choice
    啟發式一致).

    回傳 None 代表「沒一個 omit 改善現狀」, 留給 split_to_parts 等其他策略.
    """
    checker = _get_chord_checker(instrument_id)
    if checker is None:
        # 沒專屬 checker — 退回 essential-based 選擇
        return _harmonic_omit_choice(pitches)

    sev_rank = {"ok": 0, "info": 1, "warning": 2, "error": 3}
    # 當前 severity (起點)
    current_result = checker(pitches)
    current_rank = sev_rank.get(current_result.severity, 3)

    best_idx: Optional[int] = None
    best_rank = current_rank + 1  # 必須嚴格小於當前
    # 多個 candidate 並列時, 偏好不刪外聲部 (lo / hi)
    sorted_indices = sorted(
        range(len(pitches)), key=lambda i: pitches[i].midi_number,
    )
    inner_ids = set(sorted_indices[1:-1]) if len(sorted_indices) >= 3 else set()

    for omit_idx in range(len(pitches)):
        candidate = [p for i, p in enumerate(pitches) if i != omit_idx]
        if not candidate:
            continue
        try:
            r = checker(candidate)
        except Exception:
            continue
        rank = sev_rank.get(r.severity, 3)
        if rank < best_rank:
            best_rank = rank
            best_idx = omit_idx
        elif rank == best_rank and best_idx is not None:
            # tie-break: 偏好刪內聲部 (omit_idx in inner)
            if omit_idx in inner_ids and best_idx not in inner_ids:
                best_idx = omit_idx
    return best_idx


def strategy_omit_note(score: Score, issue: LocatedIssue) -> bool:
    """策略 2 (Phase 1 範圍): 對和弦超載問題省略一個音。

    和聲感知啟發式: 保留外聲部, 內聲部中省略和聲上最不關鍵的音 (疊音 /
    完全五度 / 八度優先省, 三度與七度保留)。2 音和弦則省最高.

    Stretch (跨度過大) 問題例外: 用 _stretch_omit_choice — 必須刪外側音
    (最高 or 最低) 才能縮 stretch, 不然刪內聲部後 stretch 不變.

    0.1.29: omit_codes 補齊 viola/cello/fretted/harp 對應 code; stretch
    類 issue 改走 _stretch_omit_choice (修 Schumann Op48no2 鋼琴→SQ 場景).
    """
    # 一般 omit (適合「太多音」/「非相鄰弦」/「fret 太高」等問題)
    general_omit_codes = {
        "E_STRING_CHORD_EXCEED",
        "E_NON_ADJACENT_STRINGS",
        "E_PIANO_HAND_SPAN_EXCEED",
        "W_PIANO_HAND_SPAN_LARGE",
        "E_HARPSICHORD_HAND_SPAN_EXCEED",
        "W_HARPSICHORD_HAND_SPAN_LARGE",
        "W_VIOLIN_TRIPLE_QUAD_STOP",
        "W_VIOLA_TRIPLE_QUAD_STOP",
        "W_CELLO_TRIPLE_QUAD_STOP",
        "E_CELLO_FRET_TOO_HIGH",
        "E_VIOLA_FRET_TOO_HIGH",
        "E_FRETTED_CHORD_INFEASIBLE",
        "E_FRETTED_FRET_TOO_HIGH",
        "W_FRETTED_HIGH_POSITION",
        "E_HARP_TOO_MANY_NOTES",
        "E_HARP_SAME_STRING",
        "W_HARP_WIDE_SPAN",
    }
    # Stretch 類 — 用專屬 chooser (必須刪外側音才能縮 span)
    stretch_omit_codes = {
        "E_VIOLIN_STRETCH_EXCEED",
        "W_VIOLIN_STRETCH_LARGE",
        "E_VIOLA_STRETCH_EXCEED",
        "W_VIOLA_STRETCH_LARGE",
        "E_CELLO_STRETCH_EXCEED",
        "W_CELLO_STRETCH_LARGE",
        "W_FRETTED_STRETCH_LARGE",
    }
    code = issue.result.code
    if code not in general_omit_codes and code not in stretch_omit_codes:
        return False

    event = _get_event(score, issue)
    if not isinstance(event, ChordEvent):
        return False
    if len(event.pitches) < 2:
        return False

    if code in stretch_omit_codes:
        # Stretch 用 fret 距離算 (不是 pitch semitone 距離), 而 fret 取決於
        # 「哪個音放哪根弦」的 assignment 邏輯 — 不能只看 semitone span 推測.
        # 改用 brute-force: 試每個 omit, 重新跑 checker, 挑能讓嚴重度降到
        # 最低的那個 omit. 4-音和弦最多試 4 次, 成本可接受.
        part = _get_part(score, issue.part_id)
        instrument_id = part.instrument_id if part is not None else ""
        omit_idx = _pick_best_stretch_omit(
            event.pitches, instrument_id,
        )
        if omit_idx is None:
            # 沒一個 omit 能改善 — 交給其他策略 (例 split_to_parts)
            return False
        remaining = [p for i, p in enumerate(event.pitches) if i != omit_idx]
    else:
        # 一般 omit: 對「和弦在該樂器上無法演奏」類錯誤, 反覆省略和聲最不
        # 關鍵的音, 直到該樂器能演奏 (或剩單音)。
        #
        # 為何要 loop (0.1.67 修回歸): 4-音「雙非相鄰弦」和弦 (e.g. G3+Bb3
        # 同擠 G 弦、Eb4+G4 同擠 D 弦) 省「一」音後仍違規 → repair_loop 的
        # strict-better 門檻會擋掉只降一點點的單步省略, 該錯誤就永遠修不掉、
        # 被標 manual (使用者看到殘留的錯誤)。一次省到可演奏, 單步即嚴格降
        # 嚴重度, ERROR 才能收斂歸零。
        # 2-音和弦 / warning 類 (該樂器評估非 error): while 不觸發 → 等同舊單步.
        part = _get_part(score, issue.part_id)
        instrument_id = part.instrument_id if part is not None else ""
        remaining = _reduce_chord_to_playable(event.pitches, instrument_id)
        if len(remaining) == len(event.pitches):
            # 一步都沒省 (該樂器的 error _chord_severity 不涵蓋, e.g. 鋼琴/
            # 大鍵琴跨距類) → 退回舊單步啟發式, 維持既有行為.
            omit_idx = _harmonic_omit_choice(event.pitches)
            remaining = [
                p for i, p in enumerate(event.pitches) if i != omit_idx
            ]
    sorted_pitches = sorted(remaining, key=lambda p: p.midi_number)

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


def _other_hand_part_id(part_id: str) -> Optional[str]:
    """Grand-staff 鋼琴配對: piano_*_upper ↔ piano_*_lower。非 grand-staff 回 None."""
    if part_id.endswith("_upper"):
        return part_id[: -len("_upper")] + "_lower"
    if part_id.endswith("_lower"):
        return part_id[: -len("_lower")] + "_upper"
    return None


def _is_other_hand_slot_free(measure, onset) -> bool:
    """另一手在這個 onset 是否空閒 (沒事件 / 只是休止符 / 之前事件已結束)。"""
    if measure is None:
        return True
    for vid in sorted(measure.voices):
        voice = measure.voices[vid]
        if voice.is_divisi:
            continue
        for ev in voice.events:
            ev_onset = float(ev.onset)
            ev_end = ev_onset + float(ev.duration)
            # 完全沒重疊 → 不影響
            if ev_end <= float(onset) + 1e-6:
                continue
            if ev_onset >= float(onset) + 1e-6:
                # 後續的事件, 此 onset 之前不影響
                # 但同 onset 的事件需檢查
                if abs(ev_onset - float(onset)) < 1e-6:
                    if isinstance(ev, (NoteEvent, ChordEvent)):
                        return False
                continue
            # 重疊中 (ev_onset <= onset < ev_end)
            if isinstance(ev, (NoteEvent, ChordEvent)):
                return False
    return True


def _redistribute_event(
    event: ChordEvent,
    moved_pitch: Pitch,
    target_measure,
    target_voice_id: int,
) -> ChordEvent:
    """從 event.pitches 移除 moved_pitch, 並在 target_measure 插入新事件。

    回傳 (mutated) event 的剩餘 ChordEvent — 若只剩 1 音由 caller 改成 NoteEvent。
    target_measure 不存在 target_voice_id 時自動建立 Voice。
    """
    new_pitches = [p for p in event.pitches if p.midi_number != moved_pitch.midi_number]
    event.pitches = new_pitches

    new_note = NoteEvent(
        pitch=moved_pitch,
        duration=event.duration,
        onset=event.onset,
        articulations=list(event.articulations),
        dynamic=event.dynamic,
    )
    if target_voice_id not in target_measure.voices:
        target_measure.voices[target_voice_id] = Voice(
            voice_id=target_voice_id, events=[new_note],
        )
    else:
        v = target_measure.voices[target_voice_id]
        # 若該 onset 有 RestEvent, 移除再插入新音 — 否則保留排序
        v.events = [
            ev for ev in v.events
            if not (
                abs(float(ev.onset) - float(event.onset)) < 1e-6
                and isinstance(ev, RestEvent)
            )
        ]
        v.events.append(new_note)
        v.events.sort(key=lambda e: float(e.onset))
    return event


def strategy_hand_redistribute(score: Score, issue: LocatedIssue) -> bool:
    """策略 (H): 鋼琴 grand-staff 同 onset 重分配 — 把邊界音移到空閒的另一手。

    比 split_to_other_hand 保守: 只有當另一手該 onset 空閒 (無事件 / 只是休止符)
    才動手, 而且只搬「最外側一音」(upper 搬最低音 / lower 搬最高音). 適合
    Chopin nocturne 右手寬距離 + 左手在拍頭剛好空, 或 Schumann 左手 thumb-cross
    寫法把音越過 C4 被 cli.py 初始 split 誤分的場景.

    觸發碼: PIANO_HAND_SPAN_EXCEED / LARGE / TOO_MANY_NOTES_ONE_HAND.
    僅作用於 *_upper / *_lower 配對的 ChordEvent. 若另一手該 onset 已被佔, 直接
    回 False 讓 split_to_other_hand 或 omit_note 接手 — 不貿然合併破壞既有結構.
    """
    if issue.result.code not in (
        "E_PIANO_HAND_SPAN_EXCEED",
        "W_PIANO_HAND_SPAN_LARGE",
        "W_PIANO_TOO_MANY_NOTES_ONE_HAND",
    ):
        return False

    event = _get_event(score, issue)
    if not isinstance(event, ChordEvent) or len(event.pitches) < 2:
        return False

    current_part = _get_part(score, issue.part_id)
    if current_part is None or current_part.instrument_id != "piano":
        return False

    other_part_id = _other_hand_part_id(current_part.part_id)
    if other_part_id is None:
        return False
    other_part = _get_part(score, other_part_id)
    if other_part is None:
        return False

    is_upper = current_part.part_id.endswith("_upper")

    other_measure = next(
        (m for m in other_part.measures if m.number == issue.measure_number),
        None,
    )
    if not _is_other_hand_slot_free(other_measure, event.onset):
        return False
    if other_measure is None:
        # 沒對應 measure → 不貿然新建
        return False

    sorted_pitches = sorted(event.pitches, key=lambda p: p.midi_number)
    # upper 搬最低音到 lower; lower 搬最高音到 upper
    moved_pitch = sorted_pitches[0] if is_upper else sorted_pitches[-1]

    # 搬走後剩餘音必須真的縮小 span — 否則不採用 (對 stretch 無效就讓給其他策略)
    remaining = [p for p in sorted_pitches if p.midi_number != moved_pitch.midi_number]
    if len(remaining) < 1:
        return False

    target_vid = 1 if 1 in other_measure.voices else (
        next(iter(other_measure.voices), None) if other_measure.voices else 1
    )
    if target_vid is None:
        target_vid = 1

    _redistribute_event(event, moved_pitch, other_measure, target_vid)

    # 若原 event 變成單音 → 改 NoteEvent
    if len(event.pitches) == 1:
        new_event = NoteEvent(
            pitch=event.pitches[0],
            duration=event.duration,
            onset=event.onset,
            articulations=list(event.articulations),
            dynamic=event.dynamic,
            is_tied_from=event.is_tied_from,
            is_tied_to=event.is_tied_to,
            slur_group=event.slur_group,
        )
        _replace_event(score, issue, new_event)

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

    moved_event: NoteEvent | ChordEvent
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


# ── 策略 4: 跨聲部和弦拆分 ───────────────────────────────────────────────

# 觸發碼: 單一弦樂聲部裝不下整塊和弦
_SPLIT_TRIGGER_CODES = {
    "E_NON_ADJACENT_STRINGS",
    "E_STRING_CHORD_EXCEED",
    "E_NOTE_BELOW_STRING",
}


def _chord_severity(pitches: list[Pitch], instrument_id: str) -> str:
    """這組音在該樂器上一起演奏的最嚴重 severity ('ok' / 'warning' / 'error')。"""
    profile = get_profile(instrument_id)
    if profile is None:
        return "ok"
    if len(pitches) == 1:
        return check_pitch_in_range(pitches[0], profile).severity
    if instrument_id == "violin":
        return check_violin_chord(pitches).severity
    if instrument_id == "viola":
        return check_viola_chord(pitches).severity
    if instrument_id == "cello":
        return check_cello_chord(pitches).severity
    if instrument_id == "guitar":
        return check_guitar_chord(pitches).severity
    if instrument_id == "lute":
        return check_lute_chord(pitches).severity
    if instrument_id == "harp":
        return check_harp_chord(pitches).severity
    worst = "ok"
    for p in pitches:
        sev = check_pitch_in_range(p, profile).severity
        if _severity_rank(sev) > _severity_rank(worst):
            worst = sev
    return worst


def _reduce_chord_to_playable(pitches: list, instrument_id: str) -> list:
    """反覆省略和聲最不關鍵的音, 直到該樂器能演奏 (或剩單音)。回傳剩餘 pitch list。

    用於兩處: (1) strategy_omit_note 一般 omit 分支; (2) repair_loop 收斂後的
    _force_resolve_chord_errors 保底掃描。關鍵: 一次省到可演奏 —— 4-音「雙非
    相鄰弦」和弦省一音後仍違規, 單步省略無法讓嚴重度嚴格下降。
    _chord_severity 評估非 'error' (e.g. 2-音 / 該樂器不涵蓋) 時不省, 原樣回傳。
    """
    remaining = list(pitches)
    while (
        len(remaining) >= 2
        and _chord_severity(remaining, instrument_id) == "error"
    ):
        remaining.pop(_harmonic_omit_choice(remaining))
    return remaining


def _event_at_onset(measure, onset) -> tuple[Optional[int], Optional[int], Any]:
    """measure 內某 onset 的既有事件 → (voice_id, index, event); 無則三個 None。"""
    for vid in sorted(measure.voices):
        voice = measure.voices[vid]
        if voice.is_divisi:
            continue
        for idx, ev in enumerate(voice.events):
            if abs(ev.onset - onset) < 1e-6:
                return vid, idx, ev
    return None, None, None


def strategy_split_chord_to_parts(score: Score, issue: LocatedIssue) -> bool:
    """策略 4: 把單一弦樂聲部演奏不了的和弦, 拆分給鄰近聲部。

    弦樂四重奏等多聲部編制裡, 一塊鋼琴式的和弦常常單一小提琴吃不下 (跨非
    相鄰弦 / 音數超過弦數 / 有音低於最低弦)。本策略把和弦下方的音分配給
    其他弦樂聲部 (violin II / viola / cello), 旋律頂音留在原聲部 —— 這正是
    弦樂改編最正統的處理: 不丟音, 只是把一個樂器吃不下的和弦攤給聲部群。

    盡量把每個移出音安置到某個鄰近聲部 (併入後該聲部仍須可演奏); 真的
    無處可去的音才省略 —— 仍優於整顆和弦演奏不出來。一個音都搬不動時
    回傳 False, 交給 omit_note 等策略處理。
    """
    if issue.result.code not in _SPLIT_TRIGGER_CODES:
        return False

    event = _get_event(score, issue)
    if not isinstance(event, ChordEvent) or len(event.pitches) < 2:
        return False

    part_a = _get_part(score, issue.part_id)
    if part_a is None:
        return False
    profile_a = get_profile(part_a.instrument_id)
    if profile_a is None or profile_a.family != "string_bowed":
        return False

    # 原聲部保留哪些音: 由高到低貪婪擴充 (旋律頂音必留), 加到再加就 error 為止
    asc = sorted(event.pitches, key=lambda p: p.midi_number)
    keep: list[Pitch] = []
    for p in reversed(asc):
        trial = sorted([*keep, p], key=lambda x: x.midi_number)
        if _chord_severity(trial, part_a.instrument_id) == "error":
            break
        keep = trial
    if not keep:
        return False
    keep_midis = {p.midi_number for p in keep}
    move = [p for p in asc if p.midi_number not in keep_midis]
    if not move:
        return False

    # 候選接收聲部 — 其他弦樂聲部
    receivers: list[Part] = []
    for rp in score.parts:
        if rp.part_id == part_a.part_id:
            continue
        rprof = get_profile(rp.instrument_id)
        if rprof is not None and rprof.family == "string_bowed":
            receivers.append(rp)
    if not receivers:
        return False

    # 規劃: 每個移出音找一個接收聲部 (一聲部最多接一音); 全部安置得了才動手
    used: set[str] = set()
    plan: list[tuple[Part, Optional[int], Optional[int], Any, Pitch]] = []
    for note in move:
        chosen: Optional[tuple[Part, Optional[int], Optional[int], Any]] = None
        chosen_rank: Optional[tuple[bool, bool, float]] = None
        for rp in receivers:
            if rp.part_id in used:
                continue
            rprof = get_profile(rp.instrument_id)
            if rprof is None:
                continue
            measure = next(
                (m for m in rp.measures if m.number == issue.measure_number),
                None,
            )
            if measure is None:
                continue
            vid, idx, slot = _event_at_onset(measure, event.onset)
            if isinstance(slot, ChordEvent):
                have = {q.midi_number for q in slot.pitches}
                merged = (list(slot.pitches) if note.midi_number in have
                          else [*slot.pitches, note])
            elif isinstance(slot, NoteEvent):
                merged = [slot.pitch, note]
            else:
                merged = [note]
            if _chord_severity(merged, rp.instrument_id) == "error":
                continue
            lo, hi = rprof.range_comfortable
            rank = (
                lo <= note.midi_number <= hi,                  # 在舒適音域
                not isinstance(slot, (NoteEvent, ChordEvent)),  # 空槽優先
                -abs(note.midi_number - (lo + hi) / 2.0),       # 音域中心近
            )
            if chosen_rank is None or rank > chosen_rank:
                chosen_rank = rank
                chosen = (rp, vid, idx, slot)
        if chosen is None:
            continue                    # 此音無處安置 → 略過 (等同省略此音)
        used.add(chosen[0].part_id)
        plan.append((chosen[0], chosen[1], chosen[2], chosen[3], note))

    if not plan:
        return False                    # 一個音都搬不動 → 交給 omit_note 處理

    # 執行 — 原聲部只留 keep
    if len(keep) == 1:
        _replace_event(score, issue, NoteEvent(
            pitch=keep[0], duration=event.duration, onset=event.onset,
            articulations=list(event.articulations), dynamic=event.dynamic,
            is_tied_from=event.is_tied_from, is_tied_to=event.is_tied_to,
            slur_group=event.slur_group,
        ))
    else:
        event.pitches = keep

    # 執行 — 移出的音併入各接收聲部
    for rp, vid, idx, slot, note in plan:
        measure = next(
            m for m in rp.measures if m.number == issue.measure_number
        )
        if isinstance(slot, ChordEvent):
            if note.midi_number not in {q.midi_number for q in slot.pitches}:
                slot.pitches = sorted(
                    [*slot.pitches, note], key=lambda p: p.midi_number,
                )
        elif isinstance(slot, NoteEvent):
            assert vid is not None and idx is not None
            measure.voices[vid].events[idx] = ChordEvent(
                pitches=sorted([slot.pitch, note],
                               key=lambda p: p.midi_number),
                duration=slot.duration, onset=slot.onset,
                articulations=list(slot.articulations), dynamic=slot.dynamic,
            )
        else:
            new_note = NoteEvent(
                pitch=note, duration=event.duration, onset=event.onset,
                articulations=list(event.articulations), dynamic=event.dynamic,
            )
            if slot is not None and vid is not None and idx is not None:
                measure.voices[vid].events[idx] = new_note   # 取代休止符
            else:
                tvid = 1 if 1 in measure.voices else (
                    min(measure.voices) if measure.voices else 1
                )
                if tvid in measure.voices:
                    measure.voices[tvid].events.append(new_note)
                    measure.voices[tvid].events.sort(key=lambda e: e.onset)
                else:
                    measure.voices[tvid] = Voice(
                        voice_id=tvid, events=[new_note],
                    )

    return True


def strategy_reassign_note(score: Score, issue: LocatedIssue) -> bool:
    """0.1.48 A4 — 單音聲部重分配 (Phase 2 加深層重編).

    當 NoteEvent (非和弦) 的音超出本聲部音域, octave_shift 試過後仍無解,
    把整個音搬到能演奏的另一個聲部 (同樂器族群優先, 違例極限再跨族群).
    比 omit_note (丟音) 樂理上保留度高.

    觸發: E_PITCH_BELOW_RANGE / E_PITCH_ABOVE_RANGE 在 NoteEvent
    (CLAUDE.md 修復優先序「移八度 > 省略次要音 > 重分配聲部 > ...」之第三層).

    策略要求:
      1. 接收聲部該位置必須空 (RestEvent 或無事件) — 不蓋掉現有音
      2. 接收聲部 instrument 必須能演奏該 pitch (range_absolute)
      3. 原聲部該事件改成 RestEvent 保留 duration

    家族優先序 (跟 split_chord_to_parts 一致):
      string_bowed → string_plucked → woodwind → brass → voice → keyboard
    """
    if issue.result.code not in (
        "E_PITCH_BELOW_RANGE", "E_PITCH_ABOVE_RANGE",
    ):
        return False

    event = _get_event(score, issue)
    if not isinstance(event, NoteEvent):
        return False

    src_part = _get_part(score, issue.part_id)
    if src_part is None:
        return False

    note_midi = event.pitch.midi_number
    src_profile = get_profile(src_part.instrument_id)
    if src_profile is None:
        return False
    src_family = src_profile.family

    # 候選接收聲部 — 同 family 優先
    def family_rank(family: str) -> int:
        order = [
            "string_bowed", "string_plucked", "woodwind", "brass",
            "voice", "keyboard",
        ]
        try:
            return order.index(family)
        except ValueError:
            return 999

    receivers: list[tuple[int, Part]] = []
    for rp in score.parts:
        if rp.part_id == src_part.part_id:
            continue
        rprof = get_profile(rp.instrument_id)
        if rprof is None:
            continue
        # 必須能彈這個音 (range_absolute, 不要求 comfortable)
        abs_low, abs_high = rprof.range_absolute
        if not (abs_low <= note_midi <= abs_high):
            continue
        same_family = (rprof.family == src_family)
        # 同家族 (1) 排前面, 不同家族用 family_rank 排
        priority = 0 if same_family else family_rank(rprof.family) + 1
        receivers.append((priority, rp))
    if not receivers:
        return False
    receivers.sort(key=lambda x: x[0])

    # 找空槽: 接收聲部該 measure 該 onset 必須無事件 (或 RestEvent)
    chosen: Optional[tuple[Part, int]] = None
    for _, rp in receivers:
        measure = next(
            (m for m in rp.measures if m.number == issue.measure_number),
            None,
        )
        if measure is None:
            continue
        # 取主 voice (voice_id=1) 或第一個 voice
        target_vid = 1 if 1 in measure.voices else (
            next(iter(measure.voices), None) if measure.voices else None
        )
        if target_vid is None:
            continue
        # 檢查該 onset 是否空 — 容許 RestEvent (蓋過去 OK)
        slot_idx: Optional[int] = None
        is_compatible = True
        for ei, ev in enumerate(measure.voices[target_vid].events):
            if abs(float(ev.onset) - float(event.onset)) < 1e-6:
                slot_idx = ei
                if isinstance(ev, (NoteEvent, ChordEvent)):
                    # 已有實質音, 不蓋
                    is_compatible = False
                break
        if not is_compatible:
            continue
        # 找到合適 receiver
        chosen = (rp, target_vid)
        break

    if chosen is None:
        return False

    receiver_part, receiver_vid = chosen
    # 執行: 原聲部 → RestEvent (保留 duration / onset)
    src_measure = next(
        (m for m in src_part.measures if m.number == issue.measure_number),
        None,
    )
    if src_measure is None:
        return False
    src_voice = src_measure.voices.get(issue.voice_id)
    if src_voice is None or issue.event_index >= len(src_voice.events):
        return False

    rest = RestEvent(onset=event.onset, duration=event.duration)
    src_voice.events[issue.event_index] = rest

    # 接收聲部: 新增 NoteEvent (移除舊 RestEvent 如果有)
    new_note = NoteEvent(
        onset=event.onset, duration=event.duration,
        pitch=event.pitch,
        dynamic=event.dynamic,
        articulations=list(event.articulations or []),
    )
    receiver_measure = next(
        (m for m in receiver_part.measures if m.number == issue.measure_number),
        None,
    )
    if receiver_measure is None:
        # 應該不會發生 — 上面已確認 measure 存在
        return True  # 還是回 True, 因為 src 已改, repair loop 會驗證
    voice = receiver_measure.voices.get(receiver_vid)
    if voice is None:
        receiver_measure.voices[receiver_vid] = Voice(
            voice_id=receiver_vid, events=[new_note],
        )
    else:
        # 移除舊 RestEvent at same onset
        voice.events = [
            ev for ev in voice.events
            if not (abs(float(ev.onset) - float(event.onset)) < 1e-6
                    and not isinstance(ev, (NoteEvent, ChordEvent)))
        ]
        voice.events.append(new_note)
        voice.events.sort(key=lambda e: float(e.onset))

    return True


# Phase 1 註冊的策略 (按優先序: 影響從小到大)
# 0.1.48: reassign_note 排在 omit_note 之後 — 兩個都保留旋律連續性
# 但 reassign 跨聲部成本更高, 優先試 omit 內聲部.
# H: hand_redistribute 比 split_to_other_hand 更保守 (只搬最外側一音 + 要求
# 另一手空閒) 故排前. 兩者都不適用時 omit_note 兜底.
PHASE_1_STRATEGIES: list[tuple[str, RepairStrategy]] = [
    ("octave_shift", strategy_octave_shift),
    ("hand_redistribute", strategy_hand_redistribute),
    ("omit_note", strategy_omit_note),
    ("split_to_other_hand", strategy_split_to_other_hand),
    ("split_to_parts", strategy_split_chord_to_parts),
    ("reassign_note", strategy_reassign_note),
]

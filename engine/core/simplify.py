"""
簡化 (Simplification) — enrich.py 的鏡像

  把改編譜「降難度」, 服務「老師把譜改簡單給學生」這個核心使用情境。

四種手法 (對應 difficulty-loop-plan.md Batch 1):
  1. 和弦瘦身 — 把厚和弦逐音省到目標音數, 必要時退回單音。
     複用 repair.py 的 _harmonic_omit_choice (和聲感知: 省疊音 / 完全
     五八度, 留三度七度)。
  2. 八度收摺 — 把超出樂器舒適音域的單音移八度收回, 降低音域 / 把位
     難度。複用 repair.py 的 _shift_pitch_octave。
  3. 去裝飾 — 清掉 ornament (顫音 / 漣音 / 迴音…) 與 grace_before 倚音。
  4. 演奏法簡化 — 剝除困難弓法 / 演奏法 (spiccato 等, 見 difficulty.py
     的 _DEMANDING_ARTICULATIONS)。

旋律保護 (對應 plan §四.1, 最重要的設計約束):
  和弦瘦身永遠保留「最高音」—— 在改編譜裡旋律恆在和弦頂端 (enrich 也
  如此保證)。三音以上用 _harmonic_omit_choice 只省內聲部; 兩音則省較低
  音。因此旋律音永遠不會被簡化掉。八度收摺只改音域、不刪音, 音級不變。

level 控制和弦瘦身的深度; 去裝飾 / 演奏法簡化 / 八度收摺一律套用
(它們都是無歧義的簡化, 不需分等級)。

設計約束:
  - 鎖定 (is_locked) 的事件不碰。
  - 不需要 source score (與 enrich 不同) —— 簡化只看目標譜本身。
"""

from __future__ import annotations

from core.difficulty import _DEMANDING_ARTICULATIONS
from core.instruments import get_profile
from core.ir import ChordEvent, NoteEvent
from core.repair import _harmonic_omit_choice, _shift_pitch_octave

Level = str  # "light" | "medium" | "full"

# level → 和弦瘦身的目標音數 (含旋律音)
_THIN_TARGET = {"light": 3, "medium": 2, "full": 1}


def _thin_chord(pitches: list, target_size: int) -> list:
    """把和弦音瘦身到 target_size 個音; 旋律 (最高音) 必留。

    三音以上用 _harmonic_omit_choice 省內聲部 (外聲部含旋律保留);
    兩音則省較低音 (保留最高音 = 旋律)。回傳保留下來的 Pitch list
    (至少 1 個)。
    """
    kept = list(pitches)
    while len(kept) > target_size and len(kept) >= 2:
        if len(kept) >= 3:
            idx = _harmonic_omit_choice(kept)
        else:
            # 兩音 — 省較低音, 保留旋律 (最高音)
            idx = min(range(len(kept)), key=lambda i: kept[i].midi_number)
        kept.pop(idx)
    return kept


def _fold_into_range(pitch, profile, override_range=None):
    """音超出 comfortable 音域時移八度收回; 否則回 None。

    回傳新的 Pitch (音級不變, 只改八度), 或 None (不需收摺 / 收不回)。

    0.1.54 B: override_range — 若提供 (e.g. amateur 用 range_amateur),
    取代 comfortable 當判斷上下限. abs_low/abs_high 仍用 absolute (避免
    把音推到實體不能彈的位置).
    """
    low, high = override_range if override_range else profile.range_comfortable
    abs_low, abs_high = profile.range_absolute
    midi = pitch.midi_number
    delta = 0
    cur = midi
    if midi > high:
        while cur > high and (cur - 12) >= abs_low:
            delta -= 1
            cur -= 12
    elif midi < low:
        while cur < low and (cur + 12) <= abs_high:
            delta += 1
            cur += 12
    if delta == 0:
        return None
    return _shift_pitch_octave(pitch, delta)


def _simplify_event(ev, target_size: int, profile, fold_range=None):
    """回傳簡化後要放回聲部的事件; 不需簡化則回 None。

    可能就地修改 ev 後回傳同一個物件, 或在和弦瘦身退回單音時回傳一個
    全新的 NoteEvent。

    0.1.54 B: fold_range — 給 amateur 用的 override range (見 _fold_into_range).
    """
    if not isinstance(ev, (NoteEvent, ChordEvent)):
        return None
    if getattr(ev, "is_locked", False):
        return None

    did = False

    # 1. 去裝飾
    if ev.ornament is not None:
        ev.ornament = None
        did = True
    if ev.grace_before:
        ev.grace_before = []
        did = True

    # 2. 演奏法簡化
    kept_arts = [a for a in ev.articulations
                 if a not in _DEMANDING_ARTICULATIONS]
    if len(kept_arts) != len(ev.articulations):
        ev.articulations = kept_arts
        did = True

    # 3. 八度收摺 (僅單音 — 把超出舒適音域的音收回)
    if isinstance(ev, NoteEvent) and profile is not None:
        folded = _fold_into_range(ev.pitch, profile, override_range=fold_range)
        if folded is not None:
            ev.pitch = folded
            did = True

    # 4. 和弦瘦身
    if isinstance(ev, ChordEvent) and len(ev.pitches) > target_size:
        kept = _thin_chord(ev.pitches, target_size)
        if len(kept) <= 1:
            # 退回單音 — 保留的是旋律 (最高音), 改為 NoteEvent
            return NoteEvent(
                pitch=kept[0],
                duration=ev.duration,
                onset=ev.onset,
                articulations=list(ev.articulations),
                dynamic=ev.dynamic,
                is_tied_from=ev.is_tied_from,
                is_tied_to=ev.is_tied_to,
                slur_group=ev.slur_group,
            )
        if len(kept) < len(ev.pitches):
            ev.pitches = sorted(kept, key=lambda p: p.midi_number)
            did = True

    return ev if did else None


def simplify_part(
    part_measures: list,
    measure_start: int,
    measure_end: int,
    level: Level = "medium",
    instrument_id: str = "violin",
    skill_level: str = "intermediate",
) -> int:
    """把目標聲部 [measure_start, measure_end] 的事件簡化, 降低演奏難度。

    就地修改 part_measures (list[Measure]); 回傳實際改動的事件數。

    Args:
        part_measures: 目標 Part 的 measures。
        measure_start / measure_end: 小節範圍 (含端點)。
        level: "light" | "medium" | "full" — 和弦瘦身的深度
            (light → 留三和弦, medium → 留雙音, full → 退到單音)。
        instrument_id: 目標樂器 — 決定八度收摺用的舒適音域。
        skill_level: "amateur" | "intermediate" | "professional" — 0.1.54 B
            amateur 時若樂器有 range_amateur (e.g. 弦樂限 1-3 把位) 改用該
            音域當收摺上下限, 使高把位音域自動收回低把位.
    """
    profile = get_profile(instrument_id)
    target_size = _THIN_TARGET.get(level, 2)
    # amateur 把 fold range 換成 range_amateur (弦樂 1-3 把位)
    fold_range = None
    if skill_level == "amateur" and profile is not None:
        fold_range = getattr(profile, "range_amateur", None)
    changed = 0
    for measure in part_measures:
        if not measure_start <= measure.number <= measure_end:
            continue
        for voice in measure.voices.values():
            if getattr(voice, "is_divisi", False):
                continue
            new_events: list = []
            voice_changed = False
            for ev in voice.events:
                result = _simplify_event(
                    ev, target_size, profile, fold_range=fold_range,
                )
                if result is None:
                    new_events.append(ev)
                else:
                    new_events.append(result)
                    voice_changed = True
                    changed += 1
            if voice_changed:
                voice.events = new_events
    return changed

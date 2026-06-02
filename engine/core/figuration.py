"""B2: 慣用音型生成 (opt-in, 保守) — 把弓弦聲部的「長音塊狀和弦」
(≥ 二分音符) 轉成分解和弦 (broken chord / arpeggio)。

為何保守 + 只動長塊狀和弦:
  弦樂無法真的「持續」按住 3-4 音的塊狀和弦 (要同時壓多條相鄰弦), 一個長的
  塊狀和弦在弦樂上本就難以維持; 拆成分解和弦既更慣用 (arpeggiando) 也更好彈。
  只動「明顯靜態的長和弦」, 不碰旋律 / 已在動的聲部 / 短和弦, 風險最低。
  使用者主動觸發 + 可復原 (Cmd+Z)。misfire 不該發生在這個保守範圍。
"""
from __future__ import annotations

from fractions import Fraction
from typing import Optional

from .ir import ChordEvent, NoteEvent, Pitch, Score

_BOWED_STRINGS = {"violin", "viola", "cello", "double_bass", "contrabass"}
_MIN_CHORD_QL = Fraction(2)   # 只處理 ≥ 二分音符的塊狀和弦
_SUB_QL = Fraction(1, 2)      # 分解後每個音的目標時值 (八分音符)


def _max_slur_group(score: Score) -> int:
    hi = 0
    for part in score.parts:
        for m in part.measures:
            for v in m.voices.values():
                for ev in v.events:
                    g = getattr(ev, "slur_group", None)
                    if isinstance(g, int) and g > hi:
                        hi = g
    return hi


def apply_figuration(score: Score) -> int:
    """弓弦聲部的長塊狀和弦 → 分解和弦。就地修改, 回傳轉換的和弦數。"""
    changes = 0
    next_slur = _max_slur_group(score) + 1
    for part in score.parts:
        if part.instrument_id not in _BOWED_STRINGS:
            continue
        for measure in part.measures:
            for voice in measure.voices.values():
                if voice.is_divisi:
                    continue
                new_events, added, next_slur = _figurate(voice.events, next_slur)
                if added:
                    voice.events = new_events
                    changes += added
    return changes


def _figurate(events: list, next_slur: int) -> tuple[list, int, int]:
    out: list = []
    added = 0
    for ev in events:
        if (
            isinstance(ev, ChordEvent)
            and not getattr(ev, "is_locked", False)
            and Fraction(ev.duration) >= _MIN_CHORD_QL
        ):
            arp = _break_chord(ev, next_slur)
            if arp is not None:
                out.extend(arp)
                next_slur += 1
                added += 1
                continue
        out.append(ev)
    return out, added, next_slur


def _break_chord(chord: ChordEvent, slur_group: int) -> Optional[list]:
    """把一個塊狀和弦拆成「上行分解和弦」(填滿原時值, 整段連弓)。"""
    pitches = sorted(chord.pitches, key=lambda p: p.midi_number)
    if len(pitches) < 2:
        return None
    total = Fraction(chord.duration)
    # 子音數: 對齊八分音符網格, 但至少每個和弦音出現一次
    count = max(len(pitches), round(total / _SUB_QL))
    sub = total / count  # 精確 Fraction, 總和 == total
    notes: list = []
    onset = Fraction(chord.onset)
    for i in range(count):
        p = pitches[i % len(pitches)]
        notes.append(NoteEvent(
            pitch=Pitch(midi_number=p.midi_number, spelling=p.spelling),
            duration=sub,
            onset=onset,
            articulations=list(chord.articulations),
            dynamic=chord.dynamic,
            slur_group=slur_group,
        ))
        onset += sub
    return notes

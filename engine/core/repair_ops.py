"""repair_ops — 修復用的低階 score 操作 (leaf 層)。

從 repair.py (god file) 抽出。純「在 IR 上定位 / 取代事件 / 移八度」的工具,
不依賴策略或修復迴圈 → 被 strategies 與 loop 共用的最底層。repair.py
re-export _shift_pitch_octave 等, 維持 `from core.repair import ...` 相容。
"""
from __future__ import annotations

import re
from typing import Optional

from .ir import Part, Pitch, Score
from .repair_types import LocatedIssue


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

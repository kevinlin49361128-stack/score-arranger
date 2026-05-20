"""
Pitch 工具函式 — 移調 / 拼寫.

從 server.py 與 repair.py 共用的內嵌邏輯抽出, 避免重複實作。
"""

from __future__ import annotations

import re
from typing import Optional

from .ir import Pitch


def shift_midi(midi: int, delta: int) -> int:
    """安全移調 MIDI 值, 夾在 0-127."""
    return max(0, min(127, midi + delta))


_NAMES_FLAT = ["C", "C#", "D", "Eb", "E", "F", "F#",
               "G", "Ab", "A", "Bb", "B"]
_PITCH_SPELLING_RE = re.compile(r"^([A-G][#b]*)(\-?\d+)$")


def shift_pitch(p: Pitch, delta_semitones: int) -> Pitch:
    """把 Pitch 整體移調 delta_semitones 個半音.

    拼寫策略:
    - delta 是 12 的倍數 (純八度) → 保留原拼寫, 只調 octave 數字
    - 其他情況 → 用簡單 MIDI → 拼寫對照 (使用 flat 拼)

    註: 真正考慮 key signature 的 re-spelling 留給 music21 在 export 時處理。
    這裡只保證 MIDI 正確、不至於拋 ValueError。
    """
    new_midi = shift_midi(p.midi_number, delta_semitones)
    m = _PITCH_SPELLING_RE.match(p.spelling)
    if m and abs(delta_semitones) % 12 == 0:
        name, octave = m.groups()
        new_octave = int(octave) + (delta_semitones // 12)
        return Pitch(midi_number=new_midi, spelling=f"{name}{new_octave}")
    return Pitch(
        midi_number=new_midi,
        spelling=f"{_NAMES_FLAT[new_midi % 12]}{new_midi // 12 - 1}",
    )


def find_octave_fit(
    midi: int,
    range_lo: int,
    range_hi: int,
) -> Optional[int]:
    """找到使 midi 落入 [range_lo, range_hi] 的最小八度位移 (semitones, 12 倍數).

    若已在範圍內 → 0
    若範圍外但可八度移入 → +12 / -12 / +24 ...
    若任何整數八度都救不回來 → None
    """
    if range_lo <= midi <= range_hi:
        return 0
    # 嘗試上行 +12 / +24 / +36 直到進範圍 (或超出 127)
    for k in range(1, 11):
        m_up = midi + 12 * k
        if range_lo <= m_up <= range_hi:
            return 12 * k
        m_dn = midi - 12 * k
        if range_lo <= m_dn <= range_hi:
            return -12 * k
        if m_up > 127 and m_dn < 0:
            break
    return None

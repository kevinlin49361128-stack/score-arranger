"""
Pianistic texture 引擎 — 把柱式和弦展開為慣用鋼琴織體.

問題: arranger 把管弦樂多聲部塞進鋼琴雙手後, lower staff 常是一串柱式和弦
(block chords) — 不符合真實鋼琴演奏習慣 (unpianistic).

本模組把「一個長時值和弦」展開為常見伴奏織體:
  - alberti      — 阿爾貝蒂低音: 低-高-中-高 (古典時期最常見)
  - broken       — 分解和弦: 低-中-高-中 (上行波浪)
  - octave_tremolo — 八度震音: 低音與其上八度快速交替 (戲劇張力)

只在 piano lower staff (左手) 套用, 且必須是時值夠長的和弦 (≥ half note),
避免破壞已經有節奏的聲部.

呼叫時機: style preset post-hook (film_score_piano 等) 或使用者明確要求.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Literal

from .arrangement_model import Arrangement
from .ir import ChordEvent, NoteEvent, Pitch, Voice


TextureKind = Literal["alberti", "broken", "octave_tremolo"]


@dataclass
class TextureResult:
    chords_expanded: int
    notes_generated: int
    texture: str


# 一個和弦最少要這麼長才值得展開 (quarter-note 單位); 短和弦展開會太密.
_MIN_DURATION = Fraction(2)
# 展開後每個小音符的時值
_SUBDIVISION = Fraction(1, 2)


def apply_pianistic_texture(
    arrangement: Arrangement,
    texture: TextureKind = "alberti",
    *,
    target_player_id: str = "piano_1",
    target_staff: str = "lower",
) -> TextureResult:
    """把 target 的鋼琴左手柱式和弦展開為指定織體.

    Mutates arrangement.target_score in place.
    """
    result = TextureResult(chords_expanded=0, notes_generated=0,
                           texture=texture)
    if arrangement.target_score is None:
        return result

    part_id = (
        f"{target_player_id}_{target_staff}"
        if target_staff != "main" else target_player_id
    )
    part = next(
        (p for p in arrangement.target_score.parts if p.part_id == part_id),
        None,
    )
    if part is None:
        return result

    for measure in part.measures:
        voice = measure.voices.get(1)
        if voice is None:
            continue
        new_events: list = []
        for ev in voice.events:
            if isinstance(ev, ChordEvent) and ev.duration >= _MIN_DURATION:
                expanded = _expand_chord(ev, texture)
                if expanded:
                    new_events.extend(expanded)
                    result.chords_expanded += 1
                    result.notes_generated += len(expanded)
                    continue
            new_events.append(ev)
        voice.events = new_events

    return result


def _expand_chord(chord: ChordEvent, texture: TextureKind) -> list[NoteEvent]:
    """把一個 ChordEvent 展開成一串 NoteEvent (依 texture 圖樣)."""
    pitches = sorted(chord.pitches, key=lambda p: p.midi_number)
    if len(pitches) < 2:
        return []

    low = pitches[0]
    high = pitches[-1]
    mid = pitches[len(pitches) // 2]

    # 依織體決定循環圖樣 (index into [low, mid, high])
    if texture == "alberti":
        # 阿爾貝蒂: 低-高-中-高
        pattern = [low, high, mid, high]
    elif texture == "broken":
        # 分解和弦: 低-中-高-中
        pattern = [low, mid, high, mid]
    elif texture == "octave_tremolo":
        # 八度震音: 低音 與 低音+12 交替
        oct_up = Pitch(
            midi_number=min(127, low.midi_number + 12),
            spelling=low.spelling,
        )
        pattern = [low, oct_up]
    else:
        return []

    # 依 chord 總時值切成 _SUBDIVISION 的格子, 循環套 pattern
    total = chord.duration
    n_slots = int(total / _SUBDIVISION)
    if n_slots < 2:
        return []

    events: list[NoteEvent] = []
    for i in range(n_slots):
        src = pattern[i % len(pattern)]
        onset = chord.onset + _SUBDIVISION * i
        events.append(NoteEvent(
            pitch=Pitch(
                midi_number=src.midi_number,
                spelling=src.spelling,
            ),
            duration=_SUBDIVISION,
            onset=onset,
            dynamic=chord.dynamic,
        ))
    return events

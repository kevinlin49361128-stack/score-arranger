"""
聲樂 (Voice) profiles — SATB 四聲部音域

對應規格: docs/architecture.md §4.3 (Instrument Knowledge Base)

聖詠類作品 (Bach chorales) 在 music21 corpus 中使用 generic Instrument,
parser 從 partName 偵測為 "Soprano" / "Alto" / "Tenor" / "Bass"。
"""

from __future__ import annotations

from .base import InstrumentProfile


# 標準聲樂音域 (MIDI):
# Soprano: C4-A5 comfortable, ~B3-C6 absolute
# Alto:    F3-D5 comfortable, ~E3-F5 absolute
# Tenor:   B2-A4 comfortable, ~Bb2-Bb4 absolute  (寫實際發聲音高)
# Bass:    E2-D4 comfortable, ~D2-E4 absolute

SOPRANO_PROFILE = InstrumentProfile(
    instrument_id="soprano",
    display_name="Soprano",
    family="voice",
    range_absolute=(59, 84),         # B3 — C6
    range_comfortable=(60, 81),      # C4 — A5
    range_professional=(59, 84),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=12,
    available_techniques=["legato", "staccato", "marcato"],
    sustain_type="breath",
)

ALTO_PROFILE = InstrumentProfile(
    instrument_id="alto",
    display_name="Alto",
    family="voice",
    range_absolute=(52, 77),         # E3 — F5
    range_comfortable=(53, 74),      # F3 — D5
    range_professional=(52, 77),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=12,
    available_techniques=["legato", "staccato", "marcato"],
    sustain_type="breath",
)

TENOR_PROFILE = InstrumentProfile(
    instrument_id="tenor",
    display_name="Tenor",
    family="voice",
    range_absolute=(46, 70),         # Bb2 — Bb4 (concert pitch)
    range_comfortable=(47, 69),      # B2 — A4
    range_professional=(46, 70),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=12,
    available_techniques=["legato", "staccato", "marcato"],
    sustain_type="breath",
)

BASS_VOICE_PROFILE = InstrumentProfile(
    instrument_id="bass_voice",
    display_name="Bass",
    family="voice",
    range_absolute=(38, 64),         # D2 — E4
    range_comfortable=(40, 62),      # E2 — D4
    range_professional=(38, 64),
    max_simultaneous_notes=1,
    breath_required=True,
    max_sustained_beats=12,
    available_techniques=["legato", "staccato", "marcato"],
    sustain_type="breath",
)

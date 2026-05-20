"""AMT (Automatic Music Transcription) — 音訊 → MusicXML.

目前支援 Spotify basic-pitch (Apache 2.0). 對 solo 鋼琴 / 單聲部音訊有 70-85%
note-level accuracy. 多樂器 / 管弦樂不在 scope.
"""

from .basic_pitch import (
    AMTError,
    BasicPitchStatus,
    audio_to_musicxml,
    detect_basic_pitch,
)

__all__ = [
    "AMTError",
    "BasicPitchStatus",
    "audio_to_musicxml",
    "detect_basic_pitch",
]

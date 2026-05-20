"""
Spotify basic-pitch AMT 整合 — 音訊 → MIDI → MusicXML.

basic-pitch (https://github.com/spotify/basic-pitch) 是 Spotify 開源的 monophonic
+ polyphonic pitch detection 模型. Apache 2.0, model ~17MB (ONNX runtime).

對「solo 鋼琴錄音 → 改編」這個 use case 有 70-85% 準確度. 對管弦樂不適用.

安裝: pip install basic-pitch
   (TF / Coral runtime 為 optional, ONNX runtime 是 default)

流程:
    1. 偵測 basic-pitch 是否已裝
    2. 用 basic_pitch.inference.predict_and_save 跑音訊 → 輸出 MIDI
    3. 用 music21.converter 把 MIDI 轉 MusicXML
"""

from __future__ import annotations

import importlib
import importlib.util
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


class AMTError(RuntimeError):
    """AMT 環境或執行錯誤."""


@dataclass
class BasicPitchStatus:
    available: bool
    version: Optional[str]
    missing: list[str]              # ["basic-pitch"]
    install_hints: dict[str, str]


_INSTALL_HINTS = {
    "basic-pitch": (
        "pip install basic-pitch\n"
        "(Spotify 開源 monophonic+polyphonic AMT, Apache 2.0, ~17MB ONNX 模型)\n"
        "完整文件: https://github.com/spotify/basic-pitch"
    ),
}


def _detect_module() -> tuple[bool, Optional[str]]:
    """檢查 basic_pitch 模組是否可 import. 回傳 (available, version)."""
    spec = importlib.util.find_spec("basic_pitch")
    if spec is None:
        return False, None
    try:
        mod = importlib.import_module("basic_pitch")
        version = getattr(mod, "__version__", "unknown")
        return True, version
    except Exception:
        return False, None


def detect_basic_pitch() -> BasicPitchStatus:
    """檢查 basic-pitch 環境."""
    available, version = _detect_module()
    missing = [] if available else ["basic-pitch"]
    hints = {} if available else {"basic-pitch": _INSTALL_HINTS["basic-pitch"]}
    return BasicPitchStatus(
        available=available,
        version=version,
        missing=missing,
        install_hints=hints,
    )


_AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus"}


def audio_to_musicxml(
    audio_path: str,
    output_dir: Optional[str] = None,
) -> str:
    """音訊檔 → MusicXML 路徑.

    Args:
        audio_path: source 音訊 (.wav / .mp3 / .m4a / .flac etc.)
        output_dir: 輸出目錄 (None → temp dir)

    Returns:
        產出的 .musicxml 路徑.

    Raises:
        AMTError: basic-pitch 不可用 / 轉檔失敗.
        FileNotFoundError: 音訊不存在.
    """
    audio = Path(audio_path).expanduser().resolve()
    if not audio.exists():
        raise FileNotFoundError(str(audio))
    if audio.suffix.lower() not in _AUDIO_EXTS:
        raise AMTError(f"非支援音訊格式: {audio.suffix}")

    status = detect_basic_pitch()
    if not status.available:
        raise AMTError(
            f"basic-pitch 未安裝 — {status.install_hints.get('basic-pitch', '')}"
        )

    out_dir = Path(output_dir) if output_dir else Path(tempfile.mkdtemp(
        prefix="basic_pitch_"))
    out_dir.mkdir(parents=True, exist_ok=True)

    # 跑 basic-pitch inference. 它把 MIDI 寫到 out_dir/<basename>_basic_pitch.mid
    try:
        from basic_pitch.inference import predict_and_save
        from basic_pitch import ICASSP_2022_MODEL_PATH
        predict_and_save(
            audio_path_list=[str(audio)],
            output_directory=str(out_dir),
            save_midi=True,
            sonify_midi=False,
            save_model_outputs=False,
            save_notes=False,
            model_or_model_path=ICASSP_2022_MODEL_PATH,
        )
    except Exception as e:
        raise AMTError(f"basic-pitch inference 失敗: {e}") from e

    # 找產出的 MIDI
    candidates = list(out_dir.glob("*_basic_pitch.mid"))
    if not candidates:
        candidates = list(out_dir.glob("*.mid"))
    if not candidates:
        raise AMTError(f"basic-pitch 完成但找不到 MIDI 輸出 (output={out_dir})")
    midi_path = candidates[0]

    # MIDI → MusicXML 透過 music21
    try:
        from music21 import converter, musicxml as m21_musicxml
        m21_score = converter.parse(str(midi_path))
        exporter = m21_musicxml.m21ToXml.GeneralObjectExporter(m21_score)
        xml_bytes = exporter.parse()
    except Exception as e:
        raise AMTError(f"MIDI → MusicXML 轉換失敗: {e}") from e

    out_xml = out_dir / f"{audio.stem}.musicxml"
    out_xml.write_bytes(xml_bytes)
    return str(out_xml)

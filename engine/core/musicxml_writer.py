"""
MusicXML Writer — IR Score → MusicXML string / 檔案

策略 (兩條路徑):
- 主路徑: ir_to_musicxml.score_to_musicxml — 直接把 IR 寫成 MusicXML 字串,
  O(events) 線性, 大譜 (1000+ 小節) 也是亞秒級。
- 回退: ir_to_music21 + music21 m21ToXml exporter — 久經測試但對大譜慢
  (數十秒)。只有當直接序列化器拋例外時才走此路, 確保正確性回歸只會
  「變慢」而不會「變成壞輸出」。
"""

from __future__ import annotations

from pathlib import Path

from .ir import Score
from .ir_to_musicxml import score_to_musicxml


def write_musicxml_string(score: Score) -> str:
    """Score → MusicXML 字串。"""
    try:
        return score_to_musicxml(score)
    except Exception:
        return _write_via_music21(score)


def _write_via_music21(score: Score) -> str:
    """回退路徑 — 透過 music21 的 m21ToXml exporter。"""
    from music21 import musicxml

    from .ir_to_music21 import ir_to_music21
    m21_score = ir_to_music21(score)
    exporter = musicxml.m21ToXml.GeneralObjectExporter(m21_score)
    return exporter.parse().decode("utf-8")


def write_musicxml_file(score: Score, path: str | Path) -> Path:
    """Score → MusicXML 檔案; 回傳寫入的路徑。"""
    path = Path(path)
    path.write_text(write_musicxml_string(score), encoding="utf-8")
    return path

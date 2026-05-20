"""Analysis Engine — 旋律偵測、和聲分析、樂句切分、聲部功能標記。"""

from .function import FunctionTagReport, tag_all_sections, tag_section_functions
from .harmony import (
    CadenceMarker,
    ChordEntry,
    HarmonyReport,
    analyze_harmony,
)
from .melody import (
    PartStats,
    bass_score,
    compute_baseline,
    compute_part_stats,
    compute_skyline,
    melody_score,
    skyline_match_ratio,
)
from .phrase import detect_phrases

__all__ = [
    "CadenceMarker",
    "ChordEntry",
    "FunctionTagReport",
    "HarmonyReport",
    "PartStats",
    "analyze_harmony",
    "bass_score",
    "compute_baseline",
    "compute_part_stats",
    "compute_skyline",
    "detect_phrases",
    "melody_score",
    "skyline_match_ratio",
    "tag_all_sections",
    "tag_section_functions",
]

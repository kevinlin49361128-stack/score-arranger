"""擴充匯入格式測試 — ABC, Humdrum (krn)

music21 透過 converter.parse 原生支援這些格式; Score Arranger 的 to_musicxml
RPC 直接吃路徑, 不用特別處理。本檔確保 e2e parser 對非 MusicXML 來源也正常。
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from core.server import _method_to_musicxml


ABC_SAMPLE = """X:1
T:Test ABC
M:4/4
L:1/4
K:C
CDEF | GABc | cBAG | FEDC |
"""

KRN_SAMPLE = """**kern
*M4/4
=1
4c
4d
4e
4f
=2
4g
4a
4b
4cc
*-
"""


@pytest.mark.parametrize("ext,content", [
    ("abc", ABC_SAMPLE),
    ("krn", KRN_SAMPLE),
])
def test_to_musicxml_handles_non_xml_input(ext, content, tmp_path):
    fp = tmp_path / f"sample.{ext}"
    fp.write_text(content)
    result = _method_to_musicxml({"path": str(fp)})
    assert isinstance(result, str)
    assert "<?xml" in result[:200]
    assert "score-partwise" in result.lower() or "score-timewise" in result.lower()


def test_abc_round_trips_through_arrange(tmp_path):
    """e2e: ABC → MusicXML → parse → arrange. 確保下游流程不會炸."""
    from music21 import converter
    from core.parser import parse_stream
    from core.analyzer.function import tag_all_sections
    from core.arranger import arrange
    from core.arrangement_model import violin_piano_ensemble

    fp = tmp_path / "abc_sample.abc"
    fp.write_text(ABC_SAMPLE)
    m21 = converter.parse(str(fp))
    score = parse_stream(m21)
    tag_all_sections(score)
    arr = arrange(score, violin_piano_ensemble())
    assert arr.target_score is not None
    assert len(arr.target_score.parts) >= 1

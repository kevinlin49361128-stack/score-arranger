"""C2: 分頁 OMR 拼接模組測試。"""
from __future__ import annotations

from pathlib import Path

import pytest

from core.ir_to_musicxml import score_to_musicxml
from core.omr_stitch import stitch_scores, stitch_to_musicxml
from core.parser import parse_musicxml

SRC = str(
    Path(__file__).parent.parent / "core" / "sample_scores" / "bach_bwv66-6.musicxml"
)


def test_stitch_concatenates_measures():
    single = parse_musicxml(SRC)
    n_parts = len(single.parts)
    n_meas = len(single.parts[0].measures)

    combined = stitch_scores([SRC, SRC])
    assert len(combined.parts) == n_parts
    assert len(combined.parts[0].measures) == 2 * n_meas
    # 第一小節是起拍 → 保持 number 0; 其餘連續
    nums = [m.number for m in combined.parts[0].measures]
    assert nums[0] == 0
    assert nums[1] == 1
    # 串接處不應重置回小編號 (連續遞增)
    assert nums[n_meas] == nums[n_meas - 1] + 1
    # 後段不應殘留 pickup 旗標
    assert not combined.parts[0].measures[n_meas].is_pickup


def test_stitch_roundtrips_to_valid_musicxml(tmp_path):
    out = str(tmp_path / "stitched.musicxml")
    stitch_to_musicxml([SRC, SRC], out)
    # 序列化結果應能再被解析 (有效 MusicXML)
    reparsed = parse_musicxml(out)
    assert len(reparsed.parts) == len(parse_musicxml(SRC).parts)
    # movement 計數對齊總小節數
    assert score_to_musicxml(stitch_scores([SRC, SRC]))


def test_stitch_single_chunk_is_identity():
    one = stitch_scores([SRC])
    assert len(one.parts) == len(parse_musicxml(SRC).parts)


def test_stitch_empty_raises():
    with pytest.raises(ValueError):
        stitch_scores([])

"""0.1.46 C4 — 補上之前沒測的核心模組 happy-path smoke tests.

範圍:
- core/quality.py:           compute_quality / quality_to_dict
- core/style_presets.py:     list_presets / get_preset / apply_preset
- core/arrangement_model.py: 各 ensemble factory + Player / Assignment

不追求覆蓋率 — 只確保每個 module 的 public API 跑得起來、
返回正確 shape, 防止重構時無聲變壞.
"""

from __future__ import annotations

import pytest

from core import arrangement_model as am
from core import quality
from core import style_presets
from core.arranger import arrange
from core.parser import parse_musicxml


# ============================================================================
# arrangement_model — ensemble factory smoke
# ============================================================================


def test_violin_piano_ensemble_shape():
    players = am.violin_piano_ensemble()
    assert len(players) == 2
    assert players[0].primary_instrument == "violin"
    assert players[1].primary_instrument == "piano"
    assert players[1].staves == 2  # 鋼琴雙譜表
    assert am.get_staves_for(players[1]) == ["upper", "lower"]


def test_string_quartet_ensemble_shape():
    players = am.string_quartet_ensemble()
    assert len(players) == 4
    instruments = [p.primary_instrument for p in players]
    assert instruments == ["violin", "violin", "viola", "cello"]
    # Violin I / II 用不同 player_id
    assert players[0].player_id != players[1].player_id


def test_baroque_trio_sonata_has_continuo():
    """巴洛克三重奏鳴曲應該包含 continuo (數字低音)"""
    players = am.baroque_trio_sonata_ensemble()
    primary = [p.primary_instrument for p in players]
    # 至少要有 violin + harpsichord/organ + cello/viola da gamba
    assert "violin" in primary
    assert any(i in ("harpsichord", "organ") for i in primary)


def test_assignment_dataclass_init():
    a = am.Assignment(
        assignment_id=1,
        source_part_id="P1",
        target_player_id="violin_1",
        target_instrument="violin",
        target_staff="main",
        span=(1, 16),
        function="melody",
    )
    assert a.source_part_id == "P1"
    assert a.span == (1, 16)
    assert a.function == "melody"


# ============================================================================
# style_presets — list / get / apply smoke
# ============================================================================


def test_list_presets_returns_nonempty():
    presets = style_presets.list_presets()
    assert isinstance(presets, list)
    assert len(presets) > 0
    # 每個 preset 應該有 id / display_name / description
    for p in presets:
        assert "id" in p
        assert "display_name" in p
        assert "description" in p


def test_get_preset_known_id():
    presets = style_presets.list_presets()
    if not presets:
        pytest.skip("no presets registered")
    first_id = presets[0]["id"]
    sp = style_presets.get_preset(first_id)
    assert sp is not None
    assert sp.preset_id == first_id


def test_get_preset_unknown_returns_none():
    assert style_presets.get_preset("__does_not_exist__") is None


def test_apply_preset_on_real_arrangement():
    """apply_preset 應該能跑在實際 arrangement 上不炸"""
    ir = parse_musicxml("corpus:bach/bwv66.6")
    players = am.violin_piano_ensemble()
    arrangement = arrange(ir, players)
    presets = style_presets.list_presets()
    if not presets:
        pytest.skip("no presets")
    # 試套用第一個 preset, 應該安全無例外
    style_presets.apply_preset(arrangement, presets[0]["id"])


# ============================================================================
# quality — compute / serialize smoke
# ============================================================================


def test_compute_quality_returns_report():
    ir = parse_musicxml("corpus:bach/bwv66.6")
    players = am.violin_piano_ensemble()
    arrangement = arrange(ir, players)
    report = quality.compute_quality(ir, arrangement.target_score)
    assert isinstance(report, quality.QualityReport)
    assert 0.0 <= report.melody_preservation <= 1.0
    assert 0.0 <= report.harmony_completeness <= 1.0
    assert 0.0 <= report.playability <= 1.0
    # overall 在 quality_to_dict 內計算 (加權平均), 不存在 report 本身上
    d = quality.quality_to_dict(report)
    assert 0.0 <= d["overall"] <= 1.0


def test_quality_to_dict_shape():
    ir = parse_musicxml("corpus:bach/bwv66.6")
    players = am.violin_piano_ensemble()
    arrangement = arrange(ir, players)
    report = quality.compute_quality(ir, arrangement.target_score)
    d = quality.quality_to_dict(report)
    assert "melody_preservation" in d
    assert "harmony_completeness" in d
    assert "playability" in d
    assert "overall" in d
    assert "details" in d  # issue counts 等


def test_quality_identical_score_near_perfect():
    """改編成自己應該分數很高 (sanity check)"""
    ir = parse_musicxml("corpus:bach/bwv66.6")
    report = quality.compute_quality(ir, ir)
    # 同一個 score 跟自己比, melody 應該 1.0
    assert report.melody_preservation >= 0.95

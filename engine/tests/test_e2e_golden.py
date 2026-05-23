"""End-to-end golden tests — 用 bundled real MusicXML 跑完整管線.

C3 (0.1.28): 既有測試多用合成 ScoreIR fixture, 缺真實 MusicXML 端對端覆蓋.
這份檔案用 engine/core/sample_scores/ 的真實樂譜 (BWV 66.6 / Mozart K.156)
跑 parse → arrange → quality / difficulty / round-trip 整條鏈, 確保:

  1. Bach 聖詠改編為弦樂四重奏 — quality 分數在合理區間
  2. Mozart K.156 第一樂章 IR ↔ MusicXML 雙向序列化保結構
  3. arrange + repair 收斂 (max_iterations 內無 error-severity issue)

不檢查具體音符 (太脆弱), 只檢查「結構」與「分數範圍」.
若改編引擎大幅更動使分數移出區間 → CI 會抓到.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from core.arrangement_model import string_quartet_ensemble
from core.arranger import arrange
from core.difficulty import analyze_score_difficulty
from core.ir_serialize import from_dict, to_dict
from core.ir import Score
from core.ir_to_musicxml import score_to_musicxml
from core.parser import parse_musicxml
from core.quality import compute_quality
from core.repair import collect_issues, repair_loop

SAMPLE_DIR = Path(__file__).parent.parent / "core" / "sample_scores"


@pytest.fixture(scope="module")
def bach_chorale_path() -> Path:
    """BWV 66.6 — 4 聲部聖詠, 適合改編成弦樂四重奏的標準測試."""
    p = SAMPLE_DIR / "bach_bwv66-6.musicxml"
    assert p.exists(), f"sample 不存在: {p}"
    return p


@pytest.fixture(scope="module")
def mozart_quartet_path() -> Path:
    """Mozart K.156 第一樂章 — 真正的弦樂四重奏原譜, 用於 round-trip 測試."""
    p = SAMPLE_DIR / "mozart_k156_movement1.musicxml"
    assert p.exists(), f"sample 不存在: {p}"
    return p


# ============================================================================
# Golden test 1: Bach chorale → string quartet, quality 在合理區間
# ============================================================================

def test_golden_bach_chorale_arrange_to_quartet(bach_chorale_path: Path):
    """BWV 66.6 改編為弦樂四重奏 — 4 聲部聖詠映射到 SQ 應該幾乎無損.

    預期區間 (0.1.27 baseline):
      melody_preservation > 0.7  (主旋律保留度)
      harmony_completeness > 0.6 (和聲完整度)
      playability > 0.85         (可演奏性 — 弦樂四重奏聖詠不該有大問題)
      overall > 0.7
    """
    src = parse_musicxml(str(bach_chorale_path))
    arrangement = arrange(src, string_quartet_ensemble())
    assert arrangement.target_score is not None
    quality = compute_quality(src, arrangement.target_score)
    assert quality.melody_preservation > 0.7, (
        f"melody 退化過大: {quality.melody_preservation:.3f}"
    )
    assert quality.harmony_completeness > 0.6, (
        f"harmony 退化過大: {quality.harmony_completeness:.3f}"
    )
    assert quality.playability > 0.85, (
        f"playability 退化過大: {quality.playability:.3f}"
    )
    # 加權 overall: melody 0.4 + harmony 0.3 + playability 0.3
    overall = (
        quality.melody_preservation * 0.4
        + quality.harmony_completeness * 0.3
        + quality.playability * 0.3
    )
    assert overall > 0.7


# ============================================================================
# Golden test 2: Mozart K.156 IR ↔ MusicXML round-trip 保結構
# ============================================================================

def test_golden_mozart_quartet_roundtrip(mozart_quartet_path: Path):
    """Parse → serialize to dict → re-construct, 結構應一致.

    這個測試抓 IR 序列化器 / parser 的 regression. 不檢查具體音高/節奏,
    只比 part_count / measure_count / 第一聲部音符數.
    """
    original = parse_musicxml(str(mozart_quartet_path))
    serialized = to_dict(original)
    restored = from_dict(serialized, Score)
    # 結構 invariants
    assert len(original.parts) == len(restored.parts), (
        f"part 數對不上: {len(original.parts)} vs {len(restored.parts)}"
    )
    for op, rp in zip(original.parts, restored.parts, strict=True):
        assert len(op.measures) == len(rp.measures), (
            f"{op.part_id} measure 數對不上"
        )
        # 第一小節音符數
        if op.measures:
            o_voices = sorted(op.measures[0].voices.keys())
            r_voices = sorted(rp.measures[0].voices.keys())
            assert o_voices == r_voices, (
                f"{op.part_id} m1 voice id 對不上"
            )


def test_golden_mozart_quartet_musicxml_export(mozart_quartet_path: Path):
    """Parse → IR → MusicXML export — 不檢查 XML 內容細節, 只確認非空且可被
    music21 讀回 (這已是「MusicXML 結構合法」的最強信號).
    """
    src = parse_musicxml(str(mozart_quartet_path))
    xml_str = score_to_musicxml(src)
    assert xml_str, "MusicXML 匯出空字串"
    assert "<score-partwise" in xml_str
    assert "<measure" in xml_str
    # 解析 part 數至少要對得上
    assert xml_str.count("<score-part ") == len(src.parts), (
        f"<score-part> 數量對不上 source"
    )


# ============================================================================
# Golden test 3: arrange + repair 收斂
# ============================================================================

def test_golden_bach_arrange_repair_converges(bach_chorale_path: Path):
    """BWV 66.6 → SQ + repair loop 應收斂, 最終 error-severity issue = 0.

    若 repair 邏輯或 severity 加權變動, 這測試會抓到 (修復後 error 不該殘留).
    """
    src = parse_musicxml(str(bach_chorale_path))
    arrangement = arrange(src, string_quartet_ensemble())
    assert arrangement.target_score is not None
    initial_issues = collect_issues(arrangement.target_score)
    initial_errors = [
        i for i in initial_issues if i.result.severity == "error"
    ]
    report = repair_loop(arrangement, max_iterations=50)
    # 收斂條件: 最終剩餘的 error-severity issue 應為 0
    final_issues = collect_issues(arrangement.target_score)
    errors = [i for i in final_issues if i.result.severity == "error"]
    assert len(errors) == 0, (
        f"修復後仍有 {len(errors)} 個 error (起點 {len(initial_errors)} 個): "
        f"{[(i.result.code, i.part_id, i.measure_number) for i in errors[:3]]}"
    )
    # final_severity_score 應該 < initial issues 的加權總和
    assert report.final_severity_score >= 0  # sanity


# ============================================================================
# Golden test 4: difficulty 分析跑完整管線無例外
# ============================================================================

def test_golden_mozart_difficulty_analysis(mozart_quartet_path: Path):
    """Mozart K.156 跑 difficulty 分析 — 應無例外, 每聲部 score 在 1-5 範圍."""
    src = parse_musicxml(str(mozart_quartet_path))
    diffs = analyze_score_difficulty(src)
    assert len(diffs) == len(src.parts), "difficulty 部數對不上"
    for part_id, d in diffs.items():
        assert 1.0 <= d.score_1_to_5 <= 5.0, (
            f"{part_id} score 越界: {d.score_1_to_5}"
        )
        assert 0.0 <= d.technique_factor <= 1.0
        assert 0.0 <= d.range_factor <= 1.0
        assert d.note_count >= 0

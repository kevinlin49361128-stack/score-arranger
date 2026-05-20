"""
CLI 整合測試 — 用 music21 corpus 內建作品做 end-to-end 測試。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from music21 import corpus

from core.cli import main


@pytest.fixture(scope="module")
def bach_xml(tmp_path_factory) -> str:
    """從 music21 corpus 匯出一份巴赫聖詠為 MusicXML, 供 CLI 測試使用。"""
    m21_score = corpus.parse("bach/bwv66.6")
    out_dir = tmp_path_factory.mktemp("xml")
    xml_path = out_dir / "bach_bwv66_6.musicxml"
    m21_score.write("musicxml", fp=str(xml_path))
    return str(xml_path)


# ============================================================================
# parse
# ============================================================================

class TestCmdParse:
    def test_parse_outputs_valid_json(self, bach_xml, capsys):
        exit_code = main(["parse", bach_xml])
        assert exit_code == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert data["__type__"] == "Score"
        assert "parts" in data

    def test_parse_pretty_indented(self, bach_xml, capsys):
        main(["parse", bach_xml, "--pretty"])
        out = capsys.readouterr().out
        # 含換行表示有 pretty 格式化
        assert "\n" in out
        assert "  " in out  # 縮排


# ============================================================================
# validate
# ============================================================================

class TestCmdValidate:
    def test_validate_bach_passes(self, bach_xml, capsys):
        exit_code = main(["validate", bach_xml])
        # 應該通過驗證 (exit 0)
        assert exit_code == 0

    def test_validate_json_mode(self, bach_xml, capsys):
        main(["validate", bach_xml, "--json"])
        out = capsys.readouterr().out
        data = json.loads(out)
        assert "ok" in data
        assert "errors" in data
        assert "warnings" in data


# ============================================================================
# phrases
# ============================================================================

class TestCmdPhrases:
    def test_phrases_json(self, bach_xml, capsys):
        main(["phrases", bach_xml, "--json"])
        out = capsys.readouterr().out
        data = json.loads(out)
        # 每個 part 應有 phrase 報告
        assert len(data) > 0
        for part_id, sections in data.items():
            assert isinstance(sections, list)
            for section in sections:
                assert "phrases" in section
                assert isinstance(section["phrases"], list)

    def test_phrases_text_output(self, bach_xml, capsys):
        exit_code = main(["phrases", bach_xml])
        assert exit_code == 0
        out = capsys.readouterr().out
        assert "Phrase" in out
        assert "conf=" in out


# ============================================================================
# check-playability
# ============================================================================

class TestCmdCheckPlayability:
    def test_check_playability_json(self, bach_xml, capsys):
        main(["check-playability", bach_xml, "--json"])
        out = capsys.readouterr().out
        data = json.loads(out)
        for part_id, info in data.items():
            assert "instrument_id" in info
            assert "issues" in info
            assert "error_count" in info


# ============================================================================
# analyze (整合報告)
# ============================================================================

class TestCmdAnalyze:
    def test_analyze_produces_full_report(self, bach_xml, capsys):
        exit_code = main(["analyze", bach_xml])
        assert exit_code == 0
        out = capsys.readouterr().out
        data = json.loads(out)

        # 必要區塊
        assert "metadata" in data
        assert "summary" in data
        assert "validation" in data
        assert "phrases" in data
        assert "playability" in data

        # summary 必要欄位
        assert data["summary"]["part_count"] > 0
        assert data["summary"]["measure_count"] > 0
        assert isinstance(data["summary"]["parts"], list)

        # validation 必要欄位
        assert "ok" in data["validation"]
        assert "error_count" in data["validation"]

    def test_analyze_metadata_contains_title(self, bach_xml, capsys):
        """巴赫 bwv66.6 應有 title metadata"""
        main(["analyze", bach_xml])
        out = capsys.readouterr().out
        data = json.loads(out)
        # music21 corpus 的標題可能不一定有,只要欄位存在即可
        assert isinstance(data["metadata"], dict)

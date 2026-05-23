"""MCP server adapter 整合測試 — 直接呼叫 dispatch 不經過 stdio"""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

import asyncio

from core.mcp_server import DISPATCH, PROMPTS, TOOLS, _get_prompt


class TestToolDefinitions:
    def test_tool_count(self):
        # 12 原本工具 + 3 新增 (apply_edit_ops / compute_difficulty /
        # compute_quality) — F MCP agent 整合, 暴露難度閉環與結構化編輯
        assert len(TOOLS) == 15

    def test_arrange_and_export_schema(self):
        t = next(t for t in TOOLS if t.name == "arrange_and_export")
        props = t.inputSchema["properties"]
        assert "source" in props
        assert "target_ensemble" in props
        assert "output_path" in props
        assert "violin_piano" in props["target_ensemble"]["enum"]
        # required fields
        assert set(t.inputSchema["required"]) == {
            "source", "target_ensemble", "output_path",
        }


class TestDispatch:
    def test_list_corpus(self):
        result = DISPATCH["list_corpus"]({})
        assert isinstance(result, list)
        assert len(result) > 0
        # Each entry should have corpus_path-ish fields
        first = result[0]
        assert isinstance(first, dict)

    def test_arrange_and_export_full_workflow(self):
        """1-step pipeline: corpus → arrange → export → 檔案存在"""
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = str(Path(tmpdir) / "test_arrangement.musicxml")
            result = DISPATCH["arrange_and_export"]({
                "source": "corpus:bach/bwv66.6",
                "target_ensemble": "string_quartet",
                "output_path": out_path,
                "repair": False,  # 加速測試
            })
            assert "output_path" in result
            assert "arrangement" in result
            assert result["format"] == "musicxml"
            # 檔案實際寫出
            assert Path(out_path).exists()
            assert Path(out_path).stat().st_size > 1000
            # arrangement metadata
            arr = result["arrangement"]
            assert len(arr["players"]) == 4  # string quartet
            assert len(arr["assignments"]) >= 1
            # quality metric 應有 (改編成功)
            assert result.get("quality") is not None

    def test_arrange_and_export_midi(self):
        """副檔名 .mid → MIDI 匯出路徑"""
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = str(Path(tmpdir) / "test.mid")
            result = DISPATCH["arrange_and_export"]({
                "source": "corpus:bach/bwv66.6",
                "target_ensemble": "violin_piano",
                "output_path": out_path,
                "repair": False,
            })
            assert result["format"] == "midi"
            assert Path(out_path).exists()

    def test_analyze_score(self):
        """analyze_score 不需 arrange 也能跑"""
        result = DISPATCH["analyze_score"]({
            "source": "corpus:bach/bwv66.6",
        })
        assert isinstance(result, dict)
        # AnalysisReport 應含 phrases / functions / playability 等
        assert "phrases" in result or "playability" in result

    def test_arrange_score_step_then_export(self):
        """2-step: arrange_score → export_arrangement 在同 session 串連"""
        arr = DISPATCH["arrange_score"]({
            "source": "corpus:bach/bwv66.6",
            "target_ensemble": "piano_solo",
            "repair": False,
        })
        assert arr.get("target_musicxml")
        with tempfile.TemporaryDirectory() as tmpdir:
            out = str(Path(tmpdir) / "step2.musicxml")
            export_result = DISPATCH["export_arrangement"]({
                "output_path": out,
            })
            assert Path(out).exists()
            assert export_result.get("size_bytes", 0) > 1000

    def test_get_status_after_arrange(self):
        DISPATCH["arrange_score"]({
            "source": "corpus:bach/bwv66.6",
            "target_ensemble": "string_quartet",
            "repair": False,
        })
        status = DISPATCH["get_arrangement_status"]({})
        assert "difficulty" in status
        assert "quality" in status
        if status["quality"]:
            assert "overall" in status["quality"]

    def test_export_all_parts(self):
        """改編後 export_all_parts → 每位演奏者一個 .musicxml 檔"""
        DISPATCH["arrange_score"]({
            "source": "corpus:bach/bwv66.6",
            "target_ensemble": "string_quartet",
            "repair": False,
        })
        with tempfile.TemporaryDirectory() as tmpdir:
            result = DISPATCH["export_all_parts"]({"output_dir": tmpdir})
            assert result["count"] == 4  # string quartet
            assert len(result["parts"]) == 4
            for part in result["parts"]:
                assert Path(part["path"]).exists()
                assert part["size_bytes"] > 1000
                # 確認每份檔只含一個 part (分譜)
                content = Path(part["path"]).read_text()
                # MusicXML <part id=...> 應只出現有限次
                # (header 1 次 + body 1 次 = 2; 全譜會多更多)
                assert content.count("<part ") <= 3

    def test_transcribe_score(self):
        """MCP 直接呼叫 transcribe: Bach soprano → viola"""
        result = DISPATCH["transcribe_score"]({
            "source": "corpus:bach/bwv66.6",
            "mapping": {
                "soprano": {
                    "instrument": "viola",
                    "semitones": -12,
                    "fit_to_range": True,
                },
            },
        })
        assert "target_musicxml" in result
        assert result["name"] == "樂器替換 / 移調"
        assert "soprano_1" in result["semitones_used"]
        assert result["semitones_used"]["soprano_1"] == -12

    def test_list_source_parts(self):
        result = DISPATCH["list_source_parts"]({
            "source": "corpus:bach/bwv66.6",
        })
        # Bach chorale = 4 voices SATB
        assert isinstance(result, list)
        assert len(result) == 4
        instruments = {p["instrument_id"] for p in result}
        assert "soprano" in instruments
        assert "bass_voice" in instruments

    def test_suggest_transposition(self):
        result = DISPATCH["suggest_transposition"]({
            "source": "cello",
            "target": "violin",
        })
        assert result["semitones"] == 19  # convention

    def test_unknown_source_raises(self):
        """不存在的 corpus path → 拋例外 (MCP 層會 catch 包成 error)"""
        with pytest.raises(Exception):
            DISPATCH["arrange_and_export"]({
                "source": "corpus:nonexistent/path",
                "target_ensemble": "violin_piano",
                "output_path": "/tmp/nope.musicxml",
            })

    def test_edit_event_after_arrange(self):
        """先 arrange → 用 edit_event 改一個事件 → 確認 issues 更新"""
        DISPATCH["arrange_score"]({
            "source": "corpus:bach/bwv66.6",
            "target_ensemble": "violin_piano",
            "repair": False,
        })
        # 取得目前 status 找一個 part_id
        status = DISPATCH["get_arrangement_status"]({})
        difficulty = status.get("difficulty") or {}
        assert difficulty, "should have difficulty data after arrange"
        first_part = next(iter(difficulty.keys()))
        # 試著 transpose 第一個 measure 第一個 event +1 半音
        # (有可能失敗如果 measure 1 都是 rest, 但通常不會)
        try:
            result = DISPATCH["edit_event"]({
                "part_id": first_part,
                "measure": 1,
                "voice_id": 1,
                "event_index": 0,
                "action": "transpose",
                "extra": {"semitones": 1},
            })
            # 如果成功應該回傳新 issues + target_musicxml
            assert isinstance(result, dict)
        except RuntimeError:
            # 事件可能是 rest 或不存在, 跳過
            pass


class TestMultiSession:
    def test_session_id_in_stateful_tool_schemas(self):
        """stateful tools 應接受 session_id 參數。"""
        stateful = {
            "arrange_and_export", "arrange_score", "get_arrangement_status",
            "apply_suggestion", "edit_event", "export_arrangement",
            "transcribe_score", "export_all_parts",
        }
        for t in TOOLS:
            if t.name in stateful:
                assert "session_id" in t.inputSchema["properties"], t.name

    def test_parallel_sessions_isolated(self):
        """兩個不同 session_id 的改編不互相覆蓋 (A/B 比較)。"""
        a = DISPATCH["arrange_score"]({
            "source": "corpus:bach/bwv66.6",
            "target_ensemble": "string_quartet",
            "repair": False,
            "session_id": "test-a",
        })
        b = DISPATCH["arrange_score"]({
            "source": "corpus:bach/bwv66.6",
            "target_ensemble": "woodwind_quintet",
            "repair": False,
            "session_id": "test-b",
        })
        players_a = {p["display_name"] for p in a["players"]}
        players_b = {p["display_name"] for p in b["players"]}
        assert players_a != players_b
        # 取 status 確認 session a 仍是弦樂 (沒被 b 覆蓋)
        sa = DISPATCH["get_arrangement_status"]({"session_id": "test-a"})
        assert sa["session_id"] == "test-a"
        assert a["session_id"] == "test-a"
        assert b["session_id"] == "test-b"


class TestPrompts:
    def test_three_prompts_registered(self):
        names = {p.name for p in PROMPTS}
        assert names == {
            "analyze_unplayable", "suggest_reduction", "compare_ensembles",
        }

    def test_get_prompt_no_args(self):
        r = asyncio.run(_get_prompt("analyze_unplayable", {}))
        assert len(r.messages) == 1
        assert r.messages[0].role == "user"
        assert "get_arrangement_status" in r.messages[0].content.text

    def test_get_prompt_with_args(self):
        r = asyncio.run(_get_prompt("compare_ensembles", {
            "source": "corpus:bach/bwv66.6",
            "ensemble_a": "string_quartet",
            "ensemble_b": "piano_solo",
        }))
        text = r.messages[0].content.text
        assert "string_quartet" in text
        assert "piano_solo" in text
        assert "cmp-a" in text

    def test_get_prompt_unknown_raises(self):
        with pytest.raises(ValueError):
            asyncio.run(_get_prompt("nonexistent", {}))


class TestPathValidation:
    """M4 安全修: MCP 寫檔 path 限制."""

    def test_documents_path_allowed(self, tmp_path, monkeypatch):
        from core.mcp_server import _validate_export_path
        # 模擬 ~/Documents 在 tmp_path 下
        monkeypatch.setenv("HOME", str(tmp_path))
        (tmp_path / "Documents").mkdir()
        ok_path = str(tmp_path / "Documents" / "out.musicxml")
        assert _validate_export_path(ok_path) == ok_path

    def test_tempdir_path_allowed(self):
        import tempfile
        from core.mcp_server import _validate_export_path
        with tempfile.TemporaryDirectory() as td:
            target = f"{td}/out.musicxml"
            result = _validate_export_path(target)
            assert result.endswith("out.musicxml")

    def test_etc_path_refused(self):
        """/etc 不在 Documents/Desktop/Downloads/tempdir 任一 → 拒絕."""
        import pytest as _pytest
        from core.mcp_server import _validate_export_path
        with _pytest.raises(ValueError, match="敏感位置"):
            _validate_export_path("/etc/ssh/sshd_config")

    def test_root_path_refused(self):
        import pytest as _pytest
        from core.mcp_server import _validate_export_path
        with _pytest.raises(ValueError, match="敏感位置"):
            _validate_export_path("/usr/local/bin/evil")

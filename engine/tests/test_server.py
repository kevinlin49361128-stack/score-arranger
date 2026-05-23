"""持久 Server 測試 — 直接呼叫 handle_request, 不走 stdio。"""

from __future__ import annotations

import io
import json
import zipfile
from unittest.mock import patch

import pytest

from core.server import _raw_musicxml_from_path, handle_request, serve


# ============================================================================
# handle_request 單元測試
# ============================================================================

class TestHandleRequest:
    def test_ping(self):
        resp = handle_request({"id": "1", "method": "ping", "params": {}})
        assert resp["ok"]
        assert resp["data"]["pong"]
        assert resp["id"] == "1"

    def test_missing_method(self):
        resp = handle_request({"id": "2"})
        assert not resp["ok"]
        assert "method" in resp["error"]

    def test_unknown_method(self):
        resp = handle_request({
            "id": "3", "method": "nonexistent", "params": {},
        })
        assert not resp["ok"]
        assert "unknown method" in resp["error"]

    def test_method_exception_caught(self):
        """檔案不存在不應 crash, 應回 error response"""
        resp = handle_request({
            "id": "4", "method": "parse", "params": {"path": "/no/such/file.xml"},
        })
        assert not resp["ok"]
        assert "error" in resp
        assert "traceback" in resp


# ============================================================================
# 真實 Bach corpus 透過 server 解析
# ============================================================================

@pytest.fixture(scope="module")
def bach_xml(tmp_path_factory):
    from music21 import corpus
    m21_score = corpus.parse("bach/bwv66.6")
    out_dir = tmp_path_factory.mktemp("xml")
    xml_path = out_dir / "bach.musicxml"
    m21_score.write("musicxml", fp=str(xml_path))
    return str(xml_path)


class TestServerMethods:
    def test_parse(self, bach_xml):
        resp = handle_request({
            "id": "p1", "method": "parse", "params": {"path": bach_xml},
        })
        assert resp["ok"]
        assert resp["data"]["__type__"] == "Score"

    def test_to_musicxml(self, bach_xml):
        resp = handle_request({
            "id": "m1", "method": "to_musicxml", "params": {"path": bach_xml},
        })
        assert resp["ok"]
        assert "<?xml" in resp["data"]

    def test_validate(self, bach_xml):
        resp = handle_request({
            "id": "v1", "method": "validate", "params": {"path": bach_xml},
        })
        assert resp["ok"]
        assert resp["data"]["ok"]  # 應通過驗證

    def test_phrases(self, bach_xml):
        resp = handle_request({
            "id": "ph1", "method": "phrases", "params": {"path": bach_xml},
        })
        assert resp["ok"]
        # 每個 part 應有 phrase 列表
        for part_id, sections in resp["data"].items():
            assert isinstance(sections, list)
            assert all("phrases" in s for s in sections)

    def test_tag_functions(self, bach_xml):
        resp = handle_request({
            "id": "t1", "method": "tag_functions", "params": {"path": bach_xml},
        })
        assert resp["ok"]
        assert "0" in resp["data"]  # section 0

    def test_arrange(self, bach_xml):
        resp = handle_request({
            "id": "a1", "method": "arrange",
            "params": {"path": bach_xml, "target": "violin_piano"},
        })
        assert resp["ok"]
        assert "target_musicxml" in resp["data"]
        assert resp["data"]["target_musicxml"] is not None
        assert "<?xml" in resp["data"]["target_musicxml"]

    def test_arrange_with_repair(self, bach_xml):
        resp = handle_request({
            "id": "a2", "method": "arrange",
            "params": {"path": bach_xml, "repair": True},
        })
        assert resp["ok"]
        assert resp["data"]["repair"] is not None
        assert "iterations" in resp["data"]["repair"]

    def test_arrange_issues_serialized(self):
        """arrange 回傳的 issues 必須是完整 dict (含 code / 位置欄位)。

        回歸測試: 之前 _method_arrange 用 i.code (LocatedIssue 無此屬性) →
        任何「有可演奏性問題」的改編都會炸 AttributeError。bach 弦四剛好
        0 issue 所以舊測試漏掉; 這裡用會產生 issue 的 mozart 弦四。
        """
        resp = handle_request({
            "id": "a3", "method": "arrange",
            "params": {
                "path": "corpus:mozart/k155/movement1",
                "target": "string_quartet",
                "repair": False,
            },
        })
        assert resp["ok"], resp.get("error")
        issues = resp["data"]["issues"]
        assert len(issues) > 0, "mozart 弦四應產生可演奏性問題"
        for it in issues:
            # 每個 issue 都要是完整序列化 (給前端 IssuePanel / apply 用)
            for key in ("code", "severity", "part_id", "measure",
                        "voice_id", "event_index", "suggestions"):
                assert key in it, f"issue 缺欄位 {key}: {it}"

    def test_to_musicxml_corpus_prefix(self):
        """to_musicxml 接受 'corpus:xxx' 直接從 music21 corpus 載入"""
        resp = handle_request({
            "id": "c1", "method": "to_musicxml",
            "params": {"path": "corpus:bach/bwv66.6"},
        })
        assert resp["ok"]
        assert "<?xml" in resp["data"]
        assert "<score-partwise" in resp["data"].lower()

    def test_to_musicxml_slice_with_start(self):
        """大譜分頁: max_measures + start_measure 拿到指定範圍切片"""
        # 完整版有 N 個 measure → 切第 3 個開始, 2 個
        full_resp = handle_request({
            "id": "f", "method": "to_musicxml",
            "params": {"path": "corpus:bach/bwv66.6"},
        })
        slice_resp = handle_request({
            "id": "s", "method": "to_musicxml",
            "params": {
                "path": "corpus:bach/bwv66.6",
                "max_measures": 2, "start_measure": 3,
            },
        })
        assert full_resp["ok"] and slice_resp["ok"]
        # 切片版內容應比完整版短
        assert len(slice_resp["data"]) < len(full_resp["data"])
        # 應該有 <measure> 元素 (數量正確留給 OSMD 渲染端驗證)
        assert "<measure" in slice_resp["data"]

    def test_arrange_with_corpus_prefix(self):
        resp = handle_request({
            "id": "ca", "method": "arrange",
            "params": {"path": "corpus:bach/bwv66.6"},
        })
        assert resp["ok"]
        assert len(resp["data"]["assignments"]) == 4

    def test_arrange_returns_issues(self):
        resp = handle_request({
            "id": "ai", "method": "arrange",
            "params": {"path": "corpus:bach/bwv66.6"},
        })
        assert resp["ok"]
        assert "issues" in resp["data"]
        assert isinstance(resp["data"]["issues"], list)


# ============================================================================
# Apply suggestion
# ============================================================================

class TestApplySuggestion:
    def test_apply_without_arrangement_fails(self):
        # 重置 server state
        import core.server as srv
        srv._CURRENT_ARRANGEMENT = None

        resp = handle_request({
            "id": "as1", "method": "apply_suggestion",
            "params": {
                "part_id": "violin_1", "measure": 1, "voice_id": 1,
                "event_index": 0, "suggestion_code": "S_OCTAVE_DOWN",
            },
        })
        assert not resp["ok"]
        assert "尚無 arrangement" in resp["error"] or "no arrangement" in resp["error"].lower()

    def test_history_status_empty_initially(self):
        import core.server as srv
        srv._CURRENT_ARRANGEMENT = None
        srv._HISTORY = []
        srv._REDO_STACK = []

        resp = handle_request({
            "id": "h0", "method": "history_status", "params": {},
        })
        assert resp["ok"]
        assert not resp["data"]["can_undo"]
        assert not resp["data"]["can_redo"]

    def test_undo_redo_roundtrip(self):
        """arrange → 加入合成 issue → apply → undo → redo 應正確還原。"""
        # 用合成的 arrangement 觸發實際 apply (Bach 通常太乾淨)
        # 改為直接驗證 history stack 的行為
        import copy as _copy
        import core.server as srv
        from core.arrangement_model import Arrangement, violin_piano_ensemble
        from core.ir import Pitch
        # 建立簡單 score
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange

        ir = parse_stream(corpus.parse("bach/bwv66.6"))
        tag_all_sections(ir)
        arrangement = run_arrange(ir, violin_piano_ensemble())
        # 直接設置 server state
        srv._CURRENT_ARRANGEMENT = arrangement
        srv._HISTORY = []
        srv._REDO_STACK = []

        # 模擬一次 apply 動作 (手動推 history)
        original = _copy.deepcopy(arrangement.target_score)
        srv._HISTORY.append(original)
        # 把第一個 part 的 instrument_id 改掉做為「變更」的識別
        arrangement.target_score.parts[0].name_display = "MODIFIED"

        # Undo
        resp = handle_request({"id": "u1", "method": "undo", "params": {}})
        assert resp["ok"]
        assert arrangement.target_score.parts[0].name_display != "MODIFIED"
        assert resp["data"]["can_redo"]

        # Redo
        resp = handle_request({"id": "r1", "method": "redo", "params": {}})
        assert resp["ok"]
        assert arrangement.target_score.parts[0].name_display == "MODIFIED"
        assert resp["data"]["can_undo"]

    def test_undo_without_history_fails(self):
        import core.server as srv
        srv._CURRENT_ARRANGEMENT = None
        srv._HISTORY = []
        srv._REDO_STACK = []
        resp = handle_request({"id": "u2", "method": "undo", "params": {}})
        assert not resp["ok"]

    def test_preview_does_not_commit(self):
        """preview_suggestion 不應改變 _CURRENT_ARRANGEMENT 或 history"""
        import core.server as srv
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange
        from core.arrangement_model import violin_piano_ensemble
        # 建立 arrangement 含明確 chord issue (5音和弦 + violin)
        from core.ir import (
            ChordEvent, Measure, Movement, NoteEvent, Part, Pitch, Score,
            Section, Voice,
        )
        from fractions import Fraction

        score = Score(
            movements=[Movement(
                movement_id=1, measure_count=1,
                sections=[Section(0, 1, 1)],
            )],
            parts=[Part(
                part_id="violin_1", name_display="V",
                instrument_id="violin",
                measures=[Measure(
                    number=1, time_signature=(4, 4),
                    voices={1: Voice(voice_id=1, events=[
                        ChordEvent(
                            pitches=[Pitch(p, "n") for p in (55, 62, 69, 76, 81)],
                            duration=Fraction(4), onset=Fraction(0),
                        ),
                    ])},
                )],
            )],
        )

        from core.arrangement_model import Arrangement
        srv._CURRENT_ARRANGEMENT = Arrangement(
            arrangement_id="t", name="T", source_id="s",
            players=violin_piano_ensemble(),
            assignments=[],
            target_score=score,
        )
        srv._HISTORY = []
        srv._REDO_STACK = []

        # 找 issue
        from core.repair import collect_issues
        issues = collect_issues(score)
        target_issue = next(
            i for i in issues if i.result.code == "E_STRING_CHORD_EXCEED"
        )

        # 抓 preview 前的狀態
        before_chord_size = len(score.parts[0].measures[0].voices[1].events[0].pitches)
        before_history = len(srv._HISTORY)

        resp = handle_request({
            "id": "pv", "method": "preview_suggestion",
            "params": {
                "part_id": target_issue.part_id,
                "measure": target_issue.measure_number,
                "voice_id": target_issue.voice_id,
                "event_index": target_issue.event_index,
                "suggestion_code": "S_OMIT_NOTE",
            },
        })
        assert resp["ok"], resp.get("error")
        assert resp["data"]["previewable"]

        # 真實狀態應未改變
        after_chord_size = len(score.parts[0].measures[0].voices[1].events[0].pitches)
        assert after_chord_size == before_chord_size, \
            "preview 應不修改原始 target_score"
        assert len(srv._HISTORY) == before_history, \
            "preview 應不推 history"

    def test_save_and_load_project_roundtrip(self, tmp_path):
        """save_project 後 load_project 應回傳同樣的 target_musicxml"""
        import core.server as srv
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange
        from core.arrangement_model import violin_piano_ensemble

        ir = parse_stream(corpus.parse("bach/bwv66.6"))
        tag_all_sections(ir)
        srv._CURRENT_ARRANGEMENT = run_arrange(ir, violin_piano_ensemble())

        proj_path = tmp_path / "test.sarr"
        save_resp = handle_request({
            "id": "sv", "method": "save_project",
            "params": {
                "path": str(proj_path),
                "source_path": "corpus:bach/bwv66.6",
            },
        })
        assert save_resp["ok"], save_resp.get("error")
        assert proj_path.exists()
        assert save_resp["data"]["size_bytes"] > 100

        # 清掉 state 模擬重新開 app
        srv._CURRENT_ARRANGEMENT = None

        # Load
        load_resp = handle_request({
            "id": "ld", "method": "load_project",
            "params": {"path": str(proj_path)},
        })
        assert load_resp["ok"], load_resp.get("error")
        assert load_resp["data"]["source_path"] == "corpus:bach/bwv66.6"
        assert load_resp["data"]["target_musicxml"] is not None
        assert "<?xml" in load_resp["data"]["target_musicxml"]
        # 載入後 _CURRENT_ARRANGEMENT 應被還原
        assert srv._CURRENT_ARRANGEMENT is not None

    def test_close_session_clears_state(self):
        """close_session 應釋放具名 session 的 state"""
        import core.server as srv
        srv._SESSIONS_BY_ID.clear()

        # 建一個 session
        handle_request({
            "id": "x1", "method": "arrange",
            "params": {
                "path": "corpus:bach/bwv66.6", "session_id": "to-close",
            },
        })
        assert "to-close" in srv._SESSIONS_BY_ID

        resp = handle_request({
            "id": "x2", "method": "close_session",
            "params": {"session_id": "to-close"},
        })
        assert resp["ok"]
        assert resp["data"]["closed"]
        assert "to-close" not in srv._SESSIONS_BY_ID

    def test_session_persist_and_auto_restore(self, tmp_path, monkeypatch):
        """arrange 後 session 應寫到 disk; 清空記憶體再呼叫應自動還原"""
        import core.server as srv
        # 將 session dir 重導到 tmp
        monkeypatch.setattr(srv, "_SESSION_DIR", tmp_path / "sessions")
        srv._SESSIONS_BY_ID.clear()

        # arrange (持久化)
        r = handle_request({
            "id": "p1", "method": "arrange",
            "params": {
                "path": "corpus:bach/bwv66.6",
                "session_id": "persist-test",
            },
        })
        assert r["ok"]
        assert (tmp_path / "sessions" / "persist-test.json").exists()

        # 從記憶體清掉,模擬 server 重啟
        srv._SESSIONS_BY_ID.clear()

        # 下次呼叫應自動從 disk 還原
        r2 = handle_request({
            "id": "p2", "method": "history_status",
            "params": {"session_id": "persist-test"},
        })
        assert r2["ok"]
        # 還原後 session 在記憶體
        assert "persist-test" in srv._SESSIONS_BY_ID
        assert srv._SESSIONS_BY_ID["persist-test"]["arrangement"] is not None

    def test_close_session_removes_disk(self, tmp_path, monkeypatch):
        import core.server as srv
        monkeypatch.setattr(srv, "_SESSION_DIR", tmp_path / "sessions")
        srv._SESSIONS_BY_ID.clear()

        handle_request({
            "id": "c1", "method": "arrange",
            "params": {
                "path": "corpus:bach/bwv66.6", "session_id": "to-delete",
            },
        })
        disk_path = tmp_path / "sessions" / "to-delete.json"
        assert disk_path.exists()

        r = handle_request({
            "id": "c2", "method": "close_session",
            "params": {"session_id": "to-delete"},
        })
        assert r["ok"] and r["data"]["closed"]
        assert not disk_path.exists()

    def test_list_and_edit_measure_event(self):
        """list_measure_events + edit_event 完整流程"""
        import core.server as srv
        srv._CURRENT_ARRANGEMENT = None
        srv._SESSIONS_BY_ID.clear()

        r = handle_request({
            "id": "e1", "method": "arrange",
            "params": {"path": "corpus:bach/bwv66.6"},
        })
        assert r["ok"]

        # 列出 m.1 的事件
        r2 = handle_request({
            "id": "e2", "method": "list_measure_events",
            "params": {"measure": 1},
        })
        assert r2["ok"]
        events = r2["data"]["events"]
        assert len(events) > 0

        # 找一個 note 來操作
        note_event = next(
            (e for e in events if e["kind"] == "note"),
            None,
        )
        assert note_event is not None
        original_midi = note_event["midi"]

        # octave_up
        r3 = handle_request({
            "id": "e3", "method": "edit_event",
            "params": {
                "part_id": note_event["part_id"],
                "measure": 1,
                "voice_id": note_event["voice_id"],
                "event_index": note_event["event_index"],
                "action": "octave_up",
            },
        })
        assert r3["ok"], r3.get("error")
        assert r3["data"]["can_undo"]

        # 確認 midi +12
        r4 = handle_request({
            "id": "e4", "method": "list_measure_events",
            "params": {"measure": 1},
        })
        assert r4["ok"]
        new_event = next(
            e for e in r4["data"]["events"]
            if (e["part_id"], e["voice_id"], e["event_index"])
            == (note_event["part_id"], note_event["voice_id"], note_event["event_index"])
        )
        assert new_event["midi"] == original_midi + 12

        # delete 該 event 變休止符
        r5 = handle_request({
            "id": "e5", "method": "edit_event",
            "params": {
                "part_id": note_event["part_id"],
                "measure": 1,
                "voice_id": note_event["voice_id"],
                "event_index": note_event["event_index"],
                "action": "delete",
            },
        })
        assert r5["ok"]

        r6 = handle_request({
            "id": "e6", "method": "list_measure_events",
            "params": {"measure": 1},
        })
        assert r6["ok"]
        new_event2 = next(
            e for e in r6["data"]["events"]
            if (e["part_id"], e["voice_id"], e["event_index"])
            == (note_event["part_id"], note_event["voice_id"], note_event["event_index"])
        )
        assert new_event2["kind"] == "rest"

    def test_reassign_moves_part(self):
        """reassign 應改 assignment 並重建 target_score"""
        import core.server as srv
        srv._CURRENT_ARRANGEMENT = None
        srv._SESSIONS_BY_ID.clear()

        # 用 default session arrange
        r = handle_request({
            "id": "ra", "method": "arrange",
            "params": {"path": "corpus:bach/bwv66.6"},
        })
        assert r["ok"]
        assignments = r["data"]["assignments"]
        # 找一個原本不在 piano_1/lower 的 assignment
        candidate = next(
            (a for a in assignments
             if a["target"] != "piano_1/lower"),
            None,
        )
        assert candidate is not None

        r2 = handle_request({
            "id": "rb", "method": "reassign",
            "params": {
                "source_part_id": candidate["source_part"],
                "target_player_id": "piano_1",
                "target_staff": "lower",
            },
        })
        assert r2["ok"], r2.get("error")
        assert r2["data"]["reassigned"]
        # undo 應該可用 (因為我們推了 history)
        assert r2["data"]["can_undo"]
        """default session 不可被 close (避免影響舊 API)"""
        import core.server as srv
        resp = handle_request({
            "id": "x3", "method": "close_session",
            "params": {"session_id": "default"},
        })
        assert resp["ok"]
        assert not resp["data"]["closed"]

    def test_multi_session_isolation(self):
        """不同 session_id 各自獨立的 arrangement / history"""
        import core.server as srv
        # 清空 default
        srv._CURRENT_ARRANGEMENT = None
        srv._HISTORY = []
        srv._REDO_STACK = []
        srv._SESSIONS_BY_ID.clear()

        # session A: 透過 arrange 建立
        a_resp = handle_request({
            "id": "a1", "method": "arrange",
            "params": {
                "path": "corpus:bach/bwv66.6",
                "session_id": "tab-A",
            },
        })
        assert a_resp["ok"]

        # session B: 另一作品
        b_resp = handle_request({
            "id": "b1", "method": "arrange",
            "params": {
                "path": "corpus:bach/bwv7.7",
                "session_id": "tab-B",
            },
        })
        assert b_resp["ok"]

        # 兩個 session 各自有不同 source_id
        assert "tab-A" in srv._SESSIONS_BY_ID
        assert "tab-B" in srv._SESSIONS_BY_ID
        arr_a = srv._SESSIONS_BY_ID["tab-A"]["arrangement"]
        arr_b = srv._SESSIONS_BY_ID["tab-B"]["arrangement"]
        assert arr_a is not None and arr_b is not None
        assert arr_a is not arr_b
        # 不同小節數
        assert (
            arr_a.target_score.movements[0].measure_count
            != arr_b.target_score.movements[0].measure_count
        )

        # default session 應未受影響
        assert srv._CURRENT_ARRANGEMENT is None

    def test_to_midi(self):
        """產生 MIDI base64 字串"""
        import core.server as srv
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange
        from core.arrangement_model import violin_piano_ensemble

        ir = parse_stream(corpus.parse("bach/bwv66.6"))
        tag_all_sections(ir)
        srv._CURRENT_ARRANGEMENT = run_arrange(ir, violin_piano_ensemble())

        resp = handle_request({"id": "midi1", "method": "to_midi", "params": {}})
        assert resp["ok"], resp.get("error")
        assert "midi_base64" in resp["data"]
        assert resp["data"]["size_bytes"] > 0
        # MIDI 標頭 "MThd" 經 base64 後常見前綴
        import base64
        midi_bytes = base64.b64decode(resp["data"]["midi_base64"])
        assert midi_bytes.startswith(b"MThd")

    def test_apply_octave_shift_on_arrangement(self):
        """改編產生需修復的 octave 問題, apply_suggestion 應能套用"""
        # 先 arrange (建立 _CURRENT_ARRANGEMENT)
        arrange_resp = handle_request({
            "id": "arr1", "method": "arrange",
            "params": {"path": "corpus:bach/bwv66.6"},
        })
        assert arrange_resp["ok"]

        issues = arrange_resp["data"]["issues"]
        # 找一個可 octave_shift 的 issue
        target_issue = None
        for i in issues:
            for s in i["suggestions"]:
                if s["code"] in ("S_OCTAVE_UP", "S_OCTAVE_DOWN"):
                    target_issue = i
                    break
            if target_issue:
                break

        if target_issue is None:
            pytest.skip("沒有 octave shift 適用的 issue")

        resp = handle_request({
            "id": "as2", "method": "apply_suggestion",
            "params": {
                "part_id": target_issue["part_id"],
                "measure": target_issue["measure"],
                "voice_id": target_issue["voice_id"],
                "event_index": target_issue["event_index"],
                "suggestion_code": "S_OCTAVE_DOWN"
                    if any(s["code"] == "S_OCTAVE_DOWN"
                           for s in target_issue["suggestions"])
                    else "S_OCTAVE_UP",
            },
        })
        assert resp["ok"], f"apply failed: {resp.get('error')}"
        assert resp["data"]["applied"]
        assert resp["data"]["target_musicxml"] is not None


# ============================================================================
# apply_edit_ops — 自然語言改譜的批次操作
# ============================================================================

class TestApplyEditOps:
    """apply_edit_ops: LLM 產生 / 使用者確認後的批次改譜。"""

    @staticmethod
    def _setup() -> object:
        """建立含 violin_1 (3 小節, 各一個 C4 音符) 的合成 arrangement。"""
        import core.server as srv
        from fractions import Fraction
        from core.arrangement_model import Arrangement, violin_piano_ensemble
        from core.ir import (
            Measure, Movement, NoteEvent, Part, Pitch, Score, Section, Voice,
        )

        def mk_measure(num: int) -> Measure:
            return Measure(
                number=num, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    NoteEvent(
                        pitch=Pitch(60, "C4"),
                        duration=Fraction(4), onset=Fraction(0),
                    ),
                ])},
            )

        score = Score(
            movements=[Movement(
                movement_id=1, measure_count=3,
                sections=[Section(0, 1, 3)],
            )],
            parts=[Part(
                part_id="violin_1", name_display="V",
                instrument_id="violin",
                measures=[mk_measure(1), mk_measure(2), mk_measure(3)],
            )],
        )
        srv._CURRENT_ARRANGEMENT = Arrangement(
            arrangement_id="t", name="T", source_id="s",
            players=violin_piano_ensemble(),
            assignments=[],
            target_score=score,
        )
        srv._HISTORY = []
        srv._REDO_STACK = []
        return score

    def test_transpose_shifts_pitches(self):
        score = self._setup()
        resp = handle_request({
            "id": "e1", "method": "apply_edit_ops",
            "params": {"ops": [{
                "op": "transpose", "part_id": "violin_1",
                "measure_start": 1, "measure_end": 2, "semitones": -12,
            }]},
        })
        assert resp["ok"], resp.get("error")
        assert resp["data"]["applied"]
        # m.1, m.2 降八度; m.3 不動
        assert score.parts[0].measures[0].voices[1].events[0].pitch.midi_number == 48
        assert score.parts[0].measures[1].voices[1].events[0].pitch.midi_number == 48
        assert score.parts[0].measures[2].voices[1].events[0].pitch.midi_number == 60
        assert resp["data"]["results"][0]["changed"] == 2

    def test_invalid_part_id_rejects_whole_batch(self):
        """任一 op 無效 → 整批拒絕, 不留半套狀態。"""
        score = self._setup()
        resp = handle_request({
            "id": "e2", "method": "apply_edit_ops",
            "params": {"ops": [
                {"op": "transpose", "part_id": "violin_1",
                 "measure_start": 1, "measure_end": 1, "semitones": 12},
                {"op": "transpose", "part_id": "nonexistent",
                 "measure_start": 1, "measure_end": 1, "semitones": 12},
            ]},
        })
        assert not resp["ok"]
        # 第一個 op 也不該被套用 (all-or-nothing)
        assert score.parts[0].measures[0].voices[1].events[0].pitch.midi_number == 60

    def test_articulation_and_dynamic(self):
        score = self._setup()
        resp = handle_request({
            "id": "e3", "method": "apply_edit_ops",
            "params": {"ops": [
                {"op": "articulation", "part_id": "violin_1",
                 "measure_start": 1, "measure_end": 3,
                 "articulation": "staccato", "mode": "set"},
                {"op": "dynamic", "part_id": "violin_1",
                 "measure_start": 2, "measure_end": 2, "dynamic": "pp"},
            ]},
        })
        assert resp["ok"], resp.get("error")
        ev = score.parts[0].measures[0].voices[1].events[0]
        assert ev.articulations == ["staccato"]
        assert score.parts[0].measures[1].voices[1].events[0].dynamic == "pp"
        assert score.parts[0].measures[2].voices[1].events[0].dynamic is None

    def test_locked_event_skipped(self):
        score = self._setup()
        score.parts[0].measures[0].voices[1].events[0].is_locked = True
        resp = handle_request({
            "id": "e4", "method": "apply_edit_ops",
            "params": {"ops": [{
                "op": "transpose", "part_id": "violin_1",
                "measure_start": 1, "measure_end": 3, "semitones": 12,
            }]},
        })
        assert resp["ok"], resp.get("error")
        # 鎖定的 m.1 不動, m.2 / m.3 移調
        assert score.parts[0].measures[0].voices[1].events[0].pitch.midi_number == 60
        assert score.parts[0].measures[1].voices[1].events[0].pitch.midi_number == 72
        assert resp["data"]["results"][0]["changed"] == 2

    def test_batch_shares_one_undo(self):
        """整批 ops 共用一次 history → 一次 undo 全部還原。"""
        score = self._setup()
        handle_request({
            "id": "e5", "method": "apply_edit_ops",
            "params": {"ops": [
                {"op": "transpose", "part_id": "violin_1",
                 "measure_start": 1, "measure_end": 1, "semitones": 12},
                {"op": "transpose", "part_id": "violin_1",
                 "measure_start": 2, "measure_end": 2, "semitones": 12},
            ]},
        })
        resp = handle_request({"id": "u", "method": "undo", "params": {}})
        assert resp["ok"], resp.get("error")
        import core.server as srv
        tgt = srv._CURRENT_ARRANGEMENT.target_score
        assert tgt.parts[0].measures[0].voices[1].events[0].pitch.midi_number == 60
        assert tgt.parts[0].measures[1].voices[1].events[0].pitch.midi_number == 60

    def test_rest_clears_range_to_rests(self):
        from core.ir import NoteEvent, RestEvent
        score = self._setup()
        resp = handle_request({
            "id": "e7", "method": "apply_edit_ops",
            "params": {"ops": [{
                "op": "rest", "part_id": "violin_1",
                "measure_start": 1, "measure_end": 2,
            }]},
        })
        assert resp["ok"], resp.get("error")
        # m.1 / m.2 變休止符; m.3 仍是音符
        assert isinstance(
            score.parts[0].measures[0].voices[1].events[0], RestEvent)
        assert isinstance(
            score.parts[0].measures[1].voices[1].events[0], RestEvent)
        assert isinstance(
            score.parts[0].measures[2].voices[1].events[0], NoteEvent)
        assert resp["data"]["results"][0]["changed"] == 2

    def test_empty_ops_rejected(self):
        self._setup()
        resp = handle_request({
            "id": "e6", "method": "apply_edit_ops",
            "params": {"ops": []},
        })
        assert not resp["ok"]

    @staticmethod
    def _setup_with_source() -> object:
        """target (易, 可加厚) + source (有和聲) — 供 enrich / level 測試。"""
        import core.server as srv
        from fractions import Fraction
        from core.arrangement_model import Arrangement, violin_piano_ensemble
        from core.ir import (
            ChordEvent, Measure, Movement, NoteEvent, Part, Pitch,
            Score, Section, Voice,
        )

        def tgt_measure(num: int) -> Measure:
            return Measure(
                number=num, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[
                    NoteEvent(pitch=Pitch(72, "C5"),
                              duration=Fraction(1), onset=Fraction(i))
                    for i in range(4)
                ])},
            )

        def src_measure(num: int) -> Measure:
            return Measure(
                number=num, time_signature=(4, 4),
                voices={1: Voice(voice_id=1, events=[ChordEvent(
                    pitches=[Pitch(48, "C3"), Pitch(52, "E3"),
                             Pitch(55, "G3")],
                    duration=Fraction(4), onset=Fraction(0),
                )])},
            )

        target = Score(
            movements=[Movement(movement_id=1, measure_count=3,
                                sections=[Section(0, 1, 3)])],
            parts=[Part(part_id="violin_1", name_display="V",
                        instrument_id="violin",
                        measures=[tgt_measure(i) for i in (1, 2, 3)])],
        )
        source = Score(parts=[Part(
            part_id="s", name_display="S", instrument_id="violin",
            measures=[src_measure(i) for i in (1, 2, 3)],
        )])
        srv._CURRENT_ARRANGEMENT = Arrangement(
            arrangement_id="t", name="T", source_id="s",
            players=violin_piano_ensemble(), assignments=[],
            target_score=target, source_score=source,
        )
        srv._HISTORY = []
        srv._REDO_STACK = []
        return target

    def test_level_op_succeeds(self):
        """回歸: level op 曾用 `target` 當區域變數覆寫 target_score,
        導致後續序列化拿 float 當 Score → 'float' has no attribute 'parts'。
        """
        self._setup_with_source()
        resp = handle_request({
            "id": "e8", "method": "apply_edit_ops",
            "params": {"ops": [{
                "op": "level", "part_id": "violin_1",
                "measure_start": 1, "measure_end": 3,
                "target_difficulty": 3,
            }]},
        })
        assert resp["ok"], resp.get("error")
        assert resp["data"]["applied"]
        # target_score 仍可正常序列化 (float 覆寫會在此崩潰)
        assert resp["data"]["target_musicxml"] is not None


# ============================================================================
# stdio loop 整合
# ============================================================================

class TestServeLoop:
    def test_serve_handles_two_requests(self):
        """測試 serve loop 能處理多個請求 + 輸出 ready"""
        stdin = io.StringIO()
        stdout = io.StringIO()
        # 寫 2 個請求
        stdin.write(json.dumps({"id": "1", "method": "ping", "params": {}}) + "\n")
        stdin.write(json.dumps({"id": "2", "method": "ping", "params": {}}) + "\n")
        stdin.seek(0)

        serve(stdin=stdin, stdout=stdout)

        output = stdout.getvalue().strip().split("\n")
        assert len(output) == 3  # ready + 2 responses
        ready = json.loads(output[0])
        assert ready["type"] == "ready"

        resp1 = json.loads(output[1])
        assert resp1["id"] == "1"
        assert resp1["ok"]

        resp2 = json.loads(output[2])
        assert resp2["id"] == "2"
        assert resp2["ok"]

    def test_serve_invalid_json_continues(self):
        """無效 JSON 不應中斷 server, 繼續處理後續請求"""
        stdin = io.StringIO()
        stdout = io.StringIO()
        stdin.write("not valid json\n")
        stdin.write(json.dumps({"id": "ok", "method": "ping", "params": {}}) + "\n")
        stdin.seek(0)

        serve(stdin=stdin, stdout=stdout)

        output = stdout.getvalue().strip().split("\n")
        assert len(output) == 3  # ready + invalid + valid
        invalid_resp = json.loads(output[1])
        assert not invalid_resp["ok"]
        valid_resp = json.loads(output[2])
        assert valid_resp["ok"]


class TestToMusicXMLFallback:
    """to_musicxml: music21 匯出對不規則 OMR MusicXML 崩潰時的後備。

    Audiveris 等 OMR 工具產生的 MusicXML 常有跨小節聲部編號不一致,
    music21 的 makeNotation/makeTies 會丟 KeyError 而崩潰。to_musicxml
    應退回原始檔內容 (OSMD 能直接彩現), 而非整個失敗。
    """

    def test_raw_helper_reads_plain_xml(self, tmp_path):
        f = tmp_path / "score.musicxml"
        f.write_text("<score-partwise>hi</score-partwise>", encoding="utf-8")
        assert _raw_musicxml_from_path(str(f)) == "<score-partwise>hi</score-partwise>"
        g = tmp_path / "score.xml"
        g.write_text("<score-partwise/>", encoding="utf-8")
        assert _raw_musicxml_from_path(str(g)) == "<score-partwise/>"

    def test_raw_helper_non_musicxml_returns_none(self, tmp_path):
        f = tmp_path / "tune.mid"
        f.write_bytes(b"MThd")
        assert _raw_musicxml_from_path(str(f)) is None
        assert _raw_musicxml_from_path("corpus:bach/bwv66.6") is None

    def test_raw_helper_reads_mxl(self, tmp_path):
        """.mxl (壓縮 MusicXML): 依 container.xml 取出內層 .xml。"""
        inner = "<score-partwise>compressed</score-partwise>"
        mxl = tmp_path / "song.mxl"
        with zipfile.ZipFile(mxl, "w") as zf:
            zf.writestr(
                "META-INF/container.xml",
                '<container><rootfiles>'
                '<rootfile full-path="song.xml"/></rootfiles></container>',
            )
            zf.writestr("song.xml", inner)
        assert _raw_musicxml_from_path(str(mxl)) == inner

    def test_raw_helper_reads_mxl_without_container(self, tmp_path):
        """.mxl 缺 container.xml → 退而取第一個非 META-INF 的 .xml。"""
        inner = "<score-partwise>bare</score-partwise>"
        mxl = tmp_path / "bare.mxl"
        with zipfile.ZipFile(mxl, "w") as zf:
            zf.writestr("whatever.xml", inner)
        assert _raw_musicxml_from_path(str(mxl)) == inner

    def test_to_musicxml_falls_back_when_export_crashes(self, bach_xml):
        """music21 匯出丟 KeyError → to_musicxml 回傳原始檔內容, 不崩潰。"""
        with patch(
            "music21.musicxml.m21ToXml.GeneralObjectExporter"
        ) as exporter:
            exporter.return_value.parse.side_effect = KeyError("4")
            resp = handle_request({
                "id": "fb1", "method": "to_musicxml",
                "params": {"path": bach_xml},
            })
        assert resp["ok"], resp.get("error")
        with open(bach_xml, encoding="utf-8") as fh:
            expected = fh.read()
        assert resp["data"] == expected

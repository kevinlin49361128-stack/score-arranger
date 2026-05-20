"""
Server protocol e2e 測試 — 啟動真實 subprocess, 走 JSON-line 協定。

涵蓋:
  - server ready handshake
  - arrange → list_measure_events → edit_event → undo
  - compute_difficulty / compute_quality / list_navigation
  - 跨 request 的 session 狀態保持
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import pytest
from music21 import corpus


# 用 corpus 找一個小曲, 寫成 musicxml 暫存供 server 讀
@pytest.fixture(scope="module")
def small_score_xml_path(tmp_path_factory) -> Path:
    m21 = corpus.parse("bach/bwv66.6")
    out = tmp_path_factory.mktemp("scores") / "bwv66_6.musicxml"
    m21.write("musicxml", fp=str(out))
    return out


@pytest.fixture
def server_proc():
    """spawn server.py 作為 subprocess, yield 一個 (send, recv) 介面"""
    engine_dir = Path(__file__).parent.parent
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    proc = subprocess.Popen(
        [sys.executable, "-m", "core.server"],
        cwd=str(engine_dir),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
        bufsize=1,
    )

    # 等 ready 訊息
    line = proc.stdout.readline()
    assert line, "server 沒有送出 ready"
    ready = json.loads(line)
    assert ready.get("type") == "ready"

    def send_recv(method: str, params: dict = {}, req_id: str = "1") -> dict:
        req = json.dumps({"id": req_id, "method": method, "params": params})
        proc.stdin.write(req + "\n")
        proc.stdin.flush()
        deadline = time.time() + 60
        while time.time() < deadline:
            resp = proc.stdout.readline()
            if not resp:
                break
            data = json.loads(resp)
            if data.get("id") == req_id:
                return data
        raise RuntimeError("timeout waiting for response")

    yield send_recv

    try:
        proc.stdin.close()
        proc.wait(timeout=5)
    except Exception:
        proc.kill()


class TestServerProtocol:
    def test_ping(self, server_proc):
        resp = server_proc("ping")
        assert resp["ok"] is True
        # 結構不限, 只要 ok 即可
        assert "data" in resp

    def test_unknown_method(self, server_proc):
        resp = server_proc("does_not_exist", {})
        assert resp["ok"] is False
        assert "unknown method" in resp["error"].lower()

    def test_list_corpus(self, server_proc):
        resp = server_proc("list_corpus", {})
        assert resp["ok"] is True
        entries = resp["data"]
        assert isinstance(entries, list)
        # 至少有 violin_piano 範例
        assert len(entries) > 0

    def test_full_arrange_workflow(
        self, server_proc, small_score_xml_path: Path,
    ):
        path = str(small_score_xml_path)
        # 1. arrange
        arr = server_proc(
            "arrange",
            {"path": path, "target": "string_quartet", "repair": False},
            req_id="arr1",
        )
        assert arr["ok"] is True, arr
        data = arr["data"]
        assert data["target_musicxml"]
        assert len(data["players"]) == 4
        assert len(data["assignments"]) >= 1

        # 2. list_measure_events
        m = data["assignments"][0]["span"][0]
        events_resp = server_proc(
            "list_measure_events", {"measure": m}, req_id="ev1",
        )
        assert events_resp["ok"] is True
        events = events_resp["data"]["events"]
        # 找一個 note 來編輯
        note_events = [e for e in events if e["kind"] == "note"]
        if not note_events:
            return  # 此 measure 全是 rest, 跳過 edit 測試
        target_ev = note_events[0]

        # 3. edit (transpose +1)
        edit_resp = server_proc(
            "edit_event",
            {
                "part_id": target_ev["part_id"],
                "measure": m,
                "voice_id": target_ev["voice_id"],
                "event_index": target_ev["event_index"],
                "action": "transpose",
                "extra": {"semitones": 1},
            },
            req_id="ed1",
        )
        assert edit_resp["ok"] is True, edit_resp
        assert edit_resp["data"]["can_undo"] is True

        # 4. undo
        undo_resp = server_proc("undo", {}, req_id="un1")
        assert undo_resp["ok"] is True
        assert undo_resp["data"]["can_redo"] is True

    def test_compute_metrics(self, server_proc, small_score_xml_path: Path):
        path = str(small_score_xml_path)
        server_proc(
            "arrange",
            {"path": path, "target": "violin_piano", "repair": False},
            req_id="arr2",
        )

        # difficulty
        diff = server_proc("compute_difficulty", {}, req_id="d1")
        assert diff["ok"] is True
        assert isinstance(diff["data"], dict)
        if diff["data"]:
            first = next(iter(diff["data"].values()))
            assert "score" in first
            assert "measures" in first

        # quality
        qual = server_proc("compute_quality", {}, req_id="q1")
        assert qual["ok"] is True
        if qual["data"]:
            assert "melody_preservation" in qual["data"]
            assert "harmony_completeness" in qual["data"]
            assert "playability" in qual["data"]
            assert "overall" in qual["data"]

    def test_navigation_endpoint(self, server_proc, small_score_xml_path: Path):
        path = str(small_score_xml_path)
        server_proc(
            "arrange",
            {"path": path, "target": "violin_piano", "repair": False},
            req_id="arr3",
        )
        nav = server_proc("list_navigation", {}, req_id="n1")
        assert nav["ok"] is True
        assert "movements" in nav["data"]
        assert "rehearsal_marks" in nav["data"]
        assert "total_measures" in nav["data"]
        assert nav["data"]["total_measures"] > 0

    def test_session_isolation(self, server_proc, small_score_xml_path: Path):
        """同一 process 兩個 session 不互相干擾"""
        path = str(small_score_xml_path)
        # session A: violin_piano
        r = server_proc(
            "arrange",
            {
                "path": path,
                "target": "violin_piano",
                "repair": False,
                "session_id": "A",
            },
            req_id="sA1",
        )
        assert r["ok"] is True
        a_players = len(r["data"]["players"])

        # session B: string_quartet
        r = server_proc(
            "arrange",
            {
                "path": path,
                "target": "string_quartet",
                "repair": False,
                "session_id": "B",
            },
            req_id="sB1",
        )
        assert r["ok"] is True
        b_players = len(r["data"]["players"])

        assert a_players == 2
        assert b_players == 4

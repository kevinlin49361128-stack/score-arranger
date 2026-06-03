"""C3: 背景 OMR 作業 registry — 狀態機 / 取消 / 進度。"""
from __future__ import annotations

import threading
import time

from core.omr_jobs import (
    OmrCancelled,
    OmrJob,
    cancel_job,
    job_status,
    start_job,
)


def _wait_until_done(jid, timeout=2.0):
    end = time.time() + timeout
    while time.time() < end:
        st = job_status(jid)
        if st and st["state"] != "running":
            return st
        time.sleep(0.005)
    return job_status(jid)


def test_job_completes_with_progress():
    def run(job: OmrJob) -> str:
        job.chunks_total = 2
        job.chunks_done = 2
        return "/tmp/result.musicxml"

    jid = start_job(run)
    st = _wait_until_done(jid)
    assert st["state"] == "done"
    assert st["result_path"] == "/tmp/result.musicxml"
    assert st["progress"] == 1.0


def test_job_cancel():
    started = threading.Event()

    def run(job: OmrJob) -> str:
        job.chunks_total = 3
        started.set()
        while not job.cancel_event.is_set():
            time.sleep(0.005)
        raise OmrCancelled()

    jid = start_job(run)
    assert started.wait(1.0)
    assert cancel_job(jid) is True
    st = _wait_until_done(jid)
    assert st["state"] == "cancelled"


def test_job_error_surfaces():
    def run(_job: OmrJob) -> str:
        raise RuntimeError("boom")

    jid = start_job(run)
    st = _wait_until_done(jid)
    assert st["state"] == "error"
    assert "boom" in (st["error"] or "")


def test_unknown_job():
    assert job_status("nope") is None
    assert cancel_job("nope") is False

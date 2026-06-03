"""C3: 背景 OMR 作業 — 非阻塞執行 + 進度 + 取消。

引擎主迴圈是循序的, 但 omr_start 起一條背景執行緒後「立刻回傳」, 主迴圈
即可繼續服務 omr_status / omr_cancel 輪詢 (不需改主迴圈的併發模型)。
作業狀態存共享 registry, 由 lock 保護 (背景緒寫、主緒讀)。

進度由分頁 (chunk) 完成數提供 (見 omr_stitch / audiveris chunked runner) ——
不必去 parse Audiveris log 的格式, 較穩。
"""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Optional


class OmrCancelled(Exception):
    """使用者取消 OMR 作業。"""


@dataclass
class OmrJob:
    job_id: str
    state: str = "running"  # running | done | error | cancelled
    chunks_done: int = 0
    chunks_total: int = 0
    result_path: Optional[str] = None
    error: Optional[str] = None
    cancel_event: threading.Event = field(default_factory=threading.Event)


_jobs: "dict[str, OmrJob]" = {}
_lock = threading.Lock()
_JOB_KEEP = 8  # 已結束作業留最近幾個, registry 不無限長大


def start_job(run: Callable[[OmrJob], str]) -> str:
    """起一個背景 OMR 作業。

    run(job) 執行實際 OMR: 可讀 job.cancel_event 判斷取消、更新
    job.chunks_done/total 回報進度, 回傳結果路徑。回傳 job_id。
    """
    job = OmrJob(job_id=uuid.uuid4().hex[:12])
    with _lock:
        _jobs[job.job_id] = job
        _gc_locked()

    def _worker() -> None:
        try:
            path = run(job)
            with _lock:
                if job.cancel_event.is_set():
                    job.state = "cancelled"
                else:
                    job.result_path = path
                    job.state = "done"
        except OmrCancelled:
            with _lock:
                job.state = "cancelled"
        except Exception as e:  # noqa: BLE001 — 背景緒須吞例外, 經 status 回報
            with _lock:
                job.state = "error"
                job.error = f"{type(e).__name__}: {e}"

    threading.Thread(target=_worker, daemon=True).start()
    return job.job_id


def job_status(job_id: str) -> Optional[dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        progress = (
            job.chunks_done / job.chunks_total if job.chunks_total else 0.0
        )
        return {
            "state": job.state,
            "chunks_done": job.chunks_done,
            "chunks_total": job.chunks_total,
            "progress": round(progress, 4),
            "result_path": job.result_path,
            "error": job.error,
        }


def cancel_job(job_id: str) -> bool:
    """要求取消 (set cancel_event); 實際中止由 runner 在安全點處理。"""
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return False
        job.cancel_event.set()
        return True


def _gc_locked() -> None:
    """已結束作業只留最近 _JOB_KEEP 個 (呼叫端須持 _lock)。"""
    finished = [j for j in _jobs.values() if j.state != "running"]
    for j in finished[:-_JOB_KEEP] if len(finished) > _JOB_KEEP else []:
        _jobs.pop(j.job_id, None)

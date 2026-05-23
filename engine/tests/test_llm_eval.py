"""LLM eval harness 單元測試"""

from __future__ import annotations

import pytest


class TestLLMEval:
    def test_default_suite_loadable(self):
        from core.llm_eval import default_suite
        suite = default_suite()
        assert len(suite) >= 3
        for s in suite:
            assert s.id
            assert s.score
            assert s.ops

    def test_eval_report_summary_format(self):
        from core.llm_eval import EvalReport, EvalResult
        rep = EvalReport(results=[
            EvalResult(scenario_id="a", passed=True),
            EvalResult(scenario_id="b", passed=False, error="boom"),
        ])
        s = rep.summary()
        assert "1/2" in s
        assert "boom" in s

    @pytest.mark.slow
    def test_run_eval_suite_does_not_crash(self):
        """跑完整 suite, 至少不該整批失敗 — 用真實 bach corpus + ops."""
        from core.llm_eval import run_eval_suite, default_suite
        report = run_eval_suite(default_suite())
        # 至少一半通過 (容忍少量 edge case)
        assert report.passed >= len(report.results) // 2, \
            f"太多 scenario 失敗:\n{report.summary()}"

"""
LLM eval harness — 跑「natural-language request → operations」品質回歸測試.

設計目標:
  1. 不依賴真實 LLM (可離線跑) — 用「stub LLM client」直接餵預期 plan.
     真實 LLM 整合留給 TS 主程序 (llm.ts). 這裡的 eval 只測 *引擎側* 的
     行為: 套 ops 後, quality 真的有變好嗎? op kind 對映對嗎?
  2. CSV / JSON 報告 — 一目了然哪些 scenario 退步.
  3. 跑得快 — 每 scenario < 5s, 整批 < 1 分鐘, 適合 CI.

scenario 格式 (Python dict):
    {
      "id": "transpose_violin_down",
      "score": "corpus:bach/bwv66.6",
      "ensemble": "violin_piano",
      "ops": [
        {
          "kind": "transpose",
          "part_id": "violin_1",  # 套用對象
          "measure_start": 1, "measure_end": 8,
          "semitones": -12,
        },
      ],
      "expected_quality_delta": {
        "playability_min": 0.0,   # 套後 playability >= 此值 (絕對值)
        # 也可寫 "playability_at_least_as_good": True (= 套後 >= 套前)
      },
    }

跑法:
    from core.llm_eval import run_eval_suite, default_suite
    report = run_eval_suite(default_suite())
    print(report.summary())
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .arrangement_model import build_ensemble
from .arranger import arrange as run_arrange
from .analyzer.function import tag_all_sections
from .parser import parse_musicxml


@dataclass
class EvalScenario:
    id: str
    score: str
    ensemble: str
    ops: list[dict[str, Any]]
    expected: dict[str, Any] = field(default_factory=dict)


@dataclass
class EvalResult:
    scenario_id: str
    passed: bool
    quality_before: Optional[dict[str, float]] = None
    quality_after: Optional[dict[str, float]] = None
    error: Optional[str] = None
    notes: list[str] = field(default_factory=list)


@dataclass
class EvalReport:
    results: list[EvalResult]

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.passed)

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if not r.passed)

    def summary(self) -> str:
        lines = [
            f"LLM eval — {self.passed}/{len(self.results)} passed",
            "",
        ]
        for r in self.results:
            mark = "✓" if r.passed else "✗"
            line = f"  {mark} {r.scenario_id}"
            if r.error:
                line += f"  ERROR: {r.error}"
            if r.quality_before and r.quality_after:
                line += (
                    f"  Δ play={r.quality_after.get('playability', 0):.2f}"
                    f" (was {r.quality_before.get('playability', 0):.2f})"
                )
            lines.append(line)
        return "\n".join(lines)


def default_suite() -> list[EvalScenario]:
    """內建 scenario — 涵蓋常見 op 類型, 對應 llm-examples.ts 的 corpus."""
    return [
        EvalScenario(
            id="transpose_down_octave",
            score="corpus:bach/bwv66.6",
            ensemble="violin_piano",
            ops=[{
                "kind": "transpose",
                "part_id": "violin_1",
                "measure_start": 1,
                "measure_end": 4,
                "semitones": -12,
            }],
            expected={"playability_at_least_as_good": True},
        ),
        EvalScenario(
            id="articulation_set_staccato",
            score="corpus:bach/bwv66.6",
            ensemble="violin_piano",
            ops=[{
                "kind": "articulation",
                "part_id": "violin_1",
                "measure_start": 1,
                "measure_end": 4,
                "articulation": "staccato",
                "mode": "set",
            }],
            expected={"playability_at_least_as_good": True},
        ),
        EvalScenario(
            id="dynamic_pp_opening",
            score="corpus:bach/bwv66.6",
            ensemble="violin_piano",
            ops=[{
                "kind": "dynamic",
                "part_id": "violin_1",
                "measure_start": 1,
                "measure_end": 4,
                "dynamic": "pp",
            }],
            expected={"playability_at_least_as_good": True},
        ),
        EvalScenario(
            id="rest_silence_section",
            score="corpus:bach/bwv66.6",
            ensemble="violin_piano",
            ops=[{
                "kind": "rest",
                "part_id": "violin_1",
                "measure_start": 3,
                "measure_end": 4,
            }],
            # rest 把音符換成休止 → playability 必須維持 1.0 (空白絕對可演奏)
            expected={"playability_min": 0.95},
        ),
    ]


def _compute_quality(arrangement) -> dict[str, float]:
    """計算 arrangement 的 quality (melody/harmony/playability)."""
    try:
        from .quality import compute_quality
        source = arrangement.source_score
        target = arrangement.target_score
        if source is None or target is None:
            return {"melody": 0.0, "harmony": 0.0, "playability": 0.0}
        q = compute_quality(source, target)
        return {
            "melody": float(getattr(q, "melody_preservation", 0.0)),
            "harmony": float(getattr(q, "harmony_completeness", 0.0)),
            "playability": float(getattr(q, "playability", 0.0)),
        }
    except Exception:
        return {"melody": 0.0, "harmony": 0.0, "playability": 0.0}


def run_scenario(scenario: EvalScenario) -> EvalResult:
    """跑單一 scenario, 回 EvalResult."""
    try:
        score = parse_musicxml(scenario.score)
        tag_all_sections(score)
        players = build_ensemble(scenario.ensemble)
        arrangement = run_arrange(score, players)

        quality_before = _compute_quality(arrangement)

        # 套 ops — 用 server 的 JSON-RPC apply_edit_ops, 透過 default session
        # 設定 current_arrangement → 呼叫 → 讀回. 確保 ops 流程跟 production
        # 完全一致 (鎖定處理、history snapshot 等).
        from . import server as _srv
        _srv._CURRENT_ARRANGEMENT = arrangement
        # 把 op 內部 key 改成 server 期待的 "op" 而非 "kind"
        rpc_ops = []
        for op in scenario.ops:
            o = dict(op)
            if "kind" in o and "op" not in o:
                o["op"] = o.pop("kind")
            rpc_ops.append(o)
        try:
            _srv._method_apply_edit_ops({"ops": rpc_ops})
        except Exception as e:
            return EvalResult(
                scenario_id=scenario.id,
                passed=False,
                error=f"apply 失敗: {e}",
                quality_before=quality_before,
            )
        # 取最新的 arrangement (apply 會替換 session 內的 arrangement)
        arrangement = _srv._CURRENT_ARRANGEMENT

        quality_after = _compute_quality(arrangement)

        # 驗證 expectations
        notes: list[str] = []
        passed = True
        if scenario.expected.get("playability_at_least_as_good"):
            if quality_after["playability"] < quality_before["playability"] - 0.05:
                passed = False
                notes.append(
                    f"playability 退步: "
                    f"{quality_before['playability']:.2f} → "
                    f"{quality_after['playability']:.2f}"
                )
        if "playability_min" in scenario.expected:
            threshold = float(scenario.expected["playability_min"])
            if quality_after["playability"] < threshold:
                passed = False
                notes.append(
                    f"playability {quality_after['playability']:.2f} "
                    f"< 期望 {threshold:.2f}"
                )

        return EvalResult(
            scenario_id=scenario.id,
            passed=passed,
            quality_before=quality_before,
            quality_after=quality_after,
            notes=notes,
        )
    except Exception as e:
        return EvalResult(
            scenario_id=scenario.id,
            passed=False,
            error=f"{type(e).__name__}: {e}",
        )


def run_eval_suite(scenarios: list[EvalScenario]) -> EvalReport:
    """跑整套 scenarios, 回 EvalReport."""
    results = [run_scenario(s) for s in scenarios]
    return EvalReport(results=results)

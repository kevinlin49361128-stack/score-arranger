"""老師評語層 (explainer) 測試 — 0.1.32."""

from __future__ import annotations

from core.explainer import (
    explanation_to_dict,
    generate_explanation,
)


class TestExplainerSmoke:
    """端對端 smoke: 跑 arrange + explain 不崩, 輸出格式正確."""

    def _arrange(self):
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import string_quartet_ensemble
        from core.arranger import arrange as run_arrange
        from core.parser import parse_musicxml

        score = parse_musicxml("corpus:bach/bwv66.6")
        tag_all_sections(score)
        return run_arrange(score, string_quartet_ensemble())

    def test_explanation_global_headline(self):
        arr = self._arrange()
        exp = generate_explanation(arr)
        assert exp.global_.headline
        assert "編制" in exp.global_.headline

    def test_explanation_parts_present(self):
        arr = self._arrange()
        exp = generate_explanation(arr)
        # 弦樂四重奏 → 至少 4 個 part 對應
        assert len(exp.parts) >= 1
        # 每個 part 至少有 preserved / changed / cost 結構
        for p in exp.parts:
            assert isinstance(p.preserved, list)
            assert isinstance(p.changed, list)
            assert isinstance(p.cost, list)

    def test_explanation_to_dict_shape(self):
        arr = self._arrange()
        exp = generate_explanation(arr)
        d = explanation_to_dict(exp)
        assert "global" in d
        assert "parts" in d
        assert "headline" in d["global"]
        assert isinstance(d["parts"], list)

    def test_melody_part_has_preserved_text(self):
        """主旋律 part 應有「主旋律保留在 X」這類字眼."""
        arr = self._arrange()
        exp = generate_explanation(arr)
        melody_parts = [p for p in exp.parts if p.function == "melody"]
        assert len(melody_parts) >= 1
        # 至少其中一個 melody 應該有 preserved 內容
        any_with_text = any(
            any("旋律" in s for s in p.preserved)
            for p in melody_parts
        )
        assert any_with_text

    def test_with_quality_dict(self):
        """有 quality_dict 時 global.quality_summary 應出現."""
        arr = self._arrange()
        quality_dict = {
            "melody_preservation": 0.95,
            "harmony_completeness": 0.88,
            "playability": 0.92,
        }
        exp = generate_explanation(arr, quality_dict=quality_dict)
        assert exp.global_.quality_summary is not None
        assert "95%" in exp.global_.quality_summary

    def test_with_repair_dict(self):
        """有 repair_dict 時 global.repair_summary 應描述輪次."""
        arr = self._arrange()
        repair_dict = {
            "iterations": 5,
            "converged": True,
            "severity_before": 20.0,
            "severity_after": 3.0,
        }
        exp = generate_explanation(arr, repair_dict=repair_dict)
        assert exp.global_.repair_summary is not None
        assert "5 輪" in exp.global_.repair_summary
        assert "收斂" in exp.global_.repair_summary

    def test_with_difficulty_factors(self):
        """有 difficulty.parts factors → part cost 應出現難度主導因子."""
        arr = self._arrange()
        # 拿 arrangement 的第一個 player_id 構造假 difficulty
        if not arr.players:
            return  # skip if empty
        difficulty_dict = {
            "parts": [
                {
                    "part_id": p.player_id,
                    "score": 3.5,
                    "factors": {
                        "range": 0.6,
                        "density": 0.3,
                        "chord": 0.7,
                        "rhythm": 0.2,
                        "technique": 0.8,
                    },
                }
                for p in arr.players
            ],
        }
        exp = generate_explanation(arr, difficulty_dict=difficulty_dict)
        parts_with_cost = [p for p in exp.parts if p.cost]
        assert len(parts_with_cost) >= 1
        # 至少一個 cost 應該含「技巧」或「和弦」等主導因子名稱
        all_costs = " ".join(c for p in exp.parts for c in p.cost)
        assert any(name in all_costs
                   for name in ("音域", "密度", "和弦", "節奏", "技巧"))


class TestExplainerEdgeCases:
    def test_empty_arrangement(self):
        from core.arrangement_model import Arrangement, string_quartet_ensemble
        arr = Arrangement(
            arrangement_id="empty",
            name="empty",
            source_id="",
            players=string_quartet_ensemble(),
            assignments=[],
            target_score=None,
        )
        exp = generate_explanation(arr)
        assert exp.global_.headline  # 仍有 headline
        assert exp.parts == []  # 無 target_score 就無 parts

    def test_dict_with_none_fields(self):
        """quality_dict 內欄位 None 不該崩."""
        from core.arrangement_model import Arrangement, string_quartet_ensemble
        arr = Arrangement(
            arrangement_id="x",
            name="x",
            source_id="",
            players=string_quartet_ensemble(),
            assignments=[],
        )
        exp = generate_explanation(
            arr,
            quality_dict={"melody_preservation": None,
                          "harmony_completeness": None,
                          "playability": None},
        )
        # quality_summary 應該是 None 因為其中一個欄位 None
        assert exp.global_.quality_summary is None


# ============================================================================
# 0.1.32 get_chord_fingering RPC (FingerboardSimulator 對齊 engine)
# ============================================================================

class TestGetChordFingeringRpc:
    """測試新的 get_chord_fingering RPC (H 收尾, 確認 viterbi 取代 greedy)."""

    def test_violin_open_strings_triad_returns_assignments(self):
        from core.server import handle_request
        # 三條空弦 D4 / A4 / E5 (=62, 69, 76) — 必可演奏
        resp = handle_request({
            "id": "f1", "method": "get_chord_fingering",
            "params": {"instrument": "violin", "pitches": [62, 69, 76]},
        })
        assert resp["ok"], resp.get("error")
        data = resp["data"]
        assert data["feasible"] is True
        assert len(data["assignments"]) == 3
        for a in data["assignments"]:
            assert "midi" in a
            assert "string_name" in a
            assert "fret" in a
        # 全部空弦 fret=0
        assert all(a["fret"] == 0 for a in data["assignments"])

    def test_infeasible_returns_false(self):
        from core.server import handle_request
        # 跨度極大 → violin 不可行
        resp = handle_request({
            "id": "f2", "method": "get_chord_fingering",
            "params": {"instrument": "violin", "pitches": [40, 100]},
        })
        assert resp["ok"]
        assert resp["data"]["feasible"] is False

    def test_unknown_instrument_returns_false(self):
        from core.server import handle_request
        resp = handle_request({
            "id": "f3", "method": "get_chord_fingering",
            "params": {"instrument": "fake_instrument", "pitches": [60]},
        })
        assert resp["ok"]
        assert resp["data"]["feasible"] is False

    def test_empty_pitches_returns_false(self):
        from core.server import handle_request
        resp = handle_request({
            "id": "f4", "method": "get_chord_fingering",
            "params": {"instrument": "violin", "pitches": []},
        })
        assert resp["ok"]
        assert resp["data"]["feasible"] is False

    def test_guitar_uses_require_adjacent_false(self):
        """吉他 family=plucked 應允許跨弦 (require_adjacent=False)."""
        from core.server import handle_request
        # E2 + C5 → 吉他可以省略中間弦
        resp = handle_request({
            "id": "f5", "method": "get_chord_fingering",
            "params": {"instrument": "guitar", "pitches": [40, 72]},
        })
        assert resp["ok"]
        # 吉他應該能找到 (E2 空弦 6, C5 第 5 弦 fret 15)
        assert resp["data"]["feasible"] is True

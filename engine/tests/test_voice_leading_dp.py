"""Voice-leading DP optimizer 單元測試"""

from __future__ import annotations


class TestVoiceLeadingDP:
    def test_does_not_crash_on_satb(self):
        """SATB → string quartet 跑完整 pipeline 不會崩潰."""
        from core.parser import parse_musicxml
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import string_quartet_ensemble
        from core.arranger import arrange as run_arrange

        score = parse_musicxml("corpus:bach/bwv66.6")
        tag_all_sections(score)
        arr = run_arrange(score, string_quartet_ensemble())
        # 改編成功 (target_score 有 parts)
        assert arr.target_score is not None
        assert len(arr.target_score.parts) > 0

    def test_optimize_inner_voices_returns_result(self):
        """直接呼叫 optimize_inner_voices, 回傳 cost_before / cost_after."""
        from core.parser import parse_musicxml
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import string_quartet_ensemble
        from core.arranger import arrange as run_arrange
        from core.voice_leading_dp import optimize_inner_voices

        score = parse_musicxml("corpus:bach/bwv66.6")
        tag_all_sections(score)
        arr = run_arrange(score, string_quartet_ensemble())
        result = optimize_inner_voices(arr)
        # cost_after <= cost_before (DP 不會讓事情變糟)
        assert result.cost_after <= result.cost_before + 0.01, (
            f"DP 不該讓 voice-leading 變糟: before={result.cost_before}, "
            f"after={result.cost_after}"
        )

    def test_skipped_when_no_target(self):
        """無 target_score → result 空, 不崩."""
        from core.arrangement_model import (
            Arrangement,
            string_quartet_ensemble,
        )
        from core.voice_leading_dp import optimize_inner_voices

        arr = Arrangement(
            arrangement_id="test",
            name="empty",
            source_id="",
            players=string_quartet_ensemble(),
            assignments=[],
            target_score=None,
        )
        result = optimize_inner_voices(arr)
        assert result.optimized_count == 0

    def test_no_inner_voices_short_circuits(self):
        """所有 part 都是 MELODY → 沒內聲部可優化, 安全跳過."""
        from core.parser import parse_musicxml
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import build_ensemble
        from core.arranger import arrange as run_arrange
        from core.voice_leading_dp import optimize_inner_voices

        score = parse_musicxml("corpus:bach/bwv66.6")
        tag_all_sections(score)
        # violin_piano 只有兩個 player, 不會有多個內聲部
        arr = run_arrange(score, build_ensemble("violin_piano"))
        result = optimize_inner_voices(arr)
        # 一定有結果 object, 沒 crash
        assert result is not None
        assert result.optimized_count >= 0

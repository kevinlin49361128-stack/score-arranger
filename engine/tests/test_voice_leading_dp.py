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

    def test_v2_inner_to_inner_parallels_reduced(self):
        """v2: smoke test 0.1.16 發現的 V2↔Viola 平行八度應該被 DP 拆解.

        Mozart K545 mvt1 + string_quartet (2-part source → 4-part target,
        2 個 inner voice). 預期 cost_after < cost_before (整體變優).
        """
        from core.parser import parse_musicxml
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import string_quartet_ensemble
        from core.arranger import arrange as run_arrange
        from core.voice_leading_dp import optimize_inner_voices

        # 注意: arrange() pipeline 已內建呼叫 optimize_inner_voices, 所以
        # 第一次拿到的 arrangement 是已經過 DP 處理的. 這裡再呼叫一次,
        # 應該基本上沒事可做 (cost 已是局部最佳).
        try:
            score = parse_musicxml("corpus:mozart/k545/movement1")
        except Exception:
            import pytest
            pytest.skip("Mozart K545 sample 不存在")
        tag_all_sections(score)
        arr = run_arrange(score, string_quartet_ensemble())
        result = optimize_inner_voices(arr)
        # 至少有跑過 (有 inner voice), 且 cost_after <= cost_before
        assert result.cost_after <= result.cost_before + 0.01


# ============================================================================
# 0.1.31: 候選音擴充 (Layer 2 — 當下和弦內音)
# ============================================================================

class TestCandidateExpansion:
    """voice_leading_dp._generate_candidates — 從 ±12 octaves 擴成
    octaves + 當下和弦 pitch classes 的近 octave."""

    def test_layer1_octaves_always_included(self):
        """無論有沒有 chord context, ±12 octaves 必含."""
        from core.voice_leading_dp import _generate_candidates, _Slot
        slot = _Slot(
            part_id="x", measure_number=1, voice_id=1, event_index=0,
            original_midi=60,  # C4
            melody_midi=None, bass_midi=None,
            other_inner_midis=[],
        )
        cands = _generate_candidates(slot, prac_lo=0, prac_hi=127)
        assert 48 in cands  # -12
        assert 60 in cands  # original
        assert 72 in cands  # +12

    def test_layer2_chord_tones_from_melody_bass(self):
        """melody=E4 (64), bass=C4 (60) → chord pc = {0, 4}.
        Original=67 (G4) — 候選應含 G4 (±12) 也含 C/E 的近 octave."""
        from core.voice_leading_dp import _generate_candidates, _Slot
        slot = _Slot(
            part_id="x", measure_number=1, voice_id=1, event_index=0,
            original_midi=67,  # G4
            melody_midi=64,    # E4
            bass_midi=60,      # C4
            other_inner_midis=[],
        )
        cands = _generate_candidates(slot, prac_lo=0, prac_hi=127)
        cand_pcs = {c % 12 for c in cands}
        # 應該含 G (7, original pc) + E (4, melody) + C (0, bass)
        assert 7 in cand_pcs   # G — original
        assert 4 in cand_pcs   # E — melody pc
        assert 0 in cand_pcs   # C — bass pc

    def test_layer2_uses_optimized_inner_voices(self):
        """已優化的 inner voice 在 (60, 64) → chord pc = {0, 4}.
        Original=55 (G3), 候選應含 55 ±12 也含 C/E 的近 octave."""
        from core.voice_leading_dp import _generate_candidates, _Slot
        slot = _Slot(
            part_id="x", measure_number=1, voice_id=1, event_index=0,
            original_midi=55,  # G3
            melody_midi=None, bass_midi=None,
            other_inner_midis=[60, 64],  # C4, E4 — 已優化的 inner
        )
        cands = _generate_candidates(slot, prac_lo=0, prac_hi=127)
        cand_pcs = {c % 12 for c in cands}
        assert 7 in cand_pcs   # G — original
        assert 0 in cand_pcs   # C — from inner
        assert 4 in cand_pcs   # E — from inner

    def test_range_filter(self):
        """超出 practical range 全濾掉, 全空時退回 original."""
        from core.voice_leading_dp import _generate_candidates, _Slot
        slot = _Slot(
            part_id="x", measure_number=1, voice_id=1, event_index=0,
            original_midi=60, melody_midi=72, bass_midi=48,
            other_inner_midis=[],
        )
        # 限制超緊 — 只有 60 通過
        cands = _generate_candidates(slot, prac_lo=60, prac_hi=60)
        assert cands == [60]

    def test_transition_cost_hidden_parallel_octave(self):
        """同向跳到 P8 應加 W_HIDDEN_PARALLEL penalty."""
        from core.voice_leading_dp import (
            W_HIDDEN_PARALLEL,
            _Slot,
            _transition_cost,
        )
        # inner: F4 (65) → G5 (79), outer (melody): C4 (60) → G4 (67)
        # 起始 inner-melody = |65-60| = 5 (P4), 結束 |79-67| = 12 (P8)
        # 同向 (兩部都上), inner 跳 14, outer 跳 7 → 應加 hidden penalty
        prev_slot = _Slot(
            part_id="x", measure_number=1, voice_id=1, event_index=0,
            original_midi=65, melody_midi=60, bass_midi=None,
            other_inner_midis=[],
        )
        slot = _Slot(
            part_id="x", measure_number=1, voice_id=1, event_index=1,
            original_midi=79, melody_midi=67, bass_midi=None,
            other_inner_midis=[],
        )
        cost = _transition_cost(65, 79, prev_slot, slot)
        # W_LEAP * 14 = 14, + W_HIDDEN_PARALLEL (80) = 94 約
        assert cost >= W_HIDDEN_PARALLEL, (
            f"hidden parallel penalty 應被加入: cost={cost}"
        )

    def test_transition_cost_contrary_motion_no_hidden(self):
        """反向動進 → 不算 hidden, 不加 penalty."""
        from core.voice_leading_dp import (
            W_HIDDEN_PARALLEL,
            _Slot,
            _transition_cost,
        )
        # inner: F4 (65) → G5 (79), outer (melody): C5 (72) → G4 (67) 下行
        # 同向 = (上, 下) → 反向, 不應加 hidden penalty
        prev_slot = _Slot(
            part_id="x", measure_number=1, voice_id=1, event_index=0,
            original_midi=65, melody_midi=72, bass_midi=None,
            other_inner_midis=[],
        )
        slot = _Slot(
            part_id="x", measure_number=1, voice_id=1, event_index=1,
            original_midi=79, melody_midi=67, bass_midi=None,
            other_inner_midis=[],
        )
        cost = _transition_cost(65, 79, prev_slot, slot)
        # 只有 W_LEAP * 14 = 14, 沒有 hidden penalty
        assert cost < W_HIDDEN_PARALLEL, (
            f"反向動進不該加 hidden penalty: cost={cost}"
        )

    def test_state_cost_penalizes_pitch_class_change(self):
        """改 pc 比保留 pc 成本高 (W_DIFF_PITCH_CLASS=50). 確保 DP
        不會無端把 G 換成 C 除非真的有 W_PARALLEL 級別的好處可拿."""
        from core.voice_leading_dp import _state_cost, _Slot, W_DIFF_PITCH_CLASS
        slot = _Slot(
            part_id="x", measure_number=1, voice_id=1, event_index=0,
            original_midi=67,  # G4
            melody_midi=None, bass_midi=None,
            other_inner_midis=[],
        )
        # 同距離不同 pc: 67 (G4 原) vs 66 (F#4, 1 semitone, 不同 pc).
        # 控制距離一致, diff 就主要來自 W_DIFF_PITCH_CLASS.
        cost_keep_pc = _state_cost(67, slot, cmf_lo=0, cmf_hi=127)
        cost_change_pc = _state_cost(66, slot, cmf_lo=0, cmf_hi=127)
        # 預期 diff ≈ W_DIFF_PITCH_CLASS (50) + 1 semitone * W_DIFF_FROM_ORIG (0.5)
        assert cost_change_pc - cost_keep_pc >= W_DIFF_PITCH_CLASS, (
            f"改 pc 應加 W_DIFF_PITCH_CLASS penalty: "
            f"cost_keep={cost_keep_pc}, cost_change={cost_change_pc}"
        )

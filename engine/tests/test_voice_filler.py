"""Voice filler 單元測試 — 內聲部自動補完"""

from __future__ import annotations

import pytest


class TestFillInnerVoices:
    def test_corelli_trio_to_string_quartet_fills_viola(self):
        """Corelli 三重奏 (2 violins + cello) → 弦四 → viola 應被自動填音."""
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange
        from core.arrangement_model import string_quartet_ensemble

        m21 = corpus.parse("corelli/opus3no1/1grave")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = arrange(score, string_quartet_ensemble())

        viola = next(
            p for p in arr.target_score.parts if p.part_id == "viola_1"
        )
        notes = [
            ev for m in viola.measures
            for v in m.voices.values()
            for ev in v.events
            if hasattr(ev, "pitch")
        ]
        assert len(notes) > 0, "viola 應該被自動補完, 不該空白"
        # 所有音應在 viola comfortable range (C3-C6, midi 48-84)
        from core.instruments import get_profile
        profile = get_profile("viola")
        lo, hi = profile.range_comfortable
        for n in notes:
            assert lo <= n.pitch.midi_number <= hi, \
                f"音 {n.pitch.midi_number} 超出 viola comfortable {lo}-{hi}"

    def test_fill_disabled_keeps_player_empty(self):
        """fill_inner_voices=False 時, 空 player 保持空白."""
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange
        from core.arrangement_model import string_quartet_ensemble

        m21 = corpus.parse("corelli/opus3no1/1grave")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = arrange(score, string_quartet_ensemble(), fill_inner_voices=False)

        viola = next(
            p for p in arr.target_score.parts if p.part_id == "viola_1"
        )
        notes = [
            ev for m in viola.measures
            for v in m.voices.values()
            for ev in v.events
            if hasattr(ev, "pitch")
        ]
        assert len(notes) == 0, "fill 關閉時 viola 應該保持空白"

    def test_satb_sources_no_fill_needed(self):
        """4 個 source parts → 弦四, 每個 target 都有 assignment, fill 是 no-op."""
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange
        from core.arrangement_model import string_quartet_ensemble

        m21 = corpus.parse("bach/bwv66.6")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = arrange(score, string_quartet_ensemble())

        for tp in arr.target_score.parts:
            notes = [
                ev for m in tp.measures
                for v in m.voices.values()
                for ev in v.events
                if hasattr(ev, "pitch")
            ]
            assert len(notes) > 0, f"{tp.part_id} 不該空白 (4 sources 應對 4 targets)"

    def test_voice_leading_keeps_intervals_reasonable(self):
        """補完後相鄰音間的 interval 平均應小 (voice leading)."""
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange
        from core.arrangement_model import string_quartet_ensemble

        m21 = corpus.parse("corelli/opus3no1/1grave")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = arrange(score, string_quartet_ensemble())

        viola = next(
            p for p in arr.target_score.parts if p.part_id == "viola_1"
        )
        # 抓所有相鄰音 (跨 measure)
        midis = [
            ev.pitch.midi_number
            for m in viola.measures
            for v in m.voices.values()
            for ev in v.events
            if hasattr(ev, "pitch")
        ]
        if len(midis) < 5:
            pytest.skip("音太少, 無法評 voice leading")
        intervals = [abs(midis[i + 1] - midis[i]) for i in range(len(midis) - 1)]
        avg = sum(intervals) / len(intervals)
        # 平均 < 7 (五度) 表示 voice-leading 沒亂跳
        assert avg < 7, f"平均 interval {avg:.1f} 太大, voice-leading 不好"

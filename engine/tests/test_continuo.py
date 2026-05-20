"""Continuo realization 單元測試"""

from __future__ import annotations

import pytest


class TestContinuoRealization:
    def _build_corelli_arrangement(self, ensemble_name="baroque_trio_sonata"):
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange
        from core.arrangement_model import ENSEMBLE_TEMPLATES

        m21 = corpus.parse("corelli/opus3no1/1grave")
        score = parse_stream(m21)
        tag_all_sections(score)
        players = ENSEMBLE_TEMPLATES[ensemble_name]()
        return arrange(score, players)

    def test_baroque_trio_auto_realizes_continuo(self):
        """baroque_trio_sonata ensemble 改編後, harpsichord upper 應自動有和聲."""
        arr = self._build_corelli_arrangement("baroque_trio_sonata")
        upper = next(
            (p for p in arr.target_score.parts
             if p.part_id == "harpsichord_1_upper"),
            None,
        )
        assert upper is not None
        chords = [
            ev for m in upper.measures
            for v in m.voices.values()
            for ev in v.events
            if hasattr(ev, "pitches")
        ]
        assert len(chords) > 10, "continuo 應該生成多個和弦"

    def test_continuo_chords_in_harpsichord_range(self):
        """生成的和弦應在大鍵琴 upper staff comfortable range (~C4-G5)."""
        arr = self._build_corelli_arrangement()
        upper = next(
            p for p in arr.target_score.parts
            if p.part_id == "harpsichord_1_upper"
        )
        midis = [
            p.midi_number
            for m in upper.measures
            for v in m.voices.values()
            for ev in v.events
            if hasattr(ev, "pitches")
            for p in ev.pitches
        ]
        if not midis:
            pytest.skip("no chords generated")
        # upper staff: C3 (48) 以下太低, C6 (84) 以上太高
        assert min(midis) >= 48
        assert max(midis) <= 84

    def test_violin_harpsichord_ensemble_also_realizes(self):
        """violin_harpsichord ensemble (奏鳴曲) 也應自動 continuo realize."""
        arr = self._build_corelli_arrangement("violin_harpsichord")
        upper = next(
            (p for p in arr.target_score.parts
             if p.part_id == "harpsichord_1_upper"),
            None,
        )
        assert upper is not None
        chords = [
            ev for m in upper.measures
            for v in m.voices.values()
            for ev in v.events
            if hasattr(ev, "pitches")
        ]
        assert len(chords) > 5

    def test_non_harpsichord_ensemble_unaffected(self):
        """string_quartet 沒 harpsichord, continuo 不應觸發 (no-op)."""
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange
        from core.arrangement_model import string_quartet_ensemble

        m21 = corpus.parse("corelli/opus3no1/1grave")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = arrange(score, string_quartet_ensemble())
        # 沒 harpsichord part
        assert not any(
            "harpsichord" in p.part_id for p in arr.target_score.parts
        )

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


class TestFiguredBassMVP:
    """figured-bass parser + interpret 單元測試 (不需要實際 MusicXML 檔)."""

    def test_interpret_default_5_3(self):
        from core.baroque.figured_bass_parser import interpret_figure
        # 預設 / 5-3 / 5 → 不需特殊轉位, 回 None
        assert interpret_figure("") is None
        assert interpret_figure("5") is None
        assert interpret_figure("5/3") is None

    def test_interpret_first_inversion(self):
        from core.baroque.figured_bass_parser import interpret_figure
        assert interpret_figure("6") == (3, 6)
        assert interpret_figure("6/3") == (3, 6)

    def test_interpret_second_inversion(self):
        from core.baroque.figured_bass_parser import interpret_figure
        assert interpret_figure("6/4") == (4, 6)
        assert interpret_figure("64") == (4, 6)

    def test_interpret_seventh_chord(self):
        from core.baroque.figured_bass_parser import interpret_figure
        assert interpret_figure("7") == (3, 5, 7)

    def test_interpret_ignores_accidental(self):
        from core.baroque.figured_bass_parser import interpret_figure
        # MVP: # / b 忽略, 仍認得基本骨架
        assert interpret_figure("#6") == (3, 6)
        assert interpret_figure("b7") == (3, 5, 7)

    def test_interpret_unknown_returns_none(self):
        from core.baroque.figured_bass_parser import interpret_figure
        assert interpret_figure("9/7/5") is None
        assert interpret_figure("nonsense") is None

    def test_parse_returns_empty_for_missing_file(self):
        from core.baroque.figured_bass_parser import parse_figured_bass
        assert parse_figured_bass("/tmp/nonexistent-xyz.xml") == {}

    def test_parse_extracts_figures_from_inline_xml(self, tmp_path):
        """端對端 — 寫一個 minimal MusicXML 含 <figured-bass>, parser 應抽出."""
        from core.baroque.figured_bass_parser import parse_figured_bass
        from fractions import Fraction
        xml_path = tmp_path / "test.xml"
        xml_path.write_text(
            """<?xml version="1.0"?>
            <score-partwise>
              <part-list>
                <score-part id="P1"><part-name>Bass</part-name></score-part>
              </part-list>
              <part id="P1">
                <measure number="1">
                  <attributes><divisions>4</divisions></attributes>
                  <note>
                    <pitch><step>C</step><octave>3</octave></pitch>
                    <duration>4</duration>
                  </note>
                  <figured-bass>
                    <figure><figure-number>6</figure-number></figure>
                  </figured-bass>
                  <note>
                    <pitch><step>D</step><octave>3</octave></pitch>
                    <duration>4</duration>
                  </note>
                </measure>
              </part>
            </score-partwise>""",
            encoding="utf-8",
        )
        figures = parse_figured_bass(str(xml_path))
        # figure 在第一 note 後 (beat 1), 對應第二 note
        assert (1, Fraction(1)) in figures
        assert figures[(1, Fraction(1))] == "6"

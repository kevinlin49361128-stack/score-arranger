"""Voice-leading 平行五度 / 八度 偵測測試"""

from __future__ import annotations

from fractions import Fraction

from core.ir import Measure, NoteEvent, Part, Pitch, Score, Voice
from core.voice_leading import detect_parallel_motion


def _n(midi: int, onset: float) -> NoteEvent:
    return NoteEvent(
        pitch=Pitch(midi, f"n{midi}"),
        duration=Fraction(1),
        onset=Fraction(onset),
    )


def _two_part_score(
    a_events: list[NoteEvent], b_events: list[NoteEvent],
) -> Score:
    pa = Part(
        part_id="a", name_display="A", instrument_id="violin",
        measures=[Measure(
            number=1, time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=a_events)},
        )],
    )
    pb = Part(
        part_id="b", name_display="B", instrument_id="violin",
        measures=[Measure(
            number=1, time_signature=(4, 4),
            voices={1: Voice(voice_id=1, events=b_events)},
        )],
    )
    return Score(metadata={}, movements=[], parts=[pa, pb])


class TestParallelMotion:
    def test_parallel_fifths_detected(self):
        # C4→D4 上方, F3→G3 下方, 音程 7→7 半音
        score = _two_part_score(
            [_n(60, 0), _n(62, 1)],
            [_n(53, 0), _n(55, 1)],
        )
        issues = detect_parallel_motion(score)
        assert len(issues) == 1
        assert issues[0].result.code == "W_PARALLEL_FIFTHS"
        assert issues[0].severity == "warning"

    def test_parallel_octaves_detected(self):
        # C5→D5, C4→D4, 音程 12→12
        score = _two_part_score(
            [_n(72, 0), _n(74, 1)],
            [_n(60, 0), _n(62, 1)],
        )
        issues = detect_parallel_motion(score)
        assert len(issues) == 1
        assert issues[0].result.code == "W_PARALLEL_OCTAVES"

    def test_contrary_motion_clean(self):
        # 一升一降 → 不算平行
        score = _two_part_score(
            [_n(60, 0), _n(62, 1)],
            [_n(53, 0), _n(51, 1)],
        )
        assert detect_parallel_motion(score) == []

    def test_oblique_motion_clean(self):
        # 一部不動 → 斜向, 不算平行
        score = _two_part_score(
            [_n(60, 0), _n(62, 1)],
            [_n(53, 0), _n(53, 1)],
        )
        assert detect_parallel_motion(score) == []

    def test_static_no_issue(self):
        # 兩部都不動 → 不是動進
        score = _two_part_score(
            [_n(60, 0), _n(60, 1)],
            [_n(53, 0), _n(53, 1)],
        )
        assert detect_parallel_motion(score) == []

    def test_non_perfect_interval_clean(self):
        # 平行三度 (4 半音) → 不違規 (平行三/六度是允許的)
        score = _two_part_score(
            [_n(64, 0), _n(66, 1)],
            [_n(60, 0), _n(62, 1)],
        )
        assert detect_parallel_motion(score) == []

    def test_collect_issues_includes_parallel(self):
        """collect_issues 應整合 voice-leading 檢查."""
        from core.repair import collect_issues
        score = _two_part_score(
            [_n(60, 0), _n(62, 1)],
            [_n(53, 0), _n(55, 1)],
        )
        codes = {i.result.code for i in collect_issues(score)}
        assert "W_PARALLEL_FIFTHS" in codes

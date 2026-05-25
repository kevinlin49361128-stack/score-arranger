"""rehearsal_marks 0.1.38 — [A][B][C] 排練記號自動產生."""

from __future__ import annotations

from fractions import Fraction

from core.analyzer.rehearsal_marks import (
    _letter_for_index,
    _pick_mark_measures,
    insert_rehearsal_marks,
)
from core.ir import Measure, NoteEvent, Part, Pitch, Score, Voice


def _note(midi=60, dur=Fraction(1)) -> NoteEvent:
    return NoteEvent(
        pitch=Pitch(midi, "n"), duration=dur, onset=Fraction(0),
    )


def _score(n_measures: int) -> Score:
    """造一個 n_measures 小節的單聲部 score."""
    part = Part(
        part_id="violin_1", name_display="Violin", instrument_id="violin",
        measures=[
            Measure(
                number=i + 1,
                time_signature=(4, 4) if i == 0 else None,
                voices={1: Voice(voice_id=1, events=[_note(dur=Fraction(4))])},
            )
            for i in range(n_measures)
        ],
    )
    return Score(metadata={}, movements=[], parts=[part])


class TestLetters:
    def test_first_24_skip_io(self):
        # 跳 I (易混 1) / 跳 O (易混 0)
        # A B C D E F G H J K L M N P Q R S T U V W X Y Z (24 letters)
        # 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
        assert _letter_for_index(0) == "A"
        assert _letter_for_index(7) == "H"
        assert _letter_for_index(8) == "J"   # skip I
        assert _letter_for_index(12) == "N"
        assert _letter_for_index(13) == "P"  # skip O
        assert _letter_for_index(23) == "Z"

    def test_doubles_after_z(self):
        # 24 letters; index 24 → "AA"
        assert _letter_for_index(24) == "AA"
        assert _letter_for_index(25) == "AB"


class TestPickMarks:
    def test_short_score_no_marks(self):
        """< 8 小節不插."""
        assert _pick_mark_measures(7) == []
        assert _pick_mark_measures(4) == []

    def test_default_every_16(self):
        """48 小節 → m.17, m.33 (m.1 不算, 每 16 一個)."""
        marks = _pick_mark_measures(48)
        assert marks == [17, 33]

    def test_phrase_starts_used_when_few(self):
        """phrase_starts <= 15 個 → 直接用."""
        marks = _pick_mark_measures(32, phrase_starts=[5, 13, 21])
        assert marks == [5, 13, 21]

    def test_measure_1_filtered_out(self):
        """phrase_starts 含 m.1 → 過濾掉 (起點不需要 mark)."""
        marks = _pick_mark_measures(32, phrase_starts=[1, 9, 17])
        assert marks == [9, 17]

    def test_too_many_phrases_fallback_to_every_n(self):
        """>15 個樂句 → 退回 every-16."""
        many_phrases = list(range(2, 50, 2))  # 24 個樂句
        marks = _pick_mark_measures(48, phrase_starts=many_phrases)
        assert marks == [17, 33]  # 退回 every-16


class TestInsertMarks:
    def test_writes_to_all_parts_synced(self):
        """同一 measure number 在所有 part 都有同字母."""
        score = _score(32)
        # 加第二個 part 確保同步
        score.parts.append(Part(
            part_id="cello_1", name_display="Cello", instrument_id="cello",
            measures=[
                Measure(
                    number=i + 1, time_signature=None,
                    voices={1: Voice(voice_id=1, events=[
                        _note(dur=Fraction(4)),
                    ])},
                )
                for i in range(32)
            ],
        ))
        count = insert_rehearsal_marks(score)
        # 32 小節, 每 16 → m.17 = "A"
        assert count == 2  # 2 parts × 1 mark
        assert score.parts[0].measures[16].rehearsal_mark == "A"
        assert score.parts[1].measures[16].rehearsal_mark == "A"

    def test_does_not_overwrite_existing(self):
        """已有 rehearsal_mark 不覆蓋 (使用者可能手動標過)."""
        score = _score(32)
        score.parts[0].measures[16].rehearsal_mark = "Custom"
        insert_rehearsal_marks(score)
        assert score.parts[0].measures[16].rehearsal_mark == "Custom"

    def test_short_score_skipped(self):
        score = _score(5)
        count = insert_rehearsal_marks(score)
        assert count == 0

    def test_uses_phrase_starts(self):
        score = _score(40)
        # 假設樂句起點: m.9, m.17, m.25
        count = insert_rehearsal_marks(score, phrase_starts=[9, 17, 25])
        assert count == 3
        assert score.parts[0].measures[8].rehearsal_mark == "A"
        assert score.parts[0].measures[16].rehearsal_mark == "B"
        assert score.parts[0].measures[24].rehearsal_mark == "C"

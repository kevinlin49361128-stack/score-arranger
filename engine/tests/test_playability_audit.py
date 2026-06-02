"""B4: 可演奏性稽核 (playability_audit) 測試。"""
from fractions import Fraction

from core.arrangement_model import violin_piano_ensemble
from core.arranger import arrange
from core.ir import Measure, NoteEvent, Part, Pitch, Score, Voice
from core.parser import parse_musicxml
from core.playability_audit import audit_string_positions
from core.validator_dynamic import DynamicIssue


def _piano_only_score():
    note = NoteEvent(
        pitch=Pitch(midi_number=60, spelling="C4"),
        duration=Fraction(4), onset=Fraction(0),
    )
    measure = Measure(
        number=1, voices={1: Voice(voice_id=1, events=[note])},
        time_signature=(4, 4),
    )
    part = Part(
        part_id="piano_1", name_display="Piano",
        instrument_id="piano", measures=[measure],
    )
    return Score(parts=[part])


def test_audit_skips_non_string_parts():
    # 鋼琴沒有開放弦定義 → 稽核略過 → 0 個問題
    issues = audit_string_positions(_piano_only_score())
    assert issues == []


def test_audit_returns_dynamic_issues_on_real_arrangement():
    score = parse_musicxml(
        "core/sample_scores/mozart_k545_movement1_full.musicxml",
    )
    arr = arrange(score, violin_piano_ensemble())
    issues = audit_string_positions(arr.target_score, tempo_bpm=120.0)
    assert isinstance(issues, list)
    for i in issues:
        assert isinstance(i, DynamicIssue)
        # 與 LocatedIssue 相容的欄位 (前端共用序列化)
        assert hasattr(i, "part_id")
        assert hasattr(i, "measure_number")
        assert i.result.code in (
            "E_VIOLIN_POSITION_JUMP_TOO_FAST",
            "W_VIOLIN_POSITION_JUMP_DIFFICULT",
        )


def test_audit_faster_tempo_finds_at_least_as_many():
    # 快速 tempo 下換把時間更緊 → 問題數不應少於慢速
    score = parse_musicxml(
        "core/sample_scores/mozart_k545_movement1_full.musicxml",
    )
    arr = arrange(score, violin_piano_ensemble())
    slow = audit_string_positions(arr.target_score, tempo_bpm=60.0)
    fast = audit_string_positions(arr.target_score, tempo_bpm=200.0)
    assert len(fast) >= len(slow)

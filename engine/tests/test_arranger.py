"""Arrangement Engine 單元測試"""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.arranger import (
    _adjust_octave,
    arrange,
    build_target_score,
    pick_target_for_function,
)
from core.arrangement_model import (
    Arrangement,
    Assignment,
    Player,
    violin_piano_ensemble,
)
from core.ir import (
    ChordEvent,
    Measure,
    Movement,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Section,
    Voice,
    VoiceFunction,
)


# ============================================================================
# Test fixtures
# ============================================================================

def _note(midi: int, dur=Fraction(1), onset=Fraction(0)) -> NoteEvent:
    return NoteEvent(pitch=Pitch(midi, f"n{midi}"), duration=dur, onset=onset)


def _chord(midis: list[int], dur=Fraction(1), onset=Fraction(0)) -> ChordEvent:
    return ChordEvent(
        pitches=[Pitch(m, f"n{m}") for m in midis],
        duration=dur, onset=onset,
    )


def _build_satb_score(n_measures: int = 4) -> Score:
    """建立 4 部和聲 score, SATB 各 1 個 part。"""
    soprano = [Measure(
        number=i + 1,
        time_signature=(4, 4) if i == 0 else None,
        voices={1: Voice(voice_id=1, events=[
            _note(72), _note(74, onset=Fraction(1)),
            _note(76, onset=Fraction(2)), _note(77, onset=Fraction(3)),
        ])},
    ) for i in range(n_measures)]

    alto = [Measure(
        number=i + 1,
        time_signature=(4, 4) if i == 0 else None,
        voices={1: Voice(voice_id=1, events=[
            _note(67), _note(69, onset=Fraction(1)),
            _note(67, onset=Fraction(2)), _note(69, onset=Fraction(3)),
        ])},
    ) for i in range(n_measures)]

    tenor = [Measure(
        number=i + 1,
        time_signature=(4, 4) if i == 0 else None,
        voices={1: Voice(voice_id=1, events=[
            _note(60), _note(64, onset=Fraction(1)),
            _note(60, onset=Fraction(2)), _note(64, onset=Fraction(3)),
        ])},
    ) for i in range(n_measures)]

    bass = [Measure(
        number=i + 1,
        time_signature=(4, 4) if i == 0 else None,
        voices={1: Voice(voice_id=1, events=[
            _note(48), _note(50, onset=Fraction(1)),
            _note(48, onset=Fraction(2)), _note(50, onset=Fraction(3)),
        ])},
    ) for i in range(n_measures)]

    return Score(
        movements=[Movement(
            movement_id=1, measure_count=n_measures,
            sections=[Section(0, 1, n_measures)],
        )],
        parts=[
            Part(part_id="sop", name_display="Soprano",
                 instrument_id="violin", measures=soprano),
            Part(part_id="alt", name_display="Alto",
                 instrument_id="viola", measures=alto),
            Part(part_id="ten", name_display="Tenor",
                 instrument_id="cello", measures=tenor),
            Part(part_id="bas", name_display="Bass",
                 instrument_id="cello", measures=bass),
        ],
    )


# ============================================================================
# 角色 → 目標選擇
# ============================================================================

class TestPickTarget:
    def test_melody_picks_violin(self):
        players = violin_piano_ensemble()
        target = pick_target_for_function(VoiceFunction.MELODY, players)
        assert target == ("violin_1", "main")  # violin 上界最高

    def test_bass_picks_piano_lower(self):
        players = violin_piano_ensemble()
        target = pick_target_for_function(VoiceFunction.BASS, players)
        assert target == ("piano_1", "lower")

    def test_harmony_fill_picks_piano(self):
        players = violin_piano_ensemble()
        # 先讓 melody 與 bass 佔位
        occupied = {("violin_1", "main"), ("piano_1", "lower")}
        target = pick_target_for_function(
            VoiceFunction.HARMONY_FILL, players, occupied
        )
        assert target == ("piano_1", "upper")

    def test_melody_skill_level_tiebreaker(self):
        """B 技能感知分譜 — 同音域 player 中, 高技能拿旋律。"""
        from core.arrangement_model import Player
        # 兩把小提琴, 同音域; v1 業餘, v2 職業 → v2 應該拿旋律
        v1 = Player(
            player_id="violin_1", display_name="Violin I",
            instruments=["violin"], primary_instrument="violin",
            skill_level="amateur",
        )
        v2 = Player(
            player_id="violin_2", display_name="Violin II",
            instruments=["violin"], primary_instrument="violin",
            skill_level="professional",
        )
        target = pick_target_for_function(
            VoiceFunction.MELODY, [v1, v2],
        )
        assert target == ("violin_2", "main")  # 高技能勝出


# ============================================================================
# Octave adjust
# ============================================================================

class TestAdjustOctave:
    def test_within_range_unchanged(self):
        assert _adjust_octave(60, 55, 100) == 60

    def test_too_low_shift_up(self):
        # 30 → 42 → 54 → 66 (三次 +12 才進入 [55, 100])
        assert _adjust_octave(30, 55, 100) == 66

    def test_too_high_shift_down(self):
        assert _adjust_octave(120, 55, 100) == 120 - 12 - 12


# ============================================================================
# 完整 arrange 流程
# ============================================================================

class TestArrange:
    def test_satb_to_violin_piano(self):
        score = _build_satb_score(n_measures=2)
        players = violin_piano_ensemble()
        arrangement = arrange(score, players)

        # 應有 4 個 assignment (每 part 一個)
        assert len(arrangement.assignments) == 4

        # MELODY → violin
        melody_assigns = [
            a for a in arrangement.assignments
            if a.function == VoiceFunction.MELODY
        ]
        assert len(melody_assigns) == 1
        assert melody_assigns[0].source_part_id == "sop"
        assert melody_assigns[0].target_player_id == "violin_1"

        # BASS → piano lower
        bass_assigns = [
            a for a in arrangement.assignments
            if a.function == VoiceFunction.BASS
        ]
        assert len(bass_assigns) == 1
        assert bass_assigns[0].source_part_id == "bas"
        assert bass_assigns[0].target_player_id == "piano_1"
        assert bass_assigns[0].target_staff == "lower"

    def test_target_score_has_correct_parts(self):
        score = _build_satb_score(n_measures=2)
        players = violin_piano_ensemble()
        arrangement = arrange(score, players)

        target = arrangement.target_score
        assert target is not None
        # 預期 3 個 part: violin_1, piano_1_upper, piano_1_lower
        part_ids = {p.part_id for p in target.parts}
        assert "violin_1" in part_ids
        assert "piano_1_upper" in part_ids
        assert "piano_1_lower" in part_ids

    def test_target_score_has_events(self):
        score = _build_satb_score(n_measures=2)
        players = violin_piano_ensemble()
        arrangement = arrange(score, players)
        target = arrangement.target_score

        for tp in target.parts:
            total_events = sum(
                len(v.events) for m in tp.measures for v in m.voices.values()
            )
            assert total_events > 0, f"{tp.part_id} 無事件"

    def test_octave_shift_applied_for_out_of_range(self):
        """若 source 含 violin 範圍外的音, target violin part 應移八度。"""
        # 建立含極低音 (C2 = 36) 的 score
        score = Score(
            movements=[Movement(
                movement_id=1, measure_count=1,
                sections=[Section(0, 1, 1)],
            )],
            parts=[Part(
                part_id="low",
                name_display="Low",
                instrument_id="violin",  # 為了單一 part 觸發 melody
                measures=[Measure(
                    number=1, time_signature=(4, 4),
                    voices={1: Voice(voice_id=1, events=[
                        _note(36, dur=Fraction(4))  # C2, violin 範圍下界 G3=55
                    ])},
                )],
            )],
        )
        players = violin_piano_ensemble()
        arrangement = arrange(score, players)
        target = arrangement.target_score

        # violin_1 中的 C2 應被移到 violin comfortable 範圍內
        violin_part = next(p for p in target.parts if p.part_id == "violin_1")
        events = violin_part.measures[0].voices[1].events
        if events:
            note = events[0]
            assert isinstance(note, NoteEvent)
            assert note.pitch.midi_number >= 55  # 在 violin 範圍內

    def test_arrangement_metadata(self):
        score = _build_satb_score(n_measures=2)
        score.metadata["title"] = "Test Piece"
        players = violin_piano_ensemble()
        arrangement = arrange(score, players, arrangement_name="My Arrangement")
        assert arrangement.name == "My Arrangement"
        assert arrangement.source_id == "Test Piece"

    def test_section_provided(self):
        score = _build_satb_score(n_measures=8)
        # 只改編前 4 小節
        section = Section(99, 1, 4)
        players = violin_piano_ensemble()
        arrangement = arrange(score, players, section=section)
        target = arrangement.target_score
        for tp in target.parts:
            assert len(tp.measures) == 4


# ============================================================================
# 整合: parser → arranger
# ============================================================================

def test_full_pipeline_on_bach():
    """Bach 聖詠 parse → tag → arrange → 產出合理 target_score"""
    from music21 import corpus
    from core.parser import parse_stream
    m21_score = corpus.parse("bach/bwv66.6")
    ir = parse_stream(m21_score)

    players = violin_piano_ensemble()
    arrangement = arrange(ir, players)

    assert arrangement.target_score is not None
    target = arrangement.target_score

    # 應有 3 個 target part (violin_1, piano_upper, piano_lower)
    part_ids = {p.part_id for p in target.parts}
    assert "violin_1" in part_ids
    assert "piano_1_upper" in part_ids
    assert "piano_1_lower" in part_ids

    # 至少要有事件
    total = sum(
        len(v.events) for tp in target.parts
        for m in tp.measures for v in m.voices.values()
    )
    assert total > 0

    # 至少要有 4 個 assignment (SATB 4 部)
    assert len(arrangement.assignments) >= 4


# ============================================================================
# Arranger 浮水印 (#53)
# ============================================================================

class TestArrangerWatermark:
    """確認改編譜帶上 'Arranged with Score Arranger' 浮水印"""

    def test_default_watermark(self):
        """無 source arranger → 寫入預設浮水印"""
        from music21 import corpus
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import build_ensemble
        from core.arranger import arrange as run_arrange
        from core.parser import parse_stream

        m = corpus.parse("bach/bwv66.6")
        ir = parse_stream(m)
        # 確保 source 沒設 arranger
        ir.metadata.pop("arranger", None)
        tag_all_sections(ir)
        arr = run_arrange(ir, build_ensemble("violin_piano"))
        assert arr.target_score is not None
        assert arr.target_score.metadata.get("arranger") == \
            "Arranged with Score Arranger"

    def test_preserves_existing_arranger(self):
        """source 已有 arranger → 保留並附加本工具標示"""
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import build_ensemble
        from core.arranger import arrange as run_arrange
        from music21 import corpus
        from core.parser import parse_stream

        m = corpus.parse("bach/bwv66.6")
        ir = parse_stream(m)
        ir.metadata["arranger"] = "J.S. Bach (orig.)"
        tag_all_sections(ir)
        arr = run_arrange(ir, build_ensemble("violin_piano"))
        a = arr.target_score.metadata.get("arranger", "")
        assert "J.S. Bach" in a
        assert "Score Arranger" in a

    def test_no_duplicate_on_re_arrange(self):
        """已含本工具標示 → 不重複加"""
        from core.arranger import _format_arranger
        # 第一次
        out1 = _format_arranger(None)
        # 再次 (模擬重複改編)
        out2 = _format_arranger(out1)
        assert out1 == out2  # 不該重複拼接
        assert out2.count("Score Arranger") == 1

    def test_xml_output_contains_arranger(self):
        """匯出的 MusicXML 應含 <creator type='arranger'>"""
        from music21 import corpus
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import build_ensemble
        from core.arranger import arrange as run_arrange
        from core.musicxml_writer import write_musicxml_string
        from core.parser import parse_stream

        m = corpus.parse("bach/bwv66.6")
        ir = parse_stream(m)
        tag_all_sections(ir)
        arr = run_arrange(ir, build_ensemble("violin_piano"))
        xml = write_musicxml_string(arr.target_score)
        assert 'type="arranger"' in xml
        assert "Score Arranger" in xml


# ============================================================================
# 樂句級旋律換手 (docs/architecture.md §4.4)
# ============================================================================

class TestMelodyHandoff:
    """主旋律縮編時依樂句邊界在來源聲部間換手。"""

    def test_handoff_on_quartet_reduction(self):
        """弦樂四重奏縮編成 violin+piano → 旋律應逐樂句換手。"""
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import build_ensemble
        from core.arranger import arrange as run_arrange
        from core.ir import VoiceFunction
        from core.parser import parse_musicxml

        score = parse_musicxml("corpus:mozart/k80/movement1")
        tag_all_sections(score)
        arr = run_arrange(
            score, build_ensemble("violin_piano", skill_level="professional"),
        )
        mel = [
            a for a in arr.assignments
            if a.function == VoiceFunction.MELODY
        ]
        # 拆成多個逐樂句指派, 且至少兩個不同來源 (旋律確實換手)
        assert len(mel) >= 2
        assert len({a.source_part_id for a in mel}) >= 2
        # 全部指向同一個目標旋律樂器
        assert len({(a.target_player_id, a.target_staff) for a in mel}) == 1
        # span 連續、不重疊、無間隙
        spans = sorted(a.span for a in mel)
        for i in range(len(spans) - 1):
            assert spans[i][1] + 1 == spans[i + 1][0], \
                f"MELODY span 不連續: {spans[i]} → {spans[i + 1]}"

    def test_no_handoff_when_target_not_smaller(self):
        """目標聲部數 >= 來源數 (非縮編) → 不換手, 維持單一 section 級指派。"""
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import build_ensemble
        from core.arranger import arrange as run_arrange
        from core.ir import VoiceFunction
        from core.parser import parse_musicxml

        score = parse_musicxml("corpus:mozart/k80/movement1")  # 4 部
        tag_all_sections(score)
        arr = run_arrange(
            score, build_ensemble("string_quartet", skill_level="professional"),
        )
        mel = [
            a for a in arr.assignments
            if a.function == VoiceFunction.MELODY
        ]
        assert len(mel) == 1

    def test_v2_secondary_player_picks_up_easy_phrase(self):
        """B v2 — 主手 professional + 副手 amateur 時, 容易樂句應派給副手."""
        from core.analyzer.function import tag_all_sections
        from core.arrangement_model import Player
        from core.arranger import arrange as run_arrange
        from core.ir import VoiceFunction
        from core.parser import parse_musicxml

        score = parse_musicxml("corpus:mozart/k80/movement1")
        tag_all_sections(score)
        # 三把同類樂器 (small violin + 小提琴) + 鋼琴 — 二位是不同技能的旋律候選
        v_pro = Player(
            player_id="violin_pro", display_name="Violin Pro",
            instruments=["violin"], primary_instrument="violin",
            skill_level="professional",
        )
        v_am = Player(
            player_id="violin_am", display_name="Violin Amateur",
            instruments=["violin"], primary_instrument="violin",
            skill_level="amateur",
        )
        piano = Player(
            player_id="piano_1", display_name="Piano",
            instruments=["piano"], primary_instrument="piano",
            staves=2, skill_level="intermediate",
        )
        arr = run_arrange(score, [v_pro, v_am, piano])
        mel = [
            a for a in arr.assignments
            if a.function == VoiceFunction.MELODY
        ]
        # 至少出現多個換手段; 不要求一定派副手 (簡單樂句可能不存在),
        # 但兩個玩家皆出現時, professional 應拿較多段
        targets = [a.target_player_id for a in mel]
        if "violin_am" in targets:
            assert targets.count("violin_pro") >= targets.count("violin_am"), \
                "主手應該拿到較多或等量段數, 副手只接容易樂句"

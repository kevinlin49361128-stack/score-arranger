"""新增 ensemble templates (string_quartet / piano_solo) 的單元測試"""

from __future__ import annotations

from core.arrangement_model import (
    ENSEMBLE_TEMPLATES,
    baroque_trio_sonata_ensemble,
    build_ensemble,
    harpsichord_solo_ensemble,
    piano_solo_ensemble,
    string_quartet_ensemble,
    violin_harpsichord_ensemble,
    violin_piano_ensemble,
)


class TestEnsembleTemplates:
    def test_all_templates_registered(self):
        assert set(ENSEMBLE_TEMPLATES.keys()) >= {
            "violin_piano", "string_quartet", "piano_solo",
        }

    def test_build_ensemble_unknown_falls_back(self):
        # 未知 → 退回 violin_piano
        players = build_ensemble("nonexistent")
        assert len(players) == 2
        assert players[0].primary_instrument == "violin"

    def test_string_quartet_has_4_distinct_players(self):
        players = string_quartet_ensemble()
        assert len(players) == 4
        # 第二把 violin 用 violin_2 而非 violin_1
        ids = [p.player_id for p in players]
        assert len(set(ids)) == 4
        instruments = [p.primary_instrument for p in players]
        assert instruments == ["violin", "violin", "viola", "cello"]
        # 所有都是單譜號 (弦樂)
        assert all(p.staves == 1 for p in players)

    def test_piano_solo_single_player_two_staves(self):
        players = piano_solo_ensemble()
        assert len(players) == 1
        assert players[0].primary_instrument == "piano"
        assert players[0].staves == 2

    def test_violin_piano_unchanged(self):
        players = violin_piano_ensemble()
        assert len(players) == 2
        assert [p.primary_instrument for p in players] \
            == ["violin", "piano"]

    def test_harpsichord_solo_single_player_two_staves(self):
        players = harpsichord_solo_ensemble()
        assert len(players) == 1
        assert players[0].primary_instrument == "harpsichord"
        assert players[0].staves == 2

    def test_violin_harpsichord_baroque_pair(self):
        players = violin_harpsichord_ensemble()
        assert len(players) == 2
        assert [p.primary_instrument for p in players] \
            == ["violin", "harpsichord"]
        assert players[1].staves == 2

    def test_baroque_trio_sonata_four_players(self):
        players = baroque_trio_sonata_ensemble()
        assert len(players) == 4
        assert [p.primary_instrument for p in players] == [
            "violin", "violin", "cello", "harpsichord",
        ]


class TestArrangeWithNewEnsembles:
    """整合測試: 用 corpus 跑全流程, 確認每種 ensemble 不會炸。"""

    def test_arrange_string_quartet(self):
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange

        m21 = corpus.parse("bach/bwv66.6")
        score = parse_stream(m21)
        tag_all_sections(score)
        players = string_quartet_ensemble()
        arr = run_arrange(score, players)
        assert arr.target_score is not None
        assert len(arr.target_score.parts) == 4
        # 4 個 source part 應該都被分配
        assignment_targets = {a.target_player_id for a in arr.assignments}
        assert assignment_targets == {
            "violin_1", "violin_2", "viola_1", "cello_1",
        }

    def test_string_quartet_source_violin2_maps_to_target_violin2(self):
        """Regression: source 是弦樂四重奏時, violin II 必須對到 target
        violin_2, viola 對到 target viola_1 — 不可互換。"""
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange

        # Beethoven Op.18 No.1 自身就是弦樂四重奏 — 改編後配對應一對一
        m21 = corpus.parse("beethoven/opus18no1/movement1")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = run_arrange(score, string_quartet_ensemble())

        # 收集 source instrument → target player
        src_by_part = {p.part_id: p.instrument_id for p in score.parts}
        for a in arr.assignments:
            src_inst = src_by_part.get(a.source_part_id)
            target_player = next(
                p for p in arr.players if p.player_id == a.target_player_id
            )
            # 同樂器類型必須對應 (violin → violin, viola → viola, cello → cello)
            assert src_inst == target_player.primary_instrument, (
                f"source {a.source_part_id} ({src_inst}) "
                f"錯誤地對應到 {a.target_player_id} "
                f"({target_player.primary_instrument})"
            )

    def test_arrange_piano_solo(self):
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange

        m21 = corpus.parse("bach/bwv66.6")
        score = parse_stream(m21)
        tag_all_sections(score)
        players = piano_solo_ensemble()
        arr = run_arrange(score, players)
        assert arr.target_score is not None
        # 雙譜表 → 2 parts (upper + lower)
        assert len(arr.target_score.parts) == 2
        # 所有 assignment 都到同一個 player
        player_ids = {a.target_player_id for a in arr.assignments}
        assert player_ids == {"piano_1"}

    def test_arrange_harpsichord_solo(self):
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange
        from core.ir_to_music21 import ir_to_music21

        m21 = corpus.parse("bach/bwv66.6")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = run_arrange(score, harpsichord_solo_ensemble())
        assert arr.target_score is not None
        assert len(arr.target_score.parts) == 2
        assert {p.instrument_id for p in arr.target_score.parts} \
            == {"harpsichord"}
        # 確認可成功匯出 music21 (writer 不會炸)
        m21_out = ir_to_music21(arr.target_score)
        assert len(m21_out.parts) == 2

    def test_arrange_baroque_trio_sonata(self):
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange

        m21 = corpus.parse("bach/bwv66.6")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = run_arrange(score, baroque_trio_sonata_ensemble())
        assert arr.target_score is not None
        # 4 players (2 violins + cello + harpsichord 雙譜) = 5 parts
        assert len(arr.target_score.parts) == 5
        player_ids = {a.target_player_id for a in arr.assignments}
        assert "harpsichord_1" in player_ids

"""
撥弦樂器 (plucked) 單元測試 — 古典吉他 / 文藝復興魯特琴 / 音樂會踏板豎琴

涵蓋:
- 三個 profile 透過 get_profile 正確註冊
- 古典吉他: 跨非相鄰弦的六音和弦可行、低於最低弦的和弦被拒
- 魯特琴: 六組弦定弦 / 和弦檢查
- 豎琴: 同弦撞音 (C♮ + C♯) 報錯、一般和弦通過
- find_best_fingering 的 require_adjacent 參數: 預設 True 保留擦弦行為,
  False 允許撥弦樂器跨越未用弦
- 新 ensemble (guitar_solo / lute_solo / harp_solo / flute_guitar) 可建構
- 完整 arrange 到 guitar_solo / harp_solo 不會崩潰
"""

from __future__ import annotations

from core.arrangement_model import (
    ENSEMBLE_TEMPLATES,
    build_ensemble,
    flute_guitar_ensemble,
    guitar_solo_ensemble,
    harp_solo_ensemble,
    lute_solo_ensemble,
)
from core.instruments import (
    GUITAR_PROFILE,
    HARP_PROFILE,
    LUTE_PROFILE,
    check_guitar_chord,
    check_harp_chord,
    check_lute_chord,
    get_profile,
)
from core.instruments.fingering import find_best_fingering
from core.instruments.violin import VIOLIN_PROFILE
from core.ir import Pitch


# ============================================================================
# Registry — 三個 profile 都查得到
# ============================================================================

class TestPluckedRegistry:
    def test_guitar_registered(self):
        assert get_profile("guitar") is GUITAR_PROFILE

    def test_lute_registered(self):
        assert get_profile("lute") is LUTE_PROFILE

    def test_harp_registered(self):
        # "harp" 過去在 CANONICAL_IDS 但無 profile — 本次補上
        assert get_profile("harp") is HARP_PROFILE

    def test_all_plucked_family(self):
        for iid in ("guitar", "lute", "harp"):
            assert get_profile(iid).family == "plucked"

    def test_guitar_transposition_octave_down(self):
        # 古典吉他記譜比實音高八度 → 譜→實音 -12
        assert GUITAR_PROFILE.transposition == -12

    def test_lute_harp_no_transposition(self):
        assert LUTE_PROFILE.transposition == 0
        assert HARP_PROFILE.transposition == 0


# ============================================================================
# Classical Guitar
# ============================================================================

class TestGuitar:
    def test_open_strings(self):
        # E2 A2 D3 G3 B3 E4
        assert [s.open_pitch.midi_number for s in GUITAR_PROFILE.strings] \
            == [40, 45, 50, 55, 59, 64]

    def test_six_string_chord_ok(self):
        # 六根空弦同時撥 → 六音和弦, 撥弦樂器允許
        chord = [
            Pitch(40, "E2"), Pitch(45, "A2"), Pitch(50, "D3"),
            Pitch(55, "G3"), Pitch(59, "B3"), Pitch(64, "E4"),
        ]
        r = check_guitar_chord(chord)
        assert r.severity == "ok"

    def test_chord_across_non_adjacent_strings_ok(self):
        """關鍵: E2 + A4 只能落在第 0 弦與第 5 弦, 中間四弦被略過。
        擦弦樂器 (violin) 會因弦不相鄰而失敗, 撥弦樂器 (guitar) 可行。"""
        chord = [Pitch(40, "E2"), Pitch(69, "A4")]
        r = check_guitar_chord(chord)
        assert r.severity == "ok"
        # 對照: 同一組音用擦弦相鄰弦規則找不到指法
        violin_fing = find_best_fingering(
            chord, GUITAR_PROFILE.strings, max_fret=19, require_adjacent=True,
        )
        assert violin_fing is None

    def test_chord_below_lowest_string_rejected(self):
        # D2 (MIDI 38) 低於最低弦 E2 (40) → error
        chord = [Pitch(38, "D2"), Pitch(45, "A2")]
        r = check_guitar_chord(chord)
        assert r.severity == "error"
        assert r.code == "E_NOTE_BELOW_STRING"

    def test_single_note_below_range_rejected(self):
        # 單音 D2 委派音域檢查
        r = check_guitar_chord([Pitch(38, "D2")])
        assert r.severity == "error"
        assert r.code == "E_PITCH_BELOW_RANGE"

    def test_seven_notes_exceed(self):
        # 七音 > 六弦 → error
        chord = [Pitch(40 + i, f"n{i}") for i in range(7)]
        r = check_guitar_chord(chord)
        assert r.severity == "error"
        assert r.code == "E_STRING_CHORD_EXCEED"

    def test_single_note_in_range_ok(self):
        r = check_guitar_chord([Pitch(55, "G3")])
        assert r.severity == "ok"


# ============================================================================
# Renaissance Lute (6-course, G tuning)
# ============================================================================

class TestLute:
    def test_six_course_tuning(self):
        # G2 C3 F3 A3 D4 G4 — 間距 4-4-3-4-4 (不可與吉他相同)
        midis = [s.open_pitch.midi_number for s in LUTE_PROFILE.strings]
        assert midis == [43, 48, 53, 57, 62, 67]
        # 確認間距 pattern
        intervals = [midis[i + 1] - midis[i] for i in range(len(midis) - 1)]
        assert intervals == [5, 5, 4, 5, 5]

    def test_six_course_chord_ok(self):
        chord = [
            Pitch(43, "G2"), Pitch(48, "C3"), Pitch(53, "F3"),
            Pitch(57, "A3"), Pitch(62, "D4"), Pitch(67, "G4"),
        ]
        assert check_lute_chord(chord).severity == "ok"

    def test_below_lowest_course_rejected(self):
        # F2 (MIDI 41) 低於最低組弦 G2 (43)
        r = check_lute_chord([Pitch(41, "F2")])
        assert r.severity == "error"

    def test_too_many_notes(self):
        chord = [Pitch(43 + i, f"n{i}") for i in range(7)]
        r = check_lute_chord(chord)
        assert r.severity == "error"
        assert r.code == "E_STRING_CHORD_EXCEED"


# ============================================================================
# Concert Pedal Harp
# ============================================================================

class TestHarp:
    def test_no_string_list(self):
        # 豎琴採鍵盤式建模, 不給 StringDef 列表
        assert HARP_PROFILE.strings is None

    def test_same_string_collision_errors(self):
        """C♮4 與 C♯4 共用同一根 C 弦 → 不可同時發聲。"""
        r = check_harp_chord([Pitch(60, "C4"), Pitch(61, "C#4")])
        assert r.severity == "error"
        assert r.code == "E_HARP_SAME_STRING"
        # 建議改用等音拼寫
        assert any(s.code == "S_RESPELL_ENHARMONIC" for s in r.suggestions)

    def test_enharmonic_respell_avoids_collision(self):
        """C♯4 拼成 D♭4 → 落在 C 弦與 D 弦, 不再撞弦。"""
        r = check_harp_chord([Pitch(60, "C4"), Pitch(61, "Db4")])
        assert r.severity == "ok"

    def test_normal_triad_ok(self):
        r = check_harp_chord([Pitch(60, "C4"), Pitch(64, "E4"), Pitch(67, "G4")])
        assert r.severity == "ok"

    def test_same_letter_different_octave_ok(self):
        # C4 與 C5 是不同弦 (不同八度) → OK
        r = check_harp_chord([Pitch(60, "C4"), Pitch(72, "C5")])
        assert r.severity == "ok"

    def test_too_many_notes(self):
        # 9 音 > max_simultaneous_notes (8)
        chord = [
            Pitch(48, "C3"), Pitch(50, "D3"), Pitch(52, "E3"),
            Pitch(53, "F3"), Pitch(55, "G3"), Pitch(57, "A3"),
            Pitch(59, "B3"), Pitch(60, "C4"), Pitch(62, "D4"),
        ]
        r = check_harp_chord(chord)
        assert r.severity == "error"
        assert r.code == "E_HARP_TOO_MANY_NOTES"

    def test_single_note_in_range(self):
        assert check_harp_chord([Pitch(60, "C4")]).severity == "ok"


# ============================================================================
# find_best_fingering — require_adjacent 參數
# ============================================================================

class TestRequireAdjacent:
    # 在吉他指板上, E2 只能落第 0 弦 (空弦), A4 只能落第 5 弦 (E4 弦 fret 5);
    # 中間第 1-4 弦被略過 → 此和弦「必須」跨非相鄰弦才彈得出來。
    _SKIP_CHORD = [Pitch(40, "E2"), Pitch(69, "A4")]

    def test_default_require_adjacent_rejects_string_skip(self):
        """預設 require_adjacent=True — 擦弦規則: 弦必須相鄰, 略過弦的和弦無解。"""
        # 預設參數 (不傳 require_adjacent)
        result = find_best_fingering(
            self._SKIP_CHORD, GUITAR_PROFILE.strings, max_fret=19,
        )
        assert result is None

    def test_explicit_true_same_as_default(self):
        assert find_best_fingering(
            self._SKIP_CHORD, GUITAR_PROFILE.strings,
            max_fret=19, require_adjacent=True,
        ) is None

    def test_false_allows_string_skip(self):
        """require_adjacent=False — 允許跨越未用弦 (撥弦樂器)。"""
        result = find_best_fingering(
            self._SKIP_CHORD, GUITAR_PROFILE.strings,
            max_fret=19, require_adjacent=False,
        )
        assert result is not None

    def test_violin_adjacent_chord_unaffected(self):
        """Regression: 小提琴相鄰雙弦和弦在預設參數下仍正常找得到指法 —
        require_adjacent 預設值不可改變既有擦弦行為。"""
        chord = [Pitch(55, "G3"), Pitch(62, "D4")]
        # 不傳參數 = 預設 True
        assert find_best_fingering(
            chord, VIOLIN_PROFILE.strings, max_fret=24,
        ) is not None
        assert find_best_fingering(
            chord, VIOLIN_PROFILE.strings, max_fret=24, require_adjacent=True,
        ) is not None


# ============================================================================
# Ensemble templates
# ============================================================================

class TestPluckedEnsembles:
    def test_all_registered(self):
        assert {"guitar_solo", "lute_solo", "harp_solo", "flute_guitar"} \
            <= set(ENSEMBLE_TEMPLATES.keys())

    def test_guitar_solo_single_player_one_staff(self):
        players = guitar_solo_ensemble()
        assert len(players) == 1
        assert players[0].primary_instrument == "guitar"
        assert players[0].staves == 1

    def test_lute_solo_single_player_one_staff(self):
        players = lute_solo_ensemble()
        assert len(players) == 1
        assert players[0].primary_instrument == "lute"
        assert players[0].staves == 1

    def test_harp_solo_grand_staff(self):
        # 豎琴採大譜表 → 2 staff (與鋼琴相同)
        players = harp_solo_ensemble()
        assert len(players) == 1
        assert players[0].primary_instrument == "harp"
        assert players[0].staves == 2

    def test_flute_guitar_duo(self):
        players = flute_guitar_ensemble()
        assert len(players) == 2
        assert [p.primary_instrument for p in players] == ["flute", "guitar"]
        assert all(p.staves == 1 for p in players)

    def test_build_ensemble_guitar_solo(self):
        players = build_ensemble("guitar_solo")
        assert len(players) == 1
        assert players[0].primary_instrument == "guitar"


# ============================================================================
# 整合測試 — 完整 arrange 不崩潰
# ============================================================================

class TestArrangePlucked:
    def test_arrange_guitar_solo(self):
        from music21 import corpus
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange
        from core.parser import parse_stream

        m21 = corpus.parse("bach/bwv66.6")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = run_arrange(score, guitar_solo_ensemble())
        assert arr.target_score is not None
        assert len(arr.target_score.parts) == 1
        player_ids = {a.target_player_id for a in arr.assignments}
        assert player_ids == {"guitar_1"}

    def test_arrange_harp_solo(self):
        from music21 import corpus
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange
        from core.ir_to_music21 import ir_to_music21
        from core.parser import parse_stream

        m21 = corpus.parse("bach/bwv66.6")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = run_arrange(score, harp_solo_ensemble())
        assert arr.target_score is not None
        # 大譜表 → 2 parts (upper + lower)
        assert len(arr.target_score.parts) == 2
        assert {p.instrument_id for p in arr.target_score.parts} == {"harp"}
        # 確認可成功匯出 music21 (writer 不會炸)
        m21_out = ir_to_music21(arr.target_score)
        assert len(m21_out.parts) == 2

    def test_arrange_flute_guitar(self):
        from music21 import corpus
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange as run_arrange
        from core.parser import parse_stream

        m21 = corpus.parse("bach/bwv66.6")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = run_arrange(score, flute_guitar_ensemble())
        assert arr.target_score is not None
        assert len(arr.target_score.parts) == 2

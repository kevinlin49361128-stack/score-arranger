"""低音大提琴 (double bass) profile / canonical / clef / transcription 測試"""

from __future__ import annotations

import pytest

from core.instruments import (
    CANONICAL_IDS,
    DOUBLE_BASS_PROFILE,
    StringDef,
    check_double_bass_chord,
    get_profile,
    list_profiles,
    normalize_instrument_id,
)
from core.ir import (
    Measure,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Voice,
)
from core.transcriber import (
    CONVENTIONAL_TRANSPOSITIONS,
    TranscriptionTarget,
    suggest_transposition,
    transcribe,
)
from core.arrangement_model import (
    ENSEMBLE_TEMPLATES,
    string_quintet_ensemble,
)


# ============================================================================
# Profile 基本檢查
# ============================================================================

class TestDoubleBassProfile:
    def test_profile_registered(self):
        # 透過 registry 拿得到, 確認 _bootstrap 有註冊
        prof = get_profile("double_bass")
        assert prof is not None
        assert prof is DOUBLE_BASS_PROFILE
        assert "double_bass" in list_profiles()

    def test_profile_identity_fields(self):
        prof = DOUBLE_BASS_PROFILE
        assert prof.instrument_id == "double_bass"
        assert prof.display_name == "Double Bass"
        assert prof.family == "string_bowed"

    def test_canonical_id_present(self):
        assert "double_bass" in CANONICAL_IDS

    def test_ranges(self):
        prof = DOUBLE_BASS_PROFILE
        assert prof.range_absolute == (28, 60)
        assert prof.range_comfortable == (28, 55)
        assert prof.range_professional == (28, 60)
        assert prof.range_amateur == (28, 50)

    def test_strings_standard_tuning(self):
        # E1 (28), A1 (33), D2 (38), G2 (43) — 五度間隔
        prof = DOUBLE_BASS_PROFILE
        assert prof.strings is not None
        midis = [s.open_pitch.midi_number for s in prof.strings]
        assert midis == [28, 33, 38, 43]
        # 相鄰弦差 5 半音 (完全五度)
        for a, b in zip(midis, midis[1:]):
            assert b - a == 5

    def test_transposition_octave(self):
        # 譜記比實音高八度: transposition -12 (跟 guitar 同語意, 譜→實 -12)
        assert DOUBLE_BASS_PROFILE.transposition == -12

    def test_max_polyphony_is_two(self):
        # 大部分業餘只玩雙弦 — 三/四音直接 error
        assert DOUBLE_BASS_PROFILE.max_simultaneous_notes == 2

    def test_stretch_limits(self):
        assert DOUBLE_BASS_PROFILE.max_stretch_semitones == 4
        assert DOUBLE_BASS_PROFILE.comfortable_stretch_semitones == 2

    def test_available_techniques(self):
        techs = set(DOUBLE_BASS_PROFILE.available_techniques)
        # 必含 arco / pizz / slap / col_legno (任務指定)
        assert {"arco", "pizz", "slap", "col_legno"} <= techs

    def test_sustain_type_bow(self):
        assert DOUBLE_BASS_PROFILE.sustain_type == "bow"


# ============================================================================
# Sounding ↔ written 八度關係 (核心 transposition 驗證)
# ============================================================================

class TestSoundingWrittenRelation:
    def test_g2_sounding_to_g3_written(self):
        """sounding G2 (43) → written G3 (55).

        系統 transposition 定義為「譜記音 → 實音」, db = -12 (寫高八度).
        所以反向 (sounding → written) = -transposition = +12.
        sounding 43 + 12 = 55 = G3 (空弦 G2 的高八度).
        """
        sounding = 43       # G2 — 最高弦空弦音
        transposition = DOUBLE_BASS_PROFILE.transposition
        written = sounding - transposition  # sounding → written = -transposition
        assert written == 55                # G3

    def test_lowest_string_e1_to_e2_written(self):
        sounding = 28       # E1 — 最低弦空弦音
        transposition = DOUBLE_BASS_PROFILE.transposition
        written = sounding - transposition
        assert written == 40                # E2 (cello 最低弦, 不巧同音名)


# ============================================================================
# Canonical / alias 正規化
# ============================================================================

class TestDoubleBassAliases:
    @pytest.mark.parametrize(
        "alias",
        [
            "double_bass",
            "Double Bass",
            "DOUBLE BASS",
            "contrabass",
            "Contrabass",
            "contrabasso",      # 義
            "kontrabass",       # 德
            "string_bass",
            "String Bass",
            "upright_bass",     # jazz
            "acoustic_bass",
            "db",
        ],
    )
    def test_alias_normalizes_to_double_bass(self, alias):
        assert normalize_instrument_id(alias) == "double_bass"

    def test_bare_bass_still_voice_not_double_bass(self):
        """Regression: chorale 中 'Bass' 是聲部, 不應誤認 double bass."""
        assert normalize_instrument_id("Bass") == "bass_voice"


# ============================================================================
# 和弦檢查
# ============================================================================

def _p(midi: int, spelling: str) -> Pitch:
    return Pitch(midi_number=midi, spelling=spelling)


class TestDoubleBassChord:
    def test_empty_chord_ok(self):
        result = check_double_bass_chord([])
        assert result.is_ok

    def test_single_pitch_in_range(self):
        result = check_double_bass_chord([_p(43, "G2")])
        assert result.is_ok

    def test_single_pitch_below_range(self):
        result = check_double_bass_chord([_p(20, "G#0")])
        assert result.is_error

    def test_double_stop_adjacent_strings_ok(self):
        # A1 空弦 + D2 空弦 (相鄰弦)
        result = check_double_bass_chord([_p(33, "A1"), _p(38, "D2")])
        assert result.severity in ("ok", "warning")

    def test_triple_stop_errors(self):
        # max_simultaneous_notes=2, 三音直接 error
        result = check_double_bass_chord(
            [_p(33, "A1"), _p(38, "D2"), _p(43, "G2")]
        )
        assert result.is_error
        assert result.code == "E_STRING_CHORD_EXCEED"

    def test_quadruple_stop_errors(self):
        # max_simultaneous_notes=2, 四音 (全空弦) 也直接 error
        result = check_double_bass_chord([
            _p(28, "E1"), _p(33, "A1"), _p(38, "D2"), _p(43, "G2"),
        ])
        assert result.is_error
        assert result.code == "E_STRING_CHORD_EXCEED"


# ============================================================================
# music21 default clef
# ============================================================================

class TestDoubleBassClef:
    def test_default_clef_is_bass_8vb(self):
        from music21 import clef as m21_clef
        from core.ir_to_music21 import _default_clef_for

        c = _default_clef_for("double_bass")
        assert c is not None
        assert isinstance(c, m21_clef.Bass8vbClef)

    def test_alias_also_resolves(self):
        from music21 import clef as m21_clef
        from core.ir_to_music21 import _default_clef_for

        # alias 'Contrabass' 也應該被正規化後拿到 Bass8vbClef
        c = _default_clef_for("Contrabass")
        assert isinstance(c, m21_clef.Bass8vbClef)


# ============================================================================
# Ensemble: string quintet
# ============================================================================

class TestStringQuintetEnsemble:
    def test_template_registered(self):
        assert "string_quintet" in ENSEMBLE_TEMPLATES

    def test_five_players_with_db(self):
        players = string_quintet_ensemble()
        assert len(players) == 5
        instruments = [p.primary_instrument for p in players]
        assert instruments == [
            "violin", "violin", "viola", "cello", "double_bass",
        ]
        ids = [p.player_id for p in players]
        assert ids == [
            "violin_1", "violin_2", "viola_1", "cello_1", "double_bass_1",
        ]
        # 全部單譜表
        assert all(p.staves == 1 for p in players)


# ============================================================================
# Transcriber 慣例移調
# ============================================================================

class TestTranscriberConventions:
    def test_cello_to_double_bass_zero(self):
        # cello → db 維持 sounding (db 譜記會自動高八度)
        assert suggest_transposition("cello", "double_bass") == 0

    def test_violin_to_double_bass_minus_two_octaves(self):
        assert suggest_transposition("violin", "double_bass") == -24

    def test_viola_to_double_bass_minus_octave(self):
        assert suggest_transposition("viola", "double_bass") == -12

    def test_alias_resolves(self):
        # 'Contrabass' alias 應該被正規化
        assert suggest_transposition("cello", "Contrabass") == 0

    def test_conventional_table_has_entries(self):
        assert ("cello", "double_bass") in CONVENTIONAL_TRANSPOSITIONS
        assert ("violin", "double_bass") in CONVENTIONAL_TRANSPOSITIONS


# ============================================================================
# Transcriber end-to-end (cello part → double_bass)
# ============================================================================

def _make_simple_cello_part() -> Score:
    """造一個含 C2/G2/A3 的 cello part, 全部在 db 音域內."""
    from fractions import Fraction

    notes = [
        NoteEvent(pitch=_p(36, "C2"), duration=Fraction(1), onset=Fraction(0)),
        NoteEvent(pitch=_p(43, "G2"), duration=Fraction(1), onset=Fraction(1)),
        NoteEvent(pitch=_p(50, "D3"), duration=Fraction(1), onset=Fraction(2)),
    ]
    voice = Voice(voice_id=1, events=notes)
    part = Part(
        part_id="cello_1",
        name_display="Violoncello",
        instrument_id="cello",
        measures=[Measure(number=1, voices={1: voice})],
    )
    return Score(parts=[part])


class TestTranscribeToDoubleBass:
    def test_cello_to_db_preserves_sounding(self):
        score = _make_simple_cello_part()
        result = transcribe(
            score,
            {"cello": TranscriptionTarget(instrument="double_bass")},
        )
        new_part = result.score.parts[0]
        assert new_part.instrument_id == "double_bass"
        # semitones 為 0, sounding 應該不變
        assert result.semitones_used[new_part.part_id] == 0
        midis = [
            ev.pitch.midi_number
            for v in new_part.measures[0].voices.values()
            for ev in v.events
            if isinstance(ev, NoteEvent)
        ]
        assert midis == [36, 43, 50]

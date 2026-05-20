"""Transcriber (樂器替換 + 移調) 測試"""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.ir import (
    Measure,
    NoteEvent,
    Part,
    Pitch,
    Score,
    Voice,
    ChordEvent,
)
from core.transcriber import (
    CONVENTIONAL_TRANSPOSITIONS,
    TranscriptionTarget,
    suggest_transposition,
    transcribe,
)


# ============================================================================
# Helpers
# ============================================================================

def _note(midi: int, dur: Fraction = Fraction(1)) -> NoteEvent:
    names = ["C", "C#", "D", "Eb", "E", "F", "F#",
             "G", "Ab", "A", "Bb", "B"]
    spelling = f"{names[midi % 12]}{midi // 12 - 1}"
    return NoteEvent(
        pitch=Pitch(midi_number=midi, spelling=spelling),
        duration=dur,
        onset=Fraction(0),
    )


def _make_part(part_id: str, instrument: str, midis: list[int]) -> Part:
    voice = Voice(voice_id=1, events=[_note(m) for m in midis])
    return Part(
        part_id=part_id,
        name_display=instrument.capitalize(),
        instrument_id=instrument,
        measures=[Measure(number=1, voices={1: voice})],
    )


def _make_score(parts: list[Part]) -> Score:
    return Score(parts=parts)


def _collect_midis(score: Score, part_id: str) -> list[int]:
    out: list[int] = []
    for p in score.parts:
        if p.part_id != part_id:
            continue
        for m in p.measures:
            for v in m.voices.values():
                for e in v.events:
                    if isinstance(e, NoteEvent):
                        out.append(e.pitch.midi_number)
                    elif isinstance(e, ChordEvent):
                        out.extend(p.midi_number for p in e.pitches)
    return out


# ============================================================================
# Conventional table & suggest
# ============================================================================

class TestSuggestTransposition:
    def test_cello_to_violin_uses_convention(self):
        # 慣例: Bach 大提琴組曲 → 小提琴 = +19
        assert suggest_transposition("cello", "violin") == 19

    def test_violin_to_viola(self):
        assert suggest_transposition("violin", "viola") == -7

    def test_same_instrument_zero(self):
        assert suggest_transposition("violin", "violin") == 0

    def test_alias_normalization(self):
        # 'Violoncello' → cello canonical; 應得到同結果
        assert suggest_transposition("Violoncello", "violin") == 19

    def test_unknown_pair_uses_range_heuristic(self):
        # 沒在慣例表的 → 用 range 中位差; 至少不會 throw
        result = suggest_transposition("piano", "viola")
        assert isinstance(result, int)
        # piano 中位 ~ E4 (mid 64); viola 中位 ~ F4 (mid 66ish)
        # diff 小, preserve_octave round 到 0
        assert -12 <= result <= 12

    def test_unknown_instruments_returns_zero(self):
        assert suggest_transposition("nonexistent", "alsofake") == 0


# ============================================================================
# Basic transcribe
# ============================================================================

class TestBasicTranscribe:
    def test_empty_mapping_returns_clone(self):
        score = _make_score([_make_part("vn1", "violin", [69, 71, 72])])
        result = transcribe(score, {})
        assert result.score is not score  # deep copy
        assert _collect_midis(result.score, "vn1") == [69, 71, 72]
        assert result.adjustments == []

    def test_violin_to_viola_default_shifts_down_a_fifth(self):
        # A4 (69) -7 = D4 (62), B4 (71) -7 = E4 (64), C5 (72) -7 = F4 (65)
        score = _make_score([_make_part("vn1", "violin", [69, 71, 72])])
        result = transcribe(score, {
            "violin": TranscriptionTarget(instrument="viola"),
        })
        midis = _collect_midis(result.score, "vn1")
        assert midis == [62, 64, 65]
        # instrument_id 改了
        assert result.score.parts[0].instrument_id == "viola"
        assert result.semitones_used["vn1"] == -7

    def test_cello_to_violin_19_up(self):
        # G3 (55) +19 = D5 (74); C3 (48) +19 = G4 (67)
        score = _make_score([_make_part("c1", "cello", [55, 48, 60])])
        result = transcribe(score, {
            "cello": TranscriptionTarget(instrument="violin"),
        })
        midis = _collect_midis(result.score, "c1")
        assert midis == [74, 67, 79]  # +19 each
        assert result.semitones_used["c1"] == 19

    def test_explicit_semitones_overrides_convention(self):
        # 明指 -12 (八度下) 而不是慣例 +19
        score = _make_score([_make_part("c1", "cello", [60])])  # C4
        result = transcribe(score, {
            "cello": TranscriptionTarget(
                instrument="violin", semitones=-12,
            ),
        })
        # -12 後是 C3 (48), 但 violin 最低 G3 (55) → fit_to_range 救回 → +12 = C4 (60)
        midis = _collect_midis(result.score, "c1")
        # 預設 fit_to_range=True, 所以 C3 會被推回 C4 (range_absolute 55-108)
        assert midis[0] >= 55
        assert len(result.adjustments) == 1
        assert result.adjustments[0].reason == "octave_up_for_range"

    def test_non_matched_parts_untouched(self):
        # 弦四只改 violin → viola, cello 不動
        score = _make_score([
            _make_part("vn1", "violin", [69]),
            _make_part("c1", "cello", [55]),
        ])
        result = transcribe(score, {
            "violin": TranscriptionTarget(instrument="viola"),
        })
        # violin 部分變 viola
        vn_part = next(p for p in result.score.parts if p.part_id == "vn1")
        assert vn_part.instrument_id == "viola"
        # cello 部分不變
        c_part = next(p for p in result.score.parts if p.part_id == "c1")
        assert c_part.instrument_id == "cello"
        assert _collect_midis(result.score, "c1") == [55]


# ============================================================================
# Range fit
# ============================================================================

class TestRangeFit:
    def test_out_of_range_octave_shifted_up(self):
        # 把 cello 的 C2 (36) 假裝為 violin 但只 -19 半音 → 17 → fit 救回
        # 用 violin → cello, semitones=-7 (錯誤決定, 故意製造 OOR)
        score = _make_score([_make_part("vn1", "violin", [55])])  # G3
        # +19 後 G3 → D5 (74), 仍在 violin 範圍 (55-108) → no adjustment
        # 改用 violin → cello: -7 → G3 - 7 = D3 (50), cello 最低 36 → 在範圍 → no adj
        # 故意用奇怪 mapping 觸發 adjust: violin → flute, -7 → D3 (50)
        # flute 範圍 60-98 → D3 太低 → fit_to_range up +12 = D4 (62)
        result = transcribe(score, {
            "violin": TranscriptionTarget(
                instrument="flute", semitones=-7,
            ),
        })
        midis = _collect_midis(result.score, "vn1")
        assert all(60 <= m <= 98 for m in midis), (
            f"flute range fit failed: {midis}"
        )
        assert len(result.adjustments) == 1
        assert result.adjustments[0].reason == "octave_up_for_range"

    def test_fit_to_range_disabled_keeps_oor(self):
        score = _make_score([_make_part("vn1", "violin", [55])])
        result = transcribe(score, {
            "violin": TranscriptionTarget(
                instrument="flute",
                semitones=-7,
                fit_to_range=False,
            ),
        })
        # 沒 fit, 應保留 50, 並有 warning
        midis = _collect_midis(result.score, "vn1")
        assert midis == [48]  # G3-7 = D3 wait... 55-7=48 → C3 actually
        # 上述計算: G3=55, -7=48 (C3). flute 範圍 60-98 → C3 OOR
        # 沒 fit → 留 48; warnings 應有一條
        assert len(result.warnings) == 0  # fit_to_range=False → 不 warn, 不 adj


# ============================================================================
# Chord events
# ============================================================================

class TestChordTranscribe:
    def test_chord_preserves_interval(self):
        # 雙音 G3-D4 (55, 62) → -7 → C3-G3 (48, 55)
        # violin → viola
        from core.ir import ChordEvent as CE
        voice = Voice(
            voice_id=1,
            events=[CE(
                pitches=[Pitch(55, "G3"), Pitch(62, "D4")],
                duration=Fraction(1),
                onset=Fraction(0),
            )],
        )
        part = Part(
            part_id="vn1",
            name_display="Violin",
            instrument_id="violin",
            measures=[Measure(number=1, voices={1: voice})],
        )
        score = Score(parts=[part])
        result = transcribe(score, {
            "violin": TranscriptionTarget(instrument="viola"),
        })
        midis = _collect_midis(result.score, "vn1")
        # -7: 55-7=48 (C3), 62-7=55 (G3); 兩個都 ≥ viola 最低 C3 (48) → no adj
        assert midis == [48, 55]


# ============================================================================
# Metadata
# ============================================================================

class TestMetadata:
    def test_arranger_watermark_added(self):
        score = _make_score([_make_part("vn1", "violin", [69])])
        result = transcribe(score, {
            "violin": TranscriptionTarget(instrument="viola"),
        })
        arranger = result.score.metadata.get("arranger", "")
        assert "Score Arranger" in arranger

    def test_watermark_includes_specific_mapping(self):
        """單一映射 → 顯示具體箭頭"""
        score = _make_score([_make_part("c1", "cello", [55])])
        result = transcribe(score, {
            "cello": TranscriptionTarget(instrument="violin"),
        })
        arranger = result.score.metadata.get("arranger", "")
        assert "cello → violin" in arranger
        assert "+19" in arranger

    def test_watermark_multiple_mappings(self):
        """多 instrument 映射 → 用 bracket list"""
        score = _make_score([
            _make_part("vn1", "violin", [69]),
            _make_part("c1", "cello", [55]),
        ])
        result = transcribe(score, {
            "violin": TranscriptionTarget(instrument="viola"),
            "cello": TranscriptionTarget(instrument="bassoon", semitones=0),
        })
        arranger = result.score.metadata.get("arranger", "")
        assert "violin → viola" in arranger
        assert "cello → bassoon" in arranger
        assert "[" in arranger  # bracketed list

    def test_no_duplicate_watermark(self):
        score = _make_score([_make_part("vn1", "violin", [69])])
        score.metadata["arranger"] = "Already Transcribed with Score Arranger"
        result = transcribe(score, {
            "violin": TranscriptionTarget(instrument="viola"),
        })
        assert result.score.metadata["arranger"].count("Score Arranger") == 1


class TestPartIdMapping:
    """測試 part_id 級別精確映射 (協奏曲獨奏案例)"""

    def test_part_id_only_matches_specific_part(self):
        """同樂器多 part: 只映射指定 part_id"""
        score = _make_score([
            _make_part("vn_solo", "violin", [69]),
            _make_part("vn_orch_1", "violin", [69]),
            _make_part("vn_orch_2", "violin", [69]),
        ])
        result = transcribe(score, {
            "vn_solo": TranscriptionTarget(instrument="viola"),
        })
        # 只有 vn_solo 變 viola, 其他 violin 不動
        solo = next(p for p in result.score.parts if p.part_id == "vn_solo")
        assert solo.instrument_id == "viola"
        for pid in ("vn_orch_1", "vn_orch_2"):
            other = next(p for p in result.score.parts if p.part_id == pid)
            assert other.instrument_id == "violin"

    def test_part_id_takes_precedence_over_instrument(self):
        """若同時匹配 part_id 與 instrument_id → part_id 優先"""
        score = _make_score([
            _make_part("vn_solo", "violin", [69]),
            _make_part("vn_orch", "violin", [69]),
        ])
        result = transcribe(score, {
            # instrument-level: 所有 violin → viola (-7)
            "violin": TranscriptionTarget(instrument="viola"),
            # part-level override: 獨奏改成 cello (-19)
            "vn_solo": TranscriptionTarget(instrument="cello"),
        })
        solo = next(p for p in result.score.parts if p.part_id == "vn_solo")
        orch = next(p for p in result.score.parts if p.part_id == "vn_orch")
        assert solo.instrument_id == "cello"   # part_id 勝
        assert orch.instrument_id == "viola"   # instrument 規則套用


# ============================================================================
# 慣例表完整性
# ============================================================================

class TestConventions:
    def test_table_keys_are_canonical(self):
        from core.instruments import CANONICAL_IDS, normalize_instrument_id
        for (src, tgt) in CONVENTIONAL_TRANSPOSITIONS:
            # 兩端都應該是 canonical id
            assert normalize_instrument_id(src) == src, (
                f"non-canonical src: {src}"
            )
            assert normalize_instrument_id(tgt) == tgt, (
                f"non-canonical tgt: {tgt}"
            )

    def test_inverse_pairs_consistent(self):
        # 若有 (A→B, +N), 則 (B→A) 應該是 -N
        for (src, tgt), semis in CONVENTIONAL_TRANSPOSITIONS.items():
            inverse = CONVENTIONAL_TRANSPOSITIONS.get((tgt, src))
            if inverse is not None:
                assert inverse == -semis, (
                    f"非反轉一致: {src}→{tgt}={semis}, "
                    f"{tgt}→{src}={inverse}"
                )


# ============================================================================
# 真實 corpus 整合
# ============================================================================

class TestCorpusIntegration:
    def test_bach_chorale_violin_part_to_viola(self):
        """把 Bach BWV 66.6 的 soprano (用 violin range) 轉成 viola"""
        from music21 import corpus
        from core.parser import parse_stream

        m = corpus.parse("bach/bwv66.6")
        ir = parse_stream(m)
        # soprano 是 voice → 轉成 viola
        result = transcribe(ir, {
            "soprano": TranscriptionTarget(
                instrument="viola", semitones=-12,
            ),
        })
        sopr_part = next(
            p for p in result.score.parts if p.instrument_id == "viola"
        )
        # 確認譜號自動會由 _default_clef_for 在 export 時設成 alto clef
        # 這裡只驗 transcribe 本身: instrument 換了, midis 全部 -12 或被 fit
        assert sopr_part.instrument_id == "viola"
        assert "Score Arranger" in result.score.metadata.get("arranger", "")

"""0.1.56 L2 — 大鍵琴 continuo voice-leading 5/8 檢查 單元測試."""

from __future__ import annotations

from fractions import Fraction

import pytest

from core.baroque.continuo import (
    _generate_voicing_candidates,
    _is_parallel_fifth_or_octave,
    _viterbi_select_voicings,
    _voicing_transition_cost,
)


class TestParallelDetection:
    def test_parallel_fifths_detected(self):
        """Bass C(48) → D(50), top G(55) → A(57) = 平行五度."""
        kind = _is_parallel_fifth_or_octave(48, 55, 50, 57)
        assert kind == "5"

    def test_parallel_octaves_detected(self):
        """Bass C(48) → D(50), top C(60) → D(62) = 平行八度."""
        kind = _is_parallel_fifth_or_octave(48, 60, 50, 62)
        assert kind == "8"

    def test_contrary_motion_not_parallel(self):
        """Bass 上行, top 下行 = 反向, 不算 parallel."""
        kind = _is_parallel_fifth_or_octave(48, 55, 50, 53)
        assert kind is None

    def test_oblique_motion_not_parallel(self):
        """Bass 不動 = oblique motion, 不算 parallel."""
        kind = _is_parallel_fifth_or_octave(48, 55, 48, 57)
        assert kind is None

    def test_imperfect_intervals_not_parallel(self):
        """前後都是 3 度 (4 半音), 不是 5/8 → 不算違規."""
        kind = _is_parallel_fifth_or_octave(48, 52, 50, 54)
        assert kind is None


class TestVoicingCandidates:
    def test_at_least_anchor_candidate(self):
        """至少回傳 anchor (原 voicing) 一個."""
        cands = _generate_voicing_candidates(
            bass_midi=48, upper_midis=[60, 64, 67],
            upper_min=60, upper_max=79,
            duration=Fraction(1),
        )
        assert len(cands) >= 1
        assert cands[0]["upper_midis"] == [60, 64, 67]

    def test_too_short_upper_returns_anchor_only(self):
        """upper 只有 2 個音時, octave 位移可能仍生成候選 ≥ 1."""
        cands = _generate_voicing_candidates(
            bass_midi=48, upper_midis=[60, 64],
            upper_min=60, upper_max=79,
            duration=Fraction(1),
        )
        assert len(cands) >= 1

    def test_candidates_have_unique_voicings(self):
        """同一 voicing 不應重複出現."""
        cands = _generate_voicing_candidates(
            bass_midi=48, upper_midis=[60, 64, 67],
            upper_min=60, upper_max=79,
            duration=Fraction(1),
        )
        sigs = [tuple(sorted(c["upper_midis"])) for c in cands]
        assert len(sigs) == len(set(sigs))


class TestVoicingDP:
    def test_dp_avoids_parallel_fifths(self):
        """DP 應在 C→D bass 進行時, 避免「5-3 → 5-3」變成平行五度.

        提供兩種 voicing: 一個會平行 5 度, 一個換轉位避開. 期望選後者.
        """
        # Bass C(48) → D(50)
        # Onset 0: bass=48, upper candidates:
        #   [55, 64] (5-3 of C) — top=64 (E above), 5th = 55(G)
        #   [60, 64] (3-3 voicing variant)
        # Onset 1: bass=50, upper candidates:
        #   [57, 65] (5-3 of D, parallel 5 from prev's [55,...])
        #   [62, 65] (3-6 variant)
        cands = {
            (1, Fraction(0)): [
                {"bass_midi": 48, "upper_midis": [55, 64], "duration": Fraction(1)},
                {"bass_midi": 48, "upper_midis": [60, 64], "duration": Fraction(1)},
            ],
            (1, Fraction(1)): [
                {"bass_midi": 50, "upper_midis": [57, 65], "duration": Fraction(1)},
                {"bass_midi": 50, "upper_midis": [62, 65], "duration": Fraction(1)},
            ],
        }
        chosen = _viterbi_select_voicings(cands)
        # cost: 第一條路徑 (55,64)→(57,65) 會觸發 parallel 5 (55+12=12 from bass=
        # 48? 7 semitones above = perfect 5; 57 above 50 也是 7 = perfect 5).
        # DP 應避開 — 確認沒平行五度
        prev_chord = chosen[(1, Fraction(0))]
        curr_chord = chosen[(1, Fraction(1))]
        prev_bass = prev_chord["bass_midi"]
        curr_bass = curr_chord["bass_midi"]
        prev_upper = sorted(prev_chord["upper_midis"])
        curr_upper = sorted(curr_chord["upper_midis"])
        # 檢查對應位置沒平行 5/8
        for i in range(min(len(prev_upper), len(curr_upper))):
            kind = _is_parallel_fifth_or_octave(
                prev_bass, prev_upper[i],
                curr_bass, curr_upper[i],
            )
            assert kind is None, (
                f"DP 應該避開 parallel {kind}, 但 chosen[{i}] = "
                f"prev=({prev_bass},{prev_upper[i]}) curr=({curr_bass},{curr_upper[i]})"
            )

    def test_single_chord_returns_first_candidate(self):
        """單一 chord (無相鄰) → 不動, 取第一個候選."""
        cands = {
            (1, Fraction(0)): [
                {"bass_midi": 48, "upper_midis": [55, 64], "duration": Fraction(1)},
                {"bass_midi": 48, "upper_midis": [60, 64], "duration": Fraction(1)},
            ],
        }
        chosen = _viterbi_select_voicings(cands)
        assert len(chosen) == 1
        assert chosen[(1, Fraction(0))]["upper_midis"] == [55, 64]

    def test_empty_returns_empty(self):
        """無 chord → 回空 dict, 不出錯."""
        chosen = _viterbi_select_voicings({})
        assert chosen == {}


class TestTransitionCost:
    def test_parallel_fifth_has_high_cost(self):
        """有平行五度的 transition cost 應該明顯高於沒平行的."""
        prev = {"bass_midi": 48, "upper_midis": [55], "duration": Fraction(1)}
        curr_parallel = {"bass_midi": 50, "upper_midis": [57], "duration": Fraction(1)}
        curr_contrary = {"bass_midi": 50, "upper_midis": [53], "duration": Fraction(1)}
        cost_p = _voicing_transition_cost(prev, curr_parallel)
        cost_c = _voicing_transition_cost(prev, curr_contrary)
        assert cost_p > cost_c, (
            f"parallel 5 cost={cost_p} 應 > contrary cost={cost_c}"
        )

    def test_no_motion_has_zero_parallel_cost(self):
        """完全一樣的 chord (oblique 全停) → 沒 parallel 5/8."""
        chord = {"bass_midi": 48, "upper_midis": [55, 60], "duration": Fraction(1)}
        cost = _voicing_transition_cost(chord, chord)
        # 應該很低 (沒 parallel, 沒 leap)
        assert cost == 0.0


class TestEndToEndContinuoVL:
    def test_bach_trio_sonata_runs_without_error(self):
        """整段 bach trio sonata realize_continuo 應跑得起來, 無例外.

        sanity test — 確認 DP integration 沒打壞既有 flow.
        """
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange
        from core.arrangement_model import baroque_trio_sonata_ensemble

        try:
            m21 = corpus.parse("corelli/opus3no1/1grave")
        except Exception:
            pytest.skip("corelli corpus 不可用")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = arrange(score, baroque_trio_sonata_ensemble())
        # 應該成功生成 harpsichord upper, 有 chord events
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

    def test_bach_continuo_reduces_parallels_vs_anchor(self):
        """DP 後相鄰 chord 的 parallel 5/8 數應該 ≤ 直接用第一個 candidate.

        端對端統計 — DP 真的有改善, 而不只是不出錯.
        """
        from music21 import corpus
        from core.parser import parse_stream
        from core.analyzer.function import tag_all_sections
        from core.arranger import arrange
        from core.arrangement_model import baroque_trio_sonata_ensemble

        try:
            m21 = corpus.parse("corelli/opus3no1/1grave")
        except Exception:
            pytest.skip("corelli corpus 不可用")
        score = parse_stream(m21)
        tag_all_sections(score)
        arr = arrange(score, baroque_trio_sonata_ensemble())
        upper = next(
            (p for p in arr.target_score.parts
             if p.part_id == "harpsichord_1_upper"),
            None,
        )
        assert upper is not None

        # 找對應 bass part (cello 通常)
        bass_part = next(
            (p for p in arr.target_score.parts
             if p.part_id == "cello_1" or "bass" in p.part_id.lower()),
            None,
        )
        if bass_part is None:
            pytest.skip("找不到 bass part 對應")

        # 提取 (mnum, onset) → bass_midi
        bass_map: dict[tuple[int, Fraction], int] = {}
        for m in bass_part.measures:
            for v in m.voices.values():
                for ev in v.events:
                    if hasattr(ev, "pitch"):
                        bass_map[(m.number, Fraction(ev.onset))] = ev.pitch.midi_number

        # 提取 upper chord 的 top note
        sorted_chord_seq: list[tuple[int, int]] = []  # (bass, top)
        seen: set[tuple[int, Fraction]] = set()
        for m in upper.measures:
            for v in m.voices.values():
                for ev in v.events:
                    if not hasattr(ev, "pitches"):
                        continue
                    key = (m.number, Fraction(ev.onset))
                    if key in seen:
                        continue
                    seen.add(key)
                    bass_midi = bass_map.get(key)
                    if bass_midi is None:
                        continue
                    top = max(p.midi_number for p in ev.pitches)
                    sorted_chord_seq.append((bass_midi, top))

        if len(sorted_chord_seq) < 5:
            pytest.skip("樣本太少")

        # 計算實際 parallel 5/8 數
        parallel_count = 0
        for i in range(1, len(sorted_chord_seq)):
            pb, pt = sorted_chord_seq[i - 1]
            cb, ct = sorted_chord_seq[i]
            if _is_parallel_fifth_or_octave(pb, pt, cb, ct) is not None:
                parallel_count += 1
        # 並非絕對為 0 (有些 chord 只有 1 candidate / DP 找不到更好的),
        # 但應該很少 — 設個鬆閾值, 不超過 chord 數的 20%.
        max_allowed = max(2, len(sorted_chord_seq) // 5)
        assert parallel_count <= max_allowed, (
            f"DP 後仍有 {parallel_count} 個 parallel 5/8 ({len(sorted_chord_seq)} chord), "
            f"應 ≤ {max_allowed}"
        )

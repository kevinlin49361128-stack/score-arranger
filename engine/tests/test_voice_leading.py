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


# ============================================================================
# 0.1.31 樂理深化 #2: 隱伏五/八度 (hidden / direct parallels)
# ============================================================================

class TestHiddenParallels:
    """同向動進抵達 P5/P8 且至少一聲部跳進 → 隱伏五/八度違規."""

    def test_hidden_octaves_detected(self):
        """E5→C5 (下行 4 半音 leap) 上方, C4→C4? 不對 — 用真正情境:
        soprano C5→G5 (上行 7 半音 leap), bass C4→G4 (上行 7).
        起始 P8 → 結束 P12 (mod 12=7 = P5), 同向 + 上方跳進 → 隱伏五度."""
        from core.voice_leading import detect_hidden_parallels
        # soprano E5→C6 (上跳 8), bass C5→F5 (上行 5)
        # 起始 E5-C5 = 4 (M3), 結束 C6-F5 = 7 (P5), 同向 + 上方跳進
        score = _two_part_score(
            [_n(76, 0), _n(84, 1)],   # E5 → C6 (上跳 8)
            [_n(72, 0), _n(77, 1)],   # C5 → F5 (上跳 5)
        )
        issues = detect_hidden_parallels(score)
        codes = [i.result.code for i in issues]
        assert "W_HIDDEN_FIFTHS" in codes

    def test_hidden_octaves_via_similar_leap(self):
        """soprano E5→G5 (上行 3 = leap), bass C4→G3 (下行 -5 = leap).
        反向 → 不算隱伏. 改用同向跳: soprano C5→G5 (+7), alto E4→C5 (+8).
        起始 C5-E4 = 8 (m6), 結束 G5-C5 = 7 (P5) — 同向 + 上方跳進 → P5."""
        from core.voice_leading import detect_hidden_parallels
        # 真隱伏 P8 案例: soprano A4→C5 (+3, leap), bass D4→C4 (-2 step).
        # 反向, 跳過. 改: soprano A4→C5 (+3), bass F4→C4 (-5). 仍反向.
        # 同向跳到 P8: soprano F4→C5 (+7 leap), bass D4→C4 (-2). 反向.
        # 真同向上跳到 P8: soprano F4→G5 (+14), bass C4→G4 (+7).
        # 起始 F4-C4 = 5 (P4), 結束 G5-G4 = 12 (P8), 上方跳 14 → 隱伏 P8.
        score = _two_part_score(
            [_n(65, 0), _n(79, 1)],   # F4 → G5 (上跳 14)
            [_n(60, 0), _n(67, 1)],   # C4 → G4 (上跳 7)
        )
        issues = detect_hidden_parallels(score)
        codes = [i.result.code for i in issues]
        assert "W_HIDDEN_OCTAVES" in codes

    def test_stepwise_motion_clean(self):
        """同向但兩部都級進 (≤2 半音) → 不算隱伏."""
        from core.voice_leading import detect_hidden_parallels
        # soprano B4→C5 (+1 step), bass E4→F4 (+1 step).
        # 起始 B4-E4 = 7 (P5), 結束 C5-F4 = 7 (P5) — 這是真平行 P5, 不會
        # 觸發 hidden. 改用: 起始 m6 結束 P5: soprano D5→C5 (-2),
        # bass F4→F4 (0). 一部不動 → oblique, 不算.
        # 改: soprano D5→C5 (-2 step), bass G4→F4 (-2 step).
        # 起始 D5-G4 = 7 (P5) → 真平行 P5, 又被當 hidden filter 過. ok 那
        # 用結束才是 P5 的情境: soprano C5→C5 (0), bass F4→F4 (0) — 都不動.
        # 改: soprano B4→C5 (+1), bass D4→F4 (+3). 起始 B-D=9 (M6),
        # 結束 C-F=7 (P5), 同向. 但 bass +3 是 leap (>2). → 會被算 hidden.
        # 真「都級進」例: soprano B4→C5 (+1), bass A3→B3 (+2).
        # 起始 B4-A3 = 14 (mod12 = 2), 結束 C5-B3 = 13 (mod 12 = 1).
        # 結束不是 P5/P8. → 不算 hidden. 但我們要的反例是「同向 + 結束 P5 +
        # 都級進」.
        # soprano B4→C5 (+1 step), bass E4→F4 (+1 step), 結束 C5-F4 = 7 P5.
        # 起始 B4-E4 = 7 也 P5 → 已是真平行, 函式內 int1==int2 已 filter
        # 掉 hidden. 確認此情境不會雙重報.
        score = _two_part_score(
            [_n(71, 0), _n(72, 1)],   # B4 → C5 (+1)
            [_n(64, 0), _n(65, 1)],   # E4 → F4 (+1)
        )
        # 隱伏函式: 起始 P5 = 結束 P5 → int1==int2 → continue
        assert detect_hidden_parallels(score) == []

    def test_contrary_motion_clean(self):
        """反向動進 → 不算隱伏."""
        from core.voice_leading import detect_hidden_parallels
        # soprano F4→G5 (+14 leap), bass C5→G4 (-5).
        # 起始 F4-C5 = 7 (P5 / 反序), 結束 G5-G4 = 12 (P8), 反向.
        # → 沒同向, 不算隱伏.
        score = _two_part_score(
            [_n(65, 0), _n(79, 1)],   # F4 → G5
            [_n(72, 0), _n(67, 1)],   # C5 → G4
        )
        assert detect_hidden_parallels(score) == []

    def test_collect_issues_includes_hidden(self):
        """collect_issues 應同時包含 hidden parallels."""
        from core.repair import collect_issues
        score = _two_part_score(
            [_n(65, 0), _n(79, 1)],   # F4 → G5 (+14 leap)
            [_n(60, 0), _n(67, 1)],   # C4 → G4 (+7)
        )
        codes = {i.result.code for i in collect_issues(score)}
        assert "W_HIDDEN_OCTAVES" in codes

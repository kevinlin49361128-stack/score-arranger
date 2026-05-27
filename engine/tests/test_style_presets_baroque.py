"""0.1.53 E1.B v2 — baroque imitation 多輪化 regression tests.

確保:
1. sparse follower 多輪填入 (不再只 m3-m4 一次)
2. 非 sparse 區段保留既有素材
3. 超出 follower 樂器音域 → 該窗整段放棄
4. MAX_IMITATIONS = 6 上限有作用
"""

from __future__ import annotations

from fractions import Fraction

from core.arrangement_model import Arrangement
from core.ir import (
    Measure,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Voice,
)
from core.style_presets import _post_baroque_imitation


def _note(midi: int, onset: float, dur: float = 2.0) -> NoteEvent:
    return NoteEvent(
        pitch=Pitch(midi_number=midi, spelling="X"),
        duration=Fraction(dur),
        onset=Fraction(onset),
    )


def _rest(onset: float = 0.0, dur: float = 4.0) -> RestEvent:
    return RestEvent(duration=Fraction(dur), onset=Fraction(onset))


def _build_arrangement(
    leader_events_by_m: dict[int, list],
    follower_events_by_m: dict[int, list],
    n_measures: int,
    instrument: str = "violin",
) -> Arrangement:
    leader = Part(
        part_id="leader",
        instrument_id=instrument,
        name_display="Leader",
        measures=[],
    )
    follower = Part(
        part_id="follower",
        instrument_id=instrument,
        name_display="Follower",
        measures=[],
    )
    for n in range(1, n_measures + 1):
        leader.measures.append(
            Measure(
                number=n,
                time_signature=(4, 4),
                voices={
                    1: Voice(
                        voice_id=1,
                        events=leader_events_by_m.get(n, [_rest()]),
                    )
                },
            )
        )
        follower.measures.append(
            Measure(
                number=n,
                time_signature=(4, 4),
                voices={
                    1: Voice(
                        voice_id=1,
                        events=follower_events_by_m.get(n, [_rest()]),
                    )
                },
            )
        )
    score = Score(parts=[leader, follower], metadata={})
    return Arrangement(
        arrangement_id="t",
        name="t",
        source_id="s",
        players=[],
        source_score=None,
        target_score=score,
        assignments=[],
    )


def _follower_pitches(arr: Arrangement) -> dict[int, list[int]]:
    out: dict[int, list[int]] = {}
    follower = arr.target_score.parts[1]
    for m in follower.measures:
        ps: list[int] = []
        for v in m.voices.values():
            for ev in v.events:
                if isinstance(ev, NoteEvent):
                    ps.append(ev.pitch.midi_number)
        out[m.number] = ps
    return out


def test_v2_multi_window_fill():
    """主題 D5/E5/F5/G5, follower 全 rest → 多輪 -7 半音填入."""
    leader = {
        1: [_note(62, 0, 2), _note(64, 2, 2)],  # D5 E5
        2: [_note(65, 0, 2), _note(67, 2, 2)],  # F5 G5
    }
    follower = {}  # 全 rest
    arr = _build_arrangement(leader, follower, n_measures=12)
    _post_baroque_imitation(arr)

    p = _follower_pitches(arr)
    # 預期 m3-m12 每窗 2 measure 都填: m3=[55,57] m4=[58,60] 循環
    for win_start in (3, 5, 7, 9, 11):
        assert p[win_start] == [55, 57], (
            f"m{win_start} should be [55, 57]; got {p[win_start]}"
        )
        assert p[win_start + 1] == [58, 60], (
            f"m{win_start + 1} should be [58, 60]; got {p[win_start + 1]}"
        )


def test_v2_preserves_non_sparse_window():
    """follower m5-m6 已有 4 個音 → 該窗保留, 但其他 sparse 窗仍填入."""
    leader = {
        1: [_note(62, 0, 2), _note(64, 2, 2)],
        2: [_note(65, 0, 2), _note(67, 2, 2)],
    }
    follower = {
        5: [_note(70, 0, 1), _note(72, 1, 1), _note(74, 2, 1), _note(76, 3, 1)],
        6: [_note(70, 0, 1), _note(72, 1, 1), _note(74, 2, 1), _note(76, 3, 1)],
    }
    arr = _build_arrangement(leader, follower, n_measures=10)
    _post_baroque_imitation(arr)
    p = _follower_pitches(arr)
    # m3-m4 應填入
    assert p[3] == [55, 57]
    assert p[4] == [58, 60]
    # m5-m6 保留既有
    assert p[5] == [70, 72, 74, 76]
    assert p[6] == [70, 72, 74, 76]
    # m7-m10 sparse → 填入
    assert p[7] == [55, 57]
    assert p[8] == [58, 60]


def test_v2_out_of_range_window_skipped():
    """主題 -7 後超出 violin G3 (midi 55) 下限 → 該窗整段不填."""
    # 主題 C5/D5/E5/F5 → -7 = F3(53)/G3(55)/A3(57)/Bb3(58)
    # 53 < 55 (violin abs_low) → 整段放棄, follower 維持 rest
    leader = {
        1: [_note(60, 0, 2), _note(62, 2, 2)],  # C5 D5
        2: [_note(64, 0, 2), _note(65, 2, 2)],  # E5 F5
    }
    arr = _build_arrangement(leader, {}, n_measures=6)
    _post_baroque_imitation(arr)
    p = _follower_pitches(arr)
    # 全部跳過, follower 無音符
    assert p[3] == []
    assert p[4] == []
    assert p[5] == []
    assert p[6] == []


def test_v2_caps_at_max_imitations():
    """很長的 sparse follower 應 cap 在 MAX_IMITATIONS=6 (= 12 measure 填入)."""
    leader = {
        1: [_note(62, 0, 2), _note(64, 2, 2)],
        2: [_note(65, 0, 2), _note(67, 2, 2)],
    }
    arr = _build_arrangement(leader, {}, n_measures=20)
    _post_baroque_imitation(arr)
    p = _follower_pitches(arr)
    # m3-m14 應該被填 (6 窗 × 2 = 12 measure)
    filled = sum(1 for n, v in p.items() if v and n >= 3)
    assert filled == 12, f"expected 12 filled (cap 6 x 2), got {filled}"
    # m15-m20 不會被填 (cap 已達)
    for n in range(15, 21):
        assert p[n] == [], f"m{n} should not be filled (past cap); got {p[n]}"


def test_v2_short_theme_no_imitation():
    """主題 < 4 個實質音 → 不做模仿."""
    leader = {
        1: [_note(62, 0, 2)],  # only 1 note
        2: [_note(64, 0, 2)],  # only 1 note
    }
    arr = _build_arrangement(leader, {}, n_measures=10)
    _post_baroque_imitation(arr)
    p = _follower_pitches(arr)
    # follower 全部維持 rest
    for n in range(3, 11):
        assert p[n] == [], f"m{n}: theme too short, should not be imitated"

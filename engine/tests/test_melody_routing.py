"""M-core: 主旋律路線覆寫 (_apply_melody_routing_overrides) 單元測試。

直接在合成 Arrangement 上測覆寫邏輯 (不需跑完整 arrange)。
"""
from __future__ import annotations

from fractions import Fraction

from core.analyzer.function import tag_all_sections
from core.arrangement_model import (
    Arrangement,
    Assignment,
    Player,
    build_ensemble,
)
from core.arranger import _apply_melody_routing_overrides
from core.arranger import arrange as run_arrange
from core.ir import (
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


def _quartet() -> list[Player]:
    def P(pid: str, inst: str) -> Player:
        return Player(
            player_id=pid, display_name=pid,
            instruments=[inst], primary_instrument=inst,
        )
    return [P("violin_1", "violin"), P("violin_2", "violin"),
            P("viola_3", "viola"), P("cello_4", "cello")]


def _arr() -> Arrangement:
    """section 級 MELODY: source p1 → violin_1, span 1..8。"""
    return Arrangement(
        arrangement_id="t", name="t", source_id="s", players=_quartet(),
        assignments=[Assignment(
            assignment_id=0, source_part_id="p1",
            target_player_id="violin_1", target_instrument="violin",
            target_staff="main", span=(1, 8), function=VoiceFunction.MELODY,
        )],
    )


def _melody(arr: Arrangement) -> list[Assignment]:
    return [a for a in arr.assignments if a.function == VoiceFunction.MELODY]


class TestMelodyRouting:
    def test_none_is_noop(self):
        arr = _arr()
        _apply_melody_routing_overrides(arr, None)
        m = _melody(arr)
        assert len(m) == 1 and m[0].target_player_id == "violin_1"

    def test_override_subspan_splits(self):
        """覆寫 5..8 → viola，自動餘段 1..4 留 violin_1。"""
        arr = _arr()
        _apply_melody_routing_overrides(arr, [{"span": [5, 8], "targets": ["viola_3"]}])
        spans = {(a.span, a.target_player_id) for a in _melody(arr)}
        assert ((1, 4), "violin_1") in spans
        assert ((5, 8), "viola_3") in spans

    def test_override_flags(self):
        arr = _arr()
        _apply_melody_routing_overrides(arr, [{"span": [5, 8], "targets": ["viola_3"]}])
        m = {a.target_player_id: a for a in _melody(arr)}
        assert m["viola_3"].is_user_edited and not m["viola_3"].is_auto_generated
        # 自動餘段不應被標成 user-edited (否則 repair 不敢動)
        assert not m["violin_1"].is_user_edited

    def test_doubling_two_targets_same_span(self):
        arr = _arr()
        _apply_melody_routing_overrides(
            arr, [{"span": [1, 8], "targets": ["violin_1", "violin_2"]}],
        )
        m = _melody(arr)
        assert {a.target_player_id for a in m} == {"violin_1", "violin_2"}
        assert all(a.span == (1, 8) for a in m)

    def test_register_stored_for_low_voice(self):
        arr = _arr()
        _apply_melody_routing_overrides(
            arr, [{"span": [1, 8], "targets": ["cello_4"], "register": "octave_down"}],
        )
        m = _melody(arr)
        assert len(m) == 1 and m[0].target_player_id == "cello_4"
        assert m[0].melody_register == "octave_down"

    def test_empty_targets_keeps_auto(self):
        arr = _arr()
        _apply_melody_routing_overrides(arr, [{"span": [5, 8], "targets": []}])
        m = _melody(arr)
        assert len(m) == 1 and m[0].target_player_id == "violin_1"

    def test_four_voice_rotation(self):
        """四聲部逐句遊走 (Kevin 的極端例): 每 2 小節換一個聲部。"""
        arr = _arr()
        _apply_melody_routing_overrides(arr, [
            {"span": [1, 2], "targets": ["violin_1"]},
            {"span": [3, 4], "targets": ["violin_2"]},
            {"span": [5, 6], "targets": ["viola_3"]},
            {"span": [7, 8], "targets": ["cello_4"]},
        ])
        spans = sorted(
            (a.span, a.target_player_id) for a in _melody(arr)
        )
        assert spans == [
            ((1, 2), "violin_1"), ((3, 4), "violin_2"),
            ((5, 6), "viola_3"), ((7, 8), "cello_4"),
        ]


# ============================================================================
# 整合: 跑完整 arrange(melody_routing=...) — 證明 build_target_score 也吃這套
# ============================================================================

def _two_part_source(n: int = 8) -> Score:
    """treble (高音=主旋律) + bass — arrange 到 quartet 時 melody → violin。"""
    def part(pid, name, midi):
        ms = [Measure(
            number=i + 1, time_signature=(4, 4) if i == 0 else None,
            voices={1: Voice(voice_id=1, events=[
                NoteEvent(pitch=Pitch(midi, "x"), duration=Fraction(4),
                          onset=Fraction(0)),
            ])},
        ) for i in range(n)]
        return Part(part_id=pid, name_display=name,
                    instrument_id="piano", measures=ms)
    return Score(
        movements=[Movement(movement_id=1, measure_count=n,
                            sections=[Section(0, 1, n)])],
        parts=[part("treble", "Treble", 72), part("bass", "Bass", 48)],
    )


def test_full_arrange_routes_melody_through_pipeline():
    score = _two_part_source(8)
    tag_all_sections(score)
    players = build_ensemble("string_quartet", skill_level="professional")
    viola_id = next(p.player_id for p in players
                    if p.primary_instrument == "viola")

    arr = run_arrange(
        score, players, melody_routing=[{"span": [5, 8], "targets": [viola_id]}],
    )
    assert arr.target_score is not None
    mel = [a for a in arr.assignments if a.function == VoiceFunction.MELODY]
    at_m6 = [a for a in mel if a.span[0] <= 6 <= a.span[1]]
    assert at_m6, "m6 應有 MELODY 指派"
    assert any(a.target_player_id == viola_id for a in at_m6), (
        f"m6 主旋律應路由到 viola, 實際: {[a.target_player_id for a in at_m6]}"
    )
    # m1 仍維持自動 (非 viola) — 證明只覆寫指定段
    at_m1 = [a for a in mel if a.span[0] <= 1 <= a.span[1]]
    assert at_m1 and all(a.target_player_id != viola_id for a in at_m1)


# ============================================================================
# M-C: octave_down register — 主旋律降八度
# ============================================================================

def test_shift_pitch_down_octave():
    from core.arranger import _shift_pitch_down_octave
    out = _shift_pitch_down_octave(Pitch(72, "C5"))
    assert out.midi_number == 60
    assert out.spelling == "C4"


def _part_pitches_in_span(arr, part_id, span):
    part = next(
        (p for p in arr.target_score.parts if p.part_id == part_id), None,
    )
    assert part is not None
    out = []
    for m in part.measures:
        if span[0] <= m.number <= span[1]:
            for v in m.voices.values():
                for ev in v.events:
                    out += [p.midi_number for p in getattr(ev, "pitches", [])]
                    if hasattr(ev, "pitch"):
                        out.append(ev.pitch.midi_number)
    return out


def test_octave_down_lowers_routed_melody():
    # viola 是乾淨目標 (無既有分配)，可隔離驗證 register shift 本身。
    # cello 已載 bass，melody 撞 bass 屬「自動重填和聲」範疇 (另案)。
    players = build_ensemble("string_quartet", skill_level="professional")
    viola_id = next(p.player_id for p in players
                    if p.primary_instrument == "viola")

    s1 = _two_part_source(8); tag_all_sections(s1)
    nat = run_arrange(s1, players,
                      melody_routing=[{"span": [1, 8], "targets": [viola_id]}])
    s2 = _two_part_source(8); tag_all_sections(s2)
    low = run_arrange(s2, players, melody_routing=[
        {"span": [1, 8], "targets": [viola_id], "register": "octave_down"}])

    # 主旋律來源 treble = midi 72。natural → viola 含 72; octave_down → 含 60。
    assert 72 in _part_pitches_in_span(nat, viola_id, (1, 8))
    assert 60 in _part_pitches_in_span(low, viola_id, (1, 8))
    assert 72 not in _part_pitches_in_span(low, viola_id, (1, 8))


def test_key_down_lowers_routed_melody_a_fifth():
    players = build_ensemble("string_quartet", skill_level="professional")
    viola_id = next(p.player_id for p in players
                    if p.primary_instrument == "viola")

    s = _two_part_source(8); tag_all_sections(s)
    low = run_arrange(s, players, melody_routing=[
        {"span": [1, 8], "targets": [viola_id], "register": "key_down"}])

    # key_down = 降純五度 (-7)。treble 72 → 65 (F4)。
    pitches = _part_pitches_in_span(low, viola_id, (1, 8))
    assert 65 in pitches
    assert 72 not in pitches


# ============================================================================
# M-C: 和聲自動重平衡 (旋律讓位後重填) — 用真實 Bach chorale (SATB)
# ============================================================================

def _bach_chorale_path() -> str:
    import os
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(here, "core", "sample_scores", "bach_chorale_336.musicxml")


def test_rebalance_refills_vacated_melody_voice():
    import os
    import warnings
    path = _bach_chorale_path()
    if not os.path.exists(path):
        import pytest
        pytest.skip("bach_chorale_336.musicxml 不在")
    from core.parser import parse_musicxml
    warnings.filterwarnings("ignore")

    players = build_ensemble("string_quartet", skill_level="professional")
    vlns = [p.player_id for p in players if p.primary_instrument == "violin"]
    v1 = vlns[0]
    viola = next(p.player_id for p in players
                 if p.primary_instrument == "viola")

    score = parse_musicxml(path); tag_all_sections(score)
    arr = run_arrange(score, players,
                      melody_routing=[{"span": [3, 4], "targets": [viola]}])

    v1_part = next(p for p in arr.target_score.parts if p.part_id == v1)
    viola_part = next(p for p in arr.target_score.parts if p.part_id == viola)

    def notes(part, lo, hi):
        out = []
        for m in part.measures:
            if lo <= m.number <= hi:
                for v in m.voices.values():
                    out += [e.pitch.midi_number for e in v.events
                            if hasattr(e, "pitch")]
        return out

    # 讓位的 violin_1 在 m3-4 不可空白 (自動重填和聲)。
    assert notes(v1_part, 3, 4), "violin_1 讓出旋律後不應靜默 — 和聲未重填"
    # viola 在 m3-4 應接到主旋律 (比它原本的內聲部更高)。
    assert notes(viola_part, 3, 4)
    # m1-2 (未覆寫) violin_1 仍有內容 (主旋律)。
    assert notes(v1_part, 1, 2)

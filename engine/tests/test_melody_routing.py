"""M-core: 主旋律路線覆寫 (_apply_melody_routing_overrides) 單元測試。

直接在合成 Arrangement 上測覆寫邏輯 (不需跑完整 arrange)。
"""
from __future__ import annotations

from core.arrangement_model import Arrangement, Assignment, Player
from core.arranger import _apply_melody_routing_overrides
from core.ir import VoiceFunction


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

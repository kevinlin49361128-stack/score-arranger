"""
Arrangement Engine — 四階段聲部分配

對應規格: docs/architecture.md §4.4.1

Phase 1 範圍 (本檔案):
- Phase A: 骨架分配 (MELODY → 最高音樂器, BASS → 最低音樂器)
- Phase B: 填充分配 (COUNTERMELODY / HARMONY_FILL / PEDAL → 剩餘)
- Phase C: 衝突解決 (僅基礎: 音域外的 octave shift)
- Phase D: 連貫性修正 (Phase 1 留 stub, Phase 2 實作)

Phase 2 範圍 (留 TODO):
- 整合 Playability Validator 做完整修復迴圈
- 樂句鎖定 + voice crossing 檢查
- 對位作品的特殊處理
"""

from __future__ import annotations

import copy
from typing import Optional

from .analyzer.function import tag_all_sections, tag_section_functions
from .analyzer.phrase import detect_phrases
from .arrangement_model import (
    Arrangement,
    Assignment,
    Player,
    Staff,
)
from .instruments import get_profile
from .ir import (
    ChordEvent,
    DynamicHairpin,
    Measure,
    NoteEvent,
    Part,
    Pitch,
    RestEvent,
    Score,
    Section,
    Voice,
    VoiceFunction,
)


# ============================================================================
# 角色 → 目標選擇
# ============================================================================

_ARRANGER_WATERMARK = "Arranged with Score Arranger"


def _format_arranger(existing: Optional[str]) -> str:
    """組合 arranger 浮水印.

    若 source 已有 arranger (例如使用者匯入的譜已有人改編過), 保留原作者並附加
    本工具的標示, 避免覆蓋他人作品的歸屬。
    """
    if existing and existing.strip():
        # 已包含本工具標示 → 不重複加
        if "Score Arranger" in existing:
            return existing
        return f"{existing.strip()} · {_ARRANGER_WATERMARK}"
    return _ARRANGER_WATERMARK


def _profile_upper(player: Player) -> int:
    profile = get_profile(player.primary_instrument)
    if profile is None:
        return 0
    return profile.range_comfortable[1]


def _profile_lower(player: Player) -> int:
    profile = get_profile(player.primary_instrument)
    if profile is None:
        return 127
    return profile.range_comfortable[0]


def _is_keyboard(player: Player) -> bool:
    profile = get_profile(player.primary_instrument)
    return profile is not None and profile.family == "keyboard"


def _skill_rank(skill_level: str) -> int:
    """技能等級的排序權重 — 高技能優先, 用作 MELODY 指派的 tiebreaker。"""
    return {"professional": 3, "intermediate": 2, "amateur": 1}.get(
        skill_level, 2,
    )


def _pick_same_instrument(
    source_instrument_id: Optional[str],
    players: list[Player],
    occupied: set[tuple[str, Staff]],
) -> Optional[tuple[str, Staff]]:
    """在未佔用的 players 中, 優先回傳 primary_instrument 與 source 相同的目標.

    用途: 當 source 是 violin II 時, 不要因為 mid-range 排序選到 viola, 而是優先
    去找未佔用的 violin player. 同樣的, source viola 應對應 target viola_1.

    若找不到相同樂器, 回傳 None 讓 caller 使用 fallback 規則.
    """
    if not source_instrument_id:
        return None
    for p in players:
        if p.primary_instrument != source_instrument_id:
            continue
        for staff in (("upper", "lower") if p.staves == 2 else ("main",)):
            if (p.player_id, staff) not in occupied:
                return (p.player_id, staff)  # type: ignore[return-value]
    return None


def pick_target_for_function(
    function: VoiceFunction,
    players: list[Player],
    occupied: Optional[set[tuple[str, Staff]]] = None,
    source_instrument_id: Optional[str] = None,
) -> Optional[tuple[str, Staff]]:
    """依功能選擇目標 (player_id, staff)。

    occupied: 已被高優先功能佔用的 (player_id, staff), 避免衝突。
    source_instrument_id: 來源 part 的樂器. 對中聲部 / 對位類功能 (HARMONY_FILL,
        COUNTERMELODY), 若有同樂器的 unoccupied target 會優先選它 — 避免把
        source violin II 路由到 target viola, source viola 路由到 target violin II.
    """
    occupied = occupied or set()

    if function == VoiceFunction.MELODY:
        # 選音域上界最高的 player → upper staff (若是鍵盤) 或 main
        # 同音域時用 skill_level 當 tiebreaker — 高技能拿旋律 (技能感知分譜)。
        # 非平手情況維持原本行為, 不影響既有改編品質。
        sorted_players = sorted(
            players,
            key=lambda p: (_profile_upper(p), _skill_rank(p.skill_level)),
            reverse=True,
        )
        for p in sorted_players:
            staff: Staff = "upper" if p.staves == 2 else "main"
            if (p.player_id, staff) not in occupied:
                return (p.player_id, staff)

    elif function == VoiceFunction.BASS:
        # 音域下界最低的 player → lower staff
        sorted_players = sorted(players, key=_profile_lower)
        for p in sorted_players:
            staff: Staff = "lower" if p.staves == 2 else "main"
            if (p.player_id, staff) not in occupied:
                return (p.player_id, staff)

    elif function == VoiceFunction.HARMONY_FILL:
        # (1) 若 source 是某個具體樂器 (violin/viola/...), 優先映射到同樂器 target
        same = _pick_same_instrument(source_instrument_id, players, occupied)
        if same is not None:
            return same
        # (2) 偏好鍵盤的 upper
        keyboards = [p for p in players if _is_keyboard(p)]
        for p in keyboards:
            for staff in ("upper", "lower"):  # type: Staff
                if (p.player_id, staff) not in occupied:
                    return (p.player_id, staff)
        # (3) 無鍵盤: 依「中音域排序」掃過所有 player, 取第一個未佔用的
        # (例如 string quartet 沒鍵盤時, Alto 用 Violin II, Tenor 用 Viola)
        sorted_by_mid = sorted(
            players,
            key=lambda p: -(_profile_upper(p) + _profile_lower(p)) / 2,
        )
        # 從中音域最高的開始往下找未佔用
        mid_index = len(sorted_by_mid) // 2
        # 重新排序: 從 mid 起向兩側擴散, 偏好中音域
        ordered: list[Player] = []
        for offset in range(len(sorted_by_mid)):
            idx_hi = mid_index - offset
            idx_lo = mid_index + offset
            if 0 <= idx_hi < len(sorted_by_mid):
                ordered.append(sorted_by_mid[idx_hi])
            if offset != 0 and 0 <= idx_lo < len(sorted_by_mid):
                ordered.append(sorted_by_mid[idx_lo])
        seen: set[str] = set()
        for p in ordered:
            if p.player_id in seen:
                continue
            seen.add(p.player_id)
            for staff in (("upper", "lower") if p.staves == 2 else ("main",)):
                if (p.player_id, staff) not in occupied:
                    return (p.player_id, staff)  # type: ignore[return-value]

    elif function == VoiceFunction.COUNTERMELODY:
        # 與 MELODY 不同的 player; 偏好同樂器, 其次鍵盤 upper
        return pick_target_for_function(
            VoiceFunction.HARMONY_FILL, players, occupied,
            source_instrument_id=source_instrument_id,
        )

    elif function == VoiceFunction.PEDAL:
        # 持續低音 → BASS 區域
        return pick_target_for_function(
            VoiceFunction.BASS, players, occupied
        )

    return None


# ============================================================================
# 主分配流程 (Phase 1)
# ============================================================================

def arrange(
    score: Score,
    players: list[Player],
    section: Optional[Section] = None,
    arrangement_name: str = "自動分配 v1",
    fill_inner_voices: bool = True,
) -> Arrangement:
    """執行 Phase 1 四階段分配。

    Args:
        fill_inner_voices: 若為 True (預設), source parts < target players 時,
            自動補完空 player 的內聲部 (以 source 和聲為基礎). 設 False 可保留
            空白 player (例如使用者想之後手動寫聲部).

    若 section 為 None, 使用 score 的第一個 section (或建立整曲 fallback)。
    """
    # 0. 準備 section
    if section is None:
        section = _ensure_default_section(score)

    # 0.5 若尚未標記 function, 跑 tagging
    if not any(p.function_tags for p in score.parts):
        tag_all_sections(score)

    arrangement = Arrangement(
        arrangement_id="auto_v1",
        name=arrangement_name,
        source_id=score.metadata.get("title", "source"),
        players=players,
        assignments=[],
        target_score=None,
    )

    # Phase A + B: 分配
    _phase_a_skeleton(score, section, players, arrangement)
    _phase_b_fill(score, section, players, arrangement)

    # 樂句級旋律換手 (docs/architecture.md §4.4: 主旋律僅在樂句邊界換聲部)
    try:
        _apply_melody_handoff(score, section, arrangement)
    except Exception:
        pass  # 換手偵測失敗 → 保留 section 級 MELODY 指派

    # Phase C: 衝突解決 (Phase 1 僅 octave shift)
    # Phase D: 連貫性修正 (Phase 2 實作)

    # 建構 target_score
    arrangement.target_score = build_target_score(
        score, players, arrangement.assignments, section
    )
    # Phase 1: 保留 source 以供之後 reassign 重建
    arrangement.source_score = score

    # 為管樂 part 自動插入呼吸標記 (skill / dynamic 感知)
    try:
        from .breath_marks import insert_breath_marks
        # 從 player.skill_level 推導每個 target part 的 skill — part_id 前綴
        # 即 player_id (e.g. "trumpet_1", "piano_1_upper" → player_id "piano_1")
        part_skills: dict[str, str] = {}
        for player in players:
            pid = player.player_id
            for staff in ("main", "upper", "lower"):
                key = pid if staff == "main" else f"{pid}_{staff}"
                part_skills[key] = player.skill_level
        insert_breath_marks(
            arrangement.target_score,
            part_skill_levels=part_skills,
        )
    except Exception:
        pass

    # 內聲部自動補完: 若有 target player 沒拿到 assignment, 從 source 和聲
    # 生成填充音 (例如 Corelli 三重奏 → 弦四 時補 viola).
    if fill_inner_voices:
        try:
            from .voice_filler import fill_inner_voices as _do_fill
            _do_fill(arrangement)
        except Exception:
            pass

    # Baroque continuo realization: 在 harpsichord 右手 (upper staff) 自動生成
    # 和聲填充。僅當 harpsichord 與其他樂器同台 (擔任通奏低音角色) 時才跑 ——
    # harpsichord 獨奏時它已承擔整個改編 (含旋律), 跑 continuo 會把旋律覆蓋掉。
    has_continuo_harpsichord = len(arrangement.players) > 1 and any(
        p.player_id == "harpsichord_1" and p.staves == 2
        for p in arrangement.players
    )
    if has_continuo_harpsichord:
        try:
            from .baroque import realize_continuo
            realize_continuo(arrangement)
        except Exception:
            pass

    # Voice-leading DP — 對內聲部跑 Viterbi 把八度選到平行 5/8 / 聲部交叉
    # 最少的位置. 失敗不阻塞改編 (內聲部原樣保留, MELODY/BASS 不受影響).
    try:
        from .voice_leading_dp import optimize_inner_voices
        optimize_inner_voices(arrangement)
    except Exception:
        pass

    # 0.1.38 教學就緒: 改編譜自動加 rehearsal marks [A][B][C]...
    # 音樂老師上課指「從 B 段第 3 小節再來」, 學生看得到. 失敗不阻塞改編.
    try:
        from .analyzer.rehearsal_marks import (
            detect_phrase_starts,
            insert_rehearsal_marks,
        )
        if arrangement.target_score is not None:
            phrase_starts = detect_phrase_starts(arrangement.target_score)
            insert_rehearsal_marks(
                arrangement.target_score,
                phrase_starts=phrase_starts or None,
            )
    except Exception:
        pass

    return arrangement


def _ensure_default_section(score: Score) -> Section:
    for movement in score.movements:
        if movement.sections:
            return movement.sections[0]
    # 0.1.45: start_measure 不能硬編 1 — 若 source 有 pickup, m1.number=0.
    # 取所有 part 第一小節 number 的最小值, 末小節同理.
    first_numbers = [
        p.measures[0].number for p in score.parts if p.measures
    ]
    last_numbers = [
        p.measures[-1].number for p in score.parts if p.measures
    ]
    start = min(first_numbers) if first_numbers else 1
    end = max(last_numbers) if last_numbers else 0
    return Section(section_id=0, start_measure=start, end_measure=end)


# ============================================================================
# Phase A: 骨架 (MELODY + BASS)
# ============================================================================

def _phase_a_skeleton(
    score: Score,
    section: Section,
    players: list[Player],
    arrangement: Arrangement,
) -> None:
    occupied: set[tuple[str, Staff]] = set()

    # 收集各 function 的來源 part
    by_function: dict[VoiceFunction, list[str]] = {}
    for part in score.parts:
        func = part.function_tags.get(
            section.section_id, VoiceFunction.UNASSIGNED
        )
        by_function.setdefault(func, []).append(part.part_id)

    # MELODY
    for part_id in by_function.get(VoiceFunction.MELODY, []):
        target = pick_target_for_function(
            VoiceFunction.MELODY, players, occupied
        )
        if target is None:
            continue
        player = arrangement.get_player(target[0])
        assert player is not None
        arrangement.assignments.append(Assignment(
            assignment_id=len(arrangement.assignments),
            source_part_id=part_id,
            target_player_id=target[0],
            target_instrument=player.primary_instrument,
            target_staff=target[1],
            span=(section.start_measure, section.end_measure),
            function=VoiceFunction.MELODY,
        ))
        occupied.add(target)

    # BASS
    for part_id in by_function.get(VoiceFunction.BASS, []):
        target = pick_target_for_function(
            VoiceFunction.BASS, players, occupied
        )
        if target is None:
            continue
        player = arrangement.get_player(target[0])
        assert player is not None
        arrangement.assignments.append(Assignment(
            assignment_id=len(arrangement.assignments),
            source_part_id=part_id,
            target_player_id=target[0],
            target_instrument=player.primary_instrument,
            target_staff=target[1],
            span=(section.start_measure, section.end_measure),
            function=VoiceFunction.BASS,
        ))
        occupied.add(target)


# ============================================================================
# Phase B: 填充 (剩餘功能)
# ============================================================================

def _phase_b_fill(
    score: Score,
    section: Section,
    players: list[Player],
    arrangement: Arrangement,
) -> None:
    occupied = {
        (a.target_player_id, a.target_staff) for a in arrangement.assignments
    }

    by_function: dict[VoiceFunction, list[str]] = {}
    src_instr_by_id: dict[str, str] = {}
    for part in score.parts:
        func = part.function_tags.get(
            section.section_id, VoiceFunction.UNASSIGNED
        )
        by_function.setdefault(func, []).append(part.part_id)
        src_instr_by_id[part.part_id] = part.instrument_id

    # 依優先序處理: COUNTERMELODY > PEDAL > HARMONY_FILL > ORNAMENTAL
    fill_order = [
        VoiceFunction.COUNTERMELODY,
        VoiceFunction.PEDAL,
        VoiceFunction.HARMONY_FILL,
        VoiceFunction.ORNAMENTAL,
        VoiceFunction.UNASSIGNED,
    ]
    for func in fill_order:
        for part_id in by_function.get(func, []):
            target = pick_target_for_function(
                func, players, occupied,
                source_instrument_id=src_instr_by_id.get(part_id),
            )
            if target is None:
                # 無可用 target; 嘗試覆寫到 keyboard upper (允許多聲部疊加)
                for p in players:
                    if _is_keyboard(p):
                        target = (p.player_id, "upper")
                        break
            if target is None:
                continue
            player = arrangement.get_player(target[0])
            if player is None:
                continue
            arrangement.assignments.append(Assignment(
                assignment_id=len(arrangement.assignments),
                source_part_id=part_id,
                target_player_id=target[0],
                target_instrument=player.primary_instrument,
                target_staff=target[1],
                span=(section.start_measure, section.end_measure),
                function=func,
            ))
            # 鍵盤可以疊加多聲部 → 不佔用; 其他樂器 (弦樂/管樂) 每位演奏者只能彈一個聲部
            # → 立刻佔用避免雙重指派
            if not _is_keyboard(player):
                occupied.add(target)


# ============================================================================
# 樂句級旋律換手 (docs/architecture.md §4.4)
# ============================================================================

# section 超過此長度 → 跳過換手偵測 (detect_phrases 的 DP 在超大段落上太慢,
# 且通常代表「整曲被當成單一 section」的退化情況)。
_HANDOFF_MAX_SECTION_MEASURES = 400


def _apply_melody_handoff(
    score: Score,
    section: Section,
    arrangement: Arrangement,
) -> None:
    """把單一 section 級 MELODY 指派, 依樂句邊界拆成多個逐樂句指派。

    主旋律在原曲不同聲部間遊走時 (例如旋律從第一小提琴移到大提琴),
    讓目標旋律樂器逐樂句跟著正確的來源聲部走。

    v2 (技能感知): 找得到「副旋律手」(skill_level 較低但音域夠用) 時,
    把容易的樂句分給副手, 困難的樂句留給主手, 自動分擔負擔。

    無偵測到換手 (只有一個樂句, 或每個樂句都同一來源) → 不動原指派。
    """
    melody_assigns = [
        a for a in arrangement.assignments
        if a.function == VoiceFunction.MELODY
    ]
    if not melody_assigns:
        return

    # 換手是「縮編」技巧 — 目標聲部數 >= 來源數時, 每個來源各自保留對應
    # 目標 (1:1 對映), 不需把旋律集中換手。只有縮編 (來源 > 目標) 才換手。
    if len(score.parts) <= len(arrangement.players):
        return

    # 排除已被 BASS / PEDAL 佔用的來源 — 避免旋律換手搶走低音聲部,
    # 造成同一來源被雙重使用。
    exclude = {
        a.source_part_id for a in arrangement.assignments
        if a.function in (VoiceFunction.BASS, VoiceFunction.PEDAL)
    }
    spans = _melody_handoff_spans(score, section, exclude)
    if spans is None:
        return  # 無換手 → 保留原 section 級指派

    # 用逐樂句指派取代原本的 section 級 MELODY 指派
    primary = melody_assigns[0]
    secondary = _find_secondary_melody_target(arrangement, primary)
    primary_player = next(
        (p for p in arrangement.players
         if p.player_id == primary.target_player_id),
        None,
    )

    # v2 樂句分配 — 找得到副手時, 依「相對難度」分配:
    # 該 section 內難度後 50% 的樂句 → 副手, 前 50% → 主手. 這樣即使
    # 全曲難度相近, 仍會有平衡的分擔; 而難度差大時則嚴格按比例分.
    secondary_spans: set[tuple[int, int]] = set()
    if secondary is not None and primary_player is not None and len(spans) >= 2:
        difficulties = [
            (sp[0], sp[1], _estimate_phrase_difficulty(
                score, sp[2], sp[0], sp[1], primary_player,
            ))
            for sp in spans
        ]
        # 過濾掉「音域超出副手」(回 None) 的樂句 — 那些只能留主手
        feasible = [d for d in difficulties if d[2] is not None]
        if feasible:
            sorted_d = sorted(feasible, key=lambda x: x[2])  # type: ignore[arg-type]
            # 後 50% 容易的 → 副手
            half = max(1, len(sorted_d) // 2)
            for (s, e, _) in sorted_d[:half]:
                secondary_spans.add((s, e))

    others = [
        a for a in arrangement.assignments
        if a.function != VoiceFunction.MELODY
    ]
    new_melody: list[Assignment] = []
    for (start_m, end_m, part_id) in spans:
        if secondary is not None and (start_m, end_m) in secondary_spans:
            target_player, target_inst, target_staff = secondary
        else:
            target_player = primary.target_player_id
            target_inst = primary.target_instrument
            target_staff = primary.target_staff
        new_melody.append(Assignment(
            assignment_id=0,
            source_part_id=part_id,
            target_player_id=target_player,
            target_instrument=target_inst,
            target_staff=target_staff,
            span=(start_m, end_m),
            function=VoiceFunction.MELODY,
        ))
    arrangement.assignments = others + new_melody
    for i, a in enumerate(arrangement.assignments):
        a.assignment_id = i


def _find_secondary_melody_target(
    arrangement: Arrangement,
    primary: Assignment,
) -> Optional[tuple[str, str, Staff]]:
    """找一個比主旋律手「低一階」的副手 — 同類樂器, 較低 skill_level,
    且尚未在 section 內被指派 MELODY/BASS。

    回傳 (player_id, instrument_id, staff). 找不到回 None — 維持單一主手。
    """
    occupied_in_section = {
        (a.target_player_id, a.target_staff)
        for a in arrangement.assignments
        if a.function in (
            VoiceFunction.MELODY,
            VoiceFunction.BASS,
        )
    }
    primary_player = next(
        (p for p in arrangement.players
         if p.player_id == primary.target_player_id),
        None,
    )
    if primary_player is None:
        return None
    primary_skill = _skill_rank(primary_player.skill_level)
    primary_family = (
        get_profile(primary_player.primary_instrument).family
        if get_profile(primary_player.primary_instrument) else None
    )
    # 候選: 同樂器家族 + skill < primary_skill + 還能容納旋律的 staff
    candidates: list[tuple[str, str, Staff]] = []
    for p in arrangement.players:
        if p.player_id == primary_player.player_id:
            continue
        if _skill_rank(p.skill_level) >= primary_skill:
            continue
        prof = get_profile(p.primary_instrument)
        if prof is None or prof.family != primary_family:
            continue
        staff: Staff = "upper" if p.staves == 2 else "main"
        if (p.player_id, staff) in occupied_in_section:
            continue
        candidates.append((p.player_id, p.primary_instrument, staff))
    if not candidates:
        return None
    # 多副手: 取技能最高那位 (例如 amateur 與 intermediate 中, 選 intermediate).
    candidates.sort(
        key=lambda c: _skill_rank(next(
            pl.skill_level for pl in arrangement.players if pl.player_id == c[0]
        )),
        reverse=True,
    )
    return candidates[0]


def _estimate_phrase_difficulty(
    score: Score,
    source_part_id: str,
    start_m: int,
    end_m: int,
    primary_player: Player,
) -> Optional[float]:
    """估算單一樂句的難度 (歸一化 0..1).

    回 None 表示「樂句超出副手音域」 → 強制留主手, 不參與分配排序。
    其餘回 0..1 值, 數字越大越難 (作為「該不該給副手」的相對排序基準).
    """
    src_part = next(
        (p for p in score.parts if p.part_id == source_part_id), None
    )
    if src_part is None:
        return None
    pitches: list[int] = []
    for m in src_part.measures:
        if not (start_m <= m.number <= end_m):
            continue
        voices_iter = (
            m.voices.values() if isinstance(m.voices, dict) else m.voices
        )
        for voice in voices_iter:
            branches = (voice.divisi_branches
                        if voice.is_divisi and voice.divisi_branches
                        else [voice])
            for v in branches:
                for ev in v.events:
                    if isinstance(ev, NoteEvent):
                        pitches.append(ev.pitch.midi_number)
                    elif isinstance(ev, ChordEvent):
                        pitches.extend(p.midi_number for p in ev.pitches)
    if not pitches:
        return None
    profile = get_profile(primary_player.primary_instrument)
    if profile is None:
        return None
    lo, hi = profile.range_comfortable
    # 副手通常用同類樂器同音域, 拿 primary 的 comfortable 當代理:
    # 若這段超出 comfortable, 留主手 (回 None 排除此 span).
    if min(pitches) < lo or max(pitches) > hi:
        return None
    n_notes = len(pitches)
    n_measures = max(1, end_m - start_m + 1)
    density = min(1.0, n_notes / (n_measures * 8))
    high_ratio = sum(1 for p in pitches if p > lo + (hi - lo) * 0.7) / n_notes
    return 0.6 * density + 0.4 * high_ratio


def _melody_handoff_spans(
    score: Score,
    section: Section,
    exclude: set[str],
) -> Optional[list[tuple[int, int, str]]]:
    """偵測 section 內主旋律的逐樂句來源。

    回傳 [(start_measure, end_measure, source_part_id), ...] — 已合併相鄰
    同來源的樂句。若無實質換手 (全段同一來源 / 無法細分樂句) → None。
    """
    n_measures = section.end_measure - section.start_measure + 1
    if n_measures > _HANDOFF_MAX_SECTION_MEASURES or n_measures < 4:
        return None

    # section 級主旋律 part (排除低音聲部)
    sec_scores = {
        pid: sc
        for pid, sc in tag_section_functions(
            score, section,
        ).melody_scores.items()
        if pid not in exclude
    }
    if not sec_scores:
        return None
    primary = max(sec_scores, key=lambda k: sec_scores[k])
    primary_part = next(
        (p for p in score.parts if p.part_id == primary), None
    )
    if primary_part is None:
        return None

    # 用主旋律 part 的樂句邊界當換手點
    phrases = detect_phrases(primary_part, section)
    if len(phrases) <= 1:
        return None

    starts = sorted({
        ph.start[0] for ph in phrases
        if section.start_measure <= ph.start[0] <= section.end_measure
    })
    if not starts or starts[0] != section.start_measure:
        starts.insert(0, section.start_measure)

    # 樂句邊界 → 連續不重疊的 measure span
    raw_spans: list[tuple[int, int]] = []
    for i, s in enumerate(starts):
        e = starts[i + 1] - 1 if i + 1 < len(starts) else section.end_measure
        if e >= s:
            raw_spans.append((s, e))
    if len(raw_spans) <= 1:
        return None

    # 逐樂句挑旋律來源 — sticky: 維持上一樂句的來源, 除非新來源明顯勝出
    chosen: list[tuple[int, int, str]] = []
    prev = primary
    for (s, e) in raw_spans:
        tmp = Section(section_id=-1, start_measure=s, end_measure=e)
        span_scores = {
            pid: sc
            for pid, sc in tag_section_functions(
                score, tmp,
            ).melody_scores.items()
            if pid not in exclude
        }
        if span_scores:
            winner = max(span_scores, key=lambda k: span_scores[k])
            prev_score = span_scores.get(prev, 0.0)
            if winner != prev and span_scores[winner] > prev_score * 1.15:
                prev = winner
        chosen.append((s, e, prev))

    # 合併相鄰同來源
    merged: list[tuple[int, int, str]] = []
    for (s, e, pid) in chosen:
        if merged and merged[-1][2] == pid:
            merged[-1] = (merged[-1][0], e, pid)
        else:
            merged.append((s, e, pid))

    if len(merged) <= 1:
        return None  # 全段同一來源 → 無實質換手
    return merged


# ============================================================================
# Target score 建構 (含 octave 調整)
# ============================================================================

def build_target_score(
    source: Score,
    players: list[Player],
    assignments: list[Assignment],
    section: Section,
) -> Score:
    """依 assignments 把 source 的內容複製到 target_score。

    Phase 1 規則:
    - 每個 (player, staff) 對應 target Score 的一個 Part
    - 同一 target 多個來源時, 把音符疊加到同一 voice (簡化)
    - 若音域超出 target 的 comfortable range, 自動移八度
    """
    # 1. 建立 target Parts
    target_parts: dict[tuple[str, Staff], Part] = {}
    for player in players:
        from .arrangement_model import get_staves_for
        for staff in get_staves_for(player):
            part_id = (
                f"{player.player_id}_{staff}"
                if staff != "main" else player.player_id
            )
            display_name = (
                f"{player.display_name} ({staff.upper()[0]}.H.)"
                if staff != "main" else player.display_name
            )
            target_parts[(player.player_id, staff)] = Part(
                part_id=part_id,
                name_display=display_name,
                instrument_id=player.primary_instrument,
                measures=[],
            )

    # 2. 為每個 target part 預建 measure 骨架
    # 0.1.45: 同步保留 is_pickup — 不完全小節開頭的曲子, target 也要從 pickup
    # 開始, 否則 source ↔ target 上下對照會錯位一格.
    n_measures = section.end_measure - section.start_measure + 1
    src_pickup_numbers: set[int] = set()
    for src_part in source.parts:
        for m in src_part.measures:
            if m.is_pickup:
                src_pickup_numbers.add(m.number)
    for tp in target_parts.values():
        for i in range(n_measures):
            number = section.start_measure + i
            ts = None
            # 從 source 對應 measure 取 time_signature
            for src_part in source.parts:
                for m in src_part.measures:
                    if m.number == number and m.time_signature:
                        ts = m.time_signature
                        break
                if ts:
                    break
            tp.measures.append(Measure(
                number=number,
                time_signature=ts if i == 0 else None,
                voices={1: Voice(voice_id=1, events=[])},
                is_pickup=number in src_pickup_numbers,
            ))

    # 3. 處理每個 assignment
    src_by_id = {p.part_id: p for p in source.parts}
    player_by_id = {p.player_id: p for p in players}
    for assignment in assignments:
        src_part = src_by_id.get(assignment.source_part_id)
        if src_part is None:
            continue
        target_part = target_parts.get(
            (assignment.target_player_id, assignment.target_staff)
        )
        if target_part is None:
            continue

        profile = get_profile(assignment.target_instrument)
        target_player = player_by_id.get(assignment.target_player_id)
        skill = target_player.skill_level if target_player else "professional"

        # 依 assignment.span 裁切 — 樂句級換手時各 MELODY 指派只負責自己的
        # 樂句範圍; 非換手指派的 span 即整個 section, 行為不變。
        span_lo, span_hi = assignment.span
        for src_m in src_part.measures:
            if not (span_lo <= src_m.number <= span_hi):
                continue
            tgt_idx = src_m.number - section.start_measure
            if not (0 <= tgt_idx < len(target_part.measures)):
                continue
            tgt_m = target_part.measures[tgt_idx]

            for voice in src_m.voices.values():
                if voice.is_divisi:
                    continue
                for event in voice.events:
                    new_event = _transform_event(event, profile, skill)
                    if new_event is not None:
                        tgt_m.voices[1].events.append(new_event)

    # 4. 對每個 target measure 的事件按 onset 排序
    for tp in target_parts.values():
        for m in tp.measures:
            m.voices[1].events.sort(key=lambda e: e.onset)

    # 5. 組裝 Score
    # arranger 浮水印 — 透過 MusicXML 標準 metadata 欄位, 不影響譜面音符
    # 顯示位置: OSMD / MuseScore / Dorico 都會在標題頁右上角作曲家下方自動標示
    target_score = Score(
        metadata={
            **source.metadata,
            "arranged": "true",
            "arranger": _format_arranger(source.metadata.get("arranger")),
        },
        movements=[type(source.movements[0])(
            movement_id=1,
            title=source.metadata.get("title"),
            measure_count=n_measures,
            sections=[copy.deepcopy(section)],
        )] if source.movements else [],
        parts=list(target_parts.values()),
        default_tempo_bpm=source.default_tempo_bpm,
        default_key=source.default_key,
        default_time_signature=source.default_time_signature,
    )
    # 把來源的漸強/漸弱記號依 assignment 對映到 target part
    target_score.hairpins = _remap_hairpins(source, assignments)
    return target_score


def _remap_hairpins(
    source: Score, assignments: list[Assignment],
) -> list[DynamicHairpin]:
    """把 source 的 DynamicHairpin 依 assignment 對映到 target part_id。

    一條 hairpin (在 source part X) → 找涵蓋其起點小節的 assignment,
    改掛到對應的 target part。來源聲部未被改編用到 → 該 hairpin 捨棄。
    """
    if not source.hairpins:
        return []
    out: list[DynamicHairpin] = []
    for hp in source.hairpins:
        start_measure = hp.start[0]
        target_pid: Optional[str] = None
        for a in assignments:
            if a.source_part_id != hp.part_id:
                continue
            lo, hi = a.span
            if lo <= start_measure <= hi:
                target_pid = (
                    f"{a.target_player_id}_{a.target_staff}"
                    if a.target_staff != "main"
                    else a.target_player_id
                )
                break
        if target_pid is None:
            continue
        out.append(DynamicHairpin(
            hairpin_id=len(out),
            start=hp.start,
            end=hp.end,
            kind=hp.kind,
            part_id=target_pid,
            start_dynamic=hp.start_dynamic,
            end_dynamic=hp.end_dynamic,
        ))
    return out


def _transform_event(event, profile, skill_level: str = "professional"):
    """套用音域調整 (octave shift) 若超出 comfortable range.

    skill_level 影響和弦複雜度上限:
    - amateur: 最多 2 音 (頂 + 底)
    - intermediate: 最多 3 音 (頂 + 底 + 中)
    - professional: 不限 (用樂器 max_simultaneous_notes)
    """
    if isinstance(event, RestEvent):
        return copy.deepcopy(event)

    if profile is None:
        return copy.deepcopy(event)

    low, high = profile.range_comfortable

    if isinstance(event, NoteEvent):
        new_midi = _adjust_octave(event.pitch.midi_number, low, high)
        if new_midi == event.pitch.midi_number:
            return copy.deepcopy(event)
        new_event = copy.deepcopy(event)
        new_event.pitch = Pitch(midi_number=new_midi, spelling=event.pitch.spelling)
        return new_event

    if isinstance(event, ChordEvent):
        new_event = copy.deepcopy(event)
        adjusted = []
        for p in event.pitches:
            new_midi = _adjust_octave(p.midi_number, low, high)
            adjusted.append(Pitch(midi_number=new_midi, spelling=p.spelling))
        # 去重 (調整後可能有同音高)
        seen = set()
        unique = []
        for p in adjusted:
            if p.midi_number not in seen:
                seen.add(p.midi_number)
                unique.append(p)
        # 依 skill level 縮減和弦
        max_notes = {
            "amateur": 2,
            "intermediate": 3,
            "professional": 99,
        }.get(skill_level, 99)
        if len(unique) > max_notes:
            # 保留外聲部 (頂 + 底); intermediate 多保中位
            unique.sort(key=lambda p: p.midi_number)
            if max_notes == 2:
                unique = [unique[0], unique[-1]]
            elif max_notes == 3:
                mid_idx = len(unique) // 2
                unique = [unique[0], unique[mid_idx], unique[-1]]
        if len(unique) < 2:
            # 變成單音 → 改為 NoteEvent
            return NoteEvent(
                pitch=unique[0],
                duration=event.duration,
                onset=event.onset,
                articulations=list(event.articulations),
                dynamic=event.dynamic,
                is_tied_from=event.is_tied_from,
                is_tied_to=event.is_tied_to,
                slur_group=event.slur_group,
            )
        new_event.pitches = unique
        return new_event

    return None


def _adjust_octave(midi: int, low: int, high: int) -> int:
    """將音高移到 [low, high] 區間內 (以八度為單位)。"""
    while midi < low:
        midi += 12
    while midi > high:
        midi -= 12
    return midi

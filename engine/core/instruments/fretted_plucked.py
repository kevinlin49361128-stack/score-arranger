"""
有品撥弦樂器 (fretted plucked) 共用和弦可行性檢查 — 古典吉他 / 魯特琴

與擦弦樂器 (violin/viola/cello) 的核心差異:
- 擦弦: 一弓只能掃連續的弦 → 使用的弦「必須相鄰」。
- 撥弦: 每根弦由手指/撥片獨立撥動, 可略過或悶住中間的弦 →
  使用的弦「不需相鄰」。
- 撥弦樂器可同時發聲六根弦 (六音和弦), 遠多於擦弦的四音上限。

本模組的 check_fretted_plucked() 結構鏡像 violin.py 的 check_violin_chord:
  1. 音數檢查 (≤ 弦數)
  2. 指法搜尋 (find_best_fingering, 但 require_adjacent=False)
  3. fret 過高 / stretch 過大 → warning
不同點: 不檢查「弦相鄰」(撥弦樂器本來就可跨弦)。
"""

from __future__ import annotations

from core.ir import Pitch

from .base import (
    CheckResult,
    InstrumentProfile,
    SuggestionStub,
    check_pitch_in_range,
)


def check_fretted_plucked(
    chord_pitches: list[Pitch],
    profile: InstrumentProfile,
    max_fret: int,
) -> CheckResult:
    """有品撥弦樂器 (吉他 / 魯特琴) 的和弦可行性檢查。

    Args:
        chord_pitches: 同時發聲的音高 (實音 / concert pitch)。
        profile: 樂器 profile (需含 strings)。
        max_fret: 此樂器最高可用把位 (吉他 ~19, 魯特琴 ~12)。
    """
    assert profile.strings is not None
    strings = profile.strings
    iid = profile.instrument_id

    if len(chord_pitches) == 0:
        return CheckResult(severity="ok")

    if len(chord_pitches) == 1:
        # 單音 — 委派給音域檢查
        return check_pitch_in_range(chord_pitches[0], profile)

    # 1. 音數 ≤ 弦數 (吉他/魯特琴皆六弦)
    if len(chord_pitches) > len(strings):
        return CheckResult(
            severity="error",
            code="E_STRING_CHORD_EXCEED",
            params={
                "instrument": iid,
                "chord_size": len(chord_pitches),
                "max": len(strings),
            },
            suggestions=[
                SuggestionStub(code="S_SPLIT_TO_PARTS"),
                SuggestionStub(code="S_OMIT_NOTE"),
                SuggestionStub(code="S_ARPEGGIATE"),
                SuggestionStub(code="S_REASSIGN_TO_OTHER_PART"),
            ],
        )

    # 2. 指法搜尋 — 撥弦樂器: require_adjacent=False (弦可跨越)
    from .fingering import find_best_fingering

    fingering = find_best_fingering(
        chord_pitches,
        strings,
        max_fret=max_fret,
        max_stretch_semitones=profile.max_stretch_semitones,
        require_adjacent=False,
    )

    if fingering is None:
        # 找不到合法指法: 判斷原因
        sorted_chord = sorted(chord_pitches, key=lambda p: p.midi_number)
        lowest = sorted_chord[0]
        if lowest.midi_number < strings[0].open_pitch.midi_number:
            return CheckResult(
                severity="error",
                code="E_NOTE_BELOW_STRING",
                params={
                    "instrument": iid,
                    "note": lowest.spelling,
                    "string": strings[0].open_pitch.spelling,
                },
                suggestions=[
                    SuggestionStub(code="S_OCTAVE_UP", params={"note": lowest.spelling}),
                    SuggestionStub(code="S_OMIT_NOTE", params={"note": lowest.spelling}),
                    SuggestionStub(code="S_REASSIGN_TO_OTHER_PART"),
                ],
            )
        # 撥弦樂器不會因「弦不相鄰」失敗; 走到這裡是因為 fret 過高 /
        # 同弦撞音 / stretch 在所有指法組合下都超限。
        return CheckResult(
            severity="error",
            code="E_FRETTED_CHORD_INFEASIBLE",
            params={"instrument": iid},
            suggestions=[
                SuggestionStub(code="S_REVOICE_CHORD"),
                SuggestionStub(code="S_OMIT_NOTE"),
                SuggestionStub(code="S_ARPEGGIATE"),
            ],
        )

    # 3a. fret 過高 (高把位難按)
    max_used_fret = max((a[2] for a in fingering.assignments), default=0)
    if max_used_fret > max_fret:
        # find_best_fingering 已用 max_fret 過濾, 此處為防禦性檢查
        return CheckResult(
            severity="error",
            code="E_FRETTED_FRET_TOO_HIGH",
            params={"instrument": iid, "fret": max_used_fret, "max": max_fret},
        )

    # 3b. stretch 過大 (同把位內跨度)
    fret_positions = [a[2] for a in fingering.assignments if a[2] > 0]
    if len(fret_positions) >= 2:
        stretch = max(fret_positions) - min(fret_positions)
        if stretch > profile.comfortable_stretch_semitones:
            return CheckResult(
                severity="warning",
                code="W_FRETTED_STRETCH_LARGE",
                params={
                    "instrument": iid,
                    "stretch": stretch,
                    "comfortable": profile.comfortable_stretch_semitones,
                },
                difficulty_score=min(
                    stretch / max(profile.max_stretch_semitones, 1), 1.0,
                ),
                suggestions=[SuggestionStub(code="S_REVOICE_CHORD")],
            )

    # 高把位 (即使沒超 max_fret) 仍提示難度
    if max_used_fret > 12:
        return CheckResult(
            severity="warning",
            code="W_FRETTED_HIGH_POSITION",
            params={"instrument": iid, "fret": max_used_fret},
            difficulty_score=min((max_used_fret - 12) / 7.0 + 0.3, 1.0),
        )

    # 一切正常 — 把位高度換算難度分數
    avg_fret = sum(a[2] for a in fingering.assignments) / max(
        len(fingering.assignments), 1,
    )
    return CheckResult(
        severity="ok",
        difficulty_score=min(avg_fret / 12.0, 1.0),
    )

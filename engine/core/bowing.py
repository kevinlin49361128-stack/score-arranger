"""B3: 建議弓法 / 圓滑線 (opt-in, 選擇性) — 對弦樂聲部「保守地」加上:
  - 圓滑線 (slur): 連續級進/小跳的快速音群 → 連弓 (legato 樂句)。
  - 弓法 (bow): 每小節第一個音 (強拍) 標下弓 (∏)。

為何做成 opt-in 且「選擇性」而非每個音都標:
  真實樂譜的弓法是選擇性標註 —— 每個音都標下上下上反而塞滿譜面、看起來
  業餘。這裡只在「小節強拍起點 / 明顯的快速級進音群」這種慣例位置標, 且
  由使用者主動觸發, 不在每次改編自動套。生成的弓法/圓滑線會匯出到
  MusicXML (ir_to_musicxml 已支援 up-bow/down-bow + slur) 並餵 A1/A2 播放。
"""
from __future__ import annotations

from .ir import NoteEvent, Score, TechniqueAnnotation

# 哪些樂器算「弓弦」(套用弓法/圓滑線)
_BOWED_STRINGS = {"violin", "viola", "cello", "double_bass", "contrabass"}

# 圓滑線啟發式門檻
_SLUR_MIN_RUN = 3          # 至少連續幾個音才連弓
_SLUR_MAX_STEP = 3         # 相鄰音 |半音差| ≤ 此值才算「級進/小跳」
_SLUR_MAX_QL = 0.75        # 只連「快速音」(時值 ≤ 此值, 四分=1.0)


def _max_slur_group(score: Score) -> int:
    hi = 0
    for part in score.parts:
        for m in part.measures:
            for v in m.voices.values():
                for ev in v.events:
                    g = getattr(ev, "slur_group", None)
                    if isinstance(g, int) and g > hi:
                        hi = g
    return hi


def apply_bowing(score: Score) -> int:
    """對 score 內所有弓弦聲部套用選擇性弓法 + 圓滑線。就地修改, 回傳變更數。"""
    next_slur = _max_slur_group(score) + 1
    changes = 0
    for part in score.parts:
        if part.instrument_id not in _BOWED_STRINGS:
            continue
        for measure in part.measures:
            for voice in measure.voices.values():
                if voice.is_divisi:
                    continue
                changes += _bow_measure_start(voice.events)
                next_slur, added = _slur_runs(voice.events, next_slur)
                changes += added
    return changes


def _bow_measure_start(events: list) -> int:
    """每小節第一個音 (強拍) 標下弓 — 已有弓法 / 鎖定者不動。"""
    for ev in events:
        if not isinstance(ev, NoteEvent):
            continue
        if getattr(ev, "is_locked", False):
            return 0
        tech = ev.technique
        if tech is not None and tech.bow_direction is not None:
            return 0  # 使用者/來源已標
        if tech is None:
            ev.technique = TechniqueAnnotation(bow_direction="down")
        else:
            tech.bow_direction = "down"
        return 1
    return 0


def _slur_runs(events: list, next_slur: int) -> tuple[int, int]:
    """把連續的快速級進音群連弓 (slur)。回傳 (下一個可用 slur_group, 變更數)。"""
    added = 0
    run: list[NoteEvent] = []

    def flush() -> int:
        nonlocal next_slur
        if len(run) >= _SLUR_MIN_RUN:
            for n in run:
                n.slur_group = next_slur
            next_slur += 1
            return len(run)
        return 0

    prev: NoteEvent | None = None
    for ev in events:
        ok = (
            isinstance(ev, NoteEvent)
            and not getattr(ev, "is_locked", False)
            and ev.slur_group is None
            and "staccato" not in ev.articulations
            and "staccatissimo" not in ev.articulations
            and float(ev.duration) <= _SLUR_MAX_QL
        )
        if ok and prev is not None:
            step = abs(ev.pitch.midi_number - prev.pitch.midi_number)
            ok = step <= _SLUR_MAX_STEP
        if ok:
            run.append(ev)
            prev = ev
        else:
            added += flush()
            run = []
            prev = None
            # 起新 run: 此音本身若符合單音條件, 當下一段起點
            if (
                isinstance(ev, NoteEvent)
                and not getattr(ev, "is_locked", False)
                and ev.slur_group is None
                and float(ev.duration) <= _SLUR_MAX_QL
                and "staccato" not in ev.articulations
            ):
                run = [ev]
                prev = ev
    added += flush()
    return next_slur, added

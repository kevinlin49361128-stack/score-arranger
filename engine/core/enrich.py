"""
諧波豐富化 (Harmonic Enrichment) — Phase A: 方塊和弦

使用情境:
  改編成吉他 (或其他可彈和弦的樂器) 後, 聲部常常偏稀疏 (只剩旋律 / 旋律
  +低音)。使用者覺得「和弦太少 / 不夠難」時, 想把譜加厚。

核心觀念 — 不是「無中生有編和聲」:
  原始總譜本來就有完整和聲; 改編為了可演奏性把它變稀疏。本模組做的是
  「把改編時被捨棄的和聲, 重新投影回目標樂器」—— 每個旋律單音, 查
  *原始 source score* 在同一時間點實際發響的音, 取其音級補成方塊和弦。
  因此產生的和弦保證與原曲和聲一致, 不會亂編、不會不和諧。

可演奏性:
  補出的候選和弦一律送 check_guitar_chord 過閘; 彈不出來就由低到高
  逐一刪掉新增音, 直到可演奏 (最差情況退回原本單音, 等於不改)。

設計約束 (對應 CLAUDE.md):
  - 旋律音永遠保留且維持在和弦頂端 → 新增音一律加在旋律音「下方」。
  - 低音域的音 (midi < BASS_FLOOR) 視為低音聲部, 下方沒有空間, 略過不動。
  - 鎖定 (is_locked) 的事件不碰。
"""

from __future__ import annotations

from fractions import Fraction

from core.ir import ChordEvent, NoteEvent, Pitch, Score

# 低於此音高的音視為低音聲部 — 下方沒有加和弦的空間, 略過 (~E3)
BASS_FLOOR = 52
# 吉他最低實音 (空弦 E2)
GUITAR_LOW = 40
# 一個方塊和弦最多幾個音 (含旋律音本身)
MAX_CHORD_SIZE = 4

_PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

Density = str  # "light" | "medium" | "full"


def _pitch_classes_at(
    source: Score, measure_number: int, onset: Fraction,
) -> set[int]:
    """source score 在 (小節, onset) 這個時間點實際發響的所有音級 (0-11)。"""
    pcs: set[int] = set()
    for part in source.parts:
        for measure in part.measures:
            if measure.number != measure_number:
                continue
            for voice in measure.voices.values():
                branches = (
                    voice.divisi_branches
                    if getattr(voice, "is_divisi", False) and voice.divisi_branches
                    else [voice]
                )
                for br in branches:
                    for ev in br.events:
                        if not isinstance(ev, (NoteEvent, ChordEvent)):
                            continue
                        # 事件涵蓋此 onset (含起點, 不含終點)
                        if not (ev.onset <= onset < ev.onset + ev.duration):
                            continue
                        if isinstance(ev, NoteEvent):
                            pcs.add(ev.pitch.midi_number % 12)
                        else:
                            for p in ev.pitches:
                                pcs.add(p.midi_number % 12)
    return pcs


def _voice_below(pc: int, ceiling_midi: int) -> int | None:
    """把音級 pc 放到 ceiling_midi 下方、最接近 ceiling 的八度。

    回傳 midi number, 或 None (吉他音域內塞不下)。
    """
    # 找最大的 m, 使 m % 12 == pc 且 m < ceiling_midi
    m = ceiling_midi - 1
    while m >= GUITAR_LOW:
        if m % 12 == pc:
            return m
        m -= 1
    return None


def _make_pitch(midi: int) -> Pitch:
    return Pitch(midi_number=midi, spelling=f"{_PC_NAMES[midi % 12]}{midi // 12 - 1}")


def _should_enrich(onset: Fraction, density: Density) -> bool:
    """依密度決定這個 onset 上的音要不要加和弦。"""
    if density == "full":
        return True
    if density == "light":
        return onset == 0  # 只動第一拍
    # medium: 落在整數拍上的音 (強拍傾向)
    return onset.denominator == 1


def _playable_chord(midis: list[int]) -> list[int] | None:
    """把候選和弦 (midi list, 已含旋律音) 過吉他可演奏性閘門。

    彈不出來就由低到高刪新增音再試; 回傳最終可演奏的 midi list
    (至少含旋律音本身), 全刪到只剩單音則回傳 None (表示不需改)。
    """
    from core.instruments.guitar import check_guitar_chord

    notes = sorted(set(midis))
    melody = notes[-1]  # 旋律音 = 最高音
    while len(notes) >= 2:
        result = check_guitar_chord([_make_pitch(m) for m in notes])
        if result.severity != "error":
            return notes
        # 不可演奏 → 丟掉最低的新增音 (不丟旋律音)
        notes = [n for n in notes if n != notes[0] or n == melody]
        if notes and notes[0] == melody:
            break
    return None


def enrich_part(
    part_measures: list,
    source: Score,
    measure_start: int,
    measure_end: int,
    density: Density = "medium",
) -> int:
    """把目標聲部 [measure_start, measure_end] 的旋律單音擴成方塊和弦。

    就地修改 part_measures (list[Measure]); 回傳實際改動的事件數。

    Args:
        part_measures: 目標 Part 的 measures。
        source: arrangement 的原始 source score (和聲來源)。
        measure_start / measure_end: 小節範圍 (含端點)。
        density: "light" | "medium" | "full" — 加和弦的密度。
    """
    changed = 0
    for measure in part_measures:
        if not measure_start <= measure.number <= measure_end:
            continue
        for voice in measure.voices.values():
            if getattr(voice, "is_divisi", False):
                continue
            for idx, ev in enumerate(voice.events):
                # 只處理「未鎖定的旋律單音」; 和弦/休止符/低音不動
                if not isinstance(ev, NoteEvent):
                    continue
                if getattr(ev, "is_locked", False):
                    continue
                if ev.pitch.midi_number < BASS_FLOOR:
                    continue
                if not _should_enrich(ev.onset, density):
                    continue

                melody_midi = ev.pitch.midi_number
                melody_pc = melody_midi % 12
                src_pcs = _pitch_classes_at(source, measure.number, ev.onset)
                add_pcs = sorted(src_pcs - {melody_pc})
                if not add_pcs:
                    continue

                # 把新增音級各自配到旋律音下方的八度
                candidate = [melody_midi]
                for pc in add_pcs:
                    m = _voice_below(pc, melody_midi)
                    if m is not None and m not in candidate:
                        candidate.append(m)
                # 由高到低保留 (靠近旋律的優先), 上限 MAX_CHORD_SIZE
                candidate = sorted(candidate, reverse=True)[:MAX_CHORD_SIZE]
                if len(candidate) < 2:
                    continue

                playable = _playable_chord(candidate)
                if playable is None or len(playable) < 2:
                    continue

                voice.events[idx] = ChordEvent(
                    pitches=[_make_pitch(m) for m in sorted(playable)],
                    duration=ev.duration,
                    onset=ev.onset,
                    articulations=list(ev.articulations),
                    dynamic=ev.dynamic,
                    is_tied_from=ev.is_tied_from,
                    is_tied_to=ev.is_tied_to,
                    slur_group=ev.slur_group,
                )
                changed += 1
    return changed

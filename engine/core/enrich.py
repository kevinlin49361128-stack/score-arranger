"""
諧波豐富化 (Harmonic Enrichment)

  Phase A — 方塊和弦 (block)
  Phase B — 織體 (texture): block / arpeggio / strum
  Phase C — 難度目標 (target difficulty): 自動挑密度
  Phase D — 樂器感知 + 八度疊置 (octave): 弦樂雙音 / 八度

使用情境:
  改編成吉他 / 小提琴等樂器後, 聲部常常偏稀疏 (只剩旋律 / 旋律+低音)。
  使用者覺得「和弦太少 / 不夠難」時, 想把譜加厚 / 加技巧難度。

核心觀念 — 不是「無中生有編和聲」:
  block / arpeggio / strum 織體: 原始總譜本來就有完整和聲; 改編為了
  可演奏性把它變稀疏。本模組做的是「把改編時被捨棄的和聲, 重新投影
  回目標樂器」—— 每個旋律單音, 查 *原始 source score* 在同一時間點
  實際發響的音, 取其音級補成和弦。因此產生的和弦保證與原曲和聲一致。

  octave 織體: 把旋律音本身疊上低八度, 形成八度雙音。這不查 source、
  不引入新音級, 只是把既有音複製到八度 —— 同樣不是「編和聲」, 而是
  加演奏技巧難度 (小提琴八度雙音 / 吉他八度)。

可演奏性 — 樂器感知:
  補出的候選和弦一律送「對應樂器的和弦檢查器」過閘 (小提琴 →
  check_violin_chord、中/大提琴同理、吉他/魯特琴 → 撥弦檢查器)。
  彈不出來就由低到高逐一刪掉新增音, 直到可演奏 (最差退回原本單音,
  等於不改)。

設計約束 (對應 CLAUDE.md):
  - 旋律音永遠保留且維持在和弦頂端 → 新增音一律加在旋律音「下方」。
  - 低於樂器音域下限的音放不下, 略過。
  - 鎖定 (is_locked) 的事件不碰。
"""

from __future__ import annotations

from collections.abc import Callable
from fractions import Fraction

from core.ir import ChordEvent, NoteEvent, Ornament, Pitch, Score

# 低於此音高的音視為低音聲部 — 下方沒有加和弦的空間, 略過 (~E3)
BASS_FLOOR = 52
# 找不到樂器 profile 時的預設音域下限 (吉他空弦 E2)
DEFAULT_LOW = 40
# 一個方塊和弦最多幾個音 (含旋律音本身)
MAX_CHORD_SIZE = 4

_PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

Density = str  # "light" | "medium" | "full"
Texture = str  # "block" | "arpeggio" | "strum" | "octave"

ChordChecker = Callable[[list[Pitch]], object]


def _chord_checker(instrument_id: str) -> ChordChecker:
    """回傳該樂器的和弦可演奏性檢查函式。

    弦樂 (小提琴/中提琴/大提琴) 用各自的弓弦檢查器 (≤4 音、相鄰弦);
    撥弦 (吉他/魯特琴) 用各自的檢查器; 其餘退回吉他檢查器。
    """
    iid = (instrument_id or "").lower()
    if "violin" in iid:
        from core.instruments.violin import check_violin_chord
        return check_violin_chord
    if "viola" in iid:
        from core.instruments.viola import check_viola_chord
        return check_viola_chord
    if "cello" in iid or "violoncello" in iid:
        from core.instruments.cello import check_cello_chord
        return check_cello_chord
    if "lute" in iid:
        from core.instruments.lute import check_lute_chord
        return check_lute_chord
    from core.instruments.guitar import check_guitar_chord
    return check_guitar_chord


def _instrument_floor(instrument_id: str) -> int:
    """回傳樂器絕對音域下限; 找不到 profile 時退回吉他預設 (E2)。"""
    try:
        from core.instruments import get_profile
        profile = get_profile(instrument_id)
    except Exception:
        profile = None
    if profile is not None:
        return profile.range_absolute[0]
    return DEFAULT_LOW


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


def _voice_below(pc: int, ceiling_midi: int, floor_midi: int) -> int | None:
    """把音級 pc 放到 ceiling_midi 下方、最接近 ceiling 的八度。

    回傳 midi number, 或 None (樂器音域內塞不下)。
    """
    m = ceiling_midi - 1
    while m >= floor_midi:
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


def _playable_chord(
    midis: list[int], checker: ChordChecker,
) -> list[int] | None:
    """把候選和弦 (midi list, 已含旋律音) 過樂器可演奏性閘門。

    彈不出來就由低到高刪新增音再試; 回傳最終可演奏的 midi list
    (至少含旋律音本身), 全刪到只剩單音則回傳 None (表示不需改)。
    """
    notes = sorted(set(midis))
    melody = notes[-1]  # 旋律音 = 最高音
    while len(notes) >= 2:
        result = checker([_make_pitch(m) for m in notes])
        if getattr(result, "severity", "ok") != "error":
            return notes
        # 不可演奏 → 丟掉最低的新增音 (不丟旋律音)
        notes = [n for n in notes if n != notes[0] or n == melody]
        if notes and notes[0] == melody:
            break
    return None


def _texture_events(ev: NoteEvent, midis: list[int], texture: Texture) -> list:
    """把一組和弦音 (midis, sorted asc, 含旋律音) 依 texture 轉成事件序列。

    - block / octave: 一個方塊和弦 (ChordEvent)。
    - strum: 方塊和弦 + 上行琶音奏法標記 (記譜上的刷弦/滾奏)。
    - arpeggio: 拆成數個 NoteEvent — 旋律音先落原拍點, 其餘和弦音
      由低到高接續, 各佔 duration/N。
    """
    if texture == "arpeggio":
        n = len(midis)
        sub = ev.duration / n
        melody = max(midis)
        order = [melody] + sorted(m for m in midis if m != melody)
        return [
            NoteEvent(
                pitch=_make_pitch(m),
                duration=sub,
                onset=ev.onset + k * sub,
                dynamic=ev.dynamic,
            )
            for k, m in enumerate(order)
        ]
    # block / strum / octave — 單一 ChordEvent
    chord = ChordEvent(
        pitches=[_make_pitch(m) for m in midis],
        duration=ev.duration,
        onset=ev.onset,
        articulations=list(ev.articulations),
        dynamic=ev.dynamic,
        is_tied_from=ev.is_tied_from,
        is_tied_to=ev.is_tied_to,
        slur_group=ev.slur_group,
    )
    if texture == "strum":
        chord.ornament = Ornament(kind="arpeggio_up")
    return [chord]


def _enrich_event(
    ev, source: Score, measure_number: int,
    density: Density, texture: Texture,
    checker: ChordChecker, floor_midi: int,
) -> list | None:
    """回傳 ev 加料後的事件序列; 不需 / 不能加料則回 None。"""
    if not isinstance(ev, NoteEvent):
        return None
    if getattr(ev, "is_locked", False):
        return None
    if ev.pitch.midi_number < BASS_FLOOR:
        return None
    if not _should_enrich(ev.onset, density):
        return None

    melody_midi = ev.pitch.midi_number

    if texture == "octave":
        # 八度疊置 — 不查 source 和聲, 直接把旋律音疊低八度成八度雙音。
        low = melody_midi - 12
        if low < floor_midi:
            return None  # 旋律音太低, 下方塞不下八度
        playable = _playable_chord([low, melody_midi], checker)
        if playable is None or len(playable) < 2:
            return None
        return _texture_events(ev, sorted(playable), "block")

    src_pcs = _pitch_classes_at(source, measure_number, ev.onset)
    add_pcs = sorted(src_pcs - {melody_midi % 12})
    if not add_pcs:
        return None

    candidate = [melody_midi]
    for pc in add_pcs:
        m = _voice_below(pc, melody_midi, floor_midi)
        if m is not None and m not in candidate:
            candidate.append(m)
    # 由高到低保留 (靠近旋律的優先), 上限 MAX_CHORD_SIZE
    candidate = sorted(candidate, reverse=True)[:MAX_CHORD_SIZE]
    if len(candidate) < 2:
        return None

    playable = _playable_chord(candidate, checker)
    if playable is None or len(playable) < 2:
        return None
    return _texture_events(ev, sorted(playable), texture)


def enrich_part(
    part_measures: list,
    source: Score,
    measure_start: int,
    measure_end: int,
    density: Density = "medium",
    texture: Texture = "block",
    instrument_id: str = "guitar",
) -> int:
    """把目標聲部 [measure_start, measure_end] 的旋律單音擴成和弦 / 八度。

    就地修改 part_measures (list[Measure]); 回傳實際改動的事件數。

    Args:
        part_measures: 目標 Part 的 measures。
        source: arrangement 的原始 source score (和聲來源)。
        measure_start / measure_end: 小節範圍 (含端點)。
        density: "light" | "medium" | "full" — 加料的密度。
        texture: "block" | "arpeggio" | "strum" | "octave" — 加出來的織體。
        instrument_id: 目標樂器 — 決定用哪個和弦可演奏性檢查器與音域下限。
    """
    checker = _chord_checker(instrument_id)
    floor_midi = _instrument_floor(instrument_id)
    changed = 0
    for measure in part_measures:
        if not measure_start <= measure.number <= measure_end:
            continue
        for voice in measure.voices.values():
            if getattr(voice, "is_divisi", False):
                continue
            new_events: list = []
            voice_changed = False
            for ev in voice.events:
                produced = _enrich_event(
                    ev, source, measure.number, density, texture,
                    checker, floor_midi,
                )
                if produced is None:
                    new_events.append(ev)
                else:
                    new_events.extend(produced)
                    voice_changed = True
                    changed += 1
            if voice_changed:
                voice.events = new_events
    return changed

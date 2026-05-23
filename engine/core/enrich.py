"""
諧波豐富化 (Harmonic Enrichment)

  Phase A — 方塊和弦 (block)
  Phase B — 織體 (texture): block / arpeggio / strum
  Phase C — 難度目標 (target difficulty): 自動挑密度
  Phase D — 樂器感知 + 八度疊置 (octave): 弦樂雙音 / 八度
  Phase E (0.1.23) — 樂器邏輯全套修:
    1. monophonic 樂器 (木管/銅管/人聲) 一律拒絕 — 物理上不能同時發兩音
    2. 鍵盤 (piano/harpsichord) 走 polyphony + hand_span checker, 不再
       誤套吉他 ≤4 音相鄰弦
    3. 收 skill_level — amateur 限 2 音 / intermediate ≤3 / professional ≤4
    4. 弦樂 3+ 音和弦自動加 arpeggiate ornament (broken chord 演奏標記)
    5. _pitch_classes_at 改抓 ±1 beat window — 分解和弦 source 也能補
    6. piano 專屬紋理 alberti / waltz — 把和弦拆成低音+上方音模式

使用情境:
  改編成吉他 / 小提琴等樂器後, 聲部常常偏稀疏 (只剩旋律 / 旋律+低音)。
  使用者覺得「和弦太少 / 不夠難」時, 想把譜加厚 / 加技巧難度。

核心觀念 — 不是「無中生有編和聲」:
  block / arpeggio / strum / alberti / waltz 織體: 原始總譜本來就有完整
  和聲; 改編為了可演奏性把它變稀疏。本模組做的是「把改編時被捨棄的和聲,
  重新投影回目標樂器」—— 每個旋律單音, 查 *原始 source score* 在同一
  時間點 ±1 beat 範圍實際發響的音, 取其音級補成和弦。因此產生的和弦
  保證與原曲和聲一致。

  octave 織體: 把旋律音本身疊上低八度, 形成八度雙音。這不查 source、
  不引入新音級, 只是把既有音複製到八度 —— 同樣不是「編和聲」, 而是
  加演奏技巧難度 (小提琴八度雙音 / 吉他八度)。

可演奏性 — 樂器感知:
  補出的候選和弦一律送「對應樂器的和弦檢查器」過閘:
    - 弦樂 (violin/viola/cello): ≤4 音、相鄰弦 + 弓法
    - 撥弦 (guitar/lute): 任意弦組合
    - 鍵盤 (piano/harpsichord): polyphony + 手距
    - 單音樂器 (woodwind/brass/voice): 直接拒絕
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
from typing import Optional

from core.ir import ChordEvent, NoteEvent, Ornament, Pitch, Score

# 低於此音高的音視為低音聲部 — 下方沒有加和弦的空間, 略過 (~E3)
BASS_FLOOR = 52
# 找不到樂器 profile 時的預設音域下限 (吉他空弦 E2)
DEFAULT_LOW = 40
# 一個方塊和弦最多幾個音 (含旋律音本身)
MAX_CHORD_SIZE = 4
# Skill level → 和弦上限 (含旋律音)
_SKILL_MAX_CHORD = {
    "amateur": 2,        # 業餘: 限雙音 (八度 / 雙音為主)
    "intermediate": 3,   # 中級: 三音和弦
    "professional": 4,   # 職業: 全 4 音
}
# beat window 寬度 — 抓 source 和聲時往前後各看這麼多 beat (fraction).
# 0.5 = 半拍, 對分解和弦 (Alberti / 三連音) 剛好夠抓到主和聲框架.
_PITCH_WINDOW = Fraction(1, 2)

_PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

Density = str  # "light" | "medium" | "full"
Texture = str  # "block" | "arpeggio" | "strum" | "octave" | "alberti" | "waltz"
SkillLevel = str  # "amateur" | "intermediate" | "professional"

ChordChecker = Callable[[list[Pitch]], object]


def _is_monophonic(instrument_id: str) -> bool:
    """單音樂器 — 物理上不能同時發兩個音 (除現代 multiphonics 技巧).

    管樂 (flute/oboe/clarinet/bassoon/sax) + 銅管 (trumpet/horn/trombone/tuba)
    + 人聲 (soprano/alto/tenor/bass voice) 全部一律拒絕 enrich. 之前 fallback
    到 guitar checker, guitar checker 不知道 flute 不是吉他, 會放行 4 音和弦
    產出物理不可能演奏的譜 — 真實 bug.
    """
    iid = (instrument_id or "").lower()
    # 啟發式 fallback — registry 用 "trumpet_bb" 等具體 ID, 但 Part.instrument_id
    # 在某些 import / 移植路徑可能只給 "trumpet". 先做 name match 再查 registry,
    # 確保「看起來像單音樂器的名字」就一律擋下.
    _MONO_KEYWORDS = (
        "flute", "piccolo", "oboe", "clarinet", "bassoon", "saxophone",
        "sax", "recorder",  # woodwind
        "trumpet", "horn", "trombone", "tuba", "cornet", "euphonium",  # brass
        "soprano", "alto", "tenor", "baritone", "voice", "vocals",  # voice
    )
    if any(kw in iid for kw in _MONO_KEYWORDS):
        return True
    try:
        from core.instruments import get_profile
        profile = get_profile(instrument_id)
    except Exception:
        return False
    if profile is None:
        return False
    if profile.family in ("woodwind", "brass", "voice"):
        return True
    # max_simultaneous_notes 直接給的是 1 → 一律單音
    return getattr(profile, "max_simultaneous_notes", 99) <= 1


def _chord_checker(instrument_id: str) -> ChordChecker:
    """回傳該樂器的和弦可演奏性檢查函式。

    弦樂 (小提琴/中提琴/大提琴) 用各自的弓弦檢查器 (≤4 音、相鄰弦);
    撥弦 (吉他/魯特琴) 用各自的檢查器;
    鍵盤 (piano/harpsichord) 用 polyphony + hand_span checker;
    其餘退回吉他檢查器 (作為通用 fallback).
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
    if "harpsichord" in iid or "clavecin" in iid or "cembalo" in iid:
        # 大鍵琴: polyphony + hand_span — 不再走 guitar fallback
        # (大鍵琴的限制是 hand_span ≤ octave, 不是「相鄰弦」)
        from core.instruments.piano import check_piano_chord_polyphony
        return check_piano_chord_polyphony
    if "piano" in iid or "keyboard" in iid:
        from core.instruments.piano import check_piano_chord_polyphony
        return check_piano_chord_polyphony
    from core.instruments.guitar import check_guitar_chord
    return check_guitar_chord


def _is_bowed_string(instrument_id: str) -> bool:
    """是否是弓弦樂器 — 用來決定要不要加 broken chord ornament."""
    iid = (instrument_id or "").lower()
    return any(s in iid for s in ("violin", "viola", "cello", "violoncello"))


def _is_keyboard(instrument_id: str) -> bool:
    """是否是鍵盤樂器 — 用來放行 alberti / waltz 紋理."""
    iid = (instrument_id or "").lower()
    return any(s in iid for s in ("piano", "harpsichord", "keyboard"))


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


def _max_chord_for_skill(skill_level: SkillLevel) -> int:
    """技能等級對應的和弦上限 — 跟 0.1.14 'B 技能感知分譜' 邏輯一致。"""
    return _SKILL_MAX_CHORD.get(skill_level, MAX_CHORD_SIZE)


def _pitch_classes_at(
    source: Score, measure_number: int, onset: Fraction,
    window: Fraction = _PITCH_WINDOW,
) -> set[int]:
    """source score 在 (小節, onset) 周圍 ±window 範圍實際發響的所有音級.

    window 不為 0 時往前後抓 — 對分解和弦 (Alberti / 三連音) source 有用,
    僅看當前 onset 會只抓到一個音 (旋律單音本身), 無法補回原曲和聲.
    抓到後扣掉旋律音的音級, 剩下的就是該補的和聲音級.
    """
    pcs: set[int] = set()
    lo = onset - window
    hi = onset + window
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
                        # 事件涵蓋此 onset 窗 (overlap, 非嚴格包含)
                        ev_end = ev.onset + ev.duration
                        if ev_end <= lo or ev.onset >= hi:
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


def _texture_events(
    ev: NoteEvent, midis: list[int], texture: Texture,
    is_bowed_string: bool = False,
) -> list:
    """把一組和弦音 (midis, sorted asc, 含旋律音) 依 texture 轉成事件序列。

    - block / octave: 一個方塊和弦 (ChordEvent)。弓弦樂 3+ 音自動加
      arpeggiate ornament (實務上 violin 3-4 音和弦演奏是 broken chord).
    - strum: 方塊和弦 + 上行琶音奏法標記 (記譜上的刷弦/滾奏)。
    - arpeggio: 拆成數個 NoteEvent — 旋律音先落原拍點, 其餘和弦音
      由低到高接續, 各佔 duration/N。
    - alberti: 鋼琴專用 — 低音→上方→中間→上方 (Mozart-style 4 拍 pattern).
    - waltz: 鋼琴專用 — 低音 + 兩次上方和弦 (3 拍華爾茲).
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

    if texture == "alberti":
        # 古典 Alberti bass — 4 拍循環: 最低音 / 最高音 / 中間音 / 最高音.
        # 旋律音在頂端, 不參與循環, 旋律仍在原拍點獨立彈出. alberti pattern
        # 加在「旋律音之外」的伴奏聲部.
        # 實作上: 把旋律音記回原拍, 同時把伴奏 (低音 + 中間音) 拆成 4 拍 pattern.
        return _alberti_or_waltz_events(ev, midis, kind="alberti")

    if texture == "waltz":
        # 3 拍華爾茲 — 低音 / 上方和弦 / 上方和弦.
        return _alberti_or_waltz_events(ev, midis, kind="waltz")

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
    elif texture in ("block", "octave") and is_bowed_string and len(midis) >= 3:
        # 弓弦樂 3+ 音和弦 — 實務上是 broken chord (拆成兩組 double stop 連奏),
        # 不是「同時拉 4 弦」. 自動標 arpeggiate ornament 讓 OSMD 渲染 broken
        # bracket, 演奏者一看就懂.
        chord.ornament = Ornament(kind="arpeggio_up")
    return [chord]


def _alberti_or_waltz_events(
    ev: NoteEvent, midis: list[int], kind: str,
) -> list:
    """Alberti / waltz 共用實作.

    midis 是「含旋律音的整個和弦」, 旋律音 = 最高音 (沿原 ev 落拍, 維持
    可辨識主題). 伴奏音 = 其餘音, 拆成 alberti / waltz pattern.
    """
    melody_midi = max(midis)
    accomp = sorted(m for m in midis if m != melody_midi)
    if len(accomp) < 2:
        # 沒足夠伴奏音 → 退回單一方塊和弦
        chord = ChordEvent(
            pitches=[_make_pitch(m) for m in midis],
            duration=ev.duration,
            onset=ev.onset,
            articulations=list(ev.articulations),
            dynamic=ev.dynamic,
        )
        return [chord]

    if kind == "alberti":
        # 4 拍 pattern: low / high / mid / high. low=accomp[0] (最低),
        # high=accomp[-1] (最高), mid=accomp 中間 (如果只有 2 個音, mid 用 low).
        low = accomp[0]
        high = accomp[-1]
        mid = accomp[len(accomp) // 2] if len(accomp) >= 3 else low
        seq = [low, high, mid, high]
    else:  # waltz
        # 3 拍 pattern: low / chord_above / chord_above
        low = accomp[0]
        upper_chord = [m for m in accomp if m > low]
        seq = [[low], upper_chord, upper_chord] if upper_chord else \
              [[low], [low], [low]]

    n = len(seq)
    sub = ev.duration / n
    out = []
    for k, item in enumerate(seq):
        onset = ev.onset + k * sub
        if isinstance(item, int):
            out.append(NoteEvent(
                pitch=_make_pitch(item), duration=sub, onset=onset,
                dynamic=ev.dynamic,
            ))
        else:  # list[int] — waltz upper chord
            # ChordEvent 要求 ≥ 2 音 — 單音時退回 NoteEvent.
            if len(item) >= 2:
                out.append(ChordEvent(
                    pitches=[_make_pitch(m) for m in item],
                    duration=sub, onset=onset, dynamic=ev.dynamic,
                ))
            elif len(item) == 1:
                out.append(NoteEvent(
                    pitch=_make_pitch(item[0]), duration=sub, onset=onset,
                    dynamic=ev.dynamic,
                ))
    # 旋律音獨立加 (上方旋律 + 下方 alberti/waltz 伴奏) — 給 piano 用兩手
    out.append(NoteEvent(
        pitch=_make_pitch(melody_midi), duration=ev.duration,
        onset=ev.onset, dynamic=ev.dynamic,
        articulations=list(ev.articulations),
    ))
    return out


def _enrich_event(
    ev, source: Score, measure_number: int,
    density: Density, texture: Texture,
    checker: ChordChecker, floor_midi: int,
    max_chord_size: int,
    is_bowed_string: bool,
    is_keyboard: bool,
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

    # alberti / waltz 是 keyboard 專屬 — 其他樂器退回 block
    effective_texture = texture
    if texture in ("alberti", "waltz") and not is_keyboard:
        effective_texture = "block"

    if effective_texture == "octave":
        # 八度疊置 — 不查 source 和聲, 直接把旋律音疊低八度成八度雙音。
        low = melody_midi - 12
        if low < floor_midi:
            return None  # 旋律音太低, 下方塞不下八度
        playable = _playable_chord([low, melody_midi], checker)
        if playable is None or len(playable) < 2:
            return None
        return _texture_events(ev, sorted(playable), "block", is_bowed_string)

    src_pcs = _pitch_classes_at(source, measure_number, ev.onset)
    add_pcs = sorted(src_pcs - {melody_midi % 12})
    if not add_pcs:
        return None

    candidate = [melody_midi]
    for pc in add_pcs:
        m = _voice_below(pc, melody_midi, floor_midi)
        if m is not None and m not in candidate:
            candidate.append(m)
    # 由高到低保留 (靠近旋律的優先), 上限 = min(MAX_CHORD_SIZE, skill_cap).
    candidate = sorted(candidate, reverse=True)[:max_chord_size]
    if len(candidate) < 2:
        return None

    playable = _playable_chord(candidate, checker)
    if playable is None or len(playable) < 2:
        return None
    return _texture_events(
        ev, sorted(playable), effective_texture, is_bowed_string,
    )


def enrich_part(
    part_measures: list,
    source: Score,
    measure_start: int,
    measure_end: int,
    density: Density = "medium",
    texture: Texture = "block",
    instrument_id: str = "guitar",
    skill_level: SkillLevel = "professional",
) -> int:
    """把目標聲部 [measure_start, measure_end] 的旋律單音擴成和弦 / 八度。

    就地修改 part_measures (list[Measure]); 回傳實際改動的事件數。

    Args:
        part_measures: 目標 Part 的 measures。
        source: arrangement 的原始 source score (和聲來源)。
        measure_start / measure_end: 小節範圍 (含端點)。
        density: "light" | "medium" | "full" — 加料的密度。
        texture: "block" | "arpeggio" | "strum" | "octave"
                 | "alberti" | "waltz" — 加出來的織體。
                 alberti / waltz 只對鍵盤生效, 其他樂器自動退回 block.
        instrument_id: 目標樂器 — 決定用哪個和弦可演奏性檢查器與音域下限。
                       單音樂器 (woodwind/brass/voice) 一律拒絕加料 (回 0).
        skill_level: "amateur" / "intermediate" / "professional" —
                     業餘限雙音 / 中級三音 / 職業四音.
    """
    # 單音樂器一律拒絕 — 物理上不能同時發兩音
    if _is_monophonic(instrument_id):
        return 0

    checker = _chord_checker(instrument_id)
    floor_midi = _instrument_floor(instrument_id)
    max_chord_size = _max_chord_for_skill(skill_level)
    is_bowed = _is_bowed_string(instrument_id)
    is_kbd = _is_keyboard(instrument_id)
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
                    checker, floor_midi, max_chord_size, is_bowed, is_kbd,
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

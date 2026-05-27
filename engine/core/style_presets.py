"""
Idiomatic 改編風格 presets — 資料驅動的風格配方.

每個 preset = (arranger 偏好參數 + 後處理 hooks + LLM system prompt 增量)
讓使用者在「目標編制」之外再選「想要的風格」, 引擎自動調整.

目前 preset:
- "classical_string_quartet" (Mozart/Haydn) — 對話式分配, 強化內聲部對位
- "baroque_continuo" (Bach/Corelli) — 走低音 + 自動 figured bass realization
- "film_score_piano" (Williams/Zimmer reduction) — 強化旋律, 簡化和聲, 厚重 bass

設計原則:
- 不破壞既有 arrange() flow, 純粹加 post-processing 步驟
- 每個 preset 可以套用到不同 ensemble (e.g. classical_string_quartet preset
  + violin_piano ensemble 也合理 = 二重奏對話風格)
- presets 可以累加 (用 list 合併效果), 但 Phase 1 單選即可
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class StylePreset:
    preset_id: str
    display_name: str
    description: str
    """套用順序: pre = arrange 之前 (調整 player.skill_level / ranges 等),
       post = arrange 之後 (額外 voice 填充 / continuo realization / 強化 melody)."""
    pre_hooks: list[Callable] = field(default_factory=list)
    post_hooks: list[Callable] = field(default_factory=list)
    """給 LLM 建議 mode 用的額外 system prompt instructions (繁中)."""
    llm_addendum: str = ""


# === Pre/post hook 實作 ===

def _post_emphasize_melody_octave(arrangement) -> None:
    """強化 MELODY: 把第一個 melody-tagged target 的音域上推一個八度
    (若新位置仍在 comfortable range), 模擬 film-score 厚旋律.
    """
    from .instruments import get_profile
    from .ir import NoteEvent, Pitch

    if arrangement.target_score is None:
        return
    melody_assignments = [
        a for a in arrangement.assignments
        if a.function.value == "melody"
    ]
    if not melody_assignments:
        return
    for a in melody_assignments[:1]:
        target_part = next(
            (p for p in arrangement.target_score.parts
             if p.part_id.startswith(a.target_player_id)),
            None,
        )
        if target_part is None:
            continue
        profile = get_profile(a.target_instrument)
        if profile is None:
            continue
        _, range_hi = profile.range_comfortable
        for m in target_part.measures:
            for voice in m.voices.values():
                for ev in voice.events:
                    if isinstance(ev, NoteEvent):
                        new_midi = ev.pitch.midi_number + 12
                        if new_midi <= range_hi:
                            ev.pitch = Pitch(
                                midi_number=new_midi,
                                spelling=_midi_name(new_midi),
                            )


def _post_thicken_bass_octave(arrangement) -> None:
    """電影配樂風: BASS line 加下八度 (若 target 樂器可達). 用 ChordEvent."""
    from .instruments import get_profile
    from .ir import ChordEvent, NoteEvent, Pitch

    if arrangement.target_score is None:
        return
    bass_assignments = [
        a for a in arrangement.assignments
        if a.function.value == "bass"
    ]
    for a in bass_assignments:
        target_part = next(
            (p for p in arrangement.target_score.parts
             if p.part_id.startswith(a.target_player_id)),
            None,
        )
        if target_part is None:
            continue
        profile = get_profile(a.target_instrument)
        if profile is None:
            continue
        range_lo = profile.range_absolute[0]
        for m in target_part.measures:
            for voice in m.voices.values():
                new_events = []
                for ev in voice.events:
                    if isinstance(ev, NoteEvent):
                        lower = ev.pitch.midi_number - 12
                        if lower >= range_lo:
                            chord = ChordEvent(
                                pitches=[
                                    Pitch(midi_number=lower,
                                          spelling=_midi_name(lower)),
                                    ev.pitch,
                                ],
                                duration=ev.duration,
                                onset=ev.onset,
                            )
                            new_events.append(chord)
                        else:
                            new_events.append(ev)
                    else:
                        new_events.append(ev)
                voice.events = new_events


def _post_alberti_bass(arrangement) -> None:
    """把鋼琴左手柱式長和弦展開為阿爾貝蒂低音 (古典伴奏織體)."""
    from .pianistic import apply_pianistic_texture
    apply_pianistic_texture(arrangement, "alberti")


def _post_broken_chord(arrangement) -> None:
    """把鋼琴左手柱式長和弦展開為分解和弦 (浪漫 / 抒情伴奏織體)."""
    from .pianistic import apply_pianistic_texture
    apply_pianistic_texture(arrangement, "broken")


def _post_romantic_tremolo(arrangement) -> None:
    """0.1.51 E1.R — 浪漫管弦織體 tremolo.

    弦樂長音 (≥ 全音符) + 力度 ≥ mf → 改用 tremolo 記譜.
    Verdi / Tchaikovsky / 浪漫管弦縮室內樂時的慣例 — 長音不靜止,
    tremolo 維持張力.

    觸發條件:
      - part 是弦樂族 (string_bowed)
      - NoteEvent.duration ≥ 4 四分音符 (全音符)
      - dynamic ≥ mf (mf / f / ff / fff) — 安靜段不該加 tremolo
      - 還沒有 tremolo ornament (避免重複套)

    動作: 加 Ornament(kind="tremolo") 到該 NoteEvent. MusicXML 端會
    輸出 <tremolo type="single">3</tremolo> 在 <ornaments> 裡.
    """
    from .instruments import get_profile
    from .ir import ChordEvent, NoteEvent, Ornament

    if arrangement.target_score is None:
        return
    _LOUD_DYNAMICS = {"mf", "f", "ff", "fff"}
    LONG_DURATION_THRESHOLD = 4  # 四分音符 = 1.0; 全音符 = 4.0
    for part in arrangement.target_score.parts:
        profile = get_profile(part.instrument_id)
        if profile is None or profile.family != "string_bowed":
            continue
        for measure in part.measures:
            for voice in measure.voices.values():
                for ev in voice.events:
                    if not isinstance(ev, (NoteEvent, ChordEvent)):
                        continue
                    if float(ev.duration) < LONG_DURATION_THRESHOLD:
                        continue
                    dyn = getattr(ev, "dynamic", None)
                    if dyn not in _LOUD_DYNAMICS:
                        continue
                    if getattr(ev, "ornament", None) is not None:
                        continue
                    ev.ornament = Ornament(kind="tremolo")


def _post_classical_unison_spread(arrangement) -> None:
    """0.1.50 E1.C — Mozart / Haydn 弦樂四重奏 unison 自動八度散開.

    Source 兩把小提琴 unison (同音 + 同時值) 時, target 自動把 violin I
    上推 8va. Mozart/Haydn 的弦樂四重奏實際慣例 — 同度 doubling 太鋼琴感,
    八度 doubling 才合古典室內樂審美.

    觸發: violin_1 + violin_2 part 都存在, 且 violin_1 的 NoteEvent
    與 violin_2 同 onset 同 midi_number → violin_1 提升 8va (檢查不超
    violin 高音範圍).

    參考 architecture.md §4.3.3 弦樂分配 + idiomatic 規則.
    """
    from .instruments import get_profile
    from .ir import NoteEvent, Pitch

    if arrangement.target_score is None:
        return

    score = arrangement.target_score
    # 找 violin_1 / violin_2 part — 之前的 arranger 改成用 part_id suffix
    # match: violin_1 / violin_2 / violin_1_main / violin_2_main
    def find_violin_part(prefix: str):
        return next(
            (p for p in score.parts if p.part_id.startswith(prefix)
             and "violin" in p.instrument_id.lower()),
            None,
        )

    v1_part = find_violin_part("violin_1")
    v2_part = find_violin_part("violin_2")
    if v1_part is None or v2_part is None:
        return

    profile = get_profile(v1_part.instrument_id)
    if profile is None:
        return
    range_hi = profile.range_absolute[1]

    # 對齊 measure: 用 measure.number 字典化
    v2_by_number = {m.number: m for m in v2_part.measures}

    for m1 in v1_part.measures:
        m2 = v2_by_number.get(m1.number)
        if m2 is None:
            continue
        for voice_id, voice in m1.voices.items():
            v2_voice = m2.voices.get(voice_id)
            if v2_voice is None:
                continue
            # 對齊事件: onset → event lookup
            v2_events_by_onset: dict[float, object] = {}
            for e in v2_voice.events:
                v2_events_by_onset[float(e.onset)] = e
            for ev in voice.events:
                if not isinstance(ev, NoteEvent):
                    continue
                other = v2_events_by_onset.get(float(ev.onset))
                if not isinstance(other, NoteEvent):
                    continue
                if other.pitch.midi_number != ev.pitch.midi_number:
                    continue
                # unison detected — 把 violin I 推 8va
                new_midi = ev.pitch.midi_number + 12
                if new_midi > range_hi:
                    continue
                ev.pitch = Pitch(
                    midi_number=new_midi,
                    spelling=_midi_name(new_midi),
                )


# === Preset 註冊表 ===

PRESETS: dict[str, StylePreset] = {
    "none": StylePreset(
        preset_id="none",
        display_name="(無風格偏好)",
        description="使用預設改編邏輯, 不加風格 post-processing.",
    ),
    "romantic_orchestral_tremolo": StylePreset(
        preset_id="romantic_orchestral_tremolo",
        display_name="浪漫管弦縮室內樂 (tremolo)",
        description=(
            "弦樂長音 (≥ 全音符) + 響度 ≥ mf 自動套 tremolo, "
            "保留 Verdi / Tchaikovsky 管弦張力."
        ),
        post_hooks=[_post_romantic_tremolo],
        llm_addendum=(
            "風格目標: 浪漫管弦樂 (Verdi / Tchaikovsky / Mahler) 縮編成 "
            "室內樂. 弦樂維持管弦語彙: 長音用 tremolo 而非持續弓; bass "
            "聲部可加 pizz/arco 對比; 內聲部和聲常見 9th / 11th 拉伸."
        ),
    ),
    "classical_string_quartet": StylePreset(
        preset_id="classical_string_quartet",
        display_name="古典弦四 (Mozart/Haydn)",
        description=(
            "對話式分配 — 內聲部 (vln II / viola) 主動模仿主題, 強調對位. "
            "0.1.50: violin I/II unison 自動八度散開 (Mozart 慣例)."
        ),
        post_hooks=[_post_classical_unison_spread],
        llm_addendum=(
            "風格目標: Mozart / Haydn 古典弦樂四重奏. 內聲部 (violin II / viola)"
            " 不只是和聲填充, 偶爾模仿 violin I 的旋律動機, 形成對話. 避免 "
            "持續和弦塊, 多用對位線條. Violin I/II 同度盡量改成八度 doubling."
        ),
    ),
    "baroque_continuo": StylePreset(
        preset_id="baroque_continuo",
        display_name="巴洛克 continuo (Bach/Corelli)",
        description=(
            "走低音 + 即興填充. 大鍵琴右手自動實現和聲 (figured bass)."
        ),
        # continuo 已由 arrange() 自動處理 (見 arranger.py), 這裡只加 LLM hint
        llm_addendum=(
            "風格目標: 巴洛克 thoroughbass. 大鍵琴右手填充應遵循 figured bass "
            "傳統 (5-3 默認, 7 → V7 等), 避免平行五度 / 八度, 與 bass 形成對位."
        ),
    ),
    "film_score_piano": StylePreset(
        preset_id="film_score_piano",
        display_name="電影配樂 piano reduction",
        description=(
            "強化旋律 (上八度) + 厚重 bass (下八度). 簡化和聲為 power 5/8."
        ),
        post_hooks=[_post_emphasize_melody_octave, _post_thicken_bass_octave],
        llm_addendum=(
            "風格目標: John Williams / Hans Zimmer 風格 piano reduction. "
            "旋律突出 (高八度 + 加重), bass 厚實 (低八度), 內聲部簡化為 "
            "power chord (純五 + 八度), 避免複雜爵士 voicing."
        ),
    ),
    "classical_piano_alberti": StylePreset(
        preset_id="classical_piano_alberti",
        display_name="古典鋼琴 (阿爾貝蒂低音)",
        description=(
            "把鋼琴左手柱式長和弦展開為阿爾貝蒂低音 (低-高-中-高), "
            "Mozart 鋼琴奏鳴曲最常見的伴奏織體."
        ),
        post_hooks=[_post_alberti_bass],
        llm_addendum=(
            "風格目標: Mozart 鋼琴奏鳴曲. 左手伴奏用阿爾貝蒂低音, "
            "右手旋律清晰歌唱性, 避免厚重和弦塊."
        ),
    ),
    "romantic_piano_broken": StylePreset(
        preset_id="romantic_piano_broken",
        display_name="浪漫鋼琴 (分解和弦)",
        description=(
            "把鋼琴左手柱式長和弦展開為分解和弦 (低-中-高-中波浪), "
            "適合抒情 / 浪漫風格."
        ),
        post_hooks=[_post_broken_chord],
        llm_addendum=(
            "風格目標: 浪漫時期鋼琴 (Chopin / Schumann). 左手用分解和弦 "
            "鋪墊, 強調旋律的歌唱線條與踏板共鳴."
        ),
    ),
}


def get_preset(preset_id: str) -> Optional[StylePreset]:
    return PRESETS.get(preset_id)


def list_presets() -> list[dict]:
    """給 UI 用的 preset 列表."""
    return [
        {
            "id": p.preset_id,
            "display_name": p.display_name,
            "description": p.description,
            "llm_addendum": p.llm_addendum,
        }
        for p in PRESETS.values()
    ]


def apply_preset(arrangement, preset_id: str) -> None:
    """對 arrangement 套用 preset 的 post_hooks."""
    preset = get_preset(preset_id)
    if preset is None or preset.preset_id == "none":
        return
    for hook in preset.post_hooks:
        try:
            hook(arrangement)
        except Exception:
            pass


_PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F",
                "F#", "G", "G#", "A", "A#", "B"]


def _midi_name(midi: int) -> str:
    return f"{_PITCH_NAMES[midi % 12]}{(midi // 12) - 1}"

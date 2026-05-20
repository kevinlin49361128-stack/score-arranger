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


def _post_classical_inner_dialog(arrangement) -> None:
    """古典弦四對話式: 內聲部 (violin II + viola) 若有空, 對 melody 做 imitation
    (簡化: 用既有 voice_filler 然後對相鄰小節做 echo). Phase 1 簡化: no-op 留
    為 placeholder, 透過 LLM addendum 提示風格.
    """
    pass


def _post_alberti_bass(arrangement) -> None:
    """把鋼琴左手柱式長和弦展開為阿爾貝蒂低音 (古典伴奏織體)."""
    from .pianistic import apply_pianistic_texture
    apply_pianistic_texture(arrangement, "alberti")


def _post_broken_chord(arrangement) -> None:
    """把鋼琴左手柱式長和弦展開為分解和弦 (浪漫 / 抒情伴奏織體)."""
    from .pianistic import apply_pianistic_texture
    apply_pianistic_texture(arrangement, "broken")


# === Preset 註冊表 ===

PRESETS: dict[str, StylePreset] = {
    "none": StylePreset(
        preset_id="none",
        display_name="(無風格偏好)",
        description="使用預設改編邏輯, 不加風格 post-processing.",
    ),
    "classical_string_quartet": StylePreset(
        preset_id="classical_string_quartet",
        display_name="古典弦四 (Mozart/Haydn)",
        description=(
            "對話式分配 — 內聲部 (vln II / viola) 主動模仿主題, 強調對位."
        ),
        post_hooks=[_post_classical_inner_dialog],
        llm_addendum=(
            "風格目標: Mozart / Haydn 古典弦樂四重奏. 內聲部 (violin II / viola)"
            " 不只是和聲填充, 偶爾模仿 violin I 的旋律動機, 形成對話. 避免 "
            "持續和弦塊, 多用對位線條."
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

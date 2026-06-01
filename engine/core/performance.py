"""演奏表情塑形 (performance shaping) — 把 articulation 轉成 MIDI 播放
可聽的「實際發聲時值與力度」。

為何獨立、且只作用於 to_midi 的拋棄式 music21 stream:
  記譜匯出要保留「名目時值」(staccato 仍是四分音符 + 斷奏點),
  但 MIDI 播放要「實際發聲時值」(staccato 真的縮短 → 聽得到斷奏)。
  兩條路徑分開: 此 pass 只改播放用的 stream, 不污染 IR / 記譜。
  ref: 播放走 engine.to_midi(), 而 MIDI 不帶 articulation —— 譜上畫了
  staccato/呼吸記號卻全部當長音播, 是音樂人一秒就察覺的落差。

涵蓋 (A1):
  - staccato / staccatissimo → 縮短發聲時值 (斷奏留白)
  - breath (呼吸記號)        → 縮短尾巴, 樂句間換氣空隙
  - accent / marcato         → 提高 velocity (重音)

不在此處理 (屬 A2「力度動態 + 圓滑線 portamento」):
  圓滑線 legato/portamento、dynamics(pp..ff) 完整力度曲線。
  圓滑線內的音目前本來就連續發聲 (contiguous), 不是 A1 要修的 bug。
"""
from __future__ import annotations

from typing import Any

# 斷奏 / 呼吸的發聲時值比例 (乘在名目時值上, 越小越斷)
_STACCATO_RATIO = 0.5
_STACCATISSIMO_RATIO = 0.34
_BREATH_RATIO = 0.6  # 尾巴留 ~40% 當換氣空隙

# 縮短後的時值地板 (quarterLength) — 避免縮到 0 在某些合成器下消失
_MIN_SOUNDING_QL = 0.0625  # 1/16 拍

# MIDI velocity (0–127)
_BASE_VELOCITY = 80
_ACCENT_VELOCITY = 104
_MARCATO_VELOCITY = 116


def apply_playback_expression(m21_score: Any) -> None:
    """就地調整 music21 stream 的發聲時值與 velocity 供 MIDI 播放。

    只應作用於 to_midi 建立的拋棄式 stream; 不要傳記譜匯出用的 stream。
    """
    for n in m21_score.recurse().notes:  # .notes = Note + Chord
        names = {type(a).__name__ for a in n.articulations}

        # ── 力度 (重音) ──────────────────────────────────────────────
        if "StrongAccent" in names:
            vel = _MARCATO_VELOCITY
        elif "Accent" in names:
            vel = _ACCENT_VELOCITY
        else:
            vel = _BASE_VELOCITY
        _set_velocity(n, vel)

        # ── 發聲時值 (斷奏 / 呼吸) ───────────────────────────────────
        ratio: float | None = None
        if "Staccatissimo" in names:
            ratio = _STACCATISSIMO_RATIO
        elif "Staccato" in names:
            ratio = _STACCATO_RATIO
        if "BreathMark" in names:
            ratio = _BREATH_RATIO if ratio is None else min(ratio, _BREATH_RATIO)

        if ratio is not None:
            new_ql = float(n.quarterLength) * ratio
            n.quarterLength = max(new_ql, _MIN_SOUNDING_QL)


def _set_velocity(n: Any, vel: int) -> None:
    """設定 Note/Chord 的 MIDI velocity。和弦同時設子音, 確保匯出生效。"""
    n.volume.velocity = vel
    if getattr(n, "isChord", False):
        for sub in n.notes:
            sub.volume.velocity = vel

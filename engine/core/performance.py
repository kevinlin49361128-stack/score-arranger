"""演奏表情塑形 (performance shaping) — 把 articulation + dynamic 轉成 MIDI
播放可聽的「實際發聲時值與力度」。

為何獨立、且只作用於 to_midi 的拋棄式 music21 stream:
  記譜匯出要保留「名目時值」(staccato 仍是四分音符 + 斷奏點),
  但 MIDI 播放要「實際發聲時值」(staccato 真的縮短 → 聽得到斷奏)。
  兩條路徑分開: 此 pass 只改播放用的 stream, 不污染 IR / 記譜。
  ref: 播放走 engine.to_midi(), 而原本 velocity 平 + articulation 不發聲 ——
  譜上畫了 staccato/強弱卻聽不出來, 是音樂人一秒就察覺的落差。

涵蓋:
  A1 時值:
    - staccato / staccatissimo → 縮短發聲時值 (斷奏留白)
    - breath (呼吸記號)        → 縮短尾巴, 樂句間換氣空隙
  A2 力度:
    - dynamic 標記 (ppp..fff)  → 對應 MIDI velocity, 讓弱/強段落真的有大小聲
    - accent / marcato         → 在當下 dynamic 基準上「相對」加成 (重音)

不在此處理 (屬 A2 後續 / sampler 端):
  圓滑線 legato/portamento 滑音。圓滑線內的音本來就連續發聲, 非 bug。
"""
from __future__ import annotations

from typing import Any

# ── A1: 斷奏 / 呼吸的發聲時值比例 (乘在名目時值上, 越小越斷) ──────────────
_STACCATO_RATIO = 0.5
_STACCATISSIMO_RATIO = 0.34
_BREATH_RATIO = 0.6  # 尾巴留 ~40% 當換氣空隙
_MIN_SOUNDING_QL = 0.0625  # 1/16 拍 — 縮短地板, 避免縮到 0 消失

# ── A2: dynamic 標記 → MIDI velocity (0–127) ──────────────────────────────
# 之前 ir_to_music21 已 emit Dynamic 物件, 但 A1 用固定 velocity 蓋掉了它;
# 這裡改成「依當下 dynamic 算基準 velocity」, 才聽得出 pp ↔ ff 對比。
_DYNAMIC_VELOCITY: dict[str, int] = {
    "pppp": 12, "ppp": 20, "pp": 33, "p": 46, "mp": 58,
    "mf": 72, "f": 88, "ff": 104, "fff": 118, "ffff": 125,
    # sforzando / 強音類 (當「重音化的 dynamic」處理)
    "sf": 100, "sfz": 104, "fz": 104, "sffz": 110,
    "fp": 88, "sfp": 88, "rf": 96, "rfz": 96,
}
_DEFAULT_VELOCITY = 72  # 無 dynamic 標記 → mf
_ACCENT_BOOST = 22      # accent: 當下 dynamic 基準 + 22 (相對, 非絕對)
_MARCATO_BOOST = 34     # marcato (strong accent): 更強
_MAX_VELOCITY = 127

# ── A2+: 內聲部樂句內 velocity 平滑 ──────────────────────────────────────
# 縮編 (管弦樂→小編制) 後, 和聲/內聲部若在樂句內有突兀的 dynamic 跳動, 一把樂器
# 的 f 會跟旋律同響度而「打斷樂句」。把這些內聲部在「樂句內」(以呼吸記號分段) 的
# velocity 拉向該樂句中位, 平滑成連續襯底。只動內聲部、只影響播放、不碰旋律/低音。
_SMOOTH_STRENGTH = 0.55  # 0=不動, 1=完全等於樂句中位
_SMOOTH_MIN_SEG = 3      # 樂句少於這麼多音不平滑 (沒有「樂句內對比」可言)


def apply_playback_expression(
    m21_score: Any, smooth_part_indices: "set[int] | None" = None,
) -> None:
    """就地調整 music21 stream 的發聲時值與 velocity 供 MIDI 播放。

    只應作用於 to_midi 建立的拋棄式 stream; 不要傳記譜匯出用的 stream。

    smooth_part_indices: 這些 part index 的內聲部會做「樂句內 velocity 平滑」
      (見 _smooth_inner_voice)。None / 空 → 不平滑 (向後相容)。
    """
    from music21 import chord as m21_chord
    from music21 import dynamics as m21_dynamics
    from music21 import note as m21_note

    parts = list(getattr(m21_score, "parts", []) or [])
    streams = parts if parts else [m21_score]
    for stream in streams:
        # 逐聲部沿時間軸推進, 記住「當下 dynamic 基準 velocity」。
        # Dynamic 物件 classSortOrder 低於 Note → 同 offset 時先處理, 故對其
        # 後的音生效。比 getContextByClass 逐音回溯快 (O(n) vs O(n²))。
        base_vel = _DEFAULT_VELOCITY
        for el in stream.recurse().getElementsByClass(
            (m21_note.Note, m21_chord.Chord, m21_dynamics.Dynamic),
        ):
            if isinstance(el, m21_dynamics.Dynamic):
                base_vel = _DYNAMIC_VELOCITY.get(el.value, base_vel)
                continue
            _shape_note(el, base_vel)

    # 內聲部樂句內平滑 (在 velocity 算好之後, 只動指定的 part)
    if smooth_part_indices:
        for idx in smooth_part_indices:
            if 0 <= idx < len(parts):
                _smooth_inner_voice(parts[idx])


def _smooth_inner_voice(stream: Any) -> None:
    """把內聲部「樂句內」的 velocity 拉向樂句中位, 去掉突兀的 dynamic 跳動。

    以呼吸記號 (BreathMark) 切樂句; 樂句間保留對比 (各自的中位), 只壓樂句內的
    outlier。樂句太短 (< _SMOOTH_MIN_SEG) 不動 (沒有可言的「樂句內對比」)。
    """
    from statistics import median

    from music21 import chord as m21_chord
    from music21 import note as m21_note

    seg: list[Any] = []

    def flush() -> None:
        if len(seg) < _SMOOTH_MIN_SEG:
            return
        med = median([_get_velocity(n) for n in seg])
        for n in seg:
            v = _get_velocity(n)
            new = round(v * (1 - _SMOOTH_STRENGTH) + med * _SMOOTH_STRENGTH)
            _set_velocity(n, max(1, min(_MAX_VELOCITY, int(new))))

    for el in stream.recurse().getElementsByClass(
        (m21_note.Note, m21_chord.Chord),
    ):
        seg.append(el)
        if "BreathMark" in {type(a).__name__ for a in el.articulations}:
            flush()
            seg = []
    flush()


def _get_velocity(n: Any) -> int:
    v = getattr(getattr(n, "volume", None), "velocity", None)
    return int(v) if v is not None else _DEFAULT_VELOCITY


def _shape_note(n: Any, base_vel: int) -> None:
    """單一 Note/Chord: 套 velocity (dynamic 基準 + 重音) 與發聲時值 (斷奏/呼吸)。"""
    names = {type(a).__name__ for a in n.articulations}

    # 力度: 當下 dynamic 基準 + 重音「相對」加成
    if "StrongAccent" in names:
        vel = min(_MAX_VELOCITY, base_vel + _MARCATO_BOOST)
    elif "Accent" in names:
        vel = min(_MAX_VELOCITY, base_vel + _ACCENT_BOOST)
    else:
        vel = base_vel
    _set_velocity(n, vel)

    # 發聲時值: 斷奏 / 呼吸 (取較短者, 不疊乘)
    ratio: float | None = None
    if "Staccatissimo" in names:
        ratio = _STACCATISSIMO_RATIO
    elif "Staccato" in names:
        ratio = _STACCATO_RATIO
    if "BreathMark" in names:
        ratio = _BREATH_RATIO if ratio is None else min(ratio, _BREATH_RATIO)
    if ratio is not None:
        n.quarterLength = max(float(n.quarterLength) * ratio, _MIN_SOUNDING_QL)


def _set_velocity(n: Any, vel: int) -> None:
    """設定 Note/Chord 的 MIDI velocity。和弦同時設子音, 確保匯出生效。"""
    n.volume.velocity = vel
    if getattr(n, "isChord", False):
        for sub in n.notes:
            sub.volume.velocity = vel

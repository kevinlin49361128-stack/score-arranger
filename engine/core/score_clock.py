"""ScoreClock / TimeMap — 統一時間模型 (架構改造 Phase A)。

問題: 目前前端有 6 處各自推時間 (computeMeasureStarts / computeBeatGrid /
播放游標 / OSMD 像素 / useMetronome / 選段 loop), 基準混亂 (秒/quarter/ticks/像素),
彼此假設他人不變 → 弱起/不完全小節/變拍/變速/loop/count-in/游標常掉隊。

解法: 以 **quarter (四分音符) 為基準**, 在**引擎層**建立一份完整 TimeMap, 前端查詢
而不自算。quarter 恆定 (不受變速影響)、與 IR/music21 原生一致、可直接推 MIDI ticks。

每小節一個 TimeMapEntry, 預先算好 quarter_offset / second_offset / duration, 前端
拿序列化後的 entries 做 binary-search 查 (秒↔小節↔quarter)。pickup (不完全小節) 用
實際內容長度而非整小節, 變拍/變速逐小節帶。
"""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Any

PPQ = 480  # MIDI 標準 pulses-per-quarter


@dataclass
class TimeMapEntry:
    measure_number: int       # IR 小節編號 (pickup 通常為 0, 可跳躍)
    is_pickup: bool
    quarter_offset: float     # 樂譜開頭 → 本小節第一拍的累積 quarter
    duration_quarters: float  # 本小節 quarter 長 (pickup = 實際內容長, 非整小節)
    bpm: float                # 本小節適用 BPM
    numerator: int
    denominator: int
    second_offset: float      # 樂譜開頭 → 本小節第一拍的累積秒 (累積各小節 tempo)
    tick_offset: int          # round(quarter_offset * PPQ)


@dataclass
class ScoreClock:
    entries: list[TimeMapEntry]
    default_bpm: float
    default_numerator: int
    default_denominator: int
    total_quarters: float
    total_seconds: float
    ppq: int = PPQ

    # ── 查詢 (引擎內 + 測試用; 前端拿 serialize 後自己查) ──────────────────
    def _find_by(self, value: float, attr: str) -> "TimeMapEntry | None":
        """找包含 value 的 entry: entries 連續, 取最後一個 offset ≤ value 者。

        value 落在某 entry 的 [off, off+dur) 內; 超過尾端 → 回最後一個 (clamp)。
        """
        if not self.entries:
            return None
        chosen = self.entries[0]
        for e in self.entries:
            if value < getattr(e, attr):
                break
            chosen = e
        return chosen

    def quarter_to_measure(self, q: float) -> tuple[int, float]:
        """quarter → (小節號, 小節內 quarter offset)。"""
        e = self._find_by(q, "quarter_offset")
        if e is None:
            return (0, 0.0)
        return (e.measure_number, max(0.0, q - e.quarter_offset))

    def quarter_to_second(self, q: float) -> float:
        """quarter → 秒 (考慮各小節 tempo)。"""
        e = self._find_by(q, "quarter_offset")
        if e is None:
            return 0.0
        return e.second_offset + (q - e.quarter_offset) * 60.0 / e.bpm

    def quarter_to_ticks(self, q: float) -> int:
        return round(q * self.ppq)

    def second_to_measure(self, sec: float) -> tuple[int, float]:
        """秒 → (小節號, 小節內秒 offset)。給播放游標用。"""
        e = self._find_by(sec, "second_offset")
        if e is None:
            return (0, 0.0)
        return (e.measure_number, max(0.0, sec - e.second_offset))


def _measure_content_quarters(m: Any) -> float:
    """掃小節所有聲部事件, 取 max(onset+duration) — pickup 的實際內容長度。"""
    end = Fraction(0)
    for v in (m.voices or {}).values():
        branches = [v]
        if getattr(v, "is_divisi", False) and v.divisi_branches:
            branches = list(v.divisi_branches)
        for br in branches:
            for e in (br.events or []):
                onset = getattr(e, "onset", None) or Fraction(0)
                dur = getattr(e, "duration", None) or Fraction(0)
                end = max(end, Fraction(onset) + Fraction(dur))
    return float(end)


def build_score_clock(score: Any) -> ScoreClock:
    """從 IR Score 建立完整 TimeMap。以 parts[0] 的小節序為時間骨架 (同 _serialize_tempo)。"""
    measures = score.parts[0].measures if score.parts else []
    bpm = float(score.default_tempo_bpm)
    num, den = score.default_time_signature
    num, den = int(num), int(den)

    entries: list[TimeMapEntry] = []
    q_off = 0.0
    s_off = 0.0
    for m in measures:
        if m.tempo_bpm is not None:
            bpm = float(m.tempo_bpm)
        if m.time_signature is not None:
            num, den = int(m.time_signature[0]), int(m.time_signature[1])
        full = num * 4.0 / den
        if m.is_pickup:
            content = _measure_content_quarters(m)
            dur = content if content > 0 else full
        else:
            dur = full
        entries.append(TimeMapEntry(
            measure_number=m.number, is_pickup=bool(m.is_pickup),
            quarter_offset=q_off, duration_quarters=dur, bpm=bpm,
            numerator=num, denominator=den, second_offset=s_off,
            tick_offset=round(q_off * PPQ),
        ))
        q_off += dur
        s_off += dur * 60.0 / bpm

    return ScoreClock(
        entries=entries,
        default_bpm=float(score.default_tempo_bpm),
        default_numerator=int(score.default_time_signature[0]),
        default_denominator=int(score.default_time_signature[1]),
        total_quarters=q_off, total_seconds=s_off,
    )


def serialize_score_clock(clock: ScoreClock) -> dict:
    """給前端的序列化形式 (前端拿 entries 做查詢, 取代 computeMeasureStarts)。"""
    return {
        "ppq": clock.ppq,
        "default_bpm": clock.default_bpm,
        "default_time_signature": {
            "numerator": clock.default_numerator,
            "denominator": clock.default_denominator,
        },
        "total_quarters": clock.total_quarters,
        "total_seconds": clock.total_seconds,
        "entries": [
            {
                "measure_number": e.measure_number,
                "is_pickup": e.is_pickup,
                "quarter_offset": e.quarter_offset,
                "duration_quarters": e.duration_quarters,
                "second_offset": e.second_offset,
                "tick_offset": e.tick_offset,
                "bpm": e.bpm,
                "numerator": e.numerator,
                "denominator": e.denominator,
            }
            for e in clock.entries
        ],
    }

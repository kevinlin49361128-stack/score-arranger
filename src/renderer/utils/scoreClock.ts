/**
 * ScoreClock 前端換算 (架構改造 Phase A) — 純函式, 對應引擎 core/score_clock.py。
 *
 * 取代散落各處的 computeMeasureStarts/computeBeatGrid 自推時間。以引擎送來的
 * TimeMap entries (每小節 quarter_offset/second_offset/duration/bpm) 為單一真相,
 * 前端只查不算。entries 連續 → 找「最後一個 offset ≤ value」即包含該值的小節。
 */
import type { ScoreClockRes, TimeMapEntry } from "../generated/rpc-types";

function findBy(
  entries: readonly TimeMapEntry[],
  value: number,
  key: "quarter_offset" | "second_offset",
): TimeMapEntry | null {
  if (entries.length === 0) return null;
  let chosen = entries[0];
  for (const e of entries) {
    if (value < e[key]) break;
    chosen = e;
  }
  return chosen;
}

/** 秒 → (小節號, 小節內秒 offset)。給播放游標。 */
export function secondToMeasure(
  clock: ScoreClockRes,
  sec: number,
): { measure: number; offsetSec: number } {
  const e = findBy(clock.entries, sec, "second_offset");
  if (!e) return { measure: 0, offsetSec: 0 };
  return { measure: e.measure_number, offsetSec: Math.max(0, sec - e.second_offset) };
}

/** 秒 → entries 索引 (0-based) — OSMD MeasureList 用。 */
export function secondToMeasureIndex(clock: ScoreClockRes, sec: number): number {
  let idx = 0;
  for (let i = 0; i < clock.entries.length; i++) {
    if (sec < clock.entries[i].second_offset) break;
    idx = i;
  }
  return idx;
}

/** 小節號 → 該小節第一拍的秒。 */
export function measureToSecond(clock: ScoreClockRes, measureNumber: number): number {
  const e = clock.entries.find((x) => x.measure_number === measureNumber);
  return e ? e.second_offset : 0;
}

/** quarter → 秒 (考慮各小節 tempo)。 */
export function quarterToSecond(clock: ScoreClockRes, q: number): number {
  const e = findBy(clock.entries, q, "quarter_offset");
  if (!e) return 0;
  return e.second_offset + ((q - e.quarter_offset) * 60) / e.bpm;
}

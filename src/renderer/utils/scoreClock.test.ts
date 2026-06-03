/**
 * ScoreClock 前端換算測試 — 鏡像引擎 test_score_clock.py 的案例,
 * 確認 TS 端換算與引擎一致 (同樣的輸入給同樣的答案)。
 */
import { describe, expect, it } from "vitest";

import type { ScoreClockRes, TimeMapEntry } from "../generated/rpc-types";
import {
  measureToSecond,
  quarterToSecond,
  secondToMeasure,
  secondToMeasureIndex,
} from "./scoreClock";

function entry(p: Partial<TimeMapEntry> & {
  measure_number: number; quarter_offset: number;
  duration_quarters: number; second_offset: number; bpm: number;
}): TimeMapEntry {
  return {
    is_pickup: false, numerator: 4, denominator: 4,
    tick_offset: Math.round(p.quarter_offset * 480), ...p,
  };
}

function clock(entries: TimeMapEntry[]): ScoreClockRes {
  return {
    ppq: 480, default_bpm: 120,
    default_time_signature: { numerator: 4, denominator: 4 },
    total_quarters: 0, total_seconds: 0, entries,
  };
}

describe("scoreClock 換算 (對齊引擎)", () => {
  const simple = clock([
    entry({ measure_number: 1, quarter_offset: 0, duration_quarters: 4, second_offset: 0, bpm: 120 }),
    entry({ measure_number: 2, quarter_offset: 4, duration_quarters: 4, second_offset: 2, bpm: 120 }),
    entry({ measure_number: 3, quarter_offset: 8, duration_quarters: 4, second_offset: 4, bpm: 120 }),
  ]);

  it("simple 4/4: quarter/秒/小節 互換", () => {
    expect(quarterToSecond(simple, 4)).toBe(2);
    expect(secondToMeasure(simple, 3.0)).toEqual({ measure: 2, offsetSec: 1.0 });
    expect(measureToSecond(simple, 2)).toBe(2);
    expect(secondToMeasureIndex(simple, 3.0)).toBe(1);
  });

  it("pickup: 用實際內容長度起算", () => {
    const c = clock([
      entry({ measure_number: 0, is_pickup: true, quarter_offset: 0, duration_quarters: 1, second_offset: 0, bpm: 120 }),
      entry({ measure_number: 1, quarter_offset: 1, duration_quarters: 4, second_offset: 0.5, bpm: 120 }),
    ]);
    expect(quarterToSecond(c, 1)).toBe(0.5);
    // 0.25 quarter (pickup 內) → 仍在 m0
    expect(secondToMeasure(c, 0.2).measure).toBe(0);
    expect(secondToMeasure(c, 0.6).measure).toBe(1);
  });

  it("tempo change: 秒受影響, 小節邊界正確", () => {
    const c = clock([
      entry({ measure_number: 1, quarter_offset: 0, duration_quarters: 4, second_offset: 0, bpm: 120 }),
      entry({ measure_number: 2, quarter_offset: 4, duration_quarters: 4, second_offset: 2, bpm: 60 }),
    ]);
    expect(quarterToSecond(c, 8)).toBeCloseTo(6.0);   // m1 2s + m2 4q@60=4s
    expect(secondToMeasure(c, 5.0).measure).toBe(2);
  });
});

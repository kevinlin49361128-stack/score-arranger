import { describe, expect, it } from "vitest";
import { segmentPhrases, shapePhrasing } from "./expressivity";

const note = (time: number, duration: number, velocity = 0.8) => ({
  time,
  duration,
  velocity,
});

/** 連續樂句: 5 音、每 0.5s 一音、各 0.45s (gap 0.05 < 門檻)。 */
const phrase5 = (t0 = 0) =>
  Array.from({ length: 5 }, (_, i) => note(t0 + i * 0.5, 0.45));

describe("segmentPhrases", () => {
  it("空陣列 → 無樂句", () => {
    expect(segmentPhrases([])).toEqual([]);
  });

  it("無大空隙 → 單一樂句", () => {
    expect(segmentPhrases(phrase5())).toEqual([[0, 5]]);
  });

  it("空隙 ≥ 門檻 → 切句", () => {
    const notes = [...phrase5(0), ...phrase5(3)]; // 前句結束 2.45, 次句 3.0 → gap 0.55
    expect(segmentPhrases(notes)).toEqual([
      [0, 5],
      [5, 10],
    ]);
  });
});

describe("shapePhrasing", () => {
  it("不改輸入、不動 onset", () => {
    const notes = phrase5();
    const snapshot = JSON.parse(JSON.stringify(notes));
    const shaped = shapePhrasing(notes);
    expect(notes).toEqual(snapshot);
    shaped.forEach((n, i) => expect(n.time).toBe(notes[i].time));
  });

  it("弧線: 起句與句尾低於高點, 句尾低於起句", () => {
    const shaped = shapePhrasing(phrase5());
    const vels = shaped.map((n) => n.velocity);
    const peak = Math.max(...vels);
    expect(vels[0]).toBeLessThan(peak);
    expect(vels[vels.length - 1]).toBeLessThan(peak);
    expect(vels[vels.length - 1]).toBeLessThan(vels[0]);
    // 幅度細微 (±12% 內)
    for (const v of vels) {
      expect(v).toBeGreaterThan(0.8 * 0.88);
      expect(v).toBeLessThan(0.8 * 1.12);
    }
  });

  it("velocity 永遠在 [0.05, 1]", () => {
    const loud = phrase5().map((n) => ({ ...n, velocity: 0.99 }));
    for (const n of shapePhrasing(loud)) {
      expect(n.velocity).toBeLessThanOrEqual(1);
      expect(n.velocity).toBeGreaterThanOrEqual(0.05);
    }
  });

  it("終止式微緩: 句尾音時值 ×1.15", () => {
    const shaped = shapePhrasing(phrase5());
    expect(shaped[4].duration).toBeCloseTo(0.45 * 1.15, 5);
  });

  it("連奏重疊: 無縫長音延長到蓋過下一音 onset", () => {
    // gap 0.02 < 0.03, 時值 0.48 ≥ 0.25 → 重疊
    const notes = [note(0, 0.48), note(0.5, 0.48), note(1.0, 0.48)];
    const shaped = shapePhrasing(notes);
    expect(shaped[0].duration).toBeCloseTo(0.5 + 0.05, 5);
    expect(shaped[1].duration).toBeCloseTo(0.5 + 0.05, 5);
  });

  it("短音 (staccato) 不套連奏", () => {
    const notes = [note(0, 0.1), note(0.11, 0.1), note(0.22, 0.1)];
    const shaped = shapePhrasing(notes);
    expect(shaped[0].duration).toBeCloseTo(0.1, 5);
  });

  it("太短的樂句 (<3 音) 不套弧線/終止式", () => {
    const notes = [note(0, 0.4), note(0.5, 0.4)];
    const shaped = shapePhrasing(notes);
    expect(shaped[0].velocity).toBe(0.8);
    expect(shaped[1].duration).toBeCloseTo(0.4, 5);
  });

  it("跨樂句不套連奏 (句尾與次句首間隔大)", () => {
    const notes = [...phrase5(0), ...phrase5(3)];
    const shaped = shapePhrasing(notes);
    // 前句句尾 = idx 4: 時值僅有終止式 ×1.15, 沒被連奏延長到 3.05
    expect(shaped[4].duration).toBeCloseTo(0.45 * 1.15, 5);
  });
});

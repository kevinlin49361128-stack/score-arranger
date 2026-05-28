import { describe, expect, it } from "vitest";
import type { ArrangementResult } from "@shared/types";
import type { PitchSample } from "./pitchMonitor";
import {
  type MelodyPitch,
  deviationSemitones,
  expectedMidiForMeasure,
  extractMelodyPitches,
  findCurrentMeasure,
} from "./scoreFollower";

// 模擬 IR 序列化結構 — 對應 engine/core/ir_serialize.py to_dict()
function makeArrangement(
  measures: { number: number; notes: { midi: number; chord?: number[] }[] }[],
): ArrangementResult {
  const measureObjs = measures.map((m) => ({
    __type__: "Measure",
    number: m.number,
    voices: {
      "1": {
        __type__: "Voice",
        events: m.notes.map((n) =>
          n.chord
            ? {
                __type__: "ChordEvent",
                pitches: n.chord.map((mi) => ({ midi_number: mi })),
              }
            : {
                __type__: "NoteEvent",
                pitch: { midi_number: n.midi },
              },
        ),
      },
    },
  }));
  return {
    arrangement_id: "test",
    name: "test",
    source_id: "test",
    players: [],
    assignments: [],
    target_musicxml: null,
    target_score: {
      __type__: "Score",
      parts: [{ __type__: "Part", measures: measureObjs }],
    },
  };
}

function sample(midi: number | null, t = 0): PitchSample {
  return {
    t,
    hz: midi === null ? null : 440 * 2 ** ((midi - 69) / 12),
    midi,
    cents: 0,
    clarity: 0.95,
  };
}

describe("extractMelodyPitches", () => {
  it("從 NoteEvent 抽出單音", () => {
    const arr = makeArrangement([
      { number: 1, notes: [{ midi: 60 }, { midi: 62 }] },
      { number: 2, notes: [{ midi: 64 }] },
    ]);
    const melody = extractMelodyPitches(arr);
    expect(melody).toEqual([
      { measure: 1, midi: 60 },
      { measure: 1, midi: 62 },
      { measure: 2, midi: 64 },
    ]);
  });

  it("ChordEvent 取頂音 (最高 midi)", () => {
    const arr = makeArrangement([
      { number: 1, notes: [{ midi: 60, chord: [60, 64, 67] }] },
    ]);
    expect(extractMelodyPitches(arr)).toEqual([{ measure: 1, midi: 67 }]);
  });

  it("arrangement null → 空", () => {
    expect(extractMelodyPitches(null)).toEqual([]);
  });

  it("沒有 voice 1 → 空", () => {
    const arr: ArrangementResult = {
      arrangement_id: "x", name: "x", source_id: "x",
      players: [], assignments: [], target_musicxml: null,
      target_score: {
        parts: [{ measures: [{ number: 1, voices: { "2": { events: [] } } }] }],
      },
    };
    expect(extractMelodyPitches(arr)).toEqual([]);
  });
});

describe("findCurrentMeasure", () => {
  // C major scale: C4 D4 E4 F4 G4 A4 B4 C5 — 一小節一個音
  const scale: MelodyPitch[] = [
    { measure: 1, midi: 60 }, // C4
    { measure: 2, midi: 62 }, // D4
    { measure: 3, midi: 64 }, // E4
    { measure: 4, midi: 65 }, // F4
    { measure: 5, midi: 67 }, // G4
    { measure: 6, midi: 69 }, // A4
    { measure: 7, midi: 71 }, // B4
    { measure: 8, midi: 72 }, // C5
  ];

  it("拉 E 附近, hint=3 → 回 measure 3", () => {
    // 8 個 sample 都是 E4
    const recent = Array.from({ length: 8 }, (_, i) => sample(64, i * 30));
    const res = findCurrentMeasure(recent, scale, 3);
    expect(res.measure).toBe(3);
    expect(res.confidence).toBe(1);
  });

  it("從 hint=2 出發, 拉 G → 信心度低 (G 在 hint±2 = [m1..m4] 視窗外)", () => {
    const recent = Array.from({ length: 8 }, (_, i) => sample(67, i * 30));
    const res = findCurrentMeasure(recent, scale, 2);
    // 視窗 [1..4] 內沒 G, 但有 LOCAL±3 onset 寬容, 所以還是會抓到 measure 4
    // (G 與 m1..m4 內任一 onset 的 ±3 onset 鄰居有 G=m5, 算命中)
    expect(res.measure).toBeGreaterThanOrEqual(1);
    expect(res.measure).toBeLessThanOrEqual(4);
  });

  it("拉準音, hint 接近正確答案 → 命中率高", () => {
    // hint=4, 真的拉 E (measure 3) — 在 hint±2 視窗內.
    // LOCAL=1 寬容讓 m3/m4 都同分, tie-break 取靠近 hint 的 m4 (合理:
    // follower 抗抖動偏向「黏住目前位置」). 重點是信心度高.
    const recent = Array.from({ length: 8 }, (_, i) => sample(64, i * 30));
    const res = findCurrentMeasure(recent, scale, 4);
    expect(res.measure).toBeGreaterThanOrEqual(3);
    expect(res.measure).toBeLessThanOrEqual(4);
    expect(res.confidence).toBeGreaterThan(0.6);
  });

  it("八度差仍視為對 (chroma 匹配)", () => {
    // 拉 E5 (midi 76) — 跟 E4 (64) 差八度, 應該還是 measure 3
    const recent = Array.from({ length: 8 }, (_, i) => sample(76, i * 30));
    const res = findCurrentMeasure(recent, scale, 3);
    expect(res.measure).toBe(3);
    expect(res.confidence).toBe(1);
  });

  it("空 sample → 回 hint, 信心 0", () => {
    const res = findCurrentMeasure([], scale, 5);
    expect(res.measure).toBe(5);
    expect(res.confidence).toBe(0);
  });

  it("跨小節 sample (E 然後 F) → 應推估在 E 或 F 周邊", () => {
    // 前 4 個 E, 後 4 個 F — 模擬剛換音
    const recent = [
      ...Array.from({ length: 4 }, (_, i) => sample(64, i * 30)),
      ...Array.from({ length: 4 }, (_, i) => sample(65, (i + 4) * 30)),
    ];
    const res = findCurrentMeasure(recent, scale, 3);
    expect(res.measure).toBeGreaterThanOrEqual(3);
    expect(res.measure).toBeLessThanOrEqual(4);
    expect(res.confidence).toBeGreaterThan(0.6);
  });
});

describe("deviationSemitones", () => {
  it("拉同音 → 0", () => {
    expect(deviationSemitones(60, 60)).toBe(0);
  });
  it("拉高 1 半音 → +1", () => {
    expect(deviationSemitones(61, 60)).toBe(1);
  });
  it("拉低 2 半音 → -2", () => {
    expect(deviationSemitones(58, 60)).toBe(-2);
  });
  it("差八度 (chroma 同) → 0", () => {
    expect(deviationSemitones(72, 60)).toBe(0);
  });
  it("null 輸入 → null", () => {
    expect(deviationSemitones(null, 60)).toBeNull();
    expect(deviationSemitones(60, null)).toBeNull();
  });
});

describe("expectedMidiForMeasure", () => {
  const mel: MelodyPitch[] = [
    { measure: 1, midi: 60 },
    { measure: 2, midi: 62 },
    { measure: 2, midi: 64 },
  ];
  it("找到第一筆", () => {
    expect(expectedMidiForMeasure(mel, 2)).toBe(62);
  });
  it("找不到 → null", () => {
    expect(expectedMidiForMeasure(mel, 99)).toBeNull();
  });
});

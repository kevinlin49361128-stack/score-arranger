import { beforeEach, describe, expect, it } from "vitest";
import {
  loadPracticeSession,
  savePracticeSession,
} from "./practiceSession";

// vitest 跑在 node env (無 localStorage) — 用 Map 模擬
const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  // @ts-expect-error test stub
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => mem.set(k, v),
    removeItem: (k: string) => mem.delete(k),
    clear: () => mem.clear(),
  };
});

describe("practiceSession", () => {
  it("round-trips settings per piece", () => {
    savePracticeSession("/a.xml", {
      countInBars: 2,
      metronomeSoundId: "cowbell",
    });
    expect(loadPracticeSession("/a.xml")).toEqual({
      countInBars: 2,
      metronomeSoundId: "cowbell",
    });
  });

  it("merges (not overwrites) on partial save", () => {
    savePracticeSession("/a.xml", { countInBars: 1 });
    savePracticeSession("/a.xml", { metronomeSoundId: "beep" });
    expect(loadPracticeSession("/a.xml")).toEqual({
      countInBars: 1,
      metronomeSoundId: "beep",
    });
  });

  it("keys by piece — different pieces stay independent", () => {
    savePracticeSession("/a.xml", { countInBars: 1 });
    savePracticeSession("/b.xml", { countInBars: 2 });
    expect(loadPracticeSession("/a.xml")?.countInBars).toBe(1);
    expect(loadPracticeSession("/b.xml")?.countInBars).toBe(2);
  });

  it("null piece / missing key → null; null piece save is a no-op", () => {
    expect(loadPracticeSession(null)).toBeNull();
    expect(loadPracticeSession("/none.xml")).toBeNull();
    savePracticeSession(null, { countInBars: 3 });
    expect(mem.size).toBe(0);
  });
});

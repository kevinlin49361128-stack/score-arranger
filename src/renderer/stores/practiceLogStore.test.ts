import { beforeEach, describe, expect, it } from "vitest";
import { clearPracticeLog, logDrill } from "./practiceLogStore";

// vitest node env (無 window) — 用 Map 模擬 window.localStorage。
// practiceLogStore 在 import 時 load() 已被 try/catch 吞掉 (window undefined),
// 故這裡只需在每個 test 前備好 stub 供 save()/後續讀取使用。
const STORAGE_KEY = "score-arranger.practice-log.v1";
const mem = new Map<string, string>();

const localStorageStub: Storage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => {
    mem.set(k, v);
  },
  removeItem: (k) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
  key: () => null,
  get length() {
    return mem.size;
  },
};

beforeEach(() => {
  mem.clear();
  globalThis.window = { localStorage: localStorageStub } as unknown as Window &
    typeof globalThis;
  clearPracticeLog();
});

function persisted() {
  const raw = mem.get(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe("practiceLogStore.logDrill (C4)", () => {
  it("寫入一筆帶 drill metadata 的完整 entry (立即 ended)", () => {
    const id = logDrill("/brahms.musicxml", "brahms.musicxml", 1000, {
      measure_from: 5,
      measure_to: 12,
      bpm_from: 100,
      bpm_to: 140,
      passes: 8,
    });
    const entries = persisted();
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.id).toBe(id);
    expect(e.score_id).toBe("/brahms.musicxml");
    expect(e.started_at).toBe(1000);
    expect(typeof e.ended_at).toBe("number");
    expect(e.drill).toEqual({
      measure_from: 5,
      measure_to: 12,
      bpm_from: 100,
      bpm_to: 140,
      passes: 8,
    });
  });

  it("最新的 drill 排在最前 (prepend)", () => {
    logDrill("/a.xml", "a", 1, { measure_from: 1, measure_to: 2, bpm_from: 60, bpm_to: 80, passes: 2 });
    logDrill("/b.xml", "b", 2, { measure_from: 3, measure_to: 4, bpm_from: 90, bpm_to: 120, passes: 3 });
    const entries = persisted();
    expect(entries).toHaveLength(2);
    expect(entries[0].score_id).toBe("/b.xml");
    expect(entries[1].score_id).toBe("/a.xml");
  });

  it("score 識別缺省 (undefined) 不報錯", () => {
    expect(() =>
      logDrill(undefined, undefined, 1, {
        measure_from: 1, measure_to: 1, bpm_from: 60, bpm_to: 60, passes: 1,
      }),
    ).not.toThrow();
    expect(persisted()).toHaveLength(1);
  });
});

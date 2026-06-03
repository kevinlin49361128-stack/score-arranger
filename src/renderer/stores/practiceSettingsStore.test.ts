import { beforeEach, describe, expect, it } from "vitest";

import { loadPracticeSession } from "../utils/practiceSession";
import {
  refreshPracticeSettings,
  updatePracticeSettings,
} from "./practiceSettingsStore";

// vitest node env (無 DOM) — practiceSession.ts 用 bare `localStorage`,
// 故在 globalThis 掛一個 Map-backed stub。
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

const SONG = "test:song-a";

beforeEach(() => {
  mem.clear();
  globalThis.localStorage = localStorageStub;
  // store 內部快取跨 test 殘留 → refresh 丟掉
  refreshPracticeSettings(SONG);
});

describe("practiceSettingsStore", () => {
  it("更新會持久化到 practiceSession (同一把 key)", () => {
    updatePracticeSettings(SONG, { loopStart: 3, loopEnabled: true });
    expect(loadPracticeSession(SONG)).toMatchObject({
      loopStart: 3,
      loopEnabled: true,
    });
  });

  it("多次更新 merge, 不覆寫其他欄位", () => {
    updatePracticeSettings(SONG, { loopStart: 2 });
    updatePracticeSettings(SONG, { playbackRate: 0.5 });
    expect(loadPracticeSession(SONG)).toMatchObject({
      loopStart: 2,
      playbackRate: 0.5,
    });
  });

  it("null songId 不寫入也不丟錯", () => {
    expect(() => updatePracticeSettings(null, { loopStart: 9 })).not.toThrow();
    expect(mem.size).toBe(0);
  });

  it("refresh 後重讀 localStorage 的外部改動", () => {
    updatePracticeSettings(SONG, { loopStart: 1 });
    // 模擬 load_project 直接寫 localStorage (繞過 store)
    mem.set(
      `sa-practice-v1:${SONG}`,
      JSON.stringify({ loopStart: 7, loopEnabled: true }),
    );
    refreshPracticeSettings(SONG);
    expect(loadPracticeSession(SONG)).toMatchObject({ loopStart: 7 });
  });
});

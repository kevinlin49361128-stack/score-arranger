import { beforeEach, describe, expect, it } from "vitest";

import {
  clearRehearsalNotes,
  getRehearsalNotes,
  importRehearsalNotes,
  type RehearsalNote,
  setRehearsalNote,
} from "./rehearsalNotesStore";

// vitest node env (無 window) — 用 Map 模擬 window.localStorage。
// rehearsalNotesStore 在 import 時 load() 被 try/catch 吞掉 (window undefined),
// 故 _cache 起始為空; 每 test 前備好 stub + 清掉測試 score 的殘留。
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

const SCORE = "corpus:test/song-a";

beforeEach(() => {
  mem.clear();
  globalThis.window = { localStorage: localStorageStub } as unknown as Window &
    typeof globalThis;
  clearRehearsalNotes(SCORE);
});

function note(mark: string, measure: number, text: string): RehearsalNote {
  return {
    score_id: SCORE,
    mark_id: mark,
    measure,
    notes: text,
    updated_at: 1,
  };
}

describe("rehearsalNotesStore — slice 4a save/load helpers", () => {
  it("getRehearsalNotes 依 measure 排序回傳該 score 的筆記", () => {
    setRehearsalNote(SCORE, "B", 9, "後面");
    setRehearsalNote(SCORE, "A", 3, "前面");
    const got = getRehearsalNotes(SCORE);
    expect(got.map((n) => n.mark_id)).toEqual(["A", "B"]);
    expect(got[0].notes).toBe("前面");
  });

  it("getRehearsalNotes(null) 回空陣列", () => {
    expect(getRehearsalNotes(null)).toEqual([]);
  });

  it("importRehearsalNotes 寫回後 getRehearsalNotes 讀得到 (round-trip)", () => {
    importRehearsalNotes(SCORE, [note("A", 5, "銅管太大聲")]);
    const got = getRehearsalNotes(SCORE);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ mark_id: "A", measure: 5, notes: "銅管太大聲" });
  });

  it("importRehearsalNotes 依 mark 合併: 覆蓋同 mark, 保留其他既有 mark", () => {
    setRehearsalNote(SCORE, "A", 3, "本機舊筆記");
    setRehearsalNote(SCORE, "C", 12, "只在本機");
    importRehearsalNotes(SCORE, [note("A", 3, "專案覆蓋"), note("B", 9, "專案新增")]);
    const got = getRehearsalNotes(SCORE);
    const byMark = Object.fromEntries(got.map((n) => [n.mark_id, n.notes]));
    expect(byMark).toEqual({ A: "專案覆蓋", B: "專案新增", C: "只在本機" });
  });

  it("importRehearsalNotes 跳過空/無效筆記", () => {
    importRehearsalNotes(SCORE, [
      note("A", 1, "  "), // 空白 → 跳過
      { score_id: SCORE, mark_id: "", measure: 2, notes: "無 mark", updated_at: 1 },
      note("D", 4, "有效"),
    ]);
    const got = getRehearsalNotes(SCORE);
    expect(got.map((n) => n.mark_id)).toEqual(["D"]);
  });

  it("importRehearsalNotes 空陣列/null 不動既有", () => {
    setRehearsalNote(SCORE, "A", 3, "保留我");
    importRehearsalNotes(SCORE, []);
    importRehearsalNotes(null, [note("A", 3, "x")]);
    expect(getRehearsalNotes(SCORE)).toHaveLength(1);
  });
});

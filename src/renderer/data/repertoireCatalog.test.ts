/**
 * 0.1.48 C2 — 前端 component 測試骨架 (pure helpers).
 *
 * Vitest 目前是 node env (沒 jsdom), 無法 mount React component.
 * 但 repertoireCatalog 的 helpers (composerMonogram / ensembleIcon /
 * eraFontFamily / ERA_BAND) 都是純函式, 沒 DOM 依賴 — 適合 unit test.
 *
 * 完整 React component 測試骨架等之後另起 Sprint 加 jsdom + RTL.
 */

import { describe, expect, it } from "vitest";
import {
  composerMonogram,
  ensembleIcon,
  ERA_BAND,
  eraFontFamily,
  listComposers,
  REPERTOIRE,
} from "./repertoireCatalog";

// ============================================================================
// composerMonogram
// ============================================================================

describe("composerMonogram", () => {
  it("已知作曲家用人類風縮寫 (JSB / WAM / LvB)", () => {
    expect(composerMonogram("Johann Sebastian Bach")).toBe("JSB");
    expect(composerMonogram("Wolfgang Amadeus Mozart")).toBe("WAM");
    expect(composerMonogram("Ludwig van Beethoven")).toBe("LvB");
  });

  it("未知作曲家 fallback 取首字 (最多 3)", () => {
    expect(composerMonogram("John Doe")).toBe("JD");
    expect(composerMonogram("Single")).toBe("S");
    expect(composerMonogram("A B C D")).toBe("ABC");
  });

  it("空字串 fallback 不該炸", () => {
    expect(composerMonogram("")).toBe("");
  });
});

// ============================================================================
// ensembleIcon — 都該回非空字串 SVG path
// ============================================================================

describe("ensembleIcon", () => {
  it.each([
    "SATB", "String Quartet", "Voice + Piano", "Piano Solo",
    "Trio Sonata", "Other",
  ] as const)("%s 回非空 SVG path", (e) => {
    const path = ensembleIcon(e);
    expect(path).toBeTruthy();
    expect(typeof path).toBe("string");
    expect(path.length).toBeGreaterThan(10);
  });

  it("SATB 跟 String Quartet 不同 (避免錯複製貼上)", () => {
    expect(ensembleIcon("SATB")).not.toBe(ensembleIcon("String Quartet"));
  });
});

// ============================================================================
// ERA_BAND — 5 個時代色都該有效 hex
// ============================================================================

describe("ERA_BAND", () => {
  it("5 個時代色都是 #RRGGBB 格式", () => {
    const eras: (keyof typeof ERA_BAND)[] = [
      "Renaissance", "Baroque", "Classical", "Romantic", "Modern",
    ];
    for (const era of eras) {
      const color = ERA_BAND[era];
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("5 個時代色彼此都不同", () => {
    const colors = new Set(Object.values(ERA_BAND));
    expect(colors.size).toBe(5);
  });
});

// ============================================================================
// eraFontFamily — 每時代回非空 fallback chain
// ============================================================================

describe("eraFontFamily", () => {
  it.each([
    "Renaissance", "Baroque", "Classical", "Romantic", "Modern",
  ] as const)("%s 回非空 font-family", (era) => {
    const f = eraFontFamily(era);
    expect(f).toBeTruthy();
    expect(f).toContain(","); // 至少帶 fallback
  });

  it("Modern 用 sans-serif (Helvetica)", () => {
    expect(eraFontFamily("Modern")).toContain("Helvetica");
  });

  it("Baroque 用 Garamond", () => {
    expect(eraFontFamily("Baroque")).toContain("Garamond");
  });
});

// ============================================================================
// REPERTOIRE — 資料庫完整性
// ============================================================================

describe("REPERTOIRE catalog data", () => {
  it("非空, 至少 200 首 (0.1.45 + 0.1.46 之後)", () => {
    expect(REPERTOIRE.length).toBeGreaterThan(200);
  });

  it("每首都有必填欄位", () => {
    for (const entry of REPERTOIRE) {
      expect(entry.corpus_path).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.composer).toBeTruthy();
      expect(entry.era).toBeTruthy();
      expect(entry.form).toBeTruthy();
      expect(entry.ensemble).toBeTruthy();
    }
  });

  it("corpus_path 都是 unique (沒重複)", () => {
    const paths = REPERTOIRE.map(e => e.corpus_path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it("grade 在 1-9 範圍內 (或未設)", () => {
    for (const e of REPERTOIRE) {
      if (e.grade !== undefined) {
        expect(e.grade).toBeGreaterThanOrEqual(1);
        expect(e.grade).toBeLessThanOrEqual(9);
      }
    }
  });
});

// ============================================================================
// listComposers — 已排序 + unique
// ============================================================================

describe("listComposers", () => {
  it("回非空陣列", () => {
    const composers = listComposers();
    expect(composers.length).toBeGreaterThan(5);
  });

  it("沒重複", () => {
    const composers = listComposers();
    expect(new Set(composers).size).toBe(composers.length);
  });

  it("包含 Bach (0.1.45 後曲庫應該有)", () => {
    const composers = listComposers();
    const hasBach = composers.some(c => /bach/i.test(c));
    expect(hasBach).toBe(true);
  });
});

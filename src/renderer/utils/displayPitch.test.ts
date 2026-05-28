/**
 * displayPitch 測試 (0.1.55) — 移調樂器 written ↔ sounding XML 轉換.
 *
 * 註: toSoundingPitchXML 內部用 DOMParser, 在 node env 下不可用.
 * 但 jsdom 並未安裝為 dep. 為了避免新增 dep, 我們只測純函式邊界
 * (null/empty/parse 失敗 fallback) — 完整 round-trip 由
 * engine/tests/test_transposing_instruments.py 涵蓋
 * (parse → emit → 再 parse 回, 玩家拿到 written, sounding 正確).
 */
import { describe, expect, it } from "vitest";
import { toSoundingPitchXML } from "./displayPitch";

describe("toSoundingPitchXML — boundary", () => {
  it("null → null", () => {
    expect(toSoundingPitchXML(null)).toBe(null);
  });

  it("empty string → empty string", () => {
    expect(toSoundingPitchXML("")).toBe("");
  });

  it("壞 input (node env 下 DOMParser 不可用) → safe fallback 回傳原值", () => {
    const broken = "not-xml-at-all";
    // 在 node env 下 DOMParser 不存在 → catch 區回原字串
    // 在 jsdom env 下 DOMParser 對非 XML 也 fail-safe
    expect(toSoundingPitchXML(broken)).toBe(broken);
  });
});

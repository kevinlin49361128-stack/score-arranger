import { afterEach, describe, expect, it } from "vitest";
import { addStrings, getLocale, setLocale, t } from "./i18n";

afterEach(() => {
  setLocale("zh-TW"); // 每個測試後復原預設 locale
});

describe("i18n.t", () => {
  it("把參數套進模板", () => {
    setLocale("zh-TW");
    const msg = t("E_PIANO_HAND_SPAN", { span: 14, max: 12 });
    expect(msg).toContain("14");
    expect(msg).toContain("12");
  });

  it("未知 code → 原樣回傳 code", () => {
    expect(t("E_NO_SUCH_CODE")).toBe("E_NO_SUCH_CODE");
  });

  it("缺少參數 → 保留 {佔位符}", () => {
    setLocale("zh-TW");
    expect(t("E_PIANO_HAND_SPAN")).toContain("{span}");
  });

  it("locale 切換改變輸出語言", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(
      t("E_PITCH_BELOW_RANGE", { instrument: "Violin", pitch: "C3" }),
    ).toContain("below playable range");

    setLocale("zh-TW");
    expect(
      t("E_PITCH_BELOW_RANGE", { instrument: "Violin", pitch: "C3" }),
    ).toContain("超出最低音域");
  });

  it("addStrings 可補進字典", () => {
    addStrings("zh-TW", { X_TEST_CUSTOM: "自訂 {v}" });
    setLocale("zh-TW");
    expect(t("X_TEST_CUSTOM", { v: 7 })).toBe("自訂 7");
  });
});

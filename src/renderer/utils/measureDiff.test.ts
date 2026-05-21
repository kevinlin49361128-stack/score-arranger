import { describe, expect, it } from "vitest";
import { diffMeasures } from "./measureDiff";

const wrap = (measures: string) =>
  `<score-partwise><part id="P1">${measures}</part></score-partwise>`;
const measure = (n: number, body: string) =>
  `<measure number="${n}">${body}</measure>`;

describe("diffMeasures", () => {
  it("相同 XML → 無差異", () => {
    const a = wrap(measure(1, "<note>C</note>") + measure(2, "<note>D</note>"));
    expect(diffMeasures(a, a).size).toBe(0);
  });

  it("某小節內容改變 → 只標記該小節", () => {
    const a = wrap(measure(1, "<note>C</note>") + measure(2, "<note>D</note>"));
    const b = wrap(measure(1, "<note>C</note>") + measure(2, "<note>E</note>"));
    expect([...diffMeasures(a, b)]).toEqual([2]);
  });

  it("只在其中一邊出現的小節 → 算差異", () => {
    const a = wrap(measure(1, "<note>C</note>"));
    const b = wrap(measure(1, "<note>C</note>") + measure(2, "<note>D</note>"));
    expect([...diffMeasures(a, b)]).toEqual([2]);
  });

  it("忽略 default-x / default-y 排版屬性差異", () => {
    const a = wrap('<measure number="1"><note default-x="10">C</note></measure>');
    const b = wrap('<measure number="1"><note default-x="99">C</note></measure>');
    expect(diffMeasures(a, b).size).toBe(0);
  });

  it("空 XML → 無差異", () => {
    expect(diffMeasures("", "").size).toBe(0);
  });
});

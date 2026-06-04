import { afterEach, describe, expect, it } from "vitest";

import {
  getPlaybackPrefs,
  setTuningHz,
  TUNING_DEFAULT,
  TUNING_MAX,
  TUNING_MIN,
} from "./playbackPrefsStore";

// node env (無 window) → load() 退回預設, tuningHz 起始 440。
afterEach(() => {
  setTuningHz(TUNING_DEFAULT); // 還原免污染其他測試
});

describe("playbackPrefsStore — tuningHz", () => {
  it("預設 440", () => {
    expect(getPlaybackPrefs().tuningHz).toBe(440);
  });

  it("setTuningHz 設常見基準 (415 巴洛克 / 442 樂團)", () => {
    setTuningHz(415);
    expect(getPlaybackPrefs().tuningHz).toBe(415);
    setTuningHz(442);
    expect(getPlaybackPrefs().tuningHz).toBe(442);
  });

  it("夾住超出範圍 + 拒絕 NaN", () => {
    setTuningHz(99999);
    expect(getPlaybackPrefs().tuningHz).toBe(TUNING_MAX);
    setTuningHz(10);
    expect(getPlaybackPrefs().tuningHz).toBe(TUNING_MIN);
    setTuningHz(Number.NaN);
    expect(getPlaybackPrefs().tuningHz).toBe(TUNING_DEFAULT);
  });

  it("detune cents 公式: 440=0, 415≈-101, 442≈+8 (播放時套用的換算)", () => {
    const cents = (hz: number) => 1200 * Math.log2(hz / TUNING_DEFAULT);
    expect(cents(440)).toBe(0);
    expect(cents(415)).toBeCloseTo(-101.3, 1);
    expect(cents(442)).toBeCloseTo(7.9, 1);
  });
});

/**
 * playbackPrefsStore — 全域播放音色偏好 (取樣 / 弦樂自然化)
 *
 * 為何獨立 store: 這兩個是「整個 app 的播放偏好」, 但有 3 個 PlaybackControls
 * 實例 (工具列主播放器 + 源譜 + 改編譜), 各自 local useState 會各持一份、
 * 互不同步, 且這些開關原本只渲染在從未被掛載的 `!compact` 分支裡 → 使用者
 * 根本點不到。改成共享 store + 收進工具列 ⚙ 設定, 三個播放器同步生效。
 *
 * mirror rehearsalNotesStore 的 useSyncExternalStore + localStorage 模式。
 */
import { useSyncExternalStore } from "react";

const KEY_HUMANIZE = "sa.humanizeStrings";
const KEY_SAMPLES = "sa.useSamples";
const KEY_TUNING = "sa.tuningHz";
const KEY_PHYSICAL = "sa.physicalStrings";

/** 調音基準 A4 合理範圍 — 低於 380 / 高於 470 已非音樂用途, 夾住防誤輸入。 */
export const TUNING_MIN = 380;
export const TUNING_MAX = 470;
export const TUNING_DEFAULT = 440;

export interface PlaybackPrefs {
  /** 用取樣音色 (vs 純合成退路). 預設 true。 */
  useSamples: boolean;
  /** 弦樂自然化: vibrato 漂移 + unison 微離調 (疊加層). 預設 false。 */
  humanizeStrings: boolean;
  /** 調音基準 A4 (Hz). 440 = 標準; 415 = 巴洛克; 442 = 樂團/獨奏。預設 440。 */
  tuningHz: number;
  /**
   * 弦樂改用物理建模合成 (弓弦 Karplus-Strong) 取代取樣. 預設 false。
   * 實驗性: 不需下載取樣即可發聲、延音更連續, 但音色比真取樣陽春。
   */
  physicalStrings: boolean;
}

function clampTuning(hz: number): number {
  if (!Number.isFinite(hz)) return TUNING_DEFAULT;
  return Math.min(TUNING_MAX, Math.max(TUNING_MIN, hz));
}

function load(): PlaybackPrefs {
  let useSamples = true;
  let humanizeStrings = false;
  let tuningHz = TUNING_DEFAULT;
  let physicalStrings = false;
  try {
    const s = localStorage.getItem(KEY_SAMPLES);
    useSamples = s === null ? true : s === "1";
    humanizeStrings = localStorage.getItem(KEY_HUMANIZE) === "1";
    physicalStrings = localStorage.getItem(KEY_PHYSICAL) === "1";
    const tun = localStorage.getItem(KEY_TUNING);
    if (tun !== null) tuningHz = clampTuning(parseFloat(tun));
  } catch {
    /* localStorage 不可用 → 用預設 */
  }
  return { useSamples, humanizeStrings, tuningHz, physicalStrings };
}

let state: PlaybackPrefs = load();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): PlaybackPrefs {
  return state;
}

export function setUseSamples(on: boolean): void {
  if (state.useSamples === on) return;
  state = { ...state, useSamples: on };
  try {
    localStorage.setItem(KEY_SAMPLES, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}

export function setHumanizeStrings(on: boolean): void {
  if (state.humanizeStrings === on) return;
  state = { ...state, humanizeStrings: on };
  try {
    localStorage.setItem(KEY_HUMANIZE, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}

export function setPhysicalStrings(on: boolean): void {
  if (state.physicalStrings === on) return;
  state = { ...state, physicalStrings: on };
  try {
    localStorage.setItem(KEY_PHYSICAL, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}

export function setTuningHz(hz: number): void {
  const next = clampTuning(hz);
  if (state.tuningHz === next) return;
  state = { ...state, tuningHz: next };
  try {
    localStorage.setItem(KEY_TUNING, String(next));
  } catch {
    /* ignore */
  }
  emit();
}

/** React hook — 訂閱播放偏好, 任一播放器/設定改動 → 全部重繪。 */
export function usePlaybackPrefs(): PlaybackPrefs {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** 非 React 讀取 (測試 / 排程時一次性取值)。 */
export function getPlaybackPrefs(): PlaybackPrefs {
  return state;
}

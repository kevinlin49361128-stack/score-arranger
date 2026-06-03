/**
 * practiceSettingsStore — 每曲練習設定的「響應式單一來源」。
 *
 * 現況 (Phase C Track① 前): loop/速度/節拍器等設定散在各 PlaybackControls
 * 實例的 local useState + 一個寫 localStorage 的 effect。有 3 個實例
 * (工具列主播放器 + 源譜 + 改編譜 compact), 各持一份、靠 sourcePath effect
 * 各自存讀 → 同一把 key 多處寫、彼此不同步。
 *
 * 這個 store 把「讀寫該曲練習設定」收成一處: 包住既有 practiceSession.ts
 * (per-song localStorage, 已驗證), 疊上 useSyncExternalStore 響應式層
 * (mirror playbackPrefsStore 模式), 讓多個消費端訂閱同一份、任一改動全部重繪。
 *
 * 邊界: 本 store 只管 per-song 共享設定 (loop/速度/count-in/節拍器音色/handFocus)。
 * 混音 (trackGains/mute/solo) 是 per-side 獨立 (源/改編各自音訊), 之後另闢維度,
 * 不混進這份 per-song 共享設定。
 *
 * 注意: 此模組為 Track① slice 2 的地基, PlaybackControls 尚未接上 (接上 =
 * 動播放 hot path, 需 in-app 驗收)。先鋪好 + 單元測試, 消費端遷移後續處理。
 */
import { useSyncExternalStore } from "react";

import {
  loadPracticeSession,
  type PracticeSessionSettings,
  savePracticeSession,
} from "../utils/practiceSession";

const EMPTY: PracticeSessionSettings = Object.freeze({});

// songId(sourcePath) → 該曲設定的快取。getSnapshot 要回穩定參照
// (useSyncExternalStore 用 Object.is 比對), 故同一份物件存著、改動才換新參照。
const cache = new Map<string, PracticeSessionSettings>();
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

function snapshotFor(songId: string): PracticeSessionSettings {
  let cur = cache.get(songId);
  if (cur === undefined) {
    cur = loadPracticeSession(songId) ?? EMPTY;
    cache.set(songId, cur);
  }
  return cur;
}

/**
 * 合併更新某曲練習設定 + 持久化 + 通知訂閱者。
 * patch 只帶要改的欄位 (與 savePracticeSession 的 merge 一致, 不覆寫他欄)。
 */
export function updatePracticeSettings(
  songId: string | null | undefined,
  patch: Partial<PracticeSessionSettings>,
): void {
  if (!songId) return;
  const next = { ...snapshotFor(songId), ...patch };
  cache.set(songId, next);
  savePracticeSession(songId, patch);
  emit();
}

/**
 * 外部 (e.g. load_project 寫回 localStorage 後) 已改動該曲設定 → 讓 store
 * 丟掉快取重讀, 下次 snapshot 拿到新值並通知訂閱者。
 */
export function refreshPracticeSettings(songId: string | null | undefined): void {
  if (!songId) return;
  cache.delete(songId);
  emit();
}

/** React hook — 訂閱某曲的練習設定; 該曲設定改動 → 重繪。 */
export function usePracticeSettings(
  songId: string | null | undefined,
): PracticeSessionSettings {
  return useSyncExternalStore(subscribe, () =>
    songId ? snapshotFor(songId) : EMPTY,
  );
}

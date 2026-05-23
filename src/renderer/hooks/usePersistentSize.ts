/**
 * usePersistentSize — localStorage 持久的 size state hook.
 *
 * 用於 footer 高度 / sidebar 寬度等使用者可拖曳調整, 且應跨工作階段保留
 * 的尺寸. null 代表「使用預設值」(讓父元件依 mode default 決定).
 *
 * 0.1.28: 從 App.tsx 抽出. 原本 footer / side 各自重複一份 useState +
 * localStorage 讀寫邏輯, 整合到一個泛用 hook.
 */

import { useState } from "react";

interface PersistentSizeApi {
  /** 當前使用者覆寫值 (null = 用預設) */
  value: number | null;
  /** 設定並寫入 localStorage */
  set: (next: number) => void;
  /** 清除覆寫 (回到預設) */
  reset: () => void;
}

export function usePersistentSize(localStorageKey: string): PersistentSizeApi {
  const [value, setValue] = useState<number | null>(() => {
    try {
      const raw = window.localStorage?.getItem(localStorageKey);
      if (raw) {
        const v = parseInt(raw, 10);
        if (Number.isFinite(v) && v > 0) return v;
      }
    } catch { /* SSR / private mode */ }
    return null;
  });

  const set = (next: number) => {
    setValue(next);
    try {
      window.localStorage?.setItem(localStorageKey, String(next));
    } catch { /* ignore */ }
  };

  const reset = () => {
    setValue(null);
    try {
      window.localStorage?.removeItem(localStorageKey);
    } catch { /* ignore */ }
  };

  return { value, set, reset };
}

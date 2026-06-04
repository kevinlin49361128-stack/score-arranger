/**
 * harmonyStore — VIZ-3 即時和聲讀出的資料層
 *
 * 和聲是「曲子」的屬性 (不是改編的)，所以分析 source path 即可 (改編保留小節
 * 編號, 播放小節對齊)。每個 path 抓一次、module 級快取, 多個讀出元件共享。
 */
import { useEffect } from "react";
import { useSyncExternalStore } from "react";

import type { HarmonyAnalysis } from "../../shared/types";

type Entry = { status: "loading" | "ok" | "error"; data?: HarmonyAnalysis };

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

async function fetchHarmony(path: string): Promise<void> {
  if (cache.has(path)) return; // loading / 已完成 → 不重抓
  cache.set(path, { status: "loading" });
  emit();
  try {
    const res = await window.scoreArranger.engine.analyzeHarmony(path);
    cache.set(
      path,
      res.ok && res.data
        ? { status: "ok", data: res.data }
        : { status: "error" },
    );
  } catch {
    cache.set(path, { status: "error" });
  }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 訂閱某 path 的和聲分析; 無快取時自動觸發抓取。 */
export function useHarmony(path: string | null): {
  data: HarmonyAnalysis | null;
  loading: boolean;
} {
  const entry = useSyncExternalStore(subscribe, () =>
    path ? cache.get(path) : undefined,
  );
  useEffect(() => {
    if (path) void fetchHarmony(path);
  }, [path]);
  return {
    data: entry?.status === "ok" ? (entry.data ?? null) : null,
    loading: entry?.status === "loading",
  };
}

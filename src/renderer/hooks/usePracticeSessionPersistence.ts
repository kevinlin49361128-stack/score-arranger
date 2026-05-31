/**
 * 0.1.66 C3: 每曲保存 / 恢復練習設定。
 *
 * 換曲子 (sourcePath 變) 時恢復該曲存過的練習偏好; 之後使用者改設定就存回。
 * 目前涵蓋 store-resident 子集 (countInBars / metronomeSoundId / handFocus);
 * loop / playbackRate 等待從 PlaybackControls 提升到 store 後再納入。
 *
 * race 處理: 換曲那一輪不存 (skipSaveRef) — 避免把「上一首的值」寫進新曲。
 * 只有使用者後續主動改動才觸發存檔。
 */
import { useEffect, useRef } from "react";
import { useSessionStore } from "../stores/sessionStore";
import {
  loadPracticeSession,
  savePracticeSession,
} from "../utils/practiceSession";

export function usePracticeSessionPersistence(): void {
  const sourcePath = useSessionStore((s) => s.sourcePath);
  const countInBars = useSessionStore((s) => s.countInBars);
  const metronomeSoundId = useSessionStore((s) => s.metronomeSoundId);
  const handFocus = useSessionStore((s) => s.practiceHandFocus);

  const loadedRef = useRef<string | null>(null);
  const skipSaveRef = useRef(false);

  // 換曲 → 恢復
  useEffect(() => {
    if (!sourcePath) {
      loadedRef.current = null;
      return;
    }
    if (loadedRef.current === sourcePath) return;
    loadedRef.current = sourcePath;
    skipSaveRef.current = true; // 這一輪的值可能還是上一首的, 不存
    const saved = loadPracticeSession(sourcePath);
    if (!saved) return;
    const st = useSessionStore.getState();
    if (typeof saved.countInBars === "number") {
      st.setCountInBars(saved.countInBars);
    }
    if (saved.metronomeSoundId) st.setMetronomeSoundId(saved.metronomeSoundId);
    if (saved.handFocus) st.setPracticeHandFocus(saved.handFocus);
  }, [sourcePath]);

  // 設定改動 → 存 (只在已載入該曲、且非換曲那一輪時)
  useEffect(() => {
    if (loadedRef.current === null || loadedRef.current !== sourcePath) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    savePracticeSession(sourcePath, {
      countInBars,
      metronomeSoundId,
      handFocus,
    });
  }, [sourcePath, countInBars, metronomeSoundId, handFocus]);
}

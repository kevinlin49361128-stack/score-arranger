/**
 * useScrollSync — 雙面板同步捲動 hook
 *
 * 設計參考 Beyond Compare 的 diff viewer:
 * 兩個 ScoreViewer 共用 scrollTop。使用者捲動其一,另一個跟著移動。
 *
 * 避免回饋迴圈: 使用 `syncing` flag, 在程式化設定 scrollTop 後的下一個
 * animation frame 才清除,讓觸發的 scroll 事件被忽略。
 */

import { useEffect, useRef } from "react";

export interface ScrollSyncRefs {
  sourceRef: React.RefObject<HTMLDivElement>;
  targetRef: React.RefObject<HTMLDivElement>;
}

export function useScrollSync(): ScrollSyncRefs {
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const source = sourceRef.current;
    const target = targetRef.current;
    if (!source || !target) return;

    const mirror = (from: HTMLDivElement, to: HTMLDivElement) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      // 垂直: 用 ratio (兩面板高度可能不同)
      const vMax = Math.max(from.scrollHeight - from.clientHeight, 1);
      const vRatio = from.scrollTop / vMax;
      const toVMax = to.scrollHeight - to.clientHeight;
      to.scrollTop = vRatio * Math.max(toVMax, 0);
      // 水平: ribbon 模式下兩譜寬度幾乎一致 → 同樣用 ratio 比較穩
      const hMax = Math.max(from.scrollWidth - from.clientWidth, 1);
      const hRatio = from.scrollLeft / hMax;
      const toHMax = to.scrollWidth - to.clientWidth;
      to.scrollLeft = hRatio * Math.max(toHMax, 0);
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };

    const onSourceScroll = () => mirror(source, target);
    const onTargetScroll = () => mirror(target, source);

    source.addEventListener("scroll", onSourceScroll, { passive: true });
    target.addEventListener("scroll", onTargetScroll, { passive: true });

    return () => {
      source.removeEventListener("scroll", onSourceScroll);
      target.removeEventListener("scroll", onTargetScroll);
    };
  }, []);

  return { sourceRef, targetRef };
}

/**
 * PanelResizer — 樂譜區與資訊欄之間的拖曳分隔列
 *
 * - orientation="horizontal": 水平分隔列, 上下拖 → 調整下方面板高度
 * - orientation="vertical":   垂直分隔列, 左右拖 → 調整右側面板寬度
 * - 雙擊重置為預設值; hover 時 highlight
 *
 * 效能: 拖曳過程「不」走 React state — 直接改面板 DOM 的 height/width,
 * 由 flexbox 自動讓樂譜區縮放; 只在放開滑鼠時 commit 一次 setState.
 * 否則每個 mousemove 都 re-render 整個 App + OSMD 重排, 會非常卡.
 *
 * 0.1.28: 從 App.tsx 抽出. App.tsx 由 753 → 控制單一職責.
 */

import { useEffect, useRef, useState } from "react";

import { t as tr, useLocale } from "../utils/i18n";

interface PanelResizerProps {
  orientation: "horizontal" | "vertical";
  currentSize: number;
  panelRef: React.RefObject<HTMLElement | null>;
  onCommit: (size: number) => void;
  onReset: () => void;
}

export function PanelResizer({
  orientation, currentSize, panelRef, onCommit, onReset,
}: PanelResizerProps) {
  useLocale();
  // horizontal 分隔列 → 拖 Y 改 height; vertical → 拖 X 改 width
  const isH = orientation === "horizontal";
  const MIN = isH ? 60 : 220;
  const MAX = isH ? 700 : 900;
  const dragRef = useRef<
    { start: number; startSize: number; live: number } | null
  >(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (isH ? e.clientY : e.clientX) - dragRef.current.start;
      // 面板在下方/右方 → 往該方向拖會變小 → startSize - delta
      const next = Math.max(
        MIN,
        Math.min(MAX, dragRef.current.startSize - delta),
      );
      dragRef.current.live = next;
      // 直接改 DOM — 不觸發 React re-render, 樂譜區靠 flexbox 自動縮放
      if (panelRef.current) {
        if (isH) panelRef.current.style.height = `${next}px`;
        else panelRef.current.style.width = `${next}px`;
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        // 放開才 commit 一次 → 只此時 re-render + OSMD autofit
        onCommit(dragRef.current.live);
        dragRef.current = null;
        document.body.style.cursor = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onCommit, panelRef, isH, MIN, MAX]);

  return (
    <div
      onMouseDown={(e) => {
        dragRef.current = {
          start: isH ? e.clientY : e.clientX,
          startSize: currentSize,
          live: currentSize,
        };
        document.body.style.cursor = isH ? "ns-resize" : "ew-resize";
        e.preventDefault();
      }}
      onDoubleClick={onReset}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={isH
        ? tr("app.resizer.footer")
        : tr("app.resizer.side")}
      style={{
        ...(isH ? { height: 6 } : { width: 6, alignSelf: "stretch" }),
        background: hover ? "var(--accent)" : "var(--border)",
        cursor: isH ? "ns-resize" : "ew-resize",
        flexShrink: 0,
        transition: "background 0.15s ease",
        position: "relative",
      }}
    >
      {/* 加寬 hit area 至 ±4px (視覺只 6px) */}
      <div
        style={{
          position: "absolute",
          ...(isH
            ? { top: -4, bottom: -4, left: 0, right: 0 }
            : { left: -4, right: -4, top: 0, bottom: 0 }),
        }}
      />
    </div>
  );
}

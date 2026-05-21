/**
 * ZoomControls — 兩面板共用的縮放控制
 *
 * - 自動縮放 toggle (預設開, 依面板排列方向自動 fit)
 * - 手動: − 鈕、% 顯示、+ 鈕 (autoFit 關閉時才能用)
 * - 點 % 重置 1.0
 * - ⌘+ / ⌘- 快捷鍵
 */

import { useEffect } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

export function ZoomControls() {
  useLocale();
  const zoom = useSessionStore((s) => s.zoom);
  const zoomIn = useSessionStore((s) => s.zoomIn);
  const zoomOut = useSessionStore((s) => s.zoomOut);
  const zoomReset = useSessionStore((s) => s.zoomReset);
  const autoFit = useSessionStore((s) => s.autoFit);
  const toggleAutoFit = useSessionStore((s) => s.toggleAutoFit);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      // ⌘= / ⌘+ 放大 (手動縮放會自動關 autoFit)
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        if (autoFit) toggleAutoFit();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        if (autoFit) toggleAutoFit();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        zoomReset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, zoomReset, autoFit, toggleAutoFit]);

  const btn: React.CSSProperties = {
    padding: "4px 8px",
    border: "1px solid var(--button-border)",
    background: "var(--button-bg)",
    color: "var(--button-fg)",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
    minWidth: 28,
  };

  const pct = Math.round(zoom * 100);

  // 使用者手動 +/- 時, 自動關掉 autoFit (否則一秒就被自動覆寫)
  const manualZoom = (action: () => void) => {
    if (autoFit) toggleAutoFit();
    action();
  };

  return (
    <div
      style={{ display: "flex", gap: 2, alignItems: "center" }}
      title={t("zoom.control")}
    >
      <button
        onClick={toggleAutoFit}
        style={{
          ...btn,
          minWidth: 28,
          background: autoFit ? "var(--accent)" : btn.background,
          color: autoFit ? "var(--accent-fg)" : btn.color,
        }}
        title={autoFit
          ? t("zoom.autoFit.on")
          : t("zoom.autoFit.off")}
      >
        ⤢
      </button>
      <button
        onClick={() => manualZoom(zoomOut)}
        style={{ ...btn, opacity: autoFit ? 0.5 : 1 }}
        title={t("zoom.out")}
      >
        −
      </button>
      <button
        onClick={() => manualZoom(zoomReset)}
        style={{
          ...btn,
          minWidth: 50,
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          opacity: autoFit ? 0.65 : 1,
        }}
        title={autoFit ? t("zoom.autoFitPct", { pct }) : t("zoom.reset")}
      >
        {pct}%
      </button>
      <button
        onClick={() => manualZoom(zoomIn)}
        style={{ ...btn, opacity: autoFit ? 0.5 : 1 }}
        title={t("zoom.in")}
      >
        +
      </button>
    </div>
  );
}

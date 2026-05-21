import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

/**
 * 全畫面載入遮罩 — 取代原本頂端那條容易被忽略的細文字條。
 *
 * isLoading 為 true 時顯示: 半透明背景 + 轉圈 + 訊息 + 已等待秒數。
 * 秒數計時器取代寫死的「約 5-10 秒」估計 (大型樂譜實際更久, 寫死反而誤導)。
 */
export function LoadingOverlay() {
  useLocale();
  const isLoading = useSessionStore((s) => s.isLoading);
  const loadingMessage = useSessionStore((s) => s.loadingMessage);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!isLoading) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(1.5px)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "28px 44px",
          borderRadius: 12,
          minWidth: 240,
          background: "var(--bg-panel, #2c2c2e)",
          color: "var(--fg-primary, #f5f5f7)",
          border: "1px solid var(--border, #444)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "4px solid var(--border, rgba(255,255,255,0.18))",
            borderTopColor: "var(--accent, #4d8efc)",
            animation: "score-spin 0.8s linear infinite",
          }}
        />
        <div style={{ fontSize: 15, fontWeight: 600, textAlign: "center" }}>
          {loadingMessage || t("loading.processing")}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-muted, #a0a0a3)" }}>
          {t("loading.elapsed", { seconds: elapsed })}
          {elapsed >= 20 ? t("loading.elapsed.longHint") : ""}
        </div>
      </div>
    </div>
  );
}

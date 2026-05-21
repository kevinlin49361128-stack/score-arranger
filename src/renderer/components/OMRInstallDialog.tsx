/**
 * OMRInstallDialog — Audiveris / Java 缺失時的安裝指引 modal
 *
 * 比 setError 純文字 friendly 很多, 提供:
 * - 缺失項目列表 (java / audiveris)
 * - 各平台命令 (brew / apt / 下載 URL)
 * - 「重新檢查」按鈕 (使用者裝完不用重啟整個 app)
 */

import { useState } from "react";

import { t, useLocale } from "../utils/i18n";

interface OMRInstallDialogProps {
  missing: string[];
  installHints: Record<string, string>;
  onRetry: () => Promise<boolean>;     // 重新偵測, 回傳是否 ready
  onCancel: () => void;
}

export function OMRInstallDialog(
  { missing, installHints, onRetry, onCancel }: OMRInstallDialogProps,
) {
  useLocale();
  const [retrying, setRetrying] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryMsg(null);
    try {
      const ok = await onRetry();
      if (!ok) setRetryMsg(t("omr.retryMsg"));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-panel)",
          color: "var(--fg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 560,
          width: "92%",
          boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>{t("omr.heading")}</h2>
        <p style={{ marginTop: 8, color: "var(--fg-muted)", fontSize: 13 }}>
          {t("omr.intro")}
        </p>

        <div
          style={{
            marginTop: 16,
            background: "var(--bg-hover, rgba(255,255,255,0.04))",
            border: "1px solid var(--border-light)",
            borderRadius: 6,
            padding: 12,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {t("omr.missingLabel")}{missing.map((m) => (
              <span
                key={m}
                style={{
                  display: "inline-block",
                  background: "var(--accent-soft, rgba(255,165,0,0.2))",
                  color: "var(--accent)",
                  borderRadius: 4,
                  padding: "1px 6px",
                  margin: "0 4px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {m}
              </span>
            ))}
          </div>

          {Object.entries(installHints).map(([key, hint]) => (
            <div key={key} style={{ marginTop: 10 }}>
              <div style={{
                fontWeight: 600,
                fontSize: 12,
                textTransform: "uppercase",
                color: "var(--fg-muted)",
              }}>
                {key}
              </div>
              <pre style={{
                margin: "4px 0 0",
                padding: "8px 10px",
                background: "var(--bg-code, rgba(0,0,0,0.2))",
                borderRadius: 4,
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                fontFamily: "ui-monospace, monospace",
              }}>
                {hint}
              </pre>
            </div>
          ))}
        </div>

        {retryMsg && (
          <div style={{
            marginTop: 12,
            fontSize: 12,
            color: "var(--error, #ef4444)",
          }}>
            {retryMsg}
          </div>
        )}

        <div style={{
          marginTop: 20,
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: "6px 14px",
              border: "1px solid var(--button-border)",
              background: "var(--button-bg)",
              color: "var(--button-fg)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {t("omr.cancel")}
          </button>
          <button
            onClick={handleRetry}
            disabled={retrying}
            style={{
              padding: "6px 14px",
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              borderRadius: 4,
              cursor: retrying ? "wait" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {retrying ? t("omr.detecting") : t("omr.retry")}
          </button>
        </div>
      </div>
    </div>
  );
}

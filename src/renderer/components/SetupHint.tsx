/**
 * SetupHint — Setup mode 的歡迎/引導畫面
 *
 * 當尚未載入任何樂譜時顯示,引導使用者匯入或選預設範例。
 */

import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

export function SetupHint() {
  useLocale();
  const sourcePath = useSessionStore((s) => s.sourcePath);

  if (sourcePath) {
    return (
      <div
        style={{
          padding: "12px 16px",
          color: "var(--fg-muted)",
          fontSize: 13,
        }}
      >
        <div style={{ marginBottom: 6 }}>
          {t("setupHint.loaded")} <code style={{
            background: "var(--code-bg)",
            padding: "1px 4px",
            borderRadius: 3,
          }}>{sourcePath}</code>
        </div>
        <div style={{ color: "var(--fg-tertiary)" }}>
          {t("setupHint.loaded.next")}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        color: "var(--fg-muted)",
      }}
    >
      <div style={{ fontSize: 32 }}>🎼</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-primary)" }}>
        {t("setupHint.welcome")}
      </div>
      <div
        style={{
          fontSize: 13,
          textAlign: "center",
          maxWidth: 480,
          lineHeight: 1.6,
        }}
      >
        {t("setupHint.intro")}
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 12,
          color: "var(--fg-tertiary)",
          textAlign: "center",
        }}
      >
        {t("setupHint.workflowHeader")}<br />
        {t("setupHint.workflow")}
      </div>
    </div>
  );
}

/**
 * SetupHint — Setup mode 的歡迎/引導畫面
 *
 * 當尚未載入任何樂譜時顯示,引導使用者匯入或選預設範例。
 */

import { useSessionStore } from "../stores/sessionStore";

export function SetupHint() {
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
          ✓ 已載入: <code style={{
            background: "var(--code-bg)",
            padding: "1px 4px",
            borderRadius: 3,
          }}>{sourcePath}</code>
        </div>
        <div style={{ color: "var(--fg-tertiary)" }}>
          切換到「<strong>2 分析</strong>」檢視聲部結構,
          或直接點工具列的「<strong>改編</strong>」開始。
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
        歡迎使用 Score Arranger
      </div>
      <div
        style={{
          fontSize: 13,
          textAlign: "center",
          maxWidth: 480,
          lineHeight: 1.6,
        }}
      >
        從上方工具列點「<strong>匯入總譜</strong>」匯入 MusicXML 檔,
        或點「<strong>範例 ▾</strong>」直接載入 28 首巴洛克 / 古典 / 浪漫派作品其中之一。
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 12,
          color: "var(--fg-tertiary)",
          textAlign: "center",
        }}
      >
        ┌─ 工作流階段 ─┐<br />
        1 設定 → 2 分析 → 3 改編 → 4 微調 → 5 匯出
      </div>
    </div>
  );
}

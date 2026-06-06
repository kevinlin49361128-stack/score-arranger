/**
 * ModeBar — 借鑑 Dorico 的 mode-based workflow
 * (Setup → Analyze → Arrange → Refine → Export)
 */

import type { AppMode } from "../stores/sessionStore";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

const MODES: { id: AppMode; labelKey: string; descKey: string }[] = [
  { id: "setup", labelKey: "modebar.setup", descKey: "modebar.setup.desc" },
  {
    id: "analyze",
    labelKey: "modebar.analyze",
    descKey: "modebar.analyze.desc",
  },
  {
    id: "arrange",
    labelKey: "modebar.arrange",
    descKey: "modebar.arrange.desc",
  },
  {
    id: "transcribe",
    labelKey: "modebar.transcribe",
    descKey: "modebar.transcribe.desc",
  },
  { id: "refine", labelKey: "modebar.refine", descKey: "modebar.refine.desc" },
  {
    id: "export",
    labelKey: "modebar.export",
    descKey: "modebar.export.desc",
  },
];

export function ModeBar() {
  useLocale(); // 訂閱語言切換 → 切 locale 時 re-render
  const mode = useSessionStore((s) => s.mode);
  const setMode = useSessionStore((s) => s.setMode);
  // B2 (Dorico Proofreading 靈感): 在「微調」mode tab 上顯示待修問題數量徽章,
  // 讓問題密度從 mode bar 一眼可見 (Dorico 把計數放在面板存取點)。
  const issues = useSessionStore((s) => s.arrangementIssues);
  const issueCount = issues.filter(
    (i) => i.severity === "error" || i.severity === "warning",
  ).length;

  return (
    <nav
      style={{
        display: "flex",
        gap: 4,
        // A1 收斂 chrome: 8px→4px 垂直內距 (原本比其他 band 厚一倍), 騰出譜面空間
        padding: "var(--sp-1) var(--sp-3)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
      }}
    >
      {MODES.map((m, i) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          title={t(m.descKey)}
          style={{
            position: "relative",
            padding: "5px 14px",
            border: "none",
            borderRadius: 6,
            background: mode === m.id ? "var(--accent)" : "transparent",
            color: mode === m.id ? "var(--accent-fg)" : "var(--fg-secondary)",
            cursor: "pointer",
            fontSize: "var(--fs-base)",
            fontWeight: mode === m.id ? 600 : 400,
          }}
        >
          <span style={{ opacity: 0.6, marginRight: 6 }}>{i + 1}</span>
          {t(m.labelKey)}
          {m.id === "refine" && issueCount > 0 && (
            <span
              aria-hidden
              title={t("modebar.refine.issueBadge", { count: issueCount })}
              style={{
                marginLeft: 6,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 8,
                background: "var(--error-fg)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                verticalAlign: "middle",
              }}
            >
              {issueCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

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

  return (
    <nav
      style={{
        display: "flex",
        gap: 4,
        padding: "8px 12px",
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
            padding: "6px 16px",
            border: "none",
            borderRadius: 6,
            background: mode === m.id ? "var(--accent)" : "transparent",
            color: mode === m.id ? "var(--accent-fg)" : "var(--fg-secondary)",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: mode === m.id ? 600 : 400,
          }}
        >
          <span style={{ opacity: 0.6, marginRight: 6 }}>{i + 1}</span>
          {t(m.labelKey)}
        </button>
      ))}
    </nav>
  );
}

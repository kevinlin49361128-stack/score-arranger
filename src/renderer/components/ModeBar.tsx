/**
 * ModeBar — 借鑑 Dorico 的 mode-based workflow
 * (Setup → Analyze → Arrange → Refine → Export)
 */

import type { AppMode } from "../stores/sessionStore";
import { useSessionStore } from "../stores/sessionStore";

const MODES: { id: AppMode; label: string; description: string }[] = [
  { id: "setup", label: "設定", description: "匯入樂譜、選擇目標編制" },
  { id: "analyze", label: "分析", description: "檢視聲部功能、樂句邊界" },
  { id: "arrange", label: "改編", description: "拖拽重新分配、套用建議" },
  {
    id: "transcribe",
    label: "移植",
    description: "樂器替換 + 移調 (Bach 大提琴 → 小提琴 / 協奏曲換獨奏樂器 等)",
  },
  { id: "refine", label: "微調", description: "處理可演奏性問題" },
  { id: "export", label: "匯出", description: "匯出 MusicXML / MIDI / PDF" },
];

export function ModeBar() {
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
          title={m.description}
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
          {m.label}
        </button>
      ))}
    </nav>
  );
}

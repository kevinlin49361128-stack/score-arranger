/**
 * StatusBar — 視窗底部持久狀態列 (Dorico 靈感 A3)
 *
 * Dorico 招牌之一: 底部一條持續資訊列。這裡彙整原本散落的狀態:
 *   左: 引擎狀態 (就緒 / 載入中 / 精修中) + 當前 mode
 *   中: 來源曲名
 *   右: 聲部數 · 問題計數 (依嚴重度色碼) · 當前播放小節
 *
 * 純讀 sessionStore, 不持有狀態; 加在 App 根 flex column 最底, 不影響既有面板。
 */

import { useSessionStore } from "../stores/sessionStore";
import { t as tr } from "../utils/i18n";

function deriveName(sourcePath: string | null): string {
  if (!sourcePath) return "";
  if (sourcePath.startsWith("corpus:")) return sourcePath.slice(7);
  return sourcePath.split("/").pop() ?? sourcePath;
}

const cell: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sp-1)",
  whiteSpace: "nowrap",
};

export function StatusBar() {
  const sourcePath = useSessionStore((s) => s.sourcePath);
  const mode = useSessionStore((s) => s.mode);
  const arrangement = useSessionStore((s) => s.arrangement);
  const issues = useSessionStore((s) => s.arrangementIssues);
  const refining = useSessionStore((s) => s.refining);
  const isLoading = useSessionStore((s) => s.isLoading);
  const loadingMessage = useSessionStore((s) => s.loadingMessage);
  const playbackMeasure = useSessionStore((s) => s.playbackMeasure);

  // 引擎狀態: 載入 > 精修 > 就緒 (優先序), 以點色 + 文字表示
  let dotColor = "var(--success-fg)";
  let statusText = tr("statusbar.ready");
  if (isLoading) {
    dotColor = "var(--warning-fg)";
    statusText = loadingMessage || tr("statusbar.working");
  } else if (refining) {
    dotColor = "var(--accent)";
    statusText = tr("statusbar.refining");
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  const parts = arrangement?.players?.length ?? 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        flexShrink: 0,
        height: 24,
        padding: "0 var(--sp-3)",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-panel)",
        color: "var(--fg-muted)",
        fontSize: "var(--fs-xs)",
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      <span style={cell} title={statusText}>
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 5px ${dotColor}`,
          }}
        />
        <span
          style={{
            maxWidth: 280,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {statusText}
        </span>
      </span>

      <span style={{ opacity: 0.4 }}>·</span>
      <span style={cell}>{tr(`modebar.${mode}`)}</span>

      <span
        style={{
          flex: "1 1 0",
          minWidth: 0,
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={sourcePath ?? ""}
      >
        {deriveName(sourcePath)}
      </span>

      {parts > 0 && (
        <span style={cell}>{tr("statusbar.parts", { count: parts })}</span>
      )}
      {(errors > 0 || warnings > 0 || infos > 0) && (
        <span style={cell}>
          {errors > 0 && (
            <span style={{ color: "var(--error-fg)" }}>🔴 {errors}</span>
          )}
          {warnings > 0 && (
            <span style={{ color: "var(--warning-fg)" }}>🟡 {warnings}</span>
          )}
          {infos > 0 && (
            <span style={{ color: "var(--success-fg)" }}>🟢 {infos}</span>
          )}
        </span>
      )}
      {playbackMeasure != null && (
        <span style={cell}>
          {tr("statusbar.measure", { n: playbackMeasure })}
        </span>
      )}
    </div>
  );
}

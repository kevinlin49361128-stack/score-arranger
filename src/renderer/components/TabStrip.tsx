/**
 * TabStrip — 多分頁列
 *
 * Phase 1 限制: server-side state (_CURRENT_ARRANGEMENT, history) 仍是單一,
 * 切換 tab 後若要重新 apply suggestion 需先重新 arrange。
 */

import { useEffect } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t as tr, useLocale } from "../utils/i18n";

export function TabStrip() {
  useLocale();
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const sourcePath = useSessionStore((s) => s.sourcePath);
  const sourceMusicXML = useSessionStore((s) => s.sourceMusicXML);
  const setSourceMusicXML = useSessionStore((s) => s.setSourceMusicXML);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);
  const setMode = useSessionStore((s) => s.setMode);
  const newTab = useSessionStore((s) => s.newTab);
  const closeTab = useSessionStore((s) => s.closeTab);
  const switchTab = useSessionStore((s) => s.switchTab);
  const snapshotToTab = useSessionStore((s) => s.snapshotToTab);

  // 若使用者匯入了內容但沒有 tab, 自動建立第一個 tab
  useEffect(() => {
    if (sourcePath && tabs.length === 0) {
      newTab();
      setTimeout(() => snapshotToTab(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcePath, tabs.length]);

  // localStorage 還原的 tab 若 active 但無 sourceMusicXML, lazy 載入
  useEffect(() => {
    if (!activeTabId || !sourcePath || sourceMusicXML) return;
    let cancelled = false;
    (async () => {
      setLoading(true, tr("tab.reloadingScore"));
      try {
        const res = await window.scoreArranger.engine.toMusicXML(sourcePath);
        if (cancelled) return;
        if (res.ok && res.data) {
          setSourceMusicXML(res.data);
          snapshotToTab();
          setMode("setup");
        } else {
          setError(res.error ?? tr("tab.reloadFailed"));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, sourcePath, sourceMusicXML]);

  // 全域快捷鍵: ⌘T 新分頁, ⌘W 關當前分頁, Ctrl+Tab / Ctrl+Shift+Tab 切換
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "t" && !e.shiftKey) {
        e.preventDefault();
        newTab();
        return;
      }
      if (e.key === "w" && !e.shiftKey) {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
        return;
      }
      // Ctrl+Tab / Ctrl+Shift+Tab
      if (e.key === "Tab") {
        e.preventDefault();
        if (tabs.length < 2 || !activeTabId) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        if (idx < 0) return;
        const dir = e.shiftKey ? -1 : 1;
        const next = tabs[(idx + dir + tabs.length) % tabs.length];
        switchTab(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activeTabId, newTab, closeTab, switchTab]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "4px 8px",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        minHeight: 32,
        overflowX: "auto",
      }}
    >
      {tabs.map((t) => {
        const active = t.id === activeTabId;
        return (
          <div
            key={t.id}
            onClick={() => switchTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px 4px 12px",
              background: active ? "var(--bg-panel)" : "transparent",
              border: active
                ? "1px solid var(--border)"
                : "1px solid transparent",
              borderBottomColor: active ? "var(--bg-panel)" : undefined,
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontSize: 12,
              color: active ? "var(--fg-primary)" : "var(--fg-muted)",
              maxWidth: 220,
              userSelect: "none",
            }}
            title={t.sourcePath ?? tr("tab.emptyTab")}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 180,
              }}
            >
              {t.label}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--fg-tertiary)",
                cursor: "pointer",
                padding: "0 2px",
                fontSize: 14,
                lineHeight: 1,
              }}
              title={tr("tab.close")}
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        onClick={() => newTab()}
        style={{
          padding: "4px 10px",
          marginLeft: 4,
          border: "1px dashed var(--border)",
          background: "transparent",
          color: "var(--fg-muted)",
          cursor: "pointer",
          borderRadius: 6,
          fontSize: 13,
        }}
        title={tr("tab.new")}
      >
        +
      </button>
    </div>
  );
}

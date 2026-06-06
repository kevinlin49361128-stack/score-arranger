/**
 * CommandPalette — ⌘K 命令面板 (Dorico Jump bar 靈感, B1)
 *
 * 鍵盤驅動: ⌘K 喚出 → 輸入即過濾 → ↑↓ 選 → Enter 執行 → Esc 關。
 * 對熟手是效率躍升, 對新手是「找得到功能」的安全網 (功能多入口分散時最該補)。
 *
 * 自包含: 自管 open 狀態, 全域 ⌘K 監聽。命令動作走既有 CustomEvent /
 * sessionStore action, 不新增耦合。
 */

import { useEffect, useRef, useState } from "react";
import type { AppMode } from "../stores/sessionStore";
import { useSessionStore } from "../stores/sessionStore";
import { t as tr, useLocale } from "../utils/i18n";

type Command = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  run: () => void;
};

function emit(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

export function CommandPalette() {
  useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 全域 ⌘K / Ctrl+K 切換 (任何焦點下都可喚出, 標準命令面板行為)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 開啟時清空查詢 + 聚焦輸入
  useEffect(() => {
    if (open) {
      setQuery("");
      setSel(0);
      // 等 DOM 掛載後聚焦
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 每次 render 重算 (14 項極輕量) — useLocale() 在切語言時觸發 re-render,
  // 標籤即時跟著重譯; 不 memo 以免漏掉 locale 依賴。
  const buildCommands = (): Command[] => {
    const s = useSessionStore.getState();
    const goMode = (m: AppMode, key: string): Command => ({
      id: `mode:${m}`,
      label: `${tr("palette.goto")} ${tr(key)}`,
      hint: tr("palette.hint.mode"),
      keywords: `${m} ${tr(key)} mode`,
      run: () => s.setMode(m),
    });
    return [
      goMode("setup", "modebar.setup"),
      goMode("analyze", "modebar.analyze"),
      goMode("arrange", "modebar.arrange"),
      goMode("transcribe", "modebar.transcribe"),
      goMode("refine", "modebar.refine"),
      goMode("export", "modebar.export"),
      {
        id: "act:import",
        label: tr("palette.cmd.import"),
        hint: "⌘O",
        keywords: "import open score 匯入 開啟 樂譜",
        run: () => emit("sa:request-open-score"),
      },
      {
        id: "act:repertoire",
        label: tr("palette.cmd.repertoire"),
        hint: "⌘L",
        keywords: "repertoire library 曲庫 範例 corpus",
        run: () => emit("sa:request-open-repertoire"),
      },
      {
        id: "act:nlEdit",
        label: tr("palette.cmd.nlEdit"),
        hint: "⌘/",
        keywords: "ai nl edit 改譜 自然語言",
        run: () => emit("sa:request-open-nl-edit"),
      },
      {
        id: "act:export",
        label: tr("palette.cmd.export"),
        hint: "⌘E",
        keywords: "export 匯出 musicxml pdf midi wav",
        run: () => emit("sa:request-open-export-menu"),
      },
      {
        id: "act:metronome",
        label: tr("palette.cmd.metronome"),
        hint: "",
        keywords: "metronome 節拍器 練習",
        run: () => s.setMetronomeOpen(true),
      },
      {
        id: "act:theme",
        label: tr("palette.cmd.theme"),
        hint: "",
        keywords: "theme dark light 主題 深色 淺色",
        run: () => s.toggleTheme(),
      },
      {
        id: "act:layout",
        label: tr("palette.cmd.layout"),
        hint: "⌘\\",
        keywords: "layout 版面 橫向 縱向 panel",
        run: () => s.togglePanelLayout(),
      },
      {
        id: "act:heatmap",
        label: tr("palette.cmd.heatmap"),
        hint: "",
        keywords: "heatmap 難度 熱圖",
        run: () => s.toggleHeatmap(),
      },
      {
        id: "act:fillview",
        label: tr("palette.cmd.fillView"),
        hint: "",
        keywords: "fill view 塞滿 最多小節 page 檢視",
        run: () => s.toggleFillView(),
      },
    ];
  };

  const q = query.trim().toLowerCase();
  const filtered = buildCommands().filter(
    (c) =>
      !q
      || c.label.toLowerCase().includes(q)
      || c.keywords.toLowerCase().includes(q),
  );

  // 過濾後保持選取在範圍內
  useEffect(() => {
    if (sel >= filtered.length) setSel(Math.max(0, filtered.length - 1));
  }, [filtered.length, sel]);

  if (!open) return null;

  const run = (c: Command | undefined) => {
    if (!c) return;
    setOpen(false);
    // 等面板關閉後再執行 (避免 dialog 開啟時焦點打架)
    requestAnimationFrame(() => c.run());
  };

  return (
    <div
      onMouseDown={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 4000,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 92vw)",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-m)",
          boxShadow: "var(--elev-3)",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(filtered[sel]);
            }
          }}
          placeholder={tr("palette.placeholder")}
          style={{
            border: "none",
            outline: "none",
            padding: "var(--sp-3) var(--sp-4)",
            fontSize: "var(--fs-md)",
            background: "transparent",
            color: "var(--fg-primary)",
            borderBottom: "1px solid var(--border-light)",
          }}
        />
        <div style={{ overflowY: "auto", padding: "var(--sp-1)" }}>
          {filtered.length === 0 && (
            <div
              style={{
                padding: "var(--sp-4)",
                textAlign: "center",
                color: "var(--fg-muted)",
                fontSize: "var(--fs-sm)",
              }}
            >
              {tr("palette.empty")}
            </div>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setSel(i)}
              onClick={() => run(c)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                padding: "var(--sp-2) var(--sp-3)",
                border: "none",
                borderRadius: "var(--r-s)",
                cursor: "pointer",
                textAlign: "left",
                background: i === sel ? "var(--accent)" : "transparent",
                color: i === sel ? "var(--accent-fg)" : "var(--fg-primary)",
              }}
            >
              <span style={{ flex: 1, fontSize: "var(--fs-base)" }}>
                {c.label}
              </span>
              <span
                style={{
                  fontSize: "var(--fs-xs)",
                  opacity: 0.7,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {c.hint}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

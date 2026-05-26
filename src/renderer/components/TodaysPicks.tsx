/**
 * TodaysPicks — 0.1.47 視覺升級 C3.
 *
 * 空狀態顯示 3 首「今日推薦」, 依日期決定 (每天 picks 一致, 隔天換),
 * 減少使用者面對 𝄞 + 兩顆按鈕的單調感, 鼓勵試曲庫.
 *
 * 設計取捨:
 * - 不用隨機 — 「今日」概念是訊息設計核心, 隨機重新整理會破壞期待
 * - 依日期 seed → 同一天看到的是同 3 首, 隔天換
 * - 只挑有 measures + grade 的曲目, 確保推薦完整 metadata
 * - 點擊 → 觸發 sa:request-load-corpus 事件, 由 Toolbar 處理載入
 */

import { useMemo } from "react";
import {
  composerMonogram, ensembleIcon, ERA_BAND, eraFontFamily,
  REPERTOIRE, type RepertoireEntry,
} from "../data/repertoireCatalog";
import { t, useLocale } from "../utils/i18n";

/** 給定 seed (e.g. 今日 yyyy-mm-dd), 從 candidates 挑出 n 首. */
function pickDeterministic<T>(seed: string, items: T[], n: number): T[] {
  // 簡單 hash → 索引序列 (不需密碼學等級, 只要日內穩定)
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const out: T[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < items.length) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const idx = h % items.length;
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(items[idx]);
  }
  return out;
}

function dateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function TodaysPicks() {
  useLocale();
  const picks = useMemo(() => {
    // 過濾條件: 有合理 grade + 不超大 (避免推薦完全不可用的曲目)
    const candidates = REPERTOIRE.filter(
      e => e.grade != null && (e.measures ?? 0) < 600,
    );
    return pickDeterministic(dateKey(), candidates, 3);
  }, []);

  if (picks.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 18,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        animation: "fx-reveal 0.5s ease-out",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--fg-tertiary)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {t("todaysPicks.title")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {picks.map((p) => <PickCard key={p.corpus_path} entry={p} />)}
      </div>
    </div>
  );
}

function PickCard({ entry }: { entry: RepertoireEntry }) {
  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent("sa:request-load-corpus", {
        detail: { corpus_path: entry.corpus_path },
      }),
    );
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${entry.composer} (${entry.composer_dates})\n${entry.title}`}
      style={{
        width: 200,
        padding: "10px 12px",
        background: "var(--bg-panel)",
        border: "1px solid var(--border-light)",
        borderLeft: `4px solid ${ERA_BAND[entry.era]}`,
        borderRadius: 6,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        gap: 10,
        alignItems: "center",
        transition: "background 0.2s, border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-hover)";
        e.currentTarget.style.borderColor = "var(--accent)";
        e.currentTarget.style.borderLeftColor = ERA_BAND[entry.era];
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-panel)";
        e.currentTarget.style.borderColor = "var(--border-light)";
        e.currentTarget.style.borderLeftColor = ERA_BAND[entry.era];
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28, height: 28, borderRadius: "50%",
          background: ERA_BAND[entry.era],
          color: "#fdf6e3",
          fontSize: 10, fontWeight: 700,
          fontFamily: "Georgia, 'Times New Roman', serif",
          flexShrink: 0,
        }}
      >
        {composerMonogram(entry.composer)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--fg-primary)",
            fontFamily: eraFontFamily(entry.era),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {entry.title}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--fg-tertiary)",
            marginTop: 2,
            display: "flex",
            gap: 4,
            alignItems: "center",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 16 16"
               fill="none" stroke="currentColor" strokeWidth="1.2"
               style={{ opacity: 0.7 }}>
            <path d={ensembleIcon(entry.ensemble)} />
          </svg>
          {entry.grade != null && <span>G{entry.grade}</span>}
        </div>
      </div>
    </button>
  );
}

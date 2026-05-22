/**
 * PracticePanel — 練習模式 (整合 C)
 *
 * 抓出當前 arrangement 各 part 的 per-measure 難度, 列出最難的 8 個小節。
 * 點選任一筆 → 透過 sessionStore.requestLoop 讓 PlaybackControls 自動
 * 設定 loop 區間 + 啟用 loop, 同時 setHighlightedMeasure 把畫面捲過去。
 * 使用者按 ▶ 即進入「重點循環練習」狀態。
 *
 * 慢速練習 (playback rate 變速) 屬於 v2 增強, 本版聚焦「找到並循環最難段」
 * 這個核心價值。
 *
 * 觸發點: Toolbar「🎯 練習」按鈕 (需先完成一次改編)。
 */

import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

interface Props {
  onClose: () => void;
}

interface HardMeasure {
  measure: number;
  score: number;
  partId: string;
  partLabel: string;
}

const TOP_N = 8;

function difficultyColor(score: number): string {
  if (score >= 4.0) return "#d8843a";
  if (score >= 3.0) return "var(--accent)";
  return "var(--fg-muted)";
}

export function PracticePanel({ onClose }: Props) {
  useLocale();
  const requestLoop = useSessionStore((s) => s.requestLoop);
  const setHighlightedMeasure = useSessionStore(
    (s) => s.setHighlightedMeasure,
  );
  const arrangement = useSessionStore((s) => s.arrangement);

  const [hardest, setHardest] = useState<HardMeasure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!arrangement) return;
    setLoading(true);
    setError(null);
    window.scoreArranger.engine.computeDifficulty()
      .then((res) => {
        if (!res.ok || !res.data) {
          setError(res.error ?? t("practice.computeFailed"));
          return;
        }
        // 各 part per-measure 分數 → 每個小節取最高分 (任一聲部難就難)
        type Acc = { score: number; partId: string; partLabel: string };
        const byMeasure = new Map<number, Acc>();
        for (const [partId, entry] of Object.entries(res.data)) {
          const e = entry as DifficultyEntry;
          for (const m of e.measures) {
            const cur = byMeasure.get(m.measure);
            if (!cur || m.score > cur.score) {
              byMeasure.set(m.measure, {
                score: m.score,
                partId,
                partLabel: e.label,
              });
            }
          }
        }
        const sorted = Array.from(byMeasure.entries())
          .map(([measure, v]) => ({ measure, ...v }))
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_N);
        setHardest(sorted);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [arrangement]);

  const handlePick = (m: number) => {
    requestLoop(m, m);
    setHighlightedMeasure(m);
    onClose();
  };

  return (
    <div
      className="fx-modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        zIndex: 100, display: "flex", alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="fx-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, maxHeight: "82vh", background: "var(--bg-panel)",
          borderRadius: 8, border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <header
          style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <strong style={{ flex: 1, fontSize: 14 }}>
            {t("practice.title")}
          </strong>
          <button
            onClick={onClose}
            style={{
              padding: "4px 10px",
              border: "1px solid var(--button-border)",
              background: "var(--button-bg)", color: "var(--button-fg)",
              borderRadius: 4, cursor: "pointer", fontSize: 12,
            }}
          >
            {t("nlEdit.close")}
          </button>
        </header>

        <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
          <div
            style={{
              fontSize: 12, color: "var(--fg-muted)",
              lineHeight: 1.6, marginBottom: 12,
            }}
          >
            {t("practice.intro")}
          </div>

          {!arrangement && (
            <div
              style={{
                padding: 12, background: "var(--info-bg)",
                color: "var(--info-fg)", borderRadius: 4, fontSize: 13,
              }}
            >
              {t("practice.empty")}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 8, background: "var(--error-bg)",
                color: "var(--error-fg)", borderRadius: 4, fontSize: 12,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {loading && (
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
              {t("practice.loading")}
            </div>
          )}

          {hardest.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 11, color: "var(--fg-tertiary)",
                  marginBottom: 6, letterSpacing: ".05em", fontWeight: 700,
                }}
              >
                {t("practice.hardest")}
              </div>
              <div
                style={{
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                {hardest.map((h) => (
                  <button
                    key={`${h.measure}-${h.partId}`}
                    onClick={() => handlePick(h.measure)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "9px 12px",
                      border: "1px solid var(--border-light)",
                      background: "var(--bg-panel)",
                      color: "var(--fg-primary)",
                      borderRadius: 6, cursor: "pointer",
                      textAlign: "left", font: "inherit",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13, fontWeight: 700, minWidth: 80,
                      }}
                    >
                      {t("practice.measureLabel", { n: h.measure })}
                    </span>
                    <span
                      style={{
                        flex: 1, fontSize: 12, color: "var(--fg-muted)",
                      }}
                    >
                      {h.partId} · {h.partLabel}
                    </span>
                    <span
                      style={{
                        fontSize: 15, fontWeight: 700,
                        color: difficultyColor(h.score),
                      }}
                    >
                      {h.score.toFixed(1)}
                    </span>
                  </button>
                ))}
              </div>
              <div
                style={{
                  marginTop: 12, fontSize: 11,
                  color: "var(--fg-tertiary)", lineHeight: 1.5,
                }}
              >
                {t("practice.hint")}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

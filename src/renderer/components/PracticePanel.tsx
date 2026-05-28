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

import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import {
  dailyMinutes,
  endPracticeSession,
  type PracticeEntry,
  startPracticeSession,
  todayMinutes,
  usePracticeLog,
} from "../stores/practiceLogStore";
import { t, useLocale } from "../utils/i18n";

interface Props {
  onClose: () => void;
}

interface HardMeasure {
  measure: number;
  score: number;
  partId: string;
  partLabel: string;
  /** 0.1.32: per-factor breakdown — 給「為什麼難」顯示 */
  factors: {
    range: number;
    density: number;
    chord: number;
    rhythm: number;
    technique: number;
  };
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
  const sourcePath = useSessionStore((s) => s.sourcePath);

  // 0.1.54 E: 練習日誌 — 進面板 = startSession, 關 / 切譜 = endSession.
  // sessionId ref 跨 unmount cleanup 拿得到 (避免 stale closure).
  const sessionIdRef = useRef<string | null>(null);
  const practiceLog = usePracticeLog();
  useEffect(() => {
    if (!arrangement) return;
    const title = sourcePath ?? arrangement.name ?? "Untitled";
    const id = startPracticeSession(sourcePath ?? undefined, title);
    sessionIdRef.current = id;
    return () => {
      if (sessionIdRef.current) {
        endPracticeSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [arrangement, sourcePath]);

  const [hardest, setHardest] = useState<HardMeasure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 展開中的小節 → 顯示 fingering 提示 (拉 D2 viterbi). null 表示沒展開. */
  const [expandedMeasure, setExpandedMeasure] = useState<number | null>(null);
  const [fingering, setFingering] = useState<MeasureFingeringResult | null>(
    null,
  );
  const [fingeringLoading, setFingeringLoading] = useState(false);

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
        // 0.1.32: 同時帶入 per-factor 給「為什麼難」展開
        type Acc = {
          score: number;
          partId: string;
          partLabel: string;
          factors: HardMeasure["factors"];
        };
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
                factors: {
                  range: m.range,
                  density: m.density,
                  chord: m.chord,
                  rhythm: m.rhythm,
                  technique: m.technique,
                },
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

  /** 展開/折疊 fingering 預覽 — 拿弦樂 part 的把位建議 (D2 viterbi). */
  const handleToggleExpand = (m: number) => {
    if (expandedMeasure === m) {
      setExpandedMeasure(null);
      setFingering(null);
      return;
    }
    setExpandedMeasure(m);
    setHighlightedMeasure(m);
    setFingeringLoading(true);
    setFingering(null);
    window.scoreArranger.engine.getMeasureFingering(m)
      .then((res) => {
        if (res.ok && res.data) setFingering(res.data);
        // 沒回 (e.g. 全鋼琴編制) → fingering 保持 null, UI 顯示空狀態
      })
      .catch(() => {})
      .finally(() => setFingeringLoading(false));
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

          {/* 0.1.54 E: 練習日誌 — 今日 / 過去 7 日 / 最近紀錄 */}
          <PracticeLogSidebar entries={practiceLog} />

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
                {hardest.map((h) => {
                  const expanded = expandedMeasure === h.measure;
                  return (
                    <div
                      key={`${h.measure}-${h.partId}`}
                      style={{
                        border: "1px solid var(--border-light)",
                        borderRadius: 6,
                        overflow: "hidden",
                        background: "var(--bg-panel)",
                      }}
                    >
                      <button
                        onClick={() => handleToggleExpand(h.measure)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "9px 12px",
                          border: "none",
                          background: expanded
                            ? "var(--bg-tertiary)"
                            : "transparent",
                          color: "var(--fg-primary)",
                          width: "100%", cursor: "pointer",
                          textAlign: "left", font: "inherit",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11, color: "var(--fg-tertiary)",
                            width: 12,
                          }}
                        >
                          {expanded ? "▾" : "▸"}
                        </span>
                        <span
                          style={{
                            fontSize: 13, fontWeight: 700, minWidth: 70,
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
                      {expanded && (
                        <div
                          style={{
                            padding: "10px 14px",
                            borderTop: "1px solid var(--border-light)",
                            background: "var(--bg-secondary)",
                          }}
                        >
                          {/* 0.1.32 因子拆解 — 為什麼難 */}
                          <DifficultyFactorBars factors={h.factors} />
                          {fingeringLoading && (
                            <div style={{
                              fontSize: 11, color: "var(--fg-tertiary)",
                            }}>
                              {t("practice.fingering.loading")}
                            </div>
                          )}
                          {!fingeringLoading && fingering
                              && fingering.parts.length === 0 && (
                            <div style={{
                              fontSize: 11, color: "var(--fg-tertiary)",
                            }}>
                              {t("practice.fingering.empty")}
                            </div>
                          )}
                          {!fingeringLoading && fingering
                              && fingering.parts.map((part) => (
                            <div key={part.part_id} style={{ marginBottom: 8 }}>
                              <div style={{
                                fontSize: 11, fontWeight: 600,
                                color: "var(--fg-muted)", marginBottom: 4,
                              }}>
                                🎻 {part.display_name}
                              </div>
                              <div style={{
                                display: "flex", flexWrap: "wrap", gap: 4,
                              }}>
                                {part.events.map((ev, i) => (
                                  <span
                                    key={`${i}-${ev.midi}-${ev.fret}`}
                                    style={{
                                      fontSize: 11,
                                      padding: "2px 6px",
                                      background: "var(--bg-panel)",
                                      border: "1px solid var(--border-light)",
                                      borderRadius: 3,
                                      color: ev.fret > 7
                                        ? "#d8843a"
                                        : "var(--fg-primary)",
                                    }}
                                    title={t("practice.fingering.tooltip", {
                                      pitch: ev.pitch,
                                      string: ev.string_name,
                                      fret: String(ev.fret),
                                    })}
                                  >
                                    {ev.pitch} · {ev.string_name}{ev.fret}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePick(h.measure);
                            }}
                            style={{
                              marginTop: 8,
                              padding: "5px 10px",
                              fontSize: 11,
                              border: "1px solid var(--border)",
                              background: "var(--accent)",
                              color: "var(--accent-fg)",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            🔁 {t("practice.fingering.loopBtn")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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


/**
 * DifficultyFactorBars — 0.1.32: 把 5 因子畫成水平條, 「為什麼難」一目了然.
 * 因子值是 0-1, 條寬對應百分比, 顏色越深越主導.
 */
function DifficultyFactorBars({
  factors,
}: {
  factors: { range: number; density: number; chord: number;
             rhythm: number; technique: number };
}) {
  const entries: { key: keyof typeof factors; label: string }[] = [
    { key: "range", label: t("difficulty.factor.range") },
    { key: "density", label: t("difficulty.factor.density") },
    { key: "chord", label: t("difficulty.factor.chord") },
    { key: "rhythm", label: t("difficulty.factor.rhythm") },
    { key: "technique", label: t("difficulty.factor.technique") },
  ];
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 10, color: "var(--fg-tertiary)", marginBottom: 4,
        fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase",
      }}>
        {t("difficulty.whyHard")}
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        {entries.map(({ key, label }) => {
          const v = factors[key];
          const pct = Math.max(0, Math.min(1, v)) * 100;
          const colour = v >= 0.7
            ? "#d8843a"
            : v >= 0.4 ? "var(--accent)" : "var(--fg-muted)";
          return (
            <div
              key={key}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span style={{ fontSize: 10, width: 32,
                             color: "var(--fg-muted)" }}>
                {label}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: "var(--bg-panel)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: colour,
                    transition: "width .25s ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 9, width: 26,
                  textAlign: "right", color: "var(--fg-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {v.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/**
 * PracticeLogSidebar — 0.1.54 E: 練習日誌摘要.
 *
 * 三層:
 *  1. 今日累計分鐘 + 過去 7 日 bar chart
 *  2. 最近 3 筆 session (時間 / 曲目 / 分鐘 / 麥克風分數)
 *  3. 預設摺疊, 點 header 展開
 *
 * 不用 chart 套件 — 純 div + width % 畫條.
 */
function PracticeLogSidebar({
  entries,
}: {
  entries: PracticeEntry[];
}) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  const today = todayMinutes(entries);
  const dailyBars = dailyMinutes(entries, 7);
  const maxDay = Math.max(1, ...dailyBars);
  const recent = entries
    .filter((e) => e.ended_at !== undefined)
    .slice(0, 3);

  return (
    <div
      style={{
        marginBottom: 12, padding: "10px 12px",
        background: "var(--bg-panel)",
        border: "1px solid var(--border)", borderRadius: 6,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        style={{
          all: "unset", cursor: "pointer", width: "100%",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)",
        }}
      >
        <span>
          📔 {t("practice.log.heading")} —
          {" "}
          <span style={{ color: "var(--accent)" }}>
            {t("practice.log.todayMin", { min: Math.round(today) })}
          </span>
        </span>
        <span style={{ fontSize: 10, color: "var(--fg-muted)" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {/* 7 日 bar chart — 從 6 日前到今日 */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 4, height: 36,
            marginBottom: 8,
          }}>
            {dailyBars.slice().reverse().map((mins, i) => {
              const h = mins > 0 ? Math.max(4, (mins / maxDay) * 32) : 2;
              const isToday = i === dailyBars.length - 1;
              return (
                <div
                  key={i}
                  title={`${Math.round(mins)} ${t("practice.log.minutes")}`}
                  style={{
                    flex: 1, height: h,
                    background: isToday ? "var(--accent)" : "var(--fg-muted)",
                    opacity: mins > 0 ? 1 : 0.3,
                    borderRadius: 2,
                  }}
                />
              );
            })}
          </div>
          {/* 最近 session */}
          {recent.length > 0 && (
            <div style={{ fontSize: 11, lineHeight: 1.6 }}>
              {recent.map((e) => {
                const dur = Math.round((e.ended_at! - e.started_at) / 60000);
                const date = new Date(e.started_at).toLocaleDateString();
                return (
                  <div
                    key={e.id}
                    style={{
                      display: "flex", justifyContent: "space-between",
                      gap: 6, color: "var(--fg-muted)",
                    }}
                  >
                    <span style={{
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", flex: 1,
                    }}>
                      {date} · {e.score_title ?? "—"}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {dur}{t("practice.log.minShort")}
                      {e.mic_score !== undefined &&
                        ` · ${e.mic_score}${t("practice.log.scoreShort")}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

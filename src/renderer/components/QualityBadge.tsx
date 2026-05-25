/**
 * QualityBadge — 顯示改編三項品質分數
 *
 * 三項 0-1: melody_preservation / harmony_completeness / playability
 * 整體分數: 加權平均
 *
 * 設計參考 Lighthouse 圓圈分數樣式 — 看一眼就知道綠/黃/紅。
 */

import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

export function QualityBadge() {
  useLocale();
  const arrangement = useSessionStore((s) => s.arrangement);
  const targetMusicXML = useSessionStore((s) => s.targetMusicXML);
  const [quality, setQuality] = useState<QualityReport | null>(null);

  useEffect(() => {
    if (!arrangement || !targetMusicXML) {
      setQuality(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await window.scoreArranger.engine.computeQuality();
        if (res.ok && res.data && "overall" in (res.data as object)) {
          setQuality(res.data as QualityReport);
        } else {
          setQuality(null);
        }
      } catch {
        setQuality(null);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [arrangement, targetMusicXML]);

  if (!quality) return null;

  return (
    <div
      title={tooltip(quality)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--bg-panel)",
        fontSize: 11,
        marginLeft: 8,
      }}
    >
      <span style={{ color: "var(--fg-muted)", fontWeight: 500 }}>
        {t("quality.label")}
      </span>
      <Ring label={t("quality.melody")} score={quality.melody_preservation} />
      <Ring
        label={t("quality.harmony")}
        score={quality.harmony_completeness}
      />
      <Ring label={t("quality.playability")} score={quality.playability} />
      <span
        style={{
          marginLeft: 4,
          paddingLeft: 6,
          borderLeft: "1px solid var(--border-light)",
          color: scoreColor(quality.overall),
          fontWeight: 700,
        }}
      >
        {Math.round(quality.overall * 100)}
      </span>
    </div>
  );
}

function Ring({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 100);
  const color = scoreColor(score);
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        minWidth: 38,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background:
            `conic-gradient(${color} ${pct * 3.6}deg, var(--bg-tertiary) 0)`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          color: "var(--fg-primary)",
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--bg-panel)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {pct}
        </span>
      </span>
      <span style={{
        color: "var(--fg-muted)", marginTop: 1, whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 0.85) return "#22c55e";   // green
  if (score >= 0.65) return "#eab308";   // yellow
  return "#ef4444";                       // red
}

function tooltip(q: QualityReport): string {
  return [
    t("quality.tipOverall", { score: Math.round(q.overall * 100) }),
    t("quality.tipMelody", {
      pct: Math.round(q.melody_preservation * 100),
    }),
    t("quality.tipHarmony", {
      pct: Math.round(q.harmony_completeness * 100),
    }),
    t("quality.tipPlayability", {
      pct: Math.round(q.playability * 100),
    }),
    t("quality.tipIssues", {
      error: q.details.issue_count_error,
      warning: q.details.issue_count_warning,
    }),
  ].join("\n");
}

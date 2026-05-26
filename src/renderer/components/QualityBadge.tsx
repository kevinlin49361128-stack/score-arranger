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
      {/* 0.1.46 C2: radar triangle 取代三個圓環 */}
      <RadarTriangle
        melody={quality.melody_preservation}
        harmony={quality.harmony_completeness}
        playability={quality.playability}
        labels={{
          melody: t("quality.melody"),
          harmony: t("quality.harmony"),
          playability: t("quality.playability"),
        }}
      />
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

/**
 * 0.1.46 C2 — 改編品質 radar triangle.
 * 三項分數 (melody/harmony/playability) 畫成等邊三角形 radar,
 * 整體形狀和顏色一眼看出弱點.
 * 三角形面積越大表示三項分數越平衡;
 * 顏色採平均分數的綠/黃/紅.
 */
function RadarTriangle({
  melody, harmony, playability, labels,
}: {
  melody: number;
  harmony: number;
  playability: number;
  labels: { melody: string; harmony: string; playability: string };
}) {
  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  // 三個頂點: top, bottom-right, bottom-left (120° 間距)
  const angles = [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6];
  const scores = [melody, harmony, playability];
  const labelTexts = [labels.melody, labels.harmony, labels.playability];

  const outerPts = angles.map(a => [cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  const innerPts = angles.map((a, i) => {
    const s = Math.max(0.05, scores[i]);
    return [cx + r * s * Math.cos(a), cy + r * s * Math.sin(a)];
  });
  const avg = (melody + harmony + playability) / 3;
  const fill = scoreColor(avg);
  const polyOuter = outerPts.map(p => p.join(",")).join(" ");
  const polyInner = innerPts.map(p => p.join(",")).join(" ");
  const tooltip =
    `${labels.melody}: ${Math.round(melody * 100)} · ` +
    `${labels.harmony}: ${Math.round(harmony * 100)} · ` +
    `${labels.playability}: ${Math.round(playability * 100)}`;

  return (
    <span
      title={tooltip}
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 外框 (滿分輪廓) */}
        <polygon
          points={polyOuter}
          fill="var(--bg-tertiary)"
          stroke="var(--border-light)"
          strokeWidth="1"
        />
        {/* 實際分數 */}
        <polygon
          points={polyInner}
          fill={fill}
          fillOpacity="0.35"
          stroke={fill}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* 頂點小圓 */}
        {innerPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.8} fill={fill} />
        ))}
        {/* 標籤 (極簡, 只用首字, 完整文字交給 tooltip) */}
        {outerPts.map((_pt, i) => {
          const a = angles[i];
          const lx = cx + (r + 5) * Math.cos(a);
          const ly = cy + (r + 5) * Math.sin(a);
          return (
            <text
              key={`l${i}`}
              x={lx} y={ly + 3}
              fontSize="8"
              fill="var(--fg-muted)"
              textAnchor="middle"
            >
              {labelTexts[i].slice(0, 2)}
            </text>
          );
        })}
      </svg>
    </span>
  );
}

// 舊版 Ring (conic-gradient) 0.1.46 改用 RadarTriangle 取代; 元件移除.

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

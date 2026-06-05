/**
 * TimelineStrip — VIZ-4 時間軸流動條 (共用基礎元件)
 *
 * 把一組「每小節一個值」的序列疊成數條沿時間流動的 lane, 共用同一條播放游標。
 * 不知道資料語意 (密度/張力/調性…) — 只認 lane 的 kind 與值, 故可被任何
 * per-measure 序列重用。每 lane 一個 SVG (viewBox 寬 = 小節數, 非等比縮放),
 * 用細長 rect 畫 → null 安全、119 小節仍輕量。
 */
import { useState } from "react";

export interface TimelineLane {
  key: string;
  label: string;
  kind: "area" | "colorband";
  /** area: 0..1 高度 (null = 該小節無值, 留白) */
  values?: (number | null)[];
  color?: string;
  /** colorband: 0..1 → hue 0..360 */
  hueValues?: number[];
  /** colorband: 0..1 → 飽和/不透明 */
  clarityValues?: number[];
}

interface Props {
  firstMeasure: number;
  measureCount: number;
  playbackMeasure: number | null;
  lanes: TimelineLane[];
  laneHeight?: number;
  /** hover 到第幾個小節格 (0-based index, 不在範圍時 null) */
  onHoverMeasure?: (idx: number | null) => void;
}

function AreaLane({ values, color, h }: {
  values: (number | null)[]; color: string; h: number;
}): JSX.Element {
  const n = values.length;
  return (
    <svg
      viewBox={`0 0 ${n} 100`} preserveAspectRatio="none"
      width="100%" height={h}
      style={{ display: "block", borderRadius: 3, background: "var(--bg-panel)" }}
    >
      {values.map((v, i) =>
        v == null ? null : (
          <rect
            key={i}
            x={i} y={100 - v * 100} width={1.02} height={v * 100}
            fill={color}
          />
        ),
      )}
    </svg>
  );
}

function ColorBandLane({ hues, clarity, h }: {
  hues: number[]; clarity: number[]; h: number;
}): JSX.Element {
  const n = hues.length;
  return (
    <svg
      viewBox={`0 0 ${n} 100`} preserveAspectRatio="none"
      width="100%" height={h}
      style={{ display: "block", borderRadius: 3, background: "var(--bg-panel)" }}
    >
      {hues.map((hue, i) => {
        const c = clarity[i] ?? 0.5;
        const sat = 35 + c * 45; // 清晰度高 → 飽和; 模糊 → 偏灰
        return (
          <rect
            key={i}
            x={i} y={0} width={1.02} height={100}
            fill={`hsl(${Math.round(hue * 360)}, ${Math.round(sat)}%, 52%)`}
            opacity={0.35 + c * 0.55}
          />
        );
      })}
    </svg>
  );
}

export function TimelineStrip({
  firstMeasure, measureCount, playbackMeasure, lanes, laneHeight = 20,
  onHoverMeasure,
}: Props): JSX.Element | null {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (measureCount <= 0) return null;

  const inRange =
    playbackMeasure != null &&
    playbackMeasure >= firstMeasure &&
    playbackMeasure < firstMeasure + measureCount;
  const cursorPct = inRange
    ? ((playbackMeasure - firstMeasure + 0.5) / measureCount) * 100
    : null;
  const hoverPct =
    hoverIdx != null ? ((hoverIdx + 0.5) / measureCount) * 100 : null;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(measureCount - 1, Math.floor(ratio * measureCount)));
    if (idx !== hoverIdx) {
      setHoverIdx(idx);
      onHoverMeasure?.(idx);
    }
  };
  const onLeave = () => {
    setHoverIdx(null);
    onHoverMeasure?.(null);
  };

  return (
    <div
      style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6, cursor: "crosshair" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {lanes.map((lane) => (
        <div key={lane.key}>
          <div style={{ fontSize: 10, color: "var(--fg-muted)", marginBottom: 1 }}>
            {lane.label}
          </div>
          {lane.kind === "colorband" ? (
            <ColorBandLane
              hues={lane.hueValues ?? []}
              clarity={lane.clarityValues ?? []}
              h={laneHeight}
            />
          ) : (
            <AreaLane
              values={lane.values ?? []}
              color={lane.color ?? "var(--accent)"}
              h={laneHeight}
            />
          )}
        </div>
      ))}
      {hoverPct != null && (
        <div
          aria-hidden
          style={{
            position: "absolute", top: 0, bottom: 0, left: `${hoverPct}%`,
            width: 1, background: "var(--fg-muted)", opacity: 0.55,
            pointerEvents: "none",
          }}
        />
      )}
      {cursorPct != null && (
        <div
          aria-hidden
          style={{
            position: "absolute", top: 0, bottom: 0, left: `${cursorPct}%`,
            width: 1.5, background: "var(--accent)", opacity: 0.85,
            pointerEvents: "none", boxShadow: "0 0 3px var(--accent)",
          }}
        />
      )}
    </div>
  );
}

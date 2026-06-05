/**
 * TimelinePanel — VIZ-5 連續時間軸 lanes
 *
 * 把引擎 timeline_lanes 的四條 per-measure 序列 (織體密度 / 和聲張力 / 調性色彩 /
 * 弦樂把位) 餵進共用的 TimelineStrip (VIZ-4)。一眼看出全曲的織體起伏、張力高點、
 * 轉調 (色帶換色)、與弦樂把位走高的段落; 播放游標掃過對照當下。
 * 弦樂把位 lane 只在編制含弦樂時出現。
 */
import { useEffect, useState } from "react";

import type { TimelineLanesRes } from "../generated/rpc-types";
import { t } from "../utils/i18n";
import { useSessionStore } from "../stores/sessionStore";
import { type TimelineLane, TimelineStrip } from "./TimelineStrip";

export function TimelinePanel(): JSX.Element | null {
  const arrangement = useSessionStore((s) => s.arrangement);
  const playbackMeasure = useSessionStore((s) => s.playbackMeasure);
  const [data, setData] = useState<TimelineLanesRes | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!arrangement) {
      setData(null);
      return;
    }
    void (async () => {
      try {
        const res = await window.scoreArranger.engine.timelineLanes();
        if (!cancelled && res.ok && res.data) setData(res.data);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [arrangement]);

  if (!data || data.measure_count <= 0) return null;

  const lanes: TimelineLane[] = [
    {
      key: "density", kind: "area", label: t("viz.timeline.density"),
      values: data.density, color: "#5fae6b",
    },
    {
      key: "tension", kind: "area", label: t("viz.timeline.tension"),
      values: data.tension, color: "#c9655a",
    },
    {
      key: "tonal", kind: "colorband", label: t("viz.timeline.tonal"),
      hueValues: data.tonal_hue, clarityValues: data.tonal_clarity,
    },
  ];
  if (data.has_strings) {
    lanes.push({
      key: "position", kind: "area", label: t("viz.timeline.position"),
      values: data.position, color: "#5b8fd9",
    });
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const h = hoverIdx;
  // hover 讀出: 該小節的精確值 (area lanes 用百分比, 調性用色塊)
  const readout =
    h != null && h < data.measure_count ? (
      <>
        <span style={{ color: "var(--fg)", fontWeight: 600 }}>
          {t("viz.timeline.measure")} {data.first_measure + h}
        </span>
        <span style={{ color: "#5fae6b" }}>{t("viz.timeline.density")} {pct(data.density[h])}</span>
        <span style={{ color: "#c9655a" }}>{t("viz.timeline.tension")} {pct(data.tension[h])}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          {t("viz.timeline.tonal")}
          <span
            style={{
              width: 9, height: 9, borderRadius: 2,
              background: `hsl(${Math.round(data.tonal_hue[h] * 360)}, ${Math.round(35 + (data.tonal_clarity[h] ?? 0.5) * 45)}%, 52%)`,
            }}
          />
        </span>
        {data.has_strings && (
          <span style={{ color: "#5b8fd9" }}>
            {t("viz.timeline.position")}{" "}
            {data.position[h] == null ? "—" : pct(data.position[h] as number)}
          </span>
        )}
      </>
    ) : null;

  return (
    <div style={{ padding: "8px 4px" }} title={t("viz.timeline.hint")}>
      <div
        style={{
          fontSize: 12, fontWeight: 700, color: "var(--gold, #d9a441)",
          marginBottom: 4, letterSpacing: 0.5,
        }}
      >
        {t("viz.timeline.heading")}
      </div>
      {/* hover 讀出列 — 固定高度避免 hover 進出時版面跳動 */}
      <div
        style={{
          minHeight: 15, marginBottom: 4, fontSize: 10.5,
          color: "var(--fg-muted)", display: "flex", gap: 8,
          flexWrap: "wrap", alignItems: "center",
        }}
      >
        {readout}
      </div>
      <TimelineStrip
        firstMeasure={data.first_measure}
        measureCount={data.measure_count}
        playbackMeasure={playbackMeasure}
        lanes={lanes}
        onHoverMeasure={setHoverIdx}
      />
    </div>
  );
}

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

  return (
    <div style={{ padding: "8px 4px" }} title={t("viz.timeline.hint")}>
      <div
        style={{
          fontSize: 12, fontWeight: 700, color: "var(--gold, #d9a441)",
          marginBottom: 8, letterSpacing: 0.5,
        }}
      >
        {t("viz.timeline.heading")}
      </div>
      <TimelineStrip
        firstMeasure={data.first_measure}
        measureCount={data.measure_count}
        playbackMeasure={playbackMeasure}
        lanes={lanes}
      />
    </div>
  );
}

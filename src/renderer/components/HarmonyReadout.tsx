/**
 * HarmonyReadout — VIZ-3 即時和聲讀出
 *
 * 工具列主播放器旁的小讀出: 待機時顯示偵測到的調性, 播放時隨游標附上當下
 * 和弦的羅馬數字。和聲分析複用引擎既有 analyze_harmony (A1b), 分析 source path
 * (和聲是曲子屬性, 改編保留小節編號 → 播放小節對齊)。
 *
 * 獨立讀 store, 掛一次即可 (不必塞進 3 個 PlaybackControls 實例)。
 */
import { t } from "../utils/i18n";
import { useHarmony } from "../stores/harmonyStore";
import { useSessionStore } from "../stores/sessionStore";

export function HarmonyReadout(): JSX.Element | null {
  const sourcePath = useSessionStore((s) => s.sourcePath);
  const arrangement = useSessionStore((s) => s.arrangement);
  const playbackMeasure = useSessionStore((s) => s.playbackMeasure);

  // 有改編 + 有來源路徑才分析 (避免空狀態抓取)
  const { data } = useHarmony(arrangement && sourcePath ? sourcePath : null);
  if (!data?.detected_key) return null;

  // 當下和弦 = 小節 ≤ 目前播放小節的最後一個 (chords 依 measure/offset 排序)
  const m = playbackMeasure ?? 0;
  let cur: string | null = null;
  if (m > 0) {
    for (const c of data.chords ?? []) {
      if (c.measure <= m) {
        if (c.roman) cur = c.roman;
      } else {
        break;
      }
    }
  }

  return (
    <div
      title={t("viz.harmony.title")}
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 5,
        fontSize: 11,
        color: "var(--fg-muted)",
        marginLeft: 8,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ opacity: 0.7 }}>♬</span>
      <span>{data.detected_key}</span>
      {cur && (
        <span
          style={{
            color: "var(--accent)",
            fontWeight: 700,
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {cur}
        </span>
      )}
    </div>
  );
}

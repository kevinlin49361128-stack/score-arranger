/**
 * TargetPanel — 改編後樂譜面板 (右欄 / 下欄)
 *
 * 包含:
 *   - Panel header: 標題 + compact 播放控制
 *   - ScoreViewer 渲染改編譜 MusicXML; 帶熱圖 / diff / 編輯閃光
 *
 * 點小節 → 呼叫 onMeasureClick (App 接 MeasureEditor 開啟).
 * 拖音符 → 呼叫 onNoteDrag (App 接 transpose IPC).
 *
 * 0.1.28: 從 App.tsx 抽出. 純呈現; click / drag 邏輯保留在 App.
 */

import { useSessionStore } from "../stores/sessionStore";
import { t as tr, useLocale } from "../utils/i18n";
import { PlaybackControls } from "./PlaybackControls";
import { ScoreViewer } from "./ScoreViewer";

interface TargetPanelProps {
  onMeasureClick: (m: number, hint?: { approxPitch?: number }) => void;
  onNoteDrag: (
    measure: number, approxPitch: number, semitones: number,
  ) => void | Promise<void>;
  measureDifficulty?: Map<number, number>;
  diffMeasures?: Set<number>;
}

export function TargetPanel({
  onMeasureClick, onNoteDrag, measureDifficulty, diffMeasures,
}: TargetPanelProps) {
  useLocale();
  const {
    targetMusicXML,
    arrangement,
    highlightedMeasure,
    highlightFlashTick,
    playbackMeasure,
    activePlaybackSide,
    playbackSyncBoth,
    editFlash,
  } = useSessionStore();

  return (
    <div
      style={{
        background: "var(--bg-panel)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          borderBottom: "1px solid var(--border-light)",
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "var(--fg-muted)",
        }}
      >
        <span style={{ fontWeight: 600 }}>
          {tr("app.panel.targetTitle")}
        </span>
        <PlaybackControls side="target" compact />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <ScoreViewer
          label={
            arrangement
              ? tr("app.panel.targetLabel.result", { name: arrangement.name })
              : tr("app.panel.targetLabel.default")
          }
          musicXmlContent={targetMusicXML}
          highlightedMeasure={highlightedMeasure}
          highlightFlashTick={highlightFlashTick}
          // 改編譜自己在播 或 toolbar 同步模式時才顯示游標
          playbackMeasure={
            activePlaybackSide === "target" || playbackSyncBoth
              ? playbackMeasure
              : null
          }
          onMeasureClick={onMeasureClick}
          onNoteDrag={onNoteDrag}
          measureDifficulty={measureDifficulty}
          diffMeasures={diffMeasures}
          editFlash={editFlash}
          isAutoFitReference={!!targetMusicXML}
        />
      </div>
    </div>
  );
}

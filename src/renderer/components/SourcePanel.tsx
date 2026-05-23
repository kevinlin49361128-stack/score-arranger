/**
 * SourcePanel — 原始樂譜面板 (左欄 / 上欄)
 *
 * 包含:
 *   - Panel header: 標題 + compact 播放控制 + 大譜切片翻頁 (m.X-Y / total)
 *   - ScoreViewer 渲染源譜 MusicXML
 *
 * 大譜切片邏輯: 當 sourceSlice 非 null (totalMeasures > pageSize 才會設定),
 * header 顯示前/後翻頁按鈕, 切換時呼叫 engine.toMusicXML 抓對應切片.
 *
 * 0.1.28: 從 App.tsx 抽出 (約 130 行). 純呈現 + 簡單分頁邏輯; 不持有業務狀態.
 */

import { useState } from "react";

import { useSessionStore } from "../stores/sessionStore";
import { t as tr, useLocale } from "../utils/i18n";
import { PlaybackControls } from "./PlaybackControls";
import { ScoreViewer } from "./ScoreViewer";

interface SourcePanelProps {
  sourceLabel: string;
}

export function SourcePanel({ sourceLabel }: SourcePanelProps) {
  useLocale();
  const {
    sourcePath,
    sourceMusicXML,
    targetMusicXML,
    highlightedMeasure,
    highlightFlashTick,
    playbackMeasure,
    activePlaybackSide,
    playbackSyncBoth,
    sourceSlice,
    setSourceSlice,
    setSourceMusicXML,
    setHighlightedMeasure,
  } = useSessionStore();
  const [slicePageLoading, setSlicePageLoading] = useState(false);

  const pageStart = sourceSlice?.startMeasure ?? 1;
  const pageSize = sourceSlice?.pageSize ?? 0;
  const total = sourceSlice?.totalMeasures ?? 0;
  const pageEnd = sourceSlice ? Math.min(pageStart + pageSize - 1, total) : 0;

  const goPage = async (newStart: number) => {
    if (!sourcePath || !sourceSlice) return;
    if (newStart === sourceSlice.startMeasure) return;
    setSlicePageLoading(true);
    try {
      const res = await window.scoreArranger.engine.toMusicXML(
        sourcePath, sourceSlice.pageSize, newStart,
      );
      if (res.ok && res.data) {
        setSourceMusicXML(res.data);
        setSourceSlice({ ...sourceSlice, startMeasure: newStart });
      }
    } finally {
      setSlicePageLoading(false);
    }
  };

  const canPrev = sourceSlice ? pageStart > 1 : false;
  const canNext = sourceSlice ? pageStart + pageSize <= total : false;

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
          {tr("app.panel.sourceTitle")}
        </span>
        <PlaybackControls side="source" compact />
        {sourceSlice && sourcePath && (
          <span style={{
            display: "flex", alignItems: "center", gap: 4,
            marginLeft: "auto", fontSize: 11,
          }}>
            <span style={{ color: "var(--fg-tertiary)" }}>
              m.{pageStart}–{pageEnd} / {total}
            </span>
            <button
              type="button"
              onClick={() => goPage(Math.max(1, pageStart - pageSize))}
              disabled={slicePageLoading || !canPrev}
              style={{
                padding: "1px 6px", fontSize: 11,
                border: "1px solid var(--button-border)",
                background: "var(--button-bg)",
                color: "var(--button-fg)",
                borderRadius: 3, cursor: "pointer",
                opacity: canPrev ? 1 : 0.4,
              }}
            >‹</button>
            <button
              type="button"
              onClick={() => goPage(pageStart + pageSize)}
              disabled={slicePageLoading || !canNext}
              style={{
                padding: "1px 6px", fontSize: 11,
                border: "1px solid var(--button-border)",
                background: "var(--button-bg)",
                color: "var(--button-fg)",
                borderRadius: 3, cursor: "pointer",
                opacity: canNext ? 1 : 0.4,
              }}
            >›</button>
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <ScoreViewer
          label={sourceLabel}
          musicXmlContent={sourceMusicXML}
          highlightedMeasure={highlightedMeasure}
          highlightFlashTick={highlightFlashTick}
          // 游標只在「源譜自己在播」或「toolbar 同步比對模式」時顯示.
          // 改編譜自己的 compact 播放器不會點亮這邊.
          playbackMeasure={
            activePlaybackSide === "source" || playbackSyncBoth
              ? playbackMeasure
              : null
          }
          onMeasureClick={setHighlightedMeasure}
          isAutoFitReference={!targetMusicXML}
        />
      </div>
    </div>
  );
}

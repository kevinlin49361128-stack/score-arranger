/**
 * App — Score Arranger 頂層元件
 *
 * 結構:
 * ┌──────────────────────────────────┐
 * │ Toolbar (匯入/分析/改編/暗色切換) │
 * ├──────────────────────────────────┤
 * │ ModeBar (Setup/Analyze/...)      │
 * ├─────────────────┬────────────────┤
 * │ SourcePanel    │ TargetPanel    │
 * ├─────────────────┴────────────────┤
 * │ Issue Panel / Mode footer        │
 * └──────────────────────────────────┘
 *
 * 0.1.28 拆分 (C1): 原 753 行的 App.tsx 拆出四個獨立元件:
 *   - PanelResizer        — 拖曳分隔列
 *   - SourcePanel         — 原始樂譜面板 + 大譜切片翻頁
 *   - TargetPanel         — 改編樂譜面板
 *   - usePersistentSize   — localStorage 持久 size hook
 * App.tsx 現在只負責: 全局 layout / mode-based 路由 / 跨面板互動
 * (onMeasureClick → MeasureEditor, onNoteDrag → transpose IPC).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import "./types.d";
import { AnalyzePanel } from "./components/AnalyzePanel";
import { ExportPanel } from "./components/ExportPanel";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { IssuePanel } from "./components/IssuePanel";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { MeasureEditor } from "./components/MeasureEditor";
import { ModeBar } from "./components/ModeBar";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { PanelResizer } from "./components/PanelResizer";
import { SectionNavigator } from "./components/SectionNavigator";
import { SetupHint } from "./components/SetupHint";
import { SourcePanel } from "./components/SourcePanel";
import { TabStrip } from "./components/TabStrip";
import { TargetPanel } from "./components/TargetPanel";
import { Toolbar } from "./components/Toolbar";
import { TranscribePanel } from "./components/TranscribePanel";
import { VariantBar } from "./components/VariantBar";
import { usePersistentSize } from "./hooks/usePersistentSize";
import { useSessionStore } from "./stores/sessionStore";
import { t as tr, useLocale } from "./utils/i18n";
import { diffMeasures } from "./utils/measureDiff";

export default function App() {
  useLocale();
  const {
    error,
    sourcePath,
    targetMusicXML,
    mode,
    panelLayout,
    infoPanelPos,
    showHeatmap,
  } = useSessionStore();

  // 載入 per-measure difficulty (僅在 showHeatmap 開啟時)
  const [difficultyData, setDifficultyData] = useState<
    Record<string, DifficultyEntry>
  >({});
  useEffect(() => {
    if (!showHeatmap || !targetMusicXML) {
      setDifficultyData({});
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await window.scoreArranger.engine.computeDifficulty();
        if (res.ok && res.data) setDifficultyData(res.data);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [showHeatmap, targetMusicXML]);

  // 合併所有 parts: 同一 measure 的最大值, 作為熱圖整體分數
  const measureDifficulty = useMemo(() => {
    if (!showHeatmap) return undefined;
    const map = new Map<number, number>();
    for (const part of Object.values(difficultyData)) {
      for (const m of part.measures ?? []) {
        const prev = map.get(m.measure) ?? 0;
        if (m.score > prev) map.set(m.measure, m.score);
      }
    }
    return map.size > 0 ? map : undefined;
  }, [showHeatmap, difficultyData]);

  // === Onboarding wizard 觸發 ===
  const [showWizard, setShowWizard] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return !localStorage.getItem("score-arranger.onboarded");
  });
  const setSourcePath = useSessionStore((s) => s.setSourcePath);
  const setSourceMusicXML = useSessionStore((s) => s.setSourceMusicXML);
  const setArrangement = useSessionStore((s) => s.setArrangement);
  const setArrangementIssues = useSessionStore((s) => s.setArrangementIssues);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);
  const setMode = useSessionStore((s) => s.setMode);
  const setHistoryFlags = useSessionStore((s) => s.setHistoryFlags);
  const newTab = useSessionStore((s) => s.newTab);
  const snapshotToTab = useSessionStore((s) => s.snapshotToTab);

  const runOnboarding = async (config: {
    corpusPath: string;
    ensemble: string;
    skillLevel: "amateur" | "intermediate" | "professional";
  }) => {
    try {
      if (!useSessionStore.getState().activeTabId) newTab();
      setSourcePath(config.corpusPath);
      setError(null);
      setMode("setup");
      setLoading(true, tr("app.loading.loadSampleScore"));
      const xmlRes = await window.scoreArranger.engine.toMusicXML(
        config.corpusPath,
      );
      if (!xmlRes.ok || !xmlRes.data) {
        setError(xmlRes.error ?? tr("app.error.loadSampleFailed"));
        return;
      }
      setSourceMusicXML(xmlRes.data);
      snapshotToTab();
      setLoading(true, tr("app.loading.arranging"));
      const arrRes = await window.scoreArranger.engine.arrange(
        config.corpusPath, config.ensemble, false, config.skillLevel, "none",
      );
      if (arrRes.ok && arrRes.data) {
        setArrangement(arrRes.data);
        useSessionStore.getState().setTargetMusicXML(
          arrRes.data.target_musicxml ?? null,
        );
        setArrangementIssues(arrRes.data.issues ?? []);
        setHistoryFlags(false, false);
        setMode("arrange");
        snapshotToTab();
        setShowWizard(false);
      } else {
        setError(arrRes.error ?? tr("app.error.arrangeFailed"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // 監聽外部編輯器存檔 → 自動更新 target 譜面
  const setTargetMusicXML = useSessionStore((s) => s.setTargetMusicXML);
  useEffect(() => {
    const subscribe = window.scoreArranger?.onExternalEditorChanged;
    if (typeof subscribe !== "function") return;
    const unsubscribe = subscribe(({ musicxml }) => {
      setTargetMusicXML(musicxml);
    });
    return () => unsubscribe?.();
  }, [setTargetMusicXML]);

  // A/B Diff: 找出 compareVariant 跟目前 target 不同的小節
  const compareVariantIndex = useSessionStore((s) => s.compareVariantIndex);
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const diffSet = useMemo(() => {
    if (compareVariantIndex == null || !targetMusicXML) return undefined;
    const tab = tabs.find((t) => t.id === activeTabId);
    const variant = tab?.variants?.[compareVariantIndex];
    if (!variant) return undefined;
    return diffMeasures(targetMusicXML, variant.targetMusicXML);
  }, [compareVariantIndex, targetMusicXML, tabs, activeTabId]);
  const setHighlightedMeasure = useSessionStore(
    (s) => s.setHighlightedMeasure,
  );

  // target 譜面點選 → 同時打開 MeasureEditor
  const [editorMeasure, setEditorMeasure] = useState<number | null>(null);
  const [pitchHint, setPitchHint] = useState<number | null>(null);
  const handleTargetClick = (m: number, hint?: { approxPitch?: number }) => {
    setHighlightedMeasure(m);
    setEditorMeasure(m);
    setPitchHint(hint?.approxPitch ?? null);
  };

  /** 譜面拖音符 → 找最接近的事件並 transpose */
  const handleNoteDrag = async (
    measure: number,
    approxPitch: number,
    semitones: number,
  ) => {
    setLoading(true, tr("app.loading.transpose", {
      semitones: `${semitones > 0 ? "+" : ""}${semitones}`,
    }));
    try {
      const evRes = await window.scoreArranger.engine.listMeasureEvents(
        measure,
      );
      if (!evRes.ok || !evRes.data) return;
      // 找最接近 approxPitch 的事件
      let best: typeof evRes.data.events[0] | null = null;
      let bestDist = Infinity;
      for (const e of evRes.data.events) {
        let pitch: number | null = null;
        if (e.kind === "note" && e.midi != null) pitch = e.midi;
        else if (e.kind === "chord" && e.midis && e.midis.length > 0) {
          pitch = e.midis.reduce(
            (b, x) =>
              Math.abs(x - approxPitch) < Math.abs(b - approxPitch) ? x : b,
          );
        }
        if (pitch == null) continue;
        const d = Math.abs(pitch - approxPitch);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      if (!best) return;
      const res = await window.scoreArranger.engine.editEvent(
        best.part_id, measure, best.voice_id, best.event_index,
        "transpose", { semitones },
      );
      if (res.ok && res.data) {
        if (res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        setError(null);
      } else {
        setError(res.error ?? tr("app.error.dragTransposeFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  // 各 mode 對應的下方面板
  const renderFooterPanel = () => {
    switch (mode) {
      case "setup":
        return <SetupHint />;
      case "analyze":
        return <AnalyzePanel />;
      case "transcribe":
        return <TranscribePanel />;
      case "export":
        return <ExportPanel />;
      default:
        return (
          <div style={{ display: "flex", flexDirection: "column",
                        height: "100%", overflow: "auto" }}>
            {/* 0.1.32 老師評語層 — 改編完成後出現在 IssuePanel 上方 */}
            <ExplanationPanel />
            <div style={{ flex: 1, minHeight: 0 }}>
              <IssuePanel />
            </div>
          </div>
        );
    }
  };

  // refine mode 把問題面板拉大;export mode 不顯示樂譜面板 (聚焦匯出)
  const modeDefaultFooter =
    mode === "refine" ? 400 :
    mode === "transcribe" ? 360 :
    mode === "analyze" ? 320 :
    mode === "setup" && !sourcePath ? 0 :
    240;
  // 使用者拖曳設定的尺寸 — 兩個都走泛用 hook
  const footerSize = usePersistentSize("score-arranger.footer-h");
  const sideSize = usePersistentSize("score-arranger.side-w");
  const footerHeight = mode === "setup" && !sourcePath
    ? 0
    : (footerSize.value ?? modeDefaultFooter);
  const sideWidth = sideSize.value ?? 360;
  // footer DOM 參照 — 拖曳時直接改 height, 避免每次 mousemove 都 re-render
  const footerRef = useRef<HTMLElement>(null);

  const showScorePanels = mode !== "export";
  // export mode 用全螢幕 footer 顯示 ExportPanel; 其他 mode 依 footerHeight
  const showFooter = mode === "export" || footerHeight > 0;
  // 資訊欄放右側 (side) vs 下方 (bottom)
  const useSideLayout = infoPanelPos === "side" && showScorePanels
    && showFooter;

  const sourceLabel = sourcePath
    ? sourcePath.startsWith("corpus:")
      ? tr("app.panel.sourceLabel.corpus", {
        name: sourcePath.slice("corpus:".length),
      })
      : tr("app.panel.sourceLabel.file", {
        name: sourcePath.split("/").pop(),
      })
    : tr("app.panel.sourceLabel.default");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg-base)",
        color: "var(--fg-primary)",
      }}
    >
      <Toolbar />
      <TabStrip />
      {showWizard && !sourcePath && (
        <OnboardingWizard
          onSkip={() => {
            localStorage.setItem("score-arranger.onboarded", "1");
            setShowWizard(false);
          }}
          onComplete={runOnboarding}
        />
      )}
      <ModeBar />
      <SectionNavigator />
      <VariantBar />

      {error && (
        <div
          style={{
            padding: "8px 12px",
            background: "var(--error-bg)",
            color: "var(--error-fg)",
            fontSize: 13,
            borderBottom: "1px solid var(--error-border)",
          }}
        >
          ⚠ {error}
        </div>
      )}

      <LoadingOverlay />

      {/* 譜面區 + 資訊欄 — flexDirection 依 infoPanelPos 在欄/列間切換 */}
      <div
        style={{
          display: "flex",
          flexDirection: useSideLayout ? "row" : "column",
          flex: 1,
          minHeight: 0,
          minWidth: 0,
        }}
      >
        {showScorePanels && (
          <main
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: panelLayout === "horizontal"
                ? "1fr 1fr" : "1fr",
              gridTemplateRows: panelLayout === "vertical"
                ? "1fr 1fr" : "1fr",
              gap: 1,
              background: "var(--bg-divider)",
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <SourcePanel sourceLabel={sourceLabel} />
            <TargetPanel
              onMeasureClick={handleTargetClick}
              onNoteDrag={handleNoteDrag}
              measureDifficulty={measureDifficulty}
              diffMeasures={diffSet}
            />
          </main>
        )}

        {showFooter && showScorePanels && (
          <PanelResizer
            orientation={useSideLayout ? "vertical" : "horizontal"}
            currentSize={useSideLayout ? sideWidth : footerHeight}
            panelRef={footerRef}
            onCommit={(size) => {
              if (useSideLayout) sideSize.set(size);
              else footerSize.set(size);
            }}
            onReset={() => {
              if (useSideLayout) sideSize.reset();
              else footerSize.reset();
            }}
          />
        )}
        {showFooter && (
          <footer
            ref={footerRef}
            style={useSideLayout
              ? {
                // 側邊欄: 固定寬度, 不縮放
                width: sideWidth,
                flexGrow: 0,
                flexShrink: 0,
                background: "var(--bg-panel)",
                overflow: "hidden",
              }
              : {
                // 下方欄: 一般 mode 固定高度; export mode 撐滿
                // 一律用 flexGrow/Shrink/Basis longhand, 不混 flex 簡寫
                // (避免 React「mixing shorthand」rerender 警告)
                height: showScorePanels ? footerHeight : undefined,
                flexGrow: showScorePanels ? 0 : 1,
                flexShrink: showScorePanels ? 0 : 1,
                flexBasis: showScorePanels ? "auto" : 0,
                background: "var(--bg-panel)",
                overflow: "hidden",
              }}
          >
            {renderFooterPanel()}
          </footer>
        )}
      </div>

      <MeasureEditor
        measure={editorMeasure}
        pitchHint={pitchHint ?? undefined}
        onClose={() => {
          setEditorMeasure(null);
          setPitchHint(null);
        }}
      />
    </div>
  );
}

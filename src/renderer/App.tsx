/**
 * App — Score Arranger 頂層元件
 *
 * 結構參照 UX 提案 §2.2.C 雙欄譜面板 + 問題面板:
 * ┌──────────────────────────────────┐
 * │ Toolbar (匯入/分析/改編/暗色切換) │
 * ├──────────────────────────────────┤
 * │ ModeBar (Setup/Analyze/...)      │
 * ├─────────────────┬────────────────┤
 * │ 原始樂譜面板   │ 目標樂譜面板   │
 * │ (ScoreViewer)  │ (ScoreViewer)  │
 * ├─────────────────┴────────────────┤
 * │ Issue Panel                       │
 * └──────────────────────────────────┘
 */

import { useEffect, useMemo, useRef, useState } from "react";
import "./types.d";
import { AnalyzePanel } from "./components/AnalyzePanel";
import { ExportPanel } from "./components/ExportPanel";
import { IssuePanel } from "./components/IssuePanel";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { MeasureEditor } from "./components/MeasureEditor";
import { ModeBar } from "./components/ModeBar";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { PlaybackControls } from "./components/PlaybackControls";
import { ScoreViewer } from "./components/ScoreViewer";
import { SectionNavigator } from "./components/SectionNavigator";
import { SetupHint } from "./components/SetupHint";
import { TranscribePanel } from "./components/TranscribePanel";
import { TabStrip } from "./components/TabStrip";
import { Toolbar } from "./components/Toolbar";
import { VariantBar } from "./components/VariantBar";
import { useScrollSync } from "./hooks/useScrollSync";
import { useSessionStore } from "./stores/sessionStore";
import { t as tr, useLocale } from "./utils/i18n";
import { diffMeasures } from "./utils/measureDiff";

export default function App() {
  useLocale();
  const {
    error,
    sourcePath,
    sourceMusicXML,
    targetMusicXML,
    arrangement,
    highlightedMeasure,
    highlightFlashTick,
    playbackMeasure,
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
  // 條件: localStorage 沒 onboarded 旗標, 且目前沒任何來源樂譜載入
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
  const { sourceRef, targetRef } = useScrollSync();
  // target 譜面點選 → 同時打開 MeasureEditor
  const [editorMeasure, setEditorMeasure] = useState<number | null>(null);
  const [pitchHint, setPitchHint] = useState<number | null>(null);
  const handleTargetClick = (m: number, hint?: { approxPitch?: number }) => {
    setHighlightedMeasure(m);
    setEditorMeasure(m);
    setPitchHint(hint?.approxPitch ?? null);
  };

  /** 譜面拖音符 → 找最接近的事件並 transpose */
  const setTargetMusicXMLLocal = useSessionStore((s) => s.setTargetMusicXML);
  const setLoadingState = useSessionStore((s) => s.setLoading);
  const setErrorState = useSessionStore((s) => s.setError);
  const handleNoteDrag = async (
    measure: number,
    approxPitch: number,
    semitones: number,
  ) => {
    setLoadingState(true, tr("app.loading.transpose", {
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
          setTargetMusicXMLLocal(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        setErrorState(null);
      } else {
        setErrorState(res.error ?? tr("app.error.dragTransposeFailed"));
      }
    } finally {
      setLoadingState(false);
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
        return <IssuePanel />;
    }
  };

  // refine mode 把問題面板拉大;export mode 不顯示樂譜面板 (聚焦匯出)
  const modeDefaultFooter =
    mode === "refine" ? 400 :
    mode === "transcribe" ? 360 :
    mode === "analyze" ? 320 :
    mode === "setup" && !sourcePath ? 0 :
    240;
  // 使用者拖曳設定的 footer 高度 (override mode default)
  const [userFooterHeight, setUserFooterHeight] = useState<number | null>(() => {
    try {
      const raw = window.localStorage?.getItem("score-arranger.footer-h");
      if (raw) {
        const v = parseInt(raw, 10);
        if (Number.isFinite(v) && v > 0) return v;
      }
    } catch { /* ignore */ }
    return null;
  });
  const footerHeight = mode === "setup" && !sourcePath
    ? 0
    : (userFooterHeight ?? modeDefaultFooter);
  // footer DOM 參照 — 拖曳時直接改 height, 避免每次 mousemove 都 re-render 整個 App
  const footerRef = useRef<HTMLElement>(null);

  const persistFooterHeight = (h: number | null) => {
    try {
      if (h == null) {
        window.localStorage?.removeItem("score-arranger.footer-h");
      } else {
        window.localStorage?.setItem("score-arranger.footer-h", String(h));
      }
    } catch { /* ignore */ }
  };

  // 側邊欄寬度 (infoPanelPos === "side" 時用)
  const [userSideWidth, setUserSideWidth] = useState<number | null>(() => {
    try {
      const raw = window.localStorage?.getItem("score-arranger.side-w");
      if (raw) {
        const v = parseInt(raw, 10);
        if (Number.isFinite(v) && v > 0) return v;
      }
    } catch { /* ignore */ }
    return null;
  });
  const sideWidth = userSideWidth ?? 360;
  const persistSideWidth = (w: number | null) => {
    try {
      if (w == null) {
        window.localStorage?.removeItem("score-arranger.side-w");
      } else {
        window.localStorage?.setItem("score-arranger.side-w", String(w));
      }
    } catch { /* ignore */ }
  };

  const showScorePanels = mode !== "export";
  // export mode 用全螢幕 footer 顯示 ExportPanel; 其他 mode 依 footerHeight
  const showFooter = mode === "export" || footerHeight > 0;
  // 資訊欄放右側 (side) vs 下方 (bottom)。
  // showScorePanels 已等於 mode !== "export", 故 export mode 自動排除。
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
              ? "1fr 1fr"
              : "1fr",
            gridTemplateRows: panelLayout === "vertical"
              ? "1fr 1fr"
              : "1fr",
            gap: 1,
            background: "var(--bg-divider)",
            minHeight: 0,
            minWidth: 0,
          }}
        >
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
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <ScoreViewer
                ref={sourceRef}
                label={sourceLabel}
                musicXmlContent={sourceMusicXML}
                highlightedMeasure={highlightedMeasure}
                highlightFlashTick={highlightFlashTick}
                playbackMeasure={playbackMeasure}
                onMeasureClick={setHighlightedMeasure}
                isAutoFitReference={!targetMusicXML}
              />
            </div>
          </div>
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
                ref={targetRef}
                label={
                  arrangement
                    ? tr("app.panel.targetLabel.result", {
                      name: arrangement.name,
                    })
                    : tr("app.panel.targetLabel.default")
                }
                musicXmlContent={targetMusicXML}
                highlightedMeasure={highlightedMeasure}
                highlightFlashTick={highlightFlashTick}
                playbackMeasure={playbackMeasure}
                onMeasureClick={handleTargetClick}
                onNoteDrag={handleNoteDrag}
                measureDifficulty={measureDifficulty}
                diffMeasures={diffSet}
                isAutoFitReference={!!targetMusicXML}
              />
            </div>
          </div>
        </main>
      )}

      {showFooter && showScorePanels && (
        <PanelResizer
          orientation={useSideLayout ? "vertical" : "horizontal"}
          currentSize={useSideLayout ? sideWidth : footerHeight}
          panelRef={footerRef}
          onCommit={(size) => {
            if (useSideLayout) {
              setUserSideWidth(size);
              persistSideWidth(size);
            } else {
              setUserFooterHeight(size);
              persistFooterHeight(size);
            }
          }}
          onReset={() => {
            if (useSideLayout) {
              setUserSideWidth(null);
              persistSideWidth(null);
            } else {
              setUserFooterHeight(null);
              persistFooterHeight(null);
            }
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


/**
 * PanelResizer — 樂譜區與資訊欄之間的拖曳分隔列
 *
 * - orientation="horizontal": 水平分隔列, 上下拖 → 調整下方面板高度
 * - orientation="vertical":   垂直分隔列, 左右拖 → 調整右側面板寬度
 * - 雙擊重置為預設值; hover 時 highlight
 *
 * 效能: 拖曳過程「不」走 React state — 直接改面板 DOM 的 height/width,
 * 由 flexbox 自動讓樂譜區縮放; 只在放開滑鼠時 commit 一次 setState。
 * 否則每個 mousemove 都 re-render 整個 App + OSMD 重排, 會非常卡。
 */
function PanelResizer(
  { orientation, currentSize, panelRef, onCommit, onReset }: {
    orientation: "horizontal" | "vertical";
    currentSize: number;
    panelRef: React.RefObject<HTMLElement>;
    onCommit: (size: number) => void;
    onReset: () => void;
  },
) {
  useLocale();
  // horizontal 分隔列 → 拖 Y 改 height; vertical → 拖 X 改 width
  const isH = orientation === "horizontal";
  const MIN = isH ? 60 : 220;
  const MAX = isH ? 700 : 900;
  const dragRef = useRef<
    { start: number; startSize: number; live: number } | null
  >(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (isH ? e.clientY : e.clientX) - dragRef.current.start;
      // 面板在下方/右方 → 往該方向拖會變小 → startSize - delta
      const next = Math.max(
        MIN,
        Math.min(MAX, dragRef.current.startSize - delta),
      );
      dragRef.current.live = next;
      // 直接改 DOM — 不觸發 React re-render, 樂譜區靠 flexbox 自動縮放
      if (panelRef.current) {
        if (isH) panelRef.current.style.height = `${next}px`;
        else panelRef.current.style.width = `${next}px`;
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        // 放開才 commit 一次 → 只此時 re-render + OSMD autofit
        onCommit(dragRef.current.live);
        dragRef.current = null;
        document.body.style.cursor = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onCommit, panelRef, isH, MIN, MAX]);

  return (
    <div
      onMouseDown={(e) => {
        dragRef.current = {
          start: isH ? e.clientY : e.clientX,
          startSize: currentSize,
          live: currentSize,
        };
        document.body.style.cursor = isH ? "ns-resize" : "ew-resize";
        e.preventDefault();
      }}
      onDoubleClick={onReset}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={isH
        ? tr("app.resizer.footer")
        : tr("app.resizer.side")}
      style={{
        ...(isH ? { height: 6 } : { width: 6, alignSelf: "stretch" }),
        background: hover ? "var(--accent)" : "var(--border)",
        cursor: isH ? "ns-resize" : "ew-resize",
        flexShrink: 0,
        transition: "background 0.15s ease",
        position: "relative",
      }}
    >
      {/* 加寬 hit area 至 ±4px (視覺只 6px) */}
      <div
        style={{
          position: "absolute",
          ...(isH
            ? { top: -4, bottom: -4, left: 0, right: 0 }
            : { left: -4, right: -4, top: 0, bottom: 0 }),
        }}
      />
    </div>
  );
}

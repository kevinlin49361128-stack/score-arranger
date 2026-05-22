/**
 * Toolbar — 頂部工具列
 *
 * 視覺分組 (左→右):
 *   1. 檔案: 匯入 | 範例 ▾ | 📂 | 💾
 *   2. 動作: 分析 | [改編 | 編制 ▾ | ⚙改編選項] | 🤖改譜
 *   3. 歷史: ↶ ↷
 *   4. 播放 + Loop
 *   5. (flex)  → 顯示檔名
 *   6. 縮放: − % +          (可收合)
 *   7. 檢視: 🔥 ▥ ◧         (可收合)
 *   8. 匯出 ▾               (可收合)
 *   9. ⋯ 溢出選單           (僅在有群組被收合時出現)
 *  10. ⚙ 設定 (主題/語言/AI 模型)
 *
 * 設計準則:
 * - 同類群組間以細直線分隔
 * - 改編參數 (自動修復 / 技術水平 / 風格) 收進改編按鈕旁的 ⚙ popover
 * - 響應式: 視窗過窄時依優先序 (檢視 → 縮放 → 匯出) 自動收進 ⋯ 選單,
 *   靠 ResizeObserver 量測 header.scrollWidth vs 視窗寬決定 collapseLevel
 * - 次要功能 (語言/主題/AI 設定) 收進 ⚙ overflow menu
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AboutDialog } from "./AboutDialog";
import { CustomEnsembleDialog, type CustomPlayer } from "./CustomEnsembleDialog";
import { ExportMenu } from "./ExportMenu";
import { LLMSettingsDialog } from "./LLMSettingsDialog";
import { DifficultyBoostDialog } from "./DifficultyBoostDialog";
import { NLEditDialog } from "./NLEditDialog";
import { PracticePanel } from "./PracticePanel";
import { OMRInstallDialog } from "./OMRInstallDialog";
import { PdfImportWarningDialog } from "./PdfImportWarningDialog";
import { PlaybackControls } from "./PlaybackControls";
import { PresetLibrary } from "./PresetLibrary";
import { ZoomControls } from "./ZoomControls";
import { useSessionStore } from "../stores/sessionStore";
import {
  getLocale,
  onLocaleChange,
  setLocale,
  t as tr,
} from "../utils/i18n";
import {
  getStrategyPreference,
  recordUndoIfRecent,
} from "../utils/preferences";

// 編制 → i18n key (label 於 render 時用 tr() 查, locale 切換才會更新)
const ENSEMBLE_LABEL_KEYS: Record<string, string> = {
  violin_piano: "toolbar.ensemble.violinPiano",
  string_quartet: "toolbar.ensemble.stringQuartet",
  piano_solo: "toolbar.ensemble.pianoSolo",
  harpsichord_solo: "toolbar.ensemble.harpsichordSolo",
  violin_harpsichord: "toolbar.ensemble.violinHarpsichord",
  baroque_trio_sonata: "toolbar.ensemble.baroqueTrioSonata",
  woodwind_quintet: "toolbar.ensemble.woodwindQuintet",
  brass_quintet: "toolbar.ensemble.brassQuintet",
  guitar_solo: "toolbar.ensemble.guitarSolo",
  lute_solo: "toolbar.ensemble.luteSolo",
  harp_solo: "toolbar.ensemble.harpSolo",
  flute_guitar: "toolbar.ensemble.fluteGuitar",
};

function Sep() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: "stretch",
        background: "var(--border-light)",
        margin: "2px 4px",
      }}
    />
  );
}

export function Toolbar() {
  const {
    sourcePath,
    setSourcePath,
    setSourceMusicXML,
    setTargetMusicXML,
    setAnalysis,
    arrangement,
    setArrangement,
    setArrangementIssues,
    setLoading,
    setError,
    setStyleAddendum,
    isLoading,
    setMode,
    theme,
    toggleTheme,
    canUndo,
    canRedo,
    setHistoryFlags,
    snapshotToTab,
    tabs,
    activeTabId,
    newTab,
    panelLayout,
    togglePanelLayout,
    infoPanelPos,
    toggleInfoPanelPos,
    showHeatmap,
    toggleHeatmap,
  } = useSessionStore();
  const [enableRepair, setEnableRepair] = useState(true);
  const [locale, setLocaleState] = useState(getLocale());
  useEffect(() => onLocaleChange(setLocaleState), []);
  const [targetEnsemble, setTargetEnsemble] = useState<
    | "violin_piano"
    | "string_quartet"
    | "piano_solo"
    | "harpsichord_solo"
    | "violin_harpsichord"
    | "baroque_trio_sonata"
    | "woodwind_quintet"
    | "brass_quintet"
    | "guitar_solo"
    | "lute_solo"
    | "harp_solo"
    | "flute_guitar"
    | "__custom__"
  >("violin_piano");
  const [customEnsembleOpen, setCustomEnsembleOpen] = useState(false);
  const [customPlayers, setCustomPlayers] = useState<CustomPlayer[] | null>(null);
  const [skillLevel, setSkillLevel] = useState<
    "amateur" | "intermediate" | "professional"
  >("professional");
  const [stylePreset, setStylePreset] = useState<string>("none");
  const [stylePresets, setStylePresets] = useState<
    { id: string; display_name: string; description: string;
      llm_addendum: string }[]
  >([]);
  useEffect(() => {
    let alive = true;
    const api = window.scoreArranger?.engine?.listStylePresets;
    if (typeof api !== "function") return;
    api()
      .then((res) => {
        if (alive && res.ok && res.data) setStylePresets(res.data);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  // 當前風格的 LLM 提示 → 推進 store, 供 AI 建議 / 自然語言改譜帶風格脈絡
  useEffect(() => {
    const active = stylePresets.find((p) => p.id === stylePreset);
    setStyleAddendum(active?.llm_addendum ?? "");
  }, [stylePreset, stylePresets, setStyleAddendum]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [llmSettingsOpen, setLlmSettingsOpen] = useState(false);
  const [nlEditOpen, setNlEditOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  // 改編選項 popover (自動修復 / 技術水平 / 風格)
  const [arrangeOptsOpen, setArrangeOptsOpen] = useState(false);
  const arrangeOptsRef = useRef<HTMLDivElement>(null);
  // 響應式收合: 0=全顯示, 1=收起檢視, 2=+縮放, 3=+匯出
  const [collapseLevel, setCollapseLevel] = useState(0);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const filenameRef = useRef<HTMLSpanElement>(null);
  const zoomGroupRef = useRef<HTMLDivElement>(null);
  const viewGroupRef = useRef<HTMLDivElement>(null);
  const exportGroupRef = useRef<HTMLDivElement>(null);
  // 各可收合群組「展開時」的量測寬度 — 收起後沿用最後一次量測值
  const groupWidthsRef = useRef({ view: 130, zoom: 185, export: 96 });
  const [omrDialog, setOmrDialog] = useState<{
    missing: string[];
    hints: Record<string, string>;
    pendingPdfPath: string;
  } | null>(null);
  const [omrProgress, setOmrProgress] = useState<{
    elapsedSec: number;
  } | null>(null);
  // PDF 匯入前的「預防針」提醒 — 確認後才進 OMR 流程
  const [pdfWarning, setPdfWarning] = useState<{
    pendingPdfPath: string;
  } | null>(null);

  // 點 popover 外部 → 關閉 (設定 / 改編選項 / 溢出選單)
  useEffect(() => {
    if (!settingsOpen && !arrangeOptsOpen && !overflowOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        settingsOpen && settingsRef.current
        && !settingsRef.current.contains(t)
      ) setSettingsOpen(false);
      if (
        arrangeOptsOpen && arrangeOptsRef.current
        && !arrangeOptsRef.current.contains(t)
      ) setArrangeOptsOpen(false);
      if (
        overflowOpen && overflowRef.current
        && !overflowRef.current.contains(t)
      ) setOverflowOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [settingsOpen, arrangeOptsOpen, overflowOpen]);

  // 響應式工具列: 偵測 overflow → 把次要群組收進「⋯」選單。
  // overflow = 內容所需寬度超過視窗; 回復條件帶 20px 遲滯避免抖動。
  const evaluateOverflow = useCallback(() => {
    const header = headerRef.current;
    const filename = filenameRef.current;
    if (!header || !filename) return;
    // 量測目前可見群組寬度 (收起的群組沿用上次值)
    if (viewGroupRef.current) {
      groupWidthsRef.current.view = viewGroupRef.current.offsetWidth;
    }
    if (zoomGroupRef.current) {
      groupWidthsRef.current.zoom = zoomGroupRef.current.offsetWidth;
    }
    if (exportGroupRef.current) {
      groupWidthsRef.current.export = exportGroupRef.current.offsetWidth;
    }
    const overflow = header.scrollWidth - window.innerWidth;
    setCollapseLevel((lvl) => {
      if (overflow > 1 && lvl < 3) return lvl + 1;
      if (lvl > 0) {
        const w = groupWidthsRef.current;
        const need = lvl === 1 ? w.view : lvl === 2 ? w.zoom : w.export;
        if (filename.offsetWidth > need + 20) return lvl - 1;
      }
      return lvl;
    });
  }, []);

  useLayoutEffect(() => {
    evaluateOverflow();
    const ro = new ResizeObserver(evaluateOverflow);
    if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener("resize", evaluateOverflow);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", evaluateOverflow);
    };
  }, [evaluateOverflow]);

  // collapseLevel / 語言變動後再評估一次 → 收斂到穩定狀態
  useLayoutEffect(() => {
    evaluateOverflow();
  }, [collapseLevel, locale, evaluateOverflow]);

  // 鍵盤快捷鍵: Cmd+Z / Cmd+Shift+Z / Cmd+S / Cmd+\
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key === "z" && !e.shiftKey && canUndo) {
        e.preventDefault();
        await doUndo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        if (canRedo) {
          e.preventDefault();
          await doRedo();
        }
      } else if (e.key === "s" && !e.shiftKey && sourcePath) {
        e.preventDefault();
        await handleSaveProject();
      } else if (e.key === "\\") {
        e.preventDefault();
        togglePanelLayout();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUndo, canRedo, sourcePath]);

  const doUndo = async () => {
    setLoading(true, tr("toolbar.loading.undo"));
    recordUndoIfRecent();
    try {
      const res = await window.scoreArranger.engine.undo();
      if (res.ok && res.data) {
        if (res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        setError(null);
      } else {
        setError(res.error ?? tr("toolbar.error.undo"));
      }
    } finally {
      setLoading(false);
    }
  };

  const doRedo = async () => {
    setLoading(true, tr("toolbar.loading.redo"));
    try {
      const res = await window.scoreArranger.engine.redo();
      if (res.ok && res.data) {
        if (res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        setError(null);
      } else {
        setError(res.error ?? tr("toolbar.error.redo"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProject = async () => {
    if (!sourcePath) {
      setError(tr("toolbar.error.nothingToSave"));
      return;
    }
    const path = await window.scoreArranger.saveProjectDialog();
    if (!path) return;
    setLoading(true, tr("toolbar.loading.saveProject"));
    try {
      const res = await window.scoreArranger.engine.saveProject(
        path,
        sourcePath,
      );
      if (!res.ok) {
        setError(res.error ?? tr("toolbar.error.saveFailed"));
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = async () => {
    const path = await window.scoreArranger.openProjectDialog();
    if (!path) return;
    setLoading(true, tr("toolbar.loading.loadProject"));
    try {
      const res = await window.scoreArranger.engine.loadProject(path);
      if (res.ok && res.data) {
        setError(null);
        setSourcePath(res.data.source_path);
        if (res.data.source_path) {
          const xmlRes = await window.scoreArranger.engine.toMusicXML(
            res.data.source_path,
          );
          if (xmlRes.ok && xmlRes.data) {
            setSourceMusicXML(xmlRes.data);
          }
        }
        setTargetMusicXML(res.data.target_musicxml);
        setArrangementIssues(res.data.issues);
        setArrangement({
          arrangement_id: res.data.arrangement.arrangement_id,
          name: res.data.arrangement.name,
          source_id: res.data.arrangement.source_id,
          players: res.data.arrangement.players,
          assignments: res.data.arrangement.assignments,
          target_musicxml: res.data.target_musicxml,
        });
        setHistoryFlags(false, false);
        setMode("arrange");
      } else {
        setError(res.error ?? tr("toolbar.error.loadProjectFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  /** 跑 Audiveris OMR + 顯示經過秒數. 回傳 musicxml 路徑或 null (失敗時已 setError). */
  const runOMR = async (pdfPath: string): Promise<string | null> => {
    const startedAt = Date.now();
    setLoading(true, tr("toolbar.loading.omrRunning"));
    const timer = setInterval(() => {
      setOmrProgress({ elapsedSec: Math.round((Date.now() - startedAt) / 1000) });
    }, 1000);
    try {
      const omrRes = await window.scoreArranger.engine.pdfToMusicXML(pdfPath);
      if (!omrRes.ok || !omrRes.data) {
        setError(omrRes.error ?? tr("toolbar.error.omrFailed"));
        return null;
      }
      return omrRes.data.musicxml_path;
    } finally {
      clearInterval(timer);
      setOmrProgress(null);
    }
  };

  /** 實際執行匯入 — path 已確定 (PDF 已先過預防針提醒)。 */
  const runImport = async (path: string) => {
    try {
      setError(null);
      setMode("setup");
      if (!activeTabId && tabs.length === 0) {
        newTab();
      }

      // PDF: 先檢查 Audiveris, 沒裝就跳安裝指引 modal
      let scorePath: string = path;
      const lower = path.toLowerCase();
      if (lower.endsWith(".pdf")) {
        setLoading(true, tr("toolbar.loading.omrCheck"));
        const statusRes = await window.scoreArranger.engine.omrStatus();
        if (!statusRes.ok || !statusRes.data?.available) {
          setLoading(false);
          setOmrDialog({
            missing: statusRes.data?.missing ?? ["unknown"],
            hints: statusRes.data?.install_hints ?? {},
            pendingPdfPath: path,
          });
          return;
        }
        const omrPath = await runOMR(path);
        if (!omrPath) return;
        scorePath = omrPath;
      } else if (/\.(wav|mp3|m4a|flac|ogg|aac)$/.test(lower)) {
        // 音訊: 跑 basic-pitch AMT
        setLoading(true, tr("toolbar.loading.amtCheck"));
        const amtRes = await window.scoreArranger.engine.amtStatus();
        if (!amtRes.ok || !amtRes.data?.available) {
          setLoading(false);
          const hints = amtRes.data?.install_hints ?? {};
          const missing = amtRes.data?.missing ?? ["basic-pitch"];
          setError(
            tr("toolbar.error.amtMissing", {
              missing: missing.join(", "),
              hints: Object.values(hints).join("\n"),
            }),
          );
          return;
        }
        setLoading(true, tr("toolbar.loading.amtRunning"));
        const amtConv = await window.scoreArranger.engine.audioToMusicXML(path);
        if (!amtConv.ok || !amtConv.data) {
          setError(amtConv.error ?? tr("toolbar.error.amtFailed"));
          return;
        }
        scorePath = amtConv.data.musicxml_path;
      }

      setSourcePath(scorePath);
      setLoading(true, tr("toolbar.loading.scoreSize"));
      // 大譜偵測: >800 measures 自動切前 200 小節預覽 (改編仍走完整譜)
      let maxMeasures: number | undefined ;
      try {
        const info = await window.scoreArranger.engine.scoreInfo(scorePath);
        if (info.ok && info.data && info.data.measure_count > 800) {
          maxMeasures = 200;
          setLoading(
            true,
            tr("toolbar.loading.largeScore", {
              count: info.data.measure_count,
              preview: maxMeasures,
            }),
          );
        } else {
          setLoading(true, tr("toolbar.loading.loadingScore"));
        }
      } catch {
        setLoading(true, tr("toolbar.loading.loadingScore"));
      }
      const xmlRes = await window.scoreArranger.engine.toMusicXML(
        scorePath, maxMeasures,
      );
      if (xmlRes.ok && xmlRes.data) {
        setSourceMusicXML(xmlRes.data);
        snapshotToTab();
      } else {
        setError(xmlRes.error ?? tr("toolbar.error.loadScoreFailed"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const path = await window.scoreArranger.openScoreDialog();
    if (!path) return;
    // PDF: 先打預防針 —— OMR 辨識本質上不穩定, 讓使用者匯入前心裡有底
    if (path.toLowerCase().endsWith(".pdf")) {
      setPdfWarning({ pendingPdfPath: path });
      return;
    }
    await runImport(path);
  };

  // 空狀態功能按鈕 — ScoreViewer 用 CustomEvent 呼叫, 避免雙向耦合
  useEffect(() => {
    const handler = () => { void handleImport(); };
    window.addEventListener("sa:request-open-score", handler);
    return () => {
      window.removeEventListener("sa:request-open-score", handler);
    };
  }, [handleImport]);

  const handleAnalyze = async () => {
    if (!sourcePath) return;
    setLoading(true, tr("toolbar.loading.analyzing"));
    setError(null);
    try {
      const res = await window.scoreArranger.engine.analyze(sourcePath);
      if (res.ok && res.data) {
        setAnalysis(res.data);
        setMode("analyze");
      } else {
        setError(res.error ?? tr("toolbar.error.analyzeFailed"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleArrange = async () => {
    if (!sourcePath) return;
    setLoading(true, tr("toolbar.loading.arranging"));
    setError(null);
    try {
      const res = targetEnsemble === "__custom__" && customPlayers
        ? await window.scoreArranger.engine.arrangeCustom(
          sourcePath,
          customPlayers,
          enableRepair,
          skillLevel,
          stylePreset,
        )
        : await window.scoreArranger.engine.arrange(
          sourcePath,
          targetEnsemble,
          enableRepair,
          skillLevel,
          stylePreset,
          getStrategyPreference(),
        );
      if (res.ok && res.data) {
        setArrangement(res.data);
        setTargetMusicXML(res.data.target_musicxml ?? null);
        setArrangementIssues(res.data.issues ?? []);
        setHistoryFlags(false, false);
        setMode("arrange");
        snapshotToTab();
      } else {
        setError(res.error ?? tr("toolbar.error.arrangeFailed"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // === styles ===
  const btnBase: React.CSSProperties = {
    padding: "5px 10px",
    border: "1px solid var(--button-border)",
    borderRadius: 4,
    background: "var(--button-bg)",
    color: "var(--button-fg)",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1.4,
    whiteSpace: "nowrap",
  };
  const btnIcon: React.CSSProperties = { ...btnBase, padding: "5px 8px" };
  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "var(--accent)",
    color: "var(--accent-fg)",
    borderColor: "var(--accent)",
    fontWeight: 600,
  };
  const overflowLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--fg-muted)",
    marginBottom: 4,
  };

  // 檢視群組三鈕 — 工具列 / 溢出選單共用
  const renderViewButtons = () => (
    <>
      <button
        onClick={toggleHeatmap}
        style={{
          ...btnIcon,
          background: showHeatmap ? "var(--accent)" : btnIcon.background,
          color: showHeatmap ? "var(--accent-fg)" : btnIcon.color,
        }}
        title={showHeatmap
          ? tr("toolbar.heatmap.hide")
          : tr("toolbar.heatmap.show")}
      >
        🔥
      </button>
      <button
        onClick={togglePanelLayout}
        style={btnIcon}
        title={panelLayout === "vertical"
          ? tr("toolbar.layout.toHorizontal")
          : tr("toolbar.layout.toVertical")}
      >
        {panelLayout === "vertical" ? "▤" : "▥"}
      </button>
      <button
        onClick={toggleInfoPanelPos}
        style={btnIcon}
        title={infoPanelPos === "side"
          ? tr("toolbar.infoPanel.toBottom")
          : tr("toolbar.infoPanel.toSide")}
      >
        {infoPanelPos === "side" ? "◧" : "▭"}
      </button>
    </>
  );

  return (
    <header
      ref={headerRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 10px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-panel)",
        color: "var(--fg-primary)",
        minWidth: 0,
      }}
    >
      {/* === Group 1: 檔案 === */}
      <button onClick={handleImport} style={btnBase} disabled={isLoading}>
        {tr("toolbar.import")}
      </button>
      <PresetLibrary buttonStyle={btnBase} disabled={isLoading} />
      <button
        onClick={handleOpenProject}
        style={btnIcon}
        disabled={isLoading}
        title={tr("toolbar.openProject")}
      >
        📂
      </button>
      <button
        onClick={handleSaveProject}
        style={btnIcon}
        disabled={!sourcePath || isLoading}
        title={tr("toolbar.saveProject")}
      >
        💾
      </button>

      <Sep />

      {/* === Group 2: 動作 === */}
      <button
        onClick={handleAnalyze}
        style={btnBase}
        disabled={!sourcePath || isLoading}
      >
        {tr("toolbar.analyze")}
      </button>
      <div
        ref={arrangeOptsRef}
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 0,
          position: "relative",
        }}
      >
        <button
          onClick={handleArrange}
          style={{
            ...btnPrimary,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            borderRight: "1px solid rgba(0,0,0,0.15)",
          }}
          disabled={!sourcePath || isLoading}
          title={tr("toolbar.arrange.to", {
            ensemble: tr(ENSEMBLE_LABEL_KEYS[targetEnsemble] ?? ""),
          })}
        >
          {tr("toolbar.arrange")}
        </button>
        <select
          value={targetEnsemble}
          onChange={(e) => {
            const v = e.target.value as typeof targetEnsemble;
            if (v === "__custom__") {
              setCustomEnsembleOpen(true);
            } else {
              setTargetEnsemble(v);
            }
          }}
          disabled={isLoading}
          style={{ ...btnBase, borderRadius: 0, paddingRight: 20 }}
          title={tr("toolbar.ensembleSelect")}
        >
          <option value="violin_piano">
            {tr("toolbar.ensembleOpt.violinPiano")}
          </option>
          <option value="string_quartet">
            {tr("toolbar.ensembleOpt.stringQuartet")}
          </option>
          <option value="piano_solo">
            {tr("toolbar.ensembleOpt.pianoSolo")}
          </option>
          <option value="harpsichord_solo">
            {tr("toolbar.ensembleOpt.harpsichordSolo")}
          </option>
          <option value="violin_harpsichord">
            {tr("toolbar.ensembleOpt.violinHarpsichord")}
          </option>
          <option value="baroque_trio_sonata">
            {tr("toolbar.ensembleOpt.baroqueTrioSonata")}
          </option>
          <option value="woodwind_quintet">
            {tr("toolbar.ensembleOpt.woodwindQuintet")}
          </option>
          <option value="brass_quintet">
            {tr("toolbar.ensembleOpt.brassQuintet")}
          </option>
          <option value="guitar_solo">
            {tr("toolbar.ensembleOpt.guitarSolo")}
          </option>
          <option value="lute_solo">
            {tr("toolbar.ensembleOpt.luteSolo")}
          </option>
          <option value="harp_solo">
            {tr("toolbar.ensembleOpt.harpSolo")}
          </option>
          <option value="flute_guitar">
            {tr("toolbar.ensembleOpt.fluteGuitar")}
          </option>
          <option value="__custom__">
            {customPlayers
              ? tr("toolbar.ensembleOpt.customWithCount", {
                count: customPlayers.length,
              })
              : tr("toolbar.ensembleOpt.custom")}
          </option>
        </select>
        <button
          onClick={() => setArrangeOptsOpen((v) => !v)}
          style={{
            ...btnBase,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            borderLeft: "1px solid var(--border-light)",
            padding: "5px 7px",
            background: arrangeOptsOpen
              ? "var(--bg-hover)"
              : btnBase.background,
          }}
          title={tr("toolbar.arrangeOpts")}
        >
          ⚙
        </button>
        {arrangeOptsOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              minWidth: 210,
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              padding: 10,
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--fg-muted)",
              }}
            >
              {tr("toolbar.arrangeOpts.heading")}
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
              title={tr("toolbar.arrangeOpts.autoRepair.title")}
            >
              <input
                type="checkbox"
                checked={enableRepair}
                onChange={(e) => setEnableRepair(e.target.checked)}
                style={{ margin: 0 }}
              />
              {tr("toolbar.arrangeOpts.autoRepair")}
            </label>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-muted)",
                  marginBottom: 3,
                }}
              >
                {tr("toolbar.arrangeOpts.skillLevel")}
              </div>
              <select
                value={skillLevel}
                onChange={(e) =>
                  setSkillLevel(e.target.value as typeof skillLevel)}
                disabled={isLoading}
                style={{ ...btnBase, width: "100%", fontSize: 12 }}
                title={tr("toolbar.arrangeOpts.skillLevel.title")}
              >
                <option value="amateur">{tr("toolbar.skill.amateur")}</option>
                <option value="intermediate">
                  {tr("toolbar.skill.intermediate")}
                </option>
                <option value="professional">
                  {tr("toolbar.skill.professional")}
                </option>
              </select>
            </div>
            {stylePresets.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--fg-muted)",
                    marginBottom: 3,
                  }}
                >
                  {tr("toolbar.arrangeOpts.style")}
                </div>
                <select
                  value={stylePreset}
                  onChange={(e) => setStylePreset(e.target.value)}
                  disabled={isLoading}
                  style={{ ...btnBase, width: "100%", fontSize: 12 }}
                  title={tr("toolbar.arrangeOpts.style.title")}
                >
                  {stylePresets.map((p) => (
                    <option key={p.id} value={p.id} title={p.description}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
      <button
        onClick={() => setNlEditOpen(true)}
        style={btnBase}
        disabled={!arrangement || isLoading}
        title={tr("toolbar.nlEdit.title")}
      >
        {tr("toolbar.nlEdit")}
      </button>
      <button
        onClick={() => setBoostOpen(true)}
        style={btnBase}
        disabled={!arrangement || isLoading}
        title={tr("toolbar.boost.title")}
      >
        {tr("toolbar.boost")}
      </button>
      <button
        onClick={() => setPracticeOpen(true)}
        style={btnBase}
        disabled={!arrangement || isLoading}
        title={tr("toolbar.practice.title")}
      >
        {tr("toolbar.practice")}
      </button>

      <Sep />

      {/* === Group 3: 歷史 === */}
      <button
        onClick={doUndo}
        disabled={!canUndo || isLoading}
        style={{ ...btnIcon, opacity: canUndo ? 1 : 0.4 }}
        title={tr("toolbar.undo")}
      >
        ↶
      </button>
      <button
        onClick={doRedo}
        disabled={!canRedo || isLoading}
        style={{ ...btnIcon, opacity: canRedo ? 1 : 0.4 }}
        title={tr("toolbar.redo")}
      >
        ↷
      </button>

      <Sep />

      {/* === Group 4: 播放 === */}
      <PlaybackControls compact />

      {/* === 檔名 (吃所有剩餘空間, 視窗變窄時優先壓縮) === */}
      <span
        ref={filenameRef}
        style={{
          flex: "1 1 0",
          minWidth: 0,
          fontSize: 11,
          color: "var(--fg-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "right",
          paddingLeft: 8,
        }}
        title={sourcePath ?? ""}
      >
        {sourcePath
          ? (sourcePath.startsWith("corpus:")
            ? sourcePath.slice("corpus:".length)
            : sourcePath.split("/").pop())
          : ""}
      </span>

      {/* === Group 5: 縮放 (可收合) === */}
      {collapseLevel < 2 && (
        <>
          <Sep />
          <div
            ref={zoomGroupRef}
            style={{ display: "flex", alignItems: "center" }}
          >
            <ZoomControls />
          </div>
        </>
      )}

      {/* === Group 6: 檢視 (可收合) === */}
      {collapseLevel < 1 && (
        <>
          <Sep />
          <div
            ref={viewGroupRef}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            {renderViewButtons()}
          </div>
        </>
      )}

      {/* === Group 7: 匯出 (可收合) === */}
      {collapseLevel < 3 && (
        <>
          <Sep />
          <div
            ref={exportGroupRef}
            style={{ display: "flex", alignItems: "center" }}
          >
            <ExportMenu
              buttonStyle={btnBase}
              disabled={!sourcePath || isLoading}
            />
          </div>
        </>
      )}

      {/* === 溢出選單: 視窗過窄時自動收合的群組 === */}
      {collapseLevel > 0 && (
        <>
          <Sep />
          <div ref={overflowRef} style={{ position: "relative" }}>
            <button
              onClick={() => setOverflowOpen((v) => !v)}
              style={{
                ...btnIcon,
                background: overflowOpen
                  ? "var(--bg-hover)"
                  : btnIcon.background,
              }}
              title={tr("toolbar.overflow.title")}
            >
              ⋯
            </button>
            {/* 內容常駐 (display 切換) — 收合的 ZoomControls 鍵盤快捷鍵不中斷 */}
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                minWidth: 190,
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                padding: 10,
                zIndex: 100,
                display: overflowOpen ? "flex" : "none",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {collapseLevel >= 1 && (
                <div>
                  <div style={overflowLabelStyle}>
                    {tr("toolbar.overflow.view")}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {renderViewButtons()}
                  </div>
                </div>
              )}
              {collapseLevel >= 2 && (
                <div>
                  <div style={overflowLabelStyle}>
                    {tr("toolbar.overflow.zoom")}
                  </div>
                  <ZoomControls />
                </div>
              )}
              {collapseLevel >= 3 && (
                <div>
                  <div style={overflowLabelStyle}>
                    {tr("toolbar.overflow.export")}
                  </div>
                  <ExportMenu
                    buttonStyle={btnBase}
                    disabled={!sourcePath || isLoading}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Sep />

      {/* === Group 9: 設定 overflow menu === */}
      <div ref={settingsRef} style={{ position: "relative" }}>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          style={btnIcon}
          title={tr("toolbar.settings")}
        >
          ⚙
        </button>
        {settingsOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 4,
              minWidth: 180,
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              padding: 4,
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <MenuRow
              label={theme === "dark"
                ? tr("toolbar.settings.toLight")
                : tr("toolbar.settings.toDark")}
              icon={theme === "dark" ? "☀" : "☾"}
              onClick={() => {
                toggleTheme();
                setSettingsOpen(false);
              }}
            />
            <MenuRow
              label={tr(
                locale === "zh-TW"
                  ? "toolbar.settings.toEnglish"
                  : locale === "en"
                    ? "toolbar.settings.toJapanese"
                    : "toolbar.settings.toChinese",
              )}
              icon={
                locale === "zh-TW" ? "EN" : locale === "en" ? "日" : "台"
              }
              onClick={() => {
                // 三語循環: 繁中 → English → 日本語 → 繁中
                setLocale(
                  locale === "zh-TW"
                    ? "en"
                    : locale === "en"
                      ? "ja"
                      : "zh-TW",
                );
                setSettingsOpen(false);
              }}
            />
            <div
              style={{
                height: 1,
                background: "var(--border-light)",
                margin: "2px 0",
              }}
            />
            <MenuRow
              label={tr("toolbar.settings.llm")}
              icon="🤖"
              onClick={() => {
                setLlmSettingsOpen(true);
                setSettingsOpen(false);
              }}
            />
            <MenuRow
              label={tr("toolbar.settings.about")}
              icon="ⓘ"
              onClick={() => {
                setAboutOpen(true);
                setSettingsOpen(false);
              }}
            />
          </div>
        )}
      </div>
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {llmSettingsOpen && (
        <LLMSettingsDialog onClose={() => setLlmSettingsOpen(false)} />
      )}
      {nlEditOpen && <NLEditDialog onClose={() => setNlEditOpen(false)} />}
      {boostOpen && (
        <DifficultyBoostDialog onClose={() => setBoostOpen(false)} />
      )}
      {practiceOpen && (
        <PracticePanel onClose={() => setPracticeOpen(false)} />
      )}
      {customEnsembleOpen && (
        <CustomEnsembleDialog
          initial={customPlayers ?? undefined}
          onCancel={() => setCustomEnsembleOpen(false)}
          onApply={(players) => {
            setCustomPlayers(players);
            setTargetEnsemble("__custom__");
            setCustomEnsembleOpen(false);
          }}
        />
      )}
      {omrDialog && (
        <OMRInstallDialog
          missing={omrDialog.missing}
          installHints={omrDialog.hints}
          onCancel={() => setOmrDialog(null)}
          onRetry={async () => {
            const res = await window.scoreArranger.engine.omrStatus();
            if (res.ok && res.data?.available) {
              const pdfPath = omrDialog.pendingPdfPath;
              setOmrDialog(null);
              try {
                const scorePath = await runOMR(pdfPath);
                if (scorePath) {
                  setSourcePath(scorePath);
                  setLoading(true, tr("toolbar.loading.loadingScore"));
                  const xmlRes = await window.scoreArranger.engine.toMusicXML(
                    scorePath,
                  );
                  if (xmlRes.ok && xmlRes.data) {
                    setSourceMusicXML(xmlRes.data);
                    snapshotToTab();
                  } else {
                    setError(xmlRes.error ?? tr("toolbar.error.loadScoreFailed"));
                  }
                }
              } finally {
                setLoading(false);
              }
              return true;
            }
            // 更新 dialog 內容以反映最新偵測
            if (res.ok && res.data) {
              setOmrDialog({
                missing: res.data.missing ?? ["unknown"],
                hints: res.data.install_hints ?? {},
                pendingPdfPath: omrDialog.pendingPdfPath,
              });
            }
            return false;
          }}
        />
      )}
      {omrProgress && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            background: "var(--bg-panel)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            padding: "10px 16px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            fontSize: 13,
            zIndex: 999,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {tr("toolbar.omrProgress.heading")}
          </div>
          <div style={{ color: "var(--fg-muted)", fontSize: 11 }}>
            {tr("toolbar.omrProgress.elapsed", {
              sec: omrProgress.elapsedSec,
            })}
          </div>
        </div>
      )}
      {pdfWarning && (
        <PdfImportWarningDialog
          fileName={pdfWarning.pendingPdfPath.split(/[/\\]/).pop()
            ?? pdfWarning.pendingPdfPath}
          onCancel={() => setPdfWarning(null)}
          onProceed={() => {
            const pdfPath = pdfWarning.pendingPdfPath;
            setPdfWarning(null);
            void runImport(pdfPath);
          }}
        />
      )}
    </header>
  );
}

function MenuRow(
  { label, icon, onClick }: {
    label: string;
    icon: string;
    onClick: () => void;
  },
) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: "transparent",
        border: "none",
        color: "var(--fg-primary)",
        cursor: "pointer",
        fontSize: 12,
        textAlign: "left",
        borderRadius: 4,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: 20, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

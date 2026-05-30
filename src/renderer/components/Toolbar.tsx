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
import { Coachmark } from "./Coachmark";
import { CustomEnsembleDialog, type CustomPlayer } from "./CustomEnsembleDialog";
import { ExportMenu } from "./ExportMenu";
import { LLMSettingsDialog } from "./LLMSettingsDialog";
import { LLMSetupWizard } from "./LLMSetupWizard";
import { TeacherHub } from "./TeacherHub";
import { NLEditDialog } from "./NLEditDialog";
import { OMRInstallDialog } from "./OMRInstallDialog";
import { OMRReviewDialog } from "./OMRReviewDialog";
import { PdfImportWarningDialog } from "./PdfImportWarningDialog";
import { PlaybackControls } from "./PlaybackControls";
import { RepertoireDialog } from "./RepertoireDialog";
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
    refining,
    setRefining,
    metronomeOpen,
    setMetronomeOpen,
    setLoading,
    setError,
    setStyleAddendum,
    isLoading,
    setMode,
    theme,
    toggleTheme,
    guidanceMode,
    setGuidanceMode,
    resetSeenCoachmarks,
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
  // 0.1.44: 教師中心 (TeacherHub) 統一 4 個散落入口
  const [teacherHubOpen, setTeacherHubOpen] = useState(false);
  const [repertoireOpen, setRepertoireOpen] = useState(false);
  // 0.1.41: 空狀態畫面的「試用範例」按鈕 / 老 CustomEvent 都打開新 Dialog
  useEffect(() => {
    const handler = () => setRepertoireOpen(true);
    window.addEventListener("sa:request-open-preset-library", handler);
    window.addEventListener("sa:request-open-repertoire", handler);
    return () => {
      window.removeEventListener("sa:request-open-preset-library", handler);
      window.removeEventListener("sa:request-open-repertoire", handler);
    };
  }, []);
  // LLM 入門精靈: 點需要 AI 的功能且 LLM 未設定時, 自動跳出
  // 設完後 pendingLLMAction 決定要打開哪個對話框
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [pendingLLMAction, setPendingLLMAction] = useState<
    "nlEdit" | "boost" | null
  >(null);

  // 0.1.46 D1: ⌘/ 快捷鍵打開 NL 面板. (⌘E 由 ExportMenu 自己接.)
  useEffect(() => {
    const openNl = () => {
      if (!sourcePath) return;
      setNlEditOpen(true);
    };
    window.addEventListener("sa:request-open-nl-edit", openNl);
    return () => {
      window.removeEventListener("sa:request-open-nl-edit", openNl);
    };
  }, [sourcePath]);
  // 引導模式 — 4 個主要動作按鈕的 anchor ref, 給 Coachmark 用
  // 漸進式改編的世代計數 — 使用者重新改編時 ++, 用來丟棄過期的背景精修結果
  const arrangeGenRef = useRef(0);
  const arrangeBtnRef = useRef<HTMLButtonElement>(null);
  const nlEditBtnRef = useRef<HTMLButtonElement>(null);
  const boostBtnRef = useRef<HTMLButtonElement>(null);
  const practiceBtnRef = useRef<HTMLButtonElement>(null);
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
  // OMR 跑完後的「核對結果」對話框 — 確認後才實際 setSourcePath.
  // Audiveris 常產出嚴重錯誤 (漏小節 / 0 聲部), 先讓使用者核對基本資訊.
  const [omrReview, setOmrReview] = useState<{
    omrPath: string;
    pdfPath: string;
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

  // 鍵盤快捷鍵 — 0.1.46 D1 補完:
  //   ⌘Z undo / ⌘⇧Z redo / ⌘S save / ⌘\ 切版面方向
  //   ⌘O 開譜 / ⌘E 匯出 / ⌘L 曲庫 / ⌘/ NL 改譜面板
  //   除錯/輸入欄位內的鍵盤事件不攔截.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      // 別跟輸入框搶 ⌘Z (例如 LLM 對話框打字)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
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
      } else if (e.key === "o" && !e.shiftKey) {
        e.preventDefault();
        await handleImport();
      } else if (e.key === "e" && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("sa:request-open-export-menu"));
      } else if (e.key === "l" && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("sa:request-open-repertoire"));
      } else if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("sa:request-open-nl-edit"));
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

  /**
   * 已拿到最終 MusicXML 路徑 — setSourcePath + 抓 scoreInfo + 載 MusicXML.
   * 從 runImport (非 PDF 路徑) 與 OMRReviewDialog 確認流程兩處共用.
   */
  const finishImportFromScorePath = async (scorePath: string) => {
    try {
      setSourcePath(scorePath);
      setLoading(true, tr("toolbar.loading.scoreSize"));
      // 大譜偵測: >800 measures 自動切前 200 小節預覽 (改編仍走完整譜).
      let maxMeasures: number | undefined;
      let totalMeasures = 0;
      try {
        const info = await window.scoreArranger.engine.scoreInfo(scorePath);
        if (info.ok && info.data) {
          totalMeasures = info.data.measure_count;
          if (info.data.measure_count > 800) {
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
        }
      } catch {
        setLoading(true, tr("toolbar.loading.loadingScore"));
      }
      const xmlRes = await window.scoreArranger.engine.toMusicXML(
        scorePath, maxMeasures, 1,
      );
      if (xmlRes.ok && xmlRes.data) {
        setSourceMusicXML(xmlRes.data);
        if (maxMeasures && totalMeasures > maxMeasures) {
          useSessionStore.getState().setSourceSlice({
            startMeasure: 1,
            pageSize: maxMeasures,
            totalMeasures,
          });
        } else {
          useSessionStore.getState().setSourceSlice(null);
        }
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
        // OMR 完成 → 不直接進匯入流程, 先彈核對對話框讓使用者確認.
        // 確認後 finishImport(omrPath) 才實際 setSourcePath.
        setLoading(false);
        setOmrReview({ omrPath, pdfPath: path });
        return;
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

      // 把後續流程委交給 helper (OMR 路徑也走同一個函式, 確認後才呼叫)
      await finishImportFromScorePath(scorePath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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

  // 0.1.47 C3: 「今日推薦」卡片點擊 → 直接載入 corpus, 不開 RepertoireDialog
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ corpus_path: string }>).detail;
      if (!detail?.corpus_path) return;
      void (async () => {
        const virtualPath = `corpus:${detail.corpus_path}`;
        if (!activeTabId && tabs.length === 0) newTab();
        setLoading(true, tr("preset.loading", { name: detail.corpus_path }));
        setError(null);
        setAnalysis(null);
        setArrangement(null);
        setTargetMusicXML(null);
        try {
          const res = await window.scoreArranger.engine.toMusicXML(virtualPath);
          if (res.ok && res.data) {
            setSourcePath(virtualPath);
            setSourceMusicXML(res.data);
            setMode("setup");
            snapshotToTab();
          } else {
            setError(res.error ?? tr("preset.error.loadFailed"));
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setLoading(false);
        }
      })();
    };
    window.addEventListener("sa:request-load-corpus", handler);
    return () => {
      window.removeEventListener("sa:request-load-corpus", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, tabs.length]);

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

  // 漸進式改編: 兩階段
  //   Stage 1 (draft) — 一律 repair=false, 快速產生草稿並立即渲染, 解除阻塞遮罩
  //   Stage 2 (refine) — 若開啟修復, 背景跑 repair_loop, 完成後就地更新譜面
  // 世代計數 + 分頁 id 防競態: 使用者重新改編或切換分頁時, 過期的精修結果直接丟棄
  const handleArrange = async () => {
    if (!sourcePath) return;
    const gen = ++arrangeGenRef.current;
    const originTabId = activeTabId;
    setRefining(false);
    setLoading(true, tr("toolbar.loading.arranging"));
    setError(null);
    try {
      const draft = targetEnsemble === "__custom__" && customPlayers
        ? await window.scoreArranger.engine.arrangeCustom(
          sourcePath,
          customPlayers,
          false,
          skillLevel,
          stylePreset,
        )
        : await window.scoreArranger.engine.arrange(
          sourcePath,
          targetEnsemble,
          false,
          skillLevel,
          stylePreset,
          getStrategyPreference(),
        );
      if (gen !== arrangeGenRef.current) return; // 已被新一次改編取代
      if (!draft.ok || !draft.data) {
        setError(draft.error ?? tr("toolbar.error.arrangeFailed"));
        return;
      }
      const draftData = draft.data;
      setArrangement(draftData);
      setTargetMusicXML(draftData.target_musicxml ?? null);
      setArrangementIssues(draftData.issues ?? []);
      setHistoryFlags(false, false);
      setMode("arrange");
      snapshotToTab();

      if (!enableRepair) return; // 草稿即最終結果

      // Stage 2: 背景精修 — 不阻塞 UI, 草稿已可操作
      setLoading(false);
      setRefining(true);
      try {
        const ref = await window.scoreArranger.engine.refine(
          skillLevel,
          getStrategyPreference(),
        );
        if (gen !== arrangeGenRef.current) return; // 過期
        if (useSessionStore.getState().activeTabId !== originTabId) return;
        if (ref.ok && ref.data) {
          setArrangement({ ...draftData, ...ref.data });
          setTargetMusicXML(
            ref.data.target_musicxml ?? draftData.target_musicxml ?? null,
          );
          setArrangementIssues(ref.data.issues ?? draftData.issues ?? []);
          snapshotToTab();
        }
        // refine 失敗不覆寫草稿 — 草稿仍是有效改編
      } finally {
        if (gen === arrangeGenRef.current) setRefining(false);
      }
    } catch (e) {
      if (gen === arrangeGenRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (gen === arrangeGenRef.current) setLoading(false);
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
      <button
        onClick={() => setRepertoireOpen(true)}
        style={btnBase}
        disabled={isLoading}
        title={tr("repertoire.title")}
      >
        {tr("repertoire.button")}
      </button>
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
          ref={arrangeBtnRef}
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
      {refining && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 9px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--accent)",
            background: "var(--accent-soft, rgba(120,90,200,0.12))",
            border: "1px solid var(--accent)",
            whiteSpace: "nowrap",
          }}
          title={tr("toolbar.refining.title")}
        >
          <span className="sa-refining-dot" aria-hidden>
            ◍
          </span>
          {tr("toolbar.refining")}
        </span>
      )}
      <button
        ref={nlEditBtnRef}
        onClick={async () => {
          // 改譜 需要 LLM — 沒設定就跳入門精靈, 設完後自動開改譜
          try {
            const ok = await window.scoreArranger.llmIsAvailable();
            if (ok) {
              setNlEditOpen(true);
            } else {
              setPendingLLMAction("nlEdit");
              setSetupWizardOpen(true);
            }
          } catch {
            setPendingLLMAction("nlEdit");
            setSetupWizardOpen(true);
          }
        }}
        style={btnBase}
        disabled={!arrangement || isLoading}
        title={tr("toolbar.nlEdit.title")}
      >
        {tr("toolbar.nlEdit")}
      </button>
      {/* 0.1.44: 教師中心 — 取代散落的「學生 / 加難度 / 練習 / 麥克風」4 按鈕,
          歸 1 hub. boostBtnRef / practiceBtnRef 暫保留指向此鈕, 引導模式
          的 coachmark 仍能對到位置 (使用者點開 hub 找到對應 tab). */}
      <button
        ref={boostBtnRef}
        onClick={() => setTeacherHubOpen(true)}
        style={btnBase}
        disabled={isLoading}
        title={tr("toolbar.teacherHub.title")}
      >
        {tr("toolbar.teacherHub")}
      </button>
      {/* 0.1.61: 獨立節拍器面板開關 */}
      <button
        onClick={() => setMetronomeOpen(!metronomeOpen)}
        style={{
          ...btnBase,
          background: metronomeOpen ? "var(--accent)" : btnBase.background,
          color: metronomeOpen ? "var(--accent-fg)" : btnBase.color,
        }}
        title={tr("metronome.open.title")}
      >
        {tr("metronome.open")}
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
      {/* toolbar 主播放器: 同步比對模式 — 播改編譜, 同時兩邊 (原譜 + 改編譜)
          面板都顯示游標, 方便對照. 源譜/改編譜面板自己的 compact 播放器
          (App.tsx 內) 不傳 syncBoth, 只各自播自己. */}
      <PlaybackControls compact syncBoth />

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
      {/* 0.1.47 B4: collapseLevel 數字 badge 顯示有幾組被收起 — 強化
          響應式溢出的視覺性, 之前只 ⋯ 看不出是 3 群或 1 群被藏. */}
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
                position: "relative",
              }}
              title={tr("toolbar.overflow.title")}
            >
              ⋯
              <span
                style={{
                  position: "absolute",
                  top: 1, right: 1,
                  minWidth: 13, height: 13,
                  padding: "0 3px",
                  borderRadius: 7,
                  background: "var(--accent)",
                  color: "var(--accent-fg)",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  boxShadow: "0 0 0 1.5px var(--bg-panel)",
                }}
                aria-hidden
              >
                {collapseLevel}
              </span>
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
              label={guidanceMode
                ? tr("toolbar.settings.guidanceOff")
                : tr("toolbar.settings.guidanceOn")}
              icon="💡"
              onClick={() => {
                setGuidanceMode(!guidanceMode);
                setSettingsOpen(false);
              }}
            />
            {guidanceMode && (
              <MenuRow
                label={tr("toolbar.settings.guidanceReset")}
                icon="↺"
                onClick={() => {
                  resetSeenCoachmarks();
                  setSettingsOpen(false);
                }}
              />
            )}
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
      {setupWizardOpen && (
        <LLMSetupWizard
          onClose={() => {
            setSetupWizardOpen(false);
            setPendingLLMAction(null);
          }}
          onConfigured={() => {
            // 設完後接續使用者本來想做的事
            if (pendingLLMAction === "nlEdit") setNlEditOpen(true);
            setPendingLLMAction(null);
          }}
        />
      )}
      {nlEditOpen && <NLEditDialog onClose={() => setNlEditOpen(false)} />}
      {teacherHubOpen && (
        <TeacherHub onClose={() => setTeacherHubOpen(false)} />
      )}
      {repertoireOpen && (
        <RepertoireDialog onClose={() => setRepertoireOpen(false)} />
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
      {omrReview && (
        <OMRReviewDialog
          omrPath={omrReview.omrPath}
          pdfPath={omrReview.pdfPath}
          onCancel={() => setOmrReview(null)}
          onConfirm={() => {
            const path = omrReview.omrPath;
            setOmrReview(null);
            void finishImportFromScorePath(path);
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
              const scorePath = await runOMR(pdfPath);
              setLoading(false);
              if (scorePath) {
                // 與 runImport 一致 — 先彈核對對話框, 確認後才進匯入
                setOmrReview({ omrPath: scorePath, pdfPath });
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
      {/*
       * 引導模式 coachmarks (顯示一次, 之後在設定裡可重置).
       * Phase 3: 每個按鈕的功能介紹 (是否需要 AI / 在做什麼).
       * Phase 4: 觸發時機 = 按鈕剛變得能用 → 等於「下一步」hint.
       *   - 改編: sourcePath 載入後 & 還沒改編 → 提示「下一步」
       *   - 改譜/難度/練習: 改編完成後 → 解鎖時介紹
       * Note: arrangement loading 過程 isLoading=true, coachmark 不顯示.
       */}
      {!!sourcePath && !arrangement && !isLoading && (
        <Coachmark
          id="arrange-intro"
          anchorRef={arrangeBtnRef}
          title={tr("coachmark.nextStep.afterLoad.title")}
          body={tr("coachmark.nextStep.afterLoad.body")}
          placement="bottom"
        />
      )}
      {!!arrangement && !isLoading && (
        <Coachmark
          id="nl-edit-intro"
          anchorRef={nlEditBtnRef}
          title={tr("coachmark.nlEdit.title")}
          body={tr("coachmark.nlEdit.body")}
          placement="bottom"
        />
      )}
      {!!arrangement && !isLoading && (
        <Coachmark
          id="boost-intro"
          anchorRef={boostBtnRef}
          title={tr("coachmark.boost.title")}
          body={tr("coachmark.boost.body")}
          placement="bottom"
          delayMs={800}
        />
      )}
      {!!arrangement && !isLoading && (
        <Coachmark
          id="practice-intro"
          anchorRef={practiceBtnRef}
          title={tr("coachmark.practice.title")}
          body={tr("coachmark.practice.body")}
          placement="bottom"
          delayMs={1200}
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

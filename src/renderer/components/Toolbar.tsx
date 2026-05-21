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
import { NLEditDialog } from "./NLEditDialog";
import { OMRInstallDialog } from "./OMRInstallDialog";
import { PlaybackControls } from "./PlaybackControls";
import { PresetLibrary } from "./PresetLibrary";
import { ZoomControls } from "./ZoomControls";
import { useSessionStore } from "../stores/sessionStore";
import { getLocale, onLocaleChange, setLocale } from "../utils/i18n";
import {
  getStrategyPreference,
  recordUndoIfRecent,
} from "../utils/preferences";

const ENSEMBLE_LABELS: Record<string, string> = {
  violin_piano: "小提琴 + 鋼琴",
  string_quartet: "弦樂四重奏",
  piano_solo: "鋼琴獨奏",
  harpsichord_solo: "大鍵琴獨奏",
  violin_harpsichord: "小提琴 + 大鍵琴",
  baroque_trio_sonata: "巴洛克三重奏鳴曲",
  woodwind_quintet: "木管五重奏",
  brass_quintet: "銅管五重奏",
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
    setLoading(true, "Undo...");
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
        setError(res.error ?? "Undo 失敗");
      }
    } finally {
      setLoading(false);
    }
  };

  const doRedo = async () => {
    setLoading(true, "Redo...");
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
        setError(res.error ?? "Redo 失敗");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProject = async () => {
    if (!sourcePath) {
      setError("尚無內容可儲存");
      return;
    }
    const path = await window.scoreArranger.saveProjectDialog();
    if (!path) return;
    setLoading(true, "儲存專案...");
    try {
      const res = await window.scoreArranger.engine.saveProject(
        path,
        sourcePath,
      );
      if (!res.ok) {
        setError(res.error ?? "儲存失敗");
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
    setLoading(true, "載入專案...");
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
        setError(res.error ?? "載入專案失敗");
      }
    } finally {
      setLoading(false);
    }
  };

  /** 跑 Audiveris OMR + 顯示經過秒數. 回傳 musicxml 路徑或 null (失敗時已 setError). */
  const runOMR = async (pdfPath: string): Promise<string | null> => {
    const startedAt = Date.now();
    setLoading(true, "Audiveris 辨識中... (大型 PDF 約 1-3 分鐘)");
    const timer = setInterval(() => {
      setOmrProgress({ elapsedSec: Math.round((Date.now() - startedAt) / 1000) });
    }, 1000);
    try {
      const omrRes = await window.scoreArranger.engine.pdfToMusicXML(pdfPath);
      if (!omrRes.ok || !omrRes.data) {
        setError(omrRes.error ?? "OMR 失敗");
        return null;
      }
      return omrRes.data.musicxml_path;
    } finally {
      clearInterval(timer);
      setOmrProgress(null);
    }
  };

  const handleImport = async () => {
    try {
      const path = await window.scoreArranger.openScoreDialog();
      if (!path) return;
      setError(null);
      setMode("setup");
      if (!activeTabId && tabs.length === 0) {
        newTab();
      }

      // PDF: 先檢查 Audiveris, 沒裝就跳安裝指引 modal
      let scorePath: string = path;
      const lower = path.toLowerCase();
      if (lower.endsWith(".pdf")) {
        setLoading(true, "檢查 OMR 環境...");
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
        setLoading(true, "檢查 basic-pitch 環境...");
        const amtRes = await window.scoreArranger.engine.amtStatus();
        if (!amtRes.ok || !amtRes.data?.available) {
          setLoading(false);
          const hints = amtRes.data?.install_hints ?? {};
          const missing = amtRes.data?.missing ?? ["basic-pitch"];
          setError(
            `音訊轉譜需要 basic-pitch (缺: ${missing.join(", ")})\n\n`
            + Object.values(hints).join("\n"),
          );
          return;
        }
        setLoading(true, "basic-pitch 辨識音訊中 (1-3 分鐘)...");
        const amtConv = await window.scoreArranger.engine.audioToMusicXML(path);
        if (!amtConv.ok || !amtConv.data) {
          setError(amtConv.error ?? "AMT 失敗");
          return;
        }
        scorePath = amtConv.data.musicxml_path;
      }

      setSourcePath(scorePath);
      setLoading(true, "檢查樂譜大小...");
      // 大譜偵測: >800 measures 自動切前 200 小節預覽 (改編仍走完整譜)
      let maxMeasures: number | undefined ;
      try {
        const info = await window.scoreArranger.engine.scoreInfo(scorePath);
        if (info.ok && info.data && info.data.measure_count > 800) {
          maxMeasures = 200;
          setLoading(
            true,
            `大譜偵測 (${info.data.measure_count} 小節) — 預覽只顯示前 ${maxMeasures} 小節, 改編仍用完整譜`,
          );
        } else {
          setLoading(true, "正在載入樂譜...");
        }
      } catch {
        setLoading(true, "正在載入樂譜...");
      }
      const xmlRes = await window.scoreArranger.engine.toMusicXML(
        scorePath, maxMeasures,
      );
      if (xmlRes.ok && xmlRes.data) {
        setSourceMusicXML(xmlRes.data);
        snapshotToTab();
      } else {
        setError(xmlRes.error ?? "載入樂譜失敗");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!sourcePath) return;
    setLoading(true, "正在分析樂譜...");
    setError(null);
    try {
      const res = await window.scoreArranger.engine.analyze(sourcePath);
      if (res.ok && res.data) {
        setAnalysis(res.data);
        setMode("analyze");
      } else {
        setError(res.error ?? "分析失敗");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleArrange = async () => {
    if (!sourcePath) return;
    setLoading(true, "正在改編...");
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
        setError(res.error ?? "改編失敗");
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
        title={showHeatmap ? "關閉難度熱圖" : "顯示難度熱圖"}
      >
        🔥
      </button>
      <button
        onClick={togglePanelLayout}
        style={btnIcon}
        title={panelLayout === "vertical"
          ? "切為左右排列 (⌘\\)"
          : "切為上下排列 (⌘\\)"}
      >
        {panelLayout === "vertical" ? "▤" : "▥"}
      </button>
      <button
        onClick={toggleInfoPanelPos}
        style={btnIcon}
        title={infoPanelPos === "side" ? "資訊欄移到下方" : "資訊欄移到右側"}
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
        匯入
      </button>
      <PresetLibrary buttonStyle={btnBase} disabled={isLoading} />
      <button
        onClick={handleOpenProject}
        style={btnIcon}
        disabled={isLoading}
        title="開啟 .sarr 專案"
      >
        📂
      </button>
      <button
        onClick={handleSaveProject}
        style={btnIcon}
        disabled={!sourcePath || isLoading}
        title="儲存專案 (⌘S)"
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
        分析
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
          title={`改編為 ${ENSEMBLE_LABELS[targetEnsemble]}`}
        >
          改編
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
          title="選擇目標編制"
        >
          <option value="violin_piano">小提琴+鋼琴</option>
          <option value="string_quartet">弦樂四重奏</option>
          <option value="piano_solo">鋼琴獨奏</option>
          <option value="harpsichord_solo">大鍵琴獨奏</option>
          <option value="violin_harpsichord">小提琴+大鍵琴</option>
          <option value="baroque_trio_sonata">巴洛克三重奏鳴曲</option>
          <option value="woodwind_quintet">木管五重奏</option>
          <option value="brass_quintet">銅管五重奏</option>
          <option value="__custom__">
            {customPlayers
              ? `🛠 自訂 (${customPlayers.length} 人)`
              : "🛠 自訂編制..."}
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
          title="改編選項 (自動修復 / 技術水平 / 風格)"
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
              改編選項
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
              title="改編後自動執行修復迴圈, 嘗試解決音域 / 把位等問題"
            >
              <input
                type="checkbox"
                checked={enableRepair}
                onChange={(e) => setEnableRepair(e.target.checked)}
                style={{ margin: 0 }}
              />
              改編後自動修復
            </label>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-muted)",
                  marginBottom: 3,
                }}
              >
                演奏者技術水平
              </div>
              <select
                value={skillLevel}
                onChange={(e) =>
                  setSkillLevel(e.target.value as typeof skillLevel)}
                disabled={isLoading}
                style={{ ...btnBase, width: "100%", fontSize: 12 }}
                title="amateur 會主動縮減和弦 / 避難段, professional 不限"
              >
                <option value="amateur">業餘</option>
                <option value="intermediate">中級</option>
                <option value="professional">專業</option>
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
                  改編風格
                </div>
                <select
                  value={stylePreset}
                  onChange={(e) => setStylePreset(e.target.value)}
                  disabled={isLoading}
                  style={{ ...btnBase, width: "100%", fontSize: 12 }}
                  title="套用後處理 hooks (旋律 / bass 強化 / continuo 等)"
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
        title="用自然語言請 AI 修改改編譜 (移調 / 演奏法 / 力度)"
      >
        🤖 改譜
      </button>

      <Sep />

      {/* === Group 3: 歷史 === */}
      <button
        onClick={doUndo}
        disabled={!canUndo || isLoading}
        style={{ ...btnIcon, opacity: canUndo ? 1 : 0.4 }}
        title="Undo (⌘Z)"
      >
        ↶
      </button>
      <button
        onClick={doRedo}
        disabled={!canRedo || isLoading}
        style={{ ...btnIcon, opacity: canRedo ? 1 : 0.4 }}
        title="Redo (⇧⌘Z)"
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
              title="更多工具 (視窗較窄時自動收合於此)"
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
                  <div style={overflowLabelStyle}>檢視</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {renderViewButtons()}
                  </div>
                </div>
              )}
              {collapseLevel >= 2 && (
                <div>
                  <div style={overflowLabelStyle}>縮放</div>
                  <ZoomControls />
                </div>
              )}
              {collapseLevel >= 3 && (
                <div>
                  <div style={overflowLabelStyle}>匯出</div>
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
          title="設定"
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
              label={theme === "dark" ? "切換為亮色" : "切換為暗色"}
              icon={theme === "dark" ? "☀" : "☾"}
              onClick={() => {
                toggleTheme();
                setSettingsOpen(false);
              }}
            />
            <MenuRow
              label={locale === "zh-TW" ? "Switch to English" : "切換為繁中"}
              icon={locale === "zh-TW" ? "EN" : "中"}
              onClick={() => {
                setLocale(locale === "zh-TW" ? "en" : "zh-TW");
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
              label="AI 模型設定"
              icon="🤖"
              onClick={() => {
                setLlmSettingsOpen(true);
                setSettingsOpen(false);
              }}
            />
            <MenuRow
              label="關於 Score Arranger"
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
                  setLoading(true, "正在載入樂譜...");
                  const xmlRes = await window.scoreArranger.engine.toMusicXML(
                    scorePath,
                  );
                  if (xmlRes.ok && xmlRes.data) {
                    setSourceMusicXML(xmlRes.data);
                    snapshotToTab();
                  } else {
                    setError(xmlRes.error ?? "載入樂譜失敗");
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
          <div style={{ fontWeight: 600 }}>Audiveris 辨識中</div>
          <div style={{ color: "var(--fg-muted)", fontSize: 11 }}>
            已用時 {omrProgress.elapsedSec}s · 大型 PDF 需 1-3 分鐘
          </div>
        </div>
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

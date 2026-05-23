/**
 * Session Store — 整個改編 session 的狀態管理 (Zustand)
 *
 * Phase 1 範圍:
 * - 當前載入的 source 路徑
 * - 分析報告 (AnalysisReport)
 * - 當前 arrangement 結果
 * - UI mode (setup / analyze / arrange / refine / export)
 *
 * Phase 2 範圍:
 * - undo/redo 歷史
 * - A/B 版本分支管理
 */

import { create } from "zustand";
import type {
  AnalysisReport,
  ArrangementIssue,
  ArrangementResult,
  QualityScores,
} from "@shared/types";
import { t as tr } from "../utils/i18n";

export type AppMode =
  | "setup"
  | "analyze"
  | "arrange"
  | "transcribe"  // 樂器替換 + 移調 (跟 arrange 並列)
  | "refine"
  | "export";
export type Theme = "light" | "dark";
export type PanelLayout = "horizontal" | "vertical";
/** 資訊欄 (IssuePanel 等) 位置: 譜面下方 or 右側側邊欄 */
export type InfoPanelPos = "bottom" | "side";

/** Tab 內的 A/B 變體 — 改編結果快照, 便於比較 */
export interface ArrangementVariant {
  /** 顯示名稱 ("版本 A", "和聲填充更多", ...) */
  name: string;
  targetMusicXML: string;
  createdAt: number;
  /** 簡短描述, 顯示在 hover tooltip */
  note?: string;
  /** 存檔時的改編品質 — 給 A/B 並排比較 */
  quality?: QualityScores | null;
}

/** 單一 Tab 快照 — 只記顯示用的核心狀態, server-side state 仍是單一 */
export interface TabSnapshot {
  id: string;
  label: string;
  sourcePath: string | null;
  sourceMusicXML: string | null;
  targetMusicXML: string | null;
  /** A/B 變體, 用於比較不同改編版本 */
  variants?: ArrangementVariant[];
}

const THEME_STORAGE_KEY = "score-arranger.theme";
const TABS_STORAGE_KEY = "score-arranger.tabs";
const ZOOM_STORAGE_KEY = "score-arranger.zoom";
const AUTOFIT_STORAGE_KEY = "score-arranger.autofit";

function loadInitialAutoFit(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage?.getItem(AUTOFIT_STORAGE_KEY);
    if (raw === "true" || raw === "false") return raw === "true";
  } catch {
    /* ignore */
  }
  return true; // 預設開啟
}
const LAYOUT_STORAGE_KEY = "score-arranger.layout";

function loadInitialLayout(): PanelLayout {
  if (typeof window === "undefined") return "vertical";
  try {
    const raw = window.localStorage?.getItem(LAYOUT_STORAGE_KEY);
    if (raw === "horizontal" || raw === "vertical") return raw;
  } catch {
    /* ignore */
  }
  return "vertical"; // 預設縱向 (上下),更易比較
}

const INFO_PANEL_POS_KEY = "score-arranger.info-panel-pos";

function loadInitialInfoPanelPos(): InfoPanelPos {
  if (typeof window === "undefined") return "side";
  try {
    const raw = window.localStorage?.getItem(INFO_PANEL_POS_KEY);
    if (raw === "bottom" || raw === "side") return raw;
  } catch {
    /* ignore */
  }
  return "side"; // 預設側邊欄
}

const GUIDANCE_MODE_KEY = "score-arranger.guidance-mode";
const SEEN_COACHMARKS_KEY = "score-arranger.seen-coachmarks";

function loadInitialGuidanceMode(): boolean {
  // 首次安裝預設 ON — 音樂老師等非工程用戶需要引導. 進階用戶可關掉.
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage?.getItem(GUIDANCE_MODE_KEY);
    if (raw === "off") return false;
    if (raw === "on") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function loadInitialSeenCoachmarks(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage?.getItem(SEEN_COACHMARKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    /* ignore */
  }
  return {};
}
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 0.7;

function loadInitialZoom(): number {
  if (typeof window === "undefined") return ZOOM_DEFAULT;
  try {
    const raw = window.localStorage?.getItem(ZOOM_STORAGE_KEY);
    if (!raw) return ZOOM_DEFAULT;
    const z = parseFloat(raw);
    if (Number.isFinite(z) && z >= ZOOM_MIN && z <= ZOOM_MAX) return z;
  } catch {
    /* ignore */
  }
  return ZOOM_DEFAULT;
}

function saveZoom(z: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(ZOOM_STORAGE_KEY, String(z));
  } catch {
    /* ignore */
  }
}

interface PersistedTab {
  id: string;
  label: string;
  sourcePath: string | null;
}

function saveTabsToStorage(tabs: TabSnapshot[], activeId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const compact: PersistedTab[] = tabs.map((t) => ({
      id: t.id,
      label: t.label,
      sourcePath: t.sourcePath,
    }));
    window.localStorage?.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify({ tabs: compact, activeId }),
    );
  } catch {
    /* full storage or no localStorage */
  }
}

function loadTabsFromStorage(): {
  tabs: TabSnapshot[];
  activeId: string | null;
} {
  if (typeof window === "undefined") return { tabs: [], activeId: null };
  try {
    const raw = window.localStorage?.getItem(TABS_STORAGE_KEY);
    if (!raw) return { tabs: [], activeId: null };
    const parsed = JSON.parse(raw) as {
      tabs: PersistedTab[];
      activeId: string | null;
    };
    return {
      tabs: parsed.tabs.map((p) => ({
        id: p.id,
        label: p.label,
        sourcePath: p.sourcePath,
        sourceMusicXML: null, // lazy-load on switch
        targetMusicXML: null,
      })),
      activeId: parsed.activeId,
    };
  } catch {
    return { tabs: [], activeId: null };
  }
}

function loadInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // 預設依系統偏好
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("dark", theme === "dark");
}

/** 通知 main process 切換 active session (engine 端的 multi-session 路由) */
function notifyActiveSession(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.scoreArranger?.engine?.setActiveSession?.(id);
  } catch {
    /* ignore */
  }
}

function deriveLabel(sourcePath: string | null): string {
  if (!sourcePath) return tr("session.tab.untitled");
  if (sourcePath.startsWith("corpus:")) {
    return sourcePath.slice("corpus:".length);
  }
  return sourcePath.split("/").pop() ?? sourcePath;
}

interface SessionState {
  // 來源檔案
  sourcePath: string | null;
  setSourcePath: (path: string | null) => void;

  // 渲染用 MusicXML 字串
  sourceMusicXML: string | null;
  setSourceMusicXML: (xml: string | null) => void;
  targetMusicXML: string | null;
  setTargetMusicXML: (xml: string | null) => void;

  /** 大譜分頁顯示資訊 (null = 完整顯示, 沒有分頁). 大譜虛擬化 MVP:
   * 譜 > 800 measures 時自動切 200 一頁, 使用者可以翻頁瀏覽其他段落. */
  sourceSlice: {
    startMeasure: number;  // 1-based
    pageSize: number;
    totalMeasures: number;
  } | null;
  setSourceSlice: (slice: SessionState["sourceSlice"]) => void;

  // 分析結果
  analysis: AnalysisReport | null;
  setAnalysis: (a: AnalysisReport | null) => void;

  // 當前改編
  arrangement: ArrangementResult | null;
  setArrangement: (a: ArrangementResult | null) => void;

  // 改編產出的 issues (target_score 上的, 可 apply_suggestion)
  arrangementIssues: ArrangementIssue[];
  setArrangementIssues: (issues: ArrangementIssue[]) => void;

  // Undo/Redo 旗標
  canUndo: boolean;
  canRedo: boolean;
  setHistoryFlags: (canUndo: boolean, canRedo: boolean) => void;

  // 載入狀態
  isLoading: boolean;
  loadingMessage: string;
  setLoading: (loading: boolean, message?: string) => void;

  // 錯誤
  error: string | null;
  setError: (msg: string | null) => void;

  // 當前風格 preset 的 LLM 提示文字 (給 AI 建議 / 自然語言改譜帶風格脈絡)
  styleAddendum: string;
  setStyleAddendum: (text: string) => void;

  // UI mode
  mode: AppMode;
  setMode: (m: AppMode) => void;

  // 跨面板高亮的小節 (來自 IssuePanel 點選, 平滑捲動)
  highlightedMeasure: number | null;
  setHighlightedMeasure: (m: number | null) => void;
  /** 每次高亮 (含重複點選同一小節) 都遞增, 觸發 flash 動畫 */
  highlightFlashTick: number;

  /** 編輯套用後要閃光的小節範圍 — 變動小節閃光特效。tick 每次遞增重觸發。 */
  editFlash: { start: number; end: number; tick: number } | null;
  flashEditedMeasures: (start: number, end: number) => void;

  /** 練習模式請求 loop 一段 — PlaybackControls 訂閱 tick 變化套用。 */
  requestedLoop: { start: number; end: number; tick: number } | null;
  requestLoop: (start: number, end: number) => void;

  // 播放中的當前小節 (即時更新, 不平滑捲動)
  playbackMeasure: number | null;
  setPlaybackMeasure: (m: number | null) => void;

  // 哪邊面板正在播放 (互斥, Tone.Transport 是 singleton)
  activePlaybackSide: "source" | "target" | null;
  setActivePlaybackSide: (s: "source" | "target" | null) => void;

  /** 同步比對模式 — toolbar 那顆「主播放」啟用時設 true, 兩邊面板都顯示
   * 游標 (對照用). 源譜 / 改編譜 各自的播放器 (compact, 在面板標題列) 設
   * false, 只有自己那邊顯示游標, 不互相干擾. */
  playbackSyncBoth: boolean;
  setPlaybackSyncBoth: (v: boolean) => void;

  // 播放進度 (0-1)
  playbackProgress: number;
  setPlaybackProgress: (p: number) => void;

  // 主題
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  // OSMD 縮放 (兩面板共用)
  zoom: number;
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  /** 自動縮放: 左右排列時 fit 寬, 上下排列時 fit 高 */
  autoFit: boolean;
  toggleAutoFit: () => void;

  // 面板排列方向
  panelLayout: PanelLayout;
  togglePanelLayout: () => void;
  setPanelLayout: (l: PanelLayout) => void;
  infoPanelPos: InfoPanelPos;
  toggleInfoPanelPos: () => void;

  // 譜面難度熱圖 (target panel 上疊紅/黃/綠色塊)
  showHeatmap: boolean;
  toggleHeatmap: () => void;

  /** 引導模式 — 首次使用功能時顯示 coachmark 氣泡 (給音樂老師等非工程
   * 用戶). 預設 true; 使用者可在設定中關掉. localStorage 持久化. */
  guidanceMode: boolean;
  setGuidanceMode: (v: boolean) => void;
  /** 已看過的 coachmark id 集合 — 一旦標記就不再顯示 (即使 guidanceMode
   * 仍 true). localStorage 持久化. */
  seenCoachmarks: Record<string, true>;
  markCoachmarkSeen: (id: string) => void;
  /** 重置所有 seen 標記 (給「重新看一次教學」按鈕用). */
  resetSeenCoachmarks: () => void;

  // Tabs (Phase 1 MVP: 只保存核心顯示狀態快照)
  tabs: TabSnapshot[];
  activeTabId: string | null;
  newTab: () => string;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  /** 把當前顯示中的核心狀態寫入指定 tab (或 active tab) */
  snapshotToTab: (id?: string) => void;

  // A/B 變體 (per-tab)
  saveVariant: (name?: string, note?: string) => void;
  loadVariant: (variantIndex: number) => void;
  deleteVariant: (variantIndex: number) => void;
  /** 用於 A/B Diff 模式: 目前要對比的 variant index (相對於 active tab) */
  compareVariantIndex: number | null;
  setCompareVariantIndex: (idx: number | null) => void;

  // 重置
  reset: () => void;
}

const _initialTheme = loadInitialTheme();
applyThemeClass(_initialTheme);

const _initialTabsRaw = loadTabsFromStorage();
// 校正: 若 activeId 指向不存在的 tab, fallback 到第一個或 null
let _initialActiveId = _initialTabsRaw.activeId;
const _activeRestored = _initialTabsRaw.tabs.find(
  (t) => t.id === _initialActiveId,
);
if (!_activeRestored && _initialTabsRaw.tabs.length > 0) {
  _initialActiveId = _initialTabsRaw.tabs[0].id;
} else if (_initialTabsRaw.tabs.length === 0) {
  _initialActiveId = null;
}
const _initialTabs = {
  tabs: _initialTabsRaw.tabs,
  activeId: _initialActiveId,
};
// 啟動時把 active session 也告知 main (defer 避免 preload 未就緒)
if (_initialTabs.activeId && typeof window !== "undefined") {
  setTimeout(() => notifyActiveSession(_initialTabs.activeId), 0);
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sourcePath: _activeRestored?.sourcePath ?? null,
  setSourcePath: (path) => set({ sourcePath: path }),

  sourceMusicXML: _activeRestored?.sourceMusicXML ?? null,
  setSourceMusicXML: (xml) => set({ sourceMusicXML: xml }),
  targetMusicXML: _activeRestored?.targetMusicXML ?? null,
  setTargetMusicXML: (xml) => set({ targetMusicXML: xml }),

  sourceSlice: null,
  setSourceSlice: (slice) => set({ sourceSlice: slice }),

  analysis: null,
  setAnalysis: (a) => set({ analysis: a }),

  arrangement: null,
  setArrangement: (a) => set({ arrangement: a }),

  arrangementIssues: [],
  setArrangementIssues: (issues) => set({ arrangementIssues: issues }),

  canUndo: false,
  canRedo: false,
  setHistoryFlags: (canUndo, canRedo) => set({ canUndo, canRedo }),

  isLoading: false,
  loadingMessage: "",
  setLoading: (loading, message = "") =>
    set({ isLoading: loading, loadingMessage: message }),

  error: null,
  setError: (msg) => set({ error: msg }),

  styleAddendum: "",
  setStyleAddendum: (text) => set({ styleAddendum: text }),

  mode: "setup",
  setMode: (m) => set({ mode: m }),

  highlightedMeasure: null,
  highlightFlashTick: 0,
  setHighlightedMeasure: (m) =>
    set((s) => ({
      highlightedMeasure: m,
      highlightFlashTick:
        m == null ? s.highlightFlashTick : s.highlightFlashTick + 1,
    })),

  editFlash: null,
  flashEditedMeasures: (start, end) =>
    set((s) => ({
      editFlash: {
        start, end, tick: (s.editFlash?.tick ?? 0) + 1,
      },
    })),

  requestedLoop: null,
  requestLoop: (start, end) =>
    set((s) => ({
      requestedLoop: {
        start, end, tick: (s.requestedLoop?.tick ?? 0) + 1,
      },
    })),

  playbackMeasure: null,
  setPlaybackMeasure: (m) => set({ playbackMeasure: m }),
  activePlaybackSide: null,
  setActivePlaybackSide: (s) => set({ activePlaybackSide: s }),
  playbackSyncBoth: false,
  setPlaybackSyncBoth: (v) => set({ playbackSyncBoth: v }),

  playbackProgress: 0,
  setPlaybackProgress: (p) => set({ playbackProgress: p }),

  tabs: _initialTabs.tabs,
  activeTabId: _initialTabs.activeId,
  newTab: () => {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => {
      // 先把目前 active tab 的狀態快照保存
      const updatedTabs = s.activeTabId
        ? s.tabs.map((t) =>
            t.id === s.activeTabId
              ? {
                  ...t,
                  sourcePath: s.sourcePath,
                  sourceMusicXML: s.sourceMusicXML,
                  targetMusicXML: s.targetMusicXML,
                  label: deriveLabel(s.sourcePath),
                }
              : t,
          )
        : s.tabs;
      const newTab: TabSnapshot = {
        id,
        label: tr("session.tab.untitled"),
        sourcePath: null,
        sourceMusicXML: null,
        targetMusicXML: null,
      };
      return {
        tabs: [...updatedTabs, newTab],
        activeTabId: id,
        sourcePath: null,
        sourceMusicXML: null,
        targetMusicXML: null,
        analysis: null,
        arrangement: null,
        arrangementIssues: [],
        canUndo: false,
        canRedo: false,
        highlightedMeasure: null,
        playbackMeasure: null,
        mode: "setup",
      };
    });
    notifyActiveSession(id);
    saveTabsToStorage(get().tabs, get().activeTabId);
    return id;
  },
  closeTab: (id) => {
    // 通知 server 釋放該 session 資源 (非 await,fire-and-forget)
    try {
      window.scoreArranger?.engine?.closeSession?.(id);
    } catch {
      /* ignore */
    }
    let nextActive: string | null = null;
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      if (s.activeTabId !== id) return { tabs };
      const idx = s.tabs.findIndex((t) => t.id === id);
      const fallback = tabs[idx] ?? tabs[idx - 1] ?? null;
      if (!fallback) {
        nextActive = null;
        return {
          tabs,
          activeTabId: null,
          sourcePath: null,
          sourceMusicXML: null,
          targetMusicXML: null,
          analysis: null,
          arrangement: null,
          arrangementIssues: [],
          highlightedMeasure: null,
          playbackMeasure: null,
        };
      }
      nextActive = fallback.id;
      return {
        tabs,
        activeTabId: fallback.id,
        sourcePath: fallback.sourcePath,
        sourceMusicXML: fallback.sourceMusicXML,
        targetMusicXML: fallback.targetMusicXML,
        analysis: null,
        arrangement: null,
        arrangementIssues: [],
        highlightedMeasure: null,
        playbackMeasure: null,
      };
    });
    if (nextActive !== undefined) notifyActiveSession(nextActive);
    saveTabsToStorage(get().tabs, get().activeTabId);
  },
  switchTab: (id) => {
    set((s) => {
      if (s.activeTabId === id) return {};
      // 把當前狀態存回原 active tab
      const updatedTabs = s.tabs.map((t) => {
        if (t.id === s.activeTabId) {
          return {
            ...t,
            sourcePath: s.sourcePath,
            sourceMusicXML: s.sourceMusicXML,
            targetMusicXML: s.targetMusicXML,
            label: deriveLabel(s.sourcePath),
          };
        }
        return t;
      });
      const target = updatedTabs.find((t) => t.id === id);
      if (!target) return { tabs: updatedTabs };
      return {
        tabs: updatedTabs,
        activeTabId: id,
        sourcePath: target.sourcePath,
        sourceMusicXML: target.sourceMusicXML,
        targetMusicXML: target.targetMusicXML,
        // 切換 tab 後其他衍生狀態清空 (server 端的 session 有自己的 history)
        analysis: null,
        arrangement: null,
        arrangementIssues: [],
        canUndo: false,
        canRedo: false,
        highlightedMeasure: null,
        playbackMeasure: null,
        mode: target.sourcePath ? "arrange" : "setup",
      };
    });
    notifyActiveSession(id);
    saveTabsToStorage(get().tabs, get().activeTabId);
  },
  snapshotToTab: (id) => {
    set((s) => {
      const tid = id ?? s.activeTabId;
      if (!tid) return {};
      return {
        tabs: s.tabs.map((t) =>
          t.id === tid
            ? {
                ...t,
                sourcePath: s.sourcePath,
                sourceMusicXML: s.sourceMusicXML,
                targetMusicXML: s.targetMusicXML,
                label: deriveLabel(s.sourcePath),
              }
            : t,
        ),
      };
    });
    saveTabsToStorage(get().tabs, get().activeTabId);
  },

  /** 把目前的改編結果存成一個 A/B 變體 (per-tab) */
  saveVariant: (name, note) => {
    set((s) => {
      const tid = s.activeTabId;
      if (!tid || !s.targetMusicXML) return {};
      return {
        tabs: s.tabs.map((t) => {
          if (t.id !== tid) return t;
          const variants = [...(t.variants ?? [])];
          const autoName = name ??
            tr("session.variant.autoName", {
              letter: String.fromCharCode(65 + variants.length),
            });
          variants.push({
            name: autoName,
            targetMusicXML: s.targetMusicXML!,
            createdAt: Date.now(),
            note,
            quality: s.arrangement?.quality ?? null,
          });
          return { ...t, variants };
        }),
      };
    });
  },
  /** 載入指定變體 (覆蓋目前的 targetMusicXML) */
  loadVariant: (variantIndex) => {
    const state = get();
    const tid = state.activeTabId;
    if (!tid) return;
    const tab = state.tabs.find((t) => t.id === tid);
    if (!tab) return;
    const variant = tab.variants?.[variantIndex];
    if (!variant) return;
    set({ targetMusicXML: variant.targetMusicXML });
  },
  /** 刪除指定變體 */
  deleteVariant: (variantIndex) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== s.activeTabId) return t;
        const variants = [...(t.variants ?? [])];
        variants.splice(variantIndex, 1);
        return { ...t, variants };
      }),
      compareVariantIndex: s.compareVariantIndex === variantIndex
        ? null
        : s.compareVariantIndex,
    }));
  },
  compareVariantIndex: null,
  setCompareVariantIndex: (idx) => set({ compareVariantIndex: idx }),

  zoom: loadInitialZoom(),
  setZoom: (z) => {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    saveZoom(clamped);
    set({ zoom: clamped });
  },
  zoomIn: () => {
    const next = Math.min(ZOOM_MAX, get().zoom + ZOOM_STEP);
    saveZoom(next);
    set({ zoom: next });
  },
  zoomOut: () => {
    const next = Math.max(ZOOM_MIN, get().zoom - ZOOM_STEP);
    saveZoom(next);
    set({ zoom: next });
  },
  zoomReset: () => {
    saveZoom(ZOOM_DEFAULT);
    set({ zoom: ZOOM_DEFAULT });
  },
  autoFit: loadInitialAutoFit(),
  toggleAutoFit: () => {
    const next = !get().autoFit;
    try {
      window.localStorage?.setItem(AUTOFIT_STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
    set({ autoFit: next });
  },

  panelLayout: loadInitialLayout(),
  setPanelLayout: (l) => {
    try {
      window.localStorage?.setItem(LAYOUT_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    set({ panelLayout: l });
  },
  togglePanelLayout: () => {
    const next: PanelLayout = get().panelLayout === "vertical"
      ? "horizontal"
      : "vertical";
    try {
      window.localStorage?.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    set({ panelLayout: next });
  },

  infoPanelPos: loadInitialInfoPanelPos(),
  toggleInfoPanelPos: () => {
    const next: InfoPanelPos = get().infoPanelPos === "bottom"
      ? "side"
      : "bottom";
    try {
      window.localStorage?.setItem(INFO_PANEL_POS_KEY, next);
    } catch {
      /* ignore */
    }
    set({ infoPanelPos: next });
  },

  showHeatmap: false,
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),

  guidanceMode: loadInitialGuidanceMode(),
  setGuidanceMode: (v) => {
    set({ guidanceMode: v });
    try {
      window.localStorage?.setItem(GUIDANCE_MODE_KEY, v ? "on" : "off");
    } catch { /* ignore */ }
  },
  seenCoachmarks: loadInitialSeenCoachmarks(),
  markCoachmarkSeen: (id) => {
    set((s) => {
      const next = { ...s.seenCoachmarks, [id]: true as const };
      try {
        window.localStorage?.setItem(SEEN_COACHMARKS_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return { seenCoachmarks: next };
    });
  },
  resetSeenCoachmarks: () => {
    set({ seenCoachmarks: {} });
    try {
      window.localStorage?.removeItem(SEEN_COACHMARKS_KEY);
    } catch { /* ignore */ }
  },

  theme: _initialTheme,
  setTheme: (t) => {
    applyThemeClass(t);
    try {
      window.localStorage?.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    set({ theme: t });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyThemeClass(next);
    try {
      window.localStorage?.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    set({ theme: next });
  },

  reset: () =>
    set({
      sourcePath: null,
      sourceMusicXML: null,
      targetMusicXML: null,
      analysis: null,
      arrangement: null,
      arrangementIssues: [],
      canUndo: false,
      canRedo: false,
      isLoading: false,
      loadingMessage: "",
      error: null,
      mode: "setup",
      highlightedMeasure: null,
    }),
}));

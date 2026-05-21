/**
 * ScoreViewer — OSMD 樂譜渲染元件
 *
 * Phase 1 已實作:
 * - 接受 MusicXML 字串渲染
 * - 透過 forwardRef 暴露捲動容器 (供 useScrollSync 使用)
 * - 接受 highlightedMeasure prop, 自動捲到該小節
 * - 整合主題: OSMD defaultColor* 隨 dark/light 改變
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useSessionStore } from "../stores/sessionStore";

interface ScoreViewerProps {
  musicXmlContent: string | null;
  label?: string;
  /** 來自 IssuePanel 等的點選高亮 (平滑捲動) */
  highlightedMeasure?: number | null;
  /** Flash 觸發計數, 每次遞增就重新閃一次, 用於連點同一小節 */
  highlightFlashTick?: number;
  /** 播放中的當前小節 (即時捲動, 不平滑以避免延遲) */
  playbackMeasure?: number | null;
  /** 播放中的當前 onset 步數 (給音符級游標用); -1 = 尚未到任何音符 */
  playbackOnsetIndex?: number | null;
  /** 游標模式: "measure" = 一次跳一小節, "note" = 音符級高亮 */
  cursorMode?: "measure" | "note";
  /** 是否是當前播放對象 — false 時 cursor / 音符高亮不顯示 */
  isActivePlaybackPanel?: boolean;
  /** 使用者點選譜面上的小節時觸發.
   *
   * hint.approxPitch: 依照點擊 y 位置估算的 MIDI 音高, 讓編輯器可預選最接近的音。
   * (僅是粗估, 由 staff 的高度線性對應 C2..C6)
   */
  onMeasureClick?: (
    measure: number,
    hint?: { approxPitch?: number },
  ) => void;
  /** 使用者在譜面上垂直拖曳音符 → 立即 transpose 該音符 */
  onNoteDrag?: (
    measure: number,
    approxPitch: number,
    semitones: number,
  ) => void;
  /** 自動縮放的主導面板 (避免雙面板互相覆蓋) */
  isAutoFitReference?: boolean;
  /** 每小節難度分數 1-5, 用於熱圖渲染 (target panel 用) */
  measureDifficulty?: Map<number, number>;
  /** A/B Diff 模式: 標記為「與另一版本不同」的小節 */
  diffMeasures?: Set<number>;
}

interface FlashBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** key for React 重渲動畫重啟 */
  key: number;
}

const LIGHT_COLORS = {
  defaultColorMusic: "#000000",
  defaultColorStem: "#000000",
  defaultColorRest: "#000000",
  defaultColorLabel: "#000000",
  defaultColorTitle: "#000000",
  pageBackgroundColor: "#ffffff",
};
const DARK_COLORS = {
  defaultColorMusic: "#e8e8ea",
  defaultColorStem: "#e8e8ea",
  defaultColorRest: "#e8e8ea",
  defaultColorLabel: "#e8e8ea",
  defaultColorTitle: "#f5f5f7",
  pageBackgroundColor: "#2c2c2e",
};

export const ScoreViewer = forwardRef<HTMLDivElement, ScoreViewerProps>(
  function ScoreViewer(
    {
      musicXmlContent,
      label,
      highlightedMeasure,
      highlightFlashTick,
      playbackMeasure,
      playbackOnsetIndex,
      cursorMode,
      isActivePlaybackPanel,
      onMeasureClick,
      onNoteDrag,
      measureDifficulty,
      diffMeasures,
      isAutoFitReference,
    },
    forwardedRef,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const osmdContainerRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const cursorMeasureIdxRef = useRef<number>(0);
    /** 音符級游標已 advance 過的 onset 步數 (從 reset() 後計算).
     * 若 playbackOnsetIndex < cursorStepRef → 需要 reset 重來; > 則增量 next(). */
    const cursorStepRef = useRef<number>(-1);
    /** 上次音符級游標套色的 SVG 元素 (清除前一輪用) */
    const highlightedNotesRef = useRef<Element[]>([]);
    /** 重 render 後恢復 cursor 的 setTimeout id (給切譜時 cancel 用) */
    const pendingRestoreRef = useRef<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [flashBox, setFlashBox] = useState<FlashBox | null>(null);
    // 拖曳狀態: 顯示中的 ghost tooltip (像素位置 + 語意 semitones)
    const [dragGhost, setDragGhost] = useState<
      { x: number; y: number; semitones: number } | null
    >(null);
    // 拖曳起點 ref (避免 closure)
    const dragStartRef = useRef<
      | { x: number; y: number; measure: number; approxPitch: number }
      | null
    >(null);
    const flashTimerRef = useRef<number | null>(null);
    const theme = useSessionStore((s) => s.theme);
    const zoom = useSessionStore((s) => s.zoom);
    const setZoom = useSessionStore((s) => s.setZoom);
    const autoFit = useSessionStore((s) => s.autoFit);
    const panelLayout = useSessionStore((s) => s.panelLayout);
    // 上下排列時 → 改用 ribbon 模式 (單行水平卷軸)
    const isRibbon = panelLayout === "vertical";
    // 防止 autoFit 在多面板間競爭: 只讓有 musicXml 的第一個 panel 主導
    // 簡化: 以 containerRef 寬度為基準
    const autoFitIterRef = useRef(0);

    useImperativeHandle(forwardedRef, () => containerRef.current!, []);

    // 初始化 OSMD
    useEffect(() => {
      if (!osmdContainerRef.current) return;
      if (osmdRef.current) return;
      const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
      osmdRef.current = new OpenSheetMusicDisplay(osmdContainerRef.current, {
        autoResize: true,
        backend: "svg",
        drawTitle: true,
        drawComposer: true,
        drawPartNames: true,
        // 關鍵: 關掉 OSMD 自動 follow, 否則 cursor.next() 會呼叫 scrollIntoView
        // 把整個容器 (有時甚至 window) 一路滾到 cursor 位置, 跟我們的
        // scrollToMeasure 衝突 → 表現為 "一播放就滾到底".
        followCursor: false,
        ...colors,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 紀錄目前已 load 的 xml, 避免重複 load 引發 race
    const loadedXmlRef = useRef<string | null>(null);

    /**
     * 載入 + 渲染。分兩階段:
     *   1. 若 musicXmlContent 變了, 才呼叫 load(); 否則跳過 (load 慢)
     *   2. 永遠呼叫 setOptions + render() 套用最新 zoom / ribbon 設定
     *
     * 大譜保護:
     *   - MusicXML > 2MB 或預估 measure 數 > 600 → 強制 page mode (停用 ribbon)
     *   - 預估 measure 數 > 600 → 跳過 autoFit (避免兩次重渲染)
     */
    useEffect(() => {
      let cancelled = false;
      const run = async () => {
        const osmd = osmdRef.current;
        if (!osmd || !musicXmlContent) return;

        // 估算大小: 用字串長度 + measure 標籤次數
        const xmlSize = musicXmlContent.length;
        const measureMatches = musicXmlContent.match(/<measure\b/g);
        const measureCount = measureMatches?.length ?? 0;
        const isHuge = xmlSize > 2_000_000 || measureCount > 600;
        // 保留使用者選擇的 ribbon (上下排列時依然走 ribbon, 不再強制翻成 page)
        // 大譜的保護改為: 關 autoFit + 強制較低 zoom, 避免雙重 render 卡死
        const effectiveRibbon = isRibbon;
        const allowAutoFit = !isHuge && autoFit;
        if (isHuge) {
          // 大譜用較小 zoom (一次性, 不寫回 store 避免影響後續小譜)
          (osmd as unknown as { zoom: number }).zoom = Math.min(zoom, 0.4);
        }

        try {
          setError(null);
          (osmd as unknown as { zoom: number }).zoom = zoom;
          osmd.setOptions({
            renderSingleHorizontalStaffline: effectiveRibbon,
            followCursor: false,  // 強制再關一次, 避免舊 instance HMR 後殘留 true
          } as any);
          // 直接寫 property 雙保險
          (osmd as unknown as { FollowCursor?: boolean }).FollowCursor = false;
          if (loadedXmlRef.current !== musicXmlContent) {
            if (isHuge) {
              console.warn(
                `[ScoreViewer] huge score detected ` +
                `(xml=${(xmlSize / 1e6).toFixed(1)}MB, ` +
                `~${measureCount} measures) — ` +
                `forcing page mode + disabling autoFit`,
              );
            }
            await osmd.load(musicXmlContent);
            if (cancelled) return;
            loadedXmlRef.current = musicXmlContent;
          }
          osmd.render();
          if (cancelled) return;
          cursorMeasureIdxRef.current = 0;
          const cursor = (osmd as unknown as {
            cursor?: { hide: () => void; reset: () => void };
          }).cursor;
          cursor?.hide?.();
          if (allowAutoFit && isAutoFitReference) {
            scheduleAutoFit();
          }
          // 重 render 後若仍在播放 (note 模式), 恢復 cursor 位置 + 高亮.
          // 用 setTimeout 給 OSMD 一拍時間穩定 SVG 結構, 否則
          // NotesUnderCursor() 可能拿到舊 DOM 參考.
          if (
            cursorMode === "note"
            && playbackOnsetIndex != null
            && playbackOnsetIndex >= 0
          ) {
            const restoreId = window.setTimeout(() => {
              if (cancelled) return;
              try {
                cursorStepRef.current = -1;
                advanceCursorToOnset(playbackOnsetIndex);
                highlightNotesAtCursor();
              } catch (err) {
                console.warn(
                  "[ScoreViewer] restore cursor after load failed:", err,
                );
              }
            }, 50);
            // 同次 effect 的 cleanup 會清掉 restoreId
            pendingRestoreRef.current = restoreId;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[ScoreViewer] OSMD render failed:", e);
          setError(`渲染失敗: ${msg}`);
        }
      };
      run();
      return () => {
        cancelled = true;
        if (pendingRestoreRef.current != null) {
          window.clearTimeout(pendingRestoreRef.current);
          pendingRestoreRef.current = null;
        }
      };
    }, [musicXmlContent, zoom, isRibbon, autoFit, isAutoFitReference]);

    /**
     * 量測 SVG vs container, 計算 fit 縮放比例。
     *
     * - isRibbon=true (上下排列): 不應垂直卷軸 → 以「高度」為主
     * - isRibbon=false (左右排列): 不應水平卷軸 → 以「寬度」為主
     *
     * 用一次性 rAF 排程, 最多 3 次迭代收斂 (防止無限循環)。
     */
    const scheduleAutoFit = () => {
      if (autoFitIterRef.current > 3) {
        autoFitIterRef.current = 0;
        return;
      }
      autoFitIterRef.current++;
      // 延後 80ms 讓 OSMD 完成 SVG 內部的 layout (避免抓到 transient 0 高度)
      window.setTimeout(() => {
        const container = containerRef.current;
        const osmdEl = osmdContainerRef.current;
        if (!container || !osmdEl) return;
        const svg = osmdEl.querySelector("svg");
        if (!svg) return;
        const svgRect = svg.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Safety: 任一維度過小代表還沒 layout 完, 跳過此次
        if (
          svgRect.width < 20 || svgRect.height < 20
          || containerRect.width < 20 || containerRect.height < 20
        ) {
          autoFitIterRef.current = 0;
          return;
        }
        const PAD = 32;
        let factor: number;
        if (isRibbon) {
          const avail = containerRect.height - PAD;
          if (avail <= 0) return;
          factor = avail / svgRect.height;
        } else {
          const avail = containerRect.width - PAD;
          if (avail <= 0) return;
          factor = avail / svgRect.width;
        }
        // factor 異常 (NaN / inf / 過大) → 跳過
        if (!Number.isFinite(factor) || factor <= 0 || factor > 10) {
          autoFitIterRef.current = 0;
          return;
        }
        // 已經夠接近 → 不動
        if (factor > 0.95 && factor < 1.05) {
          autoFitIterRef.current = 0;
          return;
        }
        const newZoom = Math.max(
          0.3,
          Math.min(2.0, zoom * factor * 0.98),
        );
        // 若被 clamp 在邊界, 或變化太小, 停止
        if (newZoom === zoom || Math.abs(newZoom - zoom) < 0.02) {
          autoFitIterRef.current = 0;
          return;
        }
        setZoom(newZoom);
      }, 80);
    };

    // 視窗或 panel 尺寸變化 → 重新 autofit
    useEffect(() => {
      if (!autoFit || !isAutoFitReference) return;
      const container = containerRef.current;
      if (!container) return;
      const ro = new ResizeObserver(() => {
        autoFitIterRef.current = 0;
        scheduleAutoFit();
      });
      ro.observe(container);
      return () => ro.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoFit, isAutoFitReference, isRibbon]);

    /**
     * 滾輪處理:
     *  - ⌘ / Ctrl + 滾輪 → 縮放 (Trackpad pinch 在 macOS 也以 ctrlKey 標記)
     *  - ribbon 模式: deltaY 無垂直可捲時 → 轉為水平捲動 (普通滾鼠也能跟著譜走)
     *  - MX Master 3S 等橫向滾輪的 deltaX → 原生即可水平捲動, 但確保 ribbon
     *    模式下 OSMD svg 不會吃掉事件
     *
     * 用 native addEventListener({ passive: false }) 才能在需要時 preventDefault。
     */
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const onWheel = (e: WheelEvent) => {
        // ⌘ + 滾輪 / pinch zoom → 縮放
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // 手動縮放 → 自動關 autoFit (否則一秒就被覆寫)
          const state = useSessionStore.getState();
          if (state.autoFit) state.toggleAutoFit();
          const step = e.deltaY < 0 ? 0.05 : -0.05;
          state.setZoom(state.zoom + step);
          return;
        }

        // ribbon: 把純垂直滾輪轉成水平 (滑鼠中鍵沒橫向輪的人也能跟譜)
        if (isRibbon) {
          const canScrollH = container.scrollWidth > container.clientWidth;
          const canScrollV = container.scrollHeight > container.clientHeight;
          // 純 deltaY (無 deltaX) 且容器水平可捲, 垂直不可捲 → 轉為水平
          // (若兩個都可捲, 保留原行為讓使用者選)
          if (canScrollH && !canScrollV
              && e.deltaY !== 0 && e.deltaX === 0) {
            e.preventDefault();
            container.scrollLeft += e.deltaY;
            return;
          }
        }
        // 其他情況 (含 MX Master 3S 的 deltaX) → 原生處理
      };
      container.addEventListener("wheel", onWheel, { passive: false });
      return () => container.removeEventListener("wheel", onWheel);
    }, [isRibbon]);

    // 主題切換 → 更新 OSMD 顏色並重渲染 (若已載入內容)
    useEffect(() => {
      const osmd = osmdRef.current;
      if (!osmd) return;
      const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
      osmd.setOptions(colors);
      // 僅在已載入內容時重渲染
      if (musicXmlContent) {
        try {
          osmd.render();
        } catch {
          /* ignore */
        }
      }
    }, [theme, musicXmlContent]);

    /**
     * 捲動到指定小節.
     *
     * 策略改進 (vs 舊版比例近似):
     *  - 用 OSMD MeasureList 的真實 bounding box, 不是 ratio approximation
     *  - 智慧檢查: 只有當小節已經/即將離開 viewport 才捲, 否則不動
     *  - "alwaysCenter" 模式 (給 highlight click 用): 強制把小節移到視窗中心
     *  - 播放時用「將出視窗就推進」策略, 避免每個 tick 都強制居中造成抖動
     */
    /**
     * 捲動到指定小節.
     *
     * 用 *螢幕座標* (getBoundingClientRect) 比對, 不再用 offsetLeft 鏈式加法
     * (那種寫法對於有 padding/scroll/transform 的容器易出錯)。
     */
    const scrollToMeasure = (
      measureNumber: number,
      behavior: ScrollBehavior,
      alwaysCenter: boolean = false,
    ) => {
      // Emergency disable: 在 console 設 window.__SA_DISABLE_SCROLL = true 即可關
      if ((window as unknown as { __SA_DISABLE_SCROLL?: boolean })
        .__SA_DISABLE_SCROLL) return;
      if (!osmdRef.current || !containerRef.current) return;
      const container = containerRef.current;
      const osmdEl = osmdContainerRef.current;
      const svg = osmdEl?.querySelector("svg");
      const box = getMeasureBoxRaw(measureNumber);
      // 診斷 log: 在 console 設 window.__SA_SCROLL_LOG = true 開啟
      const debug = (window as unknown as { __SA_SCROLL_LOG?: boolean })
        .__SA_SCROLL_LOG;

      // 若 OSMD 還沒 layout (常見於切 layout 後立刻播放), 用比例 fallback
      if (!svg || !box) {
        const osmd = osmdRef.current;
        const measureList = (osmd as unknown as {
          GraphicalMusicSheet?: { MeasureList?: unknown[][] };
        }).GraphicalMusicSheet?.MeasureList;
        const total = measureList?.[0]?.length ?? 1;
        const ratio = (measureNumber - 1) / total;
        if (isRibbon) {
          container.scrollTo({
            left: Math.max(0, container.scrollWidth * ratio - 80),
            behavior,
          });
        } else {
          container.scrollTo({
            top: Math.max(0, container.scrollHeight * ratio - 80),
            behavior,
          });
        }
        return;
      }

      const svgRect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // 小節在「螢幕」上的位置 = SVG 螢幕位置 + box 在 SVG 內偏移
      const screenLeft = svgRect.left + box.left;
      const screenRight = svgRect.left + box.left + box.width;
      const screenTop = svgRect.top + box.top;
      const screenBottom = svgRect.top + box.top + box.height;

      const margin = 60;
      if (isRibbon) {
        const inView =
          screenLeft >= containerRect.left + margin
          && screenRight <= containerRect.right - margin;
        if (alwaysCenter || !inView) {
          const measureCenter = (screenLeft + screenRight) / 2;
          const containerCenter =
            (containerRect.left + containerRect.right) / 2;
          const delta = measureCenter - containerCenter;
          const maxScroll = container.scrollWidth - container.clientWidth;
          const target = Math.max(
            0,
            Math.min(maxScroll, container.scrollLeft + delta),
          );
          if (debug) {
            console.log("[scroll ribbon]", {
              measure: measureNumber,
              boxLeft: box.left, boxWidth: box.width,
              svgRectLeft: svgRect.left,
              screenLeft, screenRight,
              containerLeft: containerRect.left,
              containerRight: containerRect.right,
              scrollLeft: container.scrollLeft,
              scrollWidth: container.scrollWidth,
              clientWidth: container.clientWidth,
              delta, target, maxScroll,
              alwaysCenter, inView,
            });
          }
          container.scrollTo({ left: target, behavior });
        }
      } else {
        const inView =
          screenTop >= containerRect.top + margin
          && screenBottom <= containerRect.bottom - margin;
        if (alwaysCenter || !inView) {
          const measureCenter = (screenTop + screenBottom) / 2;
          const containerCenter =
            (containerRect.top + containerRect.bottom) / 2;
          const delta = measureCenter - containerCenter;
          const maxScroll = container.scrollHeight - container.clientHeight;
          const target = Math.max(
            0,
            Math.min(maxScroll, container.scrollTop + delta),
          );
          if (debug) {
            console.log("[scroll page]", {
              measure: measureNumber,
              boxTop: box.top, boxHeight: box.height,
              svgRectTop: svgRect.top,
              screenTop, screenBottom,
              containerTop: containerRect.top,
              containerBottom: containerRect.bottom,
              scrollTop: container.scrollTop,
              scrollHeight: container.scrollHeight,
              clientHeight: container.clientHeight,
              delta, target, maxScroll,
              alwaysCenter, inView,
            });
          }
          container.scrollTo({ top: target, behavior });
        }
      }
    };

    /** 直接拉 OSMD bbox (給 scrollToMeasure 用; getMeasureBox 給 flash 用了相同邏輯) */
    const getMeasureBoxRaw = (
      measureNumber: number,
    ): { left: number; top: number; width: number; height: number } | null => {
      const osmd = osmdRef.current as unknown as {
        GraphicalMusicSheet?: { MeasureList?: any[][] };
        EngravingRules?: { UnitInPixels?: number };
        zoom?: number;
      } | null;
      const measureList = osmd?.GraphicalMusicSheet?.MeasureList;
      if (!measureList?.[0]) return null;
      const idx = measureNumber - 1;
      if (idx < 0 || idx >= measureList[0].length) return null;
      const unitInPixel = osmd?.EngravingRules?.UnitInPixels ?? 10;
      const zoomVal = osmd?.zoom ?? 1;
      const ppu = unitInPixel * zoomVal;
      let minLeft = Infinity, minTop = Infinity;
      let maxRight = -Infinity, maxBottom = -Infinity;
      for (const staff of measureList) {
        const m: any = staff?.[idx];
        const pos = m?.PositionAndShape;
        const abs = pos?.AbsolutePosition;
        const size = pos?.Size ?? pos?.BoundingRectangle;
        if (!abs || !size) continue;
        const l = abs.x * ppu;
        const t = abs.y * ppu;
        const w = (size.width ?? 10) * ppu;
        const h = (size.height ?? 10) * ppu;
        minLeft = Math.min(minLeft, l);
        minTop = Math.min(minTop, t);
        maxRight = Math.max(maxRight, l + w);
        maxBottom = Math.max(maxBottom, t + h);
      }
      if (!Number.isFinite(minLeft)) return null;
      return {
        left: minLeft, top: minTop,
        width: maxRight - minLeft,
        height: maxBottom - minTop,
      };
    };

    /** 為熱圖/diff 計算所有小節的 bounding box, 以 useEffect 觸發 */
    const [overlayBoxes, setOverlayBoxes] = useState<
      Array<{ measure: number; left: number; top: number; width: number; height: number }>
    >([]);

    const recomputeOverlayBoxes = () => {
      const osmd = osmdRef.current as unknown as {
        GraphicalMusicSheet?: { MeasureList?: any[][] };
        EngravingRules?: { UnitInPixels?: number };
        zoom?: number;
      } | null;
      const measureList = osmd?.GraphicalMusicSheet?.MeasureList;
      if (!measureList?.[0]) {
        setOverlayBoxes([]);
        return;
      }
      const total = measureList[0].length;
      const unitInPixel = osmd?.EngravingRules?.UnitInPixels ?? 10;
      const zoomVal = osmd?.zoom ?? 1;
      const ppu = unitInPixel * zoomVal;
      const out: Array<{
        measure: number;
        left: number;
        top: number;
        width: number;
        height: number;
      }> = [];
      for (let i = 0; i < total; i++) {
        // union 所有 staff 的 bounding box
        let minLeft = Infinity, minTop = Infinity;
        let maxRight = -Infinity, maxBottom = -Infinity;
        let measureNum = i + 1;
        for (const staff of measureList) {
          const m: any = staff?.[i];
          const pos = m?.PositionAndShape;
          if (!pos) continue;
          const abs = pos.AbsolutePosition;
          const size = pos.Size ?? pos.BoundingRectangle ?? {};
          if (!abs) continue;
          if (m?.MeasureNumber) measureNum = m.MeasureNumber;
          const l = abs.x * ppu;
          const t = abs.y * ppu;
          const w = (size.width ?? 10) * ppu;
          const h = (size.height ?? 10) * ppu;
          minLeft = Math.min(minLeft, l);
          minTop = Math.min(minTop, t);
          maxRight = Math.max(maxRight, l + w);
          maxBottom = Math.max(maxBottom, t + h);
        }
        if (!Number.isFinite(minLeft)) continue;
        out.push({
          measure: measureNum,
          left: minLeft,
          top: minTop,
          width: maxRight - minLeft,
          height: maxBottom - minTop,
        });
      }
      setOverlayBoxes(out);
    };

    // 當 OSMD 重渲、zoom 改變、或 measureDifficulty/diffMeasures 改變時, 重算 box
    useEffect(() => {
      if (!measureDifficulty && !diffMeasures) {
        setOverlayBoxes([]);
        return;
      }
      // 稍延遲讓 OSMD 完成 render
      const t = window.setTimeout(recomputeOverlayBoxes, 50);
      return () => window.clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [measureDifficulty, diffMeasures, musicXmlContent, zoom]);

    /** 取得 measure 在 OSMD content 內的 bounding box (像素座標) */
    const getMeasureBox = (measureNumber: number): FlashBox | null => {
      const osmd = osmdRef.current as unknown as {
        GraphicalMusicSheet?: { MeasureList?: any[][] };
        EngravingRules?: { UnitInPixels?: number };
        zoom?: number;
      } | null;
      const measureList = osmd?.GraphicalMusicSheet?.MeasureList;
      if (!measureList?.[0]) return null;
      const idx = measureNumber - 1;
      if (idx < 0 || idx >= measureList[0].length) return null;
      const unitInPixel = osmd?.EngravingRules?.UnitInPixels ?? 10;
      const zoomVal = osmd?.zoom ?? 1;
      const ppu = unitInPixel * zoomVal;

      // 收集所有 staff 上同一 measure idx 的 bounding box, 取 union
      let minLeft = Infinity,
        minTop = Infinity,
        maxRight = -Infinity,
        maxBottom = -Infinity;
      for (const staff of measureList) {
        const m: any = staff?.[idx];
        const pos = m?.PositionAndShape;
        if (!pos) continue;
        const abs = pos.AbsolutePosition;
        const size = pos.Size ?? pos.BoundingRectangle ?? {};
        if (!abs) continue;
        const left = abs.x * ppu;
        const top = abs.y * ppu;
        const w = (size.width ?? 10) * ppu;
        const h = (size.height ?? 10) * ppu;
        minLeft = Math.min(minLeft, left);
        minTop = Math.min(minTop, top);
        maxRight = Math.max(maxRight, left + w);
        maxBottom = Math.max(maxBottom, top + h);
      }
      if (!Number.isFinite(minLeft)) return null;
      return {
        left: minLeft - 2,
        top: minTop - 2,
        width: maxRight - minLeft + 4,
        height: maxBottom - minTop + 4,
        key: Date.now(),
      };
    };

    // 反應 highlightedMeasure / highlightFlashTick (smooth scroll + flash 動畫)
    // 點 issue 時希望把小節捲到視窗中央 (alwaysCenter=true)
    useEffect(() => {
      if (highlightedMeasure == null) {
        setFlashBox(null);
        return;
      }
      scrollToMeasure(highlightedMeasure, "smooth", true);
      // 稍延遲讓 scroll 開始, 再計算 box
      const box = getMeasureBox(highlightedMeasure);
      if (box) {
        setFlashBox(box);
        if (flashTimerRef.current != null) {
          window.clearTimeout(flashTimerRef.current);
        }
        flashTimerRef.current = window.setTimeout(() => {
          setFlashBox(null);
          flashTimerRef.current = null;
        }, 1600);
      }
      return () => {
        if (flashTimerRef.current != null) {
          window.clearTimeout(flashTimerRef.current);
          flashTimerRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedMeasure, highlightFlashTick]);

    // 反應 playbackMeasure — 只在 *本面板是 active playback 對象時* 顯示游標.
    // 另一面板播放時, 此 panel 不顯示任何 cursor / 高亮.
    useEffect(() => {
      const cursor = (osmdRef.current as unknown as {
        cursor?: { hide: () => void };
      })?.cursor;
      if (playbackMeasure == null || !isActivePlaybackPanel) {
        cursor?.hide?.();
        clearNoteHighlights();
        return;
      }
      if (cursorMode !== "note") {
        moveCursorToMeasure(playbackMeasure);
      }
      // 播放跟隨: 用我們自己受控的 scrollToMeasure (非 OSMD 內建 follow —
      // 那個會「一播放就滾到底」, 已被三層保險擋掉)。alwaysCenter=false →
      // 只在當前小節捲出視窗時才捲, 不會每小節都猛拉; behavior=auto 即時不延遲。
      scrollToMeasure(playbackMeasure, "auto", false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playbackMeasure, cursorMode, isActivePlaybackPanel]);

    // 反應 playbackOnsetIndex — 音符級游標 (cursorMode === "note" 且本面板 active 才生效)
    useEffect(() => {
      if (cursorMode !== "note" || !isActivePlaybackPanel) {
        clearNoteHighlights();
        return;
      }
      if (playbackOnsetIndex == null || playbackOnsetIndex < 0) {
        clearNoteHighlights();
        return;
      }
      // 在 OSMD 還沒 load 完內容前不要 advance cursor (會 throw)
      if (loadedXmlRef.current !== musicXmlContent) return;
      try {
        advanceCursorToOnset(playbackOnsetIndex);
        highlightNotesAtCursor();
      } catch (e) {
        console.warn("[ScoreViewer] cursor advance failed:", e);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playbackOnsetIndex, cursorMode, isActivePlaybackPanel]);

    /**
     * 增量推進 OSMD cursor 到指定 onset step.
     * - 若 target >= currentStep: 連續 next() 不 reset (O(delta))
     * - 若 target < currentStep: reset() 再 next() target 次 (O(target))
     */
    const advanceCursorToOnset = (target: number) => {
      const osmd = osmdRef.current;
      if (!osmd) return;
      const cursor = (osmd as unknown as {
        cursor?: {
          show: () => void;
          hide: () => void;
          reset: () => void;
          next: () => void;
          iterator?: { endReached?: boolean };
          cursorOptions?: { follow?: boolean };
          cursorElement?: HTMLElement;
        };
      }).cursor;
      if (!cursor) return;
      // === 3 層保險, 讓 OSMD 完全不要自己 scroll ===
      try {
        // 1) 物件層級 follow flag
        if (cursor.cursorOptions) cursor.cursorOptions.follow = false;
        // 2) OSMD 全局 FollowCursor
        (osmd as unknown as { FollowCursor?: boolean }).FollowCursor = false;
        // 3) Nuclear: 把 cursorElement.scrollIntoView 替換成 no-op
        const el = cursor.cursorElement;
        if (el && !(el as unknown as { _siNoOp?: boolean })._siNoOp) {
          el.scrollIntoView = () => {};
          (el as unknown as { _siNoOp?: boolean })._siNoOp = true;
        }
      } catch {
        /* 不擋住主流程 */
      }

      try {
        let cur = cursorStepRef.current;
        if (target < cur || cur < 0) {
          cursor.reset();
          cur = 0;
        }
        let safety = 10000;
        while (
          cur < target
          && !(cursor.iterator?.endReached ?? false)
          && safety-- > 0
        ) {
          cursor.next();
          cur++;
        }
        cursorStepRef.current = cur;
        cursor.show();
      } catch {
        /* OSMD 跨版本可能 throw, 忽略 */
      }
    };

    /** 把 cursor 所在的音符 SVG 元素加上 highlight class */
    const highlightNotesAtCursor = () => {
      const osmd = osmdRef.current;
      if (!osmd) return;
      const cursor = (osmd as unknown as {
        cursor?: {
          NotesUnderCursor?: () => any[];
        };
      }).cursor;
      // 先清掉上輪 highlight
      clearNoteHighlights();
      if (!cursor?.NotesUnderCursor) return;
      try {
        const notes = cursor.NotesUnderCursor() ?? [];
        const newElems: Element[] = [];
        for (const n of notes) {
          // GraphicalNote.getSVGGElement?() / SVGGElement / getSVGElement
          const el: Element | null =
            n?.getSVGGElement?.() ?? n?.SVGGElement
              ?? n?.getSVGElement?.() ?? null;
          if (el && el instanceof Element) {
            el.classList.add("score-note-playing");
            newElems.push(el);
          }
        }
        highlightedNotesRef.current = newElems;
      } catch {
        /* ignore */
      }
    };

    const clearNoteHighlights = () => {
      for (const el of highlightedNotesRef.current) {
        el.classList.remove("score-note-playing");
      }
      highlightedNotesRef.current = [];
    };

    // OSMD 重新 load 時, cursor step 歸零
    useEffect(() => {
      cursorStepRef.current = -1;
      clearNoteHighlights();
    }, [musicXmlContent]);

    /** 點擊 OSMD 容器 → 透過 MeasureList 的 bounding box 找出對應小節。
     *
     * 真實版: 遍歷每個 measure 的 PositionAndShape, 比較點擊座標。
     * Fallback: 若找不到 OSMD 內部物件, 退回比例估算。
     */
    /** 在 OSMD 上 mousedown 時記錄起點; 若 onNoteDrag 設定才啟動 drag 流程 */
    const handleOsmdMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onNoteDrag || !osmdRef.current) return;
      const hint = computeMeasureAndPitch(e);
      if (!hint) return;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        measure: hint.measure,
        approxPitch: hint.approxPitch,
      };
    };

    const handleOsmdMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const start = dragStartRef.current;
      if (!start || !onNoteDrag) return;
      const dy = start.y - e.clientY;  // 向上拉為正
      // 每 14 px = 1 半音
      const semitones = Math.round(dy / 14);
      if (Math.abs(semitones) >= 1) {
        setDragGhost({ x: e.clientX, y: e.clientY, semitones });
      } else {
        setDragGhost(null);
      }
    };

    const handleOsmdMouseUp = () => {
      const start = dragStartRef.current;
      const ghost = dragGhost;
      dragStartRef.current = null;
      setDragGhost(null);
      if (start && ghost && Math.abs(ghost.semitones) >= 1 && onNoteDrag) {
        onNoteDrag(start.measure, start.approxPitch, ghost.semitones);
      }
    };

    /** 計算點擊位置對應的 measure number + approxPitch (與 click 邏輯一致) */
    const computeMeasureAndPitch = (
      e: React.MouseEvent<HTMLDivElement>,
    ): { measure: number; approxPitch: number } | null => {
      const osmd = osmdRef.current as unknown as {
        GraphicalMusicSheet?: { MeasureList?: any[][] };
        EngravingRules?: { UnitInPixels?: number };
        zoom?: number;
      } | null;
      const measureList = osmd?.GraphicalMusicSheet?.MeasureList;
      const osmdEl = osmdContainerRef.current;
      if (!measureList?.[0] || !osmdEl) return null;
      const r = osmdEl.getBoundingClientRect();
      const relX = e.clientX - r.left;
      const relY = e.clientY - r.top;
      const unitInPixel = osmd?.EngravingRules?.UnitInPixels ?? 10;
      const zoomVal = osmd?.zoom ?? 1;
      const ppu = unitInPixel * zoomVal;
      const staff0 = measureList[0];
      for (let i = 0; i < staff0.length; i++) {
        const m: any = staff0[i];
        const pos = m?.PositionAndShape;
        const abs = pos?.AbsolutePosition;
        const size = pos?.Size ?? pos?.BoundingRectangle;
        if (!abs || !size) continue;
        const left = abs.x * ppu;
        const top = abs.y * ppu;
        const w = (size.width ?? 10) * ppu;
        const h = (size.height ?? 10) * ppu;
        if (relX >= left && relX <= left + w
            && relY >= top && relY <= top + h) {
          const num = m?.MeasureNumber ?? (i + 1);
          const ratio = h > 0
            ? Math.max(0, Math.min(1, (relY - top) / h))
            : 0.5;
          const approxPitch = Math.round(84 - ratio * 48);  // C6 → C2
          return { measure: num, approxPitch };
        }
      }
      return null;
    };

    const handleOsmdClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // 若這次點擊是一次有效拖曳 → 不再 trigger click (drag handler 處理過)
      if (dragGhost && Math.abs(dragGhost.semitones) >= 1) return;
      if (!onMeasureClick || !osmdRef.current || !containerRef.current) return;
      const osmd = osmdRef.current as unknown as {
        GraphicalMusicSheet?: { MeasureList?: any[][] };
        EngravingRules?: { UnitInPixels?: number };
        zoom?: number;
      };
      const measureList = osmd.GraphicalMusicSheet?.MeasureList;
      if (!measureList?.[0]) return;
      const total = measureList[0].length;
      if (total === 0) return;

      const osmdEl = osmdContainerRef.current;
      if (!osmdEl) return;
      const osmdRect = osmdEl.getBoundingClientRect();
      // getBoundingClientRect 的 top/left 已是「考慮捲動後」的視窗座標,
      // clientX/Y - rect.left/top 給的是「相對於 OSMD content 內部」的座標,
      // 在水平或垂直捲動下仍正確 (osmd content 是 inner div, 不自捲動)。
      const relX = e.clientX - osmdRect.left;
      const relY = e.clientY - osmdRect.top;

      // 嘗試從 OSMD 取得 unit-to-pixel 倍率
      const unitInPixel = osmd.EngravingRules?.UnitInPixels ?? 10;
      const zoom = osmd.zoom ?? 1;
      const pixelPerUnit = unitInPixel * zoom;

      // 找到最近的 measure: 用 staff 0 (最上方聲部), 比對 x/y bounding box
      const staff0 = measureList[0];
      const candidates: Array<{ idx: number; distance: number }> = [];
      for (let i = 0; i < staff0.length; i++) {
        const m: any = staff0[i];
        const pos = m?.PositionAndShape;
        if (!pos) continue;
        const abs = pos.AbsolutePosition;
        const size = pos.Size ?? pos.BoundingRectangle ?? {};
        if (!abs) continue;
        const left = abs.x * pixelPerUnit;
        const top = abs.y * pixelPerUnit;
        const w = (size.width ?? 10) * pixelPerUnit;
        const h = (size.height ?? 10) * pixelPerUnit;
        // 在 bounding box 內 → 直接命中
        if (
          relX >= left && relX <= left + w
          && relY >= top && relY <= top + h
        ) {
          // 用 measure.MeasureNumber 若存在,否則 idx+1
          const num = m?.MeasureNumber ?? (i + 1);
          // 估算 y → MIDI pitch (top=高音, bottom=低音); 直接線性映 C6..C2
          const pitchTop = 84;     // C6
          const pitchBottom = 36;  // C2
          const ratio = h > 0
            ? Math.max(0, Math.min(1, (relY - top) / h))
            : 0.5;
          const approxPitch = Math.round(
            pitchTop - ratio * (pitchTop - pitchBottom),
          );
          onMeasureClick(num, { approxPitch });
          return;
        }
        // 不在內: 記錄最近距離 (歐式)
        const cx = left + w / 2;
        const cy = top + h / 2;
        candidates.push({
          idx: i,
          distance: Math.hypot(relX - cx, relY - cy),
        });
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.distance - b.distance);
        const closest = candidates[0];
        const m: any = staff0[closest.idx];
        const num = m?.MeasureNumber ?? (closest.idx + 1);
        onMeasureClick(num);
        return;
      }

      // Fallback: 比例估算
      if (osmdRect.height <= 0) return;
      const ratio = Math.max(0, Math.min(1, relY / osmdRect.height));
      const measure = Math.min(
        total, Math.max(1, Math.floor(ratio * total) + 1),
      );
      onMeasureClick(measure);
    };

    /** 把 OSMD 的 cursor 移到指定小節 (1-based)。 */
    const moveCursorToMeasure = (measureNumber: number) => {
      const osmd = osmdRef.current;
      if (!osmd) return;
      const cursor = (osmd as unknown as {
        cursor?: {
          show: () => void;
          hide: () => void;
          reset: () => void;
          next: () => void;
          iterator?: {
            currentMeasureIndex?: number;
            endReached?: boolean;
          };
        };
      }).cursor;
      if (!cursor) return;

      const targetIdx = measureNumber - 1;
      try {
        // 若目標位於目前 cursor 之前, 從頭重置
        if (targetIdx < cursorMeasureIdxRef.current) {
          cursor.reset();
          cursorMeasureIdxRef.current = 0;
        }
        // 步進至目標 (上限避免極長作品死循環)
        let safety = 5000;
        while (
          cursor.iterator
          && (cursor.iterator.currentMeasureIndex ?? 0) < targetIdx
          && !(cursor.iterator.endReached ?? false)
          && safety-- > 0
        ) {
          cursor.next();
        }
        cursorMeasureIdxRef.current =
          cursor.iterator?.currentMeasureIndex ?? targetIdx;
        cursor.show();
      } catch {
        /* 跨 OSMD 版本可能失敗,忽略 */
      }
    };

    const osmdBg =
      theme === "dark"
        ? DARK_COLORS.pageBackgroundColor
        : LIGHT_COLORS.pageBackgroundColor;

    return (
      <div
        ref={containerRef}
        style={{
          position: "relative",
          height: "100%",
          // ribbon 模式: 主要為水平捲動 (但仍允許垂直, 因為標籤/多 staff 可能超出)
          overflowX: isRibbon ? "auto" : "auto",
          overflowY: isRibbon ? "auto" : "auto",
          background: osmdBg,
          // ribbon 時要禁止 OSMD wrap → 容器寬度交給 inner 自由延伸
        }}
      >
        {label && (
          <div
            style={{
              position: "sticky",
              top: 0,
              background: "var(--bg-panel-translucent)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              padding: "4px 12px",
              fontSize: 12,
              color: "var(--fg-muted)",
              borderBottom: "1px solid var(--border)",
              zIndex: 1,
            }}
          >
            {label}
            {playbackMeasure != null && (
              <span style={{ marginLeft: 8, color: "var(--accent)" }}>
                ▶ m.{playbackMeasure}
              </span>
            )}
            {playbackMeasure == null && highlightedMeasure != null && (
              <span style={{ marginLeft: 8, color: "var(--accent)" }}>
                → m.{highlightedMeasure}
              </span>
            )}
          </div>
        )}
        {!musicXmlContent && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--fg-tertiary)",
              minHeight: 200,
            }}
          >
            (尚未載入樂譜)
          </div>
        )}
        {error && (
          <div style={{ padding: 16, color: "var(--error-fg)" }}>
            {error}
          </div>
        )}
        <div
          ref={osmdContainerRef}
          onClick={handleOsmdClick}
          onMouseDown={handleOsmdMouseDown}
          onMouseMove={handleOsmdMouseMove}
          onMouseUp={handleOsmdMouseUp}
          onMouseLeave={handleOsmdMouseUp}
          style={{
            minHeight: 400,
            padding: 16,
            background: osmdBg,
            cursor: onMeasureClick ? "pointer" : "default",
            position: "relative",
            userSelect: "none",
          }}
        >
          {flashBox && (
            <div
              key={flashBox.key}
              className="score-flash-overlay"
              style={{
                position: "absolute",
                left: flashBox.left,
                top: flashBox.top,
                width: flashBox.width,
                height: flashBox.height,
                pointerEvents: "none",
                borderRadius: 4,
                zIndex: 2,
              }}
            />
          )}
          {overlayBoxes.map((b) => {
            const diffHit = diffMeasures?.has(b.measure) ?? false;
            const diffBorder = "2px solid rgba(124, 92, 255, 0.6)";

            const score = measureDifficulty?.get(b.measure);
            let heatColor: string | null = null;
            if (score != null) {
              // 1 = 綠, 3 = 黃, 5 = 紅
              const t = Math.max(0, Math.min(1, (score - 1) / 4));
              const hue = 120 - 120 * t;
              heatColor = `hsla(${hue}, 78%, 50%, ${0.10 + 0.20 * t})`;
            }
            return (
              <div
                key={`overlay-${b.measure}`}
                style={{
                  position: "absolute",
                  left: b.left,
                  top: b.top,
                  width: b.width,
                  height: b.height,
                  pointerEvents: "none",
                  borderRadius: 3,
                  background: heatColor ?? "transparent",
                  border: diffHit ? diffBorder : "none",
                  boxShadow: diffHit
                    ? "0 0 0 2px rgba(124, 92, 255, 0.25) inset"
                    : undefined,
                  zIndex: 1,
                  mixBlendMode: heatColor ? "multiply" as const : undefined,
                }}
                title={
                  score != null
                    ? `m.${b.measure} — 難度 ${score.toFixed(1)}/5`
                    : diffHit
                    ? `m.${b.measure} — 與另一版本不同`
                    : undefined
                }
              />
            );
          })}
        </div>
        {dragGhost && (
          <div
            style={{
              position: "fixed",
              left: dragGhost.x + 12,
              top: dragGhost.y - 28,
              padding: "4px 10px",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              pointerEvents: "none",
              zIndex: 100,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {dragGhost.semitones > 0 ? "↑" : "↓"}{" "}
            {Math.abs(dragGhost.semitones)} 半音
          </div>
        )}
      </div>
    );
  },
);

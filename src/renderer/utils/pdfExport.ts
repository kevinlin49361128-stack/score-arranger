/**
 * PDF 匯出 — 透過 verovio 把 MusicXML 渲染為 SVG, 再用 jsPDF 包成 PDF
 *
 * 流程:
 * 1. 用 verovio/wasm 載入 WASM 模組
 * 2. 用 verovio/esm 的 VerovioToolkit class 包住 wasm module
 * 3. loadData(musicxml) → renderToSVG(pageNum) → 嵌入 jsPDF
 *
 * verovio 6.x 把 API 拆兩部分 (module + toolkit class), 必須兩個都載。
 */

import jsPDF from "jspdf";
import { t } from "./i18n";

/** 匯出 PDF 每頁頁尾的版本 / 版權宣告。 */
const EXPORT_FOOTER =
  "Arranged with Score Arranger 0.1.19  ·  © 2026 Kevin Lin  ·  GPL-3.0";

interface VerovioToolkitLike {
  loadData: (xml: string) => boolean;
  renderToSVG: (pageNum: number) => string;
  getPageCount: () => number;
  setOptions: (opts: Record<string, unknown>) => void;
  destroy?: () => void;
}

// 整個 renderer lifetime 共用一個 toolkit (避免重複載入 7MB WASM)
let _cachedToolkit: VerovioToolkitLike | null = null;
let _loading: Promise<VerovioToolkitLike> | null = null;

async function loadVerovio(): Promise<VerovioToolkitLike> {
  if (_cachedToolkit) return _cachedToolkit;
  if (_loading) return _loading;

  _loading = (async () => {
    // verovio 6.x: 兩步驟
    //   1. 載 WASM module factory
    //   2. 把 module 傳給 VerovioToolkit constructor
    const wasmMod: any = await import("verovio/wasm");
    const esmMod: any = await import("verovio/esm");
    const createVerovioModule = wasmMod.default ?? wasmMod;
    const VerovioToolkit = esmMod.VerovioToolkit ?? esmMod.default
      ?? esmMod.toolkit;
    if (typeof createVerovioModule !== "function") {
      throw new Error(t("pdfExport.error.noWasmExport"));
    }
    if (typeof VerovioToolkit !== "function") {
      throw new Error(t("pdfExport.error.noToolkitClass"));
    }
    const VerovioModule = await createVerovioModule();
    const tk = new VerovioToolkit(VerovioModule) as VerovioToolkitLike;
    _cachedToolkit = tk;
    return tk;
  })();
  return _loading;
}

export async function exportPdfFromMusicXML(
  musicxml: string,
  filename: string = "score.pdf",
): Promise<void> {
  const tk = await loadVerovio();
  // setOptions 必須在 loadData 前; 每次重設, 避免上次的 page 設定殘留
  try {
    tk.setOptions?.({
      pageWidth: 2100,
      pageHeight: 2970,
      pageMarginLeft: 100,
      pageMarginRight: 100,
      pageMarginTop: 100,
      pageMarginBottom: 100,
      scale: 40,
      // verovio 預設 footer 會印 "MEI engraved with Verovio" 自我宣傳;
      // 用 "encoded" 表示只有 MEI 內顯式指定的才顯示, 不自動加。
      // header 保持 auto, 讓標題/作曲家/改編者 (Arranged with Score Arranger)
      // 從 metadata 自動渲染到頁首右上角。
      footer: "encoded",
      header: "auto",
    });
  } catch {
    /* ignore */
  }

  const ok = tk.loadData(musicxml);
  if (ok === false) {
    throw new Error(t("pdfExport.error.parseFailed"));
  }
  // 連續多次 loadData 後, getPageCount 偶爾回 0 (verovio 內部 redoLayout 未觸發);
  // 顯式重新計算 pages
  const pageCount = Math.max(1, tk.getPageCount?.() ?? 1);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let p = 1; p <= pageCount; p++) {
    const svg = tk.renderToSVG(p);
    if (!svg) continue;
    const imgDataUrl = await svgToPngDataUrl(svg, pageW, pageH);
    if (p > 1) pdf.addPage();
    pdf.addImage(imgDataUrl, "PNG", 0, 0, pageW, pageH);
    // 版本 / 版權頁尾 — 置中淺灰小字, 落在 verovio 底部留白內
    pdf.setFontSize(7);
    pdf.setTextColor(150);
    pdf.text(EXPORT_FOOTER, pageW / 2, pageH - 14, { align: "center" });
  }

  // 顯式 Blob 下載 — 比 pdf.save() 的內建 saveAs 對「連續多個下載」更穩
  // (Chrome / Electron 對 jsPDF.save 連續呼叫偶爾會吃掉第二個 click event)
  const blob = pdf.output("blob");
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

async function svgToPngDataUrl(
  svg: string,
  widthPt: number,
  heightPt: number,
): Promise<string> {
  // 把 SVG 轉成 dataURL → 載入 Image → 畫到 Canvas → toDataURL("image/png")
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(e);
      i.src = url;
    });
    // 用較高 DPI 渲染避免模糊
    const dpi = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(widthPt * dpi);
    canvas.height = Math.round(heightPt * dpi);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t("pdfExport.error.no2dContext"));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

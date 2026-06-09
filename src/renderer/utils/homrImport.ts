/**
 * homrImport — homr 引擎的 PDF 匯入流程 (PDF → 影像 → homr → MusicXML)。
 *
 * homr 吃單頁影像、不吃 PDF, 所以在 renderer 用 pdf.js 把 PDF 各頁 render 成
 * canvas, 垂直拼成一張長圖 (讓 homr 連續讀各系統, 免去多頁 MusicXML 合併),
 * 經 IPC 寫成暫存 PNG, 再交 homr 辨識。純 JS rasterize, 無原生依賴。
 */
import * as pdfjsLib from "pdfjs-dist";
// Vite ?url import — 取得 pdf.js worker 的可載入 URL
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// 上限: 太多頁拼成的長圖會吃記憶體; 先處理前 N 頁 (一般鋼琴譜足夠)。
const MAX_PAGES = 8;
const RENDER_SCALE = 2.0;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pdfToStitchedPngBase64(pdfBase64: string): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: base64ToBytes(pdfBase64) })
    .promise;
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  const pages: HTMLCanvasElement[] = [];
  let totalHeight = 0;
  let maxWidth = 0;

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("無法建立 canvas 2d context");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    pages.push(canvas);
    totalHeight += canvas.height;
    maxWidth = Math.max(maxWidth, canvas.width);
  }

  const out = document.createElement("canvas");
  out.width = maxWidth;
  out.height = totalHeight;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("無法建立輸出 canvas context");
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, out.width, out.height);
  let y = 0;
  for (const c of pages) {
    octx.drawImage(c, 0, y);
    y += c.height;
  }
  return out.toDataURL("image/png").split(",")[1];
}

/** 用 homr 把 PDF 轉成 MusicXML, 回傳產出檔路徑 (與 pdfToMusicXML/Audiveris 同介面)。 */
export async function homrPdfToMusicXML(pdfPath: string): Promise<string> {
  const eng = window.scoreArranger.engine;
  const pdfRes = await eng.readPdfBase64(pdfPath);
  if (!pdfRes.ok || !pdfRes.data) {
    throw new Error(pdfRes.error ?? "讀取 PDF 失敗");
  }
  const pngBase64 = await pdfToStitchedPngBase64(pdfRes.data);
  const imgRes = await eng.writeTempImage(pngBase64);
  if (!imgRes.ok || !imgRes.data) {
    throw new Error(imgRes.error ?? "寫入暫存影像失敗");
  }
  const omrRes = await eng.homrImageToMusicXML(imgRes.data);
  if (!omrRes.ok || !omrRes.data) {
    throw new Error(omrRes.error ?? "homr 辨識失敗");
  }
  return omrRes.data.musicxml_path;
}

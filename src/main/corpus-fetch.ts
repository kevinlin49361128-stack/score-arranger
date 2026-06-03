/**
 * B1 線上曲庫層 — 主程序端 (Electron)
 *
 * 設計 (見 docs/b1-online-corpus-decision.html):
 *   - 曲庫 = 綁定核心 329 首 (離線保底) + 線上擴充包 (隨需下載 + 本地快取)。
 *   - host: GitHub Releases assets, 專屬 `corpus-v1` release (catalog.json + .mxl)。
 *   - 誰下載: 主程序下載 → 驗 sha256 → 存 userData/corpus_cache → 引擎只讀本地檔。
 *   - 快取: 上限 500MB, LRU (依 mtime) 淘汰。
 *
 * 安全基線:
 *   - 只接受 github.com/<owner>/<repo>/releases/download/... 起頭的 URL
 *     (302 會被導到 GitHub 自家 CDN, net.fetch 跟 redirect, 終點仍 GitHub 控管)。
 *   - 每檔下載後驗 sha256; 單檔大小上限; 全走 HTTPS。
 *   - 引擎完全不碰網路 (此模組只在主程序)。
 */

import { app, net } from "electron";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const OWNER = "kevinlin49361128-stack";
const REPO = "score-arranger";
const CORPUS_TAG = "corpus-v1";
const RELEASE_BASE =
  `https://github.com/${OWNER}/${REPO}/releases/download/${CORPUS_TAG}`;
const MANIFEST_URL = `${RELEASE_BASE}/catalog.json`;

/** 只允許從本 repo 的 corpus release 下載 (redirect 終點由 GitHub 控管)。 */
const ALLOWED_URL_PREFIX =
  `https://github.com/${OWNER}/${REPO}/releases/download/`;

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 單檔上限 8MB (.mxl 一般 <200KB)
const CACHE_CAP_BYTES = 500 * 1024 * 1024; // 500MB LRU
const MANIFEST_TTL_MS = 6 * 60 * 60 * 1000; // manifest 記憶體快取 6h

export interface RemoteCorpusEntry {
  corpus_path: string;
  title: string;
  composer: string;
  composer_dates: string;
  era: string;
  form: string;
  ensemble: string;
  instruments: string[];
  year: number;
  measures?: number;
  grade?: number;
  henle_level?: number;
  tags: string[];
  popular_tags?: string[];
  /** 下載來源 (主程序用; 不需傳給 renderer 顯示) */
  url: string;
  sha256: string;
  bytes: number;
}

interface Manifest {
  version: string;
  entries: RemoteCorpusEntry[];
}

let manifestMemo: { at: number; data: Manifest } | null = null;

function cacheDir(): string {
  const dir = join(app.getPath("userData"), "corpus_cache");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function manifestDiskPath(): string {
  return join(cacheDir(), "_catalog.json");
}

/** 從下載 URL 推副檔名 — 引擎用副檔名選 parser, 必須與內容一致。 */
function extFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.endsWith(".mxl")) return ".mxl"; // 壓縮 MusicXML (zip)
  if (u.endsWith(".xml")) return ".xml";
  return ".musicxml"; // 未壓縮 MusicXML
}

/** corpus_path → 安全的本地檔名 (避免路徑穿越); 副檔名隨內容。 */
function cacheFileName(corpusPath: string, ext: string): string {
  return `${corpusPath.replace(/[^a-zA-Z0-9._-]/g, "_")}${ext}`;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function httpGetBuffer(url: string, maxBytes: number): Promise<Buffer> {
  if (!url.startsWith(ALLOWED_URL_PREFIX)) {
    throw new Error(`不允許的下載來源: ${url}`);
  }
  const res = await net.fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`下載失敗 HTTP ${res.status}`);
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared && declared > maxBytes) {
    throw new Error(`檔案過大 (${declared} bytes > ${maxBytes})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) {
    throw new Error(`檔案過大 (${buf.length} bytes > ${maxBytes})`);
  }
  return buf;
}

/**
 * 取得遠端 manifest。
 * 記憶體快取 (6h) → 線上抓 → 持久化到磁碟。線上失敗時退回磁碟快取 (離線降級)。
 */
export async function getManifest(force = false): Promise<Manifest> {
  if (!force && manifestMemo &&
    Date.now() - manifestMemo.at < MANIFEST_TTL_MS) {
    return manifestMemo.data;
  }
  try {
    const buf = await httpGetBuffer(MANIFEST_URL, 4 * 1024 * 1024);
    const data = JSON.parse(buf.toString("utf-8")) as Manifest;
    if (!data || !Array.isArray(data.entries)) {
      throw new Error("manifest 格式錯誤");
    }
    manifestMemo = { at: Date.now(), data };
    try {
      writeFileSync(manifestDiskPath(), buf);
    } catch {
      /* 寫快取失敗不致命 */
    }
    return data;
  } catch (e) {
    // 離線降級: 退回磁碟上的舊 manifest
    try {
      const disk = readFileSync(manifestDiskPath(), "utf-8");
      const data = JSON.parse(disk) as Manifest;
      manifestMemo = { at: Date.now(), data };
      return data;
    } catch {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }
}

/** 給 renderer 的清單 (去掉 url/sha256, 只留顯示用 metadata)。 */
export async function listRemote(): Promise<
  Omit<RemoteCorpusEntry, "url" | "sha256" | "bytes">[]
> {
  try {
    const m = await getManifest();
    return m.entries.map(({ url: _u, sha256: _s, bytes: _b, ...rest }) => rest);
  } catch {
    return []; // 離線 / 無 manifest → 不顯示雲端曲, 不報錯
  }
}

/** 依 mtime LRU 清快取, 壓在 CACHE_CAP_BYTES 以下。 */
function pruneCache(): void {
  try {
    const dir = cacheDir();
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".mxl"))
      .map((f) => {
        const p = join(dir, f);
        const st = statSync(p);
        return { p, size: st.size, mtime: st.mtimeMs };
      });
    let total = files.reduce((a, f) => a + f.size, 0);
    if (total <= CACHE_CAP_BYTES) return;
    files.sort((a, b) => a.mtime - b.mtime); // 最舊先刪
    for (const f of files) {
      if (total <= CACHE_CAP_BYTES) break;
      try {
        unlinkSync(f.p);
        total -= f.size;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * 解析一首雲端曲 → 回傳本地 .mxl 路徑 (下載 + 驗證 + 快取)。
 * 命中快取且 sha256 相符則直接回傳並更新 mtime (LRU)。
 */
export async function resolveRemote(corpusPath: string): Promise<string> {
  const m = await getManifest();
  const entry = m.entries.find((e) => e.corpus_path === corpusPath);
  if (!entry) throw new Error(`曲庫無此項: ${corpusPath}`);

  const dest = join(cacheDir(), cacheFileName(corpusPath, extFromUrl(entry.url)));

  // 命中快取 + 完整性符合 → 直接用 (touch mtime 讓 LRU 保新)
  try {
    const cached = readFileSync(dest);
    if (sha256(cached) === entry.sha256) {
      const now = new Date();
      try {
        writeFileSync(dest, cached); // 重寫以更新 mtime (跨平台最穩)
      } catch {
        /* ignore */
      }
      void now;
      return dest;
    }
  } catch {
    /* 沒快取 → 往下下載 */
  }

  const buf = await httpGetBuffer(entry.url, MAX_FILE_BYTES);
  const got = sha256(buf);
  if (got !== entry.sha256) {
    throw new Error(`完整性驗證失敗 (${corpusPath}): sha256 不符`);
  }
  writeFileSync(dest, buf);
  pruneCache();
  return dest;
}

/** 清空本地下載快取 (給「清除已下載曲庫」用)。回傳清掉的位元組數。 */
export function clearCache(): number {
  let freed = 0;
  try {
    const dir = cacheDir();
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".mxl")) continue;
      const p = join(dir, f);
      try {
        freed += statSync(p).size;
        unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return freed;
}

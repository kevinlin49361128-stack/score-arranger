#!/usr/bin/env node
/**
 * vsco-pipeline — VSCO-2 CE (CC0) 弦樂取樣 manifest 生成 + 逐音符響度量測。
 *
 * 取代 engine/scripts/build_vsco2_manifest.py (那版只列 URL 不量電平 —
 * 0.1.110-113 的平衡連環回歸根因就是「沒量就上線」)。本管線:
 *
 *   1. 枚舉 GitHub repo tree → violin/viola/cello × sustain/pizz/staccato/tremolo
 *      × soft/loud (velocity 極值兩層)
 *   2. 全部下載到 .cache/ (一次性, ~數百 MB)
 *   3. 逐檔解碼 WAV → 量 loudest-1s RMS (dBFS)
 *   4. 每層取中位數 → gainDb = TARGET − median (播放端套用 → 各層互相對齊)
 *   5. 產出 src/renderer/data/vsco2Manifest.ts (音名已 +1 八度校正成 concert
 *      pitch — VSCO 弦樂組標籤比實音低一個八度) + .report.json (離群值清單)
 *
 * 用法: node scripts/vsco-pipeline/build.mjs   (重跑即更新; 下載有快取)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const CACHE = join(HERE, ".cache");
const OUT_TS = join(ROOT, "src/renderer/data/vsco2Manifest.ts");
const OUT_REPORT = join(HERE, ".report.json");

const REPO = "sgossner/VSCO-2-CE";
const REF = "master";
const JSDELIVR = `https://cdn.jsdelivr.net/gh/${REPO}@${REF}/`;
const TARGET_DB = -20; // 每層 median 對齊到此 (任意基準; 播放端再加 per-family trim)
const CONCURRENCY = 8;

// 樂器 → [section 資料夾, {本地 articulation key: VSCO2 子資料夾名}]
const INSTRUMENTS = {
  violin: ["Strings/Violin Section", {
    sustain: "susVib", pizz: "Pizz", staccato: "Spic", tremolo: "Trem",
  }],
  viola: ["Strings/Viola Section", {
    sustain: "susvib", pizz: "pizz", staccato: "spic", tremolo: "trem",
  }],
  cello: ["Strings/Cello Section", {
    sustain: "susvib", pizz: "pizzT", staccato: "spic", tremolo: "trem",
  }],
};

const NOTE_RE = /_([A-G][#b]?)(\d)_/;
const VEL_RE = /_v(\d)/;

function shiftOctave(note, delta) {
  const m = note.match(/^([A-G][#b]?)(\d)$/);
  return m ? `${m[1]}${Number.parseInt(m[2], 10) + delta}` : note;
}

// ---------- WAV 解碼 (PCM 16/24/32 int + 32f, 含 WAVE_FORMAT_EXTENSIBLE) ----------
function decodeWav(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("not RIFF");
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      fmt = {
        tag: buf.readUInt16LE(pos + 8),
        channels: buf.readUInt16LE(pos + 10),
        sampleRate: buf.readUInt32LE(pos + 12),
        bits: buf.readUInt16LE(pos + 22),
      };
      // EXTENSIBLE: 真正的格式在 subformat GUID 前 2 bytes
      if (fmt.tag === 0xfffe && size >= 40) {
        fmt.tag = buf.readUInt16LE(pos + 8 + 24);
      }
    } else if (id === "data") {
      data = buf.subarray(pos + 8, pos + 8 + size);
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("missing fmt/data chunk");
  const { tag, channels, sampleRate, bits } = fmt;
  const bytesPer = bits / 8;
  const frames = Math.floor(data.length / (bytesPer * channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const off = (i * channels + c) * bytesPer;
      let v;
      if (tag === 3 && bits === 32) v = data.readFloatLE(off);
      else if (bits === 16) v = data.readInt16LE(off) / 32768;
      else if (bits === 24) {
        const b0 = data[off];
        const b1 = data[off + 1];
        const b2 = data[off + 2];
        let x = b0 | (b1 << 8) | (b2 << 16);
        if (x & 0x800000) x -= 0x1000000;
        v = x / 8388608;
      } else if (bits === 32) v = data.readInt32LE(off) / 2147483648;
      else throw new Error(`unsupported: tag=${tag} bits=${bits}`);
      acc += v;
    }
    mono[i] = acc / channels;
  }
  return { pcm: mono, sampleRate };
}

function peak1sRmsDb(pcm, sampleRate) {
  const win = sampleRate;
  const step = Math.floor(win / 2);
  let best = 0;
  for (let i = 0; i + win <= pcm.length; i += step) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += pcm[j] * pcm[j];
    const r = Math.sqrt(s / win);
    if (r > best) best = r;
  }
  if (best === 0 && pcm.length > 0) {
    let s = 0;
    for (const x of pcm) s += x * x;
    best = Math.sqrt(s / pcm.length);
  }
  return best > 0 ? 20 * Math.log10(best) : -Infinity;
}

// ---------- 下載 (快取 + 併發) ----------
async function download(path) {
  const local = join(CACHE, path.replaceAll("/", "__"));
  if (existsSync(local)) return readFileSync(local);
  const url = JSDELIVR + path.split("/").map(encodeURIComponent).join("/");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(local, buf);
      return buf;
    } catch (e) {
      if (attempt === 3) throw new Error(`${path}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------- main ----------
async function main() {
  mkdirSync(CACHE, { recursive: true });
  console.log("vsco-pipeline: 抓 repo tree…");
  const treeRes = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${REF}?recursive=1`,
    { headers: { "User-Agent": "score-arranger" } },
  );
  const tree = (await treeRes.json()).tree
    .map((n) => n.path)
    .filter((p) => p.endsWith(".wav"));

  // 枚舉 → (inst, artic) → note → {vel: path}
  const plan = {}; // inst → artic → {soft: {note: path}, loud: {note: path}}
  for (const [inst, [section, artics]] of Object.entries(INSTRUMENTS)) {
    plan[inst] = {};
    for (const [articKey, folder] of Object.entries(artics)) {
      const prefix = `${section}/${folder}/`;
      const byNote = new Map();
      const velsSeen = new Set();
      for (const p of tree.filter((x) => x.startsWith(prefix)).sort()) {
        const name = p.slice(prefix.length);
        const nm = name.match(NOTE_RE);
        const vm = name.match(VEL_RE);
        if (!nm || !vm) continue;
        const note = `${nm[1]}${nm[2]}`;
        const vel = Number.parseInt(vm[1], 10);
        velsSeen.add(vel);
        if (!byNote.has(note)) byNote.set(note, new Map());
        if (!byNote.get(note).has(vel)) byNote.get(note).set(vel, p);
      }
      if (byNote.size === 0) {
        console.warn(`  ! ${inst}/${articKey}: 無檔案 (${folder})`);
        continue;
      }
      const vels = [...velsSeen].sort((a, b) => a - b);
      const softV = vels[0];
      const loudV = vels[vels.length - 1];
      const layers = { soft: {}, loud: {} };
      for (const [note, vmap] of byNote) {
        if (vmap.has(softV)) layers.soft[note] = vmap.get(softV);
        const loudPath = vmap.get(loudV) ?? vmap.get(softV);
        if (loudPath) layers.loud[note] = loudPath;
      }
      plan[inst][articKey] = layers;
      console.log(
        `  ${inst}/${articKey}: ${Object.keys(layers.soft).length} notes (v${softV}/v${loudV})`,
      );
    }
  }

  // 下載 + 量測 (全部去重後併發)
  const allPaths = new Set();
  for (const artics of Object.values(plan))
    for (const layers of Object.values(artics))
      for (const layer of Object.values(layers))
        for (const p of Object.values(layer)) allPaths.add(p);
  const paths = [...allPaths];
  console.log(`vsco-pipeline: 下載+量測 ${paths.length} 檔 (併發 ${CONCURRENCY})…`);
  const levels = new Map();
  let done = 0;
  await mapLimit(paths, CONCURRENCY, async (p) => {
    const buf = await download(p);
    const { pcm, sampleRate } = decodeWav(buf);
    levels.set(p, peak1sRmsDb(pcm, sampleRate));
    done++;
    if (done % 50 === 0) console.log(`  …${done}/${paths.length}`);
  });

  // 每層 gainDb (median 對齊 TARGET) + 離群值報告
  const manifest = {};
  const report = { target_db: TARGET_DB, layers: {} };
  for (const [inst, artics] of Object.entries(plan)) {
    manifest[inst] = {};
    for (const [articKey, layers] of Object.entries(artics)) {
      const entry = {};
      for (const [layerKey, notes] of Object.entries(layers)) {
        const dbs = Object.values(notes).map((p) => levels.get(p)).sort((a, b) => a - b);
        const median = dbs[Math.floor(dbs.length / 2)];
        const gainDb = +(TARGET_DB - median).toFixed(1);
        const outliers = Object.entries(notes)
          .filter(([, p]) => Math.abs(levels.get(p) - median) > 6)
          .map(([n, p]) => `${n}=${levels.get(p).toFixed(1)}dB`);
        report.layers[`${inst}/${articKey}/${layerKey}`] = {
          median: +median.toFixed(1),
          gainDb,
          spread: `${dbs[0].toFixed(1)}..${dbs[dbs.length - 1].toFixed(1)}`,
          outliers,
        };
        // 音名 +1 八度 → concert pitch (VSCO 弦樂組標籤低一個八度)
        const urls = {};
        for (const [note, p] of Object.entries(notes)) {
          urls[shiftOctave(note, 1)] =
            JSDELIVR + p.split("/").map(encodeURIComponent).join("/");
        }
        entry[layerKey] = { gainDb, urls };
      }
      manifest[inst][articKey] = entry;
    }
  }

  const body = JSON.stringify(manifest, null, 2);
  const ts = `// AUTO-GENERATED by scripts/vsco-pipeline/build.mjs — do not edit.
// VSCO2 Community Edition (CC0) 弦樂多 articulation 取樣, jsDelivr CDN 懶載入。
// instrument → articulation(sustain/pizz/staccato/tremolo) → layer(soft/loud)
// → { gainDb, urls }。
//   - gainDb: 逐音符量測 loudest-1s RMS 後, 將該層 median 對齊 ${TARGET_DB} dBFS 的
//     增益 — 播放端必須套用 (sampler.volume = gainDb + 樂器 trim), 否則重蹈
//     0.1.110-113 的平衡回歸 (VSCO 各樂器/各層錄音電平差可達 10dB+)。
//   - 音名已 +1 八度校正為 concert pitch (VSCO 弦樂組標籤比實音低一個八度)。

export interface VscoLayer { gainDb: number; urls: Record<string, string> }
export interface VscoArtic { soft: VscoLayer; loud: VscoLayer }
export type VscoManifest = Record<string, Record<string, VscoArtic>>;

export const VSCO2_MANIFEST: VscoManifest = ${body};
`;
  writeFileSync(OUT_TS, ts);
  writeFileSync(OUT_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n寫出 ${OUT_TS}`);
  console.log(`報告 ${OUT_REPORT}`);
  for (const [k, v] of Object.entries(report.layers)) {
    console.log(
      `  ${k.padEnd(28)} median ${String(v.median).padStart(6)}dB → gain ${v.gainDb >= 0 ? "+" : ""}${v.gainDb}dB  (range ${v.spread}${v.outliers.length ? `, 離群 ${v.outliers.join(" ")}` : ""})`,
    );
  }
}

main().catch((e) => {
  console.error("vsco-pipeline 失敗:", e);
  process.exit(1);
});

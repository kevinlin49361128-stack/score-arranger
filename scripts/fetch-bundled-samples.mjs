#!/usr/bin/env node
/**
 * fetch-bundled-samples — 下載核心取樣到 build/samples/，打包時隨 app 散布。
 *
 * 為何 bundle: 預設播放音色 100% 依賴第三方 CDN 是實證過的脆弱點 —
 * (1) 已造成兩類載入競速 bug (0.1.116 鋼琴被 VSCO 餓死);
 * (2) 離線 / 校園網路環境直接退化成合成器。
 * 核心取樣 (~25MB mp3) 直接進 app, 播放零網路依賴; VSCO 加值層維持線上懶載入。
 *
 * 來源即 instrumentConfig 的 SAMPLER_CONFIGS — 單一事實來源, 不另列清單。
 * 本地佈局 (與 renderer 的 LOCAL_SAMPLE_PREFIX 對應):
 *   build/samples/piano/<file>          (Salamander)
 *   build/samples/tonejs/<subpath>      (nbrosowsky, urls 自帶 violin/.. 子路徑)
 *   build/samples/harpsichord/<file>    (gleitz FluidR3)
 *
 * 用法: node scripts/fetch-bundled-samples.mjs   (已存在的檔案跳過, 可重跑)
 * 在 release-mac.sh 與 build-windows.yml 都會先跑這支。
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT = join(ROOT, "build", "samples");
const BUILD_DIR = join(HERE, ".build");

// instrumentConfig 是 TS — esbuild 轉一份再 import (同 audio-qa 模式)
const esbuild = await import("esbuild");
mkdirSync(BUILD_DIR, { recursive: true });
await esbuild.build({
  entryPoints: [join(ROOT, "src/renderer/audio/instrumentConfig.ts")],
  bundle: true,
  format: "esm",
  outfile: join(BUILD_DIR, "instrumentConfig.mjs"),
  logLevel: "silent",
});
const { SAMPLER_CONFIGS, LOCAL_SAMPLE_PREFIX } = await import(
  join(BUILD_DIR, "instrumentConfig.mjs")
);

const jobs = [];
for (const [key, cfg] of Object.entries(SAMPLER_CONFIGS)) {
  const prefix = LOCAL_SAMPLE_PREFIX[key];
  for (const rel of Object.values(cfg.urls)) {
    jobs.push({
      url: cfg.baseUrl + rel,
      dest: join(OUT, prefix, rel),
    });
  }
}

let done = 0;
let skipped = 0;
let failed = 0;
const CONCURRENCY = 8;
async function worker(queue) {
  for (;;) {
    const job = queue.pop();
    if (!job) return;
    if (existsSync(job.dest) && statSync(job.dest).size > 0) {
      skipped++;
      continue;
    }
    try {
      const res = await fetch(job.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      mkdirSync(dirname(job.dest), { recursive: true });
      writeFileSync(job.dest, buf);
      done++;
    } catch (e) {
      failed++;
      console.error(`FAIL ${job.url}: ${e.message}`);
    }
  }
}
const queue = [...jobs];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
console.log(
  `bundled-samples: ${done} 下載, ${skipped} 已存在, ${failed} 失敗 (共 ${jobs.length})`,
);
if (failed > 0) process.exit(1);

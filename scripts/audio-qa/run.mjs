#!/usr/bin/env node
/**
 * audio-qa — 音訊平衡 QA harness + A/B WAV bounce。
 *
 * 流程: esbuild 打包 harness (import app 的 instrumentConfig) → headless Chrome
 * 離線 render 各樂器測試樂句 → 量 loudest-1s RMS → 與 golden baseline 比對
 * delta 漂移 (±TOLERANCE dB, 以鋼琴為參考點) → 同時寫 WAV 到 audio-qa-out/
 * 供耳驗。
 *
 * 用法:
 *   npm run audio-qa                     # 量測 + 比對 baseline (漂移>2dB 即 fail)
 *   npm run audio-qa -- --update-baseline  # 凍結目前狀態為 golden
 *
 * 為何 baseline-diff 而非絕對響度目標: 取樣本身電平差異大 (持續音 vs 衰減音
 * 的聽感不等於 RMS), 絕對值無法定義「對」; 但 Kevin 已耳驗目前平衡 OK →
 * 凍結現狀 delta, 之後任何改動 (換取樣集/調 fader) 若把某樂器推離參考點
 * 超過容差就擋下 — 這正是 0.1.110-113 連環平衡回歸的型態。
 */
import { execFile, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT_DIR = join(ROOT, "audio-qa-out");
const BUILD_DIR = join(HERE, ".build");
const BASELINE_PATH = join(HERE, "baseline.json");
const TOLERANCE_DB = 2.0;
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const UPDATE = process.argv.includes("--update-baseline");

// ---------- esbuild bundle ----------
async function bundle() {
  const esbuild = await import("esbuild");
  mkdirSync(BUILD_DIR, { recursive: true });
  await esbuild.build({
    entryPoints: [join(HERE, "harness-entry.ts")],
    bundle: true,
    format: "iife",
    outfile: join(BUILD_DIR, "bundle.js"),
    logLevel: "silent",
  });
  writeFileSync(
    join(BUILD_DIR, "page.html"),
    `<!doctype html><html><head><meta charset="utf-8"></head>` +
      `<body><script src="bundle.js"></script></body></html>`,
  );
}

// ---------- CDP 最小 client ----------
function launchChrome() {
  const proc = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--autoplay-policy=no-user-gesture-required",
      "--allow-file-access-from-files",
      `--user-data-dir=${join(BUILD_DIR, "chrome-profile")}`,
      `file://${join(BUILD_DIR, "page.html")}`,
    ],
    { stdio: "ignore" },
  );
  return proc;
}

async function waitForTarget(timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find(
        (t) => t.type === "page" && t.url.includes("page.html"),
      );
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* chrome 還沒起來 */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Chrome CDP target 等不到 (15s)");
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((res) => {
      const m = ++id;
      pending.set(m, res);
      ws.send(JSON.stringify({ id: m, method, params }));
    });
  return new Promise((res) =>
    ws.addEventListener("open", () => res({ ws, send })),
  );
}

async function evalInPage(send, expression, timeoutMs = 60000) {
  const r = await Promise.race([
    send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error("evaluate timeout")), timeoutMs),
    ),
  ]);
  // CDP 回應外層是 protocol wrapper: { id, result: { result: RemoteObject,
  // exceptionDetails } } — RemoteObject 在第二層 result。
  const payload = r.result;
  if (payload?.exceptionDetails) {
    throw new Error(
      `頁面例外: ${JSON.stringify(payload.exceptionDetails.exception?.description || payload.exceptionDetails).slice(0, 300)}`,
    );
  }
  return payload?.result?.value;
}

// ---------- 音訊度量 ----------
function base64ToF32(b64) {
  const buf = Buffer.from(b64, "base64");
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

/** 最響 1 秒窗的 RMS (dBFS) — 避開 attack/decay/靜音的穩定響度 proxy。 */
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
  // 不足 1 秒的尾段也算一窗 (極短 render 的保底)
  if (best === 0 && pcm.length > 0) {
    let s = 0;
    for (const x of pcm) s += x * x;
    best = Math.sqrt(s / pcm.length);
  }
  return best > 0 ? 20 * Math.log10(best) : -Infinity;
}

function writeWav(path, pcm, sampleRate) {
  const n = pcm.length;
  const data = Buffer.alloc(44 + n * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + n * 2, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    data.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(path, data);
}

// ---------- main ----------
async function main() {
  console.log("audio-qa: 打包 harness…");
  await bundle();
  mkdirSync(OUT_DIR, { recursive: true });

  console.log("audio-qa: 啟動 headless Chrome…");
  const chrome = launchChrome();
  let exitCode = 0;
  try {
    const wsUrl = await waitForTarget();
    const { ws, send } = await connectCdp(wsUrl);
    await send("Runtime.enable");

    // bundle script 可能尚未執行完 — 輪詢就緒
    let keys;
    let lastProbe = "";
    for (let i = 0; i < 30; i++) {
      keys = await evalInPage(send, "window.qaKeys");
      if (Array.isArray(keys)) break;
      lastProbe = JSON.stringify(
        await evalInPage(
          send,
          "({ href: location.href, state: document.readyState, t: typeof window.qaKeys })",
        ),
      );
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!Array.isArray(keys)) {
      throw new Error(`harness bundle 未就緒 — 頁面狀態: ${lastProbe}`);
    }
    const results = {};
    for (const key of keys) {
      process.stdout.write(`  render ${key} … `);
      const { sampleRate, pcmBase64 } = await evalInPage(
        send,
        `window.renderInstrument(${JSON.stringify(key)})`,
      );
      const pcm = base64ToF32(pcmBase64);
      const db = peak1sRmsDb(pcm, sampleRate);
      results[key] = db;
      writeWav(join(OUT_DIR, `${key}.wav`), pcm, sampleRate);
      console.log(`${db.toFixed(1)} dBFS`);
    }
    ws.close();

    // delta vs 鋼琴 (參考點)
    const ref = results.piano;
    const deltas = {};
    for (const [k, v] of Object.entries(results)) {
      deltas[k] = +(v - ref).toFixed(2);
    }

    console.log("\n樂器           RMS(dBFS)   Δ vs piano");
    for (const [k, v] of Object.entries(results)) {
      console.log(
        `${k.padEnd(14)} ${v.toFixed(1).padStart(8)}   ${deltas[k] >= 0 ? "+" : ""}${deltas[k].toFixed(1)}`,
      );
    }
    console.log(`\nWAV 已輸出 → ${OUT_DIR}/ (可直接耳驗)`);

    if (UPDATE) {
      writeFileSync(
        BASELINE_PATH,
        `${JSON.stringify({ tolerance_db: TOLERANCE_DB, deltas }, null, 2)}\n`,
      );
      console.log(`baseline 已更新 → ${BASELINE_PATH}`);
    } else if (existsSync(BASELINE_PATH)) {
      const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
      let fails = 0;
      console.log(`\nbaseline 漂移檢查 (容差 ±${TOLERANCE_DB} dB):`);
      for (const [k, d] of Object.entries(deltas)) {
        const b = baseline.deltas[k];
        if (b === undefined) continue;
        const drift = Math.abs(d - b);
        const ok = drift <= TOLERANCE_DB;
        if (!ok) fails++;
        console.log(
          `  ${ok ? "✓" : "✗"} ${k.padEnd(14)} baseline ${b >= 0 ? "+" : ""}${b.toFixed(1)} → 現在 ${d >= 0 ? "+" : ""}${d.toFixed(1)} (漂移 ${drift.toFixed(1)})`,
        );
      }
      if (fails > 0) {
        console.error(`\n✗ ${fails} 件樂器平衡漂移超過 ±${TOLERANCE_DB} dB`);
        exitCode = 1;
      } else {
        console.log("\n✓ 平衡無漂移");
      }
    } else {
      console.log(
        "\n(無 baseline — 先跑 `npm run audio-qa -- --update-baseline` 凍結現狀)",
      );
    }
  } finally {
    chrome.kill("SIGKILL");
    // chrome 關閉中可能還在寫 profile — 清不掉就留著, 別蓋掉真正的錯誤
    try {
      rmSync(join(BUILD_DIR, "chrome-profile"), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error("audio-qa 失敗:", e.message);
  process.exit(2);
});

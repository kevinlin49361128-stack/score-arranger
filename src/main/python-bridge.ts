/**
 * Python Engine Bridge — 持久 server + JSON-Lines 協定
 *
 * 設計:
 * - 啟動單一 long-running Python process (engine/core/server.py)
 * - 透過 stdin/stdout 交換 JSON-Lines
 * - 每個請求帶唯一 id, response 依 id 回應
 *
 * 與舊版 (每次 spawn) 比較:
 * - Latency: ~1s → ~10-50ms 每次呼叫
 * - 啟動成本只有一次 (Python interpreter + music21 import)
 *
 * 若需要原始 spawn 模式,使用 runEngineCommand (保留供 fallback)。
 */

import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { resolve } from "node:path";
import { app } from "electron";

const ENGINE_DIR = resolve(__dirname, "../../../engine");
const PYTHON_BIN = process.env.SCORE_ARRANGER_PYTHON
  || resolve(ENGINE_DIR, ".venv/bin/python");

/**
 * 決定如何啟動 engine server。
 *
 * - 開發模式: 用 venv Python 跑 `python -m core.cli server`
 * - 打包模式: 跑 PyInstaller 凍結的獨立執行檔 (不需系統 Python)。
 *   凍結產物經 electron-builder extraResources 放到 resources/engine/。
 *
 * 可用環境變數 SCORE_ARRANGER_PYTHON 覆寫開發模式的 Python 路徑。
 */
function engineLaunchSpec(): {
  cmd: string;
  args: string[];
  opts: SpawnOptions;
} {
  if (app.isPackaged) {
    const exeName = process.platform === "win32"
      ? "score-arranger-engine.exe"
      : "score-arranger-engine";
    const frozenEngine = resolve(
      process.resourcesPath,
      "engine",
      "score-arranger-engine",
      exeName,
    );
    return {
      cmd: frozenEngine,
      args: ["server"],
      // 凍結 binary 自帶所有依賴, 不需 cwd / PYTHONPATH
      opts: {},
    };
  }
  return {
    cmd: PYTHON_BIN,
    args: ["-m", "core.cli", "server"],
    opts: {
      cwd: ENGINE_DIR,
      env: { ...process.env, PYTHONPATH: ENGINE_DIR },
    },
  };
}

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface ServerResponse {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  traceback?: string;
}

class EngineClient {
  private process: ChildProcess | null = null;
  private buffer = "";
  private pending = new Map<string, PendingRequest>();
  private nextId = 0;
  private readyPromise: Promise<void> | null = null;
  private restartCount = 0;
  private readonly MAX_RESTARTS = 3;
  private readonly RESTART_WINDOW_MS = 60_000;
  private lastRestartAt = 0;
  /** 單筆請求逾時 (ms)。引擎卡住 (非崩潰) 時用來中止永久等待 + 清掉洩漏的 pending。 */
  private readonly DEFAULT_TIMEOUT_MS = 180_000;
  /** 慢方法的逾時覆寫 — 未列出者用 DEFAULT_TIMEOUT_MS。 */
  private readonly METHOD_TIMEOUT_MS: Record<string, number> = {
    pdf_to_musicxml: 900_000, // Audiveris OMR — 引擎端另有 timeout, 此為 process 卡死後備
    audio_to_musicxml: 600_000, // basic-pitch AMT
    arrange: 300_000, // 修復迴圈最多 10 次
    arrange_custom: 300_000,
  };
  /** 當前作用中的 tab/session id。每次 call 自動帶入。 */
  private activeSessionId: string = "default";

  setActiveSession(id: string | null): void {
    this.activeSessionId = id ?? "default";
  }

  async ensureStarted(): Promise<void> {
    if (this.process && !this.process.killed) return;
    if (this.readyPromise) {
      await this.readyPromise;
      return;
    }

    this.readyPromise = new Promise<void>((resolveStart, rejectStart) => {
      const { cmd, args, opts } = engineLaunchSpec();
      const proc = spawn(cmd, args, opts);
      this.process = proc;

      proc.stdout!.setEncoding("utf-8");
      proc.stderr!.setEncoding("utf-8");

      let readyReceived = false;

      // 安全: 防止惡意 .sarr / 引擎 bug 產生無止盡輸出把 main process 撐爆.
      // 256MB 對任何正常 IR 序列化都綽綽有餘 (Beethoven 9th 完整譜 IR ~30MB),
      // 超過視為失控 → kill engine + reject 所有 pending.
      const BUFFER_LIMIT = 256 * 1024 * 1024;

      const onData = (chunk: string) => {
        this.buffer += chunk;
        if (this.buffer.length > BUFFER_LIMIT) {
          const err = new Error(
            `Engine output exceeded ${BUFFER_LIMIT} bytes; killing process`,
          );
          this.buffer = "";
          for (const handler of this.pending.values()) {
            handler.reject(err);
          }
          this.pending.clear();
          try { proc.kill("SIGKILL"); } catch { /* ignore */ }
          return;
        }
        let newlineIdx: number;
        while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
          const line = this.buffer.slice(0, newlineIdx).trim();
          this.buffer = this.buffer.slice(newlineIdx + 1);
          if (!line) continue;

          let msg: any;
          try {
            msg = JSON.parse(line);
          } catch {
            // 非 JSON 行 (應不會發生, 但容錯)
            continue;
          }

          if (!readyReceived && msg.type === "ready") {
            readyReceived = true;
            resolveStart();
            continue;
          }

          // 對應 pending request
          const id = msg.id;
          if (typeof id === "string" && this.pending.has(id)) {
            const handler = this.pending.get(id)!;
            this.pending.delete(id);
            handler.resolve(msg);
          }
        }
      };

      proc.stdout!.on("data", onData);

      proc.stderr!.on("data", (chunk: string) => {
        // 印到 main process console (Electron dev tools 看不到 stderr)
        process.stderr.write(`[engine stderr] ${chunk}`);
      });

      proc.on("error", (err) => {
        if (!readyReceived) rejectStart(err);
        // 通知所有 pending
        for (const handler of this.pending.values()) {
          handler.reject(err);
        }
        this.pending.clear();
      });

      proc.on("close", (code) => {
        this.process = null;
        this.readyPromise = null;
        const err = new Error(`engine process exited with code ${code}`);
        for (const handler of this.pending.values()) {
          handler.reject(err);
        }
        this.pending.clear();
        process.stderr.write(
          `[engine] process exited (code=${code}), pending will retry on next call\n`,
        );
      });

      // 啟動超時保護 (30 秒)
      setTimeout(() => {
        if (!readyReceived) {
          rejectStart(new Error("engine startup timed out (30s)"));
        }
      }, 30_000);
    });

    await this.readyPromise;
  }

  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    // 自動帶入 session_id (若 params 未明確指定)
    const paramsWithSession: Record<string, unknown> = {
      session_id: this.activeSessionId,
      ...params,
    };
    // 嘗試正常呼叫,若 process 已死則 auto-restart 後重試一次
    try {
      return await this.doCall(method, paramsWithSession);
    } catch (e) {
      // 判斷是否是 process 死亡導致
      const msg = e instanceof Error ? e.message : String(e);
      const isTimeout = (e as { isTimeout?: boolean } | null)?.isTimeout === true;
      // 逾時已給足時間且引擎已被殺 — 不重試 (重試只會再等一個 timeout)
      const looksDead = !isTimeout && (
        !this.process
        || (this.process.killed ?? false)
        || msg.includes("exited with code")
      );
      if (!looksDead) throw e;
      if (!this.canRestart()) throw e;
      process.stderr.write(`[engine] auto-restarting after error: ${msg}\n`);
      this.restartCount++;
      this.lastRestartAt = Date.now();
      // 重試一次
      return await this.doCall(method, paramsWithSession);
    }
  }

  /** 暴露給外部呼叫 (例如 IPC handler 提供 setActiveSession 給 renderer) */
  static getInstance(c: EngineClient): EngineClient {
    return c;
  }

  private canRestart(): boolean {
    const now = Date.now();
    // 重置 window
    if (now - this.lastRestartAt > this.RESTART_WINDOW_MS) {
      this.restartCount = 0;
    }
    return this.restartCount < this.MAX_RESTARTS;
  }

  private async doCall(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    await this.ensureStarted();
    if (!this.process?.stdin) {
      throw new Error("engine process not available");
    }

    const id = `req-${this.nextId++}`;
    const timeoutMs = this.METHOD_TIMEOUT_MS[method] ?? this.DEFAULT_TIMEOUT_MS;
    const promise = new Promise<unknown>((resolveReq, rejectReq) => {
      // 逾時保護: 引擎卡住 (非崩潰) 時, 沒有這個 timer 請求會永遠掛著,
      // pending entry 也會洩漏。
      const timer = setTimeout(() => {
        this.pending.delete(id);
        process.stderr.write(
          `[engine] request '${method}' timed out after ${timeoutMs}ms`
          + " — killing engine\n",
        );
        // 卡死的引擎無法復原: 殺掉它, 其他 in-flight 請求會由 close handler
        // 拒絕, 下次呼叫 ensureStarted 會 spawn 一個乾淨的。
        const dead = this.process;
        this.process = null;
        this.readyPromise = null;
        dead?.kill();
        const err = new Error(
          `engine request '${method}' timed out after ${timeoutMs}ms`,
        ) as Error & { isTimeout?: boolean };
        err.isTimeout = true;
        rejectReq(err);
      }, timeoutMs);

      this.pending.set(id, {
        timer,
        resolve: (msg) => {
          clearTimeout(timer);
          const r = msg as ServerResponse;
          if (r.ok) {
            resolveReq(r.data);
          } else {
            const err = new Error(r.error ?? "engine error");
            (err as Error & { traceback?: string }).traceback = r.traceback;
            rejectReq(err);
          }
        },
        reject: (err) => {
          clearTimeout(timer);
          rejectReq(err);
        },
      });
    });

    const payload = `${JSON.stringify({ id, method, params })}\n`;
    this.process.stdin.write(payload);
    return promise;
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

// 單一全局 instance
const client = new EngineClient();


// ============================================================================
// 高階 API (對應 server.py 的 method 名稱)
// ============================================================================

export async function parseScore(path: string): Promise<unknown> {
  return client.call("parse", { path });
}

export async function validateScore(path: string): Promise<unknown> {
  return client.call("validate", { path });
}

export async function detectPhrases(path: string): Promise<unknown> {
  return client.call("phrases", { path });
}

export async function tagFunctions(path: string): Promise<unknown> {
  return client.call("tag_functions", { path });
}

export async function analyzeScore(path: string): Promise<unknown> {
  return client.call("analyze", { path });
}

export async function arrangeScore(
  path: string,
  target: string = "violin_piano",
  repair: boolean = false,
  skillLevel: "amateur" | "intermediate" | "professional" = "professional",
  stylePreset: string = "none",
  strategyOrder: string[] = [],
): Promise<unknown> {
  return client.call("arrange", {
    path, target, repair,
    skill_level: skillLevel,
    style_preset: stylePreset,
    strategy_order: strategyOrder,
  });
}

export async function listStylePresets(): Promise<
  { id: string; display_name: string; description: string;
    llm_addendum: string }[]
> {
  return (await client.call("list_style_presets", {})) as {
    id: string; display_name: string; description: string;
    llm_addendum: string;
  }[];
}

export interface AvailableInstrument {
  instrument_id: string;
  display_name: string;
  family: string;
  range_comfortable_low: number;
  range_comfortable_high: number;
  default_staves: number;
}

export async function listAvailableInstruments(): Promise<AvailableInstrument[]> {
  return (await client.call("list_available_instruments", {})) as
    AvailableInstrument[];
}

export interface CustomPlayerInput {
  player_id?: string;
  display_name?: string;
  instrument_id: string;
  staves?: number;
  skill_level?: "amateur" | "intermediate" | "professional";
}

export async function arrangeCustom(
  path: string,
  players: CustomPlayerInput[],
  repair = false,
  skillLevel: "amateur" | "intermediate" | "professional" = "professional",
  stylePreset = "none",
): Promise<unknown> {
  return client.call("arrange_custom", {
    path, players, repair,
    skill_level: skillLevel,
    style_preset: stylePreset,
  });
}

export async function toMusicXML(
  path: string, maxMeasures?: number, startMeasure?: number,
): Promise<string> {
  const params: Record<string, unknown> = { path };
  if (maxMeasures && maxMeasures > 0) params.max_measures = maxMeasures;
  if (startMeasure && startMeasure > 1) params.start_measure = startMeasure;
  return (await client.call("to_musicxml", params)) as string;
}

export async function scoreInfo(path: string): Promise<{
  measure_count: number;
  part_count: number;
}> {
  return (await client.call("score_info", { path })) as {
    measure_count: number;
    part_count: number;
  };
}

export interface OMRStatus {
  available: boolean;
  java_ok: boolean;
  audiveris_path: string | null;
  version: string | null;
  missing: string[];
  install_hints: Record<string, string>;
}

export async function omrStatus(): Promise<OMRStatus> {
  return (await client.call("omr_status", {})) as OMRStatus;
}

export async function pdfToMusicXML(
  pdfPath: string,
  timeoutSec = 600,
): Promise<{ musicxml_path: string; audiveris_version: string | null }> {
  return (await client.call("pdf_to_musicxml", {
    path: pdfPath,
    timeout_sec: timeoutSec,
  })) as { musicxml_path: string; audiveris_version: string | null };
}

export interface AMTStatus {
  available: boolean;
  version: string | null;
  missing: string[];
  install_hints: Record<string, string>;
}

export async function amtStatus(): Promise<AMTStatus> {
  return (await client.call("amt_status", {})) as AMTStatus;
}

export async function audioToMusicXML(
  audioPath: string,
): Promise<{ musicxml_path: string; basic_pitch_version: string | null }> {
  return (await client.call("audio_to_musicxml", { path: audioPath })) as {
    musicxml_path: string; basic_pitch_version: string | null;
  };
}

export async function setMeasureArticulation(
  partId: string,
  measure: number,
  voiceId: number,
  articulation: string,
  mode: "set" | "add" | "clear" = "set",
): Promise<unknown> {
  return client.call("set_measure_articulation", {
    part_id: partId,
    measure,
    voice_id: voiceId,
    articulation,
    mode,
  });
}

export async function analyzeHarmony(path: string): Promise<unknown> {
  return client.call("analyze_harmony", { path });
}

export async function applySuggestion(
  partId: string,
  measure: number,
  voiceId: number,
  eventIndex: number,
  suggestionCode: string,
): Promise<unknown> {
  return client.call("apply_suggestion", {
    part_id: partId,
    measure,
    voice_id: voiceId,
    event_index: eventIndex,
    suggestion_code: suggestionCode,
  });
}

export async function previewSuggestion(
  partId: string,
  measure: number,
  voiceId: number,
  eventIndex: number,
  suggestionCode: string,
): Promise<unknown> {
  return client.call("preview_suggestion", {
    part_id: partId,
    measure,
    voice_id: voiceId,
    event_index: eventIndex,
    suggestion_code: suggestionCode,
  });
}

export async function reassignPart(
  sourcePartId: string,
  targetPlayerId: string,
  targetStaff: string,
): Promise<unknown> {
  return client.call("reassign", {
    source_part_id: sourcePartId,
    target_player_id: targetPlayerId,
    target_staff: targetStaff,
  });
}

export async function listMeasureEvents(
  measure: number,
  partId?: string,
): Promise<unknown> {
  return client.call("list_measure_events", {
    measure,
    part_id: partId,
  });
}

export async function editEvent(
  partId: string,
  measure: number,
  voiceId: number,
  eventIndex: number,
  action: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  return client.call("edit_event", {
    part_id: partId,
    measure,
    voice_id: voiceId,
    event_index: eventIndex,
    action,
    ...extra,
  });
}

/** 套用一批自然語言改譜操作 (整批共用一次 undo)。 */
export async function applyEditOps(
  ops: Record<string, unknown>[],
): Promise<unknown> {
  return client.call("apply_edit_ops", { ops });
}

// 0.1.47 B1: enrich / simplify / level first-class.
// 內部仍走 apply_edit_ops 機制 — 共享 all-or-nothing + history snapshot.
export async function enrichRange(
  partId: string, measureStart: number, measureEnd: number,
  density: "light" | "medium" | "full",
  texture: "block" | "arpeggio" | "strum" | "octave",
): Promise<unknown> {
  return client.call("enrich", {
    part_id: partId, measure_start: measureStart, measure_end: measureEnd,
    density, texture,
  });
}

export async function simplifyRange(
  partId: string, measureStart: number, measureEnd: number,
  level: "light" | "medium" | "full",
): Promise<unknown> {
  return client.call("simplify", {
    part_id: partId, measure_start: measureStart, measure_end: measureEnd,
    level,
  });
}

export async function levelRange(
  partId: string, measureStart: number, measureEnd: number,
  targetDifficulty: number,
): Promise<unknown> {
  return client.call("level", {
    part_id: partId, measure_start: measureStart, measure_end: measureEnd,
    target_difficulty: targetDifficulty,
  });
}

// 0.1.48 B3: continuo 狀態
export async function getContinuoStatus(): Promise<unknown> {
  return client.call("get_continuo_status", {});
}

export async function undoEdit(): Promise<unknown> {
  return client.call("undo", {});
}

export async function redoEdit(): Promise<unknown> {
  return client.call("redo", {});
}

export async function historyStatus(): Promise<unknown> {
  return client.call("history_status", {});
}

export async function toMidi(): Promise<unknown> {
  return client.call("to_midi", {});
}

export async function saveProject(
  path: string,
  sourcePath: string,
): Promise<unknown> {
  return client.call("save_project", {
    path,
    source_path: sourcePath,
  });
}

export async function loadProject(path: string): Promise<unknown> {
  return client.call("load_project", { path });
}

export async function exportTargetMusicXML(path: string): Promise<unknown> {
  return client.call("export_target_musicxml", { path });
}

export async function exportTargetMidi(path: string): Promise<unknown> {
  return client.call("export_target_midi", { path });
}

export async function targetPartMusicXML(
  playerId: string,
): Promise<unknown> {
  return client.call("target_part_musicxml", { player_id: playerId });
}

export async function computeDifficulty(): Promise<unknown> {
  return client.call("compute_difficulty", {});
}

export async function computeQuality(): Promise<unknown> {
  return client.call("compute_quality", {});
}

export async function listNavigation(): Promise<unknown> {
  return client.call("list_navigation", {});
}

export async function getMeasureFingering(
  measure: number,
): Promise<unknown> {
  return client.call("get_measure_fingering", { measure });
}

export async function getChordFingering(
  instrument: string,
  pitches: number[],
): Promise<unknown> {
  return client.call("get_chord_fingering", { instrument, pitches });
}

export async function listSourceParts(path: string): Promise<unknown> {
  return client.call("list_source_parts", { path });
}

export async function suggestTransposition(
  source: string,
  target: string,
): Promise<unknown> {
  return client.call("suggest_transposition", { source, target });
}

export async function transcribe(
  path: string,
  mapping: Record<string, unknown>,
): Promise<unknown> {
  return client.call("transcribe", { path, mapping });
}

export async function toSourceMidi(path?: string): Promise<unknown> {
  return client.call("to_source_midi", path ? { path } : {});
}

export function stopEngine(): void {
  client.stop();
}

/** 設定 IPC 後續呼叫的 active session (對應前端的 active tab id) */
export function setActiveSession(id: string | null): void {
  client.setActiveSession(id);
}

export async function closeSession(id: string): Promise<unknown> {
  return client.call("close_session", { session_id: id });
}


// ============================================================================
// 舊版 fallback: 單次 spawn (供 CLI 直接呼叫等場景)
// ============================================================================

export interface PythonBridgeOptions {
  cwd?: string;
  pythonBin?: string;
  timeoutMs?: number;
}

export async function runEngineCommand(
  args: string[],
  options: PythonBridgeOptions = {},
): Promise<string> {
  const cwd = options.cwd ?? ENGINE_DIR;
  const pythonBin = options.pythonBin ?? PYTHON_BIN;
  const timeoutMs = options.timeoutMs ?? 60_000;

  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn(pythonBin, ["-m", "core.cli", ...args], {
      cwd,
      env: { ...process.env, PYTHONPATH: cwd },
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      rejectPromise(new Error(`Python engine timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    proc.on("error", (err) => {
      clearTimeout(timer);
      rejectPromise(new Error(`Failed to spawn Python: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        rejectPromise(new Error(
          `Python engine exited with code ${code}\nstderr: ${stderr}`,
        ));
        return;
      }
      resolvePromise(stdout);
    });
  });
}

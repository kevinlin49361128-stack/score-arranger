/**
 * Electron main process — 視窗管理 + IPC 對外接口
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdirSync, readFileSync, realpathSync, unwatchFile, watchFile, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  analyzeScore,
  applyEditOps,
  applySuggestion,
  arrangeScore,
  closeSession,
  detectPhrases,
  editEvent,
  computeDifficulty,
  computeQuality,
  exportTargetMidi,
  listNavigation,
  getMeasureFingering,
  getChordFingering,
  exportTargetMusicXML,
  targetPartMusicXML,
  historyStatus,
  listMeasureEvents,
  listSourceParts,
  loadProject,
  parseScore,
  previewSuggestion,
  reassignPart,
  redoEdit,
  saveProject,
  setActiveSession,
  suggestTransposition,
  tagFunctions,
  toMidi,
  toMusicXML,
  toSourceMidi,
  transcribe,
  undoEdit,
  validateScore,
  omrStatus,
  pdfToMusicXML,
  amtStatus,
  audioToMusicXML,
  setMeasureArticulation,
  listStylePresets,
  scoreInfo,
  listAvailableInstruments,
  arrangeCustom,
  type CustomPlayerInput,
} from "./python-bridge";
import {
  callLLMEditPlan,
  callLLMIssueExplain,
  callLLMSuggestion,
  getLLMConfigForUI,
  getLLMInfo,
  isLLMAvailable,
  type LLMSettings,
  saveLLMSettings,
} from "./llm";

const isDev = !app.isPackaged;

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Score Arranger",
    webPreferences: {
      // 編譯後 preload.js 與 index.js 在同一目錄 (dist/main/main/)
      preload: resolve(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Defense-in-depth: 即使 renderer 被攻破, sandbox 也擋掉非 IPC 的 Node
      // API. preload 已全走 contextBridge, 開 sandbox 不需改 code.
      sandbox: true,
    },
  });

  // 安全: window.open / target=_blank → 一律阻止繼承 webPreferences, 改用
  // shell.openExternal 把連結交給系統瀏覽器 (跳脫 app sandbox).
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // 安全: 拒絕 in-app 導航到非預期 URL (dev 是 vite, 打包後是 file://).
  // 沒有這層防護, 惡意樂譜內嵌 link 點到可在 app 視窗內導去 phishing.
  win.webContents.on("will-navigate", (e, url) => {
    const allowed = isDev
      ? url.startsWith("http://localhost:5173")
      : url.startsWith("file://");
    if (!allowed) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  if (isDev) {
    await win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // 打包後: __dirname = <asar>/dist/main/main → renderer 在 dist/renderer
    await win.loadFile(resolve(__dirname, "../../renderer/index.html"));
  }

  // Production mode 也允許 cmd+option+i 開 DevTools — 沒有它使用者回報 bug
  // 時沒辦法看 console error. 不會影響 sandbox / IPC 安全層 (DevTools 只能
  // 看到 contextBridge 暴露的 window.scoreArranger, 看不到 main process).
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && input.key === "i"
        && input.alt && (input.meta || input.control)) {
      win.webContents.toggleDevTools();
    }
  });

  return win;
}

// ============================================================================
// IPC handlers — 暴露給 renderer
// ============================================================================

/**
 * 安全: dialog 通過 → 把核可的寫入路徑記下, 之後寫檔 handler 必須驗證
 * 路徑已被 dialog 核可. 沒這層守護, renderer 被 XSS / LLM-prompt-injection
 * 攻破時可以直接呼 engine:saveProject("/Users/X/.ssh/authorized_keys", ...)
 * 把任意檔案覆寫.
 *
 * 設計: session 內任何被 dialog 核可的路徑都加進 Set; 不過期 (使用者明確
 * 同意過, 沒理由要他再同意一次). app 關掉就清空.
 */
const approvedWritePaths = new Set<string>();

function rememberApprovedPath(path: string | null | undefined): string | null {
  if (!path) return null;
  approvedWritePaths.add(path);
  return path;
}

function requireApprovedPath(path: string): void {
  if (!approvedWritePaths.has(path)) {
    throw new Error(
      "Refused write to non-dialog-approved path. "
      + "Renderer must obtain path via dialog:saveProject / dialog:exportFile first.",
    );
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle("dialog:openScore", async () => {
    // 第一個 filter 是 macOS 對話框的預設選項 — 必須涵蓋所有支援格式,
    // 否則 PDF / MIDI / ABC / krn 會被 grey-out 而無法選取。
    const audioExt = ["wav", "mp3", "m4a", "flac", "ogg", "aac"];
    const result = await dialog.showOpenDialog({
      title: "選擇樂譜檔案",
      properties: ["openFile"],
      filters: [
        {
          name: "所有支援的格式",
          extensions: [
            "musicxml", "xml", "mxl", "mid", "midi", "abc", "krn",
            "pdf", ...audioExt,
          ],
        },
        { name: "MusicXML", extensions: ["musicxml", "xml", "mxl"] },
        { name: "MIDI", extensions: ["mid", "midi"] },
        { name: "ABC Notation", extensions: ["abc"] },
        { name: "Humdrum (**kern)", extensions: ["krn"] },
        { name: "PDF (需安裝 Audiveris)", extensions: ["pdf"] },
        { name: "音訊 (需安裝 basic-pitch)", extensions: audioExt },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:saveProject", async () => {
    const result = await dialog.showSaveDialog({
      title: "儲存專案",
      defaultPath: "untitled.sarr",
      filters: [
        { name: "Score Arranger Project", extensions: ["sarr"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    return rememberApprovedPath(result.filePath);
  });

  ipcMain.handle("dialog:openProject", async () => {
    const result = await dialog.showOpenDialog({
      title: "開啟專案",
      properties: ["openFile"],
      filters: [
        { name: "Score Arranger Project", extensions: ["sarr"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    "dialog:exportFile",
    async (_evt, kind: "musicxml" | "midi") => {
      const filters = kind === "midi"
        ? [{ name: "MIDI", extensions: ["mid"] }]
        : [{ name: "MusicXML", extensions: ["musicxml", "xml"] }];
      const defaultPath =
        kind === "midi" ? "arrangement.mid" : "arrangement.musicxml";
      const result = await dialog.showSaveDialog({
        title: kind === "midi" ? "匯出 MIDI" : "匯出 MusicXML",
        defaultPath,
        filters,
      });
      if (result.canceled || !result.filePath) return null;
      return rememberApprovedPath(result.filePath);
    },
  );

  ipcMain.handle("engine:parse", async (_evt, path: string) =>
    safeCall(() => parseScore(path)));
  ipcMain.handle("engine:validate", async (_evt, path: string) =>
    safeCall(() => validateScore(path)));
  ipcMain.handle("engine:phrases", async (_evt, path: string) =>
    safeCall(() => detectPhrases(path)));
  ipcMain.handle("engine:tagFunctions", async (_evt, path: string) =>
    safeCall(() => tagFunctions(path)));
  ipcMain.handle("engine:analyze", async (_evt, path: string) =>
    safeCall(() => analyzeScore(path)));
  ipcMain.handle("engine:arrange", async (
    _evt,
    path: string,
    target: string,
    repair: boolean,
    skillLevel?: "amateur" | "intermediate" | "professional",
    stylePreset?: string,
    strategyOrder?: string[],
  ) => safeCall(() =>
    arrangeScore(
      path, target, repair, skillLevel, stylePreset, strategyOrder,
    )));
  ipcMain.handle("engine:listStylePresets", async () =>
    safeCall(() => listStylePresets()));
  ipcMain.handle("engine:listAvailableInstruments", async () =>
    safeCall(() => listAvailableInstruments()));
  ipcMain.handle("engine:arrangeCustom", async (
    _evt,
    path: string,
    players: CustomPlayerInput[],
    repair: boolean,
    skillLevel?: "amateur" | "intermediate" | "professional",
    stylePreset?: string,
  ) => safeCall(() =>
    arrangeCustom(path, players, repair, skillLevel, stylePreset)));
  ipcMain.handle(
    "engine:toMusicXML",
    async (
      _evt, path: string, maxMeasures?: number, startMeasure?: number,
    ) => safeCall(() => toMusicXML(path, maxMeasures, startMeasure)),
  );
  ipcMain.handle("engine:scoreInfo", async (_evt, path: string) =>
    safeCall(() => scoreInfo(path)));
  ipcMain.handle("engine:omrStatus", async () =>
    safeCall(() => omrStatus()));
  ipcMain.handle("engine:pdfToMusicXML", async (_evt, path: string) =>
    safeCall(() => pdfToMusicXML(path)));
  ipcMain.handle("engine:amtStatus", async () =>
    safeCall(() => amtStatus()));
  ipcMain.handle("engine:audioToMusicXML", async (_evt, path: string) =>
    safeCall(() => audioToMusicXML(path)));
  ipcMain.handle(
    "engine:setMeasureArticulation",
    async (
      _evt,
      partId: string,
      measure: number,
      voiceId: number,
      articulation: string,
      mode: "set" | "add" | "clear",
    ) => safeCall(() =>
      setMeasureArticulation(partId, measure, voiceId, articulation, mode)),
  );
  // 注意: 此 handler 必須「同步」設定 activeSessionId — 不可有任何 await。
  // python-bridge 已在檔案頂端靜態 import; 改用動態 `await import()` 會讓
  // handler 在設定 session 前先 yield 一個 microtask, 期間後續的 arrange /
  // to_midi handler 會搶先以「舊」session_id 送進引擎 → 播放到上一首的 MIDI。
  ipcMain.handle("engine:setActiveSession", (_evt, id: string | null) => {
    setActiveSession(id);
    return { ok: true };
  });
  ipcMain.handle("engine:closeSession", async (_evt, id: string) =>
    safeCall(() => closeSession(id)));
  ipcMain.handle(
    "engine:applySuggestion",
    async (
      _evt,
      partId: string,
      measure: number,
      voiceId: number,
      eventIndex: number,
      suggestionCode: string,
    ) =>
      safeCall(() =>
        applySuggestion(
          partId,
          measure,
          voiceId,
          eventIndex,
          suggestionCode,
        )
      ),
  );
  ipcMain.handle(
    "engine:previewSuggestion",
    async (
      _evt,
      partId: string,
      measure: number,
      voiceId: number,
      eventIndex: number,
      suggestionCode: string,
    ) =>
      safeCall(() =>
        previewSuggestion(
          partId,
          measure,
          voiceId,
          eventIndex,
          suggestionCode,
        )
      ),
  );
  ipcMain.handle(
    "engine:reassign",
    async (_evt, sourcePartId: string, targetPlayerId: string, targetStaff: string) =>
      safeCall(() => reassignPart(sourcePartId, targetPlayerId, targetStaff)),
  );
  ipcMain.handle(
    "engine:listMeasureEvents",
    async (_evt, measure: number, partId?: string) =>
      safeCall(() => listMeasureEvents(measure, partId)),
  );
  ipcMain.handle(
    "engine:editEvent",
    async (
      _evt,
      partId: string,
      measure: number,
      voiceId: number,
      eventIndex: number,
      action: string,
      extra: Record<string, unknown>,
    ) =>
      safeCall(() =>
        editEvent(partId, measure, voiceId, eventIndex, action, extra)
      ),
  );
  ipcMain.handle(
    "engine:applyEditOps",
    async (_evt, ops: Record<string, unknown>[]) =>
      safeCall(() => applyEditOps(ops)),
  );

  // 在系統預設 App 開啟 MusicXML (e.g. MuseScore / Dorico)
  // 開啟後啟動 fs.watchFile 監看, 使用者存檔 → 自動推送新內容回 renderer
  ipcMain.handle(
    "shell:openInExternalEditor",
    async (evt, musicxml: string, baseName: string = "arrangement") => {
      try {
        const dir = join(tmpdir(), "score-arranger");
        mkdirSync(dir, { recursive: true });
        // 安全: realpath 確認 tmpdir 沒被符號連結劫持 (罕見但 macOS 多用戶
        // shared tmp 攻擊存在). 落點必須仍在 tmpdir 樹下.
        const realDir = realpathSync(dir);
        const expectedRoot = realpathSync(tmpdir());
        if (!realDir.startsWith(expectedRoot)) {
          throw new Error(
            `Refused: tmpdir resolves outside expected root (${realDir})`,
          );
        }
        const safeName = baseName.replace(/[^\w.-]/g, "_");
        const filePath = join(
          realDir,
          `${safeName}-${Date.now()}.musicxml`,
        );
        writeFileSync(filePath, musicxml, "utf-8");
        const err = await shell.openPath(filePath);
        if (err) {
          return { ok: false, error: err };
        }

        // 監看檔案變化 (poll 每 1.5s, MuseScore/Dorico 存檔後會觸發)
        const sender = evt.sender;
        watchFile(filePath, { interval: 1500 }, (curr, prev) => {
          if (curr.mtimeMs <= prev.mtimeMs) return;
          try {
            const updated = readFileSync(filePath, "utf-8");
            sender.send("shell:externalEditorChanged", {
              path: filePath,
              musicxml: updated,
            });
          } catch {
            /* 讀檔失敗忽略, 下次 mtime 變動再試 */
          }
        });
        // 視窗關閉時清掉 watcher
        const win = BrowserWindow.fromWebContents(sender);
        win?.on("closed", () => unwatchFile(filePath));

        return { ok: true, data: { path: filePath } };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
  );
  ipcMain.handle("engine:undo", async () => safeCall(() => undoEdit()));
  ipcMain.handle("engine:redo", async () => safeCall(() => redoEdit()));
  ipcMain.handle("engine:historyStatus", async () =>
    safeCall(() => historyStatus()));
  ipcMain.handle("engine:toMidi", async () => safeCall(() => toMidi()));
  ipcMain.handle(
    "engine:toSourceMidi",
    async (_evt, path?: string) => safeCall(() => toSourceMidi(path)),
  );
  ipcMain.handle(
    "engine:saveProject",
    async (_evt, path: string, sourcePath: string) => {
      requireApprovedPath(path);
      return safeCall(() => saveProject(path, sourcePath));
    },
  );
  ipcMain.handle("engine:loadProject", async (_evt, path: string) =>
    safeCall(() => loadProject(path)));
  ipcMain.handle(
    "engine:exportTargetMusicXML",
    async (_evt, path: string) => {
      requireApprovedPath(path);
      return safeCall(() => exportTargetMusicXML(path));
    },
  );
  ipcMain.handle(
    "engine:exportTargetMidi",
    async (_evt, path: string) => {
      requireApprovedPath(path);
      return safeCall(() => exportTargetMidi(path));
    },
  );
  ipcMain.handle(
    "engine:targetPartMusicXML",
    async (_evt, playerId: string) =>
      safeCall(() => targetPartMusicXML(playerId)),
  );
  ipcMain.handle(
    "engine:computeDifficulty",
    async () => safeCall(() => computeDifficulty()),
  );
  ipcMain.handle(
    "engine:computeQuality",
    async () => safeCall(() => computeQuality()),
  );
  ipcMain.handle(
    "engine:listNavigation",
    async () => safeCall(() => listNavigation()),
  );
  ipcMain.handle(
    "engine:getMeasureFingering",
    async (_evt, measure: number) =>
      safeCall(() => getMeasureFingering(measure)),
  );
  ipcMain.handle(
    "engine:getChordFingering",
    async (_evt, instrument: string, pitches: number[]) =>
      safeCall(() => getChordFingering(instrument, pitches)),
  );
  ipcMain.handle(
    "engine:listSourceParts",
    async (_evt, path: string) => safeCall(() => listSourceParts(path)),
  );
  ipcMain.handle(
    "engine:suggestTransposition",
    async (_evt, source: string, target: string) =>
      safeCall(() => suggestTransposition(source, target)),
  );
  ipcMain.handle(
    "engine:transcribe",
    async (_evt, path: string, mapping: Record<string, unknown>) =>
      safeCall(() => transcribe(path, mapping)),
  );

  // LLM 建議 (Provider-agnostic — anthropic / openai_compat / ollama)
  ipcMain.handle("llm:isAvailable", async () => isLLMAvailable());
  ipcMain.handle("llm:info", async () => getLLMInfo());
  ipcMain.handle(
    "llm:suggest",
    async (_evt, ctx) => safeCall(() => callLLMSuggestion(ctx)),
  );
  // LLM 設定 — 讀 / 寫 provider/baseUrl/model (API key 不落地, 走環境變數)
  ipcMain.handle("llm:getConfig", async () => getLLMConfigForUI());
  ipcMain.handle(
    "llm:setConfig",
    async (_evt, partial: LLMSettings) => {
      saveLLMSettings(partial);
      return getLLMConfigForUI();
    },
  );
  // 自然語言改譜 — LLM 產生可套用的結構化操作
  ipcMain.handle(
    "llm:editPlan",
    async (_evt, ctx) => safeCall(() => callLLMEditPlan(ctx)),
  );
  // 可演奏性問題 LLM 解讀 — 解釋問題 + 推薦既有建議
  ipcMain.handle(
    "llm:explainIssue",
    async (_evt, ctx) => safeCall(() => callLLMIssueExplain(ctx)),
  );
}

async function safeCall<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

// ============================================================================
// App lifecycle
// ============================================================================

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

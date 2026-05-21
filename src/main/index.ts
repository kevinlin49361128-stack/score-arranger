/**
 * Electron main process — 視窗管理 + IPC 對外接口
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdirSync, readFileSync, unwatchFile, watchFile, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  analyzeScore,
  applySuggestion,
  arrangeScore,
  detectPhrases,
  editEvent,
  computeDifficulty,
  computeQuality,
  exportTargetMidi,
  listNavigation,
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
import { callLLMSuggestion, getLLMInfo, isLLMAvailable } from "./llm";

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
    },
  });

  if (isDev) {
    await win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // 打包後: __dirname = <asar>/dist/main/main → renderer 在 dist/renderer
    await win.loadFile(resolve(__dirname, "../../renderer/index.html"));
  }

  return win;
}

// ============================================================================
// IPC handlers — 暴露給 renderer
// ============================================================================

function registerIpcHandlers(): void {
  ipcMain.handle("dialog:openScore", async () => {
    const result = await dialog.showOpenDialog({
      title: "選擇樂譜檔案",
      properties: ["openFile"],
      filters: [
        { name: "MusicXML", extensions: ["musicxml", "xml", "mxl"] },
        { name: "MIDI", extensions: ["mid", "midi"] },
        { name: "ABC Notation", extensions: ["abc"] },
        { name: "Humdrum (**kern)", extensions: ["krn"] },
        { name: "PDF (需安裝 Audiveris)", extensions: ["pdf"] },
        {
          name: "音訊 (需安裝 basic-pitch)",
          extensions: ["wav", "mp3", "m4a", "flac", "ogg", "aac"],
        },
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
    return result.filePath;
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
      return result.filePath;
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
    async (_evt, path: string, maxMeasures?: number) =>
      safeCall(() => toMusicXML(path, maxMeasures)),
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
  ipcMain.handle("engine:setActiveSession", async (_evt, id: string | null) => {
    const bridge = await import("./python-bridge");
    bridge.setActiveSession(id);
    return { ok: true };
  });
  ipcMain.handle("engine:closeSession", async (_evt, id: string) => {
    const bridge = await import("./python-bridge");
    return safeCall(() => bridge.closeSession(id));
  });
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

  // 在系統預設 App 開啟 MusicXML (e.g. MuseScore / Dorico)
  // 開啟後啟動 fs.watchFile 監看, 使用者存檔 → 自動推送新內容回 renderer
  ipcMain.handle(
    "shell:openInExternalEditor",
    async (evt, musicxml: string, baseName: string = "arrangement") => {
      try {
        const dir = join(tmpdir(), "score-arranger");
        mkdirSync(dir, { recursive: true });
        const safeName = baseName.replace(/[^\w.-]/g, "_");
        const filePath = join(
          dir,
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
    async (_evt, path: string, sourcePath: string) =>
      safeCall(() => saveProject(path, sourcePath)),
  );
  ipcMain.handle("engine:loadProject", async (_evt, path: string) =>
    safeCall(() => loadProject(path)));
  ipcMain.handle(
    "engine:exportTargetMusicXML",
    async (_evt, path: string) => safeCall(() => exportTargetMusicXML(path)),
  );
  ipcMain.handle(
    "engine:exportTargetMidi",
    async (_evt, path: string) => safeCall(() => exportTargetMidi(path)),
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

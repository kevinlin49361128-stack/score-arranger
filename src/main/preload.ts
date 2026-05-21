/**
 * Preload script — 以 contextBridge 暴露安全的 API 給 renderer
 */

import { contextBridge, ipcRenderer } from "electron";

const api = {
  openScoreDialog: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:openScore"),
  saveProjectDialog: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:saveProject"),
  openProjectDialog: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:openProject"),
  exportFileDialog: (kind: "musicxml" | "midi"): Promise<string | null> =>
    ipcRenderer.invoke("dialog:exportFile", kind),
  openInExternalEditor: (musicxml: string, baseName?: string) =>
    ipcRenderer.invoke("shell:openInExternalEditor", musicxml, baseName),

  /** LLM 建議是否可用 (LLM provider 是否設定) */
  llmIsAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke("llm:isAvailable"),
  /** 目前生效的 provider / model — UI 顯示用 */
  llmInfo: () => ipcRenderer.invoke("llm:info"),
  /** 呼叫 LLM 取得改編建議 (走當前選定 provider) */
  llmSuggest: (ctx: {
    context: string;
    userQuery: string;
    ensemble?: string;
  }) => ipcRenderer.invoke("llm:suggest", ctx),
  /** 讀取目前 LLM 設定 (provider / baseUrl / model + 是否可用) */
  llmGetConfig: () => ipcRenderer.invoke("llm:getConfig"),
  /** 儲存 LLM 設定 — 只存 provider/baseUrl/model, API key 不落地 */
  llmSetConfig: (partial: {
    provider?: "anthropic" | "openai_compat" | "ollama";
    baseUrl?: string;
    model?: string;
  }) => ipcRenderer.invoke("llm:setConfig", partial),
  /** 自然語言改譜 — LLM 產生可套用的結構化操作 */
  llmEditPlan: (ctx: {
    userRequest: string;
    parts: { part_id: string; name: string }[];
    sourceParts?: { part_id: string; name: string }[];
    history?: { request: string; summary: string }[];
    measureCount: number;
    ensemble?: string;
  }) => ipcRenderer.invoke("llm:editPlan", ctx),
  /** 可演奏性問題 LLM 解讀 — 解釋問題 + 推薦既有建議 */
  llmExplainIssue: (ctx: {
    issueDescription: string;
    instrument?: string;
    measure: number;
    ensemble?: string;
    suggestions: { code: string; label: string }[];
  }) => ipcRenderer.invoke("llm:explainIssue", ctx),
  /** 監聽外部編輯器存檔事件; 回傳取消訂閱函式 */
  onExternalEditorChanged: (
    cb: (data: { path: string; musicxml: string }) => void,
  ): (() => void) => {
    const handler = (_e: unknown, data: { path: string; musicxml: string }) =>
      cb(data);
    ipcRenderer.on("shell:externalEditorChanged", handler);
    return () =>
      ipcRenderer.removeListener("shell:externalEditorChanged", handler);
  },

  engine: {
    parse: (path: string) => ipcRenderer.invoke("engine:parse", path),
    validate: (path: string) => ipcRenderer.invoke("engine:validate", path),
    phrases: (path: string) => ipcRenderer.invoke("engine:phrases", path),
    tagFunctions: (path: string) =>
      ipcRenderer.invoke("engine:tagFunctions", path),
    analyze: (path: string) => ipcRenderer.invoke("engine:analyze", path),
    arrange: (
      path: string,
      target = "violin_piano",
      repair = false,
      skillLevel: "amateur" | "intermediate" | "professional" = "professional",
      stylePreset = "none",
      strategyOrder: string[] = [],
    ) =>
      ipcRenderer.invoke(
        "engine:arrange", path, target, repair, skillLevel, stylePreset,
        strategyOrder,
      ),
    listStylePresets: () =>
      ipcRenderer.invoke("engine:listStylePresets"),
    listAvailableInstruments: () =>
      ipcRenderer.invoke("engine:listAvailableInstruments"),
    arrangeCustom: (
      path: string,
      players: Array<{
        player_id?: string;
        display_name?: string;
        instrument_id: string;
        staves?: number;
        skill_level?: "amateur" | "intermediate" | "professional";
      }>,
      repair = false,
      skillLevel: "amateur" | "intermediate" | "professional" = "professional",
      stylePreset = "none",
    ) =>
      ipcRenderer.invoke(
        "engine:arrangeCustom", path, players, repair, skillLevel, stylePreset,
      ),
    toMusicXML: (path: string, maxMeasures?: number) =>
      ipcRenderer.invoke("engine:toMusicXML", path, maxMeasures),
    scoreInfo: (path: string) =>
      ipcRenderer.invoke("engine:scoreInfo", path),
    omrStatus: () => ipcRenderer.invoke("engine:omrStatus"),
    pdfToMusicXML: (path: string) =>
      ipcRenderer.invoke("engine:pdfToMusicXML", path),
    amtStatus: () => ipcRenderer.invoke("engine:amtStatus"),
    audioToMusicXML: (path: string) =>
      ipcRenderer.invoke("engine:audioToMusicXML", path),
    setMeasureArticulation: (
      partId: string,
      measure: number,
      voiceId: number,
      articulation: string,
      mode: "set" | "add" | "clear" = "set",
    ) =>
      ipcRenderer.invoke(
        "engine:setMeasureArticulation",
        partId, measure, voiceId, articulation, mode,
      ),
    setActiveSession: (id: string | null) =>
      ipcRenderer.invoke("engine:setActiveSession", id),
    closeSession: (id: string) =>
      ipcRenderer.invoke("engine:closeSession", id),
    applySuggestion: (
      partId: string,
      measure: number,
      voiceId: number,
      eventIndex: number,
      suggestionCode: string,
    ) =>
      ipcRenderer.invoke(
        "engine:applySuggestion",
        partId,
        measure,
        voiceId,
        eventIndex,
        suggestionCode,
      ),
    previewSuggestion: (
      partId: string,
      measure: number,
      voiceId: number,
      eventIndex: number,
      suggestionCode: string,
    ) =>
      ipcRenderer.invoke(
        "engine:previewSuggestion",
        partId,
        measure,
        voiceId,
        eventIndex,
        suggestionCode,
      ),
    reassign: (
      sourcePartId: string,
      targetPlayerId: string,
      targetStaff: string,
    ) =>
      ipcRenderer.invoke(
        "engine:reassign",
        sourcePartId,
        targetPlayerId,
        targetStaff,
      ),
    listMeasureEvents: (measure: number, partId?: string) =>
      ipcRenderer.invoke("engine:listMeasureEvents", measure, partId),
    editEvent: (
      partId: string,
      measure: number,
      voiceId: number,
      eventIndex: number,
      action: string,
      extra: Record<string, unknown> = {},
    ) =>
      ipcRenderer.invoke(
        "engine:editEvent",
        partId,
        measure,
        voiceId,
        eventIndex,
        action,
        extra,
      ),
    applyEditOps: (ops: Record<string, unknown>[]) =>
      ipcRenderer.invoke("engine:applyEditOps", ops),
    undo: () => ipcRenderer.invoke("engine:undo"),
    redo: () => ipcRenderer.invoke("engine:redo"),
    historyStatus: () => ipcRenderer.invoke("engine:historyStatus"),
    toMidi: () => ipcRenderer.invoke("engine:toMidi"),
    saveProject: (path: string, sourcePath: string) =>
      ipcRenderer.invoke("engine:saveProject", path, sourcePath),
    loadProject: (path: string) =>
      ipcRenderer.invoke("engine:loadProject", path),
    exportTargetMusicXML: (path: string) =>
      ipcRenderer.invoke("engine:exportTargetMusicXML", path),
    exportTargetMidi: (path: string) =>
      ipcRenderer.invoke("engine:exportTargetMidi", path),
    targetPartMusicXML: (playerId: string) =>
      ipcRenderer.invoke("engine:targetPartMusicXML", playerId),
    computeDifficulty: () =>
      ipcRenderer.invoke("engine:computeDifficulty"),
    computeQuality: () =>
      ipcRenderer.invoke("engine:computeQuality"),
    listNavigation: () =>
      ipcRenderer.invoke("engine:listNavigation"),
    listSourceParts: (path: string) =>
      ipcRenderer.invoke("engine:listSourceParts", path),
    suggestTransposition: (source: string, target: string) =>
      ipcRenderer.invoke("engine:suggestTransposition", source, target),
    transcribe: (path: string, mapping: Record<string, unknown>) =>
      ipcRenderer.invoke("engine:transcribe", path, mapping),
    toSourceMidi: (path?: string) =>
      ipcRenderer.invoke("engine:toSourceMidi", path),
  },
};

contextBridge.exposeInMainWorld("scoreArranger", api);

export type ScoreArrangerAPI = typeof api;

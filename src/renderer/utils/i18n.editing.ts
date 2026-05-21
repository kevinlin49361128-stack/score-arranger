import type { BiDict } from "./i18n";

/**
 * 編輯 / LLM 介面字串 — NLEditDialog / LLMSettingsDialog /
 * LLMSuggestionDialog / MeasureEditor。
 */
export const EDITING_STRINGS: BiDict = {
  // ── NLEditDialog ──────────────────────────────────────────────────────
  "nlEdit.title": {
    "zh-TW": "🤖 自然語言改譜",
    en: "🤖 Natural-Language Editing",
  },
  "nlEdit.close": { "zh-TW": "關閉", en: "Close" },
  "nlEdit.partRightHand": {
    "zh-TW": "{name}（右手）",
    en: "{name} (right hand)",
  },
  "nlEdit.partLeftHand": {
    "zh-TW": "{name}（左手）",
    en: "{name} (left hand)",
  },
  "nlEdit.noModelTitle": {
    "zh-TW": "尚未設定 AI 模型",
    en: "No AI model configured",
  },
  "nlEdit.noModelBody": {
    "zh-TW":
      "請先到工具列 ⚙ →「AI 模型設定」選擇 provider 並設好 endpoint / model（本地 Ollama 免 API key）。",
    en:
      "Open the toolbar ⚙ → \"AI Model Settings\" to choose a provider and set the endpoint / model (local Ollama needs no API key).",
  },
  "nlEdit.noArrangement": {
    "zh-TW": "尚未完成改編 — 請先「改編」產生目標譜, 才能用自然語言修改。",
    en:
      "No arrangement yet — run \"Arrange\" to produce a target score before editing it with natural language.",
  },
  "nlEdit.historyTitle": { "zh-TW": "對話紀錄", en: "Conversation history" },
  "nlEdit.editableParts": {
    "zh-TW": "可改動的聲部:",
    en: "Editable parts:",
  },
  "nlEdit.measureCount": {
    "zh-TW": "　(共 {n} 小節)",
    en: "　({n} measures total)",
  },
  "nlEdit.placeholderFollowUp": {
    "zh-TW": "接著想調整什麼? 例如「再輕一點」「那大提琴呢」",
    en: "What next? e.g. \"a little softer\", \"and the cello?\"",
  },
  "nlEdit.placeholderInitial": {
    "zh-TW":
      "用一句話描述想做的修改, 例如:\n• 把小提琴第 9-16 小節降一個八度\n• 第 1-4 小節整段改成 staccato\n• 把第 30-32 小節改成休止符",
    en:
      "Describe the change you want in one sentence, e.g.:\n• transpose the violin down an octave in measures 9-16\n• make measures 1-4 staccato throughout\n• turn measures 30-32 into rests",
  },
  "nlEdit.thinking": { "zh-TW": "AI 思考中...", en: "AI is thinking..." },
  "nlEdit.generatePlan": {
    "zh-TW": "產生改譜方案",
    en: "Generate edit plan",
  },
  "nlEdit.proposalNote": {
    "zh-TW": "AI 只會提案, 須由你逐項確認後才會套用",
    en: "The AI only proposes — nothing is applied until you confirm each item",
  },
  "nlEdit.planFailed": {
    "zh-TW": "AI 產生改譜方案失敗",
    en: "The AI failed to generate an edit plan",
  },
  "nlEdit.planHeading": { "zh-TW": "改譜方案", en: "Edit plan" },
  "nlEdit.noOps": {
    "zh-TW": "AI 無法用目前支援的操作達成此要求 (見下方說明)。",
    en:
      "The AI cannot fulfill this request with the currently supported operations (see notes below).",
  },
  "nlEdit.opPartMissing": {
    "zh-TW": "AI 指定的聲部不存在, 此項無法套用",
    en: "The part specified by the AI does not exist; this item cannot be applied",
  },
  "nlEdit.selectedCount": {
    "zh-TW": "已選 {selected} / {total} 項",
    en: "{selected} / {total} selected",
  },
  "nlEdit.applying": { "zh-TW": "套用中...", en: "Applying..." },
  "nlEdit.applySelected": {
    "zh-TW": "套用選取的 {n} 項",
    en: "Apply selected ({n})",
  },
  "nlEdit.unknownPart": {
    "zh-TW": "⚠ 未知聲部 {id}",
    en: "⚠ Unknown part {id}",
  },
  "nlEdit.unknownSource": {
    "zh-TW": "⚠ 未知來源 {id}",
    en: "⚠ Unknown source {id}",
  },
  "nlEdit.reassignTargetInvalid": {
    "zh-TW": "reassign 目標聲部無效: {id}",
    en: "Invalid reassign target part: {id}",
  },
  "nlEdit.reassignFailed": { "zh-TW": "reassign 失敗", en: "Reassign failed" },
  "nlEdit.applyFailed": { "zh-TW": "套用失敗", en: "Apply failed" },
  "nlEdit.appliedMsg": {
    "zh-TW": "已套用 {count} 項操作 (影響 {touched} 處)。{undoNote}",
    en: "Applied {count} operations (affecting {touched} places). {undoNote}",
  },
  "nlEdit.undoNoteMixed": {
    "zh-TW": "（reassign 與區間操作為不同的復原步驟）",
    en: "(reassign and range operations are separate undo steps)",
  },
  "nlEdit.undoNoteReassign": {
    "zh-TW": "（每個 reassign 為獨立的復原步驟）",
    en: "(each reassign is a separate undo step)",
  },
  "nlEdit.undoNoteRange": {
    "zh-TW": "（可用工具列 ↶ 一次還原整批）",
    en: "(use the toolbar ↶ to undo the whole batch at once)",
  },
  // describeOp — op descriptions
  "nlEdit.opReassign": {
    "zh-TW": "把「{source}」改分配給「{target}」",
    en: "Reassign \"{source}\" to \"{target}\"",
  },
  "nlEdit.opRangeSingle": {
    "zh-TW": "第 {n} 小節",
    en: "measure {n}",
  },
  "nlEdit.opRangeSpan": {
    "zh-TW": "第 {start}–{end} 小節",
    en: "measures {start}–{end}",
  },
  "nlEdit.opTransposeNoop": {
    "zh-TW": "{part}・{range}・移調 0 (無變化)",
    en: "{part} · {range} · transpose 0 (no change)",
  },
  "nlEdit.opTranspose": {
    "zh-TW": "{part}・{range}・{dir} {semitones} 個半音{oct}",
    en: "{part} · {range} · {dir} {semitones} semitones{oct}",
  },
  "nlEdit.transposeUp": { "zh-TW": "升高", en: "up" },
  "nlEdit.transposeDown": { "zh-TW": "降低", en: "down" },
  "nlEdit.octaveSuffix": {
    "zh-TW": "（{n} 個八度）",
    en: " ({n} octaves)",
  },
  "nlEdit.opArticulationClear": {
    "zh-TW": "{part}・{range}・清除所有演奏法",
    en: "{part} · {range} · clear all articulations",
  },
  "nlEdit.opArticulation": {
    "zh-TW": "{part}・{range}・演奏法{verb} {articulation}",
    en: "{part} · {range} · {verb} articulation {articulation}",
  },
  "nlEdit.articulationAdd": { "zh-TW": "附加", en: "add" },
  "nlEdit.articulationSet": { "zh-TW": "設為", en: "set" },
  "nlEdit.opRest": {
    "zh-TW": "{part}・{range}・整段改為休止符",
    en: "{part} · {range} · turn the whole range into rests",
  },
  "nlEdit.opDynamic": {
    "zh-TW": "{part}・{range}・力度設為 {dynamic}",
    en: "{part} · {range} · set dynamic to {dynamic}",
  },
  // ── LLMSettingsDialog ─────────────────────────────────────────────────
  "llmSettings.title": {
    "zh-TW": "🤖 AI 模型設定",
    en: "🤖 AI Model Settings",
  },
  "llmSettings.close": { "zh-TW": "關閉", en: "Close" },
  "llmSettings.loading": {
    "zh-TW": "讀取設定中...",
    en: "Loading settings...",
  },
  "llmSettings.providerOpenaiCompat": {
    "zh-TW": "OpenAI 相容 (OpenAI / Groq / vLLM …)",
    en: "OpenAI-compatible (OpenAI / Groq / vLLM …)",
  },
  "llmSettings.providerOllama": {
    "zh-TW": "Ollama (本地模型)",
    en: "Ollama (local model)",
  },
  "llmSettings.keyHintAnthropic": {
    "zh-TW": "需設定環境變數 ANTHROPIC_API_KEY 或 LLM_API_KEY",
    en: "Set the ANTHROPIC_API_KEY or LLM_API_KEY environment variable",
  },
  "llmSettings.keyHintOpenaiCompat": {
    "zh-TW": "需設定環境變數 LLM_API_KEY (localhost endpoint 可免)",
    en:
      "Set the LLM_API_KEY environment variable (not needed for a localhost endpoint)",
  },
  "llmSettings.keyHintOllama": {
    "zh-TW": "本地 Ollama 通常不需 API key",
    en: "Local Ollama usually needs no API key",
  },
  "llmSettings.statusReady": {
    "zh-TW": "✓ AI 功能已就緒 — 改編建議與自然語言改譜可用",
    en:
      "✓ AI features ready — arrangement suggestions and natural-language editing are available",
  },
  "llmSettings.statusNotReady": {
    "zh-TW": "○ 尚未就緒 — 請確認下方 provider 與 API key 設定",
    en: "○ Not ready — check the provider and API key settings below",
  },
  "llmSettings.providerLabel": {
    "zh-TW": "模型供應商 (Provider)",
    en: "Model Provider",
  },
  "llmSettings.baseUrlLabel": {
    "zh-TW": "API Endpoint (Base URL)",
    en: "API Endpoint (Base URL)",
  },
  "llmSettings.modelLabel": {
    "zh-TW": "模型 ID (Model)",
    en: "Model ID",
  },
  "llmSettings.keyTitle": { "zh-TW": "關於 API Key", en: "About the API Key" },
  "llmSettings.keyNote": {
    "zh-TW":
      "基於安全考量, API key 不會寫入磁碟 — 僅在啟動前以環境變數傳入, 只存在於主程序記憶體。provider / endpoint / model 則會記住。",
    en:
      "For security, the API key is never written to disk — it is passed via an environment variable at startup and lives only in the main process's memory. The provider / endpoint / model are remembered.",
  },
  "llmSettings.savedHint": { "zh-TW": "✓ 已儲存", en: "✓ Saved" },
  "llmSettings.switchHint": {
    "zh-TW": "切換供應商會自動帶入預設 endpoint",
    en: "Switching provider fills in the default endpoint automatically",
  },
  "llmSettings.saving": { "zh-TW": "儲存中...", en: "Saving..." },
  "llmSettings.save": { "zh-TW": "儲存設定", en: "Save settings" },
  // ── LLMSuggestionDialog ───────────────────────────────────────────────
  "llmSuggest.title": {
    "zh-TW": "🤖 AI 改編建議",
    en: "🤖 AI Arrangement Suggestions",
  },
  "llmSuggest.close": { "zh-TW": "關閉", en: "Close" },
  "llmSuggest.detecting": {
    "zh-TW": "偵測 API 可用性...",
    en: "Checking API availability...",
  },
  "llmSuggest.disabledTitle": {
    "zh-TW": "未啟用 AI 建議",
    en: "AI suggestions not enabled",
  },
  "llmSuggest.disabledBody": {
    "zh-TW": "請在啟動 Score Arranger 前設定環境變數:",
    en: "Set the environment variable before launching Score Arranger:",
  },
  "llmSuggest.keyNote": {
    "zh-TW": "API key 只存在於主程序記憶體, 不會寫入磁碟也不會送給 renderer。",
    en:
      "The API key lives only in the main process's memory — it is never written to disk nor sent to the renderer.",
  },
  "llmSuggest.sectionLabel": { "zh-TW": "段落描述:", en: "Section summary:" },
  "llmSuggest.queryLabel": {
    "zh-TW": "你想問什麼?",
    en: "What would you like to ask?",
  },
  "llmSuggest.queryPlaceholder": {
    "zh-TW": "例: 太難拉, 簡化但保留旋律走向 / 這段和聲覺得怪 / 想要更輕快",
    en:
      "e.g. too hard to play, simplify but keep the melodic contour / this harmony sounds odd / I want it lighter",
  },
  "llmSuggest.asking": { "zh-TW": "詢問中...", en: "Asking..." },
  "llmSuggest.askClaude": { "zh-TW": "詢問 Claude", en: "Ask Claude" },
  "llmSuggest.submitHint": {
    "zh-TW": "⌘+Enter 送出",
    en: "⌘+Enter to submit",
  },
  "llmSuggest.responseFailed": {
    "zh-TW": "AI 回應失敗",
    en: "The AI failed to respond",
  },
  // ── MeasureEditor ─────────────────────────────────────────────────────
  "measureEdit.title": {
    "zh-TW": "編輯 第 {n} 小節",
    en: "Edit Measure {n}",
  },
  "measureEdit.midiTooltip": {
    "zh-TW": "MIDI: {devices} 已連線, 按鍵替換選定音高",
    en: "MIDI: {devices} connected — press a key to replace the selected pitch",
  },
  "measureEdit.llmTooltip": {
    "zh-TW": "用 Claude AI 問改編建議",
    en: "Ask Claude AI for arrangement suggestions",
  },
  "measureEdit.close": { "zh-TW": "關閉", en: "Close" },
  "measureEdit.loadingEvents": {
    "zh-TW": "⌛ 載入小節事件...",
    en: "⌛ Loading measure events...",
  },
  "measureEdit.noEvents": {
    "zh-TW": "此小節沒有事件",
    en: "No events in this measure",
  },
  "measureEdit.articulationLabel": {
    "zh-TW": "articulation:",
    en: "articulation:",
  },
  "measureEdit.articulationApply": {
    "zh-TW": "整個小節 {part} 套用 {articulation}",
    en: "Apply {articulation} to part {part} across the whole measure",
  },
  "measureEdit.clear": { "zh-TW": "clear", en: "clear" },
  "measureEdit.clearArticulationTooltip": {
    "zh-TW": "清除所有 articulation",
    en: "Clear all articulations",
  },
  "measureEdit.rest": { "zh-TW": "(休止)", en: "(rest)" },
  "measureEdit.lockedTooltip": {
    "zh-TW": "已鎖定 — repair 不會動此音, 點擊解鎖",
    en: "Locked — repair will not touch this note; click to unlock",
  },
  "measureEdit.unlockedTooltip": {
    "zh-TW": "鎖定此音 — repair 不會覆寫",
    en: "Lock this note — repair will not overwrite it",
  },
  "measureEdit.octaveUpTooltip": { "zh-TW": "上移八度", en: "Up an octave" },
  "measureEdit.octaveDownTooltip": {
    "zh-TW": "下移八度",
    en: "Down an octave",
  },
  "measureEdit.semitoneUpTooltip": {
    "zh-TW": "+1 半音",
    en: "+1 semitone",
  },
  "measureEdit.semitoneDownTooltip": {
    "zh-TW": "-1 半音",
    en: "-1 semitone",
  },
  "measureEdit.dynamicNone": { "zh-TW": "(無)", en: "(none)" },
  "measureEdit.dynamicTooltip": {
    "zh-TW": "改力度",
    en: "Change dynamic",
  },
  "measureEdit.halveTooltip": {
    "zh-TW": "時值縮一半 (♩ → ♪)",
    en: "Halve duration (♩ → ♪)",
  },
  "measureEdit.doubleTooltip": {
    "zh-TW": "時值加倍 (♪ → ♩)",
    en: "Double duration (♪ → ♩)",
  },
  "measureEdit.addDotTooltip": {
    "zh-TW": "加附點 (×1.5)",
    en: "Add dot (×1.5)",
  },
  "measureEdit.deleteTooltip": {
    "zh-TW": "替換為休止符",
    en: "Replace with a rest",
  },
  "measureEdit.footerHintIntro": {
    "zh-TW": "💡 點任一行選定該事件, 按 ",
    en: "💡 Click any row to select the event; press ",
  },
  "measureEdit.footerHintSemitone": {
    "zh-TW": " 移半音, ",
    en: " for a semitone, ",
  },
  "measureEdit.footerHintOctave": {
    "zh-TW": " 移八度, ",
    en: " for an octave, ",
  },
  "measureEdit.footerHintDelete": {
    "zh-TW": " 刪除。⌘Z 可 undo。",
    en: " to delete. ⌘Z to undo.",
  },
  "measureEdit.applyingArticulation": {
    "zh-TW": "套用 {articulation}...",
    en: "Applying {articulation}...",
  },
  "measureEdit.editingAction": {
    "zh-TW": "編輯 {action}...",
    en: "Editing {action}...",
  },
  "measureEdit.articulationFailed": {
    "zh-TW": "套用 articulation 失敗",
    en: "Failed to apply articulation",
  },
  "measureEdit.editFailed": { "zh-TW": "編輯失敗", en: "Editing failed" },
  "measureEdit.llmMeasureLabel": {
    "zh-TW": "第 {n} 小節:",
    en: "Measure {n}:",
  },
  "measureEdit.llmNoEvents": {
    "zh-TW": "(沒有事件)",
    en: "(no events)",
  },
  "measureEdit.llmNote": {
    "zh-TW": "音 {pitch}",
    en: "note {pitch}",
  },
  "measureEdit.llmChord": {
    "zh-TW": "和弦 [{pitches}]",
    en: "chord [{pitches}]",
  },
  "measureEdit.llmRest": { "zh-TW": "休止", en: "rest" },
  "measureEdit.llmEventLine": {
    "zh-TW": "{desc}, 時值 {duration}{dyn}",
    en: "{desc}, duration {duration}{dyn}",
  },
};

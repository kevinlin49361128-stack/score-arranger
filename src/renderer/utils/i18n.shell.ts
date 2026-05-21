import type { BiDict } from "./i18n";

/**
 * 應用外框介面字串 — Toolbar / ZoomControls / TabStrip / VariantBar / App。
 */
export const SHELL_STRINGS: BiDict = {
  // === Toolbar: 編制名稱 ===
  "toolbar.ensemble.violinPiano": {
    "zh-TW": "小提琴 + 鋼琴", en: "Violin + piano",
  },
  "toolbar.ensemble.stringQuartet": {
    "zh-TW": "弦樂四重奏", en: "String quartet",
  },
  "toolbar.ensemble.pianoSolo": { "zh-TW": "鋼琴獨奏", en: "Piano solo" },
  "toolbar.ensemble.harpsichordSolo": {
    "zh-TW": "大鍵琴獨奏", en: "Harpsichord solo",
  },
  "toolbar.ensemble.violinHarpsichord": {
    "zh-TW": "小提琴 + 大鍵琴", en: "Violin + harpsichord",
  },
  "toolbar.ensemble.baroqueTrioSonata": {
    "zh-TW": "巴洛克三重奏鳴曲", en: "Baroque trio sonata",
  },
  "toolbar.ensemble.woodwindQuintet": {
    "zh-TW": "木管五重奏", en: "Woodwind quintet",
  },
  "toolbar.ensemble.brassQuintet": {
    "zh-TW": "銅管五重奏", en: "Brass quintet",
  },
  "toolbar.ensemble.guitarSolo": {
    "zh-TW": "吉他獨奏", en: "Guitar solo",
  },
  "toolbar.ensemble.luteSolo": {
    "zh-TW": "魯特琴獨奏", en: "Lute solo",
  },
  "toolbar.ensemble.harpSolo": {
    "zh-TW": "豎琴獨奏", en: "Harp solo",
  },
  "toolbar.ensemble.fluteGuitar": {
    "zh-TW": "長笛 + 吉他", en: "Flute + guitar",
  },

  // === Toolbar: 編制下拉選項 (短標籤) ===
  "toolbar.ensembleOpt.violinPiano": {
    "zh-TW": "小提琴+鋼琴", en: "Violin + piano",
  },
  "toolbar.ensembleOpt.stringQuartet": {
    "zh-TW": "弦樂四重奏", en: "String quartet",
  },
  "toolbar.ensembleOpt.pianoSolo": { "zh-TW": "鋼琴獨奏", en: "Piano solo" },
  "toolbar.ensembleOpt.harpsichordSolo": {
    "zh-TW": "大鍵琴獨奏", en: "Harpsichord solo",
  },
  "toolbar.ensembleOpt.violinHarpsichord": {
    "zh-TW": "小提琴+大鍵琴", en: "Violin + harpsichord",
  },
  "toolbar.ensembleOpt.baroqueTrioSonata": {
    "zh-TW": "巴洛克三重奏鳴曲", en: "Baroque trio sonata",
  },
  "toolbar.ensembleOpt.woodwindQuintet": {
    "zh-TW": "木管五重奏", en: "Woodwind quintet",
  },
  "toolbar.ensembleOpt.brassQuintet": {
    "zh-TW": "銅管五重奏", en: "Brass quintet",
  },
  "toolbar.ensembleOpt.guitarSolo": {
    "zh-TW": "吉他獨奏", en: "Guitar solo",
  },
  "toolbar.ensembleOpt.luteSolo": {
    "zh-TW": "魯特琴獨奏", en: "Lute solo",
  },
  "toolbar.ensembleOpt.harpSolo": {
    "zh-TW": "豎琴獨奏", en: "Harp solo",
  },
  "toolbar.ensembleOpt.fluteGuitar": {
    "zh-TW": "長笛+吉他", en: "Flute + guitar",
  },
  "toolbar.ensembleOpt.customWithCount": {
    "zh-TW": "🛠 自訂 ({count} 人)", en: "🛠 Custom ({count} players)",
  },
  "toolbar.ensembleOpt.custom": {
    "zh-TW": "🛠 自訂編制...", en: "🛠 Custom ensemble...",
  },

  // === Toolbar: 檔案群組 ===
  "toolbar.import": { "zh-TW": "匯入", en: "Import" },
  "toolbar.openProject": {
    "zh-TW": "開啟 .sarr 專案", en: "Open .sarr project",
  },
  "toolbar.saveProject": {
    "zh-TW": "儲存專案 (⌘S)", en: "Save project (⌘S)",
  },

  // === Toolbar: 動作群組 ===
  "toolbar.analyze": { "zh-TW": "分析", en: "Analyze" },
  "toolbar.arrange": { "zh-TW": "改編", en: "Arrange" },
  "toolbar.arrange.to": {
    "zh-TW": "改編為 {ensemble}", en: "Arrange for {ensemble}",
  },
  "toolbar.ensembleSelect": {
    "zh-TW": "選擇目標編制", en: "Choose the target ensemble",
  },
  "toolbar.arrangeOpts": {
    "zh-TW": "改編選項 (自動修復 / 技術水平 / 風格)",
    en: "Arrangement options (auto-repair / skill level / style)",
  },
  "toolbar.nlEdit": {
    "zh-TW": "🤖 改譜", en: "🤖 Edit",
  },
  "toolbar.nlEdit.title": {
    "zh-TW": "用自然語言請 AI 修改改編譜 (移調 / 演奏法 / 力度)",
    en: "Ask AI to edit the arrangement in natural language "
      + "(transpose / articulation / dynamics)",
  },

  // === Toolbar: 改編選項 popover ===
  "toolbar.arrangeOpts.heading": {
    "zh-TW": "改編選項", en: "Arrangement options",
  },
  "toolbar.arrangeOpts.autoRepair": {
    "zh-TW": "改編後自動修復", en: "Auto-repair after arranging",
  },
  "toolbar.arrangeOpts.autoRepair.title": {
    "zh-TW": "改編後自動執行修復迴圈, 嘗試解決音域 / 把位等問題",
    en: "Run the repair loop after arranging to resolve "
      + "range / position issues",
  },
  "toolbar.arrangeOpts.skillLevel": {
    "zh-TW": "演奏者技術水平", en: "Player skill level",
  },
  "toolbar.arrangeOpts.skillLevel.title": {
    "zh-TW": "amateur 會主動縮減和弦 / 避難段, professional 不限",
    en: "Amateur trims chords and hard passages; professional is unrestricted",
  },
  "toolbar.skill.amateur": { "zh-TW": "業餘", en: "Amateur" },
  "toolbar.skill.intermediate": {
    "zh-TW": "中級", en: "Intermediate",
  },
  "toolbar.skill.professional": {
    "zh-TW": "專業", en: "Professional",
  },
  "toolbar.arrangeOpts.style": {
    "zh-TW": "改編風格", en: "Arrangement style",
  },
  "toolbar.arrangeOpts.style.title": {
    "zh-TW": "套用後處理 hooks (旋律 / bass 強化 / continuo 等)",
    en: "Apply post-processing hooks (melody / bass reinforcement / "
      + "continuo, etc.)",
  },

  // === Toolbar: 歷史群組 ===
  "toolbar.undo": { "zh-TW": "Undo (⌘Z)", en: "Undo (⌘Z)" },
  "toolbar.redo": { "zh-TW": "Redo (⇧⌘Z)", en: "Redo (⇧⌘Z)" },

  // === Toolbar: 檢視群組 ===
  "toolbar.heatmap.hide": {
    "zh-TW": "關閉難度熱圖", en: "Hide difficulty heatmap",
  },
  "toolbar.heatmap.show": {
    "zh-TW": "顯示難度熱圖", en: "Show difficulty heatmap",
  },
  "toolbar.layout.toHorizontal": {
    "zh-TW": "切為左右排列 (⌘\\)", en: "Switch to side-by-side layout (⌘\\)",
  },
  "toolbar.layout.toVertical": {
    "zh-TW": "切為上下排列 (⌘\\)", en: "Switch to stacked layout (⌘\\)",
  },
  "toolbar.infoPanel.toBottom": {
    "zh-TW": "資訊欄移到下方", en: "Move info panel to the bottom",
  },
  "toolbar.infoPanel.toSide": {
    "zh-TW": "資訊欄移到右側", en: "Move info panel to the side",
  },

  // === Toolbar: 溢出選單 ===
  "toolbar.overflow.title": {
    "zh-TW": "更多工具 (視窗較窄時自動收合於此)",
    en: "More tools (collapsed here when the window is narrow)",
  },
  "toolbar.overflow.view": { "zh-TW": "檢視", en: "View" },
  "toolbar.overflow.zoom": { "zh-TW": "縮放", en: "Zoom" },
  "toolbar.overflow.export": { "zh-TW": "匯出", en: "Export" },

  // === Toolbar: 設定選單 ===
  "toolbar.settings": { "zh-TW": "設定", en: "Settings" },
  "toolbar.settings.toLight": {
    "zh-TW": "切換為亮色", en: "Switch to light mode",
  },
  "toolbar.settings.toDark": {
    "zh-TW": "切換為暗色", en: "Switch to dark mode",
  },
  "toolbar.settings.toEnglish": {
    "zh-TW": "Switch to English", en: "Switch to English",
  },
  "toolbar.settings.toChinese": {
    "zh-TW": "切換為繁中", en: "Switch to Traditional Chinese",
  },
  "toolbar.settings.llm": {
    "zh-TW": "AI 模型設定", en: "AI model settings",
  },
  "toolbar.settings.about": {
    "zh-TW": "關於 Score Arranger", en: "About Score Arranger",
  },

  // === Toolbar: 載入 / 進度訊息 ===
  "toolbar.loading.undo": { "zh-TW": "Undo...", en: "Undo..." },
  "toolbar.loading.redo": { "zh-TW": "Redo...", en: "Redo..." },
  "toolbar.loading.saveProject": {
    "zh-TW": "儲存專案...", en: "Saving project...",
  },
  "toolbar.loading.loadProject": {
    "zh-TW": "載入專案...", en: "Loading project...",
  },
  "toolbar.loading.omrCheck": {
    "zh-TW": "檢查 OMR 環境...", en: "Checking OMR environment...",
  },
  "toolbar.loading.omrRunning": {
    "zh-TW": "Audiveris 辨識中... (大型 PDF 約 1-3 分鐘)",
    en: "Audiveris recognizing... (large PDFs take about 1-3 minutes)",
  },
  "toolbar.loading.amtCheck": {
    "zh-TW": "檢查 basic-pitch 環境...",
    en: "Checking basic-pitch environment...",
  },
  "toolbar.loading.amtRunning": {
    "zh-TW": "basic-pitch 辨識音訊中 (1-3 分鐘)...",
    en: "basic-pitch transcribing audio (1-3 minutes)...",
  },
  "toolbar.loading.scoreSize": {
    "zh-TW": "檢查樂譜大小...", en: "Checking score size...",
  },
  "toolbar.loading.largeScore": {
    "zh-TW":
      "大譜偵測 ({count} 小節) — 預覽只顯示前 {preview} 小節, "
      + "改編仍用完整譜",
    en:
      "Large score detected ({count} measures) — preview shows only the "
      + "first {preview} measures; arranging still uses the full score",
  },
  "toolbar.loading.loadingScore": {
    "zh-TW": "正在載入樂譜...", en: "Loading score...",
  },
  "toolbar.loading.analyzing": {
    "zh-TW": "正在分析樂譜...", en: "Analyzing score...",
  },
  "toolbar.loading.arranging": {
    "zh-TW": "正在改編...", en: "Arranging...",
  },

  // === Toolbar: 錯誤訊息 ===
  "toolbar.error.undo": { "zh-TW": "Undo 失敗", en: "Undo failed" },
  "toolbar.error.redo": { "zh-TW": "Redo 失敗", en: "Redo failed" },
  "toolbar.error.nothingToSave": {
    "zh-TW": "尚無內容可儲存", en: "Nothing to save yet",
  },
  "toolbar.error.saveFailed": {
    "zh-TW": "儲存失敗", en: "Save failed",
  },
  "toolbar.error.loadProjectFailed": {
    "zh-TW": "載入專案失敗", en: "Failed to load project",
  },
  "toolbar.error.omrFailed": { "zh-TW": "OMR 失敗", en: "OMR failed" },
  "toolbar.error.amtMissing": {
    "zh-TW": "音訊轉譜需要 basic-pitch (缺: {missing})\n\n{hints}",
    en: "Audio transcription requires basic-pitch (missing: {missing})"
      + "\n\n{hints}",
  },
  "toolbar.error.amtFailed": { "zh-TW": "AMT 失敗", en: "AMT failed" },
  "toolbar.error.loadScoreFailed": {
    "zh-TW": "載入樂譜失敗", en: "Failed to load score",
  },
  "toolbar.error.analyzeFailed": {
    "zh-TW": "分析失敗", en: "Analysis failed",
  },
  "toolbar.error.arrangeFailed": {
    "zh-TW": "改編失敗", en: "Arrangement failed",
  },

  // === Toolbar: OMR 進度浮窗 ===
  "toolbar.omrProgress.heading": {
    "zh-TW": "Audiveris 辨識中", en: "Audiveris recognizing",
  },
  "toolbar.omrProgress.elapsed": {
    "zh-TW": "已用時 {sec}s · 大型 PDF 需 1-3 分鐘",
    en: "Elapsed {sec}s · large PDFs take 1-3 minutes",
  },

  // === ZoomControls ===
  "zoom.control": {
    "zh-TW": "縮放 (⌘+ / ⌘- / ⌘0)", en: "Zoom (⌘+ / ⌘- / ⌘0)",
  },
  "zoom.autoFit.on": {
    "zh-TW": "自動縮放: 依面板排列方向 fit-to-screen",
    en: "Auto-fit: fit to screen along the panel layout direction",
  },
  "zoom.autoFit.off": { "zh-TW": "手動縮放", en: "Manual zoom" },
  "zoom.out": { "zh-TW": "縮小 ⌘-", en: "Zoom out ⌘-" },
  "zoom.autoFitPct": {
    "zh-TW": "自動縮放 {pct}%", en: "Auto-fit {pct}%",
  },
  "zoom.reset": { "zh-TW": "重置縮放 ⌘0", en: "Reset zoom ⌘0" },
  "zoom.in": { "zh-TW": "放大 ⌘+", en: "Zoom in ⌘+" },

  // === TabStrip ===
  "tab.reloadingScore": {
    "zh-TW": "重新載入樂譜...", en: "Reloading score...",
  },
  "tab.reloadFailed": {
    "zh-TW": "重新載入失敗", en: "Reload failed",
  },
  "tab.emptyTab": { "zh-TW": "(空白分頁)", en: "(empty tab)" },
  "tab.close": { "zh-TW": "關閉分頁", en: "Close tab" },
  "tab.new": { "zh-TW": "新分頁", en: "New tab" },

  // === VariantBar ===
  "variant.compareLabel": { "zh-TW": "版本比較:", en: "Version comparison:" },
  "variant.savedAt": {
    "zh-TW": "儲存於 {time}", en: "Saved at {time}",
  },
  "variant.stopCompare": { "zh-TW": "停止比較", en: "Stop comparing" },
  "variant.compareDiff": {
    "zh-TW": "與目前版本比較差異",
    en: "Compare differences with the current version",
  },
  "variant.deleteConfirm": {
    "zh-TW": "刪除「{name}」?", en: "Delete \"{name}\"?",
  },
  "variant.delete": { "zh-TW": "刪除", en: "Delete" },
  "variant.quality": {
    "zh-TW": "旋 {melody} · 和 {harmony} · 奏 {playability}",
    en: "Mel {melody} · Harm {harmony} · Play {playability}",
  },
  "variant.saveAs": { "zh-TW": "+ 存為版本", en: "+ Save as version" },
  "variant.saveAs.title": {
    "zh-TW": "把目前的改編結果儲存為一個版本, 之後可切回比較",
    en: "Save the current arrangement as a version to compare later",
  },

  // === App ===
  "app.loading.loadSampleScore": {
    "zh-TW": "載入範例樂譜...", en: "Loading sample score...",
  },
  "app.error.loadSampleFailed": {
    "zh-TW": "載入範例失敗", en: "Failed to load sample",
  },
  "app.loading.arranging": { "zh-TW": "改編中…", en: "Arranging…" },
  "app.error.arrangeFailed": {
    "zh-TW": "改編失敗", en: "Arrangement failed",
  },
  "app.loading.transpose": {
    "zh-TW": "轉調 {semitones}...", en: "Transposing {semitones}...",
  },
  "app.error.dragTransposeFailed": {
    "zh-TW": "拖曳轉調失敗", en: "Drag transpose failed",
  },
  "app.panel.sourceLabel.corpus": {
    "zh-TW": "預設: {name}", en: "Built-in: {name}",
  },
  "app.panel.sourceLabel.file": {
    "zh-TW": "原始樂譜: {name}", en: "Source score: {name}",
  },
  "app.panel.sourceLabel.default": {
    "zh-TW": "原始樂譜", en: "Source score",
  },
  "app.panel.sourceTitle": { "zh-TW": "原譜", en: "Source" },
  "app.panel.targetTitle": { "zh-TW": "改編譜", en: "Arrangement" },
  "app.panel.targetLabel.result": {
    "zh-TW": "改編結果: {name}", en: "Arrangement: {name}",
  },
  "app.panel.targetLabel.default": {
    "zh-TW": "改編結果", en: "Arrangement",
  },
  "app.resizer.footer": {
    "zh-TW": "拖曳調整下方面板高度 / 雙擊重置",
    en: "Drag to resize the bottom panel / double-click to reset",
  },
  "app.resizer.side": {
    "zh-TW": "拖曳調整側邊欄寬度 / 雙擊重置",
    en: "Drag to resize the side panel / double-click to reset",
  },
  "app.rendererError": { "zh-TW": "Renderer 錯誤", en: "Renderer error" },
};

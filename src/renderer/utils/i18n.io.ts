import type { BiDict } from "./i18n";

/**
 * 匯出 / 播放 / 載入字串 — ExportPanel / ExportMenu / PlaybackControls /
 * ScoreViewer / LoadingOverlay / sessionStore / pdfExport / useMidiInput。
 */
export const IO_STRINGS: BiDict = {
  // === ExportPanel ===
  "export.intro": {
    "zh-TW":
      "選擇要匯出的格式。對音樂人最常用的是 MusicXML 給 MuseScore / Dorico 印譜。",
    en:
      "Choose an export format. The most common for musicians is MusicXML "
      + "for engraving in MuseScore / Dorico.",
  },
  "export.option.openExternal.label": {
    "zh-TW": "在 MuseScore / Dorico 開啟",
    en: "Open in MuseScore / Dorico",
  },
  "export.option.openExternal.ext": {
    "zh-TW": "外部編輯器",
    en: "External editor",
  },
  "export.option.openExternal.desc": {
    "zh-TW":
      "直接用系統預設樂譜軟體開啟改編結果,進行進階記譜編輯"
      + "(力度、表情、版面、分譜)。返回 APP 後可重新匯入修改版。",
    en:
      "Open the arrangement in your default notation software for advanced "
      + "engraving edits (dynamics, expression, layout, parts). "
      + "You can re-import the edited version afterwards.",
  },
  "export.option.musicxml.label": {
    "zh-TW": "MusicXML",
    en: "MusicXML",
  },
  "export.option.musicxml.desc": {
    "zh-TW":
      "標準樂譜交換格式。可在 MuseScore、Dorico、Sibelius、Finale 開啟,"
      + "適合印譜或繼續編輯。",
    en:
      "Standard score interchange format. Opens in MuseScore, Dorico, "
      + "Sibelius and Finale — good for engraving or further editing.",
  },
  "export.option.pdf.label": {
    "zh-TW": "PDF (列印用)",
    en: "PDF (for printing)",
  },
  "export.option.pdf.desc": {
    "zh-TW":
      "透過 verovio 渲染為 SVG 後輸出 PDF。直接可印,適合給演奏者紙本。",
    en:
      "Rendered to SVG via verovio, then output as PDF. Ready to print — "
      + "good for handing players a paper copy.",
  },
  "export.option.midi.label": {
    "zh-TW": "MIDI",
    en: "MIDI",
  },
  "export.option.midi.desc": {
    "zh-TW":
      "MIDI 演奏資料。可在 Logic Pro、Cubase、Ableton 等 DAW 開啟,"
      + "適合進一步混音或編曲。",
    en:
      "MIDI performance data. Opens in DAWs such as Logic Pro, Cubase and "
      + "Ableton — good for further mixing or arranging.",
  },
  "export.option.wav.label": {
    "zh-TW": "WAV (試聽用)",
    en: "WAV (for preview)",
  },
  "export.option.wav.desc": {
    "zh-TW":
      "純合成音色快速渲染為 WAV (44.1kHz 16-bit)。適合分享試聽,不適合正式發行。",
    en:
      "Quick render to WAV (44.1kHz 16-bit) using synthesized sounds. "
      + "Good for sharing a preview, not for formal release.",
  },
  "export.option.sarr.label": {
    "zh-TW": "Score Arranger 專案",
    en: "Score Arranger project",
  },
  "export.option.sarr.desc": {
    "zh-TW":
      "完整保留來源、改編、修改狀態。下次回到 Score Arranger 可繼續編輯。",
    en:
      "Keeps the source, arrangement and edit state intact. Continue editing "
      + "next time you open Score Arranger.",
  },
  "export.error.noArrangement": {
    "zh-TW": "尚無改編結果可匯出,請先執行「改編」",
    en: "No arrangement to export yet — run Arrange first",
  },
  "export.error.nothingToSave": {
    "zh-TW": "尚無內容可儲存",
    en: "Nothing to save yet",
  },
  "export.error.noMusicXML": {
    "zh-TW": "尚無 MusicXML 內容",
    en: "No MusicXML content yet",
  },
  "export.error.noArrangementShort": {
    "zh-TW": "尚無改編結果",
    en: "No arrangement yet",
  },
  "export.loading.openExternal": {
    "zh-TW": "開啟外部編輯器...",
    en: "Opening external editor...",
  },
  "export.error.openFailed": {
    "zh-TW": "開啟失敗",
    en: "Failed to open",
  },
  "export.loading.renderAudio": {
    "zh-TW": "渲染音訊 (首次載入合成引擎)...",
    en: "Rendering audio (loading the synth engine on first use)...",
  },
  "export.error.getMidiFailed": {
    "zh-TW": "取得 MIDI 失敗",
    en: "Failed to get MIDI",
  },
  "export.error.wavFailed": {
    "zh-TW": "WAV 匯出失敗: {message}",
    en: "WAV export failed: {message}",
  },
  "export.loading.generatePdf": {
    "zh-TW": "產生 PDF (首次需載入引擎)...",
    en: "Generating PDF (loading the engine on first use)...",
  },
  "export.error.pdfFailed": {
    "zh-TW": "PDF 匯出失敗: {message}",
    en: "PDF export failed: {message}",
  },
  "export.loading.exporting": {
    "zh-TW": "匯出 {label}...",
    en: "Exporting {label}...",
  },
  "export.error.exportFailed": {
    "zh-TW": "匯出失敗",
    en: "Export failed",
  },
  "export.button.exportAs": {
    "zh-TW": "匯出為 {label}",
    en: "Export as {label}",
  },
  "export.parts.title": {
    "zh-TW": "分譜 (每位演奏者一份)",
    en: "Parts (one per player)",
  },
  "export.parts.desc": {
    "zh-TW":
      "把改編結果依演奏者拆成獨立譜面。給弦樂四重奏團員時, 每人只要拿自己那份。",
    en:
      "Split the arrangement into separate parts by player. For a string "
      + "quartet, each member only needs their own part.",
  },
  "export.parts.loading.generatePartPdf": {
    "zh-TW": "產生 {name} 分譜 PDF...",
    en: "Generating {name} part PDF...",
  },
  "export.parts.error.getPartFailed": {
    "zh-TW": "取得分譜失敗",
    en: "Failed to get part",
  },
  "export.parts.error.partExportFailed": {
    "zh-TW": "分譜匯出失敗: {message}",
    en: "Part export failed: {message}",
  },
  "export.parts.loading.batchPartPdf": {
    "zh-TW": "批次產生 {count} 份分譜 PDF...",
    en: "Batch-generating {count} part PDFs...",
  },
  "export.parts.loading.partPdfProgress": {
    "zh-TW": "分譜 PDF {index}/{total}: {name}...",
    en: "Part PDF {index}/{total}: {name}...",
  },
  "export.parts.error.somePartsFailed": {
    "zh-TW": "部分分譜失敗 ({count}): {details}",
    en: "Some parts failed ({count}): {details}",
  },
  "export.parts.error.batchFailed": {
    "zh-TW": "批次匯出失敗: {message}",
    en: "Batch export failed: {message}",
  },
  "export.parts.loading.exportPartMusicXML": {
    "zh-TW": "匯出 {name} MusicXML...",
    en: "Exporting {name} MusicXML...",
  },
  "export.parts.downloadAllPdf": {
    "zh-TW": "📥 下載全部 PDF ({count})",
    en: "📥 Download all PDFs ({count})",
  },
  "export.parts.downloadAllPdf.title": {
    "zh-TW": "一次下載全部 {count} 份 PDF 分譜",
    en: "Download all {count} part PDFs at once",
  },
  "export.parts.downloadPartPdf.title": {
    "zh-TW": "下載此演奏者的 PDF 分譜",
    en: "Download this player's PDF part",
  },
  "export.parts.downloadPartXml.title": {
    "zh-TW": "下載此演奏者的 MusicXML",
    en: "Download this player's MusicXML",
  },

  // === ExportMenu ===
  "exportMenu.loading.exportFile": {
    "zh-TW": "匯出 {format}...",
    en: "Exporting {format}...",
  },
  "exportMenu.error.exportFailed": {
    "zh-TW": "匯出失敗",
    en: "Export failed",
  },
  "exportMenu.error.noArrangement": {
    "zh-TW": "尚無改編結果",
    en: "No arrangement yet",
  },
  "exportMenu.loading.generatePdf": {
    "zh-TW": "產生 PDF (首次需載入引擎)...",
    en: "Generating PDF (loading the engine on first use)...",
  },
  "exportMenu.error.pdfFailed": {
    "zh-TW": "PDF 失敗: {message}",
    en: "PDF failed: {message}",
  },
  "exportMenu.loading.batchPartPdf": {
    "zh-TW": "批次產生 {count} 份分譜 PDF...",
    en: "Batch-generating {count} part PDFs...",
  },
  "exportMenu.loading.partPdfProgress": {
    "zh-TW": "分譜 PDF {index}/{total}: {name}...",
    en: "Part PDF {index}/{total}: {name}...",
  },
  "exportMenu.error.somePartsFailed": {
    "zh-TW": "部分分譜失敗 ({count}): {details}",
    en: "Some parts failed ({count}): {details}",
  },
  "exportMenu.error.partExportFailed": {
    "zh-TW": "分譜匯出失敗: {message}",
    en: "Part export failed: {message}",
  },
  "exportMenu.loading.renderAudio": {
    "zh-TW": "渲染音訊...",
    en: "Rendering audio...",
  },
  "exportMenu.error.getMidiFailed": {
    "zh-TW": "取得 MIDI 失敗",
    en: "Failed to get MIDI",
  },
  "exportMenu.error.wavFailed": {
    "zh-TW": "WAV 失敗: {message}",
    en: "WAV failed: {message}",
  },
  "exportMenu.button": {
    "zh-TW": "匯出 ▾",
    en: "Export ▾",
  },
  "exportMenu.button.title": {
    "zh-TW": "匯出改編結果",
    en: "Export the arrangement",
  },
  "exportMenu.group.fullScore": {
    "zh-TW": "總譜",
    en: "Full score",
  },
  "exportMenu.item.pdf": {
    "zh-TW": "📕 PDF (.pdf)",
    en: "📕 PDF (.pdf)",
  },
  "exportMenu.item.pdf.desc": {
    "zh-TW": "用 verovio 排版, 列印 / 分享用",
    en: "Engraved with verovio — for printing / sharing",
  },
  "exportMenu.item.musicxml": {
    "zh-TW": "📄 MusicXML (.musicxml)",
    en: "📄 MusicXML (.musicxml)",
  },
  "exportMenu.item.musicxml.desc": {
    "zh-TW": "MuseScore / Dorico 可開",
    en: "Opens in MuseScore / Dorico",
  },
  "exportMenu.item.midi": {
    "zh-TW": "🎹 MIDI (.mid)",
    en: "🎹 MIDI (.mid)",
  },
  "exportMenu.item.midi.desc": {
    "zh-TW": "DAW 使用",
    en: "For use in a DAW",
  },
  "exportMenu.item.wav": {
    "zh-TW": "🔊 WAV (試聽)",
    en: "🔊 WAV (preview)",
  },
  "exportMenu.item.wav.desc": {
    "zh-TW": "純合成音色快速渲染",
    en: "Quick render with synthesized sounds",
  },
  "exportMenu.group.parts": {
    "zh-TW": "分譜 (每位演奏者一份)",
    en: "Parts (one per player)",
  },
  "exportMenu.item.allPartsPdf": {
    "zh-TW": "📥 全部 PDF ({count} 份)",
    en: "📥 All PDFs ({count})",
  },

  // === PlaybackControls ===
  "playback.error.noSource": {
    "zh-TW": "尚無原譜可播放",
    en: "No source score to play yet",
  },
  "playback.error.noArrangement": {
    "zh-TW": "尚無改編結果, 請先改編",
    en: "No arrangement yet — arrange first",
  },
  "playback.error.getMidiFailed": {
    "zh-TW": "取得 MIDI 失敗",
    en: "Failed to get MIDI",
  },
  "playback.side.source": {
    "zh-TW": "原譜",
    en: "source score",
  },
  "playback.side.target": {
    "zh-TW": "改編譜",
    en: "arrangement",
  },
  "playback.rewind.title": {
    "zh-TW": "回到開頭 ({side})",
    en: "Back to start ({side})",
  },
  "playback.pause.title": {
    "zh-TW": "暫停",
    en: "Pause",
  },
  "playback.resume.title": {
    "zh-TW": "繼續播放 ({side})",
    en: "Resume playback ({side})",
  },
  "playback.play.title": {
    "zh-TW": "播放 {side}",
    en: "Play {side}",
  },
  "playback.stop.title": {
    "zh-TW": "停止",
    en: "Stop",
  },
  "playback.progress.idle": {
    "zh-TW": "尚未播放",
    en: "Not playing",
  },
  "playback.progress.seek": {
    "zh-TW": "{percent}% — 點選跳轉",
    en: "{percent}% — click to seek",
  },
  "playback.samples.failed": {
    "zh-TW": "Salamander 取樣載入失敗,使用純合成",
    en: "Salamander samples failed to load — using pure synthesis",
  },
  "playback.samples.hint": {
    "zh-TW": "勾選使用 Salamander 鋼琴取樣 (需網路)",
    en: "Check to use Salamander piano samples (requires network)",
  },
  "playback.samples.label": {
    "zh-TW": "取樣",
    en: "Samples",
  },
  "playback.loop.hint": {
    "zh-TW": "勾選後, 播放至「到」小節時自動跳回「從」小節",
    en: "When checked, jumps back to the From measure on reaching the To measure",
  },
  "playback.loop.from.placeholder": {
    "zh-TW": "從",
    en: "From",
  },
  "playback.loop.from.title": {
    "zh-TW": "loop 起始小節",
    en: "Loop start measure",
  },
  "playback.loop.to.placeholder": {
    "zh-TW": "到",
    en: "To",
  },
  "playback.loop.to.title": {
    "zh-TW": "loop 結束小節 (含)",
    en: "Loop end measure (inclusive)",
  },
  "playback.cursorMode.noteHint": {
    "zh-TW": "目前: 音符級游標 (高亮當前音符) — 點切換為小節級",
    en: "Current: note-level cursor (highlights the current note) — "
      + "click to switch to measure level",
  },
  "playback.cursorMode.measureHint": {
    "zh-TW": "目前: 小節級游標 (整小節綠線) — 點切換為音符級",
    en: "Current: measure-level cursor (full-measure green line) — "
      + "click to switch to note level",
  },
  "playback.cursorMode.note": {
    "zh-TW": "♪ 音符",
    en: "♪ Note",
  },
  "playback.cursorMode.measure": {
    "zh-TW": "▮ 小節",
    en: "▮ Measure",
  },

  // === ScoreViewer ===
  "scoreViewer.error.renderFailed": {
    "zh-TW": "渲染失敗: {message}",
    en: "Render failed: {message}",
  },
  "scoreViewer.empty": {
    "zh-TW": "(尚未載入樂譜)",
    en: "(No score loaded yet)",
  },
  "scoreViewer.overlay.difficulty": {
    "zh-TW": "m.{measure} — 難度 {score}/5",
    en: "m.{measure} — difficulty {score}/5",
  },
  "scoreViewer.overlay.diff": {
    "zh-TW": "m.{measure} — 與另一版本不同",
    en: "m.{measure} — differs from the other version",
  },
  "scoreViewer.drag.semitones": {
    "zh-TW": "{semitones} 半音",
    en: "{semitones} semitones",
  },

  // === LoadingOverlay ===
  "loading.processing": {
    "zh-TW": "處理中…",
    en: "Processing…",
  },
  "loading.elapsed": {
    "zh-TW": "已等待 {seconds} 秒",
    en: "Waited {seconds}s",
  },
  "loading.elapsed.longHint": {
    "zh-TW": " — 大型樂譜需要較久，請稍候",
    en: " — large scores take longer, please wait",
  },

  // === sessionStore ===
  "session.tab.untitled": {
    "zh-TW": "新分頁",
    en: "New tab",
  },
  "session.variant.autoName": {
    "zh-TW": "版本 {letter}",
    en: "Version {letter}",
  },

  // === pdfExport ===
  "pdfExport.error.noWasmExport": {
    "zh-TW": "verovio/wasm 沒有可呼叫的 default export (createVerovioModule)",
    en: "verovio/wasm has no callable default export (createVerovioModule)",
  },
  "pdfExport.error.noToolkitClass": {
    "zh-TW": "verovio/esm 沒有 VerovioToolkit class",
    en: "verovio/esm has no VerovioToolkit class",
  },
  "pdfExport.error.parseFailed": {
    "zh-TW": "verovio 無法解析此 MusicXML",
    en: "verovio could not parse this MusicXML",
  },
  "pdfExport.error.no2dContext": {
    "zh-TW": "無法取得 2D context",
    en: "Could not get a 2D context",
  },

  // === useMidiInput ===
  "midi.error.unsupported": {
    "zh-TW": "此環境不支援 Web MIDI",
    en: "This environment does not support Web MIDI",
  },
  "midi.error.accessFailed": {
    "zh-TW": "無法存取 MIDI: {message}",
    en: "Could not access MIDI: {message}",
  },
};

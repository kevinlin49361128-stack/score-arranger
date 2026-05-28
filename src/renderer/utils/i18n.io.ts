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
    ja:
      "書き出す形式を選んでください。音楽家に最もよく使われるのは、"
      + "MuseScore / Dorico で浄書するための MusicXML です。",
  },
  "export.option.openExternal.label": {
    "zh-TW": "在 MuseScore / Dorico 開啟",
    en: "Open in MuseScore / Dorico",
    ja: "MuseScore / Dorico で開く",
  },
  "export.option.openExternal.ext": {
    "zh-TW": "外部編輯器",
    en: "External editor",
    ja: "外部エディタ",
  },
  "export.option.openExternal.desc": {
    "zh-TW":
      "直接用系統預設樂譜軟體開啟改編結果,進行進階記譜編輯"
      + "(力度、表情、版面、分譜)。返回 APP 後可重新匯入修改版。",
    en:
      "Open the arrangement in your default notation software for advanced "
      + "engraving edits (dynamics, expression, layout, parts). "
      + "You can re-import the edited version afterwards.",
    ja:
      "編曲結果をシステム既定の楽譜ソフトで直接開き、強弱・発想記号・レイアウト・"
      + "パート譜などの高度な記譜編集を行えます。アプリに戻った後、"
      + "編集版を再インポートできます。",
  },
  "export.option.musicxml.label": {
    "zh-TW": "MusicXML",
    en: "MusicXML",
    ja: "MusicXML",
  },
  "export.option.musicxml.desc": {
    "zh-TW":
      "標準樂譜交換格式。可在 MuseScore、Dorico、Sibelius、Finale 開啟,"
      + "適合印譜或繼續編輯。",
    en:
      "Standard score interchange format. Opens in MuseScore, Dorico, "
      + "Sibelius and Finale — good for engraving or further editing.",
    ja:
      "標準的な楽譜交換形式です。MuseScore、Dorico、Sibelius、Finale で開けるため、"
      + "浄書や編集の続行に適しています。",
  },
  "export.option.pdf.label": {
    "zh-TW": "PDF (列印用)",
    en: "PDF (for printing)",
    ja: "PDF (印刷用)",
  },
  "export.option.pdf.desc": {
    "zh-TW":
      "透過 verovio 渲染為 SVG 後輸出 PDF。直接可印,適合給演奏者紙本。",
    en:
      "Rendered to SVG via verovio, then output as PDF. Ready to print — "
      + "good for handing players a paper copy.",
    ja:
      "verovio で SVG にレンダリングしてから PDF を出力します。"
      + "そのまま印刷でき、演奏者に紙の楽譜を渡すのに適しています。",
  },
  "export.option.midi.label": {
    "zh-TW": "MIDI",
    en: "MIDI",
    ja: "MIDI",
  },
  "export.option.midi.desc": {
    "zh-TW":
      "MIDI 演奏資料。可在 Logic Pro、Cubase、Ableton 等 DAW 開啟,"
      + "適合進一步混音或編曲。",
    en:
      "MIDI performance data. Opens in DAWs such as Logic Pro, Cubase and "
      + "Ableton — good for further mixing or arranging.",
    ja:
      "MIDI の演奏データです。Logic Pro、Cubase、Ableton などの DAW で開けるため、"
      + "さらなるミキシングや編曲に適しています。",
  },
  "export.option.wav.label": {
    "zh-TW": "WAV (試聽用)",
    en: "WAV (for preview)",
    ja: "WAV (試聴用)",
  },
  "export.option.wav.desc": {
    "zh-TW":
      "純合成音色快速渲染為 WAV (44.1kHz 16-bit)。適合分享試聽,不適合正式發行。",
    en:
      "Quick render to WAV (44.1kHz 16-bit) using synthesized sounds. "
      + "Good for sharing a preview, not for formal release.",
    ja:
      "合成音色のみで WAV (44.1kHz 16-bit) をすばやくレンダリングします。"
      + "試聴の共有に適しており、正式なリリースには向きません。",
  },
  "export.option.sarr.label": {
    "zh-TW": "Score Arranger 專案",
    en: "Score Arranger project",
    ja: "Score Arranger プロジェクト",
  },
  "export.option.sarr.desc": {
    "zh-TW":
      "完整保留來源、改編、修改狀態。下次回到 Score Arranger 可繼續編輯。",
    en:
      "Keeps the source, arrangement and edit state intact. Continue editing "
      + "next time you open Score Arranger.",
    ja:
      "元の楽譜・編曲・編集状態をすべて保持します。次回 Score Arranger を開いたとき、"
      + "編集を続行できます。",
  },
  "export.error.noArrangement": {
    "zh-TW": "尚無改編結果可匯出,請先執行「改編」",
    en: "No arrangement to export yet — run Arrange first",
    ja: "書き出せる編曲結果がまだありません。先に「編曲」を実行してください",
  },
  "export.error.nothingToSave": {
    "zh-TW": "尚無內容可儲存",
    en: "Nothing to save yet",
    ja: "保存できる内容がまだありません",
  },
  "export.error.noMusicXML": {
    "zh-TW": "尚無 MusicXML 內容",
    en: "No MusicXML content yet",
    ja: "MusicXML の内容がまだありません",
  },
  "export.error.noArrangementShort": {
    "zh-TW": "尚無改編結果",
    en: "No arrangement yet",
    ja: "編曲結果がまだありません",
  },
  "export.loading.openExternal": {
    "zh-TW": "開啟外部編輯器...",
    en: "Opening external editor...",
    ja: "外部エディタを開いています...",
  },
  "export.error.openFailed": {
    "zh-TW": "開啟失敗",
    en: "Failed to open",
    ja: "開けませんでした",
  },
  "export.loading.renderAudio": {
    "zh-TW": "渲染音訊 (首次載入合成引擎)...",
    en: "Rendering audio (loading the synth engine on first use)...",
    ja: "音声をレンダリングしています (初回は合成エンジンを読み込みます)...",
  },
  "export.error.getMidiFailed": {
    "zh-TW": "取得 MIDI 失敗",
    en: "Failed to get MIDI",
    ja: "MIDI の取得に失敗しました",
  },
  "export.error.wavFailed": {
    "zh-TW": "WAV 匯出失敗: {message}",
    en: "WAV export failed: {message}",
    ja: "WAV の書き出しに失敗しました: {message}",
  },
  "export.loading.generatePdf": {
    "zh-TW": "產生 PDF (首次需載入引擎)...",
    en: "Generating PDF (loading the engine on first use)...",
    ja: "PDF を生成しています (初回はエンジンを読み込みます)...",
  },
  "export.error.pdfFailed": {
    "zh-TW": "PDF 匯出失敗: {message}",
    en: "PDF export failed: {message}",
    ja: "PDF の書き出しに失敗しました: {message}",
  },
  "export.loading.exporting": {
    "zh-TW": "匯出 {label}...",
    en: "Exporting {label}...",
    ja: "{label} を書き出しています...",
  },
  "export.error.exportFailed": {
    "zh-TW": "匯出失敗",
    en: "Export failed",
    ja: "書き出しに失敗しました",
  },
  "export.button.exportAs": {
    "zh-TW": "匯出為 {label}",
    en: "Export as {label}",
    ja: "{label} として書き出す",
  },
  "export.parts.title": {
    "zh-TW": "分譜 (每位演奏者一份)",
    en: "Parts (one per player)",
    ja: "パート譜 (演奏者ごとに 1 部)",
  },
  "export.parts.desc": {
    "zh-TW":
      "把改編結果依演奏者拆成獨立譜面。給弦樂四重奏團員時, 每人只要拿自己那份。",
    en:
      "Split the arrangement into separate parts by player. For a string "
      + "quartet, each member only needs their own part.",
    ja:
      "編曲結果を演奏者ごとに独立した楽譜に分割します。弦楽四重奏のメンバーには、"
      + "それぞれ自分のパート譜だけを渡せばよくなります。",
  },
  "export.parts.loading.generatePartPdf": {
    "zh-TW": "產生 {name} 分譜 PDF...",
    en: "Generating {name} part PDF...",
    ja: "{name} のパート譜 PDF を生成しています...",
  },
  "export.parts.error.getPartFailed": {
    "zh-TW": "取得分譜失敗",
    en: "Failed to get part",
    ja: "パート譜の取得に失敗しました",
  },
  "export.parts.error.partExportFailed": {
    "zh-TW": "分譜匯出失敗: {message}",
    en: "Part export failed: {message}",
    ja: "パート譜の書き出しに失敗しました: {message}",
  },
  "export.parts.loading.batchPartPdf": {
    "zh-TW": "批次產生 {count} 份分譜 PDF...",
    en: "Batch-generating {count} part PDFs...",
    ja: "{count} 部のパート譜 PDF を一括生成しています...",
  },
  "export.parts.loading.partPdfProgress": {
    "zh-TW": "分譜 PDF {index}/{total}: {name}...",
    en: "Part PDF {index}/{total}: {name}...",
    ja: "パート譜 PDF {index}/{total}: {name}...",
  },
  "export.parts.error.somePartsFailed": {
    "zh-TW": "部分分譜失敗 ({count}): {details}",
    en: "Some parts failed ({count}): {details}",
    ja: "一部のパート譜が失敗しました ({count}): {details}",
  },
  "export.parts.error.batchFailed": {
    "zh-TW": "批次匯出失敗: {message}",
    en: "Batch export failed: {message}",
    ja: "一括書き出しに失敗しました: {message}",
  },
  "export.parts.loading.exportPartMusicXML": {
    "zh-TW": "匯出 {name} MusicXML...",
    en: "Exporting {name} MusicXML...",
    ja: "{name} の MusicXML を書き出しています...",
  },
  "export.parts.downloadAllPdf": {
    "zh-TW": "📥 下載全部 PDF ({count})",
    en: "📥 Download all PDFs ({count})",
    ja: "📥 すべての PDF をダウンロード ({count})",
  },
  "export.parts.downloadAllPdf.title": {
    "zh-TW": "一次下載全部 {count} 份 PDF 分譜",
    en: "Download all {count} part PDFs at once",
    ja: "{count} 部のパート譜 PDF をまとめてダウンロード",
  },
  "export.parts.downloadPartPdf.title": {
    "zh-TW": "下載此演奏者的 PDF 分譜",
    en: "Download this player's PDF part",
    ja: "この演奏者のパート譜 PDF をダウンロード",
  },
  "export.parts.downloadPartXml.title": {
    "zh-TW": "下載此演奏者的 MusicXML",
    en: "Download this player's MusicXML",
    ja: "この演奏者の MusicXML をダウンロード",
  },

  // === ExportMenu ===
  "exportMenu.loading.exportFile": {
    "zh-TW": "匯出 {format}...",
    en: "Exporting {format}...",
    ja: "{format} を書き出しています...",
  },
  "exportMenu.error.exportFailed": {
    "zh-TW": "匯出失敗",
    en: "Export failed",
    ja: "書き出しに失敗しました",
  },
  "exportMenu.error.noArrangement": {
    "zh-TW": "尚無改編結果",
    en: "No arrangement yet",
    ja: "編曲結果がまだありません",
  },
  "exportMenu.loading.generatePdf": {
    "zh-TW": "產生 PDF (首次需載入引擎)...",
    en: "Generating PDF (loading the engine on first use)...",
    ja: "PDF を生成しています (初回はエンジンを読み込みます)...",
  },
  "exportMenu.error.pdfFailed": {
    "zh-TW": "PDF 失敗: {message}",
    en: "PDF failed: {message}",
    ja: "PDF が失敗しました: {message}",
  },
  "exportMenu.loading.batchPartPdf": {
    "zh-TW": "批次產生 {count} 份分譜 PDF...",
    en: "Batch-generating {count} part PDFs...",
    ja: "{count} 部のパート譜 PDF を一括生成しています...",
  },
  "exportMenu.loading.partPdfProgress": {
    "zh-TW": "分譜 PDF {index}/{total}: {name}...",
    en: "Part PDF {index}/{total}: {name}...",
    ja: "パート譜 PDF {index}/{total}: {name}...",
  },
  "exportMenu.error.somePartsFailed": {
    "zh-TW": "部分分譜失敗 ({count}): {details}",
    en: "Some parts failed ({count}): {details}",
    ja: "一部のパート譜が失敗しました ({count}): {details}",
  },
  "exportMenu.error.partExportFailed": {
    "zh-TW": "分譜匯出失敗: {message}",
    en: "Part export failed: {message}",
    ja: "パート譜の書き出しに失敗しました: {message}",
  },
  "exportMenu.loading.renderAudio": {
    "zh-TW": "渲染音訊...",
    en: "Rendering audio...",
    ja: "音声をレンダリングしています...",
  },
  "exportMenu.error.getMidiFailed": {
    "zh-TW": "取得 MIDI 失敗",
    en: "Failed to get MIDI",
    ja: "MIDI の取得に失敗しました",
  },
  "exportMenu.error.wavFailed": {
    "zh-TW": "WAV 失敗: {message}",
    en: "WAV failed: {message}",
    ja: "WAV が失敗しました: {message}",
  },
  "exportMenu.button": {
    "zh-TW": "匯出 ▾",
    en: "Export ▾",
    ja: "書き出し ▾",
  },
  "exportMenu.button.title": {
    "zh-TW": "匯出改編結果 (⌘E)",
    en: "Export the arrangement (⌘E)",
    ja: "編曲結果を書き出す (⌘E)",
  },
  "exportMenu.group.fullScore": {
    "zh-TW": "總譜",
    en: "Full score",
    ja: "総譜",
  },
  "exportMenu.item.pdf": {
    "zh-TW": "📕 PDF (.pdf)",
    en: "📕 PDF (.pdf)",
    ja: "📕 PDF (.pdf)",
  },
  "exportMenu.item.pdf.desc": {
    "zh-TW": "用 verovio 排版, 列印 / 分享用",
    en: "Engraved with verovio — for printing / sharing",
    ja: "verovio で浄書、印刷 / 共有用",
  },
  "exportMenu.item.musicxml": {
    "zh-TW": "📄 MusicXML (.musicxml)",
    en: "📄 MusicXML (.musicxml)",
    ja: "📄 MusicXML (.musicxml)",
  },
  "exportMenu.item.musicxml.desc": {
    "zh-TW": "MuseScore / Dorico 可開",
    en: "Opens in MuseScore / Dorico",
    ja: "MuseScore / Dorico で開けます",
  },
  "exportMenu.item.midi": {
    "zh-TW": "🎹 MIDI (.mid)",
    en: "🎹 MIDI (.mid)",
    ja: "🎹 MIDI (.mid)",
  },
  "exportMenu.item.midi.desc": {
    "zh-TW": "DAW 使用",
    en: "For use in a DAW",
    ja: "DAW で使用",
  },
  "exportMenu.item.wav": {
    "zh-TW": "🔊 WAV (試聽)",
    en: "🔊 WAV (preview)",
    ja: "🔊 WAV (試聴)",
  },
  "exportMenu.item.wav.desc": {
    "zh-TW": "純合成音色快速渲染",
    en: "Quick render with synthesized sounds",
    ja: "合成音色のみですばやくレンダリング",
  },
  "exportMenu.group.parts": {
    "zh-TW": "分譜 (每位演奏者一份)",
    en: "Parts (one per player)",
    ja: "パート譜 (演奏者ごとに 1 部)",
  },
  "exportMenu.item.allPartsPdf": {
    "zh-TW": "📥 全部 PDF ({count} 份)",
    en: "📥 All PDFs ({count})",
    ja: "📥 すべての PDF ({count} 部)",
  },

  // === PlaybackControls ===
  "playback.error.noSource": {
    "zh-TW": "尚無原譜可播放",
    en: "No source score to play yet",
    ja: "再生できる元の楽譜がまだありません",
  },
  "playback.error.noArrangement": {
    "zh-TW": "尚無改編結果, 請先改編",
    en: "No arrangement yet — arrange first",
    ja: "編曲結果がまだありません。先に編曲してください",
  },
  "playback.error.getMidiFailed": {
    "zh-TW": "取得 MIDI 失敗",
    en: "Failed to get MIDI",
    ja: "MIDI の取得に失敗しました",
  },
  "playback.side.source": {
    "zh-TW": "原譜",
    en: "source score",
    ja: "元の楽譜",
  },
  "playback.side.target": {
    "zh-TW": "改編譜",
    en: "arrangement",
    ja: "アレンジ譜",
  },
  "playback.rewind.title": {
    "zh-TW": "回到開頭 ({side})",
    en: "Back to start ({side})",
    ja: "先頭に戻る ({side})",
  },
  "playback.pause.title": {
    "zh-TW": "暫停",
    en: "Pause",
    ja: "一時停止",
  },
  "playback.resume.title": {
    "zh-TW": "繼續播放 ({side})",
    en: "Resume playback ({side})",
    ja: "再生を再開 ({side})",
  },
  "playback.play.title": {
    "zh-TW": "播放 {side}",
    en: "Play {side}",
    ja: "{side} を再生",
  },
  "playback.stop.title": {
    "zh-TW": "停止",
    en: "Stop",
    ja: "停止",
  },
  "playback.progress.idle": {
    "zh-TW": "尚未播放",
    en: "Not playing",
    ja: "再生していません",
  },
  "playback.progress.seek": {
    "zh-TW": "{percent}% — 點選跳轉",
    en: "{percent}% — click to seek",
    ja: "{percent}% — クリックでシーク",
  },
  "playback.samples.failed": {
    "zh-TW": "Salamander 取樣載入失敗,使用純合成",
    en: "Salamander samples failed to load — using pure synthesis",
    ja: "Salamander サンプルの読み込みに失敗しました。合成音のみを使用します",
  },
  "playback.samples.hint": {
    "zh-TW": "勾選使用 Salamander 鋼琴取樣 (需網路)",
    en: "Check to use Salamander piano samples (requires network)",
    ja: "Salamander のピアノサンプルを使用するにはチェック (ネットワークが必要)",
  },
  "playback.rate.title": {
    "zh-TW": "慢速練習 — 開始播放前選擇速率",
    en: "Slow practice — pick a rate before starting playback",
    ja: "スロー練習 — 再生前に速度を選択",
  },
  "playback.mute.title": {
    "zh-TW": "靜音聲部 — 開始播放後可選擇要靜音哪些 track",
    en: "Mute parts — pick which tracks to silence (available after first playback)",
    ja: "パートをミュート — 再生後にトラックを選択",
  },
  "playback.mute.heading": {
    "zh-TW": "聲部 mute",
    en: "Mute tracks",
    ja: "トラックミュート",
  },
  "playback.mute.clear": {
    "zh-TW": "全部恢復",
    en: "Unmute all",
    ja: "全て解除",
  },
  "playback.mute.empty": {
    "zh-TW": "(先按 ▶ 一次, 才能看到聲部列表)",
    en: "(Press ▶ once to populate the track list)",
    ja: "(▶ を一度押すとトラック一覧が表示されます)",
  },
  // 0.1.54 D: metronome
  "playback.metronome.title": {
    "zh-TW": "節拍器 — 開啟後播放時跟著拍子打點 (每拍木魚聲)",
    en: "Metronome — clicks on each beat during playback",
    ja: "メトロノーム — 再生中に拍ごとにクリック音",
  },
  "playback.samples.label": {
    "zh-TW": "取樣",
    en: "Samples",
    ja: "サンプル",
  },
  "playback.loop.hint": {
    "zh-TW": "勾選後, 播放至「到」小節時自動跳回「從」小節",
    en: "When checked, jumps back to the From measure on reaching the To measure",
    ja: "チェックすると、「到」の小節に達したとき自動的に「從」の小節へ戻ります",
  },
  "playback.loop.from.placeholder": {
    "zh-TW": "從",
    en: "From",
    ja: "から",
  },
  "playback.loop.from.title": {
    "zh-TW": "loop 起始小節",
    en: "Loop start measure",
    ja: "ループ開始小節",
  },
  "playback.loop.to.placeholder": {
    "zh-TW": "到",
    en: "To",
    ja: "まで",
  },
  "playback.loop.to.title": {
    "zh-TW": "loop 結束小節 (含)",
    en: "Loop end measure (inclusive)",
    ja: "ループ終了小節 (この小節を含む)",
  },
  // === ScoreViewer ===
  "scoreViewer.error.renderFailed": {
    "zh-TW": "渲染失敗: {message}",
    en: "Render failed: {message}",
    ja: "レンダリングに失敗しました: {message}",
  },
  "scoreViewer.empty": {
    "zh-TW": "(尚未載入樂譜)",
    en: "(No score loaded yet)",
    ja: "(楽譜がまだ読み込まれていません)",
  },
  "scoreViewer.empty.openScore": {
    "zh-TW": "開啟樂譜",
    en: "Open Score",
    ja: "楽譜を開く",
  },
  "scoreViewer.empty.trySample": {
    "zh-TW": "試用範例",
    en: "Try a Sample",
    ja: "サンプルを試す",
  },
  "todaysPicks.title": {
    "zh-TW": "今日推薦",
    en: "Today's Picks",
    ja: "本日のおすすめ",
  },
  "target.continuo.label": {
    "zh-TW": "continuo {count}",
    en: "continuo {count}",
    ja: "通奏低音 {count}",
  },
  "target.continuo.tooltip": {
    "zh-TW": "巴洛克通奏低音自動實現 — 大鍵琴右手已從低音線生成 "
      + "{count} 個和弦. 改變 source 或編制會重算.",
    en: "Baroque continuo auto-realized — harpsichord right hand has "
      + "{count} chords generated from the bass line. "
      + "Changes when source or ensemble changes.",
    ja: "バロック通奏低音の自動実現 — チェンバロ右手にベースライン"
      + "から {count} 個の和音が生成されました。"
      + "原譜または編成を変更すると再計算されます。",
  },
  "scoreViewer.overlay.difficulty": {
    "zh-TW": "m.{measure} — 難度 {score}/5",
    en: "m.{measure} — difficulty {score}/5",
    ja: "m.{measure} — 難易度 {score}/5",
  },
  "scoreViewer.overlay.diff": {
    "zh-TW": "m.{measure} — 與另一版本不同",
    en: "m.{measure} — differs from the other version",
    ja: "m.{measure} — もう一方のバージョンと相違あり",
  },
  "scoreViewer.drag.semitones": {
    "zh-TW": "{semitones} 半音",
    en: "{semitones} semitones",
    ja: "{semitones} 半音",
  },

  // === LoadingOverlay ===
  "loading.processing": {
    "zh-TW": "處理中…",
    en: "Processing…",
    ja: "処理中…",
  },
  "loading.elapsed": {
    "zh-TW": "已等待 {seconds} 秒",
    en: "Waited {seconds}s",
    ja: "経過 {seconds} 秒",
  },
  "loading.elapsed.longHint": {
    "zh-TW": " — 大型樂譜需要較久，請稍候",
    en: " — large scores take longer, please wait",
    ja: " — 大きな楽譜は時間がかかります。しばらくお待ちください",
  },

  // === sessionStore ===
  "session.tab.untitled": {
    "zh-TW": "新分頁",
    en: "New tab",
    ja: "新しいタブ",
  },
  "session.variant.autoName": {
    "zh-TW": "版本 {letter}",
    en: "Version {letter}",
    ja: "バージョン {letter}",
  },

  // === pdfExport ===
  "pdfExport.error.noWasmExport": {
    "zh-TW": "verovio/wasm 沒有可呼叫的 default export (createVerovioModule)",
    en: "verovio/wasm has no callable default export (createVerovioModule)",
    ja: "verovio/wasm に呼び出し可能な default export (createVerovioModule) がありません",
  },
  "pdfExport.error.noToolkitClass": {
    "zh-TW": "verovio/esm 沒有 VerovioToolkit class",
    en: "verovio/esm has no VerovioToolkit class",
    ja: "verovio/esm に VerovioToolkit クラスがありません",
  },
  "pdfExport.error.parseFailed": {
    "zh-TW": "verovio 無法解析此 MusicXML",
    en: "verovio could not parse this MusicXML",
    ja: "verovio はこの MusicXML を解析できませんでした",
  },
  "pdfExport.error.no2dContext": {
    "zh-TW": "無法取得 2D context",
    en: "Could not get a 2D context",
    ja: "2D コンテキストを取得できませんでした",
  },

  // === useMidiInput ===
  "midi.error.unsupported": {
    "zh-TW": "此環境不支援 Web MIDI",
    en: "This environment does not support Web MIDI",
    ja: "この環境は Web MIDI に対応していません",
  },
  "midi.error.accessFailed": {
    "zh-TW": "無法存取 MIDI: {message}",
    en: "Could not access MIDI: {message}",
    ja: "MIDI にアクセスできませんでした: {message}",
  },
};

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
    "zh-TW": "練習速度 — 以實際 BPM (♩=) 顯示, 開始播放前選擇",
    en: "Practice tempo — shown as actual BPM (♩=), pick before playback",
    ja: "練習テンポ — 実際の BPM (♩=) で表示, 再生前に選択",
  },
  "playback.rate.original": {
    "zh-TW": "原速", en: "orig", ja: "原速",
  },
  "playback.tuning.title": {
    "zh-TW": "調音基準 A4 — 播放音高基準頻率 (440=標準, 415=巴洛克, 442=樂團/獨奏)",
    en: "Tuning reference A4 — playback pitch standard (440=std, 415=Baroque, 442=orchestra/solo)",
    ja: "調律基準 A4 — 再生ピッチ基準 (440=標準, 415=バロック, 442=オケ/ソロ)",
  },
  "playback.tuning.standard": {
    "zh-TW": "標準", en: "std", ja: "標準",
  },
  "playback.tuning.baroque": {
    "zh-TW": "巴洛克", en: "Baroque", ja: "バロック",
  },
  "playback.tuning.classical": {
    "zh-TW": "古典", en: "Classical", ja: "古典",
  },
  "playback.tuning.orchestra": {
    "zh-TW": "樂團", en: "orch.", ja: "オケ",
  },
  "viz.harmony.title": {
    "zh-TW": "即時和聲 — 偵測調性 + 播放時當下和弦 (羅馬數字)",
    en: "Live harmony — detected key + current chord (Roman numeral) during playback",
    ja: "リアルタイム和声 — 検出した調 + 再生中の現在の和音 (ローマ数字)",
  },
  "viz.tessitura.heading": {
    "zh-TW": "音域帶 — 各聲部實際用音域 vs 樂器舒適區",
    en: "Tessitura — each part's used range vs the instrument's comfortable zone",
    ja: "声域バンド — 各パートの使用音域 vs 楽器の快適域",
  },
  "viz.tessitura.used": {
    "zh-TW": "實際用", en: "used", ja: "使用域",
  },
  "viz.tessitura.comfortable": {
    "zh-TW": "舒適", en: "comfortable", ja: "快適域",
  },
  "viz.tessitura.outComfort": {
    "zh-TW": "超出舒適", en: "beyond comfortable", ja: "快適域超え",
  },
  "viz.tessitura.outAbsolute": {
    "zh-TW": "超出音域", en: "beyond range", ja: "音域超え",
  },
  "viz.tessitura.flagComfort": {
    "zh-TW": "頂到", en: "tight", ja: "限界付近",
  },
  "viz.tessitura.flagAbsolute": {
    "zh-TW": "超域", en: "out of range", ja: "音域外",
  },
  "viz.timeline.heading": {
    "zh-TW": "時間軸 — 全曲織體 / 張力 / 調性 / 把位的流動",
    en: "Timeline — texture / tension / tonality / position flow across the piece",
    ja: "タイムライン — 曲全体の織度 / 緊張 / 調性 / ポジションの流れ",
  },
  "viz.timeline.hint": {
    "zh-TW": "每小節一格, 播放游標掃過。色帶換色 = 轉調; 張力高點 = 不協和聚集; 把位走高 = 弦樂吃力。",
    en: "One cell per measure; the cursor sweeps as you play. Color shifts = modulation; tension peaks = dissonance; rising position = harder string passages.",
    ja: "1小節1セル、再生で再生カーソルが走査。色の変化=転調、緊張のピーク=不協和、ポジション上昇=弦の難所。",
  },
  "viz.timeline.density": {
    "zh-TW": "織體密度", en: "Texture density", ja: "織度",
  },
  "viz.timeline.tension": {
    "zh-TW": "和聲張力", en: "Harmonic tension", ja: "和声緊張",
  },
  "viz.timeline.tonal": {
    "zh-TW": "調性色彩", en: "Tonal color", ja: "調性カラー",
  },
  "viz.timeline.position": {
    "zh-TW": "弦樂把位", en: "String position", ja: "弦ポジション",
  },
  "viz.timeline.measure": {
    "zh-TW": "小節", en: "m.", ja: "小節",
  },
  "arrange.title.label": {
    "zh-TW": "標題", en: "Title", ja: "タイトル",
  },
  "arrange.title.placeholder": {
    "zh-TW": "為這份改編命名…",
    en: "Name this arrangement…",
    ja: "この編曲に名前を…",
  },
  "arrange.title.hint": {
    "zh-TW": "改編標題 — 會印在匯出的譜上 (PDF / MusicXML)。留空則用來源標題。",
    en: "Arrangement title — printed on exported scores (PDF / MusicXML). Blank uses the source title.",
    ja: "編曲タイトル — 書き出した楽譜 (PDF / MusicXML) に印刷されます。空欄なら元の曲名。",
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
  // 聲部音量重平衡 (混音台) — 只影響播放
  "playback.balance.heading": {
    "zh-TW": "聲部平衡 (音量 / 靜音 / 獨奏)",
    en: "Voice balance (volume / mute / solo)",
    ja: "声部バランス (音量 / ミュート / ソロ)",
  },
  "playback.balance.melodyFirst": {
    "zh-TW": "旋律優先",
    en: "Melody first",
    ja: "旋律優先",
  },
  "playback.balance.chamber": {
    "zh-TW": "室內樂",
    en: "Chamber",
    ja: "室内楽",
  },
  "playback.balance.flat": {
    "zh-TW": "重設",
    en: "Reset",
    ja: "リセット",
  },
  "playback.balance.autoHint": {
    "zh-TW": "依聲部功能自動算音量: 旋律保持, 和聲/內聲部調低, 修縮編後和聲打斷樂句。下次播放生效。",
    en: "Auto-set volumes by voice role: keep melody, lower harmony/inner voices. Applies on next playback.",
    ja: "声部の役割で自動調整: 旋律を保ち、和声/内声部を下げる。次の再生から有効。",
  },
  "playback.balance.volume": {
    "zh-TW": "音量 (dB, 只影響播放)",
    en: "Volume (dB, playback only)",
    ja: "音量 (dB、再生のみ)",
  },
  "playback.balance.solo": {
    "zh-TW": "獨奏 (只放這個聲部)",
    en: "Solo (play only this part)",
    ja: "ソロ (この声部のみ)",
  },
  // 0.1.54 D: metronome
  "playback.metronome.title": {
    "zh-TW": "節拍器 — 開啟後播放時跟著拍子打點 (每拍木魚聲)",
    en: "Metronome — clicks on each beat during playback",
    ja: "メトロノーム — 再生中に拍ごとにクリック音",
  },
  // 0.1.61: 獨立節拍器面板
  "metronome.open": {
    "zh-TW": "節拍器", en: "Metronome", ja: "メトロノーム",
  },
  "metronome.open.title": {
    "zh-TW": "開啟獨立節拍器 (BPM / 拍號 / 重音 / 細分 / 練習訓練器)",
    en: "Open the standalone metronome (BPM / meter / accents / subdivisions / trainers)",
    ja: "独立メトロノームを開く (BPM / 拍子 / アクセント / 分割 / トレーナー)",
  },
  "metronome.title": {
    "zh-TW": "節拍器", en: "Metronome", ja: "メトロノーム",
  },
  "metronome.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },
  "metronome.start": { "zh-TW": "開始", en: "Start", ja: "開始" },
  "metronome.stop": { "zh-TW": "停止", en: "Stop", ja: "停止" },
  "metronome.tap": { "zh-TW": "Tap", en: "Tap", ja: "Tap" },
  "metronome.tap.title": {
    "zh-TW": "連點幾下以抓出速度", en: "Tap a few times to set the tempo",
    ja: "数回タップしてテンポを設定",
  },
  "metronome.timeSig": { "zh-TW": "拍號", en: "Meter", ja: "拍子" },
  "metronome.subdivision": { "zh-TW": "細分", en: "Subdiv", ja: "分割" },
  "metronome.sound": { "zh-TW": "音色", en: "Sound", ja: "音色" },
  "metronome.sound.woodblock": {
    "zh-TW": "木魚", en: "Woodblock", ja: "ウッドブロック",
  },
  "metronome.sound.click": { "zh-TW": "點擊", en: "Click", ja: "クリック" },
  "metronome.sound.beep": { "zh-TW": "電子嗶", en: "Beep", ja: "ビープ" },
  "metronome.sound.cowbell": { "zh-TW": "牛鈴", en: "Cowbell", ja: "カウベル" },
  "metronome.accent.title": {
    "zh-TW": "點一下循環: 重音 → 普通 → 靜音",
    en: "Click to cycle: accent → normal → mute",
    ja: "クリックで切替: アクセント → 通常 → ミュート",
  },
  "metronome.fromScore": { "zh-TW": "帶入樂譜", en: "From score", ja: "楽譜から" },
  "metronome.fromScore.title": {
    "zh-TW": "從目前樂譜帶入速度與拍號",
    en: "Pull tempo and meter from the current score",
    ja: "現在の楽譜からテンポと拍子を取り込む",
  },
  "metronome.countIn": { "zh-TW": "預備拍", en: "Count-in", ja: "カウントイン" },
  "metronome.countIn.title": {
    "zh-TW": "播放樂譜前先打 1 小節預備拍",
    en: "Play one count-in bar before score playback",
    ja: "楽譜再生前に1小節のカウントインを鳴らす",
  },
  "metronome.trainer": { "zh-TW": "練習訓練器", en: "Trainer", ja: "トレーナー" },
  "metronome.trainer.off": { "zh-TW": "關", en: "Off", ja: "オフ" },
  "metronome.trainer.speedUp": {
    "zh-TW": "漸進加速", en: "Speed up", ja: "スピードアップ",
  },
  "metronome.trainer.mute": {
    "zh-TW": "靜音訓練", en: "Mute bars", ja: "ミュート",
  },
  "metronome.trainer.everyBars": {
    "zh-TW": "每 N 小節", en: "every N bars", ja: "N小節ごと",
  },
  "metronome.trainer.byBpm": { "zh-TW": "加 BPM", en: "+BPM", ja: "+BPM" },
  "metronome.trainer.toBpm": { "zh-TW": "上限", en: "max", ja: "上限" },
  "playback.samples.label": {
    "zh-TW": "取樣",
    en: "Samples",
    ja: "サンプル",
  },
  "playback.humanize.label": {
    "zh-TW": "弦樂自然化",
    en: "Humanize strings",
    ja: "弦楽器を自然化",
  },
  "playback.physicalStrings.label": {
    "zh-TW": "弦樂物理建模 (實驗)",
    en: "Physical-model strings (beta)",
    ja: "弦楽器の物理モデリング (試験的)",
  },
  "playback.humanize.hint": {
    "zh-TW": "弦樂加上輕微的 vibrato 漂移與齊奏微離調, 減少機械感 (僅影響播放)",
    en: "Adds subtle vibrato drift and unison detune to strings for a less mechanical sound (playback only)",
    ja: "弦楽器に微妙なビブラートの揺らぎとユニゾンのデチューンを加え, 機械的な響きを和らげます (再生のみ)",
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
  // 0.1.64 F3: 選段漸進加速
  "playback.loopAccel.title": {
    "zh-TW": "選段漸進加速 — 每圈加速到上限後維持",
    en: "Progressive speed-up — faster each loop until the cap",
    ja: "段階スピードアップ — 上限まで毎回加速",
  },
  "playback.loopAccel.step.title": {
    "zh-TW": "每圈增加的 BPM",
    en: "BPM added each loop",
    ja: "ループごとに上げる BPM",
  },
  "playback.loopAccel.max.title": {
    "zh-TW": "加速上限 BPM (♩=)",
    en: "Speed-up ceiling BPM (♩=)",
    ja: "スピードアップ上限 BPM (♩=)",
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
  // 0.1.55 移調樂器 — 記譜音 / 實音 切換
  "target.pitchMode.written": {
    "zh-TW": "記譜音",
    en: "Written",
    ja: "記譜音",
  },
  "target.pitchMode.sounding": {
    "zh-TW": "實音",
    en: "Concert",
    ja: "実音",
  },
  "target.pitchMode.tooltip": {
    "zh-TW": "移調樂器顯示模式:\n• 記譜音 (預設) — 玩家拿到的譜, Clarinet/Horn/Trumpet "
      + "等顯示譜記音\n• 實音 (Concert) — 總譜對齊用, 顯示實際發聲音高",
    en: "Transposing instrument display:\n• Written (default) — what the player "
      + "reads (Clarinet/Horn/Trumpet show written pitch)\n• Concert — score "
      + "alignment view, shows actual sounding pitch",
    ja: "移調楽器の表示モード:\n• 記譜音 (デフォルト) — 奏者が読む譜 "
      + "(クラリネット/ホルン/トランペットは記譜音)\n• 実音 — 総譜整合用, 実際の発音音高",
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

  // === StatusBar (Dorico 靈感 A3) ===
  "statusbar.ready": { "zh-TW": "就緒", en: "Ready", ja: "準備完了" },
  "statusbar.working": { "zh-TW": "處理中…", en: "Working…", ja: "処理中…" },
  "statusbar.refining": { "zh-TW": "精修中…", en: "Refining…", ja: "微調整中…" },
  "statusbar.parts": {
    "zh-TW": "{count} 聲部",
    en: "{count} parts",
    ja: "{count} パート",
  },
  "statusbar.measure": {
    "zh-TW": "第 {n} 小節",
    en: "m. {n}",
    ja: "第 {n} 小節",
  },

  // === CommandPalette (Dorico Jump bar 靈感 B1) ===
  "palette.placeholder": {
    "zh-TW": "輸入命令或前往… (⌘K)",
    en: "Type a command or go to… (⌘K)",
    ja: "コマンドを入力 / 移動… (⌘K)",
  },
  "palette.empty": {
    "zh-TW": "找不到符合的命令",
    en: "No matching commands",
    ja: "一致するコマンドがありません",
  },
  "palette.goto": { "zh-TW": "前往", en: "Go to", ja: "移動" },
  "palette.hint.mode": { "zh-TW": "模式", en: "Mode", ja: "モード" },
  "palette.cmd.import": {
    "zh-TW": "匯入樂譜…",
    en: "Import score…",
    ja: "楽譜を読み込む…",
  },
  "palette.cmd.repertoire": {
    "zh-TW": "開啟曲庫…",
    en: "Open repertoire…",
    ja: "ライブラリを開く…",
  },
  "palette.cmd.nlEdit": {
    "zh-TW": "AI 改譜…",
    en: "AI edit…",
    ja: "AI 編集…",
  },
  "palette.cmd.export": {
    "zh-TW": "匯出…",
    en: "Export…",
    ja: "書き出し…",
  },
  "palette.cmd.metronome": {
    "zh-TW": "開啟節拍器",
    en: "Open metronome",
    ja: "メトロノームを開く",
  },
  "palette.cmd.theme": {
    "zh-TW": "切換深色 / 淺色主題",
    en: "Toggle dark / light theme",
    ja: "ダーク / ライトを切替",
  },
  "palette.cmd.layout": {
    "zh-TW": "切換面板版面方向",
    en: "Toggle panel layout",
    ja: "パネル配置を切替",
  },
  "palette.cmd.heatmap": {
    "zh-TW": "切換難度熱圖",
    en: "Toggle difficulty heatmap",
    ja: "難易度ヒートマップを切替",
  },
  "palette.cmd.fillView": {
    "zh-TW": "切換 Fill View（塞滿最多小節）",
    en: "Toggle Fill View",
    ja: "Fill View を切替",
  },
};

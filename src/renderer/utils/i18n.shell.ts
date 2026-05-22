import type { BiDict } from "./i18n";

/**
 * 應用外框介面字串 — Toolbar / ZoomControls / TabStrip / VariantBar / App。
 */
export const SHELL_STRINGS: BiDict = {
  // === Toolbar: 編制名稱 ===
  "toolbar.ensemble.violinPiano": {
    "zh-TW": "小提琴 + 鋼琴", en: "Violin + piano", ja: "ヴァイオリン + ピアノ",
  },
  "toolbar.ensemble.stringQuartet": {
    "zh-TW": "弦樂四重奏", en: "String quartet", ja: "弦楽四重奏",
  },
  "toolbar.ensemble.pianoSolo": {
    "zh-TW": "鋼琴獨奏", en: "Piano solo", ja: "ピアノ独奏",
  },
  "toolbar.ensemble.harpsichordSolo": {
    "zh-TW": "大鍵琴獨奏", en: "Harpsichord solo", ja: "チェンバロ独奏",
  },
  "toolbar.ensemble.violinHarpsichord": {
    "zh-TW": "小提琴 + 大鍵琴", en: "Violin + harpsichord",
    ja: "ヴァイオリン + チェンバロ",
  },
  "toolbar.ensemble.baroqueTrioSonata": {
    "zh-TW": "巴洛克三重奏鳴曲", en: "Baroque trio sonata",
    ja: "バロック・トリオソナタ",
  },
  "toolbar.ensemble.woodwindQuintet": {
    "zh-TW": "木管五重奏", en: "Woodwind quintet", ja: "木管五重奏",
  },
  "toolbar.ensemble.brassQuintet": {
    "zh-TW": "銅管五重奏", en: "Brass quintet", ja: "金管五重奏",
  },
  "toolbar.ensemble.guitarSolo": {
    "zh-TW": "吉他獨奏", en: "Guitar solo", ja: "ギター独奏",
  },
  "toolbar.ensemble.luteSolo": {
    "zh-TW": "魯特琴獨奏", en: "Lute solo", ja: "リュート独奏",
  },
  "toolbar.ensemble.harpSolo": {
    "zh-TW": "豎琴獨奏", en: "Harp solo", ja: "ハープ独奏",
  },
  "toolbar.ensemble.fluteGuitar": {
    "zh-TW": "長笛 + 吉他", en: "Flute + guitar", ja: "フルート + ギター",
  },

  // === Toolbar: 編制下拉選項 (短標籤) ===
  "toolbar.ensembleOpt.violinPiano": {
    "zh-TW": "小提琴+鋼琴", en: "Violin + piano", ja: "ヴァイオリン+ピアノ",
  },
  "toolbar.ensembleOpt.stringQuartet": {
    "zh-TW": "弦樂四重奏", en: "String quartet", ja: "弦楽四重奏",
  },
  "toolbar.ensembleOpt.pianoSolo": {
    "zh-TW": "鋼琴獨奏", en: "Piano solo", ja: "ピアノ独奏",
  },
  "toolbar.ensembleOpt.harpsichordSolo": {
    "zh-TW": "大鍵琴獨奏", en: "Harpsichord solo", ja: "チェンバロ独奏",
  },
  "toolbar.ensembleOpt.violinHarpsichord": {
    "zh-TW": "小提琴+大鍵琴", en: "Violin + harpsichord",
    ja: "ヴァイオリン+チェンバロ",
  },
  "toolbar.ensembleOpt.baroqueTrioSonata": {
    "zh-TW": "巴洛克三重奏鳴曲", en: "Baroque trio sonata",
    ja: "バロック・トリオソナタ",
  },
  "toolbar.ensembleOpt.woodwindQuintet": {
    "zh-TW": "木管五重奏", en: "Woodwind quintet", ja: "木管五重奏",
  },
  "toolbar.ensembleOpt.brassQuintet": {
    "zh-TW": "銅管五重奏", en: "Brass quintet", ja: "金管五重奏",
  },
  "toolbar.ensembleOpt.guitarSolo": {
    "zh-TW": "吉他獨奏", en: "Guitar solo", ja: "ギター独奏",
  },
  "toolbar.ensembleOpt.luteSolo": {
    "zh-TW": "魯特琴獨奏", en: "Lute solo", ja: "リュート独奏",
  },
  "toolbar.ensembleOpt.harpSolo": {
    "zh-TW": "豎琴獨奏", en: "Harp solo", ja: "ハープ独奏",
  },
  "toolbar.ensembleOpt.fluteGuitar": {
    "zh-TW": "長笛+吉他", en: "Flute + guitar", ja: "フルート+ギター",
  },
  "toolbar.ensembleOpt.customWithCount": {
    "zh-TW": "🛠 自訂 ({count} 人)", en: "🛠 Custom ({count} players)",
    ja: "🛠 カスタム ({count} 名)",
  },
  "toolbar.ensembleOpt.custom": {
    "zh-TW": "🛠 自訂編制...", en: "🛠 Custom ensemble...",
    ja: "🛠 カスタム編成...",
  },

  // === Toolbar: 檔案群組 ===
  "toolbar.import": { "zh-TW": "匯入", en: "Import", ja: "インポート" },
  "toolbar.openProject": {
    "zh-TW": "開啟 .sarr 專案", en: "Open .sarr project",
    ja: ".sarr プロジェクトを開く",
  },
  "toolbar.saveProject": {
    "zh-TW": "儲存專案 (⌘S)", en: "Save project (⌘S)",
    ja: "プロジェクトを保存 (⌘S)",
  },

  // === Toolbar: 動作群組 ===
  "toolbar.analyze": { "zh-TW": "分析", en: "Analyze", ja: "分析" },
  "toolbar.arrange": { "zh-TW": "改編", en: "Arrange", ja: "編曲" },
  "toolbar.arrange.to": {
    "zh-TW": "改編為 {ensemble}", en: "Arrange for {ensemble}",
    ja: "{ensemble} 向けに編曲",
  },
  "toolbar.ensembleSelect": {
    "zh-TW": "選擇目標編制", en: "Choose the target ensemble",
    ja: "目標とする編成を選択",
  },
  "toolbar.arrangeOpts": {
    "zh-TW": "改編選項 (自動修復 / 技術水平 / 風格)",
    en: "Arrangement options (auto-repair / skill level / style)",
    ja: "編曲オプション (自動修復 / 技術レベル / スタイル)",
  },
  "toolbar.nlEdit": {
    "zh-TW": "🤖 改譜", en: "🤖 Edit", ja: "🤖 編集",
  },
  "toolbar.nlEdit.title": {
    "zh-TW": "用自然語言請 AI 修改改編譜 (移調 / 演奏法 / 力度)",
    en: "Ask AI to edit the arrangement in natural language "
      + "(transpose / articulation / dynamics)",
    ja: "自然言語で AI にアレンジ譜を編集してもらう "
      + "(移調 / 奏法 / 強弱)",
  },
  "toolbar.boost": {
    "zh-TW": "💪 加難度", en: "💪 Boost", ja: "💪 難度アップ",
  },
  "toolbar.boost.title": {
    "zh-TW": "為某個聲部加技巧難度 (八度疊置 / 雙音 / 移高把位 / 困難弓法)",
    en: "Add technical difficulty to a part "
      + "(octave doubling / double-stops / higher position / demanding bowing)",
    ja: "パートに技巧的な難度を追加 "
      + "(オクターブ重ね / 重音 / 高ポジション / 難しい弓法)",
  },

  // === Toolbar: 改編選項 popover ===
  "toolbar.arrangeOpts.heading": {
    "zh-TW": "改編選項", en: "Arrangement options", ja: "編曲オプション",
  },
  "toolbar.arrangeOpts.autoRepair": {
    "zh-TW": "改編後自動修復", en: "Auto-repair after arranging",
    ja: "編曲後に自動修復",
  },
  "toolbar.arrangeOpts.autoRepair.title": {
    "zh-TW": "改編後自動執行修復迴圈, 嘗試解決音域 / 把位等問題",
    en: "Run the repair loop after arranging to resolve "
      + "range / position issues",
    ja: "編曲後に修復ループを自動実行し, 音域 / ポジションなどの問題の"
      + "解決を試みます",
  },
  "toolbar.arrangeOpts.skillLevel": {
    "zh-TW": "演奏者技術水平", en: "Player skill level",
    ja: "奏者の技術レベル",
  },
  "toolbar.arrangeOpts.skillLevel.title": {
    "zh-TW": "amateur 會主動縮減和弦 / 避難段, professional 不限",
    en: "Amateur trims chords and hard passages; professional is unrestricted",
    ja: "amateur は和音や難所を積極的に簡略化し, professional は制限なしです",
  },
  "toolbar.skill.amateur": { "zh-TW": "業餘", en: "Amateur", ja: "アマチュア" },
  "toolbar.skill.intermediate": {
    "zh-TW": "中級", en: "Intermediate", ja: "中級",
  },
  "toolbar.skill.professional": {
    "zh-TW": "專業", en: "Professional", ja: "プロ",
  },
  "toolbar.arrangeOpts.style": {
    "zh-TW": "改編風格", en: "Arrangement style", ja: "編曲スタイル",
  },
  "toolbar.arrangeOpts.style.title": {
    "zh-TW": "套用後處理 hooks (旋律 / bass 強化 / continuo 等)",
    en: "Apply post-processing hooks (melody / bass reinforcement / "
      + "continuo, etc.)",
    ja: "後処理フックを適用します (旋律 / バス強化 / 通奏低音 など)",
  },

  // === Toolbar: 歷史群組 ===
  "toolbar.undo": { "zh-TW": "Undo (⌘Z)", en: "Undo (⌘Z)", ja: "元に戻す (⌘Z)" },
  "toolbar.redo": {
    "zh-TW": "Redo (⇧⌘Z)", en: "Redo (⇧⌘Z)", ja: "やり直す (⇧⌘Z)",
  },

  // === Toolbar: 檢視群組 ===
  "toolbar.heatmap.hide": {
    "zh-TW": "關閉難度熱圖", en: "Hide difficulty heatmap",
    ja: "難易度ヒートマップを非表示",
  },
  "toolbar.heatmap.show": {
    "zh-TW": "顯示難度熱圖", en: "Show difficulty heatmap",
    ja: "難易度ヒートマップを表示",
  },
  "toolbar.layout.toHorizontal": {
    "zh-TW": "切為左右排列 (⌘\\)", en: "Switch to side-by-side layout (⌘\\)",
    ja: "左右レイアウトに切り替え (⌘\\)",
  },
  "toolbar.layout.toVertical": {
    "zh-TW": "切為上下排列 (⌘\\)", en: "Switch to stacked layout (⌘\\)",
    ja: "上下レイアウトに切り替え (⌘\\)",
  },
  "toolbar.infoPanel.toBottom": {
    "zh-TW": "資訊欄移到下方", en: "Move info panel to the bottom",
    ja: "情報パネルを下に移動",
  },
  "toolbar.infoPanel.toSide": {
    "zh-TW": "資訊欄移到右側", en: "Move info panel to the side",
    ja: "情報パネルを右に移動",
  },

  // === Toolbar: 溢出選單 ===
  "toolbar.overflow.title": {
    "zh-TW": "更多工具 (視窗較窄時自動收合於此)",
    en: "More tools (collapsed here when the window is narrow)",
    ja: "その他のツール (ウィンドウが狭いときはここに格納されます)",
  },
  "toolbar.overflow.view": { "zh-TW": "檢視", en: "View", ja: "表示" },
  "toolbar.overflow.zoom": { "zh-TW": "縮放", en: "Zoom", ja: "ズーム" },
  "toolbar.overflow.export": { "zh-TW": "匯出", en: "Export", ja: "書き出し" },

  // === Toolbar: 設定選單 ===
  "toolbar.settings": { "zh-TW": "設定", en: "Settings", ja: "設定" },
  "toolbar.settings.toLight": {
    "zh-TW": "切換為亮色", en: "Switch to light mode",
    ja: "ライトモードに切り替え",
  },
  "toolbar.settings.toDark": {
    "zh-TW": "切換為暗色", en: "Switch to dark mode",
    ja: "ダークモードに切り替え",
  },
  "toolbar.settings.toEnglish": {
    "zh-TW": "Switch to English", en: "Switch to English",
    ja: "Switch to English",
  },
  "toolbar.settings.toChinese": {
    "zh-TW": "切換為繁體字台灣語",
    en: "Switch to Taiwanese (Traditional)",
    ja: "繁体字台湾語に切り替え",
  },
  "toolbar.settings.toJapanese": {
    "zh-TW": "切換為日語", en: "Switch to Japanese",
    ja: "日本語に切り替え",
  },
  "toolbar.settings.llm": {
    "zh-TW": "AI 模型設定", en: "AI model settings",
    ja: "AI モデル設定",
  },
  "toolbar.settings.about": {
    "zh-TW": "關於 Score Arranger", en: "About Score Arranger",
    ja: "Score Arranger について",
  },

  // === Toolbar: 載入 / 進度訊息 ===
  "toolbar.loading.undo": {
    "zh-TW": "Undo...", en: "Undo...", ja: "元に戻しています...",
  },
  "toolbar.loading.redo": {
    "zh-TW": "Redo...", en: "Redo...", ja: "やり直しています...",
  },
  "toolbar.loading.saveProject": {
    "zh-TW": "儲存專案...", en: "Saving project...",
    ja: "プロジェクトを保存しています...",
  },
  "toolbar.loading.loadProject": {
    "zh-TW": "載入專案...", en: "Loading project...",
    ja: "プロジェクトを読み込んでいます...",
  },
  "toolbar.loading.omrCheck": {
    "zh-TW": "檢查 OMR 環境...", en: "Checking OMR environment...",
    ja: "OMR 環境を確認しています...",
  },
  "toolbar.loading.omrRunning": {
    "zh-TW": "Audiveris 辨識中... (大型 PDF 約 1-3 分鐘)",
    en: "Audiveris recognizing... (large PDFs take about 1-3 minutes)",
    ja: "Audiveris で認識中... (大きな PDF は約 1-3 分かかります)",
  },
  "toolbar.loading.amtCheck": {
    "zh-TW": "檢查 basic-pitch 環境...",
    en: "Checking basic-pitch environment...",
    ja: "basic-pitch 環境を確認しています...",
  },
  "toolbar.loading.amtRunning": {
    "zh-TW": "basic-pitch 辨識音訊中 (1-3 分鐘)...",
    en: "basic-pitch transcribing audio (1-3 minutes)...",
    ja: "basic-pitch でオーディオを採譜中 (1-3 分)...",
  },
  "toolbar.loading.scoreSize": {
    "zh-TW": "檢查樂譜大小...", en: "Checking score size...",
    ja: "楽譜のサイズを確認しています...",
  },
  "toolbar.loading.largeScore": {
    "zh-TW":
      "大譜偵測 ({count} 小節) — 預覽只顯示前 {preview} 小節, "
      + "改編仍用完整譜",
    en:
      "Large score detected ({count} measures) — preview shows only the "
      + "first {preview} measures; arranging still uses the full score",
    ja:
      "大規模な楽譜を検出 ({count} 小節) — プレビューは先頭 {preview} 小節のみ"
      + "表示しますが, 編曲には完全な楽譜を使用します",
  },
  "toolbar.loading.loadingScore": {
    "zh-TW": "正在載入樂譜...", en: "Loading score...",
    ja: "楽譜を読み込んでいます...",
  },
  "toolbar.loading.analyzing": {
    "zh-TW": "正在分析樂譜...", en: "Analyzing score...",
    ja: "楽譜を分析しています...",
  },
  "toolbar.loading.arranging": {
    "zh-TW": "正在改編...", en: "Arranging...", ja: "編曲しています...",
  },

  // === Toolbar: 錯誤訊息 ===
  "toolbar.error.undo": {
    "zh-TW": "Undo 失敗", en: "Undo failed", ja: "元に戻せませんでした",
  },
  "toolbar.error.redo": {
    "zh-TW": "Redo 失敗", en: "Redo failed", ja: "やり直せませんでした",
  },
  "toolbar.error.nothingToSave": {
    "zh-TW": "尚無內容可儲存", en: "Nothing to save yet",
    ja: "保存できる内容がまだありません",
  },
  "toolbar.error.saveFailed": {
    "zh-TW": "儲存失敗", en: "Save failed", ja: "保存に失敗しました",
  },
  "toolbar.error.loadProjectFailed": {
    "zh-TW": "載入專案失敗", en: "Failed to load project",
    ja: "プロジェクトの読み込みに失敗しました",
  },
  "toolbar.error.omrFailed": {
    "zh-TW": "OMR 失敗", en: "OMR failed", ja: "OMR に失敗しました",
  },
  "toolbar.error.amtMissing": {
    "zh-TW": "音訊轉譜需要 basic-pitch (缺: {missing})\n\n{hints}",
    en: "Audio transcription requires basic-pitch (missing: {missing})"
      + "\n\n{hints}",
    ja: "オーディオの採譜には basic-pitch が必要です (不足: {missing})"
      + "\n\n{hints}",
  },
  "toolbar.error.amtFailed": {
    "zh-TW": "AMT 失敗", en: "AMT failed", ja: "AMT に失敗しました",
  },
  "toolbar.error.loadScoreFailed": {
    "zh-TW": "載入樂譜失敗", en: "Failed to load score",
    ja: "楽譜の読み込みに失敗しました",
  },
  "toolbar.error.analyzeFailed": {
    "zh-TW": "分析失敗", en: "Analysis failed", ja: "分析に失敗しました",
  },
  "toolbar.error.arrangeFailed": {
    "zh-TW": "改編失敗", en: "Arrangement failed", ja: "編曲に失敗しました",
  },

  // === Toolbar: OMR 進度浮窗 ===
  "toolbar.omrProgress.heading": {
    "zh-TW": "Audiveris 辨識中", en: "Audiveris recognizing",
    ja: "Audiveris で認識中",
  },
  "toolbar.omrProgress.elapsed": {
    "zh-TW": "已用時 {sec}s · 大型 PDF 需 1-3 分鐘",
    en: "Elapsed {sec}s · large PDFs take 1-3 minutes",
    ja: "経過時間 {sec}s · 大きな PDF は 1-3 分かかります",
  },

  // === ZoomControls ===
  "zoom.control": {
    "zh-TW": "縮放 (⌘+ / ⌘- / ⌘0)", en: "Zoom (⌘+ / ⌘- / ⌘0)",
    ja: "ズーム (⌘+ / ⌘- / ⌘0)",
  },
  "zoom.autoFit.on": {
    "zh-TW": "自動縮放: 依面板排列方向 fit-to-screen",
    en: "Auto-fit: fit to screen along the panel layout direction",
    ja: "自動フィット: パネルの配置方向に合わせて画面にフィット",
  },
  "zoom.autoFit.off": {
    "zh-TW": "手動縮放", en: "Manual zoom", ja: "手動ズーム",
  },
  "zoom.out": { "zh-TW": "縮小 ⌘-", en: "Zoom out ⌘-", ja: "縮小 ⌘-" },
  "zoom.autoFitPct": {
    "zh-TW": "自動縮放 {pct}%", en: "Auto-fit {pct}%",
    ja: "自動フィット {pct}%",
  },
  "zoom.reset": {
    "zh-TW": "重置縮放 ⌘0", en: "Reset zoom ⌘0", ja: "ズームをリセット ⌘0",
  },
  "zoom.in": { "zh-TW": "放大 ⌘+", en: "Zoom in ⌘+", ja: "拡大 ⌘+" },

  // === TabStrip ===
  "tab.reloadingScore": {
    "zh-TW": "重新載入樂譜...", en: "Reloading score...",
    ja: "楽譜を再読み込みしています...",
  },
  "tab.reloadFailed": {
    "zh-TW": "重新載入失敗", en: "Reload failed", ja: "再読み込みに失敗しました",
  },
  "tab.emptyTab": {
    "zh-TW": "(空白分頁)", en: "(empty tab)", ja: "(空のタブ)",
  },
  "tab.close": { "zh-TW": "關閉分頁", en: "Close tab", ja: "タブを閉じる" },
  "tab.new": { "zh-TW": "新分頁", en: "New tab", ja: "新しいタブ" },

  // === VariantBar ===
  "variant.compareLabel": {
    "zh-TW": "版本比較:", en: "Version comparison:", ja: "バージョン比較:",
  },
  "variant.savedAt": {
    "zh-TW": "儲存於 {time}", en: "Saved at {time}", ja: "{time} に保存",
  },
  "variant.stopCompare": {
    "zh-TW": "停止比較", en: "Stop comparing", ja: "比較を終了",
  },
  "variant.compareDiff": {
    "zh-TW": "與目前版本比較差異",
    en: "Compare differences with the current version",
    ja: "現在のバージョンとの差分を比較",
  },
  "variant.deleteConfirm": {
    "zh-TW": "刪除「{name}」?", en: "Delete \"{name}\"?",
    ja: "「{name}」を削除しますか?",
  },
  "variant.delete": { "zh-TW": "刪除", en: "Delete", ja: "削除" },
  "variant.quality": {
    "zh-TW": "旋 {melody} · 和 {harmony} · 奏 {playability}",
    en: "Mel {melody} · Harm {harmony} · Play {playability}",
    ja: "旋律 {melody} · 和声 {harmony} · 演奏 {playability}",
  },
  "variant.saveAs": {
    "zh-TW": "+ 存為版本", en: "+ Save as version", ja: "+ バージョンとして保存",
  },
  "variant.saveAs.title": {
    "zh-TW": "把目前的改編結果儲存為一個版本, 之後可切回比較",
    en: "Save the current arrangement as a version to compare later",
    ja: "現在の編曲結果をバージョンとして保存し, 後で切り替えて比較できます",
  },

  // === App ===
  "app.loading.loadSampleScore": {
    "zh-TW": "載入範例樂譜...", en: "Loading sample score...",
    ja: "サンプル楽譜を読み込んでいます...",
  },
  "app.error.loadSampleFailed": {
    "zh-TW": "載入範例失敗", en: "Failed to load sample",
    ja: "サンプルの読み込みに失敗しました",
  },
  "app.loading.arranging": {
    "zh-TW": "改編中…", en: "Arranging…", ja: "編曲中…",
  },
  "app.error.arrangeFailed": {
    "zh-TW": "改編失敗", en: "Arrangement failed", ja: "編曲に失敗しました",
  },
  "app.loading.transpose": {
    "zh-TW": "轉調 {semitones}...", en: "Transposing {semitones}...",
    ja: "{semitones} 移調しています...",
  },
  "app.error.dragTransposeFailed": {
    "zh-TW": "拖曳轉調失敗", en: "Drag transpose failed",
    ja: "ドラッグでの移調に失敗しました",
  },
  "app.panel.sourceLabel.corpus": {
    "zh-TW": "預設: {name}", en: "Built-in: {name}", ja: "内蔵: {name}",
  },
  "app.panel.sourceLabel.file": {
    "zh-TW": "原始樂譜: {name}", en: "Source score: {name}",
    ja: "元の楽譜: {name}",
  },
  "app.panel.sourceLabel.default": {
    "zh-TW": "原始樂譜", en: "Source score", ja: "元の楽譜",
  },
  "app.panel.sourceTitle": { "zh-TW": "原譜", en: "Source", ja: "原譜" },
  "app.panel.targetTitle": {
    "zh-TW": "改編譜", en: "Arrangement", ja: "アレンジ譜",
  },
  "app.panel.targetLabel.result": {
    "zh-TW": "改編結果: {name}", en: "Arrangement: {name}",
    ja: "編曲結果: {name}",
  },
  "app.panel.targetLabel.default": {
    "zh-TW": "改編結果", en: "Arrangement", ja: "編曲結果",
  },
  "app.resizer.footer": {
    "zh-TW": "拖曳調整下方面板高度 / 雙擊重置",
    en: "Drag to resize the bottom panel / double-click to reset",
    ja: "ドラッグで下パネルの高さを調整 / ダブルクリックでリセット",
  },
  "app.resizer.side": {
    "zh-TW": "拖曳調整側邊欄寬度 / 雙擊重置",
    en: "Drag to resize the side panel / double-click to reset",
    ja: "ドラッグでサイドパネルの幅を調整 / ダブルクリックでリセット",
  },
  "app.rendererError": {
    "zh-TW": "Renderer 錯誤", en: "Renderer error", ja: "Renderer エラー",
  },
};

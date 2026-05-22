import type { BiDict } from "./i18n";

/**
 * 對話框字串 — AboutDialog / OnboardingWizard / OMRInstallDialog /
 * PdfImportWarningDialog / CustomEnsembleDialog。
 */
export const DIALOG_STRINGS: BiDict = {
  // ==========================================================================
  // AboutDialog
  // ==========================================================================
  "about.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },

  // === About: 分頁標籤 ===
  "about.tab.overview": { "zh-TW": "概述", en: "Overview", ja: "概要" },
  "about.tab.licenses": {
    "zh-TW": "第三方授權", en: "Third-party licenses",
    ja: "サードパーティライセンス",
  },
  "about.tab.samples": {
    "zh-TW": "音訊樣本", en: "Audio samples", ja: "オーディオサンプル",
  },
  "about.tab.corpus": {
    "zh-TW": "樂譜版權", en: "Score copyright", ja: "楽譜の著作権",
  },
  "about.tab.aiPrivacy": {
    "zh-TW": "AI / 隱私", en: "AI / privacy", ja: "AI / プライバシー",
  },
  "about.tab.trademarks": {
    "zh-TW": "商標", en: "Trademarks", ja: "商標",
  },

  // === About: 概述 ===
  "about.overview.intro": {
    "zh-TW":
      "是一款桌面應用程式, 目的是協助音樂人將管弦樂總譜智慧改編為較小編制 "
      + "(如弦樂四重奏、小提琴 + 鋼琴、鋼琴獨奏等)。",
    en:
      "is a desktop application that helps musicians intelligently arrange "
      + "orchestral scores for smaller ensembles (string quartet, "
      + "violin + piano, piano solo, and so on).",
    ja:
      "は、管弦楽の総譜をより小さな編成 (弦楽四重奏、ヴァイオリン + ピアノ、"
      + "ピアノ独奏など) へとインテリジェントに編曲する作業を音楽家の方々が"
      + "進めやすくするためのデスクトップアプリケーションです。",
  },
  "about.overview.positioningLabel": {
    "zh-TW": "定位: ", en: "Positioning: ", ja: "位置づけ: ",
  },
  "about.overview.positioningTerm": {
    "zh-TW": "人機協作改編工具", en: "a human-AI collaborative arranging tool",
    ja: "人とAIが協働する編曲ツール",
  },
  "about.overview.positioningRest": {
    "zh-TW": ", 非全自動替代。AI 提供分析、修復、品質量化, 你保有最終決定權。",
    en:
      ", not a fully automated replacement. AI provides analysis, repairs, "
      + "and quality metrics — you keep the final decision.",
    ja:
      "であり、完全自動の代替ではありません。AIは分析、修復、品質の数値化を"
      + "行いますが、最終的な判断はあなたが保持します。",
  },
  "about.overview.licenseHeading": {
    "zh-TW": "本軟體授權", en: "Software license", ja: "本ソフトウェアのライセンス",
  },
  "about.overview.licenseOpenSource": {
    "zh-TW": "開源軟體", en: "open-source software", ja: "オープンソースソフトウェア",
  },
  "about.overview.licenseBody": {
    "zh-TW":
      "Score Arranger 為{openSource}, 以 {gpl} (GPL-3.0) 釋出。"
      + "你可以自由使用、研究、修改與散布; 衍生作品須以相同授權開源。"
      + "免費提供, 無廣告、無遙測。",
    en:
      "Score Arranger is {openSource}, released under the {gpl} (GPL-3.0). "
      + "You may freely use, study, modify, and distribute it; derivative "
      + "works must be open-sourced under the same license. Free of charge, "
      + "with no ads and no telemetry.",
    ja:
      "Score Arranger は{openSource}であり、{gpl} (GPL-3.0) のもとで公開"
      + "されています。自由に使用、研究、改変、再配布ができます。派生作品は"
      + "同一のライセンスでオープンソース化する必要があります。無料で提供"
      + "され、広告もテレメトリもありません。",
  },
  "about.overview.creditsHeading": {
    "zh-TW": "授權與致謝摘要", en: "License & acknowledgements summary",
    ja: "ライセンスと謝辞の概要",
  },
  "about.overview.creditsIntro": {
    "zh-TW": "Score Arranger 站在許多開源專案的肩膀上:",
    en: "Score Arranger stands on the shoulders of many open-source projects:",
    ja: "Score Arranger は数多くのオープンソースプロジェクトに支えられています:",
  },
  "about.overview.credit.music21": {
    "zh-TW": "樂譜解析核心", en: "score parsing core", ja: "楽譜解析の中核",
  },
  "about.overview.credit.osmd": {
    "zh-TW": "內建譜面渲染", en: "built-in score rendering", ja: "内蔵の楽譜描画",
  },
  "about.overview.credit.verovio": {
    "zh-TW": "PDF 匯出", en: "PDF export", ja: "PDF 書き出し",
  },
  "about.overview.credit.tone": {
    "zh-TW": "音訊播放", en: "audio playback", ja: "オーディオ再生",
  },
  "about.overview.credit.salamander": {
    "zh-TW": "鋼琴取樣", en: "piano samples", ja: "ピアノのサンプル音源",
  },
  "about.overview.credit.claude": {
    "zh-TW": "可選 AI 改編建議", en: "optional AI arrangement suggestions",
    ja: "任意の AI 編曲提案",
  },
  "about.overview.creditsFootnote": {
    "zh-TW":
      "詳細版本與條款請見「第三方授權」分頁; 完整 NOTICE 在原始碼 repo 的 "
      + "{notice}。",
    en:
      "See the \"Third-party licenses\" tab for detailed versions and terms; "
      + "the full NOTICE is in {notice} in the source repository.",
    ja:
      "詳しいバージョンと条項は「サードパーティライセンス」タブをご覧ください。"
      + "完全な NOTICE はソースコードリポジトリの {notice} にあります。",
  },
  "about.overview.versionHeading": {
    "zh-TW": "版本", en: "Version", ja: "バージョン",
  },
  "about.overview.versionLine": {
    "zh-TW": "0.1.10 — © 2026 Kevin Lin · GPL-3.0",
    en: "0.1.10 — © 2026 Kevin Lin · GPL-3.0",
    ja: "0.1.10 — © 2026 Kevin Lin · GPL-3.0",
  },

  // === About: 第三方授權 ===
  "about.licenses.intro": {
    "zh-TW":
      "每個第三方元件採用的授權如下。所有授權都允許商業使用, "
      + "除 Verovio (LGPL) 有額外條件 (見下方)。",
    en:
      "The license for each third-party component is listed below. All of "
      + "them permit commercial use, except Verovio (LGPL), which has "
      + "additional conditions (see below).",
    ja:
      "各サードパーティコンポーネントが採用しているライセンスは以下のとおり"
      + "です。Verovio (LGPL) には追加条件がありますが (下記参照)、それ以外は"
      + "すべて商用利用が許可されています。",
  },
  "about.licenses.col.component": {
    "zh-TW": "元件", en: "Component", ja: "コンポーネント",
  },
  "about.licenses.col.license": {
    "zh-TW": "授權", en: "License", ja: "ライセンス",
  },
  "about.licenses.col.role": { "zh-TW": "用途", en: "Role", ja: "用途" },
  "about.licenses.role.music21": {
    "zh-TW": "MusicXML 解析 / 寫入, 樂理分析",
    en: "MusicXML parsing / writing, music theory analysis",
    ja: "MusicXML の解析 / 書き出し、楽典分析",
  },
  "about.licenses.role.osmd": {
    "zh-TW": "譜面 SVG 渲染", en: "Score SVG rendering", ja: "楽譜の SVG 描画",
  },
  "about.licenses.role.verovio": {
    "zh-TW": "PDF 匯出渲染", en: "PDF export rendering", ja: "PDF 書き出しの描画",
  },
  "about.licenses.role.tone": {
    "zh-TW": "Web Audio 引擎", en: "Web Audio engine", ja: "Web Audio エンジン",
  },
  "about.licenses.role.tonejsMidi": {
    "zh-TW": "MIDI 解析", en: "MIDI parsing", ja: "MIDI の解析",
  },
  "about.licenses.role.jspdf": {
    "zh-TW": "PDF 組裝", en: "PDF assembly", ja: "PDF の組み立て",
  },
  "about.licenses.role.react": {
    "zh-TW": "UI 框架", en: "UI framework", ja: "UI フレームワーク",
  },
  "about.licenses.role.zustand": {
    "zh-TW": "狀態管理", en: "State management", ja: "状態管理",
  },
  "about.licenses.role.electron": {
    "zh-TW": "桌面 runtime", en: "Desktop runtime", ja: "デスクトップランタイム",
  },
  "about.licenses.role.mcpSdk": {
    "zh-TW": "Model Context Protocol", en: "Model Context Protocol",
    ja: "Model Context Protocol",
  },
  "about.licenses.verovioHeading": {
    "zh-TW": "Verovio (LGPL-3.0) — 特別聲明",
    en: "Verovio (LGPL-3.0) — special notice",
    ja: "Verovio (LGPL-3.0) — 特別な告知",
  },
  "about.licenses.verovioIntro": {
    "zh-TW":
      "Verovio 採用 GNU Lesser General Public License v3 (或更新版本)。"
      + "其用於 Score Arranger 的 PDF 匯出功能。LGPL 條款下:",
    en:
      "Verovio is licensed under the GNU Lesser General Public License v3 "
      + "(or any later version). It powers Score Arranger's PDF export. "
      + "Under the LGPL terms:",
    ja:
      "Verovio は GNU Lesser General Public License v3 (またはそれ以降の"
      + "バージョン) でライセンスされています。Score Arranger の PDF 書き出し"
      + "機能を担っています。LGPL の条項のもとでは:",
  },
  "about.licenses.verovioReplaceTerm": {
    "zh-TW": "替換權", en: "Right to replace", ja: "差し替えの権利",
  },
  "about.licenses.verovioReplaceBody": {
    "zh-TW":
      " — 終端使用者有權以自行修改的版本替換 Verovio 元件。"
      + "在 Score Arranger 中, Verovio 是以動態載入的獨立 bundle 提供, "
      + "替換該檔案即可行使此權利。",
    en:
      " — end users have the right to replace the Verovio component with a "
      + "self-modified version. In Score Arranger, Verovio is provided as a "
      + "dynamically loaded standalone bundle; replacing that file exercises "
      + "this right.",
    ja:
      " — エンドユーザーには、Verovio コンポーネントを自身で改変した"
      + "バージョンに差し替える権利があります。Score Arranger では Verovio は"
      + "動的に読み込まれる独立したバンドルとして提供されており、その"
      + "ファイルを差し替えることでこの権利を行使できます。",
  },
  "about.licenses.verovioSourceTerm": {
    "zh-TW": "原始碼可取得性", en: "Source code availability",
    ja: "ソースコードの入手可能性",
  },
  "about.licenses.verovioSourceBody": {
    "zh-TW":
      " — 對應版本的原始碼公開於 {repo}。Score Arranger 未對 Verovio 做修改。",
    en:
      " — the source code for the corresponding version is published at "
      + "{repo}. Score Arranger has not modified Verovio.",
    ja:
      " — 該当バージョンのソースコードは {repo} で公開されています。"
      + "Score Arranger は Verovio に改変を加えていません。",
  },
  "about.licenses.verovioNoRestrictTerm": {
    "zh-TW": "無額外限制", en: "No additional restrictions",
    ja: "追加の制限なし",
  },
  "about.licenses.verovioNoRestrictBody": {
    "zh-TW":
      " — LGPL 不要求在渲染輸出上顯示歸屬字串。我們關閉了 Verovio 預設的 "
      + "\"MEI engraved with Verovio\" footer 以保持譜面整潔; "
      + "本歸屬聲明代之以做正式致謝。",
    en:
      " — the LGPL does not require an attribution string in the rendered "
      + "output. We disabled Verovio's default \"MEI engraved with Verovio\" "
      + "footer to keep scores clean; this attribution notice serves as the "
      + "formal acknowledgement instead.",
    ja:
      " — LGPL は描画結果に帰属表示文字列を入れることを要求していません。"
      + "楽譜をすっきりと保つため、Verovio の既定の \"MEI engraved with "
      + "Verovio\" フッターを無効にしており、この帰属の告知を正式な謝辞として"
      + "代わりに掲載しています。",
  },

  // === About: 音訊樣本 ===
  "about.samples.intro": {
    "zh-TW":
      "播放功能使用線上音訊樣本, {notBundled}, 首次播放時從各自的官方 CDN "
      + "載入。",
    en:
      "Playback uses online audio samples that {notBundled}; they are loaded "
      + "from their respective official CDNs the first time you play.",
    ja:
      "再生機能はオンラインのオーディオサンプルを使用しており、{notBundled}、"
      + "初回再生時にそれぞれの公式 CDN から読み込まれます。",
  },
  "about.samples.notBundled": {
    "zh-TW": "不打包進 App", en: "are not bundled into the app",
    ja: "アプリには同梱されておらず",
  },
  "about.samples.licenseLabel": {
    "zh-TW": "License: ", en: "License: ", ja: "License: ",
  },
  "about.samples.sourceLabel": {
    "zh-TW": "Source: ", en: "Source: ", ja: "Source: ",
  },
  "about.samples.salamanderNote": {
    "zh-TW":
      "CC-BY 3.0 授權要求, 凡使用該樣本產生衍生作品時必須給予歸屬。"
      + "本 About 頁面之顯示即為合規之歸屬聲明。",
    en:
      "The CC-BY 3.0 license requires attribution whenever derivative works "
      + "are produced using these samples. This About page serves as the "
      + "compliant attribution notice.",
    ja:
      "CC-BY 3.0 ライセンスは、これらのサンプルを使用して派生作品を制作する"
      + "際には常に帰属表示を行うことを求めています。この About ページの表示が"
      + "ライセンスに準拠した帰属の告知となります。",
  },
  "about.samples.tonejsNote": {
    "zh-TW":
      "此集合內各樂器樣本授權不同, 詳見原專案 LICENSE 檔。Score Arranger "
      + "僅在使用者啟用對應樂器時才會載入相應檔案。",
    en:
      "Individual instrument samples in this collection are licensed "
      + "differently; see the LICENSE file of the original project. Score "
      + "Arranger only loads a given file when you enable the matching "
      + "instrument.",
    ja:
      "このコレクション内の各楽器サンプルはそれぞれ異なるライセンスで"
      + "提供されています。詳しくは元プロジェクトの LICENSE ファイルをご覧"
      + "ください。Score Arranger は、対応する楽器を有効にしたときにのみ"
      + "該当ファイルを読み込みます。",
  },

  // === About: 樂譜版權 ===
  "about.corpus.intro": {
    "zh-TW":
      "Score Arranger 的「範例 ▾」選單列出約 30 首 music21 內建 corpus "
      + "作品作為快速試用素材。",
    en:
      "Score Arranger's \"Samples ▾\" menu lists about 30 works from the "
      + "built-in music21 corpus as quick try-out material.",
    ja:
      "Score Arranger の「サンプル ▾」メニューには、すぐに試せる素材として "
      + "music21 内蔵 corpus からおよそ 30 曲が一覧表示されます。",
  },
  "about.corpus.worksHeading": {
    "zh-TW": "樂曲本身", en: "The works", ja: "楽曲そのもの",
  },
  "about.corpus.publicDomain": {
    "zh-TW": "公共領域", en: "the public domain", ja: "パブリックドメイン",
  },
  "about.corpus.worksBody": {
    "zh-TW":
      "所有列出的作曲家 (Bach, Mozart, Beethoven, Schubert, Chopin 等) "
      + "都已逝世逾 70 年, 作品本身在絕大多數司法管轄區內已進入{publicDomain}。",
    en:
      "All listed composers (Bach, Mozart, Beethoven, Schubert, Chopin, and "
      + "others) died more than 70 years ago, so the works themselves are in "
      + "{publicDomain} in most jurisdictions.",
    ja:
      "一覧に挙げられている作曲家 (Bach、Mozart、Beethoven、Schubert、Chopin "
      + "など) はいずれも没後 70 年を超えており、楽曲そのものはほとんどの法域"
      + "において{publicDomain}に属しています。",
  },
  "about.corpus.encodingHeading": {
    "zh-TW": "MusicXML 編碼", en: "MusicXML encodings", ja: "MusicXML エンコード",
  },
  "about.corpus.encodingBody": {
    "zh-TW":
      "雖然樂曲本身是公領域, 但 music21 corpus 內各 MusicXML 編碼檔可能 "
      + "有額外的版權聲明或限制。music21 corpus license 明文:",
    en:
      "Although the works themselves are public domain, individual MusicXML "
      + "encoding files in the music21 corpus may carry additional copyright "
      + "notices or restrictions. The music21 corpus license states:",
    ja:
      "楽曲そのものはパブリックドメインですが、music21 corpus 内の個々の "
      + "MusicXML エンコードファイルには、追加の著作権表示や制限が付されている"
      + "場合があります。music21 corpus license には次のように明記されて"
      + "います:",
  },
  "about.corpus.quote": {
    "zh-TW":
      "\"Some encodings included in the corpus may not be used for "
      + "commercial uses or have other restrictions: please see the licenses "
      + "embedded in individual compositions or directories for more "
      + "details.\"",
    en:
      "\"Some encodings included in the corpus may not be used for "
      + "commercial uses or have other restrictions: please see the licenses "
      + "embedded in individual compositions or directories for more "
      + "details.\"",
    ja:
      "\"Some encodings included in the corpus may not be used for "
      + "commercial uses or have other restrictions: please see the licenses "
      + "embedded in individual compositions or directories for more "
      + "details.\"",
  },
  "about.corpus.adviceTerm": {
    "zh-TW": "商業發行建議", en: "Commercial release advice",
    ja: "商用リリースに関する助言",
  },
  "about.corpus.adviceBody": {
    "zh-TW":
      ": 若計畫將基於 corpus 編碼產出的改編作品商業發行, "
      + "請逐一檢視 music21 來源樹中每個 {xml} 檔的版權標頭。"
      + "或直接匯入您自己取得授權的 MusicXML 檔。",
    en:
      ": if you plan to commercially release an arrangement produced from a "
      + "corpus encoding, review the copyright header of every {xml} file in "
      + "the music21 source tree. Alternatively, import a MusicXML file you "
      + "have licensed yourself.",
    ja:
      ": corpus のエンコードをもとに作成したアレンジ譜を商用リリースする"
      + "予定がある場合は、music21 のソースツリー内の各 {xml} ファイルの著作権"
      + "ヘッダーを一つずつ確認してください。あるいは、ご自身でライセンスを"
      + "取得した MusicXML ファイルを直接インポートしてください。",
  },

  // === About: AI / 隱私 ===
  "about.aiPrivacy.aiHeading": {
    "zh-TW": "AI 改編建議 (可選)", en: "AI arrangement suggestions (optional)",
    ja: "AI 編曲提案 (任意)",
  },
  "about.aiPrivacy.aiIntro": {
    "zh-TW":
      "Score Arranger 的「🤖 AI 建議」功能透過 Anthropic Claude API "
      + "提供改編顧問。",
    en:
      "Score Arranger's \"🤖 AI suggestions\" feature provides an arranging "
      + "advisor through the Anthropic Claude API.",
    ja:
      "Score Arranger の「🤖 AI 提案」機能は、Anthropic Claude API を通じて"
      + "編曲のアドバイザーを提供します。",
  },
  "about.aiPrivacy.apiKeyTerm": {
    "zh-TW": "API Key", en: "API key", ja: "API キー",
  },
  "about.aiPrivacy.apiKeyBody": {
    "zh-TW":
      ": 使用者透過環境變數 {envVar} 自行提供。Key 不會打包進 App, "
      + "不會被儲存到磁碟, 不會傳給 Score Arranger 開發者。",
    en:
      ": you provide it yourself via the {envVar} environment variable. The "
      + "key is not bundled into the app, is not saved to disk, and is not "
      + "sent to the Score Arranger developers.",
    ja:
      ": ユーザーが環境変数 {envVar} を通じてご自身で指定します。キーは"
      + "アプリには同梱されず、ディスクに保存されることもなく、Score Arranger "
      + "の開発者に送信されることもありません。",
  },
  "about.aiPrivacy.sentDataTerm": {
    "zh-TW": "送出資料", en: "Data sent", ja: "送信されるデータ",
  },
  "about.aiPrivacy.sentDataBody": {
    "zh-TW":
      ": 使用者按下 🤖 時, 僅該小節的譜面段落 (音符、力度) "
      + "與使用者輸入的問題會送至 Claude API。",
    en:
      ": when you click 🤖, only that measure's score segment (notes and "
      + "dynamics) and the question you typed are sent to the Claude API.",
    ja:
      ": 🤖 をクリックしたとき、その小節の楽譜の一部 (音符、強弱) と"
      + "入力した質問のみが Claude API に送信されます。",
  },
  "about.aiPrivacy.termsTerm": {
    "zh-TW": "使用條款", en: "Terms of use", ja: "利用規約",
  },
  "about.aiPrivacy.termsBody": {
    "zh-TW":
      ": 使用 Claude API 需遵守 Anthropic 的 AUP (Acceptable Use Policy) "
      + "與商業條款。",
    en:
      ": use of the Claude API is subject to Anthropic's AUP (Acceptable Use "
      + "Policy) and commercial terms.",
    ja:
      ": Claude API の利用には、Anthropic の AUP (Acceptable Use Policy) "
      + "および商用条項が適用されます。",
  },
  "about.aiPrivacy.disableTerm": {
    "zh-TW": "停用", en: "Disabling", ja: "無効化",
  },
  "about.aiPrivacy.disableBody": {
    "zh-TW": ": 不設定 {envVar} 則完全不發送 API 請求。",
    en: ": if {envVar} is not set, no API requests are sent at all.",
    ja: ": {envVar} を設定しなければ、API リクエストは一切送信されません。",
  },
  "about.aiPrivacy.privacyHeading": {
    "zh-TW": "隱私聲明", en: "Privacy statement", ja: "プライバシーに関する声明",
  },
  "about.aiPrivacy.willNotIntro": {
    "zh-TW": "Score Arranger {willNot}:", en: "Score Arranger {willNot}:",
    ja: "Score Arranger は次のことを{willNot}:",
  },
  "about.aiPrivacy.willNot": {
    "zh-TW": "不會", en: "does not", ja: "行いません",
  },
  "about.aiPrivacy.willNot.telemetry": {
    "zh-TW": "蒐集遙測或使用分析",
    en: "collect telemetry or usage analytics",
    ja: "テレメトリや利用状況の分析を収集する",
  },
  "about.aiPrivacy.willNot.upload": {
    "zh-TW": "主動上傳樂譜到任何伺服器 (除上述可選 AI 功能)",
    en:
      "upload scores to any server on its own (apart from the optional AI "
      + "feature above)",
    ja:
      "楽譜をいずれかのサーバーに自発的にアップロードする "
      + "(上記の任意の AI 機能を除く)",
  },
  "about.aiPrivacy.willNot.track": {
    "zh-TW": "追蹤使用者行為", en: "track user behavior",
    ja: "ユーザーの行動を追跡する",
  },
  "about.aiPrivacy.willIntro": {
    "zh-TW": "Score Arranger {will} 在你的本機儲存:",
    en: "Score Arranger {will} store on your local machine:",
    ja: "Score Arranger は次のものをお使いのローカルマシンに{will}:",
  },
  "about.aiPrivacy.will": {
    "zh-TW": "會", en: "does", ja: "保存します",
  },
  "about.aiPrivacy.will.localStorage": {
    "zh-TW": " — 主題 / 排列方向 / 縮放 / tab 清單 / AI 建議偏好計數",
    en:
      " — theme / layout direction / zoom / tab list / AI suggestion "
      + "preference counts",
    ja:
      " — テーマ / レイアウト方向 / ズーム / タブ一覧 / AI 提案の"
      + "好みのカウント",
  },
  "about.aiPrivacy.will.sessions": {
    "zh-TW": " — 各 tab 的 arrangement 狀態 (跨 App 啟動保持)",
    en: " — each tab's arrangement state (persisted across app launches)",
    ja: " — 各タブの編曲状態 (アプリの起動をまたいで保持)",
  },
  "about.aiPrivacy.will.tmp": {
    "zh-TW":
      " — 用「在外部編輯器開啟」時的暫存檔, 系統會自動清理",
    en:
      " — temporary files used by \"Open in external editor\", cleaned up "
      + "automatically by the system",
    ja:
      " — 「外部エディタで開く」を使用する際の一時ファイル。"
      + "システムによって自動的に削除されます",
  },

  // === About: 商標 ===
  "about.trademarks.intro": {
    "zh-TW": "下列商標屬於其各自所有人:",
    en: "The following trademarks belong to their respective owners:",
    ja: "以下の商標は、それぞれの所有者に帰属します:",
  },
  "about.trademarks.note": {
    "zh-TW":
      "這些名稱在 Score Arranger 介面與文件內以{nominativeFairUse}方式出現, "
      + "僅為標示與這些產品互通的功能 (如「在 MuseScore 開啟」)。"
      + "Score Arranger 與這些公司無任何附屬或代言關係。",
    en:
      "These names appear in the Score Arranger interface and documentation "
      + "under {nominativeFairUse}, solely to indicate features that "
      + "interoperate with these products (such as \"Open in MuseScore\"). "
      + "Score Arranger has no affiliation with or endorsement from these "
      + "companies.",
    ja:
      "これらの名称は、Score Arranger のインターフェースおよびドキュメント"
      + "内において{nominativeFairUse}として使用されており、これらの製品と"
      + "連携する機能 (「MuseScore で開く」など) を示すためのみに用いられて"
      + "います。Score Arranger はこれらの企業と提携関係も推奨関係もありません。",
  },
  "about.trademarks.nominativeFairUse": {
    "zh-TW": "指稱性合理使用 (nominative fair use)",
    en: "nominative fair use",
    ja: "指名的フェアユース (nominative fair use)",
  },

  // ==========================================================================
  // OnboardingWizard
  // ==========================================================================
  "onboard.title": {
    "zh-TW": "歡迎使用 Score Arranger", en: "Welcome to Score Arranger",
    ja: "Score Arranger へようこそ",
  },
  "onboard.skip": { "zh-TW": "跳過", en: "Skip", ja: "スキップ" },
  "onboard.skip.title": {
    "zh-TW": "跳過引導, 之後不再顯示",
    en: "Skip the walkthrough and don't show it again",
    ja: "ガイドをスキップし、今後は表示しない",
  },
  "onboard.progress": {
    "zh-TW": "3 步驟讓你看到改編結果. 步驟 {step} / 3",
    en: "Three steps to see an arrangement. Step {step} / 3",
    ja: "3 ステップで編曲結果が見られます。ステップ {step} / 3",
  },
  "onboard.back": { "zh-TW": "← 上一步", en: "← Back", ja: "← 戻る" },
  "onboard.next": { "zh-TW": "下一步 →", en: "Next →", ja: "次へ →" },
  "onboard.start": {
    "zh-TW": "開始改編", en: "Start arranging", ja: "編曲を開始",
  },
  "onboard.arranging": {
    "zh-TW": "改編中...", en: "Arranging...", ja: "編曲中...",
  },

  // === Onboarding: 範例樂譜標題 ===
  "onboard.sample.bach.title": {
    "zh-TW": "BWV 66.6 (Chorale)", en: "BWV 66.6 (Chorale)",
    ja: "BWV 66.6 (コラール)",
  },
  "onboard.sample.corelli.title": {
    "zh-TW": "Op.3 No.1 'Grave'", en: "Op. 3 No. 1 'Grave'",
    ja: "Op. 3 No. 1 'Grave'",
  },
  "onboard.sample.mozart.title": {
    "zh-TW": "K.155 第一樂章", en: "K. 155, Movement 1",
    ja: "K. 155 第1楽章",
  },
  "onboard.sample.beethoven.title": {
    "zh-TW": "Op.18 No.1 第一樂章", en: "Op. 18 No. 1, Movement 1",
    ja: "Op. 18 No. 1 第1楽章",
  },
  "onboard.sample.haydn.title": {
    "zh-TW": "Op.74 No.1 第一樂章", en: "Op. 74 No. 1, Movement 1",
    ja: "Op. 74 No. 1 第1楽章",
  },

  // === Onboarding: 範例樂譜描述 ===
  "onboard.sample.bach.desc": {
    "zh-TW": "SATB 四部和聲, 短小完整, 改成弦四最直觀.",
    en:
      "Four-part SATB harmony, short and complete — the most "
      + "straightforward to arrange for string quartet.",
    ja:
      "SATB 四部和声で、短くまとまっており、弦楽四重奏への編曲が"
      + "もっとも分かりやすい曲です。",
  },
  "onboard.sample.corelli.desc": {
    "zh-TW": "巴洛克三重奏鳴曲. 改成 baroque_trio_sonata 自動加大鍵琴 continuo.",
    en:
      "A Baroque trio sonata. Arranging for baroque_trio_sonata "
      + "automatically adds a harpsichord continuo.",
    ja:
      "バロックのトリオ・ソナタです。baroque_trio_sonata に編曲すると、"
      + "チェンバロの通奏低音が自動で加わります。",
  },
  "onboard.sample.mozart.desc": {
    "zh-TW": "弦樂四重奏小品. 改編成小提琴+鋼琴或大鍵琴獨奏練手感.",
    en:
      "A short string quartet piece. Arrange it for violin + piano or "
      + "harpsichord solo to get a feel for the tool.",
    ja:
      "弦楽四重奏の小品です。ヴァイオリン + ピアノやチェンバロ独奏に"
      + "編曲して、ツールの感触をつかんでみてください。",
  },
  "onboard.sample.beethoven.desc": {
    "zh-TW": "古典弦四經典. 試 piano_solo 或木管五重奏看不同編制風格.",
    en:
      "A classical string quartet staple. Try piano_solo or woodwind "
      + "quintet to compare ensemble styles.",
    ja:
      "古典派の弦楽四重奏の定番曲です。piano_solo や木管五重奏を試して、"
      + "編成ごとのスタイルを比べてみてください。",
  },
  "onboard.sample.haydn.desc": {
    "zh-TW": "海頓晚期弦四. 對比 Mozart / Beethoven 風格.",
    en:
      "A late Haydn string quartet — a contrast with the Mozart / "
      + "Beethoven styles.",
    ja:
      "ハイドン後期の弦楽四重奏です。Mozart / Beethoven のスタイルとの"
      + "対比になります。",
  },

  // === Onboarding: 編制名稱 ===
  "onboard.ensemble.violinPiano": {
    "zh-TW": "小提琴 + 鋼琴", en: "Violin + piano",
    ja: "ヴァイオリン + ピアノ",
  },
  "onboard.ensemble.stringQuartet": {
    "zh-TW": "弦樂四重奏", en: "String quartet", ja: "弦楽四重奏",
  },
  "onboard.ensemble.pianoSolo": {
    "zh-TW": "鋼琴獨奏", en: "Piano solo", ja: "ピアノ独奏",
  },
  "onboard.ensemble.harpsichordSolo": {
    "zh-TW": "大鍵琴獨奏", en: "Harpsichord solo", ja: "チェンバロ独奏",
  },
  "onboard.ensemble.violinHarpsichord": {
    "zh-TW": "小提琴 + 大鍵琴", en: "Violin + harpsichord",
    ja: "ヴァイオリン + チェンバロ",
  },
  "onboard.ensemble.baroqueTrioSonata": {
    "zh-TW": "巴洛克三重奏鳴曲", en: "Baroque trio sonata",
    ja: "バロック・トリオ・ソナタ",
  },
  "onboard.ensemble.woodwindQuintet": {
    "zh-TW": "木管五重奏", en: "Woodwind quintet", ja: "木管五重奏",
  },
  "onboard.ensemble.brassQuintet": {
    "zh-TW": "銅管五重奏", en: "Brass quintet", ja: "金管五重奏",
  },
  "onboard.ensemble.guitarSolo": {
    "zh-TW": "吉他獨奏", en: "Guitar solo", ja: "ギター独奏",
  },
  "onboard.ensemble.luteSolo": {
    "zh-TW": "魯特琴獨奏", en: "Lute solo", ja: "リュート独奏",
  },
  "onboard.ensemble.harpSolo": {
    "zh-TW": "豎琴獨奏", en: "Harp solo", ja: "ハープ独奏",
  },
  "onboard.ensemble.fluteGuitar": {
    "zh-TW": "長笛 + 吉他", en: "Flute + guitar", ja: "フルート + ギター",
  },

  // === Onboarding: Step 1 ===
  "onboard.step1.heading": {
    "zh-TW": "步驟 1 / 選一首範例樂譜", en: "Step 1 / Pick a sample score",
    ja: "ステップ 1 / サンプル楽譜を選ぶ",
  },
  "onboard.step1.hint": {
    "zh-TW":
      "以下 5 首都已內建, 不需下載. 之後也可以從工具列「匯入」載入自己的譜.",
    en:
      "All five below are built in — no download needed. You can also load "
      + "your own score later via \"Import\" in the toolbar.",
    ja:
      "以下の 5 曲はいずれも内蔵されており、ダウンロードは不要です。"
      + "ご自身の楽譜は、後でツールバーの「インポート」から読み込めます。",
  },

  // === Onboarding: Step 2 ===
  "onboard.step2.heading": {
    "zh-TW": "步驟 2 / 選目標編制", en: "Step 2 / Choose the target ensemble",
    ja: "ステップ 2 / 編曲先の編成を選ぶ",
  },
  "onboard.step2.hint": {
    "zh-TW":
      "改編引擎會把 source 各聲部分配到你選的編制. 若編制人數比 source 多, "
      + "會自動補完內聲部.",
    en:
      "The arranging engine distributes the source parts across the "
      + "ensemble you choose. If the ensemble has more players than the "
      + "source, inner voices are filled in automatically.",
    ja:
      "編曲エンジンが、ソースの各声部を選んだ編成に振り分けます。編成の"
      + "人数がソースより多い場合は、内声が自動的に補完されます。",
  },
  "onboard.step2.skillHeading": {
    "zh-TW": "演奏者技術水平", en: "Player skill level",
    ja: "奏者の技術レベル",
  },
  "onboard.skill.amateur": {
    "zh-TW": "業餘", en: "Amateur", ja: "アマチュア",
  },
  "onboard.skill.amateur.hint": {
    "zh-TW": "簡化和弦, 避難段", en: "Simplifies chords, avoids hard passages",
    ja: "和音を簡素化し、難しい箇所を避けます",
  },
  "onboard.skill.intermediate": {
    "zh-TW": "中級", en: "Intermediate", ja: "中級",
  },
  "onboard.skill.intermediate.hint": {
    "zh-TW": "中庸", en: "Balanced", ja: "バランス重視",
  },
  "onboard.skill.professional": {
    "zh-TW": "專業", en: "Professional", ja: "プロ",
  },
  "onboard.skill.professional.hint": {
    "zh-TW": "完整呈現", en: "Full rendering", ja: "そのまま忠実に再現",
  },

  // === Onboarding: Step 3 ===
  "onboard.step3.heading": {
    "zh-TW": "步驟 3 / 開始", en: "Step 3 / Start",
    ja: "ステップ 3 / 開始",
  },
  "onboard.step3.hint": {
    "zh-TW":
      "按「開始改編」, 系統會載入樂譜並執行改編. 約 5-10 秒看到結果.",
    en:
      "Click \"Start arranging\" and the score will be loaded and arranged. "
      + "Results appear in about 5-10 seconds.",
    ja:
      "「編曲を開始」をクリックすると、楽譜が読み込まれて編曲が実行されます。"
      + "約 5〜10 秒で結果が表示されます。",
  },
  "onboard.step3.scoreLabel": { "zh-TW": "樂譜", en: "Score", ja: "楽譜" },
  "onboard.step3.ensembleLabel": {
    "zh-TW": "目標編制", en: "Target ensemble", ja: "編曲先の編成",
  },
  "onboard.step3.skillLabel": {
    "zh-TW": "技術水平", en: "Skill level", ja: "技術レベル",
  },
  "onboard.step3.footnote": {
    "zh-TW": "完成後可以在工具列換不同編制 / 風格 preset, 隨時微調.",
    en:
      "Afterwards you can switch ensembles / style presets in the toolbar "
      + "and fine-tune at any time.",
    ja:
      "完了後は、ツールバーで編成 / スタイルプリセットを切り替え、"
      + "いつでも微調整できます。",
  },

  // ==========================================================================
  // OMRInstallDialog
  // ==========================================================================
  "omr.retryMsg": {
    "zh-TW": "仍未偵測到, 確認安裝後重試",
    en: "Still not detected — confirm the installation and retry",
    ja: "まだ検出されません。インストールを確認してから再試行してください",
  },
  "omr.heading": {
    "zh-TW": "需要安裝 Audiveris OMR", en: "Audiveris OMR must be installed",
    ja: "Audiveris OMR のインストールが必要です",
  },
  "omr.intro": {
    "zh-TW":
      "PDF 樂譜輸入需要 Audiveris (開源 OMR) 把 PDF 轉成 MusicXML。"
      + "Audiveris 透過 child process 呼叫, 不會 bundle 進 Score Arranger "
      + "(GPLv3 隔離)。",
    en:
      "Importing PDF scores requires Audiveris (open-source OMR) to convert "
      + "the PDF into MusicXML. Audiveris is invoked as a child process and "
      + "is not bundled into Score Arranger (GPLv3 isolation).",
    ja:
      "PDF 楽譜のインポートには、PDF を MusicXML に変換するための "
      + "Audiveris (オープンソースの OMR) が必要です。Audiveris は"
      + "子プロセスとして呼び出され、Score Arranger には同梱されません "
      + "(GPLv3 の分離)。",
  },
  "omr.missingLabel": {
    "zh-TW": "缺少的元件: ", en: "Missing components: ",
    ja: "不足しているコンポーネント: ",
  },
  "omr.cancel": { "zh-TW": "取消", en: "Cancel", ja: "キャンセル" },
  "omr.detecting": {
    "zh-TW": "偵測中...", en: "Detecting...", ja: "検出中...",
  },
  "omr.retry": { "zh-TW": "重新檢查", en: "Re-check", ja: "再チェック" },

  // ==========================================================================
  // PdfImportWarningDialog
  // ==========================================================================
  "pdfWarn.heading": {
    "zh-TW": "PDF 匯入提醒", en: "PDF import notice",
    ja: "PDF インポートに関する注意",
  },
  "pdfWarn.intro": {
    "zh-TW":
      "PDF 樂譜需要先經過 OMR（光學樂譜辨識）自動轉成 MusicXML 才能編輯。"
      + "這項技術目前仍不夠穩定，匯入前請先有心理準備：",
    en:
      "PDF scores must first go through OMR (Optical Music Recognition) to "
      + "be automatically converted into MusicXML before they can be edited. "
      + "This technology is still not very reliable, so please set your "
      + "expectations before importing:",
    ja:
      "PDF 楽譜は、編集できるようにする前に、まず OMR (光学楽譜認識) で"
      + "自動的に MusicXML へ変換する必要があります。この技術は現時点では"
      + "まだ十分に安定しておらず、インポートする前に次の点をご了承"
      + "ください:",
  },
  "pdfWarn.point.errors": {
    "zh-TW":
      "辨識結果常見錯音、漏拍、小節錯位、聲部混淆 —— 樂譜越複雜越明顯。",
    en:
      "Recognition results commonly have wrong notes, missing beats, "
      + "misaligned measures, and confused voices — the more complex the "
      + "score, the more obvious this becomes.",
    ja:
      "認識結果には誤った音符、抜けた拍、小節のずれ、声部の取り違えが"
      + "よく見られます。楽譜が複雑なほど顕著になります。",
  },
  "pdfWarn.point.quality": {
    "zh-TW":
      "掃描品質不佳、手寫譜、或排版緊密的樂譜，準確率會明顯下降。",
    en:
      "Accuracy drops noticeably for poorly scanned, handwritten, or "
      + "densely engraved scores.",
    ja:
      "スキャン品質が低い楽譜、手書きの楽譜、レイアウトが詰まった楽譜"
      + "では、認識精度が明らかに低下します。",
  },
  "pdfWarn.point.time": {
    "zh-TW":
      "辨識約需 1–3 分鐘；完成後請務必對照原譜逐處核對、修正。",
    en:
      "Recognition takes about 1-3 minutes; once it finishes, be sure to "
      + "check and correct every spot against the original score.",
    ja:
      "認識にはおよそ 1〜3 分かかります。完了後は、必ず原譜と照らし合わせて"
      + "一か所ずつ確認・修正してください。",
  },
  "pdfWarn.point.preferXml": {
    "zh-TW":
      "若手上有 MusicXML 或 MIDI 檔，建議優先使用 —— 準確度遠高於 PDF。",
    en:
      "If you have a MusicXML or MIDI file, use it instead — it is far more "
      + "accurate than a PDF.",
    ja:
      "MusicXML または MIDI ファイルをお持ちの場合は、そちらを優先して"
      + "ご利用ください。PDF よりはるかに正確です。",
  },
  "pdfWarn.fileLabel": { "zh-TW": "檔案：", en: "File: ", ja: "ファイル: " },
  "pdfWarn.cancel": { "zh-TW": "取消", en: "Cancel", ja: "キャンセル" },
  "pdfWarn.proceed": {
    "zh-TW": "仍要匯入 PDF", en: "Import PDF anyway",
    ja: "それでも PDF をインポート",
  },

  // ==========================================================================
  // CustomEnsembleDialog
  // ==========================================================================
  "ensemble.family.strings": {
    "zh-TW": "弦樂", en: "Strings", ja: "弦楽器",
  },
  "ensemble.family.woodwind": {
    "zh-TW": "木管", en: "Woodwind", ja: "木管楽器",
  },
  "ensemble.family.brass": { "zh-TW": "銅管", en: "Brass", ja: "金管楽器" },
  "ensemble.family.keyboard": {
    "zh-TW": "鍵盤", en: "Keyboard", ja: "鍵盤楽器",
  },
  "ensemble.family.voice": { "zh-TW": "聲樂", en: "Voice", ja: "声楽" },
  "ensemble.family.percussion": {
    "zh-TW": "打擊", en: "Percussion", ja: "打楽器",
  },

  "ensemble.heading": {
    "zh-TW": "自訂編制", en: "Custom ensemble", ja: "カスタム編成",
  },
  "ensemble.intro": {
    "zh-TW":
      "從樂器庫挑 1-8 個演奏者. 每加一個 player, 改編引擎會嘗試把 source "
      + "的某個聲部分配給他. 多餘的 player 會自動從和聲補完內聲部.",
    en:
      "Pick 1-8 players from the instrument library. For each player added, "
      + "the arranging engine tries to assign one source part. Extra players "
      + "are filled with inner voices drawn from the harmony.",
    ja:
      "楽器ライブラリから 1〜8 名の奏者を選びます。奏者を 1 名追加するごとに、"
      + "編曲エンジンがソースのいずれかの声部をその奏者に割り当てようと"
      + "します。余った奏者には、和声から取り出した内声が自動的に補完"
      + "されます。",
  },
  "ensemble.loading": {
    "zh-TW": "載入樂器庫中...", en: "Loading the instrument library...",
    ja: "楽器ライブラリを読み込み中...",
  },
  "ensemble.addPlayer": {
    "zh-TW": "+ 加演奏者", en: "+ Add player", ja: "+ 奏者を追加",
  },
  "ensemble.addPlayer.atLimit": {
    "zh-TW": " (已達上限 8)", en: " (limit of 8 reached)",
    ja: " (上限の 8 に達しました)",
  },
  "ensemble.cancel": { "zh-TW": "取消", en: "Cancel", ja: "キャンセル" },
  "ensemble.apply": {
    "zh-TW": "使用此編制 ({count})", en: "Use this ensemble ({count})",
    ja: "この編成を使用 ({count})",
  },
  "ensemble.row.displayNamePlaceholder": {
    "zh-TW": "顯示名稱", en: "Display name", ja: "表示名",
  },
  "ensemble.row.staves.title": {
    "zh-TW": "譜表數 — 鍵盤類用 2 (大譜表), 其他單譜",
    en: "Number of staves — use 2 (grand staff) for keyboards, 1 otherwise",
    ja: "譜表の数 — 鍵盤楽器は 2 (大譜表)、それ以外は 1 にします",
  },
  "ensemble.row.staves.one": {
    "zh-TW": "1 譜", en: "1 staff", ja: "1 譜表",
  },
  "ensemble.row.staves.two": {
    "zh-TW": "2 譜", en: "2 staves", ja: "2 譜表",
  },
  "ensemble.row.remove.title": {
    "zh-TW": "刪除此演奏者", en: "Remove this player", ja: "この奏者を削除",
  },
};

import type { BiDict } from "./i18n";

/**
 * 對話框字串 — AboutDialog / OnboardingWizard / OMRInstallDialog /
 * PdfImportWarningDialog / CustomEnsembleDialog。
 */
export const DIALOG_STRINGS: BiDict = {
  // ==========================================================================
  // AboutDialog
  // ==========================================================================
  "about.close": { "zh-TW": "關閉", en: "Close" },

  // === About: 分頁標籤 ===
  "about.tab.overview": { "zh-TW": "概述", en: "Overview" },
  "about.tab.licenses": {
    "zh-TW": "第三方授權", en: "Third-party licenses",
  },
  "about.tab.samples": { "zh-TW": "音訊樣本", en: "Audio samples" },
  "about.tab.corpus": { "zh-TW": "樂譜版權", en: "Score copyright" },
  "about.tab.aiPrivacy": { "zh-TW": "AI / 隱私", en: "AI / privacy" },
  "about.tab.trademarks": { "zh-TW": "商標", en: "Trademarks" },

  // === About: 概述 ===
  "about.overview.intro": {
    "zh-TW":
      "是一款桌面應用程式, 目的是協助音樂人將管弦樂總譜智慧改編為較小編制 "
      + "(如弦樂四重奏、小提琴 + 鋼琴、鋼琴獨奏等)。",
    en:
      "is a desktop application that helps musicians intelligently arrange "
      + "orchestral scores for smaller ensembles (string quartet, "
      + "violin + piano, piano solo, and so on).",
  },
  "about.overview.positioningLabel": {
    "zh-TW": "定位: ", en: "Positioning: ",
  },
  "about.overview.positioningTerm": {
    "zh-TW": "人機協作改編工具", en: "a human-AI collaborative arranging tool",
  },
  "about.overview.positioningRest": {
    "zh-TW": ", 非全自動替代。AI 提供分析、修復、品質量化, 你保有最終決定權。",
    en:
      ", not a fully automated replacement. AI provides analysis, repairs, "
      + "and quality metrics — you keep the final decision.",
  },
  "about.overview.licenseHeading": {
    "zh-TW": "本軟體授權", en: "Software license",
  },
  "about.overview.licenseOpenSource": {
    "zh-TW": "開源軟體", en: "open-source software",
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
  },
  "about.overview.creditsHeading": {
    "zh-TW": "授權與致謝摘要", en: "License & acknowledgements summary",
  },
  "about.overview.creditsIntro": {
    "zh-TW": "Score Arranger 站在許多開源專案的肩膀上:",
    en: "Score Arranger stands on the shoulders of many open-source projects:",
  },
  "about.overview.credit.music21": {
    "zh-TW": "樂譜解析核心", en: "score parsing core",
  },
  "about.overview.credit.osmd": {
    "zh-TW": "內建譜面渲染", en: "built-in score rendering",
  },
  "about.overview.credit.verovio": {
    "zh-TW": "PDF 匯出", en: "PDF export",
  },
  "about.overview.credit.tone": {
    "zh-TW": "音訊播放", en: "audio playback",
  },
  "about.overview.credit.salamander": {
    "zh-TW": "鋼琴取樣", en: "piano samples",
  },
  "about.overview.credit.claude": {
    "zh-TW": "可選 AI 改編建議", en: "optional AI arrangement suggestions",
  },
  "about.overview.creditsFootnote": {
    "zh-TW":
      "詳細版本與條款請見「第三方授權」分頁; 完整 NOTICE 在原始碼 repo 的 "
      + "{notice}。",
    en:
      "See the \"Third-party licenses\" tab for detailed versions and terms; "
      + "the full NOTICE is in {notice} in the source repository.",
  },
  "about.overview.versionHeading": { "zh-TW": "版本", en: "Version" },
  "about.overview.versionLine": {
    "zh-TW": "0.1.0 — © 2026 Kevin Lin · GPL-3.0",
    en: "0.1.0 — © 2026 Kevin Lin · GPL-3.0",
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
  },
  "about.licenses.col.component": { "zh-TW": "元件", en: "Component" },
  "about.licenses.col.license": { "zh-TW": "授權", en: "License" },
  "about.licenses.col.role": { "zh-TW": "用途", en: "Role" },
  "about.licenses.role.music21": {
    "zh-TW": "MusicXML 解析 / 寫入, 樂理分析",
    en: "MusicXML parsing / writing, music theory analysis",
  },
  "about.licenses.role.osmd": {
    "zh-TW": "譜面 SVG 渲染", en: "Score SVG rendering",
  },
  "about.licenses.role.verovio": {
    "zh-TW": "PDF 匯出渲染", en: "PDF export rendering",
  },
  "about.licenses.role.tone": {
    "zh-TW": "Web Audio 引擎", en: "Web Audio engine",
  },
  "about.licenses.role.tonejsMidi": {
    "zh-TW": "MIDI 解析", en: "MIDI parsing",
  },
  "about.licenses.role.jspdf": {
    "zh-TW": "PDF 組裝", en: "PDF assembly",
  },
  "about.licenses.role.react": {
    "zh-TW": "UI 框架", en: "UI framework",
  },
  "about.licenses.role.zustand": {
    "zh-TW": "狀態管理", en: "State management",
  },
  "about.licenses.role.electron": {
    "zh-TW": "桌面 runtime", en: "Desktop runtime",
  },
  "about.licenses.role.mcpSdk": {
    "zh-TW": "Model Context Protocol", en: "Model Context Protocol",
  },
  "about.licenses.verovioHeading": {
    "zh-TW": "Verovio (LGPL-3.0) — 特別聲明",
    en: "Verovio (LGPL-3.0) — special notice",
  },
  "about.licenses.verovioIntro": {
    "zh-TW":
      "Verovio 採用 GNU Lesser General Public License v3 (或更新版本)。"
      + "其用於 Score Arranger 的 PDF 匯出功能。LGPL 條款下:",
    en:
      "Verovio is licensed under the GNU Lesser General Public License v3 "
      + "(or any later version). It powers Score Arranger's PDF export. "
      + "Under the LGPL terms:",
  },
  "about.licenses.verovioReplaceTerm": {
    "zh-TW": "替換權", en: "Right to replace",
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
  },
  "about.licenses.verovioSourceTerm": {
    "zh-TW": "原始碼可取得性", en: "Source code availability",
  },
  "about.licenses.verovioSourceBody": {
    "zh-TW":
      " — 對應版本的原始碼公開於 {repo}。Score Arranger 未對 Verovio 做修改。",
    en:
      " — the source code for the corresponding version is published at "
      + "{repo}. Score Arranger has not modified Verovio.",
  },
  "about.licenses.verovioNoRestrictTerm": {
    "zh-TW": "無額外限制", en: "No additional restrictions",
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
  },

  // === About: 音訊樣本 ===
  "about.samples.intro": {
    "zh-TW":
      "播放功能使用線上音訊樣本, {notBundled}, 首次播放時從各自的官方 CDN "
      + "載入。",
    en:
      "Playback uses online audio samples that {notBundled}; they are loaded "
      + "from their respective official CDNs the first time you play.",
  },
  "about.samples.notBundled": {
    "zh-TW": "不打包進 App", en: "are not bundled into the app",
  },
  "about.samples.licenseLabel": { "zh-TW": "License: ", en: "License: " },
  "about.samples.sourceLabel": { "zh-TW": "Source: ", en: "Source: " },
  "about.samples.salamanderNote": {
    "zh-TW":
      "CC-BY 3.0 授權要求, 凡使用該樣本產生衍生作品時必須給予歸屬。"
      + "本 About 頁面之顯示即為合規之歸屬聲明。",
    en:
      "The CC-BY 3.0 license requires attribution whenever derivative works "
      + "are produced using these samples. This About page serves as the "
      + "compliant attribution notice.",
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
  },

  // === About: 樂譜版權 ===
  "about.corpus.intro": {
    "zh-TW":
      "Score Arranger 的「範例 ▾」選單列出約 30 首 music21 內建 corpus "
      + "作品作為快速試用素材。",
    en:
      "Score Arranger's \"Samples ▾\" menu lists about 30 works from the "
      + "built-in music21 corpus as quick try-out material.",
  },
  "about.corpus.worksHeading": { "zh-TW": "樂曲本身", en: "The works" },
  "about.corpus.publicDomain": {
    "zh-TW": "公共領域", en: "the public domain",
  },
  "about.corpus.worksBody": {
    "zh-TW":
      "所有列出的作曲家 (Bach, Mozart, Beethoven, Schubert, Chopin 等) "
      + "都已逝世逾 70 年, 作品本身在絕大多數司法管轄區內已進入{publicDomain}。",
    en:
      "All listed composers (Bach, Mozart, Beethoven, Schubert, Chopin, and "
      + "others) died more than 70 years ago, so the works themselves are in "
      + "{publicDomain} in most jurisdictions.",
  },
  "about.corpus.encodingHeading": {
    "zh-TW": "MusicXML 編碼", en: "MusicXML encodings",
  },
  "about.corpus.encodingBody": {
    "zh-TW":
      "雖然樂曲本身是公領域, 但 music21 corpus 內各 MusicXML 編碼檔可能 "
      + "有額外的版權聲明或限制。music21 corpus license 明文:",
    en:
      "Although the works themselves are public domain, individual MusicXML "
      + "encoding files in the music21 corpus may carry additional copyright "
      + "notices or restrictions. The music21 corpus license states:",
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
  },
  "about.corpus.adviceTerm": {
    "zh-TW": "商業發行建議", en: "Commercial release advice",
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
  },

  // === About: AI / 隱私 ===
  "about.aiPrivacy.aiHeading": {
    "zh-TW": "AI 改編建議 (可選)", en: "AI arrangement suggestions (optional)",
  },
  "about.aiPrivacy.aiIntro": {
    "zh-TW":
      "Score Arranger 的「🤖 AI 建議」功能透過 Anthropic Claude API "
      + "提供改編顧問。",
    en:
      "Score Arranger's \"🤖 AI suggestions\" feature provides an arranging "
      + "advisor through the Anthropic Claude API.",
  },
  "about.aiPrivacy.apiKeyTerm": { "zh-TW": "API Key", en: "API key" },
  "about.aiPrivacy.apiKeyBody": {
    "zh-TW":
      ": 使用者透過環境變數 {envVar} 自行提供。Key 不會打包進 App, "
      + "不會被儲存到磁碟, 不會傳給 Score Arranger 開發者。",
    en:
      ": you provide it yourself via the {envVar} environment variable. The "
      + "key is not bundled into the app, is not saved to disk, and is not "
      + "sent to the Score Arranger developers.",
  },
  "about.aiPrivacy.sentDataTerm": { "zh-TW": "送出資料", en: "Data sent" },
  "about.aiPrivacy.sentDataBody": {
    "zh-TW":
      ": 使用者按下 🤖 時, 僅該小節的譜面段落 (音符、力度) "
      + "與使用者輸入的問題會送至 Claude API。",
    en:
      ": when you click 🤖, only that measure's score segment (notes and "
      + "dynamics) and the question you typed are sent to the Claude API.",
  },
  "about.aiPrivacy.termsTerm": { "zh-TW": "使用條款", en: "Terms of use" },
  "about.aiPrivacy.termsBody": {
    "zh-TW":
      ": 使用 Claude API 需遵守 Anthropic 的 AUP (Acceptable Use Policy) "
      + "與商業條款。",
    en:
      ": use of the Claude API is subject to Anthropic's AUP (Acceptable Use "
      + "Policy) and commercial terms.",
  },
  "about.aiPrivacy.disableTerm": { "zh-TW": "停用", en: "Disabling" },
  "about.aiPrivacy.disableBody": {
    "zh-TW": ": 不設定 {envVar} 則完全不發送 API 請求。",
    en: ": if {envVar} is not set, no API requests are sent at all.",
  },
  "about.aiPrivacy.privacyHeading": {
    "zh-TW": "隱私聲明", en: "Privacy statement",
  },
  "about.aiPrivacy.willNotIntro": {
    "zh-TW": "Score Arranger {willNot}:", en: "Score Arranger {willNot}:",
  },
  "about.aiPrivacy.willNot": { "zh-TW": "不會", en: "does not" },
  "about.aiPrivacy.willNot.telemetry": {
    "zh-TW": "蒐集遙測或使用分析",
    en: "collect telemetry or usage analytics",
  },
  "about.aiPrivacy.willNot.upload": {
    "zh-TW": "主動上傳樂譜到任何伺服器 (除上述可選 AI 功能)",
    en:
      "upload scores to any server on its own (apart from the optional AI "
      + "feature above)",
  },
  "about.aiPrivacy.willNot.track": {
    "zh-TW": "追蹤使用者行為", en: "track user behavior",
  },
  "about.aiPrivacy.willIntro": {
    "zh-TW": "Score Arranger {will} 在你的本機儲存:",
    en: "Score Arranger {will} store on your local machine:",
  },
  "about.aiPrivacy.will": { "zh-TW": "會", en: "does" },
  "about.aiPrivacy.will.localStorage": {
    "zh-TW": " — 主題 / 排列方向 / 縮放 / tab 清單 / AI 建議偏好計數",
    en:
      " — theme / layout direction / zoom / tab list / AI suggestion "
      + "preference counts",
  },
  "about.aiPrivacy.will.sessions": {
    "zh-TW": " — 各 tab 的 arrangement 狀態 (跨 App 啟動保持)",
    en: " — each tab's arrangement state (persisted across app launches)",
  },
  "about.aiPrivacy.will.tmp": {
    "zh-TW":
      " — 用「在外部編輯器開啟」時的暫存檔, 系統會自動清理",
    en:
      " — temporary files used by \"Open in external editor\", cleaned up "
      + "automatically by the system",
  },

  // === About: 商標 ===
  "about.trademarks.intro": {
    "zh-TW": "下列商標屬於其各自所有人:",
    en: "The following trademarks belong to their respective owners:",
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
  },
  "about.trademarks.nominativeFairUse": {
    "zh-TW": "指稱性合理使用 (nominative fair use)",
    en: "nominative fair use",
  },

  // ==========================================================================
  // OnboardingWizard
  // ==========================================================================
  "onboard.title": {
    "zh-TW": "歡迎使用 Score Arranger", en: "Welcome to Score Arranger",
  },
  "onboard.skip": { "zh-TW": "跳過", en: "Skip" },
  "onboard.skip.title": {
    "zh-TW": "跳過引導, 之後不再顯示",
    en: "Skip the walkthrough and don't show it again",
  },
  "onboard.progress": {
    "zh-TW": "3 步驟讓你看到改編結果. 步驟 {step} / 3",
    en: "Three steps to see an arrangement. Step {step} / 3",
  },
  "onboard.back": { "zh-TW": "← 上一步", en: "← Back" },
  "onboard.next": { "zh-TW": "下一步 →", en: "Next →" },
  "onboard.start": { "zh-TW": "開始改編", en: "Start arranging" },
  "onboard.arranging": { "zh-TW": "改編中...", en: "Arranging..." },

  // === Onboarding: 範例樂譜標題 ===
  "onboard.sample.bach.title": {
    "zh-TW": "BWV 66.6 (Chorale)", en: "BWV 66.6 (Chorale)",
  },
  "onboard.sample.corelli.title": {
    "zh-TW": "Op.3 No.1 'Grave'", en: "Op. 3 No. 1 'Grave'",
  },
  "onboard.sample.mozart.title": {
    "zh-TW": "K.155 第一樂章", en: "K. 155, Movement 1",
  },
  "onboard.sample.beethoven.title": {
    "zh-TW": "Op.18 No.1 第一樂章", en: "Op. 18 No. 1, Movement 1",
  },
  "onboard.sample.haydn.title": {
    "zh-TW": "Op.74 No.1 第一樂章", en: "Op. 74 No. 1, Movement 1",
  },

  // === Onboarding: 範例樂譜描述 ===
  "onboard.sample.bach.desc": {
    "zh-TW": "SATB 四部和聲, 短小完整, 改成弦四最直觀.",
    en:
      "Four-part SATB harmony, short and complete — the most "
      + "straightforward to arrange for string quartet.",
  },
  "onboard.sample.corelli.desc": {
    "zh-TW": "巴洛克三重奏鳴曲. 改成 baroque_trio_sonata 自動加大鍵琴 continuo.",
    en:
      "A Baroque trio sonata. Arranging for baroque_trio_sonata "
      + "automatically adds a harpsichord continuo.",
  },
  "onboard.sample.mozart.desc": {
    "zh-TW": "弦樂四重奏小品. 改編成小提琴+鋼琴或大鍵琴獨奏練手感.",
    en:
      "A short string quartet piece. Arrange it for violin + piano or "
      + "harpsichord solo to get a feel for the tool.",
  },
  "onboard.sample.beethoven.desc": {
    "zh-TW": "古典弦四經典. 試 piano_solo 或木管五重奏看不同編制風格.",
    en:
      "A classical string quartet staple. Try piano_solo or woodwind "
      + "quintet to compare ensemble styles.",
  },
  "onboard.sample.haydn.desc": {
    "zh-TW": "海頓晚期弦四. 對比 Mozart / Beethoven 風格.",
    en:
      "A late Haydn string quartet — a contrast with the Mozart / "
      + "Beethoven styles.",
  },

  // === Onboarding: 編制名稱 ===
  "onboard.ensemble.violinPiano": {
    "zh-TW": "小提琴 + 鋼琴", en: "Violin + piano",
  },
  "onboard.ensemble.stringQuartet": {
    "zh-TW": "弦樂四重奏", en: "String quartet",
  },
  "onboard.ensemble.pianoSolo": { "zh-TW": "鋼琴獨奏", en: "Piano solo" },
  "onboard.ensemble.harpsichordSolo": {
    "zh-TW": "大鍵琴獨奏", en: "Harpsichord solo",
  },
  "onboard.ensemble.violinHarpsichord": {
    "zh-TW": "小提琴 + 大鍵琴", en: "Violin + harpsichord",
  },
  "onboard.ensemble.baroqueTrioSonata": {
    "zh-TW": "巴洛克三重奏鳴曲", en: "Baroque trio sonata",
  },
  "onboard.ensemble.woodwindQuintet": {
    "zh-TW": "木管五重奏", en: "Woodwind quintet",
  },
  "onboard.ensemble.brassQuintet": {
    "zh-TW": "銅管五重奏", en: "Brass quintet",
  },

  // === Onboarding: Step 1 ===
  "onboard.step1.heading": {
    "zh-TW": "步驟 1 / 選一首範例樂譜", en: "Step 1 / Pick a sample score",
  },
  "onboard.step1.hint": {
    "zh-TW":
      "以下 5 首都已內建, 不需下載. 之後也可以從工具列「匯入」載入自己的譜.",
    en:
      "All five below are built in — no download needed. You can also load "
      + "your own score later via \"Import\" in the toolbar.",
  },

  // === Onboarding: Step 2 ===
  "onboard.step2.heading": {
    "zh-TW": "步驟 2 / 選目標編制", en: "Step 2 / Choose the target ensemble",
  },
  "onboard.step2.hint": {
    "zh-TW":
      "改編引擎會把 source 各聲部分配到你選的編制. 若編制人數比 source 多, "
      + "會自動補完內聲部.",
    en:
      "The arranging engine distributes the source parts across the "
      + "ensemble you choose. If the ensemble has more players than the "
      + "source, inner voices are filled in automatically.",
  },
  "onboard.step2.skillHeading": {
    "zh-TW": "演奏者技術水平", en: "Player skill level",
  },
  "onboard.skill.amateur": { "zh-TW": "業餘", en: "Amateur" },
  "onboard.skill.amateur.hint": {
    "zh-TW": "簡化和弦, 避難段", en: "Simplifies chords, avoids hard passages",
  },
  "onboard.skill.intermediate": { "zh-TW": "中級", en: "Intermediate" },
  "onboard.skill.intermediate.hint": {
    "zh-TW": "中庸", en: "Balanced",
  },
  "onboard.skill.professional": { "zh-TW": "專業", en: "Professional" },
  "onboard.skill.professional.hint": {
    "zh-TW": "完整呈現", en: "Full rendering",
  },

  // === Onboarding: Step 3 ===
  "onboard.step3.heading": { "zh-TW": "步驟 3 / 開始", en: "Step 3 / Start" },
  "onboard.step3.hint": {
    "zh-TW":
      "按「開始改編」, 系統會載入樂譜並執行改編. 約 5-10 秒看到結果.",
    en:
      "Click \"Start arranging\" and the score will be loaded and arranged. "
      + "Results appear in about 5-10 seconds.",
  },
  "onboard.step3.scoreLabel": { "zh-TW": "樂譜", en: "Score" },
  "onboard.step3.ensembleLabel": {
    "zh-TW": "目標編制", en: "Target ensemble",
  },
  "onboard.step3.skillLabel": { "zh-TW": "技術水平", en: "Skill level" },
  "onboard.step3.footnote": {
    "zh-TW": "完成後可以在工具列換不同編制 / 風格 preset, 隨時微調.",
    en:
      "Afterwards you can switch ensembles / style presets in the toolbar "
      + "and fine-tune at any time.",
  },

  // ==========================================================================
  // OMRInstallDialog
  // ==========================================================================
  "omr.retryMsg": {
    "zh-TW": "仍未偵測到, 確認安裝後重試",
    en: "Still not detected — confirm the installation and retry",
  },
  "omr.heading": {
    "zh-TW": "需要安裝 Audiveris OMR", en: "Audiveris OMR must be installed",
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
  },
  "omr.missingLabel": { "zh-TW": "缺少的元件: ", en: "Missing components: " },
  "omr.cancel": { "zh-TW": "取消", en: "Cancel" },
  "omr.detecting": { "zh-TW": "偵測中...", en: "Detecting..." },
  "omr.retry": { "zh-TW": "重新檢查", en: "Re-check" },

  // ==========================================================================
  // PdfImportWarningDialog
  // ==========================================================================
  "pdfWarn.heading": { "zh-TW": "PDF 匯入提醒", en: "PDF import notice" },
  "pdfWarn.intro": {
    "zh-TW":
      "PDF 樂譜需要先經過 OMR（光學樂譜辨識）自動轉成 MusicXML 才能編輯。"
      + "這項技術目前仍不夠穩定，匯入前請先有心理準備：",
    en:
      "PDF scores must first go through OMR (Optical Music Recognition) to "
      + "be automatically converted into MusicXML before they can be edited. "
      + "This technology is still not very reliable, so please set your "
      + "expectations before importing:",
  },
  "pdfWarn.point.errors": {
    "zh-TW":
      "辨識結果常見錯音、漏拍、小節錯位、聲部混淆 —— 樂譜越複雜越明顯。",
    en:
      "Recognition results commonly have wrong notes, missing beats, "
      + "misaligned measures, and confused voices — the more complex the "
      + "score, the more obvious this becomes.",
  },
  "pdfWarn.point.quality": {
    "zh-TW":
      "掃描品質不佳、手寫譜、或排版緊密的樂譜，準確率會明顯下降。",
    en:
      "Accuracy drops noticeably for poorly scanned, handwritten, or "
      + "densely engraved scores.",
  },
  "pdfWarn.point.time": {
    "zh-TW":
      "辨識約需 1–3 分鐘；完成後請務必對照原譜逐處核對、修正。",
    en:
      "Recognition takes about 1-3 minutes; once it finishes, be sure to "
      + "check and correct every spot against the original score.",
  },
  "pdfWarn.point.preferXml": {
    "zh-TW":
      "若手上有 MusicXML 或 MIDI 檔，建議優先使用 —— 準確度遠高於 PDF。",
    en:
      "If you have a MusicXML or MIDI file, use it instead — it is far more "
      + "accurate than a PDF.",
  },
  "pdfWarn.fileLabel": { "zh-TW": "檔案：", en: "File: " },
  "pdfWarn.cancel": { "zh-TW": "取消", en: "Cancel" },
  "pdfWarn.proceed": { "zh-TW": "仍要匯入 PDF", en: "Import PDF anyway" },

  // ==========================================================================
  // CustomEnsembleDialog
  // ==========================================================================
  "ensemble.family.strings": { "zh-TW": "弦樂", en: "Strings" },
  "ensemble.family.woodwind": { "zh-TW": "木管", en: "Woodwind" },
  "ensemble.family.brass": { "zh-TW": "銅管", en: "Brass" },
  "ensemble.family.keyboard": { "zh-TW": "鍵盤", en: "Keyboard" },
  "ensemble.family.voice": { "zh-TW": "聲樂", en: "Voice" },
  "ensemble.family.percussion": { "zh-TW": "打擊", en: "Percussion" },

  "ensemble.heading": { "zh-TW": "自訂編制", en: "Custom ensemble" },
  "ensemble.intro": {
    "zh-TW":
      "從樂器庫挑 1-8 個演奏者. 每加一個 player, 改編引擎會嘗試把 source "
      + "的某個聲部分配給他. 多餘的 player 會自動從和聲補完內聲部.",
    en:
      "Pick 1-8 players from the instrument library. For each player added, "
      + "the arranging engine tries to assign one source part. Extra players "
      + "are filled with inner voices drawn from the harmony.",
  },
  "ensemble.loading": {
    "zh-TW": "載入樂器庫中...", en: "Loading the instrument library...",
  },
  "ensemble.addPlayer": { "zh-TW": "+ 加演奏者", en: "+ Add player" },
  "ensemble.addPlayer.atLimit": {
    "zh-TW": " (已達上限 8)", en: " (limit of 8 reached)",
  },
  "ensemble.cancel": { "zh-TW": "取消", en: "Cancel" },
  "ensemble.apply": {
    "zh-TW": "使用此編制 ({count})", en: "Use this ensemble ({count})",
  },
  "ensemble.row.displayNamePlaceholder": {
    "zh-TW": "顯示名稱", en: "Display name",
  },
  "ensemble.row.staves.title": {
    "zh-TW": "譜表數 — 鍵盤類用 2 (大譜表), 其他單譜",
    en: "Number of staves — use 2 (grand staff) for keyboards, 1 otherwise",
  },
  "ensemble.row.staves.one": { "zh-TW": "1 譜", en: "1 staff" },
  "ensemble.row.staves.two": { "zh-TW": "2 譜", en: "2 staves" },
  "ensemble.row.remove.title": {
    "zh-TW": "刪除此演奏者", en: "Remove this player",
  },
};

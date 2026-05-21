import type { BiDict } from "./i18n";

/**
 * 範例曲庫 / 移植介面字串 — PresetLibrary / TranscribePanel / SetupHint。
 */
export const LIBRARY_STRINGS: BiDict = {
  // ── PresetLibrary — chrome ────────────────────────────────
  "preset.button": { "zh-TW": "範例 ▾", en: "Samples ▾" },
  "preset.badge.xl": { "zh-TW": "XL", en: "XL" },
  "preset.badge.xl.title": {
    "zh-TW": "非常大 — 載入可能花數十秒, ribbon/autofit 會自動關閉",
    en:
      "Very large — loading may take tens of seconds; "
      + "ribbon/autofit will be turned off automatically",
  },
  "preset.badge.l": { "zh-TW": "L", en: "L" },
  "preset.badge.l.title": {
    "zh-TW": "較大 — 第一次載入可能花 10–30 秒",
    en: "Large — the first load may take 10–30 seconds",
  },
  "preset.loading": {
    "zh-TW": "載入 {name}...",
    en: "Loading {name}...",
  },
  "preset.error.loadFailed": { "zh-TW": "載入失敗", en: "Failed to load" },
  "preset.confirm.huge": {
    "zh-TW":
      "這份樂譜有 {measures} 小節 — 非常大, OSMD 渲染可能需要 30–90 秒並可能讓畫面短暫無回應 (renderer 在處理超長 SVG)。\n\n建議先把「自動縮放」和「上下排列 ribbon」關掉再載入, 或先試短一點的範例。\n\n要繼續嗎?",
    en:
      "This score has {measures} measures — very large. OSMD rendering may "
      + "take 30–90 seconds and the screen may briefly become unresponsive "
      + "(the renderer is processing a very long SVG).\n\n"
      + "Consider turning off \"auto-fit\" and the \"stacked ribbon\" layout "
      + "before loading, or try a shorter sample first.\n\nContinue?",
  },
  "preset.confirm.large": {
    "zh-TW":
      "這份樂譜有 {measures} 小節 (>{threshold}) — 較大, 第一次渲染可能花 10–30 秒。\n\n要繼續嗎?",
    en:
      "This score has {measures} measures (>{threshold}) — large. "
      + "The first render may take 10–30 seconds.\n\nContinue?",
  },

  // ── PresetLibrary — era labels ────────────────────────────
  "preset.era.baroque": { "zh-TW": "巴洛克", en: "Baroque" },
  "preset.era.classical": { "zh-TW": "古典", en: "Classical" },
  "preset.era.romantic": { "zh-TW": "浪漫派", en: "Romantic" },

  // ── PresetLibrary — ensemble labels ───────────────────────
  "preset.ensemble.satb": { "zh-TW": "SATB", en: "SATB" },
  "preset.ensemble.5parts": { "zh-TW": "5 parts", en: "5 parts" },
  "preset.ensemble.trioSonata": { "zh-TW": "Trio Sonata", en: "Trio Sonata" },
  "preset.ensemble.voiceAccomp": {
    "zh-TW": "聲樂 + 伴奏",
    en: "Voice + accompaniment",
  },
  "preset.ensemble.stringQuartet": {
    "zh-TW": "弦樂四重奏",
    en: "String quartet",
  },
  "preset.ensemble.stringQuartetLong": {
    "zh-TW": "弦樂四重奏 (長)",
    en: "String quartet (long)",
  },
  "preset.ensemble.pianoSolo": { "zh-TW": "鋼琴獨奏", en: "Piano solo" },
  "preset.ensemble.voicePiano": {
    "zh-TW": "聲樂 + 鋼琴",
    en: "Voice + piano",
  },
  "preset.ensemble.pianoTrio": { "zh-TW": "鋼琴三重奏", en: "Piano trio" },

  // ── PresetLibrary — piece display names ───────────────────
  // 作曲家名 / 作品編號為專有名詞, 僅翻譯曲種與樂章等說明字。
  "preset.piece.bwv66.6": {
    "zh-TW": "Bach 聖詠 BWV 66/6",
    en: "Bach Chorale BWV 66/6",
  },
  "preset.piece.bwv7.7": {
    "zh-TW": "Bach 聖詠 BWV 7/7",
    en: "Bach Chorale BWV 7/7",
  },
  "preset.piece.bwv57.8": {
    "zh-TW": "Bach 聖詠 BWV 57/8",
    en: "Bach Chorale BWV 57/8",
  },
  "preset.piece.bwv4.8": {
    "zh-TW": "Bach 聖詠 BWV 4/8 (Christ lag in Todesbanden)",
    en: "Bach Chorale BWV 4/8 (Christ lag in Todesbanden)",
  },
  "preset.piece.bwv227.7": {
    "zh-TW": "Bach 經文歌 BWV 227 第 7 樂章",
    en: "Bach Motet BWV 227, Movement 7",
  },
  "preset.piece.bwv281": {
    "zh-TW": "Bach 聖詠 BWV 281 (Christus, der ist mein Leben)",
    en: "Bach Chorale BWV 281 (Christus, der ist mein Leben)",
  },
  "preset.piece.bwv344": {
    "zh-TW": "Bach 聖詠 BWV 344",
    en: "Bach Chorale BWV 344",
  },
  "preset.piece.bwv1.6": {
    "zh-TW": "Bach 聖詠 BWV 1/6 (含法國號)",
    en: "Bach Chorale BWV 1/6 (with horn)",
  },
  "preset.piece.corelliOp3no1Grave": {
    "zh-TW": "Corelli 三重奏鳴曲 op.3/1 Grave",
    en: "Corelli Trio Sonata op.3/1 Grave",
  },
  "preset.piece.handelRinaldoLascia": {
    "zh-TW": "Handel 歌劇《里納爾多》— 讓我哭泣吧",
    en: "Handel opera Rinaldo — Lascia ch'io pianga",
  },
  "preset.piece.k80m1": {
    "zh-TW": "Mozart 弦樂四重奏 K.80 第一樂章",
    en: "Mozart String Quartet K.80, Movement 1",
  },
  "preset.piece.k80m2": {
    "zh-TW": "Mozart 弦樂四重奏 K.80 第二樂章",
    en: "Mozart String Quartet K.80, Movement 2",
  },
  "preset.piece.k80m3": {
    "zh-TW": "Mozart 弦樂四重奏 K.80 第三樂章 (Minuet)",
    en: "Mozart String Quartet K.80, Movement 3 (Minuet)",
  },
  "preset.piece.k80m4": {
    "zh-TW": "Mozart 弦樂四重奏 K.80 第四樂章",
    en: "Mozart String Quartet K.80, Movement 4",
  },
  "preset.piece.k155m1": {
    "zh-TW": "Mozart 弦樂四重奏 K.155 第一樂章",
    en: "Mozart String Quartet K.155, Movement 1",
  },
  "preset.piece.k155m2": {
    "zh-TW": "Mozart 弦樂四重奏 K.155 第二樂章",
    en: "Mozart String Quartet K.155, Movement 2",
  },
  "preset.piece.k155m3": {
    "zh-TW": "Mozart 弦樂四重奏 K.155 第三樂章 (Minuet)",
    en: "Mozart String Quartet K.155, Movement 3 (Minuet)",
  },
  "preset.piece.k156m1": {
    "zh-TW": "Mozart 弦樂四重奏 K.156 第一樂章",
    en: "Mozart String Quartet K.156, Movement 1",
  },
  "preset.piece.k156m2": {
    "zh-TW": "Mozart 弦樂四重奏 K.156 第二樂章",
    en: "Mozart String Quartet K.156, Movement 2",
  },
  "preset.piece.k156m3": {
    "zh-TW": "Mozart 弦樂四重奏 K.156 第三樂章 (Minuet)",
    en: "Mozart String Quartet K.156, Movement 3 (Minuet)",
  },
  "preset.piece.k156m4": {
    "zh-TW": "Mozart 弦樂四重奏 K.156 第四樂章",
    en: "Mozart String Quartet K.156, Movement 4",
  },
  "preset.piece.k458m1": {
    "zh-TW": "Mozart 弦樂四重奏 K.458「狩獵」第一樂章",
    en: "Mozart String Quartet K.458 \"The Hunt\", Movement 1",
  },
  "preset.piece.k458m2": {
    "zh-TW": "Mozart 弦樂四重奏 K.458「狩獵」第二樂章 (Minuet)",
    en: "Mozart String Quartet K.458 \"The Hunt\", Movement 2 (Minuet)",
  },
  "preset.piece.k458m3": {
    "zh-TW": "Mozart 弦樂四重奏 K.458「狩獵」第三樂章",
    en: "Mozart String Quartet K.458 \"The Hunt\", Movement 3",
  },
  "preset.piece.k458m4": {
    "zh-TW": "Mozart 弦樂四重奏 K.458「狩獵」第四樂章",
    en: "Mozart String Quartet K.458 \"The Hunt\", Movement 4",
  },
  "preset.piece.haydnOp1no1m1": {
    "zh-TW": "Haydn 弦樂四重奏 op.1/1 第一樂章",
    en: "Haydn String Quartet op.1/1, Movement 1",
  },
  "preset.piece.haydnOp1no1m2": {
    "zh-TW": "Haydn 弦樂四重奏 op.1/1 第二樂章 (Minuet)",
    en: "Haydn String Quartet op.1/1, Movement 2 (Minuet)",
  },
  "preset.piece.haydnOp74no1m1": {
    "zh-TW": "Haydn 弦樂四重奏 op.74/1 第一樂章",
    en: "Haydn String Quartet op.74/1, Movement 1",
  },
  "preset.piece.haydnOp74no1m2": {
    "zh-TW": "Haydn 弦樂四重奏 op.74/1 第二樂章",
    en: "Haydn String Quartet op.74/1, Movement 2",
  },
  "preset.piece.haydnOp74no1m3": {
    "zh-TW": "Haydn 弦樂四重奏 op.74/1 第三樂章 (Minuet)",
    en: "Haydn String Quartet op.74/1, Movement 3 (Minuet)",
  },
  "preset.piece.haydnOp74no1m4": {
    "zh-TW": "Haydn 弦樂四重奏 op.74/1 第四樂章",
    en: "Haydn String Quartet op.74/1, Movement 4",
  },
  "preset.piece.beethovenOp18no1m1": {
    "zh-TW": "Beethoven 弦樂四重奏 op.18/1 第一樂章",
    en: "Beethoven String Quartet op.18/1, Movement 1",
  },
  "preset.piece.beethovenOp18no1m2": {
    "zh-TW": "Beethoven 弦樂四重奏 op.18/1 第二樂章",
    en: "Beethoven String Quartet op.18/1, Movement 2",
  },
  "preset.piece.beethovenOp18no1m3": {
    "zh-TW": "Beethoven 弦樂四重奏 op.18/1 第三樂章 (Scherzo)",
    en: "Beethoven String Quartet op.18/1, Movement 3 (Scherzo)",
  },
  "preset.piece.beethovenOp18no1m4": {
    "zh-TW": "Beethoven 弦樂四重奏 op.18/1 第四樂章",
    en: "Beethoven String Quartet op.18/1, Movement 4",
  },
  "preset.piece.beethovenOp59no1m1": {
    "zh-TW": "Beethoven 弦樂四重奏 op.59/1「拉茲莫夫斯基」第一樂章",
    en: "Beethoven String Quartet op.59/1 \"Razumovsky\", Movement 1",
  },
  "preset.piece.beethovenOp132": {
    "zh-TW": "Beethoven 弦樂四重奏 op.132 (晚期)",
    en: "Beethoven String Quartet op.132 (late)",
  },
  "preset.piece.k545m1Exposition": {
    "zh-TW": "Mozart 鋼琴奏鳴曲 K.545 第一樂章 (呈示部)",
    en: "Mozart Piano Sonata K.545, Movement 1 (exposition)",
  },
  "preset.piece.chopinMazurka06.2": {
    "zh-TW": "Chopin Mazurka op.6 no.2",
    en: "Chopin Mazurka op.6 no.2",
  },
  "preset.piece.joplinMapleLeafRag": {
    "zh-TW": "Joplin 楓葉繁音曲 (Maple Leaf Rag)",
    en: "Joplin Maple Leaf Rag",
  },
  "preset.piece.schubertLindenbaum": {
    "zh-TW": "Schubert 菩提樹 (Der Lindenbaum)",
    en: "Schubert Der Lindenbaum",
  },
  "preset.piece.claraSchumannOp17m3": {
    "zh-TW": "Clara Schumann 鋼琴三重奏 op.17 第三樂章",
    en: "Clara Schumann Piano Trio op.17, Movement 3",
  },
  "preset.piece.schumannDichterliebeNo2": {
    "zh-TW": "Schumann 詩人之戀 第 2 首",
    en: "Schumann Dichterliebe, No. 2",
  },
  "preset.piece.schumannOp48no2": {
    "zh-TW": "Schumann op.48 no.2",
    en: "Schumann op.48 no.2",
  },
  "preset.piece.verdiLaDonnaEMobile": {
    "zh-TW": "Verdi 歌劇《弄臣》— 善變的女人",
    en: "Verdi opera Rigoletto — La donna è mobile",
  },

  // ── TranscribePanel ───────────────────────────────────────
  "transcribe.hint": {
    "zh-TW":
      "把 source 的部分樂器替換成另一種, 自動處理移調與音域。預設「同樂器"
      + "合併設定」; 勾「per-part」可單獨指定 (協奏曲只換獨奏用這個)。半音數"
      + "留空 = 自動推算 (cello→violin 預設 +19 等慣例)。",
    en:
      "Swap selected source instruments for another, with transposition and "
      + "range handled automatically. By default settings are merged per "
      + "instrument; check \"per-part\" to target one part on its own (use "
      + "this to swap only a concerto soloist). Leave semitones blank for "
      + "automatic inference (e.g. the conventional cello→violin +19).",
  },
  "transcribe.col.part": { "zh-TW": "Part", en: "Part" },
  "transcribe.col.sourceInstrument": {
    "zh-TW": "原樂器",
    en: "Source instrument",
  },
  "transcribe.col.targetInstrument": {
    "zh-TW": "→ 目標樂器",
    en: "→ Target instrument",
  },
  "transcribe.col.semitones": { "zh-TW": "半音", en: "Semitones" },
  "transcribe.col.fit": { "zh-TW": "Fit", en: "Fit" },
  "transcribe.col.perPart": { "zh-TW": "Per-part", en: "Per-part" },
  "transcribe.option.unchanged": {
    "zh-TW": "(不變) {instrument}",
    en: "(unchanged) {instrument}",
  },
  "transcribe.semitones.placeholder": { "zh-TW": "自動", en: "Auto" },
  "transcribe.semitones.title": {
    "zh-TW": "留空 = 自動推算",
    en: "Leave blank for automatic inference",
  },
  "transcribe.suggest": { "zh-TW": "建議", en: "Suggest" },
  "transcribe.suggest.title": {
    "zh-TW": "查詢慣例 / 自動推算",
    en: "Look up the convention / infer automatically",
  },
  "transcribe.fit.title": {
    "zh-TW": "超出目標音域時自動八度位移",
    en: "Shift by octaves automatically when outside the target range",
  },
  "transcribe.perPart.title": {
    "zh-TW": "勾選 = 只移植這一個 part (協奏曲獨奏用)",
    en: "Checked = transcribe only this part (for a concerto soloist)",
  },
  "transcribe.apply": { "zh-TW": "⇆ 套用移植", en: "⇆ Apply transcription" },
  "transcribe.noChanges": {
    "zh-TW": "尚未變更任何 part 的目標",
    en: "No part targets changed yet",
  },
  "transcribe.error.noMapping": {
    "zh-TW": "沒有任何 part 設定了移植目標",
    en: "No part has a transcription target set",
  },
  "transcribe.loading": {
    "zh-TW": "套用移植中...",
    en: "Applying transcription...",
  },
  "transcribe.error.failed": { "zh-TW": "移植失敗", en: "Transcription failed" },
  "transcribe.result.title": { "zh-TW": "上次套用結果", en: "Last result" },
  "transcribe.result.transposition": {
    "zh-TW": "移調: {summary}",
    en: "Transposition: {summary}",
  },
  "transcribe.result.adjustments": {
    "zh-TW": "自動八度修正: {count} 個音符",
    en: "Automatic octave corrections: {count} notes",
  },
  "transcribe.result.warnings": {
    "zh-TW": "⚠ Warnings ({count})",
    en: "⚠ Warnings ({count})",
  },
  "transcribe.empty.noSource": {
    "zh-TW": "請先在 1 設定 mode 匯入樂譜。",
    en: "Import a score first in the 1 Setup mode.",
  },
  "transcribe.empty.loadingParts": {
    "zh-TW": "載入 source parts 中...",
    en: "Loading source parts...",
  },

  // ── SetupHint ─────────────────────────────────────────────
  "setupHint.loaded": { "zh-TW": "✓ 已載入:", en: "✓ Loaded:" },
  "setupHint.loaded.next": {
    "zh-TW":
      "切換到「2 分析」檢視聲部結構, 或直接點工具列的「改編」開始。",
    en:
      "Switch to \"2 Analyze\" to review the part structure, or click "
      + "\"Arrange\" on the toolbar to start.",
  },
  "setupHint.welcome": {
    "zh-TW": "歡迎使用 Score Arranger",
    en: "Welcome to Score Arranger",
  },
  "setupHint.intro": {
    "zh-TW":
      "從上方工具列點「匯入總譜」匯入 MusicXML 檔, 或點「範例 ▾」直接載入 "
      + "28 首巴洛克 / 古典 / 浪漫派作品其中之一。",
    en:
      "Click \"Import score\" on the toolbar to import a MusicXML file, or "
      + "click \"Samples ▾\" to load one of 28 Baroque / Classical / Romantic "
      + "works directly.",
  },
  "setupHint.workflowHeader": {
    "zh-TW": "┌─ 工作流階段 ─┐",
    en: "┌─ Workflow stages ─┐",
  },
  "setupHint.workflow": {
    "zh-TW": "1 設定 → 2 分析 → 3 改編 → 4 微調 → 5 匯出",
    en: "1 Setup → 2 Analyze → 3 Arrange → 4 Refine → 5 Export",
  },
};

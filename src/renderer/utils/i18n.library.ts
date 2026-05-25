import type { BiDict } from "./i18n";

/**
 * 範例曲庫 / 移植介面字串 — PresetLibrary / TranscribePanel / SetupHint。
 */
export const LIBRARY_STRINGS: BiDict = {
  // ── 0.1.41 RepertoireDialog (取代 PresetLibrary dropdown) ──
  "repertoire.button": {
    "zh-TW": "📚 曲目庫",
    en: "📚 Repertoire",
    ja: "📚 曲目データベース",
  },
  "repertoire.title": {
    "zh-TW": "曲目資料庫",
    en: "Repertoire database",
    ja: "曲目データベース",
  },
  "repertoire.searchPlaceholder": {
    "zh-TW": "搜尋曲名 / 作曲家...",
    en: "Search title / composer...",
    ja: "タイトル / 作曲家を検索...",
  },
  "repertoire.results": {
    "zh-TW": "{filtered} / {total} 首",
    en: "{filtered} / {total} pieces",
    ja: "{filtered} / {total} 曲",
  },
  "repertoire.clearAll": {
    "zh-TW": "清除篩選 ({n})",
    en: "Clear filters ({n})",
    ja: "フィルター解除 ({n})",
  },
  "repertoire.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },
  "repertoire.empty": {
    "zh-TW": "沒有符合的曲目, 試試清掉部分篩選器",
    en: "No matching pieces — try clearing some filters",
    ja: "該当する曲目がありません。フィルターを解除してみてください",
  },
  "repertoire.filter.era": { "zh-TW": "時代", en: "Era", ja: "時代" },
  "repertoire.filter.ensemble": {
    "zh-TW": "編制", en: "Ensemble", ja: "編成",
  },
  "repertoire.filter.form": { "zh-TW": "形式", en: "Form", ja: "形式" },
  "repertoire.filter.composer": {
    "zh-TW": "作曲家", en: "Composer", ja: "作曲家",
  },
  "repertoire.filter.grade": {
    "zh-TW": "難度 (ABRSM / Henle)",
    en: "Grade (ABRSM / Henle)",
    ja: "難易度 (ABRSM / Henle)",
  },
  "repertoire.filter.tags": {
    "zh-TW": "教學主旨", en: "Teaching tags", ja: "教育主旨",
  },
  "repertoire.gradeRange": {
    "zh-TW": "等級 {min} – {max}",
    en: "Grades {min} – {max}",
    ja: "等級 {min} – {max}",
  },
  "repertoire.gradeMinTip": {
    "zh-TW": "最低難度",
    en: "Minimum grade",
    ja: "最低難易度",
  },
  "repertoire.gradeMaxTip": {
    "zh-TW": "最高難度",
    en: "Maximum grade",
    ja: "最高難易度",
  },
  "repertoire.gradeNote": {
    "zh-TW": "1-2 入門 · 3-5 中階 · 6-8 進階 · 9 Diploma",
    en: "1-2 Beginner · 3-5 Intermediate · 6-8 Advanced · 9 Diploma",
    ja: "1-2 入門 · 3-5 中級 · 6-8 上級 · 9 Diploma",
  },
  // Era keys (lowercase) — 也供 EntryRow 用
  "repertoire.era.baroque": { "zh-TW": "巴洛克", en: "Baroque", ja: "バロック" },
  "repertoire.era.classical": { "zh-TW": "古典", en: "Classical", ja: "古典派" },
  "repertoire.era.romantic": { "zh-TW": "浪漫派", en: "Romantic", ja: "ロマン派" },
  "repertoire.era.modern": { "zh-TW": "現代", en: "Modern", ja: "現代" },
  "repertoire.era.renaissance": {
    "zh-TW": "文藝復興", en: "Renaissance", ja: "ルネサンス",
  },
  // Ensemble keys (camelCase, 從 EnsembleType 推出)
  "repertoire.ensemble.sATB": { "zh-TW": "SATB 合唱", en: "SATB", ja: "SATB 合唱" },
  "repertoire.ensemble.stringQuartet": {
    "zh-TW": "弦樂四重奏", en: "String quartet", ja: "弦楽四重奏",
  },
  "repertoire.ensemble.trioSonata": {
    "zh-TW": "三重奏鳴曲", en: "Trio sonata", ja: "トリオ・ソナタ",
  },
  "repertoire.ensemble.voicePiano": {
    "zh-TW": "聲樂 + 鋼琴", en: "Voice + piano", ja: "声楽 + ピアノ",
  },
  "repertoire.ensemble.pianoSolo": {
    "zh-TW": "鋼琴獨奏", en: "Piano solo", ja: "ピアノ独奏",
  },
  "repertoire.ensemble.other": { "zh-TW": "其他", en: "Other", ja: "その他" },
  // Form keys (lowercase, 從 Form 推出)
  "repertoire.form.chorale": { "zh-TW": "聖詠", en: "Chorale", ja: "コラール" },
  "repertoire.form.lied": { "zh-TW": "藝術歌曲", en: "Lied", ja: "リート" },
  "repertoire.form.quartet": { "zh-TW": "四重奏", en: "Quartet", ja: "四重奏" },
  "repertoire.form.sonata": { "zh-TW": "奏鳴曲", en: "Sonata", ja: "ソナタ" },
  "repertoire.form.trioSonata": {
    "zh-TW": "三重奏鳴曲", en: "Trio sonata", ja: "トリオ・ソナタ",
  },
  "repertoire.form.aria": { "zh-TW": "詠嘆調", en: "Aria", ja: "アリア" },
  "repertoire.form.mazurka": { "zh-TW": "馬厝卡", en: "Mazurka", ja: "マズルカ" },
  "repertoire.form.rag": { "zh-TW": "繁音曲", en: "Rag", ja: "ラグ" },
  "repertoire.form.opera": { "zh-TW": "歌劇", en: "Opera", ja: "オペラ" },
  "repertoire.form.characterPiece": {
    "zh-TW": "性格小品", en: "Character piece", ja: "性格的小品",
  },
  "repertoire.form.mass": { "zh-TW": "彌撒", en: "Mass", ja: "ミサ曲" },
  "repertoire.form.motet": { "zh-TW": "經文歌", en: "Motet", ja: "モテット" },
  "repertoire.form.hymn": { "zh-TW": "聖歌", en: "Hymn", ja: "賛美歌" },
  "repertoire.form.12-tone": {
    "zh-TW": "十二音技法", en: "12-tone", ja: "12 音技法",
  },
  "repertoire.form.galant": {
    "zh-TW": "華麗風格", en: "Galant", ja: "ギャラント様式",
  },

  // ── PresetLibrary — chrome (legacy, 0.1.41 後改 RepertoireDialog) ──
  "preset.button": { "zh-TW": "範例 ▾", en: "Samples ▾", ja: "サンプル ▾" },
  "preset.badge.xl": { "zh-TW": "XL", en: "XL", ja: "XL" },
  "preset.badge.xl.title": {
    "zh-TW": "非常大 — 載入可能花數十秒, ribbon/autofit 會自動關閉",
    en:
      "Very large — loading may take tens of seconds; "
      + "ribbon/autofit will be turned off automatically",
    ja:
      "非常に大きいファイル — 読み込みに数十秒かかることがあり、"
      + "ribbon/autofit は自動的にオフになります",
  },
  "preset.badge.l": { "zh-TW": "L", en: "L", ja: "L" },
  "preset.badge.l.title": {
    "zh-TW": "較大 — 第一次載入可能花 10–30 秒",
    en: "Large — the first load may take 10–30 seconds",
    ja: "大きめのファイル — 初回の読み込みに 10〜30 秒かかることがあります",
  },
  "preset.loading": {
    "zh-TW": "載入 {name}...",
    en: "Loading {name}...",
    ja: "{name} を読み込み中...",
  },
  "preset.error.loadFailed": {
    "zh-TW": "載入失敗",
    en: "Failed to load",
    ja: "読み込みに失敗しました",
  },
  "preset.confirm.huge": {
    "zh-TW":
      "這份樂譜有 {measures} 小節 — 非常大, OSMD 渲染可能需要 30–90 秒並可能讓畫面短暫無回應 (renderer 在處理超長 SVG)。\n\n建議先把「自動縮放」和「上下排列 ribbon」關掉再載入, 或先試短一點的範例。\n\n要繼續嗎?",
    en:
      "This score has {measures} measures — very large. OSMD rendering may "
      + "take 30–90 seconds and the screen may briefly become unresponsive "
      + "(the renderer is processing a very long SVG).\n\n"
      + "Consider turning off \"auto-fit\" and the \"stacked ribbon\" layout "
      + "before loading, or try a shorter sample first.\n\nContinue?",
    ja:
      "この楽譜は {measures} 小節あり、非常に大きいファイルです。OSMD の"
      + "レンダリングに 30〜90 秒かかり、画面が一時的に応答しなくなることが"
      + "あります (renderer が非常に長い SVG を処理しています)。\n\n"
      + "読み込む前に「自動縮放」と「上下に並べる ribbon」レイアウトを"
      + "オフにするか、まずは短いサンプルをお試しください。\n\n続行しますか?",
  },
  "preset.confirm.large": {
    "zh-TW":
      "這份樂譜有 {measures} 小節 (>{threshold}) — 較大, 第一次渲染可能花 10–30 秒。\n\n要繼續嗎?",
    en:
      "This score has {measures} measures (>{threshold}) — large. "
      + "The first render may take 10–30 seconds.\n\nContinue?",
    ja:
      "この楽譜は {measures} 小節 (>{threshold}) あり、大きめのファイルです。"
      + "初回のレンダリングに 10〜30 秒かかることがあります。\n\n続行しますか?",
  },

  // ── PresetLibrary — era labels ────────────────────────────
  "preset.era.baroque": { "zh-TW": "巴洛克", en: "Baroque", ja: "バロック" },
  "preset.era.classical": { "zh-TW": "古典", en: "Classical", ja: "古典派" },
  "preset.era.romantic": { "zh-TW": "浪漫派", en: "Romantic", ja: "ロマン派" },

  // ── PresetLibrary — 0.1.38 教學標籤 ──────────────────────────
  "preset.grade.tip": {
    "zh-TW": "難度 {grade} / 5 (1=初級 / 5=職業)",
    en: "Grade {grade} / 5 (1=beginner / 5=professional)",
    ja: "難易度 {grade} / 5 (1=初級 / 5=プロ)",
  },
  "preset.tag.legato": { "zh-TW": "連音", en: "legato", ja: "レガート" },
  "preset.tag.staccato": { "zh-TW": "跳音", en: "staccato", ja: "スタッカート" },
  "preset.tag.counterpoint": {
    "zh-TW": "對位", en: "counterpoint", ja: "対位法",
  },
  "preset.tag.scales": { "zh-TW": "音階", en: "scales", ja: "音階" },
  "preset.tag.shifts": { "zh-TW": "移把位", en: "shifts", ja: "ポジション移動" },
  "preset.tag.expression": {
    "zh-TW": "表情", en: "expression", ja: "表現",
  },
  "preset.tag.rhythm": { "zh-TW": "節奏", en: "rhythm", ja: "リズム" },
  "preset.tag.ensemble": { "zh-TW": "合奏", en: "ensemble", ja: "アンサンブル" },

  // ── PresetLibrary — ensemble labels ───────────────────────
  "preset.ensemble.satb": { "zh-TW": "SATB", en: "SATB", ja: "SATB" },
  "preset.ensemble.5parts": { "zh-TW": "5 parts", en: "5 parts", ja: "5 声部" },
  "preset.ensemble.trioSonata": {
    "zh-TW": "Trio Sonata",
    en: "Trio Sonata",
    ja: "トリオ・ソナタ",
  },
  "preset.ensemble.voiceAccomp": {
    "zh-TW": "聲樂 + 伴奏",
    en: "Voice + accompaniment",
    ja: "声楽 + 伴奏",
  },
  "preset.ensemble.stringQuartet": {
    "zh-TW": "弦樂四重奏",
    en: "String quartet",
    ja: "弦楽四重奏",
  },
  "preset.ensemble.stringQuartetLong": {
    "zh-TW": "弦樂四重奏 (長)",
    en: "String quartet (long)",
    ja: "弦楽四重奏 (長尺)",
  },
  "preset.ensemble.pianoSolo": {
    "zh-TW": "鋼琴獨奏",
    en: "Piano solo",
    ja: "ピアノ独奏",
  },
  "preset.ensemble.voicePiano": {
    "zh-TW": "聲樂 + 鋼琴",
    en: "Voice + piano",
    ja: "声楽 + ピアノ",
  },
  "preset.ensemble.pianoTrio": {
    "zh-TW": "鋼琴三重奏",
    en: "Piano trio",
    ja: "ピアノ三重奏",
  },

  // ── PresetLibrary — piece display names ───────────────────
  // 作曲家名 / 作品編號為專有名詞, 僅翻譯曲種與樂章等說明字。
  "preset.piece.bwv66.6": {
    "zh-TW": "Bach 聖詠 BWV 66/6",
    en: "Bach Chorale BWV 66/6",
    ja: "Bach コラール BWV 66/6",
  },
  "preset.piece.bwv7.7": {
    "zh-TW": "Bach 聖詠 BWV 7/7",
    en: "Bach Chorale BWV 7/7",
    ja: "Bach コラール BWV 7/7",
  },
  "preset.piece.bwv57.8": {
    "zh-TW": "Bach 聖詠 BWV 57/8",
    en: "Bach Chorale BWV 57/8",
    ja: "Bach コラール BWV 57/8",
  },
  "preset.piece.bwv4.8": {
    "zh-TW": "Bach 聖詠 BWV 4/8 (Christ lag in Todesbanden)",
    en: "Bach Chorale BWV 4/8 (Christ lag in Todesbanden)",
    ja: "Bach コラール BWV 4/8 (Christ lag in Todesbanden)",
  },
  "preset.piece.bwv227.7": {
    "zh-TW": "Bach 經文歌 BWV 227 第 7 樂章",
    en: "Bach Motet BWV 227, Movement 7",
    ja: "Bach モテット BWV 227 第 7 楽章",
  },
  "preset.piece.bwv281": {
    "zh-TW": "Bach 聖詠 BWV 281 (Christus, der ist mein Leben)",
    en: "Bach Chorale BWV 281 (Christus, der ist mein Leben)",
    ja: "Bach コラール BWV 281 (Christus, der ist mein Leben)",
  },
  "preset.piece.bwv344": {
    "zh-TW": "Bach 聖詠 BWV 344",
    en: "Bach Chorale BWV 344",
    ja: "Bach コラール BWV 344",
  },
  "preset.piece.bwv1.6": {
    "zh-TW": "Bach 聖詠 BWV 1/6 (含法國號)",
    en: "Bach Chorale BWV 1/6 (with horn)",
    ja: "Bach コラール BWV 1/6 (ホルン付き)",
  },
  "preset.piece.corelliOp3no1Grave": {
    "zh-TW": "Corelli 三重奏鳴曲 op.3/1 Grave",
    en: "Corelli Trio Sonata op.3/1 Grave",
    ja: "Corelli トリオ・ソナタ op.3/1 Grave",
  },
  "preset.piece.handelRinaldoLascia": {
    "zh-TW": "Handel 歌劇《里納爾多》— 讓我哭泣吧",
    en: "Handel opera Rinaldo — Lascia ch'io pianga",
    ja: "Handel 歌劇《リナルド》— Lascia ch'io pianga",
  },
  "preset.piece.k80m1": {
    "zh-TW": "Mozart 弦樂四重奏 K.80 第一樂章",
    en: "Mozart String Quartet K.80, Movement 1",
    ja: "Mozart 弦楽四重奏曲 K.80 第 1 楽章",
  },
  "preset.piece.k80m2": {
    "zh-TW": "Mozart 弦樂四重奏 K.80 第二樂章",
    en: "Mozart String Quartet K.80, Movement 2",
    ja: "Mozart 弦楽四重奏曲 K.80 第 2 楽章",
  },
  "preset.piece.k80m3": {
    "zh-TW": "Mozart 弦樂四重奏 K.80 第三樂章 (Minuet)",
    en: "Mozart String Quartet K.80, Movement 3 (Minuet)",
    ja: "Mozart 弦楽四重奏曲 K.80 第 3 楽章 (メヌエット)",
  },
  "preset.piece.k80m4": {
    "zh-TW": "Mozart 弦樂四重奏 K.80 第四樂章",
    en: "Mozart String Quartet K.80, Movement 4",
    ja: "Mozart 弦楽四重奏曲 K.80 第 4 楽章",
  },
  "preset.piece.k155m1": {
    "zh-TW": "Mozart 弦樂四重奏 K.155 第一樂章",
    en: "Mozart String Quartet K.155, Movement 1",
    ja: "Mozart 弦楽四重奏曲 K.155 第 1 楽章",
  },
  "preset.piece.k155m2": {
    "zh-TW": "Mozart 弦樂四重奏 K.155 第二樂章",
    en: "Mozart String Quartet K.155, Movement 2",
    ja: "Mozart 弦楽四重奏曲 K.155 第 2 楽章",
  },
  "preset.piece.k155m3": {
    "zh-TW": "Mozart 弦樂四重奏 K.155 第三樂章 (Minuet)",
    en: "Mozart String Quartet K.155, Movement 3 (Minuet)",
    ja: "Mozart 弦楽四重奏曲 K.155 第 3 楽章 (メヌエット)",
  },
  "preset.piece.k156m1": {
    "zh-TW": "Mozart 弦樂四重奏 K.156 第一樂章",
    en: "Mozart String Quartet K.156, Movement 1",
    ja: "Mozart 弦楽四重奏曲 K.156 第 1 楽章",
  },
  "preset.piece.k156m2": {
    "zh-TW": "Mozart 弦樂四重奏 K.156 第二樂章",
    en: "Mozart String Quartet K.156, Movement 2",
    ja: "Mozart 弦楽四重奏曲 K.156 第 2 楽章",
  },
  "preset.piece.k156m3": {
    "zh-TW": "Mozart 弦樂四重奏 K.156 第三樂章 (Minuet)",
    en: "Mozart String Quartet K.156, Movement 3 (Minuet)",
    ja: "Mozart 弦楽四重奏曲 K.156 第 3 楽章 (メヌエット)",
  },
  "preset.piece.k156m4": {
    "zh-TW": "Mozart 弦樂四重奏 K.156 第四樂章",
    en: "Mozart String Quartet K.156, Movement 4",
    ja: "Mozart 弦楽四重奏曲 K.156 第 4 楽章",
  },
  "preset.piece.k458m1": {
    "zh-TW": "Mozart 弦樂四重奏 K.458「狩獵」第一樂章",
    en: "Mozart String Quartet K.458 \"The Hunt\", Movement 1",
    ja: "Mozart 弦楽四重奏曲 K.458「狩り」第 1 楽章",
  },
  "preset.piece.k458m2": {
    "zh-TW": "Mozart 弦樂四重奏 K.458「狩獵」第二樂章 (Minuet)",
    en: "Mozart String Quartet K.458 \"The Hunt\", Movement 2 (Minuet)",
    ja: "Mozart 弦楽四重奏曲 K.458「狩り」第 2 楽章 (メヌエット)",
  },
  "preset.piece.k458m3": {
    "zh-TW": "Mozart 弦樂四重奏 K.458「狩獵」第三樂章",
    en: "Mozart String Quartet K.458 \"The Hunt\", Movement 3",
    ja: "Mozart 弦楽四重奏曲 K.458「狩り」第 3 楽章",
  },
  "preset.piece.k458m4": {
    "zh-TW": "Mozart 弦樂四重奏 K.458「狩獵」第四樂章",
    en: "Mozart String Quartet K.458 \"The Hunt\", Movement 4",
    ja: "Mozart 弦楽四重奏曲 K.458「狩り」第 4 楽章",
  },
  "preset.piece.haydnOp1no1m1": {
    "zh-TW": "Haydn 弦樂四重奏 op.1/1 第一樂章",
    en: "Haydn String Quartet op.1/1, Movement 1",
    ja: "Haydn 弦楽四重奏曲 op.1/1 第 1 楽章",
  },
  "preset.piece.haydnOp1no1m2": {
    "zh-TW": "Haydn 弦樂四重奏 op.1/1 第二樂章 (Minuet)",
    en: "Haydn String Quartet op.1/1, Movement 2 (Minuet)",
    ja: "Haydn 弦楽四重奏曲 op.1/1 第 2 楽章 (メヌエット)",
  },
  "preset.piece.haydnOp74no1m1": {
    "zh-TW": "Haydn 弦樂四重奏 op.74/1 第一樂章",
    en: "Haydn String Quartet op.74/1, Movement 1",
    ja: "Haydn 弦楽四重奏曲 op.74/1 第 1 楽章",
  },
  "preset.piece.haydnOp74no1m2": {
    "zh-TW": "Haydn 弦樂四重奏 op.74/1 第二樂章",
    en: "Haydn String Quartet op.74/1, Movement 2",
    ja: "Haydn 弦楽四重奏曲 op.74/1 第 2 楽章",
  },
  "preset.piece.haydnOp74no1m3": {
    "zh-TW": "Haydn 弦樂四重奏 op.74/1 第三樂章 (Minuet)",
    en: "Haydn String Quartet op.74/1, Movement 3 (Minuet)",
    ja: "Haydn 弦楽四重奏曲 op.74/1 第 3 楽章 (メヌエット)",
  },
  "preset.piece.haydnOp74no1m4": {
    "zh-TW": "Haydn 弦樂四重奏 op.74/1 第四樂章",
    en: "Haydn String Quartet op.74/1, Movement 4",
    ja: "Haydn 弦楽四重奏曲 op.74/1 第 4 楽章",
  },
  "preset.piece.beethovenOp18no1m1": {
    "zh-TW": "Beethoven 弦樂四重奏 op.18/1 第一樂章",
    en: "Beethoven String Quartet op.18/1, Movement 1",
    ja: "Beethoven 弦楽四重奏曲 op.18/1 第 1 楽章",
  },
  "preset.piece.beethovenOp18no1m2": {
    "zh-TW": "Beethoven 弦樂四重奏 op.18/1 第二樂章",
    en: "Beethoven String Quartet op.18/1, Movement 2",
    ja: "Beethoven 弦楽四重奏曲 op.18/1 第 2 楽章",
  },
  "preset.piece.beethovenOp18no1m3": {
    "zh-TW": "Beethoven 弦樂四重奏 op.18/1 第三樂章 (Scherzo)",
    en: "Beethoven String Quartet op.18/1, Movement 3 (Scherzo)",
    ja: "Beethoven 弦楽四重奏曲 op.18/1 第 3 楽章 (スケルツォ)",
  },
  "preset.piece.beethovenOp18no1m4": {
    "zh-TW": "Beethoven 弦樂四重奏 op.18/1 第四樂章",
    en: "Beethoven String Quartet op.18/1, Movement 4",
    ja: "Beethoven 弦楽四重奏曲 op.18/1 第 4 楽章",
  },
  "preset.piece.beethovenOp59no1m1": {
    "zh-TW": "Beethoven 弦樂四重奏 op.59/1「拉茲莫夫斯基」第一樂章",
    en: "Beethoven String Quartet op.59/1 \"Razumovsky\", Movement 1",
    ja: "Beethoven 弦楽四重奏曲 op.59/1「ラズモフスキー」第 1 楽章",
  },
  "preset.piece.beethovenOp132": {
    "zh-TW": "Beethoven 弦樂四重奏 op.132 (晚期)",
    en: "Beethoven String Quartet op.132 (late)",
    ja: "Beethoven 弦楽四重奏曲 op.132 (後期)",
  },
  "preset.piece.k545m1Exposition": {
    "zh-TW": "Mozart 鋼琴奏鳴曲 K.545 第一樂章 (呈示部)",
    en: "Mozart Piano Sonata K.545, Movement 1 (exposition)",
    ja: "Mozart ピアノ・ソナタ K.545 第 1 楽章 (提示部)",
  },
  "preset.piece.chopinMazurka06.2": {
    "zh-TW": "Chopin Mazurka op.6 no.2",
    en: "Chopin Mazurka op.6 no.2",
    ja: "Chopin マズルカ op.6 no.2",
  },
  "preset.piece.joplinMapleLeafRag": {
    "zh-TW": "Joplin 楓葉繁音曲 (Maple Leaf Rag)",
    en: "Joplin Maple Leaf Rag",
    ja: "Joplin メイプル・リーフ・ラグ (Maple Leaf Rag)",
  },
  "preset.piece.schubertLindenbaum": {
    "zh-TW": "Schubert 菩提樹 (Der Lindenbaum)",
    en: "Schubert Der Lindenbaum",
    ja: "Schubert 菩提樹 (Der Lindenbaum)",
  },
  "preset.piece.claraSchumannOp17m3": {
    "zh-TW": "Clara Schumann 鋼琴三重奏 op.17 第三樂章",
    en: "Clara Schumann Piano Trio op.17, Movement 3",
    ja: "Clara Schumann ピアノ三重奏曲 op.17 第 3 楽章",
  },
  "preset.piece.schumannDichterliebeNo2": {
    "zh-TW": "Schumann 詩人之戀 第 2 首",
    en: "Schumann Dichterliebe, No. 2",
    ja: "Schumann 詩人の恋 第 2 曲",
  },
  "preset.piece.schumannOp48no2": {
    "zh-TW": "Schumann op.48 no.2",
    en: "Schumann op.48 no.2",
    ja: "Schumann op.48 no.2",
  },
  "preset.piece.verdiLaDonnaEMobile": {
    "zh-TW": "Verdi 歌劇《弄臣》— 善變的女人",
    en: "Verdi opera Rigoletto — La donna è mobile",
    ja: "Verdi 歌劇《リゴレット》— La donna è mobile",
  },
  // ── 0.1.40: OpenScore Lieder corpus ─────────────────────────
  "preset.piece.beethovenOp48_1Bitten": {
    "zh-TW": "Beethoven Op.48-1 〈祈禱〉",
    en: "Beethoven Op.48 No.1 — Bitten (Plea)",
    ja: "Beethoven Op.48-1 〈祈り〉",
  },
  "preset.piece.beethovenOp48_2Liebe": {
    "zh-TW": "Beethoven Op.48-2 〈愛鄰人〉",
    en: "Beethoven Op.48 No.2 — Die Liebe des Nächsten",
    ja: "Beethoven Op.48-2 〈隣人愛〉",
  },
  "preset.piece.beethovenOp48_3Tode": {
    "zh-TW": "Beethoven Op.48-3 〈論死亡〉",
    en: "Beethoven Op.48 No.3 — Vom Tode",
    ja: "Beethoven Op.48-3 〈死について〉",
  },
  "preset.piece.beethovenOp48_4Ehre": {
    "zh-TW": "Beethoven Op.48-4 〈大自然頌神〉",
    en: "Beethoven Op.48 No.4 — Die Ehre Gottes aus der Natur",
    ja: "Beethoven Op.48-4 〈自然の中の神の栄光〉",
  },
  "preset.piece.beethovenOp52_3Ruhe": {
    "zh-TW": "Beethoven Op.52-3 〈安息之歌〉",
    en: "Beethoven Op.52 No.3 — Das Liedchen von der Ruhe",
    ja: "Beethoven Op.52-3 〈安らぎの歌〉",
  },
  "preset.piece.schubertD795_1Wandern": {
    "zh-TW": "Schubert《美麗的磨坊女》— 流浪",
    en: "Schubert Schöne Müllerin — Das Wandern",
    ja: "Schubert《美しき水車小屋の娘》— 流浪",
  },
  "preset.piece.schubertD795_2Wohin": {
    "zh-TW": "Schubert《美麗的磨坊女》— 何處去",
    en: "Schubert Schöne Müllerin — Wohin?",
    ja: "Schubert《美しき水車小屋の娘》— どこへ?",
  },
  "preset.piece.schubertD795_20Wiegenlied": {
    "zh-TW": "Schubert《美麗的磨坊女》— 小溪的搖籃曲",
    en: "Schubert Schöne Müllerin — Des Baches Wiegenlied",
    ja: "Schubert《美しき水車小屋の娘》— 小川の子守歌",
  },
  "preset.piece.schumannOp39_5Mondnacht": {
    "zh-TW": "Schumann《Liederkreis》— 月夜",
    en: "Schumann Liederkreis Op.39 — Mondnacht",
    ja: "Schumann《リーダークライス》— 月夜",
  },
  "preset.piece.schumannOp48_1Mai": {
    "zh-TW": "Schumann《詩人之戀》— 美麗的五月",
    en: "Schumann Dichterliebe — Im wunderschönen Monat Mai",
    ja: "Schumann《詩人の恋》— 美しき五月に",
  },
  "preset.piece.schumannOp48_7Grolle": {
    "zh-TW": "Schumann《詩人之戀》— 我不悲嘆",
    en: "Schumann Dichterliebe — Ich grolle nicht",
    ja: "Schumann《詩人の恋》— 僕は恨まない",
  },
  "preset.piece.schumannOp42_1SeitIch": {
    "zh-TW": "Schumann《女人的愛與生命》— 自從初見",
    en: "Schumann Frauenliebe — Seit ich ihn gesehen",
    ja: "Schumann《女の愛と生涯》— 初めて会った時から",
  },
  "preset.piece.brahmsOp43_1EwigeLiebe": {
    "zh-TW": "Brahms Op.43-1 〈永恆之愛〉",
    en: "Brahms Op.43 No.1 — Von ewiger Liebe",
    ja: "Brahms Op.43-1 〈永遠の愛〉",
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
    ja:
      "source の一部の楽器を別の楽器に置き換え、移調と音域を自動的に処理"
      + "します。既定では同じ楽器ごとに設定をまとめます。「per-part」に"
      + "チェックを入れると個別に指定でき (協奏曲で独奏のみを置き換える"
      + "場合はこちら)、半音数を空欄にすると自動推定します "
      + "(例: チェロ→ヴァイオリンの慣例的な +19)。",
  },
  "transcribe.col.part": { "zh-TW": "Part", en: "Part", ja: "Part" },
  "transcribe.col.sourceInstrument": {
    "zh-TW": "原樂器",
    en: "Source instrument",
    ja: "元の楽器",
  },
  "transcribe.col.targetInstrument": {
    "zh-TW": "→ 目標樂器",
    en: "→ Target instrument",
    ja: "→ 変更先の楽器",
  },
  "transcribe.col.semitones": {
    "zh-TW": "半音",
    en: "Semitones",
    ja: "半音",
  },
  "transcribe.col.fit": { "zh-TW": "Fit", en: "Fit", ja: "Fit" },
  "transcribe.col.perPart": {
    "zh-TW": "Per-part",
    en: "Per-part",
    ja: "Per-part",
  },
  "transcribe.option.unchanged": {
    "zh-TW": "(不變) {instrument}",
    en: "(unchanged) {instrument}",
    ja: "(変更なし) {instrument}",
  },
  "transcribe.semitones.placeholder": {
    "zh-TW": "自動",
    en: "Auto",
    ja: "自動",
  },
  "transcribe.semitones.title": {
    "zh-TW": "留空 = 自動推算",
    en: "Leave blank for automatic inference",
    ja: "空欄にすると自動推定します",
  },
  "transcribe.suggest": { "zh-TW": "建議", en: "Suggest", ja: "提案" },
  "transcribe.suggest.title": {
    "zh-TW": "查詢慣例 / 自動推算",
    en: "Look up the convention / infer automatically",
    ja: "慣例を調べる / 自動推定する",
  },
  "transcribe.fit.title": {
    "zh-TW": "超出目標音域時自動八度位移",
    en: "Shift by octaves automatically when outside the target range",
    ja: "変更先の音域を外れたときにオクターヴ単位で自動的に移動します",
  },
  "transcribe.perPart.title": {
    "zh-TW": "勾選 = 只移植這一個 part (協奏曲獨奏用)",
    en: "Checked = transcribe only this part (for a concerto soloist)",
    ja: "チェックすると、この part のみを移植します (協奏曲の独奏用)",
  },
  "transcribe.apply": {
    "zh-TW": "⇆ 套用移植",
    en: "⇆ Apply transcription",
    ja: "⇆ 移植を適用",
  },
  "transcribe.noChanges": {
    "zh-TW": "尚未變更任何 part 的目標",
    en: "No part targets changed yet",
    ja: "まだどの part の変更先も設定されていません",
  },
  "transcribe.error.noMapping": {
    "zh-TW": "沒有任何 part 設定了移植目標",
    en: "No part has a transcription target set",
    ja: "移植先が設定された part がありません",
  },
  "transcribe.loading": {
    "zh-TW": "套用移植中...",
    en: "Applying transcription...",
    ja: "移植を適用中...",
  },
  "transcribe.error.failed": {
    "zh-TW": "移植失敗",
    en: "Transcription failed",
    ja: "移植に失敗しました",
  },
  "transcribe.result.title": {
    "zh-TW": "上次套用結果",
    en: "Last result",
    ja: "前回の結果",
  },
  "transcribe.result.transposition": {
    "zh-TW": "移調: {summary}",
    en: "Transposition: {summary}",
    ja: "移調: {summary}",
  },
  "transcribe.result.adjustments": {
    "zh-TW": "自動八度修正: {count} 個音符",
    en: "Automatic octave corrections: {count} notes",
    ja: "オクターヴの自動修正: {count} 個の音符",
  },
  "transcribe.result.warnings": {
    "zh-TW": "⚠ Warnings ({count})",
    en: "⚠ Warnings ({count})",
    ja: "⚠ 警告 ({count})",
  },
  "transcribe.empty.noSource": {
    "zh-TW": "請先在 1 設定 mode 匯入樂譜。",
    en: "Import a score first in the 1 Setup mode.",
    ja: "まず「1 設定」モードで楽譜を取り込んでください。",
  },
  "transcribe.empty.loadingParts": {
    "zh-TW": "載入 source parts 中...",
    en: "Loading source parts...",
    ja: "source parts を読み込み中...",
  },

  // ── SetupHint ─────────────────────────────────────────────
  "setupHint.loaded": {
    "zh-TW": "✓ 已載入:",
    en: "✓ Loaded:",
    ja: "✓ 読み込み完了:",
  },
  "setupHint.loaded.next": {
    "zh-TW":
      "切換到「2 分析」檢視聲部結構, 或直接點工具列的「改編」開始。",
    en:
      "Switch to \"2 Analyze\" to review the part structure, or click "
      + "\"Arrange\" on the toolbar to start.",
    ja:
      "「2 分析」に切り替えて声部の構成を確認するか、ツールバーの"
      + "「編曲」をクリックして開始してください。",
  },
  "setupHint.welcome": {
    "zh-TW": "歡迎使用 Score Arranger",
    en: "Welcome to Score Arranger",
    ja: "Score Arranger へようこそ",
  },
  "setupHint.intro": {
    "zh-TW":
      "從上方工具列點「匯入總譜」匯入 MusicXML 檔, 或點「📚 曲目庫」開啟"
      + "資料庫, 從 58 首巴洛克 / 古典 / 浪漫派曲目中以時代 / 作曲家 / 編制 / "
      + "難度多重篩選找到合適的範例。",
    en:
      "Click \"Import score\" on the toolbar to import a MusicXML file, or "
      + "click \"📚 Repertoire\" to open the database and filter 58 Baroque / "
      + "Classical / Romantic pieces by era, composer, ensemble, or grade.",
    ja:
      "上部のツールバーで「総譜を取り込む」をクリックして MusicXML "
      + "ファイルを取り込むか、「📚 曲目データベース」をクリックして 58 曲の"
      + "バロック / 古典派 / ロマン派の作品を時代 / 作曲家 / 編成 / 難易度で"
      + "絞り込んで選べます。",
  },
  "setupHint.workflowHeader": {
    "zh-TW": "┌─ 工作流階段 ─┐",
    en: "┌─ Workflow stages ─┐",
    ja: "┌─ ワークフローの段階 ─┐",
  },
  "setupHint.workflow": {
    "zh-TW": "1 設定 → 2 分析 → 3 改編 → 4 微調 → 5 匯出",
    en: "1 Setup → 2 Analyze → 3 Arrange → 4 Refine → 5 Export",
    ja: "1 設定 → 2 分析 → 3 編曲 → 4 微調整 → 5 書き出し",
  },
};

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
    ja: "🤖 自然言語による楽譜の編集",
  },
  "nlEdit.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },
  "nlEdit.partRightHand": {
    "zh-TW": "{name}（右手）",
    en: "{name} (right hand)",
    ja: "{name}（右手）",
  },
  "nlEdit.partLeftHand": {
    "zh-TW": "{name}（左手）",
    en: "{name} (left hand)",
    ja: "{name}（左手）",
  },
  "nlEdit.noModelTitle": {
    "zh-TW": "尚未設定 AI 模型",
    en: "No AI model configured",
    ja: "AIモデルが未設定です",
  },
  "nlEdit.noModelBody": {
    "zh-TW":
      "請先到工具列 ⚙ →「AI 模型設定」選擇 provider 並設好 endpoint / model（本地 Ollama 免 API key）。",
    en:
      "Open the toolbar ⚙ → \"AI Model Settings\" to choose a provider and set the endpoint / model (local Ollama needs no API key).",
    ja:
      "ツールバーの ⚙ →「AIモデル設定」からプロバイダを選び、エンドポイント / モデルを設定してください（ローカルの Ollama はAPIキー不要です）。",
  },
  "nlEdit.noArrangement": {
    "zh-TW": "尚未完成改編 — 請先「改編」產生目標譜, 才能用自然語言修改。",
    en:
      "No arrangement yet — run \"Arrange\" to produce a target score before editing it with natural language.",
    ja:
      "編曲がまだ完了していません — 自然言語で編集するには、先に「編曲」を実行して目標楽譜を生成してください。",
  },
  "nlEdit.historyTitle": {
    "zh-TW": "對話紀錄",
    en: "Conversation history",
    ja: "会話履歴",
  },
  "nlEdit.editableParts": {
    "zh-TW": "可改動的聲部:",
    en: "Editable parts:",
    ja: "編集できる声部:",
  },
  "nlEdit.measureCount": {
    "zh-TW": "　(共 {n} 小節)",
    en: "　({n} measures total)",
    ja: "　(全 {n} 小節)",
  },
  "nlEdit.placeholderFollowUp": {
    "zh-TW": "接著想調整什麼? 例如「再輕一點」「那大提琴呢」",
    en: "What next? e.g. \"a little softer\", \"and the cello?\"",
    ja: "次はどう調整しますか? 例:「もう少し軽く」「チェロはどう?」",
  },
  "nlEdit.placeholderInitial": {
    "zh-TW":
      "用一句話描述想做的修改, 例如:\n• 把小提琴第 9-16 小節降一個八度\n• 第 1-4 小節整段改成 staccato\n• 把第 30-32 小節改成休止符",
    en:
      "Describe the change you want in one sentence, e.g.:\n• transpose the violin down an octave in measures 9-16\n• make measures 1-4 staccato throughout\n• turn measures 30-32 into rests",
    ja:
      "やりたい変更を一文で書いてください。例:\n• ヴァイオリンの第 9〜16 小節を1オクターヴ下げる\n• 第 1〜4 小節を全体的にスタッカートにする\n• 第 30〜32 小節を休符にする",
  },
  "nlEdit.thinking": {
    "zh-TW": "AI 思考中...",
    en: "AI is thinking...",
    ja: "AIが考えています...",
  },
  "nlEdit.generatePlan": {
    "zh-TW": "產生改譜方案",
    en: "Generate edit plan",
    ja: "編集プランを生成",
  },
  "nlEdit.proposalNote": {
    "zh-TW": "AI 只會提案, 須由你逐項確認後才會套用",
    en: "The AI only proposes — nothing is applied until you confirm each item",
    ja: "AIは提案するだけです。各項目を確認するまで適用されません",
  },
  "nlEdit.planFailed": {
    "zh-TW": "AI 產生改譜方案失敗",
    en: "The AI failed to generate an edit plan",
    ja: "AIが編集プランの生成に失敗しました",
  },
  "nlEdit.planHeading": {
    "zh-TW": "改譜方案",
    en: "Edit plan",
    ja: "編集プラン",
  },
  "nlEdit.noOps": {
    "zh-TW": "AI 無法用目前支援的操作達成此要求 (見下方說明)。",
    en:
      "The AI cannot fulfill this request with the currently supported operations (see notes below).",
    ja:
      "AIは現在対応している操作ではこの要求を実現できません（下記の説明を参照してください）。",
  },
  "nlEdit.opPartMissing": {
    "zh-TW": "AI 指定的聲部不存在, 此項無法套用",
    en: "The part specified by the AI does not exist; this item cannot be applied",
    ja: "AIが指定した声部は存在しないため、この項目は適用できません",
  },
  "nlEdit.selectedCount": {
    "zh-TW": "已選 {selected} / {total} 項",
    en: "{selected} / {total} selected",
    ja: "{selected} / {total} 項目を選択中",
  },
  "nlEdit.applying": {
    "zh-TW": "套用中...",
    en: "Applying...",
    ja: "適用中...",
  },
  "nlEdit.applySelected": {
    "zh-TW": "套用選取的 {n} 項",
    en: "Apply selected ({n})",
    ja: "選択した {n} 項目を適用",
  },
  "nlEdit.unknownPart": {
    "zh-TW": "⚠ 未知聲部 {id}",
    en: "⚠ Unknown part {id}",
    ja: "⚠ 不明な声部 {id}",
  },
  "nlEdit.unknownSource": {
    "zh-TW": "⚠ 未知來源 {id}",
    en: "⚠ Unknown source {id}",
    ja: "⚠ 不明なソース {id}",
  },
  "nlEdit.reassignTargetInvalid": {
    "zh-TW": "reassign 目標聲部無效: {id}",
    en: "Invalid reassign target part: {id}",
    ja: "声部の再割り当て先が無効です: {id}",
  },
  "nlEdit.reassignFailed": {
    "zh-TW": "reassign 失敗",
    en: "Reassign failed",
    ja: "声部の再割り当てに失敗しました",
  },
  "nlEdit.applyFailed": {
    "zh-TW": "套用失敗",
    en: "Apply failed",
    ja: "適用に失敗しました",
  },
  "nlEdit.appliedMsg": {
    "zh-TW": "已套用 {count} 項操作 (影響 {touched} 處)。{undoNote}",
    en: "Applied {count} operations (affecting {touched} places). {undoNote}",
    ja: "{count} 件の操作を適用しました（{touched} 箇所に影響）。{undoNote}",
  },
  "nlEdit.undoNoteMixed": {
    "zh-TW": "（reassign 與區間操作為不同的復原步驟）",
    en: "(reassign and range operations are separate undo steps)",
    ja: "（声部の再割り当てと範囲操作は別々の取り消しステップになります）",
  },
  "nlEdit.undoNoteReassign": {
    "zh-TW": "（每個 reassign 為獨立的復原步驟）",
    en: "(each reassign is a separate undo step)",
    ja: "（各声部の再割り当ては独立した取り消しステップになります）",
  },
  "nlEdit.undoNoteRange": {
    "zh-TW": "（可用工具列 ↶ 一次還原整批）",
    en: "(use the toolbar ↶ to undo the whole batch at once)",
    ja: "（ツールバーの ↶ でまとめて一括で取り消せます）",
  },
  // describeOp — op descriptions
  "nlEdit.opReassign": {
    "zh-TW": "把「{source}」改分配給「{target}」",
    en: "Reassign \"{source}\" to \"{target}\"",
    ja: "「{source}」を「{target}」に再割り当て",
  },
  "nlEdit.opRangeSingle": {
    "zh-TW": "第 {n} 小節",
    en: "measure {n}",
    ja: "第 {n} 小節",
  },
  "nlEdit.opRangeSpan": {
    "zh-TW": "第 {start}–{end} 小節",
    en: "measures {start}–{end}",
    ja: "第 {start}–{end} 小節",
  },
  "nlEdit.opTransposeNoop": {
    "zh-TW": "{part}・{range}・移調 0 (無變化)",
    en: "{part} · {range} · transpose 0 (no change)",
    ja: "{part}・{range}・移調 0（変化なし）",
  },
  "nlEdit.opTranspose": {
    "zh-TW": "{part}・{range}・{dir} {semitones} 個半音{oct}",
    en: "{part} · {range} · {dir} {semitones} semitones{oct}",
    ja: "{part}・{range}・{semitones} 半音{dir}{oct}",
  },
  "nlEdit.transposeUp": { "zh-TW": "升高", en: "up", ja: "上げる" },
  "nlEdit.transposeDown": { "zh-TW": "降低", en: "down", ja: "下げる" },
  "nlEdit.octaveSuffix": {
    "zh-TW": "（{n} 個八度）",
    en: " ({n} octaves)",
    ja: "（{n} オクターヴ）",
  },
  "nlEdit.opArticulationClear": {
    "zh-TW": "{part}・{range}・清除所有演奏法",
    en: "{part} · {range} · clear all articulations",
    ja: "{part}・{range}・すべての奏法を消去",
  },
  "nlEdit.opArticulation": {
    "zh-TW": "{part}・{range}・演奏法{verb} {articulation}",
    en: "{part} · {range} · {verb} articulation {articulation}",
    ja: "{part}・{range}・奏法 {articulation} を{verb}",
  },
  "nlEdit.articulationAdd": { "zh-TW": "附加", en: "add", ja: "追加" },
  "nlEdit.articulationSet": { "zh-TW": "設為", en: "set", ja: "設定" },
  "nlEdit.opRest": {
    "zh-TW": "{part}・{range}・整段改為休止符",
    en: "{part} · {range} · turn the whole range into rests",
    ja: "{part}・{range}・範囲全体を休符にする",
  },
  "nlEdit.opDynamic": {
    "zh-TW": "{part}・{range}・力度設為 {dynamic}",
    en: "{part} · {range} · set dynamic to {dynamic}",
    ja: "{part}・{range}・強弱を {dynamic} に設定",
  },
  "nlEdit.opEnrich": {
    "zh-TW": "{part}・{range}・依原曲和聲加厚（{texture}・{density}）",
    en: "{part} · {range} · enrich from the original harmony "
      + "({texture} · {density})",
    ja: "{part}・{range}・原曲の和声から加厚（{texture}・{density}）",
  },
  "nlEdit.opLevel": {
    "zh-TW": "{part}・{range}・抹平到難度 {difficulty}",
    en: "{part} · {range} · level to difficulty {difficulty}",
    ja: "{part}・{range}・難易度 {difficulty} へ均す",
  },
  "nlEdit.texture.block": {
    "zh-TW": "方塊和弦", en: "block chords", ja: "ブロックコード",
  },
  "nlEdit.texture.arpeggio": {
    "zh-TW": "琶音", en: "arpeggio", ja: "アルペジオ",
  },
  "nlEdit.texture.strum": {
    "zh-TW": "刷弦", en: "strum", ja: "ストラム",
  },
  "nlEdit.texture.octave": {
    "zh-TW": "八度疊置", en: "octave doubling", ja: "オクターブ重ね",
  },
  "nlEdit.density.light": {
    "zh-TW": "輕度・只加強拍", en: "light · downbeats only",
    ja: "軽め・強拍のみ",
  },
  "nlEdit.density.medium": {
    "zh-TW": "中度・整數拍", en: "medium · on the beat",
    ja: "中程度・拍頭",
  },
  "nlEdit.density.full": {
    "zh-TW": "濃密・每個音", en: "full · every note",
    ja: "濃密・すべての音",
  },
  "nlEdit.opSimplify": {
    "zh-TW": "{part}・{range}・降難度（{level}）",
    en: "{part} · {range} · simplify ({level})",
    ja: "{part}・{range}・難易度を下げる（{level}）",
  },
  "nlEdit.level.light": {
    "zh-TW": "輕度・留三和弦", en: "light · keep triads",
    ja: "軽め・三和音を残す",
  },
  "nlEdit.level.medium": {
    "zh-TW": "中度・留雙音", en: "medium · keep double-stops",
    ja: "中程度・重音を残す",
  },
  "nlEdit.level.full": {
    "zh-TW": "大幅・退到單音", en: "full · down to single notes",
    ja: "大幅・単音まで",
  },
  // ── DifficultyBoostDialog (加難度面板) ────────────────────────────────
  "boost.title": {
    "zh-TW": "💪 難度調節", en: "💪 Adjust Difficulty",
    ja: "💪 難度調整",
  },
  "boost.intro": {
    "zh-TW": "選一個聲部、一段小節範圍,決定要加難度或降難度 —— 全部會經"
      + "樂器可演奏性檢查,套用後可用 ↶ 復原。",
    en: "Pick a part and a measure range, then boost or reduce its "
      + "difficulty. Everything passes the instrument playability "
      + "check; use ↶ to undo after applying.",
    ja: "パートと小節範囲を選び、難度を上げるか下げるかを決めます。"
      + "すべて演奏可能性チェックを通り、適用後は ↶ で取り消せます。",
  },
  "boost.direction.boost": {
    "zh-TW": "加難度", en: "Boost", ja: "難度アップ",
  },
  "boost.direction.reduce": {
    "zh-TW": "降難度", en: "Reduce", ja: "難度ダウン",
  },
  "boost.direction.target": {
    "zh-TW": "目標難度", en: "Target", ja: "目標難度",
  },
  "boost.targetLabel": {
    "zh-TW": "目標難度等級", en: "Target difficulty level",
    ja: "目標難易度レベル",
  },
  "boost.targetHint": {
    "zh-TW": "逐小節把這段抹平到選定的難度 —— 太難的小節簡化、"
      + "太簡單的加厚。",
    en: "Levels each measure in the range to the chosen difficulty — "
      + "harder measures get simplified, easier ones enriched.",
    ja: "範囲内の各小節を選んだ難易度に均します —— 難しい小節は"
      + "簡略化、易しい小節は加厚。",
  },
  "boost.reason.level": {
    "zh-TW": "抹平到目標難度",
    en: "Level to target difficulty",
    ja: "目標難易度へ均す",
  },
  "boost.partLabel": { "zh-TW": "聲部", en: "Part", ja: "パート" },
  "boost.rangeLabel": {
    "zh-TW": "小節範圍", en: "Measure range", ja: "小節範囲",
  },
  "boost.rangeTo": { "zh-TW": "到", en: "to", ja: "〜" },
  "boost.techLabel": {
    "zh-TW": "加難度手法", en: "Techniques", ja: "技法",
  },
  "boost.tech.octave": {
    "zh-TW": "八度疊置", en: "Octave doubling", ja: "オクターブ重ね",
  },
  "boost.tech.octaveDesc": {
    "zh-TW": "把旋律音疊上低八度,成八度雙音",
    en: "Doubles each melody note an octave below",
    ja: "旋律音を1オクターブ下に重ねて重音にする",
  },
  "boost.tech.doubleStop": {
    "zh-TW": "雙音和弦", en: "Double-stops", ja: "重音コード",
  },
  "boost.tech.doubleStopDesc": {
    "zh-TW": "依原曲和聲補相鄰弦的和聲音",
    en: "Adds harmony notes on adjacent strings from the original",
    ja: "原曲の和声から隣接弦の和声音を補う",
  },
  "boost.tech.higherPosition": {
    "zh-TW": "整段升高八度",
    en: "Shift up an octave",
    ja: "1オクターブ上げる",
  },
  "boost.tech.higherPositionDesc": {
    "zh-TW":
      "整段嘗試升高八度 (弦樂提高把位 / 鋼琴跳到高音域). "
      + "超出樂器音域的音會自動跳過, 不會破壞改編.",
    en:
      "Tries to shift the passage up an octave (higher position on strings / "
      + "upper register on piano). Notes that would exceed the instrument's "
      + "range are skipped automatically.",
    ja:
      "区間を1オクターブ上げます (弦楽器: 高ポジション / "
      + "ピアノ: 高音域). 楽器の音域を超える音は自動的にスキップされます.",
  },
  "boost.tech.bowing": {
    "zh-TW": "困難弓法", en: "Demanding bowing", ja: "難しい弓法",
  },
  "boost.tech.bowingDesc": {
    "zh-TW": "加上 spiccato（跳弓）演奏法",
    en: "Adds spiccato (bouncing bow) articulation",
    ja: "スピッカート（跳弓）の奏法を追加",
  },
  "boost.intensityLabel": {
    "zh-TW": "炫技強度", en: "Intensity", ja: "強度",
  },
  "boost.intensity.conservative": {
    "zh-TW": "保守", en: "Conservative", ja: "控えめ",
  },
  "boost.intensity.balanced": {
    "zh-TW": "平衡", en: "Balanced", ja: "バランス",
  },
  "boost.intensity.virtuosic": {
    "zh-TW": "炫技", en: "Virtuosic", ja: "ヴィルトゥオーゾ",
  },
  "boost.currentDifficulty": {
    "zh-TW": "目前難度", en: "Current difficulty", ja: "現在の難度",
  },
  "boost.apply": {
    "zh-TW": "套用調節", en: "Apply", ja: "適用",
  },
  "boost.levelLabel": {
    "zh-TW": "簡化強度", en: "Simplification level", ja: "簡略化の強さ",
  },
  "boost.level.light": {
    "zh-TW": "輕度", en: "Light", ja: "軽め",
  },
  "boost.level.medium": {
    "zh-TW": "中度", en: "Medium", ja: "中程度",
  },
  "boost.level.full": {
    "zh-TW": "大幅", en: "Full", ja: "大幅",
  },
  "boost.reduceDesc": {
    "zh-TW": "降難度會自動:和弦瘦身、八度收摺、去裝飾、剝除困難弓法。"
      + "旋律永遠保留。",
    en: "Reducing automatically thins chords, folds octaves back in, "
      + "removes ornaments and strips demanding bowing. "
      + "The melody is always kept.",
    ja: "難度を下げると自動でコードを薄く、オクターブを畳み込み、"
      + "装飾を除去、難しい弓法を外します。旋律は必ず残ります。",
  },
  "boost.reason.simplify": {
    "zh-TW": "降難度 — 簡化和弦 / 去裝飾 / 簡化弓法",
    en: "Reduce difficulty — thin chords / de-ornament / simpler bowing",
    ja: "難度ダウン — コード簡略化 / 装飾除去 / 弓法簡略化",
  },
  // ── D2 品質 lint (編輯後的品質 delta) ─────────────────────────────────
  "quality.delta.label": {
    "zh-TW": "品質變化", en: "Quality change", ja: "品質の変化",
  },
  "quality.delta.melody": {
    "zh-TW": "旋律", en: "Melody", ja: "旋律",
  },
  "quality.delta.harmony": {
    "zh-TW": "和聲", en: "Harmony", ja: "和声",
  },
  "quality.delta.playability": {
    "zh-TW": "可演奏性", en: "Playability", ja: "演奏可能性",
  },
  // ── 練習模式 PracticePanel (整合 C) ───────────────────────────────────
  "practice.title": {
    "zh-TW": "🎯 練習模式", en: "🎯 Practice mode", ja: "🎯 練習モード",
  },
  "practice.intro": {
    "zh-TW": "點下方任一小節 → 播放器自動循環這段, "
      + "讓你重點練習困難段落。",
    en: "Click any measure below → the player auto-loops that bar so "
      + "you can focus practice on the hard parts.",
    ja: "下記いずれかの小節をクリック → プレイヤーがその箇所を自動"
      + "ループし、難所を集中練習できます。",
  },
  "practice.hardest": {
    "zh-TW": "最難的小節", en: "Hardest measures",
    ja: "最も難しい小節",
  },
  "practice.empty": {
    "zh-TW": "尚未完成改編, 練習模式需要難度資訊。",
    en: "No arrangement yet — practice mode needs difficulty data.",
    ja: "まだ編曲がありません — 練習モードには難度データが必要です。",
  },
  "practice.loading": {
    "zh-TW": "計算難度中…", en: "Computing difficulty…",
    ja: "難度を計算中…",
  },
  "practice.measureLabel": {
    "zh-TW": "第 {n} 小節", en: "Measure {n}", ja: "第 {n} 小節",
  },
  "practice.hint": {
    "zh-TW": "選定後此面板自動關閉, 按 ▶ 開始循環播放。",
    en: "After picking, this panel closes; press ▶ to start looping.",
    ja: "選択後にパネルが閉じます。▶ を押してループ再生を開始。",
  },
  "practice.computeFailed": {
    "zh-TW": "難度計算失敗",
    en: "Difficulty computation failed",
    ja: "難度の計算に失敗しました",
  },
  "practice.fingering.loading": {
    "zh-TW": "計算指法中…",
    en: "Computing fingering…",
    ja: "指使いを計算中…",
  },
  "practice.fingering.empty": {
    "zh-TW": "此編制無弦樂 part",
    en: "No string parts in this ensemble",
    ja: "この編成に弦楽パートはありません",
  },
  "practice.fingering.tooltip": {
    "zh-TW": "{pitch} → {string} 弦 第 {fret} 把位",
    en: "{pitch} → {string} string, position {fret}",
    ja: "{pitch} → {string} 弦、第 {fret} ポジション",
  },
  "practice.fingering.loopBtn": {
    "zh-TW": "開始循環練習",
    en: "Start loop practice",
    ja: "ループ練習を開始",
  },
  "boost.applying": {
    "zh-TW": "套用中…", en: "Applying…", ja: "適用中…",
  },
  // 0.1.39: 「我的學生」CRUD
  "students.title": {
    "zh-TW": "我的學生", en: "My students", ja: "わたしの生徒",
  },
  "students.count": {
    "zh-TW": "{n} 位", en: "{n} students", ja: "{n} 人",
  },
  "students.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },
  "students.intro": {
    "zh-TW": "建立你的學生卡片 — 之後在「難度調節」/「改編建議」"
      + "對話框可以「為 X 學生」一鍵選用. 純本地, 不上傳.",
    en: "Build your student roster — then pick \"for X\" from the difficulty / "
      + "arrangement dialogs to auto-fit their level. All local.",
    ja: "生徒カードを作成 — 「難易度調整」「編曲提案」ダイアログで「○○のため」"
      + "を選ぶと自動でレベル設定. すべてローカル保存.",
  },
  "students.empty": {
    "zh-TW": "還沒有學生 — 點下方按鈕加第一位",
    en: "No students yet — click below to add your first",
    ja: "まだ生徒がいません — 下のボタンで追加",
  },
  "students.add": {
    "zh-TW": "加學生", en: "Add student", ja: "生徒を追加",
  },
  "students.save": { "zh-TW": "儲存", en: "Save", ja: "保存" },
  "students.cancel": { "zh-TW": "取消", en: "Cancel", ja: "キャンセル" },
  "students.delete": { "zh-TW": "刪除", en: "Delete", ja: "削除" },
  "students.confirmDelete": {
    "zh-TW": "確定刪除 {name} 的學生卡片?",
    en: "Delete {name}'s student card?",
    ja: "{name} の生徒カードを削除しますか?",
  },
  "students.clickToEdit": {
    "zh-TW": "點此編輯", en: "Click to edit", ja: "クリックして編集",
  },
  "students.namePlaceholder": {
    "zh-TW": "學生名字", en: "Student name", ja: "生徒の名前",
  },
  "students.notesPlaceholder": {
    "zh-TW": "練琴筆記 (e.g. 移把位只到第3, 跳弓還不熟) — AI 改編時會參考",
    en: "Practice notes (e.g. only up to 3rd position, spiccato not yet) — "
      + "AI uses this when arranging",
    ja: "練習メモ (例: ポジション 3 まで, スピッカートはまだ) — AI が編曲時に参照",
  },
  "students.gradeLabel": {
    "zh-TW": "程度 {grade}", en: "Grade {grade}", ja: "レベル {grade}",
  },
  "students.gradeTip": {
    "zh-TW": "1=初級 / 2=入門 / 3=中級 / 4=進階 / 5=職業",
    en: "1=beginner / 2=novice / 3=intermediate / 4=advanced / 5=pro",
    ja: "1=初級 / 2=入門 / 3=中級 / 4=上級 / 5=プロ",
  },
  "toolbar.students.title": {
    "zh-TW": "管理我的學生 — 為個別學生調整改編",
    en: "Manage my students — tailor arrangements per student",
    ja: "生徒を管理 — 個別に編曲を調整",
  },

  // ── 0.1.44: TeacherHub — 教師中心 (歸 1 hub) ──
  "toolbar.teacherHub": {
    "zh-TW": "🎓 教師中心", en: "🎓 Teacher Hub", ja: "🎓 教師ハブ",
  },
  "toolbar.teacherHub.title": {
    "zh-TW": "學生 / 難度 / 練習 / 麥克風 全部從這裡進入",
    en: "Students / difficulty / practice / mic — all here",
    ja: "生徒 / 難易度 / 練習 / マイク をここから",
  },
  "teacherHub.title": {
    "zh-TW": "教師中心", en: "Teacher Hub", ja: "教師ハブ",
  },
  "teacherHub.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },
  "teacherHub.needsArrangement": {
    "zh-TW": "需要先有改編結果", en: "Needs an arrangement first",
    ja: "編曲結果が必要です",
  },
  "teacherHub.locked.title": {
    "zh-TW": "此功能需要改編結果",
    en: "This feature needs an arrangement",
    ja: "この機能には編曲結果が必要です",
  },
  "teacherHub.locked.body": {
    "zh-TW": "難度調節與慢速練習都是針對某個改編結果做的工具. "
      + "請先在工具列開譜並改編, 再回來使用.",
    en: "Difficulty adjustment and slow practice both work on a "
      + "specific arrangement. Open a score and arrange it first, "
      + "then return here.",
    ja: "難易度調整とスロー練習はどちらも特定の編曲結果に対する"
      + "ツールです。先にツールバーで楽譜を開いて編曲してから、"
      + "ここに戻ってきてください。",
  },
  "teacherHub.locked.step1": {
    "zh-TW": "點工具列「匯入樂譜」(⌘O) 或「曲庫」(⌘L) 開譜",
    en: "Open a score via Import (⌘O) or Repertoire (⌘L) in the toolbar",
    ja: "ツールバーの「インポート」(⌘O) または「曲目」(⌘L) で楽譜を開く",
  },
  "teacherHub.locked.step2": {
    "zh-TW": "選擇目標編制 (e.g. 弦樂四重奏 / 鋼琴獨奏), 點「改編」",
    en: "Pick a target ensemble (e.g. String Quartet / Piano Solo) "
      + "and click Arrange",
    ja: "ターゲット編成 (例: 弦楽四重奏 / ピアノ独奏) を選び、編曲をクリック",
  },
  "teacherHub.locked.step3": {
    "zh-TW": "改編完成後回到教師中心 — 鎖頭就會消失",
    en: "After arranging, return to TeacherHub — the lock will be gone",
    ja: "編曲が完了したら教師ハブに戻ると、鍵が外れます",
  },
  "teacherHub.locked.cta": {
    "zh-TW": "前往工具列 / 開曲庫",
    en: "Go to toolbar / Open repertoire",
    ja: "ツールバーへ / 曲目を開く",
  },
  "teacherHub.tab.students": {
    "zh-TW": "學生", en: "Students", ja: "生徒",
  },
  "teacherHub.tab.difficulty": {
    "zh-TW": "難度調節", en: "Difficulty", ja: "難易度",
  },
  "teacherHub.tab.practice": {
    "zh-TW": "慢速練習", en: "Practice", ja: "練習",
  },
  "teacherHub.tab.mic": {
    "zh-TW": "麥克風練習", en: "Mic", ja: "マイク",
  },
  "teacherHub.difficulty.title": {
    "zh-TW": "難度調節 — 加 / 減難度",
    en: "Difficulty — boost or simplify",
    ja: "難易度 — 上げる / 下げる",
  },
  "teacherHub.difficulty.desc": {
    "zh-TW":
      "依學生程度調整改編難度: 加和聲、技巧、織體, 或反向簡化。LLM 也"
      + "會根據選定學生的筆記給建議。",
    en:
      "Adjust arrangement difficulty per student level — add harmony, "
      + "technique, texture, or simplify. The LLM uses the selected "
      + "student's notes as hints.",
    ja:
      "生徒のレベルに合わせて編曲の難易度を調整 — 和声 / 技法 / 織"
      + "体を追加、または簡略化。LLM は選択した生徒のノートを参考にします。",
  },
  "teacherHub.difficulty.open": {
    "zh-TW": "開啟難度面板", en: "Open difficulty panel",
    ja: "難易度パネルを開く",
  },
  "teacherHub.practice.title": {
    "zh-TW": "慢速練習 — Loop + 速度調整",
    en: "Slow practice — loop + tempo",
    ja: "スロー練習 — ループ + テンポ",
  },
  "teacherHub.practice.desc": {
    "zh-TW":
      "段落 loop 播放 + 慢速 (0.5x ~ 1.0x), 給學生分段練。也支援聲部"
      + " mute/solo, 練單一聲部用。",
    en:
      "Loop a passage at slower tempo (0.5x – 1.0x) for the student to "
      + "drill. Also supports per-voice mute/solo for isolated practice.",
    ja:
      "区間ループ + スロー再生 (0.5x ~ 1.0x) で生徒の練習用。声部の"
      + "ミュート / ソロにも対応。",
  },
  "teacherHub.practice.open": {
    "zh-TW": "開啟練習面板", en: "Open practice panel",
    ja: "練習パネルを開く",
  },
  "teacherHub.mic.title": {
    "zh-TW": "麥克風練習 — 即時音準評估",
    en: "Mic practice — live intonation feedback",
    ja: "マイク練習 — リアルタイム音程評価",
  },
  "teacherHub.mic.desc": {
    "zh-TW":
      "對著麥克風唱 / 演奏, 即時看到音準偏差。不需要載入樂譜也能用,"
      + " 純做音準訓練。",
    en:
      "Sing/play into the mic and see live pitch deviation. Works "
      + "without loading a score — for pure intonation training too.",
    ja:
      "マイクに向かって歌 / 演奏すると、音程のずれをリアルタイム表"
      + "示。楽譜を読み込まなくても音程練習に使えます。",
  },
  "teacherHub.mic.open": {
    "zh-TW": "開啟麥克風練習", en: "Open mic practice",
    ja: "マイク練習を開く",
  },
  // 0.1.39: 改編對話框「為 X 學生」整合
  "boost.forStudent": {
    "zh-TW": "為學生", en: "For student", ja: "生徒のため",
  },
  "boost.forStudent.none": {
    "zh-TW": "(不選 — 用通用難度設定)",
    en: "(none — use generic settings)",
    ja: "(なし — 一般設定を使用)",
  },
  "boost.forStudent.applied": {
    "zh-TW": "已套用 {name} 的設定 (樂器 / 程度 / 練琴筆記)",
    en: "Applied {name}'s settings (instrument / level / notes)",
    ja: "{name} の設定を適用 (楽器 / レベル / メモ)",
  },
  // 0.1.36: auto-update banner
  "update.available": {
    "zh-TW": "🔔 新版 v{version} 下載中…",
    en: "🔔 Downloading update v{version}…",
    ja: "🔔 新バージョン v{version} をダウンロード中…",
  },
  "update.downloaded": {
    "zh-TW": "✨ v{version} 已下載完成 — 點重啟安裝",
    en: "✨ v{version} ready — click to restart and install",
    ja: "✨ v{version} のダウンロード完了 — 再起動してインストール",
  },
  "update.restartToInstall": {
    "zh-TW": "重啟安裝", en: "Restart & install", ja: "再起動してインストール",
  },
  "update.dismiss": {
    "zh-TW": "暫時隱藏", en: "Dismiss", ja: "閉じる",
  },
  // 0.1.35: Performance-Following 麥克風練習評估
  "micPractice.title": {
    "zh-TW": "麥克風練習",
    en: "Microphone Practice",
    ja: "マイク練習",
  },
  "micPractice.close": {
    "zh-TW": "關閉", en: "Close", ja: "閉じる",
  },
  "micPractice.intro": {
    "zh-TW":
      "對著麥克風唱 / 拉 / 吹 — 即時顯示音高與音準偏差. "
      + "音訊不離開電腦, 不錄音, 不上傳.",
    en:
      "Sing, bow, or blow into the mic — see your pitch and tuning in "
      + "real time. Audio stays on your machine; nothing is recorded or "
      + "uploaded.",
    ja:
      "マイクに向かって歌う / 弾く / 吹く — 音高とピッチのずれをリアルタイム"
      + "表示. 音声は端末から外に出ず, 録音もアップロードもされません.",
  },
  "micPractice.startBtn": {
    "zh-TW": "開啟麥克風", en: "Start microphone", ja: "マイクを開始",
  },
  "micPractice.stopBtn": {
    "zh-TW": "停止", en: "Stop", ja: "停止",
  },
  "micPractice.requestingPermission": {
    "zh-TW": "請允許麥克風使用權限…",
    en: "Waiting for microphone permission…",
    ja: "マイクの使用許可を待っています…",
  },
  "micPractice.waitingForSignal": {
    "zh-TW": "聆聽中… 對著麥克風發出聲音",
    en: "Listening… make a sound",
    ja: "聞いています… 音を出してください",
  },
  "micPractice.errorPrefix": {
    "zh-TW": "麥克風錯誤", en: "Microphone error", ja: "マイクエラー",
  },
  "micPractice.error.permission": {
    "zh-TW": "權限被拒. 請到「系統設定 → 隱私權與安全性 → 麥克風」"
      + "勾選 Score Arranger, 然後重試.",
    en: "Permission denied. Enable Score Arranger in "
      + "System Settings → Privacy & Security → Microphone, then retry.",
    ja: "権限が拒否されました。システム設定 → "
      + "プライバシーとセキュリティ → マイク で Score Arranger を許可し、"
      + "再試行してください。",
  },
  "micPractice.error.noDevice": {
    "zh-TW": "找不到麥克風裝置. 請確認麥克風已接上.",
    en: "No microphone device found. Check that a mic is connected.",
    ja: "マイクデバイスが見つかりません。接続を確認してください。",
  },
  "micPractice.error.inUse": {
    "zh-TW": "麥克風被其他程式佔用. 關閉佔用程式後重試.",
    en: "Microphone is in use by another application. "
      + "Close the other app and retry.",
    ja: "マイクは他のアプリで使用中です。"
      + "そのアプリを終了して再試行してください。",
  },
  "micPractice.error.notSupported": {
    "zh-TW": "瀏覽器或 OS 不支援麥克風 API.",
    en: "Microphone API not supported by browser or OS.",
    ja: "ブラウザまたは OS がマイク API に対応していません。",
  },
  "micPractice.legendHint": {
    "zh-TW":
      "綠 = 準 (±10¢ 內) / 橘 = 偏一點 / 紅 = 偏太多. 橫向是時間 (5 秒), "
      + "縱向是音高 (半音格線, C 標示).",
    en:
      "Green = in tune (±10¢) / Orange = slightly off / Red = significantly "
      + "off. X axis is time (5s), Y axis is pitch (semitone grid, C marked).",
    ja:
      "緑 = 正確 (±10¢) / オレンジ = 少しずれ / 赤 = 大きくずれ. 横軸は時間 "
      + "(5秒), 縦軸は音高 (半音線, C 表示).",
  },
  "boost.applied": {
    "zh-TW": "已套用 {count} 種手法,改動 {touched} 處。可用 ↶ 復原。",
    en: "Applied {count} technique(s), {touched} change(s). "
      + "Use ↶ to undo.",
    ja: "{count} 種の技法を適用、{touched} 箇所を変更。↶ で取り消せます。",
  },
  "boost.appliedNoChange": {
    "zh-TW": "已套用,但這個範圍沒有可加難度的音符 (可能已是和弦 / 太低 / 已鎖定)。",
    en: "Applied, but no notes in this range could be boosted "
      + "(already chords / too low / locked).",
    ja: "適用しましたが、この範囲に難度を上げられる音符がありません"
      + "（既にコード / 低すぎ / ロック済み）。",
  },
  // 0.1.30: transpose 音域保護 — 顯示跳過事件數, 避免使用者疑惑
  "boost.skippedOutOfRange": {
    "zh-TW": "升高八度時跳過 {n} 個超出樂器音域的音",
    en: "{n} note(s) skipped — would exceed instrument range",
    ja: "{n} 音をスキップ (楽器の音域を超えるため)",
  },
  "boost.noTech": {
    "zh-TW": "請至少勾選一種手法。",
    en: "Select at least one technique.",
    ja: "技法を1つ以上選んでください。",
  },
  "boost.failed": {
    "zh-TW": "套用失敗", en: "Apply failed", ja: "適用に失敗しました",
  },
  "boost.reason.octave": {
    "zh-TW": "八度疊置 — 加技巧難度",
    en: "Octave doubling — add technical difficulty",
    ja: "オクターブ重ね — 技巧的難度を追加",
  },
  "boost.reason.doubleStop": {
    "zh-TW": "補雙音和弦 — 依原曲和聲加厚",
    en: "Double-stops — enrich from original harmony",
    ja: "重音 — 原曲の和声から加厚",
  },
  "boost.reason.higherPosition": {
    "zh-TW": "升高八度 — 提高演奏把位",
    en: "Up an octave — raise the playing position",
    ja: "1オクターブ上 — 演奏ポジションを高くする",
  },
  "boost.reason.bowing": {
    "zh-TW": "加 spiccato 跳弓 — 提高弓法難度",
    en: "Spiccato — demanding bowing",
    ja: "スピッカート — 弓法の難度アップ",
  },
  // ── LLMSettingsDialog ─────────────────────────────────────────────────
  "llmSettings.title": {
    "zh-TW": "🤖 AI 模型設定",
    en: "🤖 AI Model Settings",
    ja: "🤖 AIモデル設定",
  },
  "llmSettings.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },
  "llmSettings.loading": {
    "zh-TW": "讀取設定中...",
    en: "Loading settings...",
    ja: "設定を読み込み中...",
  },
  "llmSettings.providerOpenaiCompat": {
    "zh-TW": "OpenAI 相容 (OpenAI / Groq / vLLM …)",
    en: "OpenAI-compatible (OpenAI / Groq / vLLM …)",
    ja: "OpenAI互換 (OpenAI / Groq / vLLM …)",
  },
  "llmSettings.providerOllama": {
    "zh-TW": "Ollama (本地模型)",
    en: "Ollama (local model)",
    ja: "Ollama（ローカルモデル）",
  },
  "llmSettings.keyHintAnthropic": {
    "zh-TW": "需設定環境變數 ANTHROPIC_API_KEY 或 LLM_API_KEY",
    en: "Set the ANTHROPIC_API_KEY or LLM_API_KEY environment variable",
    ja: "環境変数 ANTHROPIC_API_KEY または LLM_API_KEY の設定が必要です",
  },
  "llmSettings.keyHintOpenaiCompat": {
    "zh-TW": "需設定環境變數 LLM_API_KEY (localhost endpoint 可免)",
    en:
      "Set the LLM_API_KEY environment variable (not needed for a localhost endpoint)",
    ja:
      "環境変数 LLM_API_KEY の設定が必要です（localhost のエンドポイントでは不要）",
  },
  "llmSettings.keyHintOllama": {
    "zh-TW": "本地 Ollama 通常不需 API key",
    en: "Local Ollama usually needs no API key",
    ja: "ローカルの Ollama は通常APIキー不要です",
  },
  "llmSettings.statusReady": {
    "zh-TW": "✓ AI 功能已就緒 — 改編建議與自然語言改譜可用",
    en:
      "✓ AI features ready — arrangement suggestions and natural-language editing are available",
    ja:
      "✓ AI機能が利用可能です — 編曲の提案と自然言語による楽譜の編集が使えます",
  },
  "llmSettings.statusNotReady": {
    "zh-TW": "○ 尚未就緒 — 請確認下方 provider 與 API key 設定",
    en: "○ Not ready — check the provider and API key settings below",
    ja: "○ まだ利用できません — 下記のプロバイダとAPIキーの設定を確認してください",
  },
  "llmSettings.providerLabel": {
    "zh-TW": "模型供應商 (Provider)",
    en: "Model Provider",
    ja: "モデルプロバイダ",
  },
  "llmSettings.baseUrlLabel": {
    "zh-TW": "API Endpoint (Base URL)",
    en: "API Endpoint (Base URL)",
    ja: "APIエンドポイント (Base URL)",
  },
  "llmSettings.modelLabel": {
    "zh-TW": "模型 ID (Model)",
    en: "Model ID",
    ja: "モデルID",
  },
  "llmSettings.keyTitle": {
    "zh-TW": "關於 API Key",
    en: "About the API Key",
    ja: "APIキーについて",
  },
  "llmSettings.keyNote": {
    "zh-TW":
      "基於安全考量, API key 不會寫入磁碟 — 僅在啟動前以環境變數傳入, 只存在於主程序記憶體。provider / endpoint / model 則會記住。",
    en:
      "For security, the API key is never written to disk — it is passed via an environment variable at startup and lives only in the main process's memory. The provider / endpoint / model are remembered.",
    ja:
      "セキュリティ上の理由から、APIキーはディスクに書き込まれません — 起動前に環境変数として渡され、メインプロセスのメモリ上にのみ存在します。プロバイダ / エンドポイント / モデルは記憶されます。",
  },
  "llmSettings.savedHint": { "zh-TW": "✓ 已儲存", en: "✓ Saved", ja: "✓ 保存しました" },
  "llmSettings.switchHint": {
    "zh-TW": "切換供應商會自動帶入預設 endpoint",
    en: "Switching provider fills in the default endpoint automatically",
    ja: "プロバイダを切り替えると、既定のエンドポイントが自動で入力されます",
  },
  "llmSettings.saving": { "zh-TW": "儲存中...", en: "Saving...", ja: "保存中..." },
  "llmSettings.save": {
    "zh-TW": "儲存設定",
    en: "Save settings",
    ja: "設定を保存",
  },
  // ── LLMSuggestionDialog ───────────────────────────────────────────────
  "llmSuggest.title": {
    "zh-TW": "🤖 AI 改編建議",
    en: "🤖 AI Arrangement Suggestions",
    ja: "🤖 AI編曲提案",
  },
  "llmSuggest.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },
  "llmSuggest.detecting": {
    "zh-TW": "偵測 API 可用性...",
    en: "Checking API availability...",
    ja: "APIの利用可否を確認中...",
  },
  "llmSuggest.disabledTitle": {
    "zh-TW": "未啟用 AI 建議",
    en: "AI suggestions not enabled",
    ja: "AI提案が有効になっていません",
  },
  "llmSuggest.disabledBody": {
    "zh-TW": "請在啟動 Score Arranger 前設定環境變數:",
    en: "Set the environment variable before launching Score Arranger:",
    ja: "Score Arranger を起動する前に環境変数を設定してください:",
  },
  "llmSuggest.keyNote": {
    "zh-TW": "API key 只存在於主程序記憶體, 不會寫入磁碟也不會送給 renderer。",
    en:
      "The API key lives only in the main process's memory — it is never written to disk nor sent to the renderer.",
    ja:
      "APIキーはメインプロセスのメモリ上にのみ存在し、ディスクへの書き込みも renderer への送信も行われません。",
  },
  "llmSuggest.sectionLabel": {
    "zh-TW": "段落描述:",
    en: "Section summary:",
    ja: "セクションの概要:",
  },
  "llmSuggest.queryLabel": {
    "zh-TW": "你想問什麼?",
    en: "What would you like to ask?",
    ja: "何を質問しますか?",
  },
  "llmSuggest.queryPlaceholder": {
    "zh-TW": "例: 太難拉, 簡化但保留旋律走向 / 這段和聲覺得怪 / 想要更輕快",
    en:
      "e.g. too hard to play, simplify but keep the melodic contour / this harmony sounds odd / I want it lighter",
    ja:
      "例: 演奏が難しいので、旋律の流れは保ちつつ簡略化したい / この和声が変に聞こえる / もっと軽やかにしたい",
  },
  "llmSuggest.asking": { "zh-TW": "詢問中...", en: "Asking...", ja: "問い合わせ中..." },
  "llmSuggest.askClaude": {
    "zh-TW": "詢問 Claude",
    en: "Ask Claude",
    ja: "Claude に質問",
  },
  "llmSuggest.submitHint": {
    "zh-TW": "⌘+Enter 送出",
    en: "⌘+Enter to submit",
    ja: "⌘+Enter で送信",
  },
  "llmSuggest.responseFailed": {
    "zh-TW": "AI 回應失敗",
    en: "The AI failed to respond",
    ja: "AIの応答に失敗しました",
  },
  // ── MeasureEditor ─────────────────────────────────────────────────────
  "measureEdit.title": {
    "zh-TW": "編輯 第 {n} 小節",
    en: "Edit Measure {n}",
    ja: "第 {n} 小節を編集",
  },
  "measureEdit.midiTooltip": {
    "zh-TW": "MIDI: {devices} 已連線, 按鍵替換選定音高",
    en: "MIDI: {devices} connected — press a key to replace the selected pitch",
    ja: "MIDI: {devices} 接続済み — キーを押すと選択中の音高を置き換えます",
  },
  "measureEdit.llmTooltip": {
    "zh-TW": "用 Claude AI 問改編建議",
    en: "Ask Claude AI for arrangement suggestions",
    ja: "Claude AI に編曲の提案を尋ねる",
  },
  "measureEdit.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },
  "measureEdit.loadingEvents": {
    "zh-TW": "⌛ 載入小節事件...",
    en: "⌛ Loading measure events...",
    ja: "⌛ 小節のイベントを読み込み中...",
  },
  "measureEdit.noEvents": {
    "zh-TW": "此小節沒有事件",
    en: "No events in this measure",
    ja: "この小節にはイベントがありません",
  },
  "measureEdit.articulationLabel": {
    "zh-TW": "articulation:",
    en: "articulation:",
    ja: "奏法:",
  },
  "measureEdit.articulationApply": {
    "zh-TW": "整個小節 {part} 套用 {articulation}",
    en: "Apply {articulation} to part {part} across the whole measure",
    ja: "小節全体の {part} に {articulation} を適用",
  },
  "measureEdit.clear": { "zh-TW": "clear", en: "clear", ja: "消去" },
  "measureEdit.clearArticulationTooltip": {
    "zh-TW": "清除所有 articulation",
    en: "Clear all articulations",
    ja: "すべての奏法を消去",
  },
  "measureEdit.rest": { "zh-TW": "(休止)", en: "(rest)", ja: "(休符)" },
  "measureEdit.lockedTooltip": {
    "zh-TW": "已鎖定 — repair 不會動此音, 點擊解鎖",
    en: "Locked — repair will not touch this note; click to unlock",
    ja: "ロック中 — 修復はこの音符に手を加えません。クリックで解除",
  },
  "measureEdit.unlockedTooltip": {
    "zh-TW": "鎖定此音 — repair 不會覆寫",
    en: "Lock this note — repair will not overwrite it",
    ja: "この音符をロック — 修復で上書きされません",
  },
  "measureEdit.octaveUpTooltip": {
    "zh-TW": "上移八度",
    en: "Up an octave",
    ja: "1オクターヴ上げる",
  },
  "measureEdit.octaveDownTooltip": {
    "zh-TW": "下移八度",
    en: "Down an octave",
    ja: "1オクターヴ下げる",
  },
  "measureEdit.semitoneUpTooltip": {
    "zh-TW": "+1 半音",
    en: "+1 semitone",
    ja: "+1 半音",
  },
  "measureEdit.semitoneDownTooltip": {
    "zh-TW": "-1 半音",
    en: "-1 semitone",
    ja: "-1 半音",
  },
  "measureEdit.dynamicNone": { "zh-TW": "(無)", en: "(none)", ja: "(なし)" },
  "measureEdit.dynamicTooltip": {
    "zh-TW": "改力度",
    en: "Change dynamic",
    ja: "強弱を変更",
  },
  "measureEdit.halveTooltip": {
    "zh-TW": "時值縮一半 (♩ → ♪)",
    en: "Halve duration (♩ → ♪)",
    ja: "音価を半分にする (♩ → ♪)",
  },
  "measureEdit.doubleTooltip": {
    "zh-TW": "時值加倍 (♪ → ♩)",
    en: "Double duration (♪ → ♩)",
    ja: "音価を倍にする (♪ → ♩)",
  },
  "measureEdit.addDotTooltip": {
    "zh-TW": "加附點 (×1.5)",
    en: "Add dot (×1.5)",
    ja: "付点を加える (×1.5)",
  },
  "measureEdit.deleteTooltip": {
    "zh-TW": "替換為休止符",
    en: "Replace with a rest",
    ja: "休符に置き換える",
  },
  "measureEdit.footerHintIntro": {
    "zh-TW": "💡 點任一行選定該事件, 按 ",
    en: "💡 Click any row to select the event; press ",
    ja: "💡 行をクリックしてイベントを選択し、",
  },
  "measureEdit.footerHintSemitone": {
    "zh-TW": " 移半音, ",
    en: " for a semitone, ",
    ja: " で半音、",
  },
  "measureEdit.footerHintOctave": {
    "zh-TW": " 移八度, ",
    en: " for an octave, ",
    ja: " でオクターヴ、",
  },
  "measureEdit.footerHintDelete": {
    "zh-TW": " 刪除。⌘Z 可 undo。",
    en: " to delete. ⌘Z to undo.",
    ja: " で削除。⌘Z で取り消せます。",
  },
  "measureEdit.applyingArticulation": {
    "zh-TW": "套用 {articulation}...",
    en: "Applying {articulation}...",
    ja: "{articulation} を適用中...",
  },
  "measureEdit.editingAction": {
    "zh-TW": "編輯 {action}...",
    en: "Editing {action}...",
    ja: "{action} を編集中...",
  },
  "measureEdit.articulationFailed": {
    "zh-TW": "套用 articulation 失敗",
    en: "Failed to apply articulation",
    ja: "奏法の適用に失敗しました",
  },
  "measureEdit.editFailed": {
    "zh-TW": "編輯失敗",
    en: "Editing failed",
    ja: "編集に失敗しました",
  },
  "measureEdit.llmMeasureLabel": {
    "zh-TW": "第 {n} 小節:",
    en: "Measure {n}:",
    ja: "第 {n} 小節:",
  },
  "measureEdit.llmNoEvents": {
    "zh-TW": "(沒有事件)",
    en: "(no events)",
    ja: "(イベントなし)",
  },
  "measureEdit.llmNote": {
    "zh-TW": "音 {pitch}",
    en: "note {pitch}",
    ja: "音符 {pitch}",
  },
  "measureEdit.llmChord": {
    "zh-TW": "和弦 [{pitches}]",
    en: "chord [{pitches}]",
    ja: "和音 [{pitches}]",
  },
  "measureEdit.llmRest": { "zh-TW": "休止", en: "rest", ja: "休符" },
  "measureEdit.llmEventLine": {
    "zh-TW": "{desc}, 時值 {duration}{dyn}",
    en: "{desc}, duration {duration}{dyn}",
    ja: "{desc}、音価 {duration}{dyn}",
  },
  // ── LLMSetupWizard (引導模式 Phase 1) ─────────────────────────────────
  "llmSetup.title": {
    "zh-TW": "AI 模型設定 — 入門教學",
    en: "AI Model Setup — Getting Started",
    ja: "AI モデル設定 — はじめに",
  },
  "llmSetup.close": { "zh-TW": "關閉", en: "Close", ja: "閉じる" },
  "llmSetup.intro": {
    "zh-TW": "Score Arranger 大部分功能 (自動改編 / 聲部分配 / 可演奏性檢查 / 匯出) 都不需要 AI. 只有「自然語言改譜」會用到. 你可以申請免費的 Google Gemini API, 或在本地跑 Ollama (完全免費 + 私密).",
    en: "Most Score Arranger features (auto-arranging, voice assignment, playability checks, export) don't need AI. Only \"natural-language editing\" uses it. You can get a free Google Gemini API key, or run Ollama locally (completely free + private).",
    ja: "Score Arranger のほとんどの機能（自動編曲、声部割当、演奏可能性チェック、書き出し）は AI を必要としません。「自然言語編曲」のみ使用します。無料の Google Gemini API キーを取得するか、ローカルで Ollama を実行（完全無料 + プライベート）できます。",
  },
  "llmSetup.tab.gemini": {
    "zh-TW": "Google Gemini (免費)",
    en: "Google Gemini (Free)",
    ja: "Google Gemini (無料)",
  },
  "llmSetup.tab.ollama": {
    "zh-TW": "Ollama (本地)",
    en: "Ollama (Local)",
    ja: "Ollama (ローカル)",
  },
  "llmSetup.tab.skip": {
    "zh-TW": "跳過",
    en: "Skip",
    ja: "スキップ",
  },
  "llmSetup.gemini.banner": {
    "zh-TW": "Google AI Studio 提供免費 API key, 每分鐘有額度限制但對改譜用量綽綽有餘. 你的樂譜內容會送到 Google.",
    en: "Google AI Studio offers a free API key with per-minute rate limits — plenty for arranging use. Your score content will be sent to Google.",
    ja: "Google AI Studio は無料 API キーを提供します。分単位のレート制限がありますが、編曲用途には十分です。楽譜の内容は Google に送信されます。",
  },
  "llmSetup.gemini.step1.title": {
    "zh-TW": "開啟 Google AI Studio",
    en: "Open Google AI Studio",
    ja: "Google AI Studio を開く",
  },
  "llmSetup.gemini.step1.body": {
    "zh-TW": "點下面的按鈕, 用 Google 帳號登入. (沒有 Google 帳號? 可以免費申請)",
    en: "Click the button below and sign in with your Google account. (Don't have one? Free to register.)",
    ja: "下のボタンをクリックして、Google アカウントでサインインします。（アカウントがない場合は無料で登録できます）",
  },
  "llmSetup.gemini.step1.cta": {
    "zh-TW": "前往 aistudio.google.com",
    en: "Go to aistudio.google.com",
    ja: "aistudio.google.com へ移動",
  },
  "llmSetup.gemini.step2.title": {
    "zh-TW": "建立 API key",
    en: "Create API key",
    ja: "API キーを作成",
  },
  "llmSetup.gemini.step2.body": {
    "zh-TW": "登入後, 點頁面上的「Create API key」(建立 API 金鑰) 按鈕. 系統會產生一串長字串, 複製起來.",
    en: "After signing in, click the \"Create API key\" button on the page. It will generate a long string — copy it.",
    ja: "サインイン後、ページの「Create API key」ボタンをクリックします。長い文字列が生成されるのでコピーします。",
  },
  "llmSetup.gemini.step3.title": {
    "zh-TW": "貼到下方, 測試連線",
    en: "Paste below and test",
    ja: "下に貼り付けてテスト",
  },
  "llmSetup.gemini.step3.body": {
    "zh-TW": "API key 只會存在本機, 不會傳出去.",
    en: "The API key is stored locally only. It is never sent elsewhere.",
    ja: "API キーはローカルにのみ保存されます。他へは送信されません。",
  },
  "llmSetup.gemini.step3.placeholder": {
    "zh-TW": "AIzaSy...",
    en: "AIzaSy...",
    ja: "AIzaSy...",
  },
  "llmSetup.ollama.banner": {
    "zh-TW": "Ollama 在本機跑 LLM, 完全免費、完全私密、不需網路 (下載模型時除外). 第一次設定要 ~5 分鐘.",
    en: "Ollama runs LLMs locally — completely free, completely private, no internet needed (except for first model download). Initial setup ~5 minutes.",
    ja: "Ollama はローカルで LLM を実行します。完全無料、完全プライベート、ネット不要（モデル初回ダウンロード時を除く）。初期設定約 5 分。",
  },
  "llmSetup.ollama.step1.title": {
    "zh-TW": "安裝 Ollama",
    en: "Install Ollama",
    ja: "Ollama をインストール",
  },
  "llmSetup.ollama.step1.body": {
    "zh-TW": "下載 Ollama for Mac, 開啟 dmg 把 Ollama 拖到「應用程式」.",
    en: "Download Ollama for Mac. Open the dmg and drag Ollama to Applications.",
    ja: "Mac 用 Ollama をダウンロード。dmg を開いて Ollama を「アプリケーション」にドラッグ。",
  },
  "llmSetup.ollama.step1.cta": {
    "zh-TW": "下載 Ollama",
    en: "Download Ollama",
    ja: "Ollama をダウンロード",
  },
  "llmSetup.ollama.step2.title": {
    "zh-TW": "啟動 Ollama",
    en: "Start Ollama",
    ja: "Ollama を起動",
  },
  "llmSetup.ollama.step2.body": {
    "zh-TW": "在「應用程式」中打開 Ollama. 你會在 macOS 狀態列看到一隻羊駝圖示 — 那代表 Ollama 已在背景執行.",
    en: "Open Ollama from Applications. You'll see a llama icon in the macOS menu bar — Ollama is now running in the background.",
    ja: "「アプリケーション」から Ollama を開きます。macOS のメニューバーにラマのアイコンが表示されたら、Ollama がバックグラウンドで動作しています。",
  },
  "llmSetup.ollama.step3.title": {
    "zh-TW": "下載一個模型",
    en: "Download a model",
    ja: "モデルをダウンロード",
  },
  "llmSetup.ollama.step3.body": {
    "zh-TW": "選一個模型, 複製下方指令貼到 macOS 終端機 (Cmd+Space → 輸入 Terminal). 下載過程約 5-10 分鐘 (~5GB).",
    en: "Pick a model. Copy the command below and paste into Terminal (Cmd+Space → type Terminal). Takes 5-10 minutes (~5GB).",
    ja: "モデルを選択。下のコマンドをコピーしてターミナルに貼り付け（Cmd+Space → Terminal）。5～10 分で完了（約 5GB）。",
  },
  "llmSetup.ollama.step3.hint": {
    "zh-TW": "提示: 中文樂譜建議用 qwen2.5:7b. 想要最快可選 phi3:mini.",
    en: "Hint: For Chinese scores try qwen2.5:7b. For fastest results pick phi3:mini.",
    ja: "ヒント: 中国語の楽譜は qwen2.5:7b 推奨。最速は phi3:mini。",
  },
  "llmSetup.ollama.copyCmd": {
    "zh-TW": "複製指令",
    en: "Copy command",
    ja: "コマンドをコピー",
  },
  "llmSetup.ollama.step4.title": {
    "zh-TW": "測試連線",
    en: "Test connection",
    ja: "接続テスト",
  },
  "llmSetup.ollama.step4.body": {
    "zh-TW": "下載完成後, 點下方按鈕測試. Score Arranger 會送一個簡單訊息確認 Ollama 在跑.",
    en: "After download finishes, click the button below to test. Score Arranger will send a simple ping to verify Ollama is running.",
    ja: "ダウンロード完了後、下のボタンでテスト。Score Arranger が Ollama の稼働を確認します。",
  },
  "llmSetup.skip.banner": {
    "zh-TW": "沒問題 — Score Arranger 大部分功能不需要 AI.",
    en: "No problem — most Score Arranger features don't need AI.",
    ja: "問題ありません — ほとんどの機能は AI 不要です。",
  },
  "llmSetup.skip.body1": {
    "zh-TW": "以下功能完全不需要 AI 模型:",
    en: "These features don't need AI at all:",
    ja: "以下の機能は AI 不要です:",
  },
  "llmSetup.skip.feature1": {
    "zh-TW": "自動改編 (改編 + 聲部分配 + 可演奏性檢查)",
    en: "Auto-arranging (assignment + playability checks)",
    ja: "自動編曲（声部割当 + 演奏可能性チェック）",
  },
  "llmSetup.skip.feature2": {
    "zh-TW": "難度調節 (升難度 / 簡化 / 抹平到目標難度)",
    en: "Difficulty adjustment (boost / simplify / level to target)",
    ja: "難易度調整（高める / 簡略化 / 目標難度に均す）",
  },
  "llmSetup.skip.feature3": {
    "zh-TW": "練習模式 (找最難小節 + 弦樂指法 + 慢速練習)",
    en: "Practice mode (hardest measures + string fingering + slow practice)",
    ja: "練習モード（最難小節 + 弦楽指使い + スロー再生）",
  },
  "llmSetup.skip.body2": {
    "zh-TW": "只有「自然語言改譜」(用文字描述修改) 需要 AI. 你之後想用時, 在「設定 → AI 模型設定」可隨時開啟此精靈.",
    en: "Only \"natural-language editing\" needs AI. You can open this wizard later from Settings → AI Model Settings.",
    ja: "AI が必要なのは「自然言語編曲」のみ。後で「設定 → AI モデル設定」からこのウィザードを再度開けます。",
  },
  "llmSetup.skip.cta": {
    "zh-TW": "繼續使用 Score Arranger",
    en: "Continue using Score Arranger",
    ja: "Score Arranger を使い続ける",
  },
  "llmSetup.testConnection": {
    "zh-TW": "測試連線",
    en: "Test connection",
    ja: "接続テスト",
  },
  "llmSetup.testing": {
    "zh-TW": "測試中…",
    en: "Testing…",
    ja: "テスト中…",
  },
  "llmSetup.testingInProgress": {
    "zh-TW": "正在送出測試訊息…",
    en: "Sending test message…",
    ja: "テストメッセージを送信中…",
  },
  "llmSetup.success": {
    "zh-TW": "連線成功! AI 模型已設定好.",
    en: "Connected! AI model is configured.",
    ja: "接続成功！AI モデルが設定されました。",
  },
  "llmSetup.failPrefix": {
    "zh-TW": "連線失敗: ",
    en: "Connection failed: ",
    ja: "接続失敗: ",
  },
  "llmSetup.error.noKey": {
    "zh-TW": "請先貼上 API key",
    en: "Please paste an API key first",
    ja: "API キーを貼り付けてください",
  },
  "llmSetup.error.connFailed": {
    "zh-TW": "連線失敗, 請檢查 API key 是否正確",
    en: "Connection failed. Check the API key",
    ja: "接続失敗。API キーを確認してください",
  },
  "llmSetup.error.ollamaNotRunning": {
    "zh-TW": "Ollama 似乎沒在跑. 請確認狀態列有羊駝圖示",
    en: "Ollama doesn't seem to be running. Check the menu bar for the llama icon",
    ja: "Ollama が稼働していないようです。メニューバーのラマアイコンを確認してください",
  },
  "llmSetup.error.ollamaHint": {
    "zh-TW": "請確認 Ollama 已啟動且該模型已下載 (執行 `ollama list` 看)",
    en: "Make sure Ollama is running and the model is downloaded (`ollama list`)",
    ja: "Ollama が起動中でモデルがダウンロード済みか確認（`ollama list`）",
  },
};

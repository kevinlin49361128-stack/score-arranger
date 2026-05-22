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
    "zh-TW": "移高把位", en: "Higher position", ja: "高ポジション",
  },
  "boost.tech.higherPositionDesc": {
    "zh-TW": "整段升高八度,左手把位隨之提高",
    en: "Shifts the passage up an octave, raising the playing position",
    ja: "区間を1オクターブ上げ、運指ポジションを高くする",
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
  "boost.applying": {
    "zh-TW": "套用中…", en: "Applying…", ja: "適用中…",
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
};

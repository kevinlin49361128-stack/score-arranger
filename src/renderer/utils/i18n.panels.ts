import type { BiDict } from "./i18n";

/**
 * 資訊面板字串 — IssuePanel / RepairTimeline / QualityBadge /
 * AssignmentsPanel / AnalyzePanel / SectionNavigator / FingerboardSimulator。
 */
export const PANEL_STRINGS: BiDict = {
  // ── IssuePanel ──────────────────────────────────────────────────────────
  "issue.severityError": { "zh-TW": "錯誤", en: "Errors", ja: "エラー" },
  "issue.severityWarning": { "zh-TW": "警告", en: "Warnings", ja: "警告" },
  "issue.severityInfo": { "zh-TW": "提示", en: "Notices", ja: "通知" },
  "issue.emptyState": {
    "zh-TW": "(尚未執行分析或改編)",
    en: "(No analysis or arrangement yet)",
    ja: "(分析・編曲はまだ実行されていません)",
  },
  "issue.summaryArranged": {
    "zh-TW": "改編結果 — 🔴 {error} 錯誤 · 🟡 {warning} 警告 · "
      + "🟢 {info} 提示 (點建議可直接套用)",
    en: "Arrangement — 🔴 {error} errors · 🟡 {warning} warnings · "
      + "🟢 {info} notices (click a suggestion to apply)",
    ja: "編曲結果 — 🔴 {error} 件のエラー · 🟡 {warning} 件の警告 · "
      + "🟢 {info} 件の通知 (提案をクリックすると適用できます)",
  },
  "issue.summaryAnalysis": {
    "zh-TW": "分析報告 — 🔴 {error} 錯誤 · 🟡 {warning} 警告 · "
      + "🟢 {info} 提示 (改編後可套用建議)",
    en: "Analysis report — 🔴 {error} errors · 🟡 {warning} warnings · "
      + "🟢 {info} notices (suggestions apply after arranging)",
    ja: "分析レポート — 🔴 {error} 件のエラー · 🟡 {warning} 件の警告 · "
      + "🟢 {info} 件の通知 (提案は編曲後に適用できます)",
  },
  // 0.1.38 改編結果頁可演奏問題 dashboard — 醒目大號 chip 取代灰底小字
  "issue.dashboard.headingArranged": {
    "zh-TW": "改編品質檢查",
    en: "Arrangement quality check",
    ja: "編曲品質チェック",
  },
  "issue.dashboard.headingAnalysis": {
    "zh-TW": "原譜分析報告",
    en: "Source analysis report",
    ja: "原譜分析レポート",
  },
  "issue.dashboard.errors": {
    "zh-TW": "錯誤", en: "Errors", ja: "エラー",
  },
  "issue.dashboard.warnings": {
    "zh-TW": "警告", en: "Warnings", ja: "警告",
  },
  "issue.dashboard.infos": {
    "zh-TW": "提示", en: "Notices", ja: "通知",
  },
  "issue.dashboard.errorCallout": {
    "zh-TW": "點上方紅框查看 — 可能影響演奏者讀譜或無法演奏",
    en: "Click red box above — may affect playability or be unperformable",
    ja: "上の赤枠をクリック — 演奏可能性に影響する可能性があります",
  },
  "issue.dashboard.allCleanArranged": {
    "zh-TW": "改編品質良好 — 可演奏性檢查全部通過",
    en: "Arrangement is clean — all playability checks passed",
    ja: "編曲は良好 — 演奏可能性チェックすべて合格",
  },
  "issue.dashboard.allCleanAnalysis": {
    "zh-TW": "原譜分析無問題",
    en: "Source has no issues",
    ja: "原譜に問題はありません",
  },
  "issue.noneOfType": {
    "zh-TW": "無此類問題",
    en: "No issues of this kind",
    ja: "この種類の問題はありません",
  },
  "issue.applyFromAnalysis": {
    "zh-TW": "此問題來自分析報告 (source),無法直接套用,請先改編",
    en: "This issue comes from the analysis report (source) and cannot be "
      + "applied directly — arrange first",
    ja: "この問題は分析レポート (source) に由来するため直接適用できません — "
      + "先に編曲してください",
  },
  "issue.applying": {
    "zh-TW": "套用 {code}...",
    en: "Applying {code}...",
    ja: "{code} を適用中...",
  },
  "issue.applyFailed": {
    "zh-TW": "套用失敗",
    en: "Apply failed",
    ja: "適用に失敗しました",
  },
  "issue.suggestionTip": {
    "zh-TW": "hover 預覽 / 點擊套用 {code}",
    en: "Hover to preview / click to apply {code}",
    ja: "ホバーでプレビュー / クリックで {code} を適用",
  },
  "issue.suggestionDisabled": {
    "zh-TW": "需先執行改編才可套用建議",
    en: "Arrange first to apply suggestions",
    ja: "提案を適用するには先に編曲してください",
  },
  "issue.explainFailed": {
    "zh-TW": "AI 解讀失敗",
    en: "AI explanation failed",
    ja: "AI による説明に失敗しました",
  },
  "issue.explainLoading": {
    "zh-TW": "AI 解讀中...",
    en: "AI explaining...",
    ja: "AI が説明中...",
  },
  "issue.explainCollapse": {
    "zh-TW": "收起解讀",
    en: "Collapse explanation",
    ja: "説明を折りたたむ",
  },
  "issue.explainButton": {
    "zh-TW": "💡 AI 解讀",
    en: "💡 AI explanation",
    ja: "💡 AI 解説",
  },
  "issue.recommendPrefix": {
    "zh-TW": "建議",
    en: "Recommended:",
    ja: "おすすめ:",
  },

  // issue code → 簡短群組標題
  "issue.short.E_PITCH_BELOW_RANGE": {
    "zh-TW": "音域過低",
    en: "Pitch below range",
    ja: "音域より低い",
  },
  "issue.short.E_PITCH_ABOVE_RANGE": {
    "zh-TW": "音域過高",
    en: "Pitch above range",
    ja: "音域より高い",
  },
  "issue.short.E_STRING_CHORD_EXCEED": {
    "zh-TW": "和弦音數超過上限",
    en: "Chord exceeds note limit",
    ja: "和音の音数が上限超過",
  },
  "issue.short.E_NOTE_BELOW_STRING": {
    "zh-TW": "音低於該弦",
    en: "Note below the string",
    ja: "弦より低い音",
  },
  "issue.short.E_NON_ADJACENT_STRINGS": {
    "zh-TW": "跨非相鄰弦",
    en: "Non-adjacent strings",
    ja: "非隣接の弦",
  },
  "issue.short.E_VIOLIN_FRET_TOO_HIGH": {
    "zh-TW": "小提琴把位過高",
    en: "Violin position too high",
    ja: "ヴァイオリンのポジションが高すぎる",
  },
  "issue.short.E_VIOLIN_STRETCH_EXCEED": {
    "zh-TW": "小提琴伸展超限",
    en: "Violin stretch exceeded",
    ja: "ヴァイオリンの指の開き超過",
  },
  "issue.short.E_VIOLA_FRET_TOO_HIGH": {
    "zh-TW": "中提琴把位過高",
    en: "Viola position too high",
    ja: "ヴィオラのポジションが高すぎる",
  },
  "issue.short.E_VIOLA_STRETCH_EXCEED": {
    "zh-TW": "中提琴伸展超限",
    en: "Viola stretch exceeded",
    ja: "ヴィオラの指の開き超過",
  },
  "issue.short.E_CELLO_FRET_TOO_HIGH": {
    "zh-TW": "大提琴把位過高",
    en: "Cello position too high",
    ja: "チェロのポジションが高すぎる",
  },
  "issue.short.E_CELLO_STRETCH_EXCEED": {
    "zh-TW": "大提琴伸展超限",
    en: "Cello stretch exceeded",
    ja: "チェロの指の開き超過",
  },
  "issue.short.E_MONOPHONIC_CHORD": {
    "zh-TW": "單音樂器奏和弦",
    en: "Chord on a monophonic instrument",
    ja: "単音楽器での和音",
  },
  "issue.short.E_PIANO_HAND_SPAN": {
    "zh-TW": "鋼琴單手跨距超限",
    en: "Piano hand span exceeded",
    ja: "ピアノの片手の開き超過",
  },
  "issue.short.E_PIANO_HAND_SPAN_EXCEED": {
    "zh-TW": "鋼琴單手跨距超限",
    en: "Piano hand span exceeded",
    ja: "ピアノの片手の開き超過",
  },
  "issue.short.W_PITCH_OUT_OF_COMFORTABLE": {
    "zh-TW": "超出舒適音域",
    en: "Outside comfortable range",
    ja: "快適な音域を超過",
  },
  "issue.short.W_PITCH_EXTREME": {
    "zh-TW": "接近極限音域",
    en: "Near extreme range",
    ja: "音域の限界付近",
  },
  "issue.short.W_VIOLIN_STRETCH_LARGE": {
    "zh-TW": "小提琴伸展偏大",
    en: "Large violin stretch",
    ja: "ヴァイオリンの指の開きが大きい",
  },
  "issue.short.W_VIOLA_STRETCH_LARGE": {
    "zh-TW": "中提琴伸展偏大",
    en: "Large viola stretch",
    ja: "ヴィオラの指の開きが大きい",
  },
  "issue.short.W_CELLO_STRETCH_LARGE": {
    "zh-TW": "大提琴伸展偏大",
    en: "Large cello stretch",
    ja: "チェロの指の開きが大きい",
  },
  "issue.short.W_PIANO_HAND_SPAN_LARGE": {
    "zh-TW": "鋼琴單手跨距偏大",
    en: "Large piano hand span",
    ja: "ピアノの片手の開きが大きい",
  },
  "issue.short.W_VIOLIN_TRIPLE_QUAD_STOP": {
    "zh-TW": "小提琴三/四音和弦",
    en: "Violin triple/quadruple stop",
    ja: "ヴァイオリンの3重音/4重音",
  },
  "issue.short.W_VIOLA_TRIPLE_QUAD_STOP": {
    "zh-TW": "中提琴三/四音和弦",
    en: "Viola triple/quadruple stop",
    ja: "ヴィオラの3重音/4重音",
  },
  "issue.short.W_CELLO_TRIPLE_QUAD_STOP": {
    "zh-TW": "大提琴三/四音和弦",
    en: "Cello triple/quadruple stop",
    ja: "チェロの3重音/4重音",
  },
  "issue.short.W_PARALLEL_FIFTHS": {
    "zh-TW": "平行五度",
    en: "Parallel fifths",
    ja: "平行5度",
  },
  "issue.short.W_PARALLEL_OCTAVES": {
    "zh-TW": "平行八度",
    en: "Parallel octaves",
    ja: "平行8度",
  },
  "issue.short.E_HARP_SAME_STRING": {
    "zh-TW": "豎琴同弦撞音",
    en: "Harp same-string clash",
    ja: "ハープの同一弦の衝突",
  },
  "issue.short.E_HARP_TOO_MANY_NOTES": {
    "zh-TW": "豎琴和弦音數超限",
    en: "Harp chord exceeds note limit",
    ja: "ハープ和音の音数が上限超過",
  },
  "issue.short.W_HARP_WIDE_SPAN": {
    "zh-TW": "豎琴和弦跨度過寬",
    en: "Wide harp chord span",
    ja: "ハープ和音の幅が広すぎる",
  },
  "issue.short.E_FRETTED_CHORD_INFEASIBLE": {
    "zh-TW": "和弦無可行指法",
    en: "Chord has no feasible fingering",
    ja: "和音に実行可能な運指がない",
  },
  "issue.short.E_FRETTED_FRET_TOO_HIGH": {
    "zh-TW": "把位過高",
    en: "Position too high",
    ja: "ポジションが高すぎる",
  },
  "issue.short.W_FRETTED_STRETCH_LARGE": {
    "zh-TW": "把位伸展偏大",
    en: "Large stretch",
    ja: "指の開きが大きい",
  },
  "issue.short.W_FRETTED_HIGH_POSITION": {
    "zh-TW": "高把位",
    en: "High position",
    ja: "高ポジション",
  },
  // 0.1.31 樂理深化 — 隱伏五/八 / 導音 / 撥弦跳把位
  "issue.short.W_HIDDEN_FIFTHS": {
    "zh-TW": "隱伏五度",
    en: "Hidden fifths",
    ja: "隠伏5度",
  },
  "issue.short.W_HIDDEN_OCTAVES": {
    "zh-TW": "隱伏八度",
    en: "Hidden octaves",
    ja: "隠伏8度",
  },
  "issue.short.W_UNRESOLVED_LEADING_TONE": {
    "zh-TW": "導音未解決",
    en: "Unresolved leading tone",
    ja: "導音が解決していない",
  },
  "issue.short.W_UNRESOLVED_CHORD7TH": {
    "zh-TW": "V7 七度未解決",
    en: "Unresolved chord 7th",
    ja: "V7 七度が解決していない",
  },
  "issue.short.E_FRETTED_POSITION_JUMP_TOO_FAST": {
    "zh-TW": "撥弦把位跳躍過快",
    en: "Fretted position jump too fast",
    ja: "撥弦のポジション移動が速すぎる",
  },
  "issue.short.W_FRETTED_POSITION_JUMP_DIFFICULT": {
    "zh-TW": "撥弦把位跳躍偏難",
    en: "Fretted position jump difficult",
    ja: "撥弦のポジション移動が難しい",
  },
  // 0.1.32 老師評語層
  "explanation.title": {
    "zh-TW": "改編說明",
    en: "Arrangement Explanation",
    ja: "編曲解説",
  },
  "explanation.preserved": {
    "zh-TW": "保留",
    en: "Preserved",
    ja: "保持",
  },
  "explanation.changed": {
    "zh-TW": "改動",
    en: "Changed",
    ja: "変更",
  },
  "explanation.cost": {
    "zh-TW": "音樂代價",
    en: "Musical cost",
    ja: "音楽的代償",
  },
  // 0.1.32 難度因子拆解
  "difficulty.factor.range": {
    "zh-TW": "音域",
    en: "Range",
    ja: "音域",
  },
  "difficulty.factor.density": {
    "zh-TW": "密度",
    en: "Density",
    ja: "密度",
  },
  "difficulty.factor.chord": {
    "zh-TW": "和弦",
    en: "Chord",
    ja: "和音",
  },
  "difficulty.factor.rhythm": {
    "zh-TW": "節奏",
    en: "Rhythm",
    ja: "リズム",
  },
  "difficulty.factor.technique": {
    "zh-TW": "技巧",
    en: "Technique",
    ja: "技術",
  },
  "difficulty.whyHard": {
    "zh-TW": "為什麼難",
    en: "Why hard",
    ja: "難しい理由",
  },

  // suggestion code → 人類標籤 (按鈕 + LLM 解讀)
  "issue.suggestion.S_OMIT_NOTE": {
    "zh-TW": "省略此音",
    en: "Omit this note",
    ja: "この音を省略",
  },
  "issue.suggestion.S_OMIT_INNER_VOICE": {
    "zh-TW": "省略內聲部音",
    en: "Omit inner voice",
    ja: "内声部の音を省略",
  },
  "issue.suggestion.S_OCTAVE_UP": {
    "zh-TW": "上移八度",
    en: "Octave up",
    ja: "1オクターヴ上げる",
  },
  "issue.suggestion.S_OCTAVE_DOWN": {
    "zh-TW": "下移八度",
    en: "Octave down",
    ja: "1オクターヴ下げる",
  },
  "issue.suggestion.S_OCTAVE_TRANSPOSE_OUTER": {
    "zh-TW": "外聲部移八度",
    en: "Transpose outer voice an octave",
    ja: "外声部を1オクターヴ移調",
  },
  "issue.suggestion.S_REDISTRIBUTE_HANDS": {
    "zh-TW": "重新分配左右手",
    en: "Redistribute between hands",
    ja: "左右の手に再配分",
  },
  "issue.suggestion.S_SPLIT_TO_PARTS": {
    "zh-TW": "拆分到其他聲部",
    en: "Split to other parts",
    ja: "他の声部に分割",
  },
  "issue.suggestion.S_REVOICE_PASSAGE": {
    "zh-TW": "重配整段聲位",
    en: "Revoice the passage",
    ja: "パッセージ全体を再配置",
  },
  "issue.suggestion.S_RESPELL_ENHARMONIC": {
    "zh-TW": "改用等音記法",
    en: "Respell enharmonically",
    ja: "異名同音で書き換え",
  },

  // ── RepairTimeline ──────────────────────────────────────────────────────
  "repair.noRepairNeeded": {
    "zh-TW": "修復迴圈: 無需修復 (改編結果已無可演奏性問題)",
    en: "Repair loop: no repair needed (arrangement has no playability "
      + "issues)",
    ja: "修復ループ: 修復は不要です (編曲結果に演奏可能性の問題はありません)",
  },
  "repair.timelineTitle": {
    "zh-TW": "修復時間軸",
    en: "Repair timeline",
    ja: "修復タイムライン",
  },
  "repair.converged": {
    "zh-TW": "✓ {steps} 步收斂 · 嚴重度 −{pct}%",
    en: "✓ Converged in {steps} steps · severity −{pct}%",
    ja: "✓ {steps} ステップで収束 · 重大度 −{pct}%",
  },
  "repair.notConverged": {
    "zh-TW": "⚠ {steps} 步未完全收斂",
    en: "⚠ {steps} steps, not fully converged",
    ja: "⚠ {steps} ステップ、完全には収束していません",
  },
  "repair.viewingFinal": {
    "zh-TW": "檢視: 最終結果",
    en: "Viewing: final result",
    ja: "表示中: 最終結果",
  },
  "repair.viewingStep": {
    "zh-TW": "檢視: 第 {step} 步",
    en: "Viewing: step {step}",
    ja: "表示中: ステップ {step}",
  },
  "repair.qualityPrefix": { "zh-TW": "品質", en: "Quality", ja: "品質" },
  "repair.qualityMelody": { "zh-TW": "旋律", en: "Melody", ja: "旋律" },
  "repair.qualityHarmony": { "zh-TW": "和聲", en: "Harmony", ja: "和声" },
  "repair.qualityPlayability": {
    "zh-TW": "可演奏",
    en: "Playability",
    ja: "演奏可能性",
  },
  "repair.stepTick": {
    "zh-TW": "第 {step} 步: {code}",
    en: "Step {step}: {code}",
    ja: "ステップ {step}: {code}",
  },
  "repair.noStrategyShort": {
    "zh-TW": "(無策略)",
    en: "(no strategy)",
    ja: "(戦略なし)",
  },
  "repair.finalTick": {
    "zh-TW": "最終結果",
    en: "Final result",
    ja: "最終結果",
  },
  "repair.stepLabel": {
    "zh-TW": "第 {step} 步",
    en: "Step {step}",
    ja: "ステップ {step}",
  },
  "repair.repairedCodePrefix": {
    "zh-TW": "修復",
    en: "Repaired",
    ja: "修復済み",
  },
  "repair.strategyLabel": { "zh-TW": "策略:", en: "Strategy:", ja: "戦略:" },
  "repair.noStrategy": {
    "zh-TW": "(無策略可用 — 標為人工處理)",
    en: "(no strategy available — flagged for manual handling)",
    ja: "(利用可能な戦略なし — 手動対応としてマーク)",
  },
  "repair.severityLabel": {
    "zh-TW": "嚴重度",
    en: "Severity",
    ja: "重大度",
  },

  // ── QualityBadge ────────────────────────────────────────────────────────
  // 標籤掛在 24px ring 下方, 必須短 (≤ 4 字元 / 半形 ≤ 6) 才不會壓垮 ring
  // 容器寬度. 完整文字走 tooltip (quality.tip*).
  "quality.label": { "zh-TW": "品質", en: "Quality", ja: "品質" },
  "quality.melody": { "zh-TW": "旋律", en: "Mel", ja: "旋律" },
  "quality.harmony": { "zh-TW": "和聲", en: "Harm", ja: "和声" },
  "quality.playability": {
    "zh-TW": "演奏",
    en: "Play",
    ja: "演奏",
  },
  "quality.tipOverall": {
    "zh-TW": "整體 {score} / 100",
    en: "Overall {score} / 100",
    ja: "総合 {score} / 100",
  },
  "quality.tipMelody": {
    "zh-TW": "主旋律保留 {pct}%",
    en: "Melody preservation {pct}%",
    ja: "旋律保持 {pct}%",
  },
  "quality.tipHarmony": {
    "zh-TW": "和聲完整度 {pct}%",
    en: "Harmony completeness {pct}%",
    ja: "和声の完全性 {pct}%",
  },
  "quality.tipPlayability": {
    "zh-TW": "可演奏性 {pct}%",
    en: "Playability {pct}%",
    ja: "演奏可能性 {pct}%",
  },
  "quality.tipIssues": {
    "zh-TW": "error={error}, warning={warning}",
    en: "error={error}, warning={warning}",
    ja: "error={error}, warning={warning}",
  },

  // ── AssignmentsPanel ────────────────────────────────────────────────────
  "assign.title": {
    "zh-TW": "聲部分配 ({n})",
    en: "Part assignments ({n})",
    ja: "声部の割り当て ({n})",
  },
  "assign.reassigning": {
    "zh-TW": "重新分配 {part}...",
    en: "Reassigning {part}...",
    ja: "{part} を再割り当て中...",
  },
  "assign.reassignFailed": {
    "zh-TW": "重新分配失敗",
    en: "Reassignment failed",
    ja: "再割り当てに失敗しました",
  },
  "assign.difficultyTip": {
    "zh-TW": "各演奏者最高難度. 1=初級, 5=職業",
    en: "Highest difficulty per player. 1=beginner, 5=professional",
    ja: "各奏者の最高難易度。1=初級、5=プロ",
  },
  "assign.dragHint": {
    "zh-TW": "拖曳到另一列以重新分配到該演奏者",
    en: "Drag to another row to reassign to that player",
    ja: "別の行にドラッグするとその奏者に再割り当てされます",
  },
  "assign.difficultyBadgeTip": {
    "zh-TW": "{name} — {label} ({score} / 5)",
    en: "{name} — {label} ({score} / 5)",
    ja: "{name} — {label} ({score} / 5)",
  },

  // ── AnalyzePanel ────────────────────────────────────────────────────────
  "analyzePanel.empty": {
    "zh-TW": "(尚未執行分析 — 點上方「分析」按鈕)",
    en: "(No analysis yet — click the “Analyze” button above)",
    ja: "(分析はまだ実行されていません — 上の「分析」ボタンをクリック)",
  },
  "analyzePanel.movements": { "zh-TW": "樂章:", en: "Movements:", ja: "楽章:" },
  "analyzePanel.measures": { "zh-TW": "小節:", en: "Measures:", ja: "小節:" },
  "analyzePanel.parts": { "zh-TW": "聲部:", en: "Parts:", ja: "声部:" },
  "analyzePanel.validation": {
    "zh-TW": "驗證:",
    en: "Validation:",
    ja: "検証:",
  },
  "analyzePanel.validationOk": {
    "zh-TW": "✓ 通過",
    en: "✓ Passed",
    ja: "✓ 合格",
  },
  "analyzePanel.validationFail": {
    "zh-TW": "✗ 有錯誤",
    en: "✗ Has errors",
    ja: "✗ エラーあり",
  },
  "analyzePanel.validationWarnings": {
    "zh-TW": "({n} warnings)",
    en: "({n} warnings)",
    ja: "(警告 {n} 件)",
  },
  "analyzePanel.phraseBoundaries": {
    "zh-TW": "樂句邊界",
    en: "Phrase boundaries",
    ja: "楽句の境界",
  },
  "analyzePanel.phraseJump": {
    "zh-TW": "點選跳到 m.{m} (confidence {conf})",
    en: "Click to jump to m.{m} (confidence {conf})",
    ja: "クリックで m.{m} へ移動 (確信度 {conf})",
  },
  "analyzePanel.partList": {
    "zh-TW": "聲部清單",
    en: "Part list",
    ja: "声部一覧",
  },

  // ── SectionNavigator ────────────────────────────────────────────────────
  "section.navLabel": { "zh-TW": "導航:", en: "Navigate:", ja: "ナビ:" },
  "section.sectionsOption": {
    "zh-TW": "段落 →",
    en: "Section →",
    ja: "セクション →",
  },
  "section.marksOption": {
    "zh-TW": "排練記號 →",
    en: "Rehearsal mark →",
    ja: "リハーサルマーク →",
  },
  "section.totalMeasures": {
    "zh-TW": "全 {n} 小節",
    en: "{n} measures total",
    ja: "全 {n} 小節",
  },

  // ── FingerboardSimulator ────────────────────────────────────────────────
  "fingerboard.instrument.violin": {
    "zh-TW": "小提琴",
    en: "Violin",
    ja: "ヴァイオリン",
  },
  "fingerboard.instrument.viola": {
    "zh-TW": "中提琴",
    en: "Viola",
    ja: "ヴィオラ",
  },
  "fingerboard.instrument.cello": {
    "zh-TW": "大提琴",
    en: "Cello",
    ja: "チェロ",
  },
  "fingerboard.titleSuffix": {
    "zh-TW": "指板模擬",
    en: " fingerboard simulation",
    ja: "の指板シミュレーション",
  },
  "fingerboard.conflictDetected": {
    "zh-TW": "✗ 偵測到演奏衝突",
    en: "✗ Playing conflict detected",
    ja: "✗ 演奏上の衝突を検出",
  },
  "fingerboard.playable": {
    "zh-TW": "✓ 可演奏",
    en: "✓ Playable",
    ja: "✓ 演奏可能",
  },
  "fingerboard.comfortLimit": {
    "zh-TW": "舒適界",
    en: "Comfort limit",
    ja: "快適な限界",
  },
  "fingerboard.noteOutOfRange": {
    "zh-TW": "{note} 超出可演奏音域",
    en: "{note} is outside the playable range",
    ja: "{note} は演奏可能な音域を超えています",
  },
  "fingerboard.conflictSameString": {
    "zh-TW": "兩個音被迫在同一根弦 — 無法同時按下發聲",
    en: "Two notes forced onto the same string — cannot sound together",
    ja: "2つの音が同じ弦に押し込まれています — 同時に鳴らせません",
  },
  "fingerboard.conflictNonAdjacent": {
    "zh-TW": "使用了不相鄰的弦 — 弓無法同時拉到",
    en: "Non-adjacent strings used — the bow cannot reach both at once",
    ja: "隣接しない弦が使われています — 弓が同時に届きません",
  },
  "fingerboard.conflictOutOfRange": {
    "zh-TW": "有音超出指板可演奏範圍",
    en: "A note is outside the playable fingerboard range",
    ja: "指板の演奏可能範囲を超える音があります",
  },
  "fingerboard.sourceEngine": {
    "zh-TW": "(引擎 viterbi)",
    en: "(engine viterbi)",
    ja: "(エンジン Viterbi)",
  },
  "fingerboard.sourceFallback": {
    "zh-TW": "(前端 greedy fallback)",
    en: "(frontend greedy fallback)",
    ja: "(フロントエンド greedy フォールバック)",
  },
  "fingerboard.conflictHighPosition": {
    "zh-TW": "部分音在高把位 — 技術難度較高",
    en: "Some notes are in a high position — more technically demanding",
    ja: "一部の音が高ポジションにあります — 技術的な難易度が高めです",
  },
};

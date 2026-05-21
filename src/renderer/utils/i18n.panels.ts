import type { BiDict } from "./i18n";

/**
 * 資訊面板字串 — IssuePanel / RepairTimeline / QualityBadge /
 * AssignmentsPanel / AnalyzePanel / SectionNavigator / FingerboardSimulator。
 */
export const PANEL_STRINGS: BiDict = {
  // ── IssuePanel ──────────────────────────────────────────────────────────
  "issue.severityError": { "zh-TW": "錯誤", en: "Errors" },
  "issue.severityWarning": { "zh-TW": "警告", en: "Warnings" },
  "issue.severityInfo": { "zh-TW": "提示", en: "Notices" },
  "issue.emptyState": {
    "zh-TW": "(尚未執行分析或改編)",
    en: "(No analysis or arrangement yet)",
  },
  "issue.summaryArranged": {
    "zh-TW": "改編結果 — 🔴 {error} 錯誤 · 🟡 {warning} 警告 · "
      + "🟢 {info} 提示 (點建議可直接套用)",
    en: "Arrangement — 🔴 {error} errors · 🟡 {warning} warnings · "
      + "🟢 {info} notices (click a suggestion to apply)",
  },
  "issue.summaryAnalysis": {
    "zh-TW": "分析報告 — 🔴 {error} 錯誤 · 🟡 {warning} 警告 · "
      + "🟢 {info} 提示 (改編後可套用建議)",
    en: "Analysis report — 🔴 {error} errors · 🟡 {warning} warnings · "
      + "🟢 {info} notices (suggestions apply after arranging)",
  },
  "issue.noneOfType": { "zh-TW": "無此類問題", en: "No issues of this kind" },
  "issue.applyFromAnalysis": {
    "zh-TW": "此問題來自分析報告 (source),無法直接套用,請先改編",
    en: "This issue comes from the analysis report (source) and cannot be "
      + "applied directly — arrange first",
  },
  "issue.applying": { "zh-TW": "套用 {code}...", en: "Applying {code}..." },
  "issue.applyFailed": { "zh-TW": "套用失敗", en: "Apply failed" },
  "issue.suggestionTip": {
    "zh-TW": "hover 預覽 / 點擊套用 {code}",
    en: "Hover to preview / click to apply {code}",
  },
  "issue.suggestionDisabled": {
    "zh-TW": "需先執行改編才可套用建議",
    en: "Arrange first to apply suggestions",
  },
  "issue.explainFailed": { "zh-TW": "AI 解讀失敗", en: "AI explanation failed" },
  "issue.explainLoading": {
    "zh-TW": "AI 解讀中...",
    en: "AI explaining...",
  },
  "issue.explainCollapse": { "zh-TW": "收起解讀", en: "Collapse explanation" },
  "issue.explainButton": { "zh-TW": "💡 AI 解讀", en: "💡 AI explanation" },
  "issue.recommendPrefix": { "zh-TW": "建議", en: "Recommended:" },

  // issue code → 簡短群組標題
  "issue.short.E_PITCH_BELOW_RANGE": {
    "zh-TW": "音域過低",
    en: "Pitch below range",
  },
  "issue.short.E_PITCH_ABOVE_RANGE": {
    "zh-TW": "音域過高",
    en: "Pitch above range",
  },
  "issue.short.E_STRING_CHORD_EXCEED": {
    "zh-TW": "和弦音數超過上限",
    en: "Chord exceeds note limit",
  },
  "issue.short.E_NOTE_BELOW_STRING": {
    "zh-TW": "音低於該弦",
    en: "Note below the string",
  },
  "issue.short.E_NON_ADJACENT_STRINGS": {
    "zh-TW": "跨非相鄰弦",
    en: "Non-adjacent strings",
  },
  "issue.short.E_VIOLIN_FRET_TOO_HIGH": {
    "zh-TW": "小提琴把位過高",
    en: "Violin position too high",
  },
  "issue.short.E_VIOLIN_STRETCH_EXCEED": {
    "zh-TW": "小提琴伸展超限",
    en: "Violin stretch exceeded",
  },
  "issue.short.E_VIOLA_FRET_TOO_HIGH": {
    "zh-TW": "中提琴把位過高",
    en: "Viola position too high",
  },
  "issue.short.E_VIOLA_STRETCH_EXCEED": {
    "zh-TW": "中提琴伸展超限",
    en: "Viola stretch exceeded",
  },
  "issue.short.E_CELLO_FRET_TOO_HIGH": {
    "zh-TW": "大提琴把位過高",
    en: "Cello position too high",
  },
  "issue.short.E_CELLO_STRETCH_EXCEED": {
    "zh-TW": "大提琴伸展超限",
    en: "Cello stretch exceeded",
  },
  "issue.short.E_MONOPHONIC_CHORD": {
    "zh-TW": "單音樂器奏和弦",
    en: "Chord on a monophonic instrument",
  },
  "issue.short.E_PIANO_HAND_SPAN": {
    "zh-TW": "鋼琴單手跨距超限",
    en: "Piano hand span exceeded",
  },
  "issue.short.E_PIANO_HAND_SPAN_EXCEED": {
    "zh-TW": "鋼琴單手跨距超限",
    en: "Piano hand span exceeded",
  },
  "issue.short.W_PITCH_OUT_OF_COMFORTABLE": {
    "zh-TW": "超出舒適音域",
    en: "Outside comfortable range",
  },
  "issue.short.W_PITCH_EXTREME": {
    "zh-TW": "接近極限音域",
    en: "Near extreme range",
  },
  "issue.short.W_VIOLIN_STRETCH_LARGE": {
    "zh-TW": "小提琴伸展偏大",
    en: "Large violin stretch",
  },
  "issue.short.W_VIOLA_STRETCH_LARGE": {
    "zh-TW": "中提琴伸展偏大",
    en: "Large viola stretch",
  },
  "issue.short.W_CELLO_STRETCH_LARGE": {
    "zh-TW": "大提琴伸展偏大",
    en: "Large cello stretch",
  },
  "issue.short.W_PIANO_HAND_SPAN_LARGE": {
    "zh-TW": "鋼琴單手跨距偏大",
    en: "Large piano hand span",
  },
  "issue.short.W_VIOLIN_TRIPLE_QUAD_STOP": {
    "zh-TW": "小提琴三/四音和弦",
    en: "Violin triple/quadruple stop",
  },
  "issue.short.W_VIOLA_TRIPLE_QUAD_STOP": {
    "zh-TW": "中提琴三/四音和弦",
    en: "Viola triple/quadruple stop",
  },
  "issue.short.W_CELLO_TRIPLE_QUAD_STOP": {
    "zh-TW": "大提琴三/四音和弦",
    en: "Cello triple/quadruple stop",
  },
  "issue.short.W_PARALLEL_FIFTHS": {
    "zh-TW": "平行五度",
    en: "Parallel fifths",
  },
  "issue.short.W_PARALLEL_OCTAVES": {
    "zh-TW": "平行八度",
    en: "Parallel octaves",
  },

  // suggestion code → 人類標籤 (按鈕 + LLM 解讀)
  "issue.suggestion.S_OMIT_NOTE": { "zh-TW": "省略此音", en: "Omit this note" },
  "issue.suggestion.S_OMIT_INNER_VOICE": {
    "zh-TW": "省略內聲部音",
    en: "Omit inner voice",
  },
  "issue.suggestion.S_OCTAVE_UP": { "zh-TW": "上移八度", en: "Octave up" },
  "issue.suggestion.S_OCTAVE_DOWN": { "zh-TW": "下移八度", en: "Octave down" },
  "issue.suggestion.S_OCTAVE_TRANSPOSE_OUTER": {
    "zh-TW": "外聲部移八度",
    en: "Transpose outer voice an octave",
  },
  "issue.suggestion.S_REDISTRIBUTE_HANDS": {
    "zh-TW": "重新分配左右手",
    en: "Redistribute between hands",
  },
  "issue.suggestion.S_SPLIT_TO_PARTS": {
    "zh-TW": "拆分到其他聲部",
    en: "Split to other parts",
  },
  "issue.suggestion.S_REVOICE_PASSAGE": {
    "zh-TW": "重配整段聲位",
    en: "Revoice the passage",
  },

  // ── RepairTimeline ──────────────────────────────────────────────────────
  "repair.noRepairNeeded": {
    "zh-TW": "修復迴圈: 無需修復 (改編結果已無可演奏性問題)",
    en: "Repair loop: no repair needed (arrangement has no playability "
      + "issues)",
  },
  "repair.timelineTitle": { "zh-TW": "修復時間軸", en: "Repair timeline" },
  "repair.converged": {
    "zh-TW": "✓ {steps} 步收斂 · 嚴重度 −{pct}%",
    en: "✓ Converged in {steps} steps · severity −{pct}%",
  },
  "repair.notConverged": {
    "zh-TW": "⚠ {steps} 步未完全收斂",
    en: "⚠ {steps} steps, not fully converged",
  },
  "repair.viewingFinal": {
    "zh-TW": "檢視: 最終結果",
    en: "Viewing: final result",
  },
  "repair.viewingStep": {
    "zh-TW": "檢視: 第 {step} 步",
    en: "Viewing: step {step}",
  },
  "repair.qualityPrefix": { "zh-TW": "品質", en: "Quality" },
  "repair.qualityMelody": { "zh-TW": "旋律", en: "Melody" },
  "repair.qualityHarmony": { "zh-TW": "和聲", en: "Harmony" },
  "repair.qualityPlayability": { "zh-TW": "可演奏", en: "Playability" },
  "repair.stepTick": {
    "zh-TW": "第 {step} 步: {code}",
    en: "Step {step}: {code}",
  },
  "repair.noStrategyShort": { "zh-TW": "(無策略)", en: "(no strategy)" },
  "repair.finalTick": { "zh-TW": "最終結果", en: "Final result" },
  "repair.stepLabel": { "zh-TW": "第 {step} 步", en: "Step {step}" },
  "repair.repairedCodePrefix": { "zh-TW": "修復", en: "Repaired" },
  "repair.strategyLabel": { "zh-TW": "策略:", en: "Strategy:" },
  "repair.noStrategy": {
    "zh-TW": "(無策略可用 — 標為人工處理)",
    en: "(no strategy available — flagged for manual handling)",
  },
  "repair.severityLabel": { "zh-TW": "嚴重度", en: "Severity" },

  // ── QualityBadge ────────────────────────────────────────────────────────
  "quality.label": { "zh-TW": "品質", en: "Quality" },
  "quality.melody": { "zh-TW": "旋律", en: "Melody" },
  "quality.harmony": { "zh-TW": "和聲", en: "Harmony" },
  "quality.playability": { "zh-TW": "演奏性", en: "Playability" },
  "quality.tipOverall": {
    "zh-TW": "整體 {score} / 100",
    en: "Overall {score} / 100",
  },
  "quality.tipMelody": {
    "zh-TW": "主旋律保留 {pct}%",
    en: "Melody preservation {pct}%",
  },
  "quality.tipHarmony": {
    "zh-TW": "和聲完整度 {pct}%",
    en: "Harmony completeness {pct}%",
  },
  "quality.tipPlayability": {
    "zh-TW": "可演奏性 {pct}%",
    en: "Playability {pct}%",
  },
  "quality.tipIssues": {
    "zh-TW": "error={error}, warning={warning}",
    en: "error={error}, warning={warning}",
  },

  // ── AssignmentsPanel ────────────────────────────────────────────────────
  "assign.title": { "zh-TW": "聲部分配 ({n})", en: "Part assignments ({n})" },
  "assign.reassigning": {
    "zh-TW": "重新分配 {part}...",
    en: "Reassigning {part}...",
  },
  "assign.reassignFailed": {
    "zh-TW": "重新分配失敗",
    en: "Reassignment failed",
  },
  "assign.difficultyTip": {
    "zh-TW": "各演奏者最高難度. 1=初級, 5=職業",
    en: "Highest difficulty per player. 1=beginner, 5=professional",
  },
  "assign.dragHint": {
    "zh-TW": "拖曳到另一列以重新分配到該演奏者",
    en: "Drag to another row to reassign to that player",
  },
  "assign.difficultyBadgeTip": {
    "zh-TW": "{name} — {label} ({score} / 5)",
    en: "{name} — {label} ({score} / 5)",
  },

  // ── AnalyzePanel ────────────────────────────────────────────────────────
  "analyzePanel.empty": {
    "zh-TW": "(尚未執行分析 — 點上方「分析」按鈕)",
    en: "(No analysis yet — click the “Analyze” button above)",
  },
  "analyzePanel.movements": { "zh-TW": "樂章:", en: "Movements:" },
  "analyzePanel.measures": { "zh-TW": "小節:", en: "Measures:" },
  "analyzePanel.parts": { "zh-TW": "聲部:", en: "Parts:" },
  "analyzePanel.validation": { "zh-TW": "驗證:", en: "Validation:" },
  "analyzePanel.validationOk": { "zh-TW": "✓ 通過", en: "✓ Passed" },
  "analyzePanel.validationFail": { "zh-TW": "✗ 有錯誤", en: "✗ Has errors" },
  "analyzePanel.validationWarnings": {
    "zh-TW": "({n} warnings)",
    en: "({n} warnings)",
  },
  "analyzePanel.phraseBoundaries": {
    "zh-TW": "樂句邊界",
    en: "Phrase boundaries",
  },
  "analyzePanel.phraseJump": {
    "zh-TW": "點選跳到 m.{m} (confidence {conf})",
    en: "Click to jump to m.{m} (confidence {conf})",
  },
  "analyzePanel.partList": { "zh-TW": "聲部清單", en: "Part list" },

  // ── SectionNavigator ────────────────────────────────────────────────────
  "section.navLabel": { "zh-TW": "導航:", en: "Navigate:" },
  "section.sectionsOption": { "zh-TW": "段落 →", en: "Section →" },
  "section.marksOption": { "zh-TW": "排練記號 →", en: "Rehearsal mark →" },
  "section.totalMeasures": {
    "zh-TW": "全 {n} 小節",
    en: "{n} measures total",
  },

  // ── FingerboardSimulator ────────────────────────────────────────────────
  "fingerboard.instrument.violin": { "zh-TW": "小提琴", en: "Violin" },
  "fingerboard.instrument.viola": { "zh-TW": "中提琴", en: "Viola" },
  "fingerboard.instrument.cello": { "zh-TW": "大提琴", en: "Cello" },
  "fingerboard.titleSuffix": {
    "zh-TW": "指板模擬",
    en: " fingerboard simulation",
  },
  "fingerboard.conflictDetected": {
    "zh-TW": "✗ 偵測到演奏衝突",
    en: "✗ Playing conflict detected",
  },
  "fingerboard.playable": { "zh-TW": "✓ 可演奏", en: "✓ Playable" },
  "fingerboard.comfortLimit": { "zh-TW": "舒適界", en: "Comfort limit" },
  "fingerboard.noteOutOfRange": {
    "zh-TW": "{note} 超出可演奏音域",
    en: "{note} is outside the playable range",
  },
  "fingerboard.conflictSameString": {
    "zh-TW": "兩個音被迫在同一根弦 — 無法同時按下發聲",
    en: "Two notes forced onto the same string — cannot sound together",
  },
  "fingerboard.conflictNonAdjacent": {
    "zh-TW": "使用了不相鄰的弦 — 弓無法同時拉到",
    en: "Non-adjacent strings used — the bow cannot reach both at once",
  },
  "fingerboard.conflictOutOfRange": {
    "zh-TW": "有音超出指板可演奏範圍",
    en: "A note is outside the playable fingerboard range",
  },
  "fingerboard.conflictHighPosition": {
    "zh-TW": "部分音在高把位 — 技術難度較高",
    en: "Some notes are in a high position — more technically demanding",
  },
};

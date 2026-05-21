import type { BiDict } from "./i18n";

/** 模式列 (Setup → Analyze → Arrange → Transcribe → Refine → Export)。 */
export const MODEBAR_STRINGS: BiDict = {
  "modebar.setup": { "zh-TW": "設定", en: "Setup" },
  "modebar.setup.desc": {
    "zh-TW": "匯入樂譜、選擇目標編制",
    en: "Import a score, choose the target ensemble",
  },
  "modebar.analyze": { "zh-TW": "分析", en: "Analyze" },
  "modebar.analyze.desc": {
    "zh-TW": "檢視聲部功能、樂句邊界",
    en: "Review part functions and phrase boundaries",
  },
  "modebar.arrange": { "zh-TW": "改編", en: "Arrange" },
  "modebar.arrange.desc": {
    "zh-TW": "拖拽重新分配、套用建議",
    en: "Drag to reassign, apply suggestions",
  },
  "modebar.transcribe": { "zh-TW": "移植", en: "Transcribe" },
  "modebar.transcribe.desc": {
    "zh-TW": "樂器替換 + 移調 (Bach 大提琴 → 小提琴 / 協奏曲換獨奏樂器 等)",
    en:
      "Instrument swap + transposition "
      + "(e.g. Bach cello → violin, concerto solo-instrument swap)",
  },
  "modebar.refine": { "zh-TW": "微調", en: "Refine" },
  "modebar.refine.desc": {
    "zh-TW": "處理可演奏性問題",
    en: "Resolve playability issues",
  },
  "modebar.export": { "zh-TW": "匯出", en: "Export" },
  "modebar.export.desc": {
    "zh-TW": "匯出 MusicXML / MIDI / PDF",
    en: "Export MusicXML / MIDI / PDF",
  },
};

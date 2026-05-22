import type { BiDict } from "./i18n";

/** 模式列 (Setup → Analyze → Arrange → Transcribe → Refine → Export)。 */
export const MODEBAR_STRINGS: BiDict = {
  "modebar.setup": { "zh-TW": "設定", en: "Setup", ja: "設定" },
  "modebar.setup.desc": {
    "zh-TW": "匯入樂譜、選擇目標編制",
    en: "Import a score, choose the target ensemble",
    ja: "楽譜を取り込み、目標の編成を選択します",
  },
  "modebar.analyze": { "zh-TW": "分析", en: "Analyze", ja: "分析" },
  "modebar.analyze.desc": {
    "zh-TW": "檢視聲部功能、樂句邊界",
    en: "Review part functions and phrase boundaries",
    ja: "声部の機能と楽句の境界を確認します",
  },
  "modebar.arrange": { "zh-TW": "改編", en: "Arrange", ja: "編曲" },
  "modebar.arrange.desc": {
    "zh-TW": "拖拽重新分配、套用建議",
    en: "Drag to reassign, apply suggestions",
    ja: "ドラッグして再割り当て、提案を適用します",
  },
  "modebar.transcribe": { "zh-TW": "移植", en: "Transcribe", ja: "移植" },
  "modebar.transcribe.desc": {
    "zh-TW": "樂器替換 + 移調 (Bach 大提琴 → 小提琴 / 協奏曲換獨奏樂器 等)",
    en:
      "Instrument swap + transposition "
      + "(e.g. Bach cello → violin, concerto solo-instrument swap)",
    ja:
      "楽器の置き換え + 移調 "
      + "(例: Bach のチェロ → ヴァイオリン、協奏曲の独奏楽器の置き換え)",
  },
  "modebar.refine": { "zh-TW": "微調", en: "Refine", ja: "微調整" },
  "modebar.refine.desc": {
    "zh-TW": "處理可演奏性問題",
    en: "Resolve playability issues",
    ja: "演奏可能性の問題を解消します",
  },
  "modebar.export": { "zh-TW": "匯出", en: "Export", ja: "書き出し" },
  "modebar.export.desc": {
    "zh-TW": "匯出 MusicXML / MIDI / PDF",
    en: "Export MusicXML / MIDI / PDF",
    ja: "MusicXML / MIDI / PDF を書き出します",
  },
};

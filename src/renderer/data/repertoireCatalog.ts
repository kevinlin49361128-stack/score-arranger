/**
 * repertoireCatalog — 0.1.41 曲目資料庫 (Single source of truth)
 *
 * 取代舊版 PresetLibrary.tsx 的 PRESETS array + _PRESET_TAGS sidecar.
 * 每首曲目富 metadata 供多重篩選 (作曲家 / 時代 / 編制 / 形式 / 程度 / 主題).
 *
 * 0.1.45: 299 首 — Scarlatti 修正 + Bach 370 Chorales 50 + Lieder 大套曲完整化
 *
 * 0.1.41 重要變更:
 * - grade 從自製 1-5 改成 ABRSM 1-9 (8 = Grade 8, 9 = Diploma/Advanced)
 * - 加 optional henle_level 1-9 (出版社中立分級, 適合室內樂 / 鋼琴)
 *   詳見 https://www.henle.de/en/Levels-of-Difficulty/
 *
 * 分級指南:
 *   ABRSM Grade 1-2 = 入門 (兒童 / 第一年)
 *   ABRSM Grade 3-5 = 中階 (一般學生主力)
 *   ABRSM Grade 6-8 = 進階 (高中 / 升大學程度)
 *   ABRSM Grade 9   = Diploma / 職業
 *
 *   Henle 1-3 = leicht / easy
 *   Henle 4-6 = mittelschwer / medium
 *   Henle 7-9 = schwer / difficult
 *
 * 資料來源:
 * - corpus_path / measures: 既有 PRESETS
 * - composer / era / form / ensemble: 人工整理 (本檔)
 * - 13 首 OpenScore Lieder: 0.1.40 新增, CC0
 * - ABRSM grade 對應: 結合曲目知名度 / 教學階段慣例
 * - Henle level: 參考 Henle Verlag 公開分級表
 *
 * 擴充指引:
 * - 加新曲時: 把新 .musicxml / .mxl 放進 engine/core/sample_scores/,
 *   也加進 engine/core/samples.py SAMPLE_CORPUS_IDS, 再加一筆下方.
 * - tags 從教學主旨選 (legato / counterpoint / scales / shifts /
 *   expression / rhythm / ensemble / staccato). 留空也 OK.
 */

import manifest from "./repertoire-manifest.json";

export type Era = "Renaissance" | "Baroque" | "Classical" | "Romantic" | "Modern";
export type Form =
  | "Chorale" | "Lied" | "Quartet" | "Sonata" | "Trio Sonata"
  | "Aria" | "Mazurka" | "Rag" | "Opera" | "Character Piece"
  | "Mass" | "Motet" | "Hymn" | "12-Tone" | "Galant" | "Madrigal";
export type EnsembleType =
  | "SATB" | "String Quartet" | "Trio Sonata"
  | "Voice + Piano" | "Piano Solo" | "Other";
export type InstrumentFamily = "voice" | "strings" | "piano" | "mixed";
export type TeachingTag =
  | "legato" | "staccato" | "counterpoint" | "scales"
  | "shifts" | "expression" | "rhythm" | "ensemble";

/**
 * 大眾用途 tag — 0.1.54 新增, 與 teaching tag 正交.
 * teaching tag 是「老師找教 X 的曲子」(技巧導向);
 * popular tag 是「素人找演奏場合用曲」(用途導向).
 *
 * - amateur_violinist: 業餘小提琴手友善 (音域內 / 技巧不超 grade 5 /
 *   有名旋律或便於改成 violin+piano).
 * - amateur_cellist: 業餘大提琴手友善 (Suzuki / Bach 無伴奏 / 主旋律明顯).
 *   0.1.55 新增.
 * - amateur_pianist: 業餘鋼琴手友善 (大眾鋼琴小品, ABRSM ≤ 6).
 *   0.1.55 新增.
 * - amateur_harpsichordist: 業餘大鍵琴手友善 (古樂社團 / 巴洛克鍵盤入門).
 *   0.1.55 新增.
 * - amateur_flutist: 業餘長笛手友善 (主旋律 + 鋼琴 / 室樂).
 *   0.1.55 新增.
 * - amateur_hornist: 業餘法國號手友善 (圓號 + 鋼琴 / 銅管室樂).
 *   0.1.55 新增.
 * - wedding: 婚禮可用 (進場 / 退場 / 簽署).
 * - popular: 大眾耳熟能詳 (廣告 / 電影 / 場合常見).
 * - beginner_friendly: 初學 1 年內可挑戰 (ABRSM 1-3).
 */
export type PopularTag =
  | "amateur_violinist" | "amateur_cellist" | "amateur_pianist"
  | "amateur_harpsichordist" | "amateur_flutist" | "amateur_hornist"
  | "wedding" | "popular" | "beginner_friendly";

/** ABRSM Grade 1-8 + 9 = Diploma / Advanced. 0 = pre-grade (兒童入門) */
export type AbrsmGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
/** Henle Verlag 1-9 分級 (1-3 easy, 4-6 medium, 7-9 difficult) */
export type HenleLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface RepertoireEntry {
  corpus_path: string;
  /** 標題 (display name). 使用 i18n key 也可, 直接顯示 fallback */
  title: string;
  composer: string;
  /** 生卒年, 用於 era cross-check */
  composer_dates: string;
  era: Era;
  form: Form;
  ensemble: EnsembleType;
  instruments: InstrumentFamily[];
  /** 約略年份 (作曲時間, 不是出版); 0 = 不確定 */
  year: number;
  /** 約略小節數 */
  measures?: number;
  /** ABRSM Grade 1-9. 室內樂 (ABRSM 沒分級) 可留空, 改用 henle_level */
  grade?: AbrsmGrade;
  /** Henle Verlag 中立分級, 1-9 — 室內樂 / 出版品優先 */
  henle_level?: HenleLevel;
  /** 教學主旨 — 老師找「教 X 的曲子」用 */
  tags: TeachingTag[];
  /** 大眾用途 (婚禮 / 業餘小提琴 / 廣為人知). 與 tags 正交. */
  popular_tags?: PopularTag[];
  /** B1: true = 雲端曲 (需下載), 非綁定核心。由遠端 manifest 合併進來時標記。 */
  remote?: boolean;
}

// ============================================================================
// 0.1.54: 業餘小提琴熱門曲目 stub.
// 上一輪用來追蹤「想要但找不到 PD encoding」的曲. 本輪 9 首已全數找到並補進
// REPERTOIRE / engine/core/samples.py, stub 清空.
// 來源: musetrainer/library (CC0 MusicXML 3 首) 與 mfiles.co.uk /
// classicalmidi.co.uk MIDI → music21 重輸出 MusicXML (6 首).
// 作曲家全部 1934 年前過世, 作品 PD 無爭議.
// ============================================================================
export interface MissingEntryStub {
  corpus_path: string;
  title: string;
  composer: string;
  composer_dates: string;
  source_hint: string;
  rationale: string;
}

export const MISSING_AMATEUR_VIOLIN_REPERTOIRE: MissingEntryStub[] = [];

// ============================================================================
// 主要 catalog — 按時代排, 同時代按作曲家
// ============================================================================

// 0.1.85 (架構 side-quest): 曲目資料移到 repertoire-manifest.json (資料管線, 非程式碼)。
// 型別 + helper 留本檔; 資料由 Vite build-time JSON import 帶入。改曲目改 .json 即可。
export const REPERTOIRE: RepertoireEntry[] =
  manifest as unknown as RepertoireEntry[];

// ============================================================================
// Helpers for the dialog
// ============================================================================

/** 從 catalog 抽出唯一的作曲家清單 (按出生年排) */
export function listComposers(): string[] {
  const map = new Map<string, string>();
  for (const e of REPERTOIRE) {
    if (!map.has(e.composer)) map.set(e.composer, e.composer_dates);
  }
  return [...map.keys()].sort((a, b) => {
    const ya = parseInt(map.get(a)?.split("-")[0] ?? "9999", 10);
    const yb = parseInt(map.get(b)?.split("-")[0] ?? "9999", 10);
    return ya - yb;
  });
}

export const ALL_ERAS: Era[] = [
  "Renaissance", "Baroque", "Classical", "Romantic", "Modern",
];
export const ALL_FORMS: Form[] = [
  "Chorale", "Lied", "Quartet", "Sonata", "Trio Sonata",
  "Aria", "Mazurka", "Rag", "Opera", "Character Piece",
  "Mass", "Motet", "Hymn", "12-Tone", "Galant", "Madrigal",
];
export const ALL_ENSEMBLES: EnsembleType[] = [
  "SATB", "String Quartet", "Trio Sonata",
  "Voice + Piano", "Piano Solo", "Other",
];
export const ALL_TAGS: TeachingTag[] = [
  "legato", "staccato", "counterpoint", "scales",
  "shifts", "expression", "rhythm", "ensemble",
];

/** ABRSM 等級對應人類友善描述 (給 tooltip 用) */
export function abrsmDescription(g: AbrsmGrade): string {
  if (g <= 2) return "Beginner";
  if (g <= 5) return "Intermediate";
  if (g <= 8) return "Advanced";
  return "Diploma";
}

/** Henle 等級對應人類友善描述 (給 tooltip 用) */
export function henleDescription(h: HenleLevel): string {
  if (h <= 3) return "leicht / easy";
  if (h <= 6) return "mittelschwer / medium";
  return "schwer / difficult";
}

/**
 * 0.1.45 視覺升級 A1 — 時代色帶配色.
 *
 * 設計考量: 飽和度刻意壓低, 配 paper / 暗金底色, 不喧鬰.
 * 古典樂客群偏好 sober 色調, 不用 vivid primary.
 */
export const ERA_BAND: Record<Era, string> = {
  Renaissance: "#6b8e5a",  // 苔綠 — 羊皮紙時代
  Baroque: "#b08a45",      // 暗金 — 巴洛克金漆
  Classical: "#b8a373",    // 象牙金 — 啟蒙時期大理石
  Romantic: "#c4778a",     // 玫紅 — 沙龍絲絨
  Modern: "#5a7a9e",       // 鋼藍 — 工業時代
};

/**
 * 0.1.47 視覺升級 B4 — 時代別標題字型.
 *
 * 對應各時代主流印刷字型, 細微但有質感. 只用在標題不全面替換.
 * Fallback chain 保證跨平台都能渲染.
 */
export function eraFontFamily(era: Era): string {
  switch (era) {
    case "Renaissance":
      // 文藝復興手抄本感, calligraphic
      return "Palatino, 'Palatino Linotype', 'Songti TC', 'Times New Roman', serif";
    case "Baroque":
      // 巴洛克印刷古典 serif (Garamond family)
      return "Garamond, 'EB Garamond', 'Times New Roman', serif";
    case "Classical":
      // 古典時期過渡 serif
      return "Baskerville, Georgia, 'Times New Roman', serif";
    case "Romantic":
      // 浪漫時期 didone (Bodoni/Didot)
      return "'Bodoni 72', Bodoni, Didot, 'Didot LT STD', Georgia, serif";
    case "Modern":
      // 現代主義 — sans-serif
      return "'Helvetica Neue', Helvetica, Arial, sans-serif";
    default:
      return "inherit";
  }
}

/**
 * 0.1.46 視覺升級 A2 — 作曲家 monogram 字章.
 *
 * 取首字 + 姓氏首字 (大寫). 著名作曲家用通用縮寫 (Bach=JSB, Mozart=WAM).
 * 不用真實肖像 (版權問題), 純字章設計感更貼近 18-19 世紀印刷風格.
 */
export function composerMonogram(composer: string): string {
  const SPECIAL: Record<string, string> = {
    "Johann Sebastian Bach": "JSB",
    "Wolfgang Amadeus Mozart": "WAM",
    "Ludwig van Beethoven": "LvB",
    "Carl Philipp Emanuel Bach": "CPE",
    "Felix Mendelssohn": "FM",
    "Franz Schubert": "FS",
    "Frédéric Chopin": "FC",
    "Robert Schumann": "RS",
    "Clara Schumann": "CS",
    "Johannes Brahms": "JB",
    "Hugo Wolf": "HW",
    "Gustav Mahler": "GM",
    "Richard Strauss": "RS·",
    "Hector Berlioz": "HB",
    "Claude Debussy": "CD",
    "Gabriel Fauré": "GF",
    "Joseph Haydn": "JH",
    "Domenico Scarlatti": "DS",
    "George Frideric Handel": "GFH",
    "Arcangelo Corelli": "AC",
    "Giuseppe Verdi": "GV",
    "Scott Joplin": "SJ",
    "Arnold Schoenberg": "AS",
    "Anton Webern": "AW",
    "Alban Berg": "AB",
    "Amy Beach": "AB·",
    "Liliʻuokalani": "Lk",
    "Lili Boulanger": "LB",
    "Giovanni Pierluigi da Palestrina": "GP",
    "Claudio Monteverdi": "CM",
    "Stephen Foster": "SF",
  };
  if (SPECIAL[composer]) return SPECIAL[composer];
  // 通用 fallback: 取每個 word 首字, 最多 3 字
  const parts = composer.split(/\s+/).filter(p => p.length > 0);
  return parts.map(p => p[0]).join("").toUpperCase().slice(0, 3);
}

/**
 * 0.1.46 視覺升級 A4 — 編制 icon (SVG path, 不用 emoji).
 *
 * 用統一線條風格的 SVG, 16x16 viewBox.
 * - SATB: 4 個圓 (TTBA)
 * - String Quartet: 4 個小提琴標記
 * - Voice + Piano: 麥克風 + 鋼琴鍵盤
 * - Piano Solo: 鋼琴鍵盤
 * - Trio Sonata: 3 條弦
 * - Other: 點點
 */
export function ensembleIcon(e: EnsembleType): string {
  switch (e) {
    case "SATB":
      return "M2,8 A2,2 0 1,1 6,8 A2,2 0 1,1 2,8 "
        + "M6,8 A2,2 0 1,1 10,8 A2,2 0 1,1 6,8 "
        + "M4,12 A2,2 0 1,1 8,12 A2,2 0 1,1 4,12 "
        + "M8,12 A2,2 0 1,1 12,12 A2,2 0 1,1 8,12";
    case "String Quartet":
      // 4 把小提琴 = 4 個 elongated 橢圓
      return "M2,3 L2,8 M5,3 L5,8 M8,3 L8,8 M11,3 L11,8 "
        + "M1,10 L4,10 M4,10 L7,10 M7,10 L10,10 M10,10 L13,10";
    case "Voice + Piano":
      // mic 圓 + 鋼琴鍵 條
      return "M5,2 A2,2 0 1,1 5,7 A2,2 0 1,1 5,2 M5,7 L5,9 "
        + "M2,11 L12,11 L12,14 L2,14 Z "
        + "M5,11 L5,14 M8,11 L8,14";
    case "Piano Solo":
      // 鋼琴鍵盤
      return "M1,5 L14,5 L14,12 L1,12 Z "
        + "M4,5 L4,12 M7,5 L7,12 M10,5 L10,12 "
        + "M2.5,5 L2.5,9 M5.5,5 L5.5,9 M8.5,5 L8.5,9 M11.5,5 L11.5,9 M12.5,5 L12.5,9";
    case "Trio Sonata":
      // 3 條弦樂線
      return "M3,2 L3,14 M7,2 L7,14 M11,2 L11,14";
    default:
      return "M3,8 A1,1 0 1,1 5,8 A1,1 0 1,1 3,8 "
        + "M7,8 A1,1 0 1,1 9,8 A1,1 0 1,1 7,8 "
        + "M11,8 A1,1 0 1,1 13,8 A1,1 0 1,1 11,8";
  }
}

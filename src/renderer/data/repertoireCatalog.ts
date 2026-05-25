/**
 * repertoireCatalog — 0.1.41 曲目資料庫 (Single source of truth)
 *
 * 取代舊版 PresetLibrary.tsx 的 PRESETS array + _PRESET_TAGS sidecar.
 * 每首曲目富 metadata 供多重篩選 (作曲家 / 時代 / 編制 / 形式 / 程度 / 主題).
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
}

// ============================================================================
// 主要 catalog — 按時代排, 同時代按作曲家
// ============================================================================

export const REPERTOIRE: RepertoireEntry[] = [
  // ─── Baroque (1600-1750) ────────────────────────────────────────────────
  // Bach 聖詠: 對位教學經典, 4 部 SATB, 短小精緻. ABRSM 4 (合唱寫作練習)
  {
    corpus_path: "bach/bwv66.6",
    title: "Christ, unser Herr, zum Jordan kam (BWV 66.6)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1740, measures: 10,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv7.7",
    title: "Christ, unser Herr (BWV 7.7)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1724, measures: 19,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv57.8",
    title: "Selig ist der Mann (BWV 57.8)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1725, measures: 13,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv4.8",
    title: "Christ lag in Todesbanden (BWV 4.8)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1707, measures: 14,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv227.7",
    title: "Jesu, meine Freude (BWV 227.7)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1723, measures: 13,
    grade: 5, henle_level: 3,
    tags: ["counterpoint", "expression"],
  },
  {
    corpus_path: "bach/bwv281",
    title: "Christus, der ist mein Leben (BWV 281)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1736, measures: 9,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv344",
    title: "Hilf, Herr Jesu, laß gelingen (BWV 344)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1740, measures: 24,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv1.6",
    title: "Wie schön leuchtet (BWV 1.6, 5 parts)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "Other",
    instruments: ["voice", "mixed"], year: 1725, measures: 21,
    grade: 5, henle_level: 3,
    tags: ["counterpoint", "expression"],
  },
  // Corelli / Handel
  {
    corpus_path: "corelli/opus3no1/1grave",
    title: "Trio Sonata Op.3 No.1 — Grave",
    composer: "Arcangelo Corelli", composer_dates: "1653-1713",
    era: "Baroque", form: "Trio Sonata", ensemble: "Trio Sonata",
    instruments: ["strings"], year: 1689, measures: 19,
    henle_level: 3,
    tags: ["legato", "ensemble"],
  },
  {
    corpus_path: "handel/rinaldo/Lascia_chio_pianga",
    title: "Lascia ch'io pianga (from Rinaldo)",
    composer: "George Frideric Handel", composer_dates: "1685-1759",
    era: "Baroque", form: "Aria", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1711, measures: 54,
    grade: 4, henle_level: 3,
    tags: ["legato", "expression"],
  },

  // ─── Classical (1750-1820) ──────────────────────────────────────────────
  // Mozart String Quartets — K.80 早期 → K.458 「獵」成熟期
  // 弦四 ABRSM 無分級, 用 Henle
  {
    corpus_path: "mozart/k80/movement1",
    title: "String Quartet K.80 mvt.1 (Adagio)",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1770, measures: 67,
    henle_level: 3,
    tags: ["ensemble", "legato"],
  },
  {
    corpus_path: "mozart/k80/movement2",
    title: "String Quartet K.80 mvt.2 (Allegro)",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1770, measures: 84,
    henle_level: 4,
    tags: ["scales", "ensemble"],
  },
  {
    corpus_path: "mozart/k80/movement3",
    title: "String Quartet K.80 mvt.3 (Menuetto)",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1770, measures: 52,
    henle_level: 3,
    tags: ["ensemble", "rhythm"],
  },
  {
    corpus_path: "mozart/k80/movement4",
    title: "String Quartet K.80 mvt.4 (Rondeau)",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1770, measures: 71,
    henle_level: 4,
    tags: ["ensemble", "rhythm"],
  },
  {
    corpus_path: "mozart/k155/movement1",
    title: "String Quartet K.155 mvt.1",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1772,
    henle_level: 4,
    tags: ["scales", "ensemble"],
  },
  {
    corpus_path: "mozart/k155/movement2",
    title: "String Quartet K.155 mvt.2",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1772,
    henle_level: 4,
    tags: ["legato", "ensemble"],
  },
  {
    corpus_path: "mozart/k155/movement3",
    title: "String Quartet K.155 mvt.3",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1772, measures: 103,
    henle_level: 4,
    tags: ["scales", "ensemble"],
  },
  {
    corpus_path: "mozart/k156/movement1",
    title: "String Quartet K.156 mvt.1",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1772, measures: 180,
    henle_level: 4,
    tags: ["ensemble", "scales"],
  },
  {
    corpus_path: "mozart/k156/movement2",
    title: "String Quartet K.156 mvt.2",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1772, measures: 37,
    henle_level: 4,
    tags: ["legato", "ensemble"],
  },
  {
    corpus_path: "mozart/k156/movement3",
    title: "String Quartet K.156 mvt.3",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1772, measures: 62,
    henle_level: 4,
    tags: ["ensemble", "rhythm"],
  },
  {
    corpus_path: "mozart/k156/movement4",
    title: "String Quartet K.156 mvt.4",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1772, measures: 24,
    henle_level: 4,
    tags: ["ensemble", "rhythm"],
  },
  {
    corpus_path: "mozart/k458/movement1",
    title: "String Quartet K.458 \"Hunt\" mvt.1",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1784, measures: 283,
    henle_level: 6,
    tags: ["rhythm", "ensemble"],
  },
  {
    corpus_path: "mozart/k458/movement2",
    title: "String Quartet K.458 \"Hunt\" mvt.2",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1784, measures: 63,
    henle_level: 6,
    tags: ["legato", "ensemble"],
  },
  {
    corpus_path: "mozart/k458/movement3",
    title: "String Quartet K.458 \"Hunt\" mvt.3",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1784, measures: 53,
    henle_level: 6,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "mozart/k458/movement4",
    title: "String Quartet K.458 \"Hunt\" mvt.4",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1784, measures: 335,
    henle_level: 6,
    tags: ["rhythm", "ensemble"],
  },
  // Mozart piano sonata — K.545 是出名「Sonata Facile」, ABRSM 5
  {
    corpus_path: "mozart/k545/movement1_exposition",
    title: "Piano Sonata K.545 mvt.1 (Exposition)",
    composer: "Wolfgang Amadeus Mozart", composer_dates: "1756-1791",
    era: "Classical", form: "Sonata", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1788,
    grade: 5, henle_level: 3,
    tags: ["scales", "legato"],
  },
  // Haydn String Quartets
  {
    corpus_path: "haydn/opus1no1/movement1",
    title: "String Quartet Op.1 No.1 mvt.1",
    composer: "Joseph Haydn", composer_dates: "1732-1809",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1762, measures: 66,
    henle_level: 4,
    tags: ["ensemble", "legato"],
  },
  {
    corpus_path: "haydn/opus1no1/movement2",
    title: "String Quartet Op.1 No.1 mvt.2",
    composer: "Joseph Haydn", composer_dates: "1732-1809",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1762, measures: 62,
    henle_level: 4,
    tags: ["ensemble", "rhythm"],
  },
  {
    corpus_path: "haydn/opus74no1/movement1",
    title: "String Quartet Op.74 No.1 mvt.1",
    composer: "Joseph Haydn", composer_dates: "1732-1809",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1793,
    henle_level: 6,
    tags: ["rhythm", "ensemble"],
  },
  {
    corpus_path: "haydn/opus74no1/movement2",
    title: "String Quartet Op.74 No.1 mvt.2",
    composer: "Joseph Haydn", composer_dates: "1732-1809",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1793, measures: 174,
    henle_level: 6,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "haydn/opus74no1/movement3",
    title: "String Quartet Op.74 No.1 mvt.3",
    composer: "Joseph Haydn", composer_dates: "1732-1809",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1793, measures: 113,
    henle_level: 6,
    tags: ["rhythm", "ensemble"],
  },
  {
    corpus_path: "haydn/opus74no1/movement4",
    title: "String Quartet Op.74 No.1 mvt.4",
    composer: "Joseph Haydn", composer_dates: "1732-1809",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1793, measures: 287,
    henle_level: 6,
    tags: ["rhythm", "ensemble"],
  },
  // Beethoven String Quartets
  {
    corpus_path: "beethoven/opus18no1/movement1",
    title: "String Quartet Op.18 No.1 mvt.1",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1800, measures: 313,
    henle_level: 7,
    tags: ["expression", "ensemble"],
  },
  {
    corpus_path: "beethoven/opus18no1/movement2",
    title: "String Quartet Op.18 No.1 mvt.2",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1800, measures: 110,
    henle_level: 7,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "beethoven/opus18no1/movement3",
    title: "String Quartet Op.18 No.1 mvt.3",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1800, measures: 145,
    henle_level: 7,
    tags: ["rhythm", "ensemble"],
  },
  {
    corpus_path: "beethoven/opus18no1/movement4",
    title: "String Quartet Op.18 No.1 mvt.4",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1800,
    henle_level: 7,
    tags: ["rhythm", "ensemble"],
  },
  {
    corpus_path: "beethoven/opus59no1/movement1",
    title: "String Quartet Op.59 No.1 \"Razumovsky\" mvt.1",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1806,
    henle_level: 8,
    tags: ["expression", "rhythm"],
  },
  {
    corpus_path: "beethoven/opus132",
    title: "String Quartet Op.132 (Late, A minor)",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Quartet", ensemble: "String Quartet",
    instruments: ["strings"], year: 1825,
    henle_level: 9,
    tags: ["expression", "ensemble"],
  },

  // ─── Romantic (1820-1900) ───────────────────────────────────────────────
  {
    corpus_path: "chopin/mazurka06-2",
    title: "Mazurka Op.6 No.2",
    composer: "Frédéric Chopin", composer_dates: "1810-1849",
    era: "Romantic", form: "Mazurka", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1832,
    grade: 6, henle_level: 5,
    tags: ["expression", "rhythm"],
  },
  {
    corpus_path: "joplin/maple_leaf_rag",
    title: "Maple Leaf Rag",
    composer: "Scott Joplin", composer_dates: "1868-1917",
    era: "Romantic", form: "Rag", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1899,
    grade: 6, henle_level: 4,
    tags: ["rhythm", "staccato"],
  },
  {
    corpus_path: "schubert/Lindenbaum",
    title: "Der Lindenbaum (from Winterreise)",
    composer: "Franz Schubert", composer_dates: "1797-1828",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1827,
    grade: 4, henle_level: 3,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "schumann_clara/opus17/movement3",
    title: "Piano Trio Op.17 mvt.3 (Clara Schumann)",
    composer: "Clara Schumann", composer_dates: "1819-1896",
    era: "Romantic", form: "Sonata", ensemble: "Other",
    instruments: ["strings", "piano"], year: 1846,
    henle_level: 6,
    tags: ["expression", "ensemble"],
  },
  {
    corpus_path: "schumann_robert/dichterliebe_no2",
    title: "Dichterliebe No.2 (Aus meinen Tränen)",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840,
    grade: 5, henle_level: 4,
    tags: ["expression", "legato"],
  },
  {
    corpus_path: "schumann_robert/opus48no2",
    title: "Op.48 No.2 (Schumann)",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840, measures: 18,
    grade: 5, henle_level: 4,
    tags: ["expression", "legato"],
  },
  {
    corpus_path: "verdi/laDonnaEMobile",
    title: "La donna è mobile (from Rigoletto)",
    composer: "Giuseppe Verdi", composer_dates: "1813-1901",
    era: "Romantic", form: "Opera", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1851, measures: 35,
    grade: 4, henle_level: 3,
    tags: ["expression", "rhythm"],
  },

  // ─── 0.1.40 OpenScore Lieder (CC0) ───────────────────────────────────────
  // Beethoven 6 Lieder Op.48 (Gellert texts)
  {
    corpus_path: "openscore/beethoven_op48_1_bitten",
    title: "6 Lieder Op.48 No.1 — Bitten",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1803, measures: 46,
    grade: 5, henle_level: 3,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/beethoven_op48_2_liebe",
    title: "6 Lieder Op.48 No.2 — Die Liebe des Nächsten",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1803, measures: 30,
    grade: 4, henle_level: 3,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/beethoven_op48_3_tode",
    title: "6 Lieder Op.48 No.3 — Vom Tode",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1803, measures: 49,
    grade: 5, henle_level: 3,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/beethoven_op48_4_ehre",
    title: "6 Lieder Op.48 No.4 — Die Ehre Gottes aus der Natur",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1803, measures: 43,
    grade: 5, henle_level: 3,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/beethoven_op52_3_ruhe",
    title: "8 Lieder Op.52 No.3 — Das Liedchen von der Ruhe",
    composer: "Ludwig van Beethoven", composer_dates: "1770-1827",
    era: "Classical", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1805, measures: 44,
    grade: 3, henle_level: 2,
    tags: ["legato", "expression"],
  },
  // Schubert Schöne Müllerin (D.795)
  {
    corpus_path: "openscore/schubert_d795_1_wandern",
    title: "Schöne Müllerin No.1 — Das Wandern",
    composer: "Franz Schubert", composer_dates: "1797-1828",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1823, measures: 20,
    grade: 5, henle_level: 3,
    tags: ["rhythm", "expression"],
  },
  {
    corpus_path: "openscore/schubert_d795_2_wohin",
    title: "Schöne Müllerin No.2 — Wohin?",
    composer: "Franz Schubert", composer_dates: "1797-1828",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1823, measures: 81,
    grade: 5, henle_level: 3,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/schubert_d795_20_wiegenlied",
    title: "Schöne Müllerin No.20 — Des Baches Wiegenlied",
    composer: "Franz Schubert", composer_dates: "1797-1828",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1823, measures: 26,
    grade: 3, henle_level: 2,
    tags: ["legato", "expression"],
  },
  // Schumann
  {
    corpus_path: "openscore/schumann_op39_5_mondnacht",
    title: "Liederkreis Op.39 No.5 — Mondnacht",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840, measures: 68,
    grade: 6, henle_level: 5,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/schumann_op48_1_mai",
    title: "Dichterliebe No.1 — Im wunderschönen Monat Mai",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840, measures: 27,
    grade: 5, henle_level: 4,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/schumann_op48_7_grolle",
    title: "Dichterliebe No.7 — Ich grolle nicht",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840, measures: 36,
    grade: 6, henle_level: 5,
    tags: ["expression", "rhythm"],
  },
  {
    corpus_path: "openscore/schumann_op42_1_seitich",
    title: "Frauenliebe No.1 — Seit ich ihn gesehen",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840, measures: 36,
    grade: 5, henle_level: 4,
    tags: ["legato", "expression"],
  },
  // Brahms
  {
    corpus_path: "openscore/brahms_op43_1_ewigeliebe",
    title: "4 Songs Op.43 No.1 — Von ewiger Liebe",
    composer: "Johannes Brahms", composer_dates: "1833-1897",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1864, measures: 121,
    grade: 7, henle_level: 6,
    tags: ["legato", "expression"],
  },

  // ─── 0.1.42 加碼: music21 corpus export (時代多樣性) ─────────────────────
  // Bach 聖詠 10 首加碼 — 4 部 SATB 對位教學經典, Henle 2 / ABRSM 4
  {
    corpus_path: "bach/bwv269",
    title: "Aus meines Herzens Grunde (BWV 269)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1725, measures: 24,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv347",
    title: "Ich dank' dir, lieber Herre (BWV 347)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1735, measures: 16,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv267",
    title: "Ein Lämmlein geht und trägt die Schuld (BWV 267)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1735, measures: 20,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "expression"],
  },
  {
    corpus_path: "bach/bwv17.7",
    title: "Nun lob', mein' Seel', den Herren (BWV 17.7)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1726, measures: 42,
    grade: 4, henle_level: 3,
    tags: ["counterpoint", "expression"],
  },
  {
    corpus_path: "bach/bwv40.8",
    title: "Freuet euch, ihr Christen alle (BWV 40.8)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1723, measures: 20,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv38.6",
    title: "Aus tiefer Not schrei' ich zu dir (BWV 38.6)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1724, measures: 13,
    grade: 3, henle_level: 2,
    tags: ["counterpoint", "expression"],
  },
  {
    corpus_path: "bach/bwv33.6",
    title: "Allein zu dir, Herr Jesu Christ (BWV 33.6)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1724, measures: 20,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv277",
    title: "Christ lag in Todesbanden (BWV 277, alt.)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1735, measures: 14,
    grade: 3, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "bach/bwv178.7",
    title: "Was Gott tut, das ist wohlgetan (BWV 178.7)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1724, measures: 15,
    grade: 4, henle_level: 2,
    tags: ["counterpoint", "expression"],
  },
  {
    corpus_path: "bach/bwv32.6",
    title: "Mein Gott, öffne mir die Pforten (BWV 32.6)",
    composer: "Johann Sebastian Bach", composer_dates: "1685-1750",
    era: "Baroque", form: "Chorale", ensemble: "SATB",
    instruments: ["voice"], year: 1726, measures: 13,
    grade: 3, henle_level: 2,
    tags: ["counterpoint", "legato"],
  },

  // ─── Renaissance (1400-1600) — 新增時代 ────────────────────────────────
  // Ciconia (1370-1412) — 早期文藝復興過渡, 單聲部 ars subtilior
  {
    corpus_path: "ciconia/quod_jactatur",
    title: "Quod Jactatur (Ciconia)",
    composer: "Johannes Ciconia", composer_dates: "1370-1412",
    era: "Renaissance", form: "Motet", ensemble: "Other",
    instruments: ["voice"], year: 1410, measures: 35,
    henle_level: 4,
    tags: ["rhythm", "expression"],
  },
  // Palestrina Missa Papae Marcelli (~1562) — Stile antico 對位範本
  {
    corpus_path: "palestrina/Kyrie",
    title: "Kyrie (from Missa Papae Marcelli)",
    composer: "Giovanni Pierluigi da Palestrina",
    composer_dates: "1525-1594",
    era: "Renaissance", form: "Mass", ensemble: "Other",
    instruments: ["voice"], year: 1562, measures: 21,
    henle_level: 5,
    tags: ["counterpoint", "legato"],
  },
  {
    corpus_path: "palestrina/Agnus",
    title: "Agnus Dei (Palestrina, 5 voices)",
    composer: "Giovanni Pierluigi da Palestrina",
    composer_dates: "1525-1594",
    era: "Renaissance", form: "Mass", ensemble: "Other",
    instruments: ["voice"], year: 1565, measures: 45,
    henle_level: 5,
    tags: ["counterpoint", "legato"],
  },

  // ─── Baroque 補充 (CPE Bach 過渡至 Galant) ──────────────────────────────
  {
    corpus_path: "cpebach/h186",
    title: "Solfeggietto-style Piece (H.186)",
    composer: "Carl Philipp Emanuel Bach", composer_dates: "1714-1788",
    era: "Baroque", form: "Galant", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1770, measures: 32,
    grade: 5, henle_level: 5,
    tags: ["scales", "expression"],
  },

  // ─── Romantic 補充 (美 / 夏威夷, 地理多樣) ──────────────────────────────
  {
    corpus_path: "beach/prayer_of_a_tired_child",
    title: "Prayer of a Tired Child",
    composer: "Amy Beach", composer_dates: "1867-1944",
    era: "Romantic", form: "Hymn", ensemble: "Other",
    instruments: ["voice", "piano"], year: 1922, measures: 31,
    grade: 4, henle_level: 5,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "liliuokalani/aloha_oe",
    title: "Aloha 'Oe",
    composer: "Lili'uokalani", composer_dates: "1838-1917",
    era: "Romantic", form: "Hymn", ensemble: "Other",
    instruments: ["voice"], year: 1878, measures: 23,
    grade: 3, henle_level: 2,
    tags: ["legato", "expression"],
  },

  // ─── Modern (20 世紀) — 新增時代 ────────────────────────────────────────
  // Schoenberg Op.19 6 Little Piano Pieces (1911) — 自由無調性入門
  {
    corpus_path: "schoenberg/opus19/movement2",
    title: "6 Little Piano Pieces Op.19 No.2",
    composer: "Arnold Schoenberg", composer_dates: "1874-1951",
    era: "Modern", form: "Character Piece", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1911, measures: 9,
    grade: 8, henle_level: 7,
    tags: ["expression"],
  },
  {
    corpus_path: "schoenberg/opus19/movement6",
    title: "6 Little Piano Pieces Op.19 No.6 (in memoriam Mahler)",
    composer: "Arnold Schoenberg", composer_dates: "1874-1951",
    era: "Modern", form: "Character Piece", ensemble: "Piano Solo",
    instruments: ["piano"], year: 1911, measures: 10,
    grade: 8, henle_level: 7,
    tags: ["expression"],
  },
  // Webern Op.16 No.2 (1924) — 12-tone canon
  {
    corpus_path: "webern/webern_dormi_jesu_op_16_no_2",
    title: "Dormi Jesu, Op.16 No.2",
    composer: "Anton Webern", composer_dates: "1883-1945",
    era: "Modern", form: "12-Tone", ensemble: "Other",
    instruments: ["voice"], year: 1924, measures: 13,
    grade: 8, henle_level: 8,
    tags: ["counterpoint", "expression"],
  },

  // ─── 0.1.43 加碼: OpenScore Lieder 24 首 + Trecento 1 首 ──────────────
  // Brahms — Wiegenlied (搖籃曲, 全世界最有名) + Die Mainacht + 嚴肅之歌
  {
    corpus_path: "openscore/brahms_op49_4_wiegenlied",
    title: "Wiegenlied Op.49 No.4 (Lullaby)",
    composer: "Johannes Brahms", composer_dates: "1833-1897",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1868,
    grade: 5, henle_level: 3,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/brahms_op43_2_mainacht",
    title: "Die Mainacht Op.43 No.2",
    composer: "Johannes Brahms", composer_dates: "1833-1897",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1864,
    grade: 7, henle_level: 5,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/brahms_op121_3_otod",
    title: "4 Serious Songs Op.121 No.3 — O Tod, wie bitter bist du",
    composer: "Johannes Brahms", composer_dates: "1833-1897",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1896,
    grade: 8, henle_level: 6,
    tags: ["expression", "legato"],
  },
  // Schubert — Heidenröslein, Ave Maria (D.839), Du bist die Ruh
  {
    corpus_path: "openscore/schubert_op3_3_heidenroeslein",
    title: "Heidenröslein D.257",
    composer: "Franz Schubert", composer_dates: "1797-1828",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1815,
    grade: 3, henle_level: 2,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/schubert_d839_ave_maria",
    title: "Ave Maria D.839 (Ellens Gesang III)",
    composer: "Franz Schubert", composer_dates: "1797-1828",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1825,
    grade: 4, henle_level: 3,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/schubert_op59_3_dubist",
    title: "Du bist die Ruh D.776",
    composer: "Franz Schubert", composer_dates: "1797-1828",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1823,
    grade: 6, henle_level: 4,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/schubert_op59_4_lachen",
    title: "Lachen und Weinen D.777",
    composer: "Franz Schubert", composer_dates: "1797-1828",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1823,
    grade: 6, henle_level: 4,
    tags: ["rhythm", "expression"],
  },
  // Schumann R — Op.39 / Op.48 / Op.42 補完
  {
    corpus_path: "openscore/schumann_op39_3_waldes",
    title: "Liederkreis Op.39 No.3 — Waldesgespräch",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840,
    grade: 6, henle_level: 5,
    tags: ["expression", "rhythm"],
  },
  {
    corpus_path: "openscore/schumann_op39_12_fruhling",
    title: "Liederkreis Op.39 No.12 — Frühlingsnacht",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840,
    grade: 7, henle_level: 6,
    tags: ["rhythm", "expression"],
  },
  {
    corpus_path: "openscore/schumann_op48_13_traum",
    title: "Dichterliebe No.13 — Ich hab' im Traum geweinet",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840,
    grade: 5, henle_level: 4,
    tags: ["expression", "legato"],
  },
  {
    corpus_path: "openscore/schumann_op42_2_herrlichste",
    title: "Frauenliebe No.2 — Er, der Herrlichste von allen",
    composer: "Robert Schumann", composer_dates: "1810-1856",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1840,
    grade: 7, henle_level: 5,
    tags: ["expression", "legato"],
  },
  // Mahler — Kindertotenlieder + Lieder eines fahrenden Gesellen
  {
    corpus_path: "openscore/mahler_kinder_1_sonn",
    title: "Kindertotenlieder No.1 — Nun will die Sonn' so hell aufgeh'n",
    composer: "Gustav Mahler", composer_dates: "1860-1911",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1904,
    grade: 8, henle_level: 7,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/mahler_kinder_4_oft",
    title: "Kindertotenlieder No.4 — Oft denk' ich, sie sind nur ausgegangen",
    composer: "Gustav Mahler", composer_dates: "1860-1911",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1904,
    grade: 8, henle_level: 7,
    tags: ["legato", "expression"],
  },
  {
    corpus_path: "openscore/mahler_gesellen_2_gieng",
    title: "Lieder eines fahrenden Gesellen No.2 — Gieng heut morgen",
    composer: "Gustav Mahler", composer_dates: "1860-1911",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1885,
    grade: 7, henle_level: 6,
    tags: ["expression", "rhythm"],
  },
  {
    corpus_path: "openscore/mahler_gesellen_4_augen",
    title: "Lieder eines fahrenden Gesellen No.4 — Die zwei blauen Augen",
    composer: "Gustav Mahler", composer_dates: "1860-1911",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1885,
    grade: 8, henle_level: 7,
    tags: ["legato", "expression"],
  },
  // Wolf Mörike-Lieder — Verborgenheit + Nimmersatte Liebe
  {
    corpus_path: "openscore/wolf_morike_12_verbor",
    title: "Mörike-Lieder No.12 — Verborgenheit",
    composer: "Hugo Wolf", composer_dates: "1860-1903",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1888,
    grade: 6, henle_level: 5,
    tags: ["expression", "legato"],
  },
  {
    corpus_path: "openscore/wolf_morike_9_nimmer",
    title: "Mörike-Lieder No.9 — Nimmersatte Liebe",
    composer: "Hugo Wolf", composer_dates: "1860-1903",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1888,
    grade: 7, henle_level: 6,
    tags: ["expression", "rhythm"],
  },
  // Strauss R — Op.27 (新婚禮物給太太, Morgen! 必教)
  {
    corpus_path: "openscore/strauss_op27_2_caecilie",
    title: "4 Lieder Op.27 No.2 — Cäcilie",
    composer: "Richard Strauss", composer_dates: "1864-1949",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1894,
    grade: 8, henle_level: 7,
    tags: ["expression", "rhythm"],
  },
  {
    corpus_path: "openscore/strauss_op27_3_heimliche",
    title: "4 Lieder Op.27 No.3 — Heimliche Aufforderung",
    composer: "Richard Strauss", composer_dates: "1864-1949",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1894,
    grade: 8, henle_level: 7,
    tags: ["expression", "rhythm"],
  },
  {
    corpus_path: "openscore/strauss_op27_4_morgen",
    title: "4 Lieder Op.27 No.4 — Morgen!",
    composer: "Richard Strauss", composer_dates: "1864-1949",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1894,
    grade: 7, henle_level: 6,
    tags: ["legato", "expression"],
  },
  // Fauré — 法國藝術歌曲
  {
    corpus_path: "openscore/faure_op27_1_chanson",
    title: "Chanson d'amour Op.27 No.1",
    composer: "Gabriel Fauré", composer_dates: "1845-1924",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1882,
    grade: 5, henle_level: 4,
    tags: ["legato", "expression"],
  },
  // Debussy — 印象主義
  {
    corpus_path: "openscore/debussy_ariettes_2_ilpleure",
    title: "Ariettes Oubliées No.2 — Il pleure dans mon coeur",
    composer: "Claude Debussy", composer_dates: "1862-1918",
    era: "Modern", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1888,
    grade: 7, henle_level: 6,
    tags: ["expression", "legato"],
  },
  {
    corpus_path: "openscore/debussy_bilitis_1_flute",
    title: "Trois Chansons de Bilitis No.1 — La flûte de Pan",
    composer: "Claude Debussy", composer_dates: "1862-1918",
    era: "Modern", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1897,
    grade: 7, henle_level: 6,
    tags: ["expression", "legato"],
  },
  // Berlioz — Les nuits d'été (法國歌曲套曲)
  {
    corpus_path: "openscore/berlioz_nuits_1_villanelle",
    title: "Les nuits d'été Op.7 No.1 — Villanelle",
    composer: "Hector Berlioz", composer_dates: "1803-1869",
    era: "Romantic", form: "Lied", ensemble: "Voice + Piano",
    instruments: ["voice", "piano"], year: 1841,
    grade: 7, henle_level: 5,
    tags: ["rhythm", "expression"],
  },

  // ─── 0.1.43 Medieval — Trecento Italian ars nova ────────────────────
  {
    corpus_path: "trecento/PMFC_04-Cara mi donna",
    title: "Cara mi donna (Trecento Italian Madrigal)",
    composer: "Anonymous (Trecento)", composer_dates: "c.1350",
    era: "Renaissance", form: "Madrigal", ensemble: "Other",
    instruments: ["voice"], year: 1350, measures: 55,
    henle_level: 5,
    tags: ["counterpoint", "rhythm"],
  },
];

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

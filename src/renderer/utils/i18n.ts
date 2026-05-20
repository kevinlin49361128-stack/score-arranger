/**
 * i18n — 錯誤代碼與訊息翻譯
 *
 * 目前範圍: 把 server 回傳的 issue.code (e.g. "E_PITCH_BELOW_RANGE")
 * 翻成人類可讀的訊息, 並依當前 locale 給 zh-TW / en。
 *
 * 設計留有擴充空間:
 * - addStrings(locale, dict) 可以由 plugin 補翻譯
 * - t(code, params) 是 main entry
 */

export type Locale = "zh-TW" | "en";

const STORAGE_KEY = "score-arranger.locale";

let currentLocale: Locale = (() => {
  if (typeof window === "undefined") return "zh-TW";
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (raw === "zh-TW" || raw === "en") return raw;
  } catch {
    /* ignore */
  }
  return "zh-TW";
})();

const listeners = new Set<(l: Locale) => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(l: Locale): void {
  currentLocale = l;
  try {
    window.localStorage?.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
  listeners.forEach((cb) => {
    cb(l);
  });
}

export function onLocaleChange(cb: (l: Locale) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ============================================================================
// 字典
// ============================================================================

type Dict = Record<string, string>;

const ZH_TW: Dict = {
  // Errors
  E_PITCH_BELOW_RANGE: "{instrument} 此音 {pitch} 超出最低音域",
  E_PITCH_ABOVE_RANGE: "{instrument} 此音 {pitch} 超出最高音域",
  E_STRING_CHORD_EXCEED:
    "{instrument} 和弦 {chord_size} 音超過最大同時可奏音數 {max}",
  E_NOTE_BELOW_STRING: "{instrument} 此音 {note} 低於 {string} 弦",
  E_NON_ADJACENT_STRINGS: "{instrument} 跨非相鄰弦, 弓無法同時觸及",
  E_VIOLIN_FRET_TOO_HIGH: "{note} 在 {string} 弦上 {fret} 把位過高",
  E_VIOLIN_STRETCH_EXCEED: "和弦把位伸展 {stretch} 半音超過上限 {max}",
  E_VIOLA_FRET_TOO_HIGH: "{note} 把位 {fret} 過高",
  E_VIOLA_STRETCH_EXCEED: "中提琴伸展 {stretch} 超過 {max}",
  E_CELLO_FRET_TOO_HIGH: "{note} 把位 {fret} 過高",
  E_CELLO_STRETCH_EXCEED: "大提琴伸展 {stretch} 超過 {max}",
  E_MONOPHONIC_CHORD: "{instrument} 為單音樂器, 不能同時奏 {chord_size} 音",
  E_PIANO_HAND_SPAN: "鋼琴單手張開 {span} 超過 {max} 半音",
  // Warnings
  W_PITCH_OUT_OF_COMFORTABLE: "{instrument} 此音 {pitch} 超出舒適音域",
  W_PITCH_EXTREME: "{instrument} 此音 {pitch} 接近極限音域",
  W_VIOLIN_STRETCH_LARGE: "把位伸展 {stretch} 大於舒適範圍 {comfortable}",
  W_VIOLA_STRETCH_LARGE: "中提琴伸展較大 {stretch}",
  W_CELLO_STRETCH_LARGE: "大提琴伸展較大 {stretch}",
  W_VIOLIN_TRIPLE_QUAD_STOP: "三/四音和弦, 需快速分弓",
  W_VIOLA_TRIPLE_QUAD_STOP: "中提琴三/四音和弦",
  W_CELLO_TRIPLE_QUAD_STOP: "大提琴三/四音和弦, 較困難",
  W_PARALLEL_FIFTHS: "平行五度 (m.{from_measure}→{to_measure}) — 古典聲部寫作應避免",
  W_PARALLEL_OCTAVES: "平行八度 (m.{from_measure}→{to_measure}) — 古典聲部寫作應避免",
};

const EN: Dict = {
  E_PITCH_BELOW_RANGE: "{instrument} pitch {pitch} below playable range",
  E_PITCH_ABOVE_RANGE: "{instrument} pitch {pitch} above playable range",
  E_STRING_CHORD_EXCEED:
    "{instrument} chord of {chord_size} exceeds max {max} simultaneous notes",
  E_NOTE_BELOW_STRING: "{instrument} {note} is below {string} string",
  E_NON_ADJACENT_STRINGS:
    "{instrument} non-adjacent strings, bow cannot reach simultaneously",
  E_VIOLIN_FRET_TOO_HIGH: "Position {fret} on {string} string too high for {note}",
  E_VIOLIN_STRETCH_EXCEED: "Stretch of {stretch} semitones exceeds max {max}",
  E_VIOLA_FRET_TOO_HIGH: "{note} position {fret} too high",
  E_VIOLA_STRETCH_EXCEED: "Viola stretch {stretch} exceeds {max}",
  E_CELLO_FRET_TOO_HIGH: "{note} position {fret} too high",
  E_CELLO_STRETCH_EXCEED: "Cello stretch {stretch} exceeds {max}",
  E_MONOPHONIC_CHORD:
    "{instrument} is monophonic, cannot play {chord_size} notes simultaneously",
  E_PIANO_HAND_SPAN: "Piano hand span {span} exceeds max {max} semitones",
  W_PITCH_OUT_OF_COMFORTABLE: "{instrument} pitch {pitch} outside comfortable range",
  W_PITCH_EXTREME: "{instrument} pitch {pitch} near extreme range",
  W_VIOLIN_STRETCH_LARGE: "Stretch {stretch} larger than comfortable {comfortable}",
  W_VIOLA_STRETCH_LARGE: "Viola large stretch {stretch}",
  W_CELLO_STRETCH_LARGE: "Cello large stretch {stretch}",
  W_VIOLIN_TRIPLE_QUAD_STOP: "Triple/quadruple stop, requires fast separated bowing",
  W_VIOLA_TRIPLE_QUAD_STOP: "Viola triple/quadruple stop",
  W_CELLO_TRIPLE_QUAD_STOP: "Cello triple/quadruple stop, difficult",
  W_PARALLEL_FIFTHS:
    "Parallel fifths (m.{from_measure}→{to_measure}) — avoid in classical voice leading",
  W_PARALLEL_OCTAVES:
    "Parallel octaves (m.{from_measure}→{to_measure}) — avoid in classical voice leading",
};

const DICTS: Record<Locale, Dict> = {
  "zh-TW": ZH_TW,
  en: EN,
};

export function addStrings(locale: Locale, dict: Dict): void {
  Object.assign(DICTS[locale], dict);
}

/** 翻譯一個 code; 若找不到, 回退到 zh-TW, 再不行就 return code 本身 */
export function t(
  code: string,
  params: Record<string, unknown> = {},
): string {
  const tpl =
    DICTS[currentLocale][code] ?? DICTS["zh-TW"][code] ?? code;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return v == null ? `{${k}}` : String(v);
  });
}

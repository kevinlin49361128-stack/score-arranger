import type { BiDict } from "./i18n";

/**
 * 可演奏性問題代碼訊息 — server 回傳的 issue.code 對應的人類可讀文字。
 * 對應 IssuePanel 的問題列表。音樂術語維持慣用寫法 (Italian / 標準英文)。
 */
export const ISSUE_STRINGS: BiDict = {
  // Errors
  E_PITCH_BELOW_RANGE: {
    "zh-TW": "{instrument} 此音 {pitch} 超出最低音域",
    en: "{instrument} pitch {pitch} below playable range",
  },
  E_PITCH_ABOVE_RANGE: {
    "zh-TW": "{instrument} 此音 {pitch} 超出最高音域",
    en: "{instrument} pitch {pitch} above playable range",
  },
  E_STRING_CHORD_EXCEED: {
    "zh-TW": "{instrument} 和弦 {chord_size} 音超過最大同時可奏音數 {max}",
    en:
      "{instrument} chord of {chord_size} exceeds max {max} simultaneous notes",
  },
  E_NOTE_BELOW_STRING: {
    "zh-TW": "{instrument} 此音 {note} 低於 {string} 弦",
    en: "{instrument} {note} is below {string} string",
  },
  E_NON_ADJACENT_STRINGS: {
    "zh-TW": "{instrument} 跨非相鄰弦, 弓無法同時觸及",
    en: "{instrument} non-adjacent strings, bow cannot reach simultaneously",
  },
  E_VIOLIN_FRET_TOO_HIGH: {
    "zh-TW": "{note} 在 {string} 弦上 {fret} 把位過高",
    en: "Position {fret} on {string} string too high for {note}",
  },
  E_VIOLIN_STRETCH_EXCEED: {
    "zh-TW": "和弦把位伸展 {stretch} 半音超過上限 {max}",
    en: "Stretch of {stretch} semitones exceeds max {max}",
  },
  E_VIOLA_FRET_TOO_HIGH: {
    "zh-TW": "{note} 把位 {fret} 過高",
    en: "{note} position {fret} too high",
  },
  E_VIOLA_STRETCH_EXCEED: {
    "zh-TW": "中提琴伸展 {stretch} 超過 {max}",
    en: "Viola stretch {stretch} exceeds {max}",
  },
  E_CELLO_FRET_TOO_HIGH: {
    "zh-TW": "{note} 把位 {fret} 過高",
    en: "{note} position {fret} too high",
  },
  E_CELLO_STRETCH_EXCEED: {
    "zh-TW": "大提琴伸展 {stretch} 超過 {max}",
    en: "Cello stretch {stretch} exceeds {max}",
  },
  E_MONOPHONIC_CHORD: {
    "zh-TW": "{instrument} 為單音樂器, 不能同時奏 {chord_size} 音",
    en:
      "{instrument} is monophonic, cannot play {chord_size} notes "
      + "simultaneously",
  },
  E_PIANO_HAND_SPAN: {
    "zh-TW": "鋼琴單手張開 {span} 超過 {max} 半音",
    en: "Piano hand span {span} exceeds max {max} semitones",
  },
  // Warnings
  W_PITCH_OUT_OF_COMFORTABLE: {
    "zh-TW": "{instrument} 此音 {pitch} 超出舒適音域",
    en: "{instrument} pitch {pitch} outside comfortable range",
  },
  W_PITCH_EXTREME: {
    "zh-TW": "{instrument} 此音 {pitch} 接近極限音域",
    en: "{instrument} pitch {pitch} near extreme range",
  },
  W_VIOLIN_STRETCH_LARGE: {
    "zh-TW": "把位伸展 {stretch} 大於舒適範圍 {comfortable}",
    en: "Stretch {stretch} larger than comfortable {comfortable}",
  },
  W_VIOLA_STRETCH_LARGE: {
    "zh-TW": "中提琴伸展較大 {stretch}",
    en: "Viola large stretch {stretch}",
  },
  W_CELLO_STRETCH_LARGE: {
    "zh-TW": "大提琴伸展較大 {stretch}",
    en: "Cello large stretch {stretch}",
  },
  W_VIOLIN_TRIPLE_QUAD_STOP: {
    "zh-TW": "三/四音和弦, 需快速分弓",
    en: "Triple/quadruple stop, requires fast separated bowing",
  },
  W_VIOLA_TRIPLE_QUAD_STOP: {
    "zh-TW": "中提琴三/四音和弦",
    en: "Viola triple/quadruple stop",
  },
  W_CELLO_TRIPLE_QUAD_STOP: {
    "zh-TW": "大提琴三/四音和弦, 較困難",
    en: "Cello triple/quadruple stop, difficult",
  },
  W_PARALLEL_FIFTHS: {
    "zh-TW": "平行五度 (m.{from_measure}→{to_measure}) — 古典聲部寫作應避免",
    en:
      "Parallel fifths (m.{from_measure}→{to_measure}) — "
      + "avoid in classical voice leading",
  },
  W_PARALLEL_OCTAVES: {
    "zh-TW": "平行八度 (m.{from_measure}→{to_measure}) — 古典聲部寫作應避免",
    en:
      "Parallel octaves (m.{from_measure}→{to_measure}) — "
      + "avoid in classical voice leading",
  },
};

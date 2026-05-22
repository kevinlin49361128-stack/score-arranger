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
    ja: "{instrument} の音 {pitch} が演奏可能音域の下限を下回っています",
  },
  E_PITCH_ABOVE_RANGE: {
    "zh-TW": "{instrument} 此音 {pitch} 超出最高音域",
    en: "{instrument} pitch {pitch} above playable range",
    ja: "{instrument} の音 {pitch} が演奏可能音域の上限を超えています",
  },
  E_STRING_CHORD_EXCEED: {
    "zh-TW": "{instrument} 和弦 {chord_size} 音超過最大同時可奏音數 {max}",
    en:
      "{instrument} chord of {chord_size} exceeds max {max} simultaneous notes",
    ja:
      "{instrument} の {chord_size} 音の和音が同時に演奏できる最大音数 {max} "
      + "を超えています",
  },
  E_NOTE_BELOW_STRING: {
    "zh-TW": "{instrument} 此音 {note} 低於 {string} 弦",
    en: "{instrument} {note} is below {string} string",
    ja: "{instrument} の音 {note} が {string} 弦より低くなっています",
  },
  E_NON_ADJACENT_STRINGS: {
    "zh-TW": "{instrument} 跨非相鄰弦, 弓無法同時觸及",
    en: "{instrument} non-adjacent strings, bow cannot reach simultaneously",
    ja: "{instrument} が隣接しない弦にまたがり、弓が同時に届きません",
  },
  E_VIOLIN_FRET_TOO_HIGH: {
    "zh-TW": "{note} 在 {string} 弦上 {fret} 把位過高",
    en: "Position {fret} on {string} string too high for {note}",
    ja: "{note} は {string} 弦のポジション {fret} では高すぎます",
  },
  E_VIOLIN_STRETCH_EXCEED: {
    "zh-TW": "和弦把位伸展 {stretch} 半音超過上限 {max}",
    en: "Stretch of {stretch} semitones exceeds max {max}",
    ja: "和音の指の開き {stretch} 半音が上限 {max} を超えています",
  },
  E_VIOLA_FRET_TOO_HIGH: {
    "zh-TW": "{note} 把位 {fret} 過高",
    en: "{note} position {fret} too high",
    ja: "{note} のポジション {fret} が高すぎます",
  },
  E_VIOLA_STRETCH_EXCEED: {
    "zh-TW": "中提琴伸展 {stretch} 超過 {max}",
    en: "Viola stretch {stretch} exceeds {max}",
    ja: "ヴィオラの指の開き {stretch} が {max} を超えています",
  },
  E_CELLO_FRET_TOO_HIGH: {
    "zh-TW": "{note} 把位 {fret} 過高",
    en: "{note} position {fret} too high",
    ja: "{note} のポジション {fret} が高すぎます",
  },
  E_CELLO_STRETCH_EXCEED: {
    "zh-TW": "大提琴伸展 {stretch} 超過 {max}",
    en: "Cello stretch {stretch} exceeds {max}",
    ja: "チェロの指の開き {stretch} が {max} を超えています",
  },
  E_MONOPHONIC_CHORD: {
    "zh-TW": "{instrument} 為單音樂器, 不能同時奏 {chord_size} 音",
    en:
      "{instrument} is monophonic, cannot play {chord_size} notes "
      + "simultaneously",
    ja:
      "{instrument} は単音楽器のため、{chord_size} 音を同時に演奏できません",
  },
  E_PIANO_HAND_SPAN: {
    "zh-TW": "鋼琴單手張開 {span} 超過 {max} 半音",
    en: "Piano hand span {span} exceeds max {max} semitones",
    ja: "ピアノの片手の開き {span} が {max} 半音を超えています",
  },
  // Warnings
  W_PITCH_OUT_OF_COMFORTABLE: {
    "zh-TW": "{instrument} 此音 {pitch} 超出舒適音域",
    en: "{instrument} pitch {pitch} outside comfortable range",
    ja: "{instrument} の音 {pitch} が無理のない音域を外れています",
  },
  W_PITCH_EXTREME: {
    "zh-TW": "{instrument} 此音 {pitch} 接近極限音域",
    en: "{instrument} pitch {pitch} near extreme range",
    ja: "{instrument} の音 {pitch} が音域の限界に近づいています",
  },
  W_VIOLIN_STRETCH_LARGE: {
    "zh-TW": "把位伸展 {stretch} 大於舒適範圍 {comfortable}",
    en: "Stretch {stretch} larger than comfortable {comfortable}",
    ja: "指の開き {stretch} が無理のない範囲 {comfortable} より大きくなっています",
  },
  W_VIOLA_STRETCH_LARGE: {
    "zh-TW": "中提琴伸展較大 {stretch}",
    en: "Viola large stretch {stretch}",
    ja: "ヴィオラの指の開きが大きめです {stretch}",
  },
  W_CELLO_STRETCH_LARGE: {
    "zh-TW": "大提琴伸展較大 {stretch}",
    en: "Cello large stretch {stretch}",
    ja: "チェロの指の開きが大きめです {stretch}",
  },
  W_VIOLIN_TRIPLE_QUAD_STOP: {
    "zh-TW": "三/四音和弦, 需快速分弓",
    en: "Triple/quadruple stop, requires fast separated bowing",
    ja: "三重音・四重音のため、素早い分割ボウイングが必要です",
  },
  W_VIOLA_TRIPLE_QUAD_STOP: {
    "zh-TW": "中提琴三/四音和弦",
    en: "Viola triple/quadruple stop",
    ja: "ヴィオラの三重音・四重音です",
  },
  W_CELLO_TRIPLE_QUAD_STOP: {
    "zh-TW": "大提琴三/四音和弦, 較困難",
    en: "Cello triple/quadruple stop, difficult",
    ja: "チェロの三重音・四重音のため、難度が高めです",
  },
  W_PARALLEL_FIFTHS: {
    "zh-TW": "平行五度 (m.{from_measure}→{to_measure}) — 古典聲部寫作應避免",
    en:
      "Parallel fifths (m.{from_measure}→{to_measure}) — "
      + "avoid in classical voice leading",
    ja:
      "平行5度 (m.{from_measure}→{to_measure}) — "
      + "古典的な声部進行では避けるべきです",
  },
  W_PARALLEL_OCTAVES: {
    "zh-TW": "平行八度 (m.{from_measure}→{to_measure}) — 古典聲部寫作應避免",
    en:
      "Parallel octaves (m.{from_measure}→{to_measure}) — "
      + "avoid in classical voice leading",
    ja:
      "平行8度 (m.{from_measure}→{to_measure}) — "
      + "古典的な声部進行では避けるべきです",
  },
  // 豎琴 (harp)
  E_HARP_SAME_STRING: {
    "zh-TW":
      "{instrument} {pitches} 共用同一根 {letter}{octave} 弦, 無法同時發聲",
    en:
      "{instrument} {pitches} share the same {letter}{octave} string and "
      + "cannot sound together",
    ja:
      "{instrument} の {pitches} が同じ {letter}{octave} 弦を共有しており、"
      + "同時に発音できません",
  },
  E_HARP_TOO_MANY_NOTES: {
    "zh-TW": "{instrument} 和弦 {chord_size} 音超過雙手合計上限 {max}",
    en:
      "{instrument} chord of {chord_size} exceeds the {max}-note "
      + "two-hand limit",
    ja:
      "{instrument} の {chord_size} 音の和音が両手合計の上限 {max} 音を"
      + "超えています",
  },
  W_HARP_WIDE_SPAN: {
    "zh-TW": "{instrument} 和弦跨度 {span_semitones} 半音過寬, 通常須琶音",
    en:
      "{instrument} chord span of {span_semitones} semitones is wide, "
      + "usually needs arpeggiation",
    ja:
      "{instrument} の和音の幅 {span_semitones} 半音が広く、"
      + "通常はアルペジオが必要です",
  },
  // 有品撥弦樂器 (吉他 / 魯特琴)
  E_FRETTED_CHORD_INFEASIBLE: {
    "zh-TW": "{instrument} 此和弦找不到可行指法",
    en: "{instrument} chord has no feasible fingering",
    ja: "{instrument} のこの和音には実行可能な運指が見つかりません",
  },
  E_FRETTED_FRET_TOO_HIGH: {
    "zh-TW": "{instrument} 把位 {fret} 超過最高可用把位 {max}",
    en: "{instrument} position {fret} exceeds the highest usable fret {max}",
    ja: "{instrument} のポジション {fret} が使用可能な最高フレット {max} を超えています",
  },
  W_FRETTED_STRETCH_LARGE: {
    "zh-TW": "{instrument} 把位伸展 {stretch} 大於舒適範圍 {comfortable}",
    en:
      "{instrument} stretch of {stretch} is larger than the comfortable "
      + "{comfortable}",
    ja:
      "{instrument} の指の開き {stretch} が無理のない範囲 {comfortable} "
      + "より大きくなっています",
  },
  W_FRETTED_HIGH_POSITION: {
    "zh-TW": "{instrument} 把位 {fret} 偏高, 技術難度較高",
    en: "{instrument} position {fret} is high, more technically demanding",
    ja: "{instrument} のポジション {fret} が高めで、技術的な難度が高くなります",
  },
};

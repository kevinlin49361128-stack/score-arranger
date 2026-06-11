/**
 * expressivity — 譜面感知表現力 (音色 B 路線, NotePerformer-lite v1)。
 *
 * 「假」的最大來源常不是音色而是演奏呆板: 每個音等力度、等間距、零重疊。
 * 本模組對單一聲部的 note stream 做三件事 (純函式、確定性、不動 onset —
 * onset 不動 = 跨聲部零失步風險, 播放游標也不受影響):
 *
 *   1. 樂句弧線力度 — 以音間空隙切樂句, 句內力度套「起句稍弱 → 高點 (~60%
 *      位置) → 句尾收束」的弧線 (幅度刻意細微, ±10% 內)。
 *   2. 終止式微緩 — 句尾音時值 ×1.15 (僅時值, 不推移後續 onset), 模擬
 *      樂句收尾的呼吸感。
 *   3. 真連奏重疊 — 句內相鄰兩音幾乎無縫 (gap < 30ms) 且時值夠長時, 前音
 *      延長到與後音重疊 ~50ms — sampler release 自然交疊, 消除「逐音斷開」
 *      的機械感。
 *
 * v1 邊界 (刻意不做): onset 微移 (agogics rubato)、長音內 crossfade 漸強、
 * pizz/tremolo articulation 切換 (需引擎 per-note 資料路徑) — 列為 B-v2。
 */

export interface ExprNote {
  /** 起始秒 (排程前、stretch 前的 MIDI 時間) */
  time: number;
  duration: number;
  /** 0..1 */
  velocity: number;
}

/** 音間空隙 ≥ 此值 (秒) 視為樂句邊界。 */
const PHRASE_GAP_SEC = 0.25;
/** 樂句至少要有這麼多音才套弧線 (太短的句子套了只會怪)。 */
const MIN_PHRASE_NOTES = 3;
/** 弧線幅度: 高點 +6%, 起句 -6%, 句尾 -10% (線性內插)。 */
const ARC_PEAK_GAIN = 0.06;
const ARC_START_DIP = -0.06;
const ARC_END_DIP = -0.1;
/** 弧線高點落在樂句的這個位置 (0..1)。 */
const ARC_PEAK_POS = 0.6;
/** 終止式微緩: 句尾音時值倍率。 */
const CADENCE_STRETCH = 1.15;
/** 連奏: 視為「無縫」的最大 gap (秒) 與前音須達到的最短時值。 */
const LEGATO_MAX_GAP = 0.03;
const LEGATO_MIN_DUR = 0.25;
/** 連奏重疊量 (秒)。 */
const LEGATO_OVERLAP = 0.05;

/** 以音間空隙切樂句 — 回傳每個樂句的 [起, 迄) index 區間 (notes 須已按 time 排序)。 */
export function segmentPhrases(
  notes: readonly ExprNote[],
  gapSec: number = PHRASE_GAP_SEC,
): Array<[number, number]> {
  if (notes.length === 0) return [];
  const spans: Array<[number, number]> = [];
  let start = 0;
  for (let i = 1; i < notes.length; i++) {
    const prevEnd = notes[i - 1].time + notes[i - 1].duration;
    if (notes[i].time - prevEnd >= gapSec) {
      spans.push([start, i]);
      start = i;
    }
  }
  spans.push([start, notes.length]);
  return spans;
}

/** 樂句弧線的力度倍率 (pos: 0..1 句內位置)。 */
function arcGain(pos: number): number {
  if (pos <= ARC_PEAK_POS) {
    const t = pos / ARC_PEAK_POS;
    return 1 + ARC_START_DIP + (ARC_PEAK_GAIN - ARC_START_DIP) * t;
  }
  const t = (pos - ARC_PEAK_POS) / (1 - ARC_PEAK_POS);
  return 1 + ARC_PEAK_GAIN + (ARC_END_DIP - ARC_PEAK_GAIN) * t;
}

/**
 * 對單一聲部套表現力造型。回傳調整後的新陣列 (不改輸入); 只動
 * velocity / duration, 絕不動 time。
 */
export function shapePhrasing<T extends ExprNote>(notes: readonly T[]): T[] {
  // 確保時間序 (MIDI track 理論上已排序; 防衛性排一次, 不改輸入)
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const out = sorted.map((n) => ({ ...n }));
  const spans = segmentPhrases(out);

  for (const [s, e] of spans) {
    const len = e - s;

    if (len >= MIN_PHRASE_NOTES) {
      // 1) 弧線力度 — 位置用「第幾個音」而非時間: 句尾音永遠拿到完整收束
      //   (時間位置算 onset 永遠到不了 1.0), 節奏不均的樂句也穩定。
      for (let i = s; i < e; i++) {
        const pos = (i - s) / (len - 1);
        out[i].velocity = Math.min(
          1,
          Math.max(0.05, out[i].velocity * arcGain(pos)),
        );
      }
      // 2) 終止式微緩 (句尾音時值; 不推 onset)
      out[e - 1].duration *= CADENCE_STRETCH;
    }

    // 3) 句內真連奏重疊
    for (let i = s; i < e - 1; i++) {
      const gap = out[i + 1].time - (out[i].time + out[i].duration);
      if (gap >= 0 && gap < LEGATO_MAX_GAP && out[i].duration >= LEGATO_MIN_DUR) {
        out[i].duration = out[i + 1].time - out[i].time + LEGATO_OVERLAP;
      }
    }
  }
  return out;
}

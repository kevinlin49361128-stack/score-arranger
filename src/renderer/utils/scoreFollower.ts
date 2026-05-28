/**
 * scoreFollower — 0.1.54 H: 即時麥克風跟拍 (score follow)
 *
 * 給 MicPracticePanel 的 "follow" 模式用. 輸入: 最近幾個 PitchSample +
 * 目標旋律的 (measure, midi) 序列 + start hint (上一輪結果). 輸出: 目前
 * 推估在第幾小節 + 信心度.
 *
 * 設計選擇 (避免博士論文等級複雜度):
 * - 不做 onset detection / DTW / HMM. 只看音高序列.
 * - 不做和聲偵測, 只追主旋律 (target_score.parts[0] voice "1" 頂音).
 * - sliding window 搜尋: 在 startHint ±SEARCH_RADIUS 小節範圍內找
 *   最匹配 onset 位置. 「最匹配」= 多數 sample 的 midi 跟目標 onset
 *   附近的音相符. 用 chroma (mod 12) 匹配避免八度誤判.
 * - confidence = 匹配音數 / 視窗 sample 數.
 *
 * Trade-off: 不追節奏只追音高, 所以速度漂移後仍能定位; 但連續同音的
 * 段落會 ambiguous (信心降低), 由呼叫端用 confidence 門檻過濾.
 */

import type { ArrangementResult } from "@shared/types";
import type { PitchSample } from "./pitchMonitor";

/** 旋律 onset — 一個音 (或一個和弦頂音) 在第幾小節. */
export interface MelodyPitch {
  measure: number;
  midi: number;
}

export interface FollowResult {
  /** 推估的當前小節. */
  measure: number;
  /** 0-1 信心度 — 視窗內幾個 sample 命中. */
  confidence: number;
}

/**
 * 從 target_score 抽出主旋律 (measure, midi) 序列.
 *
 * 主旋律定義: parts[0] (改編成果裡的最高聲部) voice "1" 的所有
 * NoteEvent / ChordEvent. ChordEvent 取最高音 (頂音 = 旋律).
 * RestEvent 跳過.
 *
 * 序列化結構: to_dict() 把 dict key 轉成 str, 所以 voices 是 {"1": ...}
 * 而非 {1: ...}. __type__ 用來區別 NoteEvent / ChordEvent / RestEvent.
 */
export function extractMelodyPitches(
  arrangement: ArrangementResult | null,
): MelodyPitch[] {
  if (!arrangement) return [];
  const score = arrangement.target_score as ScoreLike | null | undefined;
  if (!score?.parts || score.parts.length === 0) return [];
  const part = score.parts[0];
  if (!part?.measures) return [];

  const out: MelodyPitch[] = [];
  for (const m of part.measures) {
    if (!m?.voices) continue;
    const v = m.voices["1"];
    if (!v?.events) continue;
    for (const ev of v.events) {
      if (!ev || typeof ev !== "object") continue;
      const type = (ev as { __type__?: string }).__type__;
      if (type === "NoteEvent") {
        const midi = (ev as NoteEventLike).pitch?.midi_number;
        if (typeof midi === "number") {
          out.push({ measure: m.number, midi });
        }
      } else if (type === "ChordEvent") {
        const pitches = (ev as ChordEventLike).pitches;
        if (Array.isArray(pitches) && pitches.length > 0) {
          // 頂音 = 旋律. ChordEvent 不保證排序, 取最大值.
          let top = -Infinity;
          for (const p of pitches) {
            if (typeof p?.midi_number === "number" && p.midi_number > top) {
              top = p.midi_number;
            }
          }
          if (top > -Infinity) {
            out.push({ measure: m.number, midi: top });
          }
        }
      }
      // RestEvent / unknown — 跳過
    }
  }
  return out;
}

const SEARCH_RADIUS = 2;

/**
 * 用最近 sample 序列找當前位置.
 *
 * 演算法:
 * 1. 從 recent 抽出穩定的 midi 列表 (略過 null / 八度不一致的轉瞬).
 * 2. 在 startHint ± SEARCH_RADIUS 小節 範圍, 對每個 melody onset 算分數:
 *    sample midi 的 chroma (mod 12) 跟 onset 附近 ±3 個 onset 的 chroma
 *    任一相符 → 命中 +1.
 * 3. 取分數最高的位置. confidence = 命中數 / sample 數.
 *
 * 為什麼用 chroma 不直接比 midi: 業餘演奏八度容易誤判 (麥克風遠 / 弦樂
 * 泛音), 同 pitch class 已經夠定位.
 */
export function findCurrentMeasure(
  recent: PitchSample[],
  melody: MelodyPitch[],
  startHint: number,
): FollowResult {
  // 抽出有效 midi (略過無音 / clarity 太低 — PitchMonitor 已過濾, midi=null 即無效)
  const midis: number[] = [];
  for (const s of recent) {
    if (s.midi !== null) midis.push(s.midi);
  }
  if (midis.length === 0 || melody.length === 0) {
    return { measure: startHint, confidence: 0 };
  }

  // 搜尋窗 — startHint ± SEARCH_RADIUS 小節
  const winLo = startHint - SEARCH_RADIUS;
  const winHi = startHint + SEARCH_RADIUS;
  const candidates: number[] = [];
  for (let i = 0; i < melody.length; i++) {
    const m = melody[i].measure;
    if (m >= winLo && m <= winHi) candidates.push(i);
  }
  if (candidates.length === 0) {
    // 視窗內沒有 onset (空小節?) — fallback: 全域線性掃
    for (let i = 0; i < melody.length; i++) candidates.push(i);
  }

  let bestScore = -1;
  let bestIdx = candidates[0];
  let bestDistFromHint = Infinity;
  // ±LOCAL onset 寬容 — 業餘速度漂移, 拉到下一個或上一個 onset 都算對位.
  // 但這寬容會讓多個候選位置同分, 因此 tie-break 用「離 startHint 最近」,
  // 同時 LOCAL 不能太大 (太大連 chroma 簡單的小節都會被當鄰居匹配).
  const LOCAL = 1;
  for (const idx of candidates) {
    let hits = 0;
    for (const m of midis) {
      const samplePc = ((m % 12) + 12) % 12;
      const lo = Math.max(0, idx - LOCAL);
      const hi = Math.min(melody.length - 1, idx + LOCAL);
      let matched = false;
      for (let j = lo; j <= hi; j++) {
        const targetPc = ((melody[j].midi % 12) + 12) % 12;
        if (samplePc === targetPc) {
          matched = true;
          break;
        }
      }
      if (matched) hits++;
    }
    const distFromHint = Math.abs(melody[idx].measure - startHint);
    // 嚴格優先分數; 同分時 tie-break 靠近 hint
    if (
      hits > bestScore
      || (hits === bestScore && distFromHint < bestDistFromHint)
    ) {
      bestScore = hits;
      bestIdx = idx;
      bestDistFromHint = distFromHint;
    }
  }

  const confidence = midis.length > 0 ? bestScore / midis.length : 0;
  return {
    measure: melody[bestIdx].measure,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

/**
 * 拉的音 vs 期望音的偏差 — 給 UI 標紅 "偏低 / 偏高 N 半音".
 * 回 null 表示無偏差資訊 (沒音 / 沒找到 expected). 取絕對值 ≤ 1 視為對.
 *
 * expectedMidi 來源: 用 findCurrentMeasure 回的 measure, 找 melody 在
 * 該小節的第一個 onset (或最接近的). 簡化: 接受 measure → midi 推估即可.
 */
export function deviationSemitones(
  playedMidi: number | null,
  expectedMidi: number | null,
): number | null {
  if (playedMidi === null || expectedMidi === null) return null;
  // chroma 差 — 把 ±6 內視為「同 pitch class 的最短距離」, 避開八度
  let d = (playedMidi - expectedMidi) % 12;
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}

/** 找 melody 在指定 measure 的第一個 (預期) midi. */
export function expectedMidiForMeasure(
  melody: MelodyPitch[],
  measure: number,
): number | null {
  for (const m of melody) {
    if (m.measure === measure) return m.midi;
  }
  return null;
}

// ============================================================================
// IR 序列化結構的 local view — target_score 在 shared/types.ts 是 unknown,
// 這裡只取我們需要的部分 (其餘維持 unknown 不撈, 避免跨層耦合).
// ============================================================================

interface ScoreLike {
  parts?: PartLike[];
}

interface PartLike {
  measures?: MeasureLike[];
}

interface MeasureLike {
  number: number;
  voices?: Record<string, VoiceLike>;
}

interface VoiceLike {
  events?: unknown[];
}

interface NoteEventLike {
  pitch?: { midi_number?: number };
}

interface ChordEventLike {
  pitches?: { midi_number?: number }[];
}

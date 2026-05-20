/**
 * measureDiff — 比對兩份 MusicXML, 找出有差異的 measure number
 *
 * 演算法:
 * 1. 對每個 part 抓出 <measure number="N">...</measure> 區塊
 * 2. 同 measure number 跨所有 parts 串接成 signature, 簡單 hash
 * 3. 比對 hash, 不同就標記
 *
 * 缺陷:
 * - 不分 staff, 任何子元素改動都算 diff
 * - 不處理 part 結構變動
 *
 * 但對「同一改編微調 → 比較哪些 measure 變了」這個情境足夠。
 */

interface MeasureSig {
  measure: number;
  hash: number;
}

/** 粗略快速 hash: 32-bit FNV-1a */
function quickHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 取出每個 measure 的 signatures (合併所有 part) */
function extractMeasureSigs(xml: string): MeasureSig[] {
  const sigsByMeasure = new Map<number, string[]>();
  // 用 regex 一次掃完所有 <measure number="N">...</measure>
  // (m | i 不會跨多行貪婪夠了, MusicXML 結構足以匹配)
  const re = /<measure\b[^>]*\bnumber="(\d+)"[^>]*>([\s\S]*?)<\/measure>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const num = parseInt(m[1], 10);
    if (Number.isFinite(num)) {
      if (!sigsByMeasure.has(num)) sigsByMeasure.set(num, []);
      // 把屬性的次序差異消掉 (例如 default-x/default-y 可能改變)
      const cleaned = m[2]
        .replace(/\s+default-[xy]="[^"]*"/g, "")
        .replace(/\s+/g, " ")
        .trim();
      sigsByMeasure.get(num)!.push(cleaned);
    }
  }
  const result: MeasureSig[] = [];
  for (const [num, parts] of sigsByMeasure) {
    result.push({ measure: num, hash: quickHash(parts.join("|")) });
  }
  return result;
}

/**
 * 比對兩份 MusicXML, 回傳「有差異」的 measure number 集合。
 * 若只在其中一邊出現的 measure, 也算 diff。
 */
export function diffMeasures(xmlA: string, xmlB: string): Set<number> {
  const a = new Map(
    extractMeasureSigs(xmlA).map((s) => [s.measure, s.hash]),
  );
  const b = new Map(
    extractMeasureSigs(xmlB).map((s) => [s.measure, s.hash]),
  );
  const diff = new Set<number>();
  const allMeasures = new Set([...a.keys(), ...b.keys()]);
  for (const m of allMeasures) {
    if (a.get(m) !== b.get(m)) diff.add(m);
  }
  return diff;
}

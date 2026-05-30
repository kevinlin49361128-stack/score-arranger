/**
 * 0.1.61: 從 MusicXML 字串抽出起始速度 + 拍號 (節拍器自動同步用)。
 *
 * 為什麼用 regex 而非 DOMParser: 這函式也要能在 node (vitest) 跑單元測試,
 * 不依賴瀏覽器 DOM。樂譜開啟後 sourceMusicXML 已在 store, 直接抽即可,
 * 不必再往引擎跑一趟。改編後改用引擎 canonical 的 arrangement.tempo。
 */
export interface ParsedTempo {
  /** ♩= 每分鐘拍數 (取 metronome <per-minute>, 退而求其次 <sound tempo>) */
  bpm: number | null;
  numerator: number | null;
  denominator: number | null;
}

export function parseMusicXmlTempo(
  xml: string | null | undefined,
): ParsedTempo | null {
  if (!xml) return null;

  let bpm: number | null = null;
  const perMinute = xml.match(/<per-minute>\s*([\d.]+)\s*<\/per-minute>/);
  if (perMinute) bpm = Math.round(parseFloat(perMinute[1]));
  if (bpm === null) {
    const sound = xml.match(/<sound[^>]*\btempo="([\d.]+)"/);
    if (sound) bpm = Math.round(parseFloat(sound[1]));
  }
  if (bpm !== null && (!Number.isFinite(bpm) || bpm <= 0)) bpm = null;

  let numerator: number | null = null;
  let denominator: number | null = null;
  const time = xml.match(
    /<beats>\s*(\d+)\s*<\/beats>\s*<beat-type>\s*(\d+)\s*<\/beat-type>/,
  );
  if (time) {
    numerator = parseInt(time[1], 10);
    denominator = parseInt(time[2], 10);
  }

  if (bpm === null && numerator === null) return null;
  return { bpm, numerator, denominator };
}

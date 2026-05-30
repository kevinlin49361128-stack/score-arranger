/**
 * 0.1.61: 義大利速度術語 ↔ BPM 對照。
 *
 * 播放速度顯示 (F4)、節拍器義式術語 (D4) 共用。
 * 範圍採常見的非重疊分割 (各家略有出入, 取通行值); typical 給「點術語 → 設 BPM」用。
 */
export interface TempoTerm {
  term: string;
  /** 含下界 BPM */
  min: number;
  /** 不含上界 BPM (最後一項為 Infinity) */
  max: number;
  /** 代表值 — 點此術語時套用的 BPM */
  typical: number;
}

export const TEMPO_TERMS: readonly TempoTerm[] = [
  { term: "Grave", min: 0, max: 40, typical: 35 },
  { term: "Largo", min: 40, max: 60, typical: 50 },
  { term: "Larghetto", min: 60, max: 66, typical: 63 },
  { term: "Adagio", min: 66, max: 76, typical: 70 },
  { term: "Andante", min: 76, max: 108, typical: 92 },
  { term: "Moderato", min: 108, max: 120, typical: 114 },
  { term: "Allegro", min: 120, max: 156, typical: 138 },
  { term: "Vivace", min: 156, max: 176, typical: 166 },
  { term: "Presto", min: 176, max: 200, typical: 184 },
  { term: "Prestissimo", min: 200, max: Infinity, typical: 210 },
] as const;

/** BPM → 義式術語 (Andante 等)。 */
export function bpmToTempoTerm(bpm: number): string {
  for (const t of TEMPO_TERMS) {
    if (bpm >= t.min && bpm < t.max) return t.term;
  }
  return TEMPO_TERMS[TEMPO_TERMS.length - 1].term;
}

/** 義式術語 → 代表 BPM (找不到回 null)。 */
export function tempoTermToBpm(term: string): number | null {
  const found = TEMPO_TERMS.find(
    (t) => t.term.toLowerCase() === term.trim().toLowerCase(),
  );
  return found ? found.typical : null;
}

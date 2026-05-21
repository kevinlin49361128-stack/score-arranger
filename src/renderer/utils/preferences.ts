/**
 * preferences — 使用者偏好學習
 *
 * 累積使用者對「修復建議」的回饋:
 *  - apply 一個建議 → 計 +1 (positive)
 *  - apply 後 undo → 計 -1 (negative)
 *  - 純 hover 預覽不計 (避免雜訊)
 *
 * 結果: 每個 suggestion_code 的 net score, 越高代表使用者偏愛它。
 * 用於提示 IssuePanel 把使用者偏好的建議排前面。
 *
 * 資料保存於 localStorage, 跨 session 持續累積。
 */

const STORAGE_KEY = "score-arranger.preferences";

interface PrefData {
  /** suggestion_code → net score (positive 越多代表偏愛) */
  scores: Record<string, number>;
  /** 上次更新時間, 偵錯用 */
  updatedAt: number;
}

function load(): PrefData {
  if (typeof window === "undefined") {
    return { scores: {}, updatedAt: 0 };
  }
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { scores: {}, updatedAt: 0 };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.scores === "object") return parsed as PrefData;
  } catch {
    /* ignore */
  }
  return { scores: {}, updatedAt: 0 };
}

function save(data: PrefData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

// 短期記憶: 最近一次 apply 的 suggestionCode + 時間, 給 undo 推斷用
let _lastApplied: { code: string; at: number } | null = null;
const UNDO_WINDOW_MS = 30_000;

/** 使用者套用了某個建議 → +1 */
export function recordApply(suggestionCode: string): void {
  const data = load();
  data.scores[suggestionCode] = (data.scores[suggestionCode] ?? 0) + 1;
  data.updatedAt = Date.now();
  save(data);
  _lastApplied = { code: suggestionCode, at: Date.now() };
}

/** 通用 undo 觸發: 若在 30 秒內 apply 過, 視為對該 suggestion 不滿意 → -1 */
export function recordUndoIfRecent(): void {
  if (!_lastApplied) return;
  if (Date.now() - _lastApplied.at > UNDO_WINDOW_MS) {
    _lastApplied = null;
    return;
  }
  recordUndo(_lastApplied.code);
  _lastApplied = null;
}

/** 使用者 undo 後 (推測為不喜歡) → -1, 但不低於 -5 */
export function recordUndo(suggestionCode: string): void {
  const data = load();
  const cur = data.scores[suggestionCode] ?? 0;
  data.scores[suggestionCode] = Math.max(-5, cur - 1);
  data.updatedAt = Date.now();
  save(data);
}

/** 取得某 suggestion 的 score, 給排序用 */
export function getScore(suggestionCode: string): number {
  return load().scores[suggestionCode] ?? 0;
}

/** 取得全部 score (debug / 設定畫面用) */
export function getAllScores(): Record<string, number> {
  return load().scores;
}

/** 重置所有偏好 (設定畫面提供入口) */
export function resetPreferences(): void {
  save({ scores: {}, updatedAt: Date.now() });
}

/** suggestion code → 對應的 repair 策略名 (對齊 server.py 的 _SUGGESTION_STRATEGY) */
const SUGGESTION_TO_STRATEGY: Record<string, string> = {
  S_OCTAVE_UP: "octave_shift",
  S_OCTAVE_DOWN: "octave_shift",
  S_OMIT_NOTE: "omit_note",
  S_OMIT_INNER_VOICE: "omit_note",
  S_REDISTRIBUTE_HANDS: "split_to_other_hand",
  S_OCTAVE_TRANSPOSE_OUTER: "split_to_other_hand",
};

/**
 * 從建議偏好推導「修復策略」的偏好順序 — 傳給引擎的 repair loop,
 * 讓自動修復在多個同等選項中優先採用使用者偏愛的策略。
 * 無偏好資料 → 回傳 [] (引擎沿用預設策略順序)。
 */
export function getStrategyPreference(): string[] {
  const scores = getAllScores();
  const byStrategy: Record<string, number> = {};
  for (const [code, sc] of Object.entries(scores)) {
    const strat = SUGGESTION_TO_STRATEGY[code];
    if (strat) byStrategy[strat] = (byStrategy[strat] ?? 0) + sc;
  }
  return Object.entries(byStrategy)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);
}

/** 把 suggestions 依使用者偏好排序 (穩定排序保留原順序) */
export function sortByPreference<T extends { code: string }>(
  suggestions: T[],
): T[] {
  const scored = suggestions.map((s, i) => ({
    item: s,
    idx: i,
    score: getScore(s.code),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });
  return scored.map((s) => s.item);
}

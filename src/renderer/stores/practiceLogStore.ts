/**
 * practiceLogStore — 0.1.54 E 練習日誌
 *
 * 痛點: amateur 練了一個月不知道有沒有進步; 沒有「上次練到哪」的紀錄.
 *
 * 設計:
 * - 純 localStorage 持久化 (隱私: 練習資料不離開電腦)
 * - 一筆記錄一次練習 session: 開譜 → 練 → 切譜 / 關 App
 * - 麥克風練習評分若有, 自動寫入該 session
 * - 沒做雲端同步 — 練習日誌是個人化的, 不需要跨設備
 *
 * 整合點:
 * - PracticePanel: 進入 → startSession; 切譜或關 → endSession (auto)
 * - MicPracticePanel: 完成評分 → addMicScore
 *
 * mirror studentStore 的 useSyncExternalStore + localStorage 模式,
 * 避免 sessionStore 再膨脹.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "score-arranger.practice-log.v1";

export interface PracticeEntry {
  id: string;
  /** ISO timestamp ms 開始時間 */
  started_at: number;
  /** ISO timestamp ms 結束時間 — undefined = session 仍進行中 */
  ended_at?: number;
  /** 曲目識別 — 來自 repertoire catalog id, 或 source_path 雜湊 */
  score_id?: string;
  /** 顯示用標題 */
  score_title?: string;
  /** 上次練到哪一個小節 (1-based) — PracticePanel 結束 session 時填 */
  last_measure?: number;
  /** 麥克風評估分數 0-100 — 若有跑 MicPracticePanel */
  mic_score?: number;
  /** 使用者手寫筆記 */
  notes?: string;
}

function load(): PracticeEntry[] {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(entries: PracticeEntry[]): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / 隱私模式 → 靜默失敗 */
  }
}

let _cache: PracticeEntry[] = load();
const _listeners = new Set<() => void>();

function notify(): void {
  for (const l of _listeners) l();
}

function subscribe(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function getSnapshot(): PracticeEntry[] {
  return _cache;
}

export function usePracticeLog(): PracticeEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function genId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 開始 session — 回傳 entry id 給 caller 後續 endSession / addMicScore 用.
 * 若有未結束的 session (e.g. 切譜沒觸發 endSession), 自動結束舊的.
 */
export function startPracticeSession(
  score_id?: string,
  score_title?: string,
): string {
  // 結束所有未結束的 session — 避免「忘記關」累積
  const now = Date.now();
  const updated = _cache.map((e) =>
    e.ended_at === undefined ? { ...e, ended_at: now } : e,
  );
  const id = genId();
  const entry: PracticeEntry = {
    id,
    started_at: now,
    score_id,
    score_title,
  };
  _cache = [entry, ...updated];
  save(_cache);
  notify();
  return id;
}

/**
 * 結束 session — 寫入 ended_at + last_measure (若有).
 * 若 entry 已 ended, no-op.
 */
export function endPracticeSession(
  id: string,
  last_measure?: number,
): void {
  let touched = false;
  _cache = _cache.map((e) => {
    if (e.id !== id || e.ended_at !== undefined) return e;
    touched = true;
    return { ...e, ended_at: Date.now(), last_measure };
  });
  if (touched) {
    save(_cache);
    notify();
  }
}

export function addMicScore(id: string, score: number): void {
  let touched = false;
  _cache = _cache.map((e) => {
    if (e.id !== id) return e;
    touched = true;
    return { ...e, mic_score: Math.round(score) };
  });
  if (touched) {
    save(_cache);
    notify();
  }
}

export function setPracticeNote(id: string, notes: string): void {
  let touched = false;
  _cache = _cache.map((e) => {
    if (e.id !== id) return e;
    touched = true;
    return { ...e, notes };
  });
  if (touched) {
    save(_cache);
    notify();
  }
}

export function deletePracticeEntry(id: string): void {
  const before = _cache.length;
  _cache = _cache.filter((e) => e.id !== id);
  if (_cache.length !== before) {
    save(_cache);
    notify();
  }
}

export function clearPracticeLog(): void {
  if (_cache.length === 0) return;
  _cache = [];
  save(_cache);
  notify();
}

// ============================================================================
// Aggregate helpers
// ============================================================================

/**
 * 算 entry 的 duration (分鐘); 未結束的 session 用 now() 代 ended_at.
 */
export function entryDurationMin(entry: PracticeEntry): number {
  const end = entry.ended_at ?? Date.now();
  return Math.max(0, (end - entry.started_at) / 60000);
}

/**
 * 今日累計練習分鐘.
 */
export function todayMinutes(entries: PracticeEntry[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const cutoff = start.getTime();
  return entries
    .filter((e) => e.started_at >= cutoff)
    .reduce((sum, e) => sum + entryDurationMin(e), 0);
}

/**
 * 過去 N 日每日累計分鐘 — 給 bar chart 用.
 * 回 length=days 的 number[], index 0 = today, index N-1 = N-1 天前.
 */
export function dailyMinutes(
  entries: PracticeEntry[],
  days: number = 7,
): number[] {
  const buckets: number[] = new Array(days).fill(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const e of entries) {
    const d = new Date(e.started_at);
    d.setHours(0, 0, 0, 0);
    const daysAgo = Math.floor(
      (today.getTime() - d.getTime()) / 86400000,
    );
    if (daysAgo >= 0 && daysAgo < days) {
      buckets[daysAgo] += entryDurationMin(e);
    }
  }
  return buckets;
}

/**
 * 按 score_id 分組統計練習次數 / 總時數 / 平均麥克風分數.
 */
export function statsByScore(
  entries: PracticeEntry[],
): Map<string, { count: number; totalMin: number; avgMicScore?: number; title?: string }> {
  const m = new Map<
    string,
    { count: number; totalMin: number; micScores: number[]; title?: string }
  >();
  for (const e of entries) {
    if (!e.score_id) continue;
    const cur = m.get(e.score_id) ?? {
      count: 0,
      totalMin: 0,
      micScores: [],
      title: e.score_title,
    };
    cur.count += 1;
    cur.totalMin += entryDurationMin(e);
    if (e.mic_score !== undefined) cur.micScores.push(e.mic_score);
    cur.title = cur.title ?? e.score_title;
    m.set(e.score_id, cur);
  }
  const out = new Map<
    string,
    { count: number; totalMin: number; avgMicScore?: number; title?: string }
  >();
  for (const [k, v] of m) {
    out.set(k, {
      count: v.count,
      totalMin: v.totalMin,
      avgMicScore: v.micScores.length
        ? v.micScores.reduce((a, b) => a + b, 0) / v.micScores.length
        : undefined,
      title: v.title,
    });
  }
  return out;
}

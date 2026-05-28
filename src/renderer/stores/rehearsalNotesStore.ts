/**
 * rehearsalNotesStore — 0.1.56 J 指揮 / 樂手排練筆記
 *
 * 痛點: 指揮看到 "B 段銅管太大聲" / "大提琴這裡要 cresc." 沒地方寫. 排練
 * 字母 (rehearsal marks) 已經由 analyzer 自動產生, SectionNavigator 也
 * 已能跳轉, 缺的是 "註解" 這最後一哩.
 *
 * 設計:
 * - 純 localStorage 持久化 (隱私: 排練筆記不離開電腦)
 * - 以 score_id (sourcePath) + mark_id 為 key
 * - 一個曲目可有多筆 (對應不同 mark / section / measure)
 * - 不做雲端同步 (跟 studentStore / practiceLogStore 一致原則)
 *
 * mirror studentStore / practiceLogStore 的 useSyncExternalStore +
 * localStorage 模式.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "score-arranger.rehearsal-notes.v1";

export interface RehearsalNote {
  /** 曲目識別 — 用 sourcePath (e.g. "corpus:bach/bwv66.6" or file path) */
  score_id: string;
  /** 標的 ID — 通常 rehearsal mark 名稱 (e.g. "A", "B") 或 "m.{N}". */
  mark_id: string;
  /** 對應的小節號 (1-based) — 排序與跳轉用 */
  measure: number;
  /** 使用者寫的筆記內容 */
  notes: string;
  /** 最後更新 timestamp ms */
  updated_at: number;
}

interface Storage {
  /** score_id → mark_id → RehearsalNote */
  [score_id: string]: { [mark_id: string]: RehearsalNote };
}

function load(): Storage {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function save(s: Storage): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota / 隱私模式 → 靜默失敗 */
  }
}

let _cache: Storage = load();
const _listeners = new Set<() => void>();

function notify(): void {
  for (const l of _listeners) l();
}

function subscribe(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function getSnapshot(): Storage {
  return _cache;
}

/**
 * 取出某 score 的所有筆記 (依 measure 排序).
 */
export function useRehearsalNotes(
  score_id: string | null,
): RehearsalNote[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!score_id) return [];
  const map = all[score_id] ?? {};
  return Object.values(map).sort((a, b) => a.measure - b.measure);
}

export function getRehearsalNote(
  score_id: string,
  mark_id: string,
): RehearsalNote | undefined {
  return _cache[score_id]?.[mark_id];
}

export function setRehearsalNote(
  score_id: string,
  mark_id: string,
  measure: number,
  notes: string,
): void {
  const next = { ..._cache };
  next[score_id] = { ...(next[score_id] ?? {}) };
  if (notes.trim() === "") {
    // 空字串 = 刪除這筆 (避免 localStorage 累積空白條目)
    delete next[score_id][mark_id];
    if (Object.keys(next[score_id]).length === 0) {
      delete next[score_id];
    }
  } else {
    next[score_id][mark_id] = {
      score_id,
      mark_id,
      measure,
      notes,
      updated_at: Date.now(),
    };
  }
  _cache = next;
  save(_cache);
  notify();
}

export function clearRehearsalNotes(score_id: string): void {
  if (!(score_id in _cache)) return;
  const next = { ..._cache };
  delete next[score_id];
  _cache = next;
  save(_cache);
  notify();
}

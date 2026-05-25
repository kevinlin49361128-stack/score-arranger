/**
 * studentStore — 0.1.39 「我的學生」資料模型
 *
 * 痛點: 音樂老師工作流的起點是「為 Sarah 改編」, 不是「3.5 分難度」.
 * 工具對學生一無所知, 每次都得重新跟難度滑桿打交道.
 *
 * 設計:
 * - 純 localStorage 持久化 (隱私: 學生資料不離開電腦)
 * - 最小欄位: 名字 / 樂器 / 程度 / 自由筆記
 * - 不做雲端同步 / 不做帳號 — 老師掌控自己資料
 * - 整合: DifficultyBoostDialog 加「為 X 學生」下拉, 選 → 自動套程度,
 *   並把學生描述附在 LLM prompt context 中.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "score-arranger.students.v1";

export interface Student {
  id: string;
  name: string;
  instrument: string;
  /** 程度 1-5, 對齊 boost dialog 的 skill level */
  skill_level: 1 | 2 | 3 | 4 | 5;
  /** 自由筆記 — 例如「移把位只到第3, 跳弓還不熟」, 會餵給 LLM */
  notes: string;
  /** ISO timestamp, 用於排序 */
  updated_at: string;
}

function load(): Student[] {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(students: Student[]): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(students));
  } catch {
    /* quota / 隱私模式 → 靜默失敗, 不影響核心功能 */
  }
}

// 簡單訂閱模型 — 不引入 Zustand. 我們只有一個 students 陣列,
// useSyncExternalStore 就夠. 避免 sessionStore 再膨脹.
let _cache: Student[] = load();
const _listeners = new Set<() => void>();

function notify(): void {
  for (const l of _listeners) l();
}

function subscribe(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function getSnapshot(): Student[] {
  return _cache;
}

export function useStudents(): Student[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function addStudent(input: Omit<Student, "id" | "updated_at">): Student {
  const now = new Date().toISOString();
  const student: Student = {
    ...input,
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    updated_at: now,
  };
  _cache = [..._cache, student];
  save(_cache);
  notify();
  return student;
}

export function updateStudent(
  id: string, patch: Partial<Omit<Student, "id">>,
): void {
  _cache = _cache.map((s) =>
    s.id === id
      ? { ...s, ...patch, updated_at: new Date().toISOString() }
      : s,
  );
  save(_cache);
  notify();
}

export function deleteStudent(id: string): void {
  _cache = _cache.filter((s) => s.id !== id);
  save(_cache);
  notify();
}

export function findStudent(id: string | null): Student | null {
  if (!id) return null;
  return _cache.find((s) => s.id === id) ?? null;
}

// ============================================================================
// EnsembleTemplate — 自訂編制範本 (痛點 3.2)
// ============================================================================
// 「我的 Spring 2026 弦樂三重奏」存起來反覆用, 不必每次重建.

const ENSEMBLE_KEY = "score-arranger.ensembleTemplates.v1";

export interface EnsembleTemplate {
  id: string;
  name: string;
  /** 跟 build_ensemble 共用的 player 結構 — string[] of instrument ids */
  instruments: string[];
  updated_at: string;
}

function loadEnsembles(): EnsembleTemplate[] {
  try {
    const raw = window.localStorage?.getItem(ENSEMBLE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEnsembles(arr: EnsembleTemplate[]): void {
  try {
    window.localStorage?.setItem(ENSEMBLE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

let _ensembleCache: EnsembleTemplate[] = loadEnsembles();
const _ensembleListeners = new Set<() => void>();

export function useEnsembleTemplates(): EnsembleTemplate[] {
  return useSyncExternalStore(
    (cb) => {
      _ensembleListeners.add(cb);
      return () => _ensembleListeners.delete(cb);
    },
    () => _ensembleCache,
    () => _ensembleCache,
  );
}

export function addEnsembleTemplate(
  input: Omit<EnsembleTemplate, "id" | "updated_at">,
): EnsembleTemplate {
  const tpl: EnsembleTemplate = {
    ...input,
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    updated_at: new Date().toISOString(),
  };
  _ensembleCache = [..._ensembleCache, tpl];
  saveEnsembles(_ensembleCache);
  for (const l of _ensembleListeners) l();
  return tpl;
}

export function deleteEnsembleTemplate(id: string): void {
  _ensembleCache = _ensembleCache.filter((t) => t.id !== id);
  saveEnsembles(_ensembleCache);
  for (const l of _ensembleListeners) l();
}


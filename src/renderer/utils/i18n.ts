/**
 * i18n — 介面字串 + 問題代碼翻譯 (zh-TW / en)
 *
 * 翻譯來源依領域拆成多個 i18n.<area>.ts 檔, 每筆 key 以 {zh-TW, en}
 * 雙語並列, 避免兩份字典脫鉤。t(key, params) 為主要入口; React 元件
 * 呼叫一次 useLocale() 訂閱 locale 變更, 切換語言時自動 re-render。
 */

import { useEffect, useState } from "react";

import { DIALOG_STRINGS } from "./i18n.dialogs";
import { EDITING_STRINGS } from "./i18n.editing";
import { IO_STRINGS } from "./i18n.io";
import { ISSUE_STRINGS } from "./i18n.issues";
import { LIBRARY_STRINGS } from "./i18n.library";
import { MODEBAR_STRINGS } from "./i18n.modebar";
import { PANEL_STRINGS } from "./i18n.panels";
import { SHELL_STRINGS } from "./i18n.shell";

export type Locale = "zh-TW" | "en";

/** 一筆 key 的雙語字串。 */
export type BiString = Record<Locale, string>;
/** 領域字典: key → 雙語字串。 */
export type BiDict = Record<string, BiString>;

const STORAGE_KEY = "score-arranger.locale";

let currentLocale: Locale = (() => {
  if (typeof window === "undefined") return "zh-TW";
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (raw === "zh-TW" || raw === "en") return raw;
  } catch {
    /* ignore */
  }
  return "zh-TW";
})();

const listeners = new Set<(l: Locale) => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(l: Locale): void {
  currentLocale = l;
  try {
    window.localStorage?.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
  listeners.forEach((cb) => {
    cb(l);
  });
}

export function onLocaleChange(cb: (l: Locale) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * React hook — 訂閱 locale 變更。元件只要呼叫一次 useLocale(), 切換
 * 語言時就會自動 re-render。回傳當前 locale 供需要時判斷。
 */
export function useLocale(): Locale {
  const [loc, setLoc] = useState(currentLocale);
  useEffect(() => onLocaleChange(setLoc), []);
  return loc;
}

// ============================================================================
// 字典 — 由各領域檔合併
// ============================================================================

type Dict = Record<string, string>;

const SOURCES: BiDict[] = [
  ISSUE_STRINGS,
  MODEBAR_STRINGS,
  SHELL_STRINGS,
  LIBRARY_STRINGS,
  PANEL_STRINGS,
  DIALOG_STRINGS,
  EDITING_STRINGS,
  IO_STRINGS,
];

const DICTS: Record<Locale, Dict> = { "zh-TW": {}, en: {} };
for (const src of SOURCES) {
  for (const [key, bi] of Object.entries(src)) {
    DICTS["zh-TW"][key] = bi["zh-TW"];
    DICTS.en[key] = bi.en;
  }
}

export function addStrings(locale: Locale, dict: Dict): void {
  Object.assign(DICTS[locale], dict);
}

/** 翻譯一個 key; 找不到 → 回退 zh-TW → 再不行回傳 key 本身。 */
export function t(
  code: string,
  params: Record<string, unknown> = {},
): string {
  const tpl = DICTS[currentLocale][code] ?? DICTS["zh-TW"][code] ?? code;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return v == null ? `{${k}}` : String(v);
  });
}

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

export type Locale = "zh-TW" | "en" | "ja";

/** 一筆 key 的三語字串 (繁中 / 英 / 日)。 */
export type BiString = Record<Locale, string>;
/** 領域字典: key → 雙語字串。 */
export type BiDict = Record<string, BiString>;

const STORAGE_KEY = "score-arranger.locale";

/**
 * 第一次開 app 時 — 偵測 OS / 瀏覽器語言, 沒對到回 zh-TW.
 * Why: 預設 zh-TW 對日 / 英母語者第一次開很奇怪. 一旦使用者手動切過,
 * localStorage 會記住, detect 就不再走 — 不會覆蓋使用者偏好.
 * How to apply: 只在 localStorage 沒值時觸發.
 */
function detectSystemLocale(): Locale {
  if (typeof navigator === "undefined") return "zh-TW";
  const langs = navigator.languages?.length
    ? Array.from(navigator.languages)
    : [navigator.language];
  for (const raw of langs) {
    if (!raw) continue;
    const lang = raw.toLowerCase();
    if (lang.startsWith("ja")) return "ja";
    // 所有 zh-* (簡 / 繁 / CN / TW / HK / SG) 一律映到 zh-TW —
    // 我們只支援繁體, 且依台灣框架原則不分簡繁來源.
    if (lang.startsWith("zh")) return "zh-TW";
    if (lang.startsWith("en")) return "en";
  }
  return "zh-TW";
}

let currentLocale: Locale = (() => {
  if (typeof window === "undefined") return "zh-TW";
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (raw === "zh-TW" || raw === "en" || raw === "ja") return raw;
  } catch {
    /* ignore */
  }
  return detectSystemLocale();
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

const DICTS: Record<Locale, Dict> = { "zh-TW": {}, en: {}, ja: {} };
for (const src of SOURCES) {
  for (const [key, bi] of Object.entries(src)) {
    DICTS["zh-TW"][key] = bi["zh-TW"];
    DICTS.en[key] = bi.en;
    DICTS.ja[key] = bi.ja;
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

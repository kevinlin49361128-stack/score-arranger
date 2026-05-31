/**
 * 0.1.66 C2/C3: PracticeSession — 練習狀態的統一 schema + 每曲持久化。
 *
 * 回應架構審查 #6 (狀態散落) 的務實切片: 把練習相關設定收進一個結構,
 * 各面板讀寫同一份 (C2), 並跟著「曲子」存 localStorage、重開恢復 (C3)。
 *
 * 邊界: 節拍器的「音樂內容」(BPM / 拍號 / 重音) 不收在這裡 —— 那些 0.1.62 起
 * 已從樂譜自動同步 (見 MetronomePanel)。這裡收的是「練習偏好」: 怎麼練這首。
 *
 * 持久化分兩處 (各寫各欄位, savePracticeSession 對同一把 key merge, 不互相覆寫):
 * - usePracticeSessionPersistence hook (App 級): countInBars / metronomeSoundId / handFocus
 * - PlaybackControls (0.1.69 C3): loop 選段 / playbackRate / 漸進加速設定
 */
import type { MetronomeSoundId } from "./metronomeSounds";

export interface PracticeSessionSettings {
  /** 練習速度倍率 (1.0 = 原速; PlaybackControls 的 ♩=BPM 選擇器內部值) */
  playbackRate?: number;
  /** 播樂譜前的 count-in 預備拍小節數 (D3) */
  countInBars?: number;
  /** 節拍器音色 (C1 共用) */
  metronomeSoundId?: MetronomeSoundId;
  /** 鋼琴分手練習 */
  handFocus?: "all" | "rh" | "lh";
  /** 段落 loop 範圍 (1-based measure) + 是否啟用 */
  loopStart?: number | null;
  loopEnd?: number | null;
  loopEnabled?: boolean;
  /** F3 段落漸進加速設定 */
  loopAccelEnabled?: boolean;
  loopAccelStep?: number;
  loopAccelMax?: number;
}

const KEY_PREFIX = "sa-practice-v1:";

/** 用樂譜路徑當「曲子」識別 (同一首每次開都同 path)。 */
function keyFor(pieceId: string): string {
  return KEY_PREFIX + pieceId;
}

export function loadPracticeSession(
  pieceId: string | null | undefined,
): PracticeSessionSettings | null {
  if (!pieceId) return null;
  try {
    const raw = localStorage.getItem(keyFor(pieceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function savePracticeSession(
  pieceId: string | null | undefined,
  settings: PracticeSessionSettings,
): void {
  if (!pieceId) return;
  try {
    // 合併既有, 不覆寫尚未納入持久化的欄位
    const prev = loadPracticeSession(pieceId) ?? {};
    localStorage.setItem(keyFor(pieceId), JSON.stringify({ ...prev, ...settings }));
  } catch {
    /* localStorage 滿 / 不可用 → 放棄持久化, 不影響功能 */
  }
}

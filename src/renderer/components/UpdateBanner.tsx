/**
 * UpdateBanner — 0.1.36 自動更新通知
 *
 * Main process 偵測到新版時 (electron-updater) 透過 IPC 通知:
 *   - "update:available" → 顯示「新版 v0.1.x 下載中」灰底 banner
 *   - "update:downloaded" → 升級成「下載完成, 點重啟安裝」橘底 banner + 按鈕
 *
 * 使用者可手動 dismiss; 已 dismiss 的 banner 記錄在 localStorage,
 * 同一版本不會重複跳 (避免騷擾). 重啟安裝後 banner 自然消失.
 *
 * dev mode 不會收到任何事件 (main 端 isDev 跳過 setupAutoUpdater).
 */

import { useEffect, useState } from "react";
import { t, useLocale } from "../utils/i18n";

type State = "available" | "downloaded";

const DISMISS_KEY = "score-arranger.updateBannerDismissed";

export function UpdateBanner() {
  useLocale();
  const [version, setVersion] = useState<string | null>(null);
  const [state, setState] = useState<State>("available");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = (window as { scoreArranger?: ScoreArrangerLike }).scoreArranger;
    if (!api?.update) return;
    const offA = api.update.onAvailable(({ version: v }) => {
      // 同一版本之前已 dismiss 過 → 不再顯示
      if (localStorage.getItem(DISMISS_KEY) === v) return;
      setVersion(v);
      setState("available");
      setDismissed(false);
    });
    const offD = api.update.onDownloaded(({ version: v }) => {
      // 即使之前 dismiss 過, 下載完成是新狀態, 還是要顯示一次
      setVersion(v);
      setState("downloaded");
      setDismissed(false);
    });
    return () => {
      offA?.();
      offD?.();
    };
  }, []);

  if (!version || dismissed) return null;

  const isReady = state === "downloaded";
  const handleInstall = () => {
    const api = (window as { scoreArranger?: ScoreArrangerLike }).scoreArranger;
    api?.update?.install();
  };
  const handleDismiss = () => {
    if (version) localStorage.setItem(DISMISS_KEY, version);
    setDismissed(true);
  };

  return (
    <div
      style={{
        padding: "8px 14px",
        background: isReady ? "var(--accent)" : "var(--bg-tertiary)",
        color: isReady ? "var(--bg-panel)" : "var(--fg-primary)",
        fontSize: 13, display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ flex: 1 }}>
        {isReady
          ? t("update.downloaded", { version })
          : t("update.available", { version })}
      </span>
      {isReady && (
        <button
          onClick={handleInstall}
          style={{
            padding: "4px 14px", fontSize: 13, fontWeight: 600,
            background: "var(--bg-panel)", color: "var(--accent)",
            border: "none", borderRadius: 4, cursor: "pointer",
          }}
        >
          {t("update.restartToInstall")}
        </button>
      )}
      <button
        onClick={handleDismiss}
        title={t("update.dismiss")}
        style={{
          padding: "2px 8px", fontSize: 14, lineHeight: 1,
          background: "transparent", color: "inherit",
          border: "none", cursor: "pointer", opacity: 0.7,
        }}
      >
        ✕
      </button>
    </div>
  );
}

interface ScoreArrangerLike {
  update?: {
    onAvailable: (cb: (info: { version: string }) => void) => () => void;
    onDownloaded: (cb: (info: { version: string }) => void) => () => void;
    install: () => Promise<void>;
  };
}

/**
 * VariantBar — A/B 版本比較
 *
 * 顯示目前 active tab 的所有變體 (版本 A/B/C...), 提供:
 * - 儲存目前 target 為新變體
 * - 點變體 chip 載入該變體
 * - x 刪除變體
 *
 * 使用情境: 使用者執行不同改編參數 (修復 on/off, 不同編制) 並想並排比較,
 * 把每次改編結果存為一個版本, 再快速切換看哪個比較好。
 */

import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

export function VariantBar() {
  useLocale();
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const targetMusicXML = useSessionStore((s) => s.targetMusicXML);
  const saveVariant = useSessionStore((s) => s.saveVariant);
  const loadVariant = useSessionStore((s) => s.loadVariant);
  const deleteVariant = useSessionStore((s) => s.deleteVariant);
  const compareVariantIndex = useSessionStore((s) => s.compareVariantIndex);
  const setCompareVariantIndex = useSessionStore(
    (s) => s.setCompareVariantIndex,
  );

  const tab = tabs.find((t) => t.id === activeTabId);
  const variants = tab?.variants ?? [];

  // 沒改編結果且沒任何變體 → 不顯示
  if (!targetMusicXML && variants.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        background: "var(--bg-tertiary)",
        borderBottom: "1px solid var(--border-light)",
        fontSize: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "var(--fg-muted)", marginRight: 4 }}>
        {t("variant.compareLabel")}
      </span>
      {variants.map((v, idx) => {
        const isCurrent = v.targetMusicXML === targetMusicXML;
        const isCompareTarget = compareVariantIndex === idx && !isCurrent;
        return (
          <div
            key={`${v.createdAt}-${idx}`}
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: 1,
              padding: "3px 6px",
              borderRadius: 12,
              background: isCurrent
                ? "var(--accent)"
                : isCompareTarget
                ? "rgba(124, 92, 255, 0.18)"
                : "var(--button-bg)",
              color: isCurrent
                ? "var(--accent-fg)"
                : isCompareTarget
                ? "rgb(124, 92, 255)"
                : "var(--fg-primary)",
              border: isCompareTarget
                ? "1px solid rgb(124, 92, 255)"
                : "1px solid var(--border)",
              cursor: isCurrent ? "default" : "pointer",
            }}
            title={v.note ?? t("variant.savedAt", {
              time: new Date(v.createdAt).toLocaleString(),
            })}
            onClick={() => !isCurrent && loadVariant(idx)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontWeight: 500, flex: 1 }}>{v.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCompareVariantIndex(
                  compareVariantIndex === idx ? null : idx,
                );
              }}
              disabled={isCurrent}
              style={{
                width: 18,
                height: 16,
                padding: 0,
                marginLeft: 2,
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: isCurrent ? "not-allowed" : "pointer",
                opacity: isCurrent ? 0.3 : (isCompareTarget ? 1 : 0.6),
                fontSize: 11,
              }}
              title={isCompareTarget
                ? t("variant.stopCompare")
                : t("variant.compareDiff")}
            >
              ⇄
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(t("variant.deleteConfirm", { name: v.name }))) {
                  deleteVariant(idx);
                }
              }}
              style={{
                width: 16,
                height: 16,
                padding: 0,
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                opacity: 0.7,
                fontSize: 11,
              }}
              title={t("variant.delete")}
            >
              ×
            </button>
            </div>
            {v.quality && (
              <div
                style={{
                  fontSize: 9,
                  opacity: 0.7,
                  paddingLeft: 2,
                  whiteSpace: "nowrap",
                }}
              >
                {t("variant.quality", {
                  melody: v.quality.melody_preservation.toFixed(2),
                  harmony: v.quality.harmony_completeness.toFixed(2),
                  playability: v.quality.playability.toFixed(2),
                })}
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={() => saveVariant()}
        disabled={!targetMusicXML}
        style={{
          padding: "2px 10px",
          borderRadius: 12,
          border: "1px dashed var(--border)",
          background: "transparent",
          color: "var(--fg-muted)",
          cursor: targetMusicXML ? "pointer" : "not-allowed",
          fontSize: 11,
        }}
        title={t("variant.saveAs.title")}
      >
        {t("variant.saveAs")}
      </button>
    </div>
  );
}

/**
 * PdfImportWarningDialog — PDF 匯入前的「預防針」提醒
 *
 * PDF 樂譜得先靠 OMR (光學樂譜辨識) 轉成 MusicXML, 這類辨識本質上不穩定。
 * 在使用者花 1-3 分鐘等辨識、拿到髒資料才驚訝之前, 先把預期講清楚, 並
 * 提醒手上若有 MusicXML / MIDI 應優先使用。
 */

import { t, useLocale } from "../utils/i18n";

interface PdfImportWarningDialogProps {
  fileName: string;
  onProceed: () => void;
  onCancel: () => void;
}

/** 提醒要點 — i18n keys。 */
const POINT_KEYS = [
  "pdfWarn.point.errors",
  "pdfWarn.point.quality",
  "pdfWarn.point.time",
  "pdfWarn.point.preferXml",
];

export function PdfImportWarningDialog(
  { fileName, onProceed, onCancel }: PdfImportWarningDialogProps,
) {
  useLocale();
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-panel)",
          color: "var(--fg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 560,
          width: "92%",
          boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>{t("pdfWarn.heading")}</h2>
        <p style={{ marginTop: 8, color: "var(--fg-muted)", fontSize: 13 }}>
          {t("pdfWarn.intro")}
        </p>

        <ul
          style={{
            margin: "12px 0 0",
            padding: 12,
            listStyle: "none",
            background: "var(--bg-hover, rgba(255,255,255,0.04))",
            border: "1px solid var(--border-light)",
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {POINT_KEYS.map((ptKey, i) => (
            <li
              key={ptKey}
              style={{
                display: "flex",
                gap: 8,
                marginTop: i === 0 ? 0 : 8,
              }}
            >
              <span style={{ color: "var(--accent)" }}>•</span>
              <span>{t(ptKey)}</span>
            </li>
          ))}
        </ul>

        <div
          style={{ marginTop: 12, fontSize: 12, color: "var(--fg-muted)" }}
        >
          {t("pdfWarn.fileLabel")}
          <span style={{ color: "var(--fg-primary)" }}>{fileName}</span>
        </div>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "6px 14px",
              border: "1px solid var(--button-border)",
              background: "var(--button-bg)",
              color: "var(--button-fg)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {t("pdfWarn.cancel")}
          </button>
          <button
            onClick={onProceed}
            style={{
              padding: "6px 14px",
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t("pdfWarn.proceed")}
          </button>
        </div>
      </div>
    </div>
  );
}

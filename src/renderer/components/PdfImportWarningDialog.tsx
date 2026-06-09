/**
 * PdfImportWarningDialog — PDF 匯入前的「預防針」提醒
 *
 * PDF 樂譜得先靠 OMR (光學樂譜辨識) 轉成 MusicXML, 這類辨識本質上不穩定。
 * 在使用者花 1-3 分鐘等辨識、拿到髒資料才驚訝之前, 先把預期講清楚, 並
 * 提醒手上若有 MusicXML / MIDI 應優先使用。
 */

import { t, useLocale } from "../utils/i18n";

type OmrEngine = "audiveris" | "homr";

interface PdfImportWarningDialogProps {
  fileName: string;
  homrAvailable: boolean;
  engine: OmrEngine;
  onEngineChange: (engine: OmrEngine) => void;
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
  {
    fileName, homrAvailable, engine, onEngineChange, onProceed, onCancel,
  }: PdfImportWarningDialogProps,
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

        {homrAvailable && (
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 12, color: "var(--fg-muted)", marginBottom: 6,
            }}>
              {t("pdfWarn.engineLabel")}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["audiveris", "homr"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onEngineChange(e)}
                  style={{
                    flex: 1, padding: "8px 10px", cursor: "pointer",
                    textAlign: "left", borderRadius: 6,
                    border: engine === e
                      ? "1.5px solid var(--accent)"
                      : "1px solid var(--border)",
                    background: engine === e
                      ? "var(--bg-secondary)" : "var(--button-bg)",
                    color: "var(--fg-primary)",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 12 }}>
                    {e === "audiveris" ? "Audiveris" : "homr"}
                    {e === "homr" && (
                      <span style={{
                        fontSize: 10, color: "var(--fg-muted)", marginLeft: 4,
                      }}>
                        {t("pdfWarn.engineExperimental")}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, color: "var(--fg-muted)", marginTop: 2,
                  }}>
                    {t(e === "audiveris"
                      ? "pdfWarn.engineAudiverisDesc"
                      : "pdfWarn.engineHomrDesc")}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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

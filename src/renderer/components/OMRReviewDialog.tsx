/**
 * OMRReviewDialog — Audiveris OMR 結果預覽 / 糾錯前置確認
 *
 * 為什麼需要這個:
 *   Audiveris 對複雜總譜常產出嚴重錯誤 (漏小節線 / 聲部錯亂 / 0 偵測).
 *   匯入這種錯譜進 arrangement engine 不只白費時間, 還可能造成 IR
 *   crash. 在實際 setSourcePath 之前讓使用者核對「小節數 + 聲部數」
 *   就能擋掉 80% 的災難匯入.
 *
 * 顯示資訊 (走 scoreInfo + listSourceParts IPC):
 *   - 總小節數 (measure_count)
 *   - 聲部數量 + 樂器列表
 *   - 「確認匯入」/「放棄」按鈕
 *
 * 預期接點:
 *   Toolbar.tsx 的 runImport — Audiveris 跑完拿到 omrPath 後,
 *   先 setOmrReview(omrPath), 等使用者 onConfirm 再 setSourcePath.
 */

import { useEffect, useState } from "react";

import { t, useLocale } from "../utils/i18n";

interface Props {
  /** OMR 產出的 MusicXML 路徑 (Audiveris 寫到 tmp). */
  omrPath: string;
  /** 原始 PDF 路徑 — 顯示給使用者參考 (檔名). */
  pdfPath: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ReviewInfo {
  measureCount: number;
  partCount: number;
  parts: { instrumentId: string; displayName: string }[];
}

export function OMRReviewDialog({
  omrPath, pdfPath, onConfirm, onCancel,
}: Props) {
  useLocale();
  const [info, setInfo] = useState<ReviewInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      window.scoreArranger.engine.scoreInfo(omrPath),
      window.scoreArranger.engine.listSourceParts(omrPath),
    ])
      .then(([infoRes, partsRes]) => {
        if (!alive) return;
        if (!infoRes.ok || !infoRes.data) {
          setError(infoRes.error ?? t("omrReview.error.fetchFailed"));
          return;
        }
        const parts = partsRes.ok && Array.isArray(partsRes.data)
          ? partsRes.data.map((p: SourcePartInfo) => ({
            instrumentId: p.instrument_id,
            displayName: p.display_name,
          }))
          : [];
        setInfo({
          measureCount: infoRes.data.measure_count,
          partCount: infoRes.data.part_count,
          parts,
        });
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [omrPath]);

  // 偵測明顯異常 — 0 小節或 0 聲部是 Audiveris 完全失敗的訊號
  const suspicious = info != null && (
    info.measureCount === 0 || info.partCount === 0
  );

  const pdfName = pdfPath.split(/[/\\]/).pop() ?? pdfPath;

  return (
    <div
      className="fx-modal-backdrop"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        zIndex: 250, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        className="fx-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520, maxWidth: "92vw", maxHeight: "85vh",
          background: "var(--bg-panel)",
          borderRadius: 10, border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 16px 56px rgba(0,0,0,0.45)",
        }}
      >
        <header style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "baseline", gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <strong style={{ flex: 1, fontSize: 15 }}>
            {t("omrReview.title")}
          </strong>
        </header>

        <main style={{
          flex: 1, padding: 18, overflow: "auto",
          fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{
            fontSize: 11, color: "var(--fg-muted)",
            marginBottom: 4,
          }}>
            {t("omrReview.sourceFile")}
          </div>
          <div style={{
            fontSize: 12,
            fontFamily: "monospace",
            marginBottom: 16,
            wordBreak: "break-all",
            color: "var(--fg-secondary)",
          }}>
            {pdfName}
          </div>

          <p style={{
            color: "var(--fg-muted)", lineHeight: 1.6,
            fontSize: 12, marginBottom: 16,
          }}>
            {t("omrReview.intro")}
          </p>

          {loading && (
            <div style={{ color: "var(--fg-muted)", fontSize: 12 }}>
              {t("omrReview.loading")}
            </div>
          )}

          {error != null && (
            <div style={{
              color: "var(--severity-error)",
              padding: "10px 12px",
              background: "var(--bg-secondary)",
              borderRadius: 6,
              fontSize: 12,
              border: "1px solid var(--severity-error)",
            }}>
              ⚠ {error}
            </div>
          )}

          {info != null && (
            <>
              {suspicious && (
                <div style={{
                  padding: "10px 12px",
                  background: "var(--bg-secondary)",
                  borderRadius: 6,
                  marginBottom: 14,
                  border: "1px solid #f59e0b",
                  fontSize: 12,
                  color: "#f59e0b",
                }}>
                  ⚠ {t("omrReview.warnSuspicious")}
                </div>
              )}

              <div style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "8px 16px",
                marginBottom: 14,
                alignItems: "baseline",
              }}>
                <div style={{ color: "var(--fg-muted)" }}>
                  {t("omrReview.field.measures")}
                </div>
                <div style={{
                  fontWeight: 600,
                  color: info.measureCount === 0
                    ? "var(--severity-error)" : "var(--fg)",
                }}>
                  {info.measureCount}
                </div>

                <div style={{ color: "var(--fg-muted)" }}>
                  {t("omrReview.field.parts")}
                </div>
                <div style={{
                  fontWeight: 600,
                  color: info.partCount === 0
                    ? "var(--severity-error)" : "var(--fg)",
                }}>
                  {info.partCount}
                </div>
              </div>

              {info.parts.length > 0 && (
                <>
                  <div style={{
                    fontSize: 11, color: "var(--fg-muted)",
                    textTransform: "uppercase", letterSpacing: ".05em",
                    marginBottom: 6,
                  }}>
                    {t("omrReview.partListHeading")}
                  </div>
                  <ul style={{
                    listStyle: "none", padding: 0, margin: 0,
                    border: "1px solid var(--border-light)",
                    borderRadius: 6, overflow: "hidden",
                  }}>
                    {info.parts.map((p, i) => (
                      <li
                        key={`${p.instrumentId}-${i}`}
                        style={{
                          padding: "8px 12px",
                          borderBottom: i < info.parts.length - 1
                            ? "1px solid var(--border-light)" : "none",
                          display: "flex", gap: 12,
                          alignItems: "baseline",
                        }}
                      >
                        <span style={{ flex: 1, fontWeight: 500 }}>
                          {p.displayName}
                        </span>
                        <span style={{
                          fontSize: 11, color: "var(--fg-muted)",
                          fontFamily: "monospace",
                        }}>
                          {p.instrumentId}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </main>

        <footer style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border)",
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "6px 14px", fontSize: 13,
              border: "1px solid var(--button-border)",
              background: "var(--button-bg)",
              color: "var(--button-fg)",
              borderRadius: 5, cursor: "pointer",
            }}
          >
            {t("omrReview.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || error != null}
            style={{
              padding: "6px 14px", fontSize: 13, fontWeight: 600,
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              borderRadius: 5, cursor: "pointer",
              opacity: (loading || error != null) ? 0.5 : 1,
            }}
          >
            {t("omrReview.confirm")}
          </button>
        </footer>
      </div>
    </div>
  );
}

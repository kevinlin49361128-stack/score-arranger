/**
 * PdfImportWarningDialog — PDF 匯入前的「預防針」提醒
 *
 * PDF 樂譜得先靠 OMR (光學樂譜辨識) 轉成 MusicXML, 這類辨識本質上不穩定。
 * 在使用者花 1-3 分鐘等辨識、拿到髒資料才驚訝之前, 先把預期講清楚, 並
 * 提醒手上若有 MusicXML / MIDI 應優先使用。
 */

interface PdfImportWarningDialogProps {
  fileName: string;
  onProceed: () => void;
  onCancel: () => void;
}

const POINTS = [
  "辨識結果常見錯音、漏拍、小節錯位、聲部混淆 —— 樂譜越複雜越明顯。",
  "掃描品質不佳、手寫譜、或排版緊密的樂譜，準確率會明顯下降。",
  "辨識約需 1–3 分鐘；完成後請務必對照原譜逐處核對、修正。",
  "若手上有 MusicXML 或 MIDI 檔，建議優先使用 —— 準確度遠高於 PDF。",
];

export function PdfImportWarningDialog(
  { fileName, onProceed, onCancel }: PdfImportWarningDialogProps,
) {
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
        <h2 style={{ margin: 0, fontSize: 18 }}>PDF 匯入提醒</h2>
        <p style={{ marginTop: 8, color: "var(--fg-muted)", fontSize: 13 }}>
          PDF 樂譜需要先經過 OMR（光學樂譜辨識）自動轉成 MusicXML 才能編輯。
          這項技術目前仍不夠穩定，匯入前請先有心理準備：
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
          {POINTS.map((pt, i) => (
            <li
              key={pt}
              style={{
                display: "flex",
                gap: 8,
                marginTop: i === 0 ? 0 : 8,
              }}
            >
              <span style={{ color: "var(--accent)" }}>•</span>
              <span>{pt}</span>
            </li>
          ))}
        </ul>

        <div
          style={{ marginTop: 12, fontSize: 12, color: "var(--fg-muted)" }}
        >
          檔案：<span style={{ color: "var(--fg-primary)" }}>{fileName}</span>
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
            取消
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
            仍要匯入 PDF
          </button>
        </div>
      </div>
    </div>
  );
}

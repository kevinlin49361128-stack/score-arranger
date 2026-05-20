/**
 * AnalyzePanel — Analyze mode 的內容
 *
 * 顯示:
 * - 各 part 的樂句邊界 (含 confidence)
 * - 各 part 的聲部功能標記 (melody / bass / harmony_fill ...)
 * - 整體驗證摘要
 *
 * 對應 AnalysisReport.phrases + summary。
 */

import { useSessionStore } from "../stores/sessionStore";

export function AnalyzePanel() {
  const analysis = useSessionStore((s) => s.analysis);
  const setHighlightedMeasure = useSessionStore(
    (s) => s.setHighlightedMeasure,
  );

  if (!analysis) {
    return (
      <div style={{ padding: 16, color: "var(--fg-tertiary)" }}>
        (尚未執行分析 — 點上方「分析」按鈕)
      </div>
    );
  }

  return (
    <div style={{ overflow: "auto", height: "100%", fontSize: 13 }}>
      {/* Summary 區 */}
      <section
        style={{
          padding: "8px 16px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-light)",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span>
          樂章: <strong>{analysis.summary.movement_count}</strong>
        </span>
        <span>
          小節: <strong>{analysis.summary.measure_count}</strong>
        </span>
        <span>
          聲部: <strong>{analysis.summary.part_count}</strong>
        </span>
        <span>
          驗證: {analysis.validation.ok ? "✓ 通過" : "✗ 有錯誤"}
          {analysis.validation.warning_count > 0
            && ` (${analysis.validation.warning_count} warnings)`}
        </span>
      </section>

      {/* Per-part 樂句 */}
      <section style={{ padding: "8px 16px" }}>
        <div
          style={{
            fontWeight: 600,
            color: "var(--fg-muted)",
            marginBottom: 8,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          樂句邊界
        </div>
        {Object.entries(analysis.phrases).map(([partId, sections]) => (
          <div
            key={partId}
            style={{
              marginBottom: 12,
              borderLeft: "3px solid var(--accent)",
              paddingLeft: 12,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "var(--fg-primary)",
                marginBottom: 4,
              }}
            >
              {partId}
            </div>
            {sections.map((section) => (
              <div key={section.section_id}>
                {section.section_name && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--fg-tertiary)",
                    }}
                  >
                    {section.section_name}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {section.phrases.map((p) => {
                    const length = p.end - p.start;
                    const conf = p.confidence;
                    const bg = conf >= 0.6
                      ? "rgba(29, 111, 220, 0.12)"
                      : conf >= 0.3
                      ? "rgba(245, 124, 0, 0.12)"
                      : "rgba(150, 150, 150, 0.12)";
                    return (
                      <button
                        key={p.phrase_id}
                        onClick={() => setHighlightedMeasure(p.start)}
                        style={{
                          padding: "4px 8px",
                          background: bg,
                          border: "1px solid var(--border-light)",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "var(--fg-primary)",
                          cursor: "pointer",
                        }}
                        title={`點選跳到 m.${p.start} (confidence ${conf.toFixed(2)})`}
                      >
                        m.{p.start}-{p.end - 1} ({length}m)
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Parts 摘要 */}
      <section style={{ padding: "8px 16px" }}>
        <div
          style={{
            fontWeight: 600,
            color: "var(--fg-muted)",
            marginBottom: 8,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          聲部清單
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {analysis.summary.parts.map((part) => (
            <div
              key={part.part_id}
              style={{
                padding: "6px 10px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-light)",
                borderRadius: 4,
              }}
            >
              <div style={{ fontWeight: 600 }}>{part.name}</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-tertiary)",
                  marginTop: 2,
                }}
              >
                {part.instrument_id} · {part.measure_count}m
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

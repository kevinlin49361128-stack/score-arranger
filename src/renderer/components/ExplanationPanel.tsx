/**
 * ExplanationPanel — 0.1.32 老師評語層
 *
 * 改編完成後, 在 UI 顯示三段式說明:
 *   - 保留了什麼
 *   - 改動了什麼
 *   - 音樂代價
 *
 * 資料來源: arrangement.explanation (來自 engine/core/explainer.py)
 * 顯示模式: 可摺疊區段 + 每聲部評語卡片
 *
 * 為什麼放這個面板: 評論者批評過「只給結果不講為什麼」。這個面板讓
 * 改編引擎變成有解釋能力的助教, 而不是黑盒。
 */

import { useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

export function ExplanationPanel() {
  useLocale();
  const arrangement = useSessionStore((s) => s.arrangement);
  const [expanded, setExpanded] = useState(true);
  const [openParts, setOpenParts] = useState<Set<string>>(new Set());

  const exp = arrangement?.explanation;
  if (!exp) return null;

  const togglePart = (id: string) => {
    setOpenParts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const globalLines = [
    exp.global.headline,
    exp.global.repair,
    exp.global.voice_leading,
    exp.global.quality,
  ].filter(Boolean) as string[];

  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel-bg)",
        borderTop: "1px solid var(--panel-border)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--fg-primary)",
        }}
      >
        <span style={{ fontSize: 10, opacity: 0.6 }}>
          {expanded ? "▼" : "▶"}
        </span>
        {t("explanation.title")}
      </button>
      {!expanded ? null : (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          {/* 全局 summary */}
          {globalLines.length > 0 && (
            <div
              style={{
                padding: "8px 10px",
                background: "var(--panel-bg-elevated)",
                borderRadius: 6,
                color: "var(--fg-secondary)",
                lineHeight: 1.6,
              }}
            >
              {globalLines.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          )}
          {/* 每聲部評語 */}
          {exp.parts.length > 0 && (
            <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
              {exp.parts.map((p) => {
                const isOpen = openParts.has(p.part_id);
                return (
                  <div
                    key={p.part_id}
                    style={{
                      border: "1px solid var(--panel-border)",
                      borderRadius: 5,
                      background: "var(--panel-bg-elevated)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => togglePart(p.part_id)}
                      style={{
                        all: "unset",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontSize: 10, opacity: 0.6 }}>
                        {isOpen ? "▼" : "▶"}
                      </span>
                      <strong>{p.display_name}</strong>
                      <span
                        style={{ opacity: 0.7, fontSize: 11 }}
                      >
                        ← {p.source_part_label}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 10,
                          opacity: 0.55,
                        }}
                      >
                        {p.function}
                      </span>
                    </button>
                    {isOpen && (
                      <div
                        style={{
                          padding: "6px 14px 10px 14px",
                          fontSize: 11,
                          lineHeight: 1.6,
                          color: "var(--fg-secondary)",
                        }}
                      >
                        {p.preserved.length > 0 && (
                          <Section
                            label={t("explanation.preserved")}
                            color="var(--accent-success, #2c8a4f)"
                            items={p.preserved}
                          />
                        )}
                        {p.changed.length > 0 && (
                          <Section
                            label={t("explanation.changed")}
                            color="var(--accent-warning, #c08a30)"
                            items={p.changed}
                          />
                        )}
                        {p.cost.length > 0 && (
                          <Section
                            label={t("explanation.cost")}
                            color="var(--accent-info, #4a7ec2)"
                            items={p.cost}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  color,
  items,
}: {
  label: string;
  color: string;
  items: string[];
}) {
  return (
    <div style={{ marginTop: 4 }}>
      <span
        style={{
          fontWeight: 600,
          color,
          marginRight: 6,
        }}
      >
        {label}:
      </span>
      <span>
        {items.map((s, i) => (
          <span key={i}>
            {i > 0 && "; "}
            {s}
          </span>
        ))}
      </span>
    </div>
  );
}

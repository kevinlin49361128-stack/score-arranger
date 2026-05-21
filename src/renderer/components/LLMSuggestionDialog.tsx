/**
 * LLMSuggestionDialog — 對選定段落問 Claude 取得改編建議
 *
 * 顯示條件: ANTHROPIC_API_KEY 已設定 (main process 端檢查)
 * 觸發點: MeasureEditor 內的「🤖 AI 建議」按鈕
 */

import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";

interface Props {
  context: string;
  ensemble?: string;
  onClose: () => void;
}

export function LLMSuggestionDialog({ context, ensemble, onClose }: Props) {
  const styleAddendum = useSessionStore((s) => s.styleAddendum);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scoreArranger.llmIsAvailable().then(setAvailable);
  }, []);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await window.scoreArranger.llmSuggest({
        context,
        userQuery: query,
        ensemble,
        styleAddendum: styleAddendum || undefined,
      });
      if (res.ok && res.data) {
        setResponse(res.data.text);
      } else {
        setError(res.error ?? "AI 回應失敗");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 540,
          maxHeight: "80vh",
          background: "var(--bg-panel)",
          borderRadius: 8,
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <strong style={{ flex: 1, fontSize: 14 }}>🤖 AI 改編建議</strong>
          <button
            onClick={onClose}
            style={{
              padding: "4px 10px",
              border: "1px solid var(--button-border)",
              background: "var(--button-bg)",
              color: "var(--button-fg)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            關閉
          </button>
        </header>

        <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
          {available === null && (
            <div style={{ color: "var(--fg-muted)" }}>偵測 API 可用性...</div>
          )}
          {available === false && (
            <div
              style={{
                padding: 12,
                background: "var(--info-bg)",
                color: "var(--info-fg)",
                borderRadius: 4,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <strong>未啟用 AI 建議</strong>
              <p style={{ margin: "6px 0 0" }}>
                請在啟動 Score Arranger 前設定環境變數:
              </p>
              <pre
                style={{
                  background: "var(--code-bg)",
                  padding: 8,
                  borderRadius: 3,
                  fontSize: 11,
                  marginTop: 6,
                }}
              >
                export ANTHROPIC_API_KEY=sk-ant-...
              </pre>
              <p style={{ margin: "6px 0 0", fontSize: 11 }}>
                API key 只存在於主程序記憶體, 不會寫入磁碟也不會送給 renderer。
              </p>
            </div>
          )}

          {available && (
            <>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--fg-muted)",
                  marginBottom: 8,
                }}
              >
                段落描述:
              </div>
              <pre
                style={{
                  background: "var(--code-bg)",
                  padding: 10,
                  borderRadius: 4,
                  fontSize: 11,
                  whiteSpace: "pre-wrap",
                  maxHeight: 140,
                  overflow: "auto",
                  marginBottom: 12,
                }}
              >
                {context}
              </pre>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--fg-muted)",
                  marginBottom: 4,
                }}
              >
                你想問什麼?
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例: 太難拉, 簡化但保留旋律走向 / 這段和聲覺得怪 / 想要更輕快"
                rows={3}
                style={{
                  width: "100%",
                  padding: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-panel)",
                  color: "var(--fg-primary)",
                  borderRadius: 4,
                  fontSize: 13,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <button
                  onClick={handleAsk}
                  disabled={loading || !query.trim()}
                  style={{
                    padding: "6px 14px",
                    background: "var(--accent)",
                    color: "var(--accent-fg)",
                    border: "none",
                    borderRadius: 4,
                    cursor: loading ? "wait" : "pointer",
                    fontSize: 13,
                  }}
                >
                  {loading ? "詢問中..." : "詢問 Claude"}
                </button>
                <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
                  ⌘+Enter 送出
                </span>
              </div>
              {error && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 8,
                    background: "var(--error-bg)",
                    color: "var(--error-fg)",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  ⚠ {error}
                </div>
              )}
              {response && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: "var(--bg-secondary)",
                    borderLeft: "3px solid var(--accent)",
                    borderRadius: 4,
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {response}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

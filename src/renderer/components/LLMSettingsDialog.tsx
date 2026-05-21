/**
 * LLMSettingsDialog — 設定 LLM provider / endpoint / model
 *
 * 可切換 anthropic / openai_compat / ollama, 自訂 baseURL + model。
 * provider/baseUrl/model 會持久化到 userData/llm-settings.json;
 * API key 仍只走環境變數 (LLM_API_KEY / ANTHROPIC_API_KEY), 不落地。
 *
 * 觸發點: Toolbar ⚙ 設定選單 →「AI 模型設定」
 */

import { useEffect, useState } from "react";

interface Props {
  onClose: () => void;
}

type Provider = "anthropic" | "openai_compat" | "ollama";

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic (Claude)",
  openai_compat: "OpenAI 相容 (OpenAI / Groq / vLLM …)",
  ollama: "Ollama (本地模型)",
};

const DEFAULT_BASE: Record<Provider, string> = {
  anthropic: "https://api.anthropic.com",
  openai_compat: "https://api.openai.com/v1",
  ollama: "http://localhost:11434/v1",
};

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-5",
  openai_compat: "gpt-4o-mini",
  ollama: "llama3.1:8b",
};

// API key 提示 — 各 provider 不同
const KEY_HINT: Record<Provider, string> = {
  anthropic: "需設定環境變數 ANTHROPIC_API_KEY 或 LLM_API_KEY",
  openai_compat: "需設定環境變數 LLM_API_KEY (localhost endpoint 可免)",
  ollama: "本地 Ollama 通常不需 API key",
};

export function LLMSettingsDialog({ onClose }: Props) {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scoreArranger.llmGetConfig()
      .then((cfg) => {
        setProvider(cfg.provider);
        setBaseUrl(cfg.baseUrl);
        setModel(cfg.model);
        setAvailable(cfg.available);
        setLoaded(true);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoaded(true);
      });
  }, []);

  const handleProviderChange = (p: Provider) => {
    setProvider(p);
    // 切 provider 時自動帶入該 provider 的預設 endpoint / model
    setBaseUrl(DEFAULT_BASE[p]);
    setModel(DEFAULT_MODEL[p]);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const cfg = await window.scoreArranger.llmSetConfig({
        provider,
        baseUrl: baseUrl.trim() || DEFAULT_BASE[provider],
        model: model.trim() || DEFAULT_MODEL[provider],
      });
      setProvider(cfg.provider);
      setBaseUrl(cfg.baseUrl);
      setModel(cfg.model);
      setAvailable(cfg.available);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 9px",
    border: "1px solid var(--border)",
    background: "var(--bg-panel)",
    color: "var(--fg-primary)",
    borderRadius: 4,
    fontSize: 13,
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--fg-muted)",
    marginBottom: 4,
    display: "block",
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
          width: 520,
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
          <strong style={{ flex: 1, fontSize: 14 }}>🤖 AI 模型設定</strong>
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
          {!loaded && (
            <div style={{ color: "var(--fg-muted)" }}>讀取設定中...</div>
          )}

          {loaded && (
            <>
              {/* 目前狀態 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 10px",
                  borderRadius: 4,
                  fontSize: 12,
                  marginBottom: 14,
                  background: available
                    ? "var(--bg-secondary)"
                    : "var(--info-bg)",
                  color: available ? "var(--fg-primary)" : "var(--info-fg)",
                  borderLeft: `3px solid ${
                    available ? "var(--ok, #3a9d5d)" : "var(--accent)"
                  }`,
                }}
              >
                {available
                  ? "✓ AI 功能已就緒 — 改編建議與自然語言改譜可用"
                  : "○ 尚未就緒 — 請確認下方 provider 與 API key 設定"}
              </div>

              {/* Provider */}
              <div style={labelStyle}>模型供應商 (Provider)</div>
              <select
                value={provider}
                onChange={(e) =>
                  handleProviderChange(e.target.value as Provider)}
                style={{ ...inputStyle, marginBottom: 14 }}
              >
                {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>

              {/* Base URL */}
              <div style={labelStyle}>API Endpoint (Base URL)</div>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setSaved(false);
                }}
                placeholder={DEFAULT_BASE[provider]}
                spellCheck={false}
                style={{ ...inputStyle, marginBottom: 14 }}
              />

              {/* Model */}
              <div style={labelStyle}>模型 ID (Model)</div>
              <input
                type="text"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setSaved(false);
                }}
                placeholder={DEFAULT_MODEL[provider]}
                spellCheck={false}
                style={{ ...inputStyle, marginBottom: 14 }}
              />

              {/* API key 說明 */}
              <div
                style={{
                  padding: 10,
                  background: "var(--code-bg)",
                  borderRadius: 4,
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: "var(--fg-muted)",
                }}
              >
                <strong style={{ color: "var(--fg-primary)" }}>
                  關於 API Key
                </strong>
                <p style={{ margin: "4px 0 0" }}>
                  {KEY_HINT[provider]}
                </p>
                <p style={{ margin: "4px 0 0" }}>
                  基於安全考量, API key 不會寫入磁碟 — 僅在啟動前以環境變數傳入,
                  只存在於主程序記憶體。provider / endpoint / model
                  則會記住。
                </p>
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
            </>
          )}
        </div>

        {loaded && (
          <footer
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ flex: 1, fontSize: 11, color: "var(--fg-tertiary)" }}>
              {saved ? "✓ 已儲存" : "切換供應商會自動帶入預設 endpoint"}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "6px 16px",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                border: "none",
                borderRadius: 4,
                cursor: saving ? "wait" : "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {saving ? "儲存中..." : "儲存設定"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

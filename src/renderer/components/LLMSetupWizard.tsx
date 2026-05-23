/**
 * LLMSetupWizard — 給音樂老師等非工程使用者用的 LLM 設定精靈.
 *
 * 與既有 LLMSettingsDialog 的差異:
 *   - LLMSettingsDialog 是「工程師導向」設定頁 — provider / baseUrl / model
 *     三個欄位, 完全沒解釋
 *   - LLMSetupWizard 是「使用者導向」教學流程 — 三條路徑 (Gemini 免費 /
 *     Ollama 本地 / 跳過), 每條都 step-by-step 圖文教學 + 一鍵測試連線
 *
 * 觸發點:
 *   1. 第一次點「改譜」/「難度調節」等需要 LLM 的按鈕, 若未設定 → 跳此精靈
 *   2. 使用者主動從設定 menu 開啟 (可日後加)
 */

import { useEffect, useState } from "react";

import { t, useLocale } from "../utils/i18n";

interface Props {
  onClose: () => void;
  /** 設定完成後的 callback — 父元件用來繼續被中斷的動作 (例: 開啟改譜). */
  onConfigured?: () => void;
}

type Tab = "gemini" | "ollama" | "skip";
type TestStatus = "idle" | "testing" | "success" | "fail";

export function LLMSetupWizard({ onClose, onConfigured }: Props) {
  useLocale();
  const [tab, setTab] = useState<Tab>("gemini");

  // Gemini 流程
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiStatus, setGeminiStatus] = useState<TestStatus>("idle");
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // Ollama 流程
  const [ollamaModel, setOllamaModel] = useState("llama3.1:8b");
  const [ollamaStatus, setOllamaStatus] = useState<TestStatus>("idle");
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  // 動畫 — 進入時淡入
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setEntering(false), 250);
    return () => clearTimeout(id);
  }, []);

  const testGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiError(t("llmSetup.error.noKey"));
      return;
    }
    setGeminiStatus("testing");
    setGeminiError(null);
    try {
      // 先寫入設定, 然後送一個極簡 prompt 測試
      await window.scoreArranger.llmSetConfig({
        provider: "openai_compat",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        model: "gemini-2.0-flash",
        apiKey: geminiKey.trim(),
      });
      const res = await window.scoreArranger.llmSuggest({
        context: "test", userQuery: "ping",
      });
      if (res.ok && res.data?.text) {
        setGeminiStatus("success");
        setTimeout(() => {
          onConfigured?.();
          onClose();
        }, 1200);
      } else {
        setGeminiStatus("fail");
        setGeminiError(res.error ?? t("llmSetup.error.connFailed"));
      }
    } catch (e) {
      setGeminiStatus("fail");
      setGeminiError(e instanceof Error ? e.message : String(e));
    }
  };

  const testOllama = async () => {
    setOllamaStatus("testing");
    setOllamaError(null);
    try {
      await window.scoreArranger.llmSetConfig({
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        model: ollamaModel,
      });
      const res = await window.scoreArranger.llmSuggest({
        context: "test", userQuery: "ping",
      });
      if (res.ok && res.data?.text) {
        setOllamaStatus("success");
        setTimeout(() => {
          onConfigured?.();
          onClose();
        }, 1200);
      } else {
        setOllamaStatus("fail");
        setOllamaError(
          (res.error ?? t("llmSetup.error.ollamaNotRunning"))
          + " — " + t("llmSetup.error.ollamaHint"),
        );
      }
    } catch (e) {
      setOllamaStatus("fail");
      setOllamaError(
        (e instanceof Error ? e.message : String(e))
        + " — " + t("llmSetup.error.ollamaHint"),
      );
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div
      className="fx-modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        zIndex: 250, display: "flex", alignItems: "center",
        justifyContent: "center",
        animation: entering ? "fx-backdrop-in 0.2s ease-out" : undefined,
      }}
    >
      <div
        className="fx-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 580, maxWidth: "92vw", maxHeight: "90vh",
          background: "var(--bg-panel)",
          borderRadius: 10, border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 16px 56px rgba(0,0,0,0.45)",
          animation: entering ? "fx-modal-in 0.25s ease-out" : undefined,
        }}
      >
        <header style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "baseline", gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <strong style={{ flex: 1, fontSize: 16 }}>
            {t("llmSetup.title")}
          </strong>
          <button
            onClick={onClose}
            style={{
              padding: "4px 10px", fontSize: 12,
              border: "1px solid var(--button-border)",
              background: "var(--button-bg)", color: "var(--button-fg)",
              borderRadius: 4, cursor: "pointer",
            }}
          >
            {t("llmSetup.close")}
          </button>
        </header>

        <div style={{
          padding: "12px 20px", borderBottom: "1px solid var(--border-light)",
          fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.6,
        }}>
          {t("llmSetup.intro")}
        </div>

        {/* Tab 列 */}
        <nav style={{
          display: "flex", borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
        }}>
          {(["gemini", "ollama", "skip"] as Tab[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                flex: 1, padding: "10px 12px", fontSize: 13,
                fontWeight: tab === k ? 700 : 500,
                background: tab === k
                  ? "var(--bg-panel)" : "transparent",
                color: tab === k ? "var(--accent)" : "var(--fg-muted)",
                border: "none",
                borderBottom: tab === k
                  ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {t(`llmSetup.tab.${k}`)}
            </button>
          ))}
        </nav>

        <main style={{
          flex: 1, padding: 20, overflow: "auto", fontSize: 13, lineHeight: 1.7,
        }}>
          {tab === "gemini" && (
            <GeminiTab
              apiKey={geminiKey}
              setApiKey={setGeminiKey}
              status={geminiStatus}
              error={geminiError}
              onTest={testGemini}
            />
          )}
          {tab === "ollama" && (
            <OllamaTab
              model={ollamaModel}
              setModel={setOllamaModel}
              status={ollamaStatus}
              error={ollamaError}
              onTest={testOllama}
              copyCmd={copyToClipboard}
            />
          )}
          {tab === "skip" && (
            <SkipTab onClose={onClose} />
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// Tab: Gemini (Google AI Studio 免費 API key)
// ============================================================================

function GeminiTab({
  apiKey, setApiKey, status, error, onTest,
}: {
  apiKey: string;
  setApiKey: (v: string) => void;
  status: TestStatus;
  error: string | null;
  onTest: () => void;
}) {
  return (
    <div>
      <Banner>{t("llmSetup.gemini.banner")}</Banner>

      <Step n={1} title={t("llmSetup.gemini.step1.title")}>
        <p>{t("llmSetup.gemini.step1.body")}</p>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank" rel="noopener noreferrer"
          style={btnLinkStyle}
        >
          {t("llmSetup.gemini.step1.cta")} →
        </a>
      </Step>

      <Step n={2} title={t("llmSetup.gemini.step2.title")}>
        <p>{t("llmSetup.gemini.step2.body")}</p>
      </Step>

      <Step n={3} title={t("llmSetup.gemini.step3.title")}>
        <p>{t("llmSetup.gemini.step3.body")}</p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("llmSetup.gemini.step3.placeholder")}
          autoComplete="off"
          spellCheck={false}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={onTest}
          disabled={status === "testing" || !apiKey.trim()}
          style={primaryBtnStyle(status === "testing")}
        >
          {status === "testing" ? t("llmSetup.testing")
            : t("llmSetup.testConnection")}
        </button>
        <ConnStatus status={status} error={error} />
      </Step>
    </div>
  );
}

// ============================================================================
// Tab: Ollama (本地, 完全免費, 完全私密)
// ============================================================================

function OllamaTab({
  model, setModel, status, error, onTest, copyCmd,
}: {
  model: string;
  setModel: (v: string) => void;
  status: TestStatus;
  error: string | null;
  onTest: () => void;
  copyCmd: (cmd: string) => void;
}) {
  const pullCmd = `ollama pull ${model}`;
  return (
    <div>
      <Banner>{t("llmSetup.ollama.banner")}</Banner>

      <Step n={1} title={t("llmSetup.ollama.step1.title")}>
        <p>{t("llmSetup.ollama.step1.body")}</p>
        <a
          href="https://ollama.com/download"
          target="_blank" rel="noopener noreferrer"
          style={btnLinkStyle}
        >
          {t("llmSetup.ollama.step1.cta")} →
        </a>
      </Step>

      <Step n={2} title={t("llmSetup.ollama.step2.title")}>
        <p>{t("llmSetup.ollama.step2.body")}</p>
      </Step>

      <Step n={3} title={t("llmSetup.ollama.step3.title")}>
        <p>{t("llmSetup.ollama.step3.body")}</p>
        <div style={{
          display: "flex", gap: 6, marginTop: 6, alignItems: "center",
        }}>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={selectStyle}
          >
            <option value="llama3.1:8b">llama3.1:8b (4.7GB · 推薦)</option>
            <option value="qwen2.5:7b">qwen2.5:7b (4.4GB · 中文較好)</option>
            <option value="mistral:7b">mistral:7b (4.1GB)</option>
            <option value="phi3:mini">phi3:mini (2.2GB · 最輕量)</option>
          </select>
        </div>
        <div style={{
          display: "flex", gap: 6, marginTop: 8, alignItems: "center",
          padding: "8px 12px", background: "var(--bg-tertiary)",
          borderRadius: 6, fontFamily: "monospace", fontSize: 12,
        }}>
          <span style={{ flex: 1, color: "var(--fg-primary)" }}>
            {pullCmd}
          </span>
          <button
            type="button"
            onClick={() => copyCmd(pullCmd)}
            style={{
              padding: "3px 10px", fontSize: 11,
              border: "1px solid var(--border)",
              background: "var(--button-bg)", color: "var(--button-fg)",
              borderRadius: 4, cursor: "pointer",
            }}
          >
            {t("llmSetup.ollama.copyCmd")}
          </button>
        </div>
        <p style={{ marginTop: 6, fontSize: 11, color: "var(--fg-tertiary)" }}>
          {t("llmSetup.ollama.step3.hint")}
        </p>
      </Step>

      <Step n={4} title={t("llmSetup.ollama.step4.title")}>
        <p>{t("llmSetup.ollama.step4.body")}</p>
        <button
          type="button"
          onClick={onTest}
          disabled={status === "testing"}
          style={primaryBtnStyle(status === "testing")}
        >
          {status === "testing" ? t("llmSetup.testing")
            : t("llmSetup.testConnection")}
        </button>
        <ConnStatus status={status} error={error} />
      </Step>
    </div>
  );
}

// ============================================================================
// Tab: 跳過
// ============================================================================

function SkipTab({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <Banner>{t("llmSetup.skip.banner")}</Banner>
      <p style={{ marginTop: 12 }}>{t("llmSetup.skip.body1")}</p>
      <ul style={{ paddingLeft: 22, marginTop: 8, lineHeight: 1.9 }}>
        <li>{t("llmSetup.skip.feature1")}</li>
        <li>{t("llmSetup.skip.feature2")}</li>
        <li>{t("llmSetup.skip.feature3")}</li>
      </ul>
      <p style={{ marginTop: 12, color: "var(--fg-muted)", fontSize: 12 }}>
        {t("llmSetup.skip.body2")}
      </p>
      <button
        type="button"
        onClick={onClose}
        style={{ ...primaryBtnStyle(false), marginTop: 14 }}
      >
        {t("llmSetup.skip.cta")}
      </button>
    </div>
  );
}

// ============================================================================
// 內部小元件
// ============================================================================

function Step({
  n, title, children,
}: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", gap: 12, marginBottom: 18, alignItems: "flex-start",
    }}>
      <div style={{
        flex: "0 0 28px", height: 28, lineHeight: "28px",
        background: "var(--accent)", color: "var(--accent-fg)",
        borderRadius: "50%", textAlign: "center", fontSize: 13,
        fontWeight: 700,
      }}>{n}</div>
      <div style={{ flex: 1, paddingTop: 3 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "10px 14px", marginBottom: 16,
      background: "var(--bg-tertiary)", borderRadius: 6,
      borderLeft: "3px solid var(--accent)",
      fontSize: 12, color: "var(--fg-secondary)", lineHeight: 1.7,
    }}>
      {children}
    </div>
  );
}

function ConnStatus({
  status, error,
}: { status: TestStatus; error: string | null }) {
  if (status === "idle") return null;
  if (status === "testing") {
    return (
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--fg-muted)" }}>
        {t("llmSetup.testingInProgress")}
      </div>
    );
  }
  if (status === "success") {
    return (
      <div style={{
        marginTop: 8, padding: "8px 12px",
        background: "rgba(50,180,80,0.15)", color: "#5bb878",
        borderRadius: 4, fontSize: 12,
      }}>
        ✓ {t("llmSetup.success")}
      </div>
    );
  }
  return (
    <div style={{
      marginTop: 8, padding: "8px 12px",
      background: "rgba(180,80,80,0.15)", color: "#e07878",
      borderRadius: 4, fontSize: 12,
    }}>
      ✗ {t("llmSetup.failPrefix")}{error}
    </div>
  );
}

// ============================================================================
// 樣式常數
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", marginTop: 6,
  fontSize: 13, border: "1px solid var(--border)",
  background: "var(--bg-panel)", color: "var(--fg-primary)",
  borderRadius: 4, fontFamily: "monospace",
};

const selectStyle: React.CSSProperties = {
  flex: 1, padding: "6px 10px", fontSize: 13,
  border: "1px solid var(--border)",
  background: "var(--bg-panel)", color: "var(--fg-primary)",
  borderRadius: 4,
};

const btnLinkStyle: React.CSSProperties = {
  display: "inline-block", marginTop: 6, padding: "6px 14px",
  fontSize: 13, fontWeight: 600,
  background: "var(--button-bg)", color: "var(--fg-primary)",
  border: "1px solid var(--border)", borderRadius: 4,
  textDecoration: "none",
};

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    marginTop: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600,
    border: "none", borderRadius: 5,
    background: disabled ? "var(--button-bg)" : "var(--accent)",
    color: disabled ? "var(--fg-muted)" : "var(--accent-fg)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

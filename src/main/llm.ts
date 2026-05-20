/**
 * llm — Provider-agnostic LLM integration
 *
 * 支援多種 backend (環境變數選擇):
 *   LLM_PROVIDER = "anthropic" (預設) | "openai_compat" | "ollama"
 *   LLM_API_KEY  = API key (anthropic 走 ANTHROPIC_API_KEY 也接受)
 *   LLM_BASE_URL = 自訂 endpoint (openai_compat / ollama 必填,
 *                  anthropic 可選, 預設 https://api.anthropic.com)
 *   LLM_MODEL    = model id (e.g. "claude-sonnet-4-5", "gpt-4o-mini",
 *                  "llama3.1:8b")
 *
 * 範例 — 接本地 Ollama:
 *   LLM_PROVIDER=ollama \
 *   LLM_BASE_URL=http://localhost:11434/v1 \
 *   LLM_MODEL=llama3.1:8b
 *
 * 接 OpenAI / Groq / 任何 OpenAI 相容 endpoint:
 *   LLM_PROVIDER=openai_compat \
 *   LLM_BASE_URL=https://api.openai.com/v1 \
 *   LLM_API_KEY=sk-... \
 *   LLM_MODEL=gpt-4o-mini
 *
 * 安全性:
 * - API key 只在 main process, 不送 renderer
 * - Renderer 用 isLLMAvailable() 判斷是否顯示「AI 建議」按鈕
 */

export interface LLMSuggestionContext {
  context: string;
  userQuery: string;
  ensemble?: string;
}

export interface LLMSuggestion {
  text: string;
  structured?: Record<string, unknown>;
}

type ProviderKind = "anthropic" | "openai_compat" | "ollama";

interface LLMConfig {
  provider: ProviderKind;
  apiKey: string | null;
  baseUrl: string;
  model: string;
}

const SYSTEM_PROMPT =
  `你是一個古典音樂改編顧問。使用者在 Score Arranger 這個改編工具中遇到困難段落, 請你針對「使用者描述的譜段 + 問題」, 給出 1-3 個具體可執行的改編建議。

回答格式:
- 用繁體中文, 簡潔但有音樂依據
- 每個建議至少包含: (1) 要做什麼、(2) 為什麼 (音樂或技術理由)
- 若有把握, 提示對應的 Score Arranger 動作 (e.g. "octave_down", "transpose -2", "替換為休止符")
- 不要重複問題, 直接給建議
- 每個建議 1-2 句話`;


function resolveConfig(): LLMConfig | null {
  const provider = (process.env.LLM_PROVIDER ?? "anthropic")
    .toLowerCase() as ProviderKind;

  // API key: 優先用 generic LLM_API_KEY, anthropic 仍接受舊的 ANTHROPIC_API_KEY
  const apiKey = process.env.LLM_API_KEY
    ?? (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : null)
    ?? null;

  // Default base URLs
  const defaultBase = {
    anthropic: "https://api.anthropic.com",
    openai_compat: "https://api.openai.com/v1",
    ollama: "http://localhost:11434/v1",
  }[provider] ?? "";
  const baseUrl = (process.env.LLM_BASE_URL ?? defaultBase).replace(/\/+$/, "");

  // Default models
  const defaultModel = {
    anthropic: "claude-sonnet-4-5",
    openai_compat: "gpt-4o-mini",
    ollama: "llama3.1:8b",
  }[provider] ?? "";
  const model = process.env.LLM_MODEL ?? defaultModel;

  // anthropic 強制要 key; openai_compat 也要 (除非 base_url 是 localhost);
  // ollama 通常不需要 key
  if (provider === "anthropic" && !apiKey) return null;
  if (
    provider === "openai_compat" && !apiKey
    && !/localhost|127\.0\.0\.1/.test(baseUrl)
  ) return null;
  if (!baseUrl || !model) return null;

  return { provider, apiKey, baseUrl, model };
}


export function isLLMAvailable(): boolean {
  return resolveConfig() !== null;
}


export function getLLMInfo():
  | { available: false }
  | { available: true; provider: ProviderKind; model: string; baseUrl: string }
{
  const cfg = resolveConfig();
  if (!cfg) return { available: false };
  return {
    available: true,
    provider: cfg.provider,
    model: cfg.model,
    baseUrl: cfg.baseUrl,
  };
}


async function callAnthropic(
  cfg: LLMConfig, userMessage: string,
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }
  const json = await res.json() as {
    content?: { type: string; text?: string }[];
  };
  return json.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim() ?? "";
}


async function callOpenAICompat(
  cfg: LLMConfig, userMessage: string,
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(
      `${cfg.provider} ${res.status}: ${err.slice(0, 200)}`,
    );
  }
  const json = await res.json() as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}


export async function callLLMSuggestion(
  ctx: LLMSuggestionContext,
): Promise<LLMSuggestion> {
  const cfg = resolveConfig();
  if (!cfg) {
    throw new Error("LLM 未設定 — 設 LLM_PROVIDER + LLM_API_KEY (或 ANTHROPIC_API_KEY) 環境變數");
  }

  const userMessage = [
    `編制: ${ctx.ensemble ?? "未指定"}`,
    "",
    "譜段:",
    ctx.context,
    "",
    "問題:",
    ctx.userQuery,
  ].join("\n");

  let text = "";
  if (cfg.provider === "anthropic") {
    text = await callAnthropic(cfg, userMessage);
  } else {
    // openai_compat + ollama 都用 OpenAI chat completions 格式
    text = await callOpenAICompat(cfg, userMessage);
  }

  if (!text) {
    throw new Error("LLM 回應為空");
  }
  return { text };
}

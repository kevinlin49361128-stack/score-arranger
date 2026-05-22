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

import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface LLMSuggestionContext {
  context: string;
  userQuery: string;
  ensemble?: string;
  styleAddendum?: string;
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


// ── app 內可設定的 LLM 設定 (持久化到 userData) ─────────────────────────
// 只存非機密的 provider / baseUrl / model; API key 仍走環境變數 (不落地)。
export interface LLMSettings {
  provider?: ProviderKind;
  baseUrl?: string;
  model?: string;
}

function settingsPath(): string {
  return join(app.getPath("userData"), "llm-settings.json");
}

export function getLLMSettings(): LLMSettings {
  try {
    const p = settingsPath();
    if (!existsSync(p)) return {};
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed as LLMSettings : {};
  } catch {
    return {};
  }
}

export function saveLLMSettings(partial: LLMSettings): void {
  const merged: LLMSettings = { ...getLLMSettings(), ...partial };
  writeFileSync(settingsPath(), JSON.stringify(merged, null, 2), "utf-8");
}

const DEFAULT_BASE: Record<ProviderKind, string> = {
  anthropic: "https://api.anthropic.com",
  openai_compat: "https://api.openai.com/v1",
  ollama: "http://localhost:11434/v1",
};
const DEFAULT_MODEL: Record<ProviderKind, string> = {
  anthropic: "claude-sonnet-4-5",
  openai_compat: "gpt-4o-mini",
  ollama: "llama3.1:8b",
};

/** 解析 provider/baseUrl/model — 優先序: 設定檔 > 環境變數 > 預設值。 */
function resolveSettings(): {
  provider: ProviderKind; baseUrl: string; model: string;
} {
  const saved = getLLMSettings();
  const provider = (
    saved.provider ?? process.env.LLM_PROVIDER ?? "anthropic"
  ).toLowerCase() as ProviderKind;
  const baseUrl = (
    saved.baseUrl ?? process.env.LLM_BASE_URL ?? DEFAULT_BASE[provider] ?? ""
  ).replace(/\/+$/, "");
  const model = saved.model
    ?? process.env.LLM_MODEL ?? DEFAULT_MODEL[provider] ?? "";
  return { provider, baseUrl, model };
}

function resolveConfig(): LLMConfig | null {
  const { provider, baseUrl, model } = resolveSettings();

  // API key: 優先用 generic LLM_API_KEY, anthropic 仍接受舊的 ANTHROPIC_API_KEY
  const apiKey = process.env.LLM_API_KEY
    ?? (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : null)
    ?? null;

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

/** 給設定 UI — 不論是否可用都回傳當前 (解析後) 的 provider/baseUrl/model。 */
export function getLLMConfigForUI(): {
  provider: ProviderKind;
  baseUrl: string;
  model: string;
  available: boolean;
} {
  return { ...resolveSettings(), available: resolveConfig() !== null };
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
  cfg: LLMConfig, system: string, userMessage: string, maxTokens = 600,
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
      max_tokens: maxTokens,
      system,
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
  cfg: LLMConfig, system: string, userMessage: string, maxTokens = 600,
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
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
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


/** Provider 分派 — anthropic 走 messages API, 其餘走 OpenAI chat 格式。 */
async function callProvider(
  cfg: LLMConfig, system: string, userMessage: string, maxTokens = 600,
): Promise<string> {
  if (cfg.provider === "anthropic") {
    return callAnthropic(cfg, system, userMessage, maxTokens);
  }
  // openai_compat + ollama 都用 OpenAI chat completions 格式
  return callOpenAICompat(cfg, system, userMessage, maxTokens);
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
    ...(ctx.styleAddendum
      ? ["", `風格脈絡: ${ctx.styleAddendum}`]
      : []),
    "",
    "譜段:",
    ctx.context,
    "",
    "問題:",
    ctx.userQuery,
  ].join("\n");

  const text = await callProvider(cfg, SYSTEM_PROMPT, userMessage);
  if (!text) {
    throw new Error("LLM 回應為空");
  }
  return { text };
}


// ── 自然語言改譜 — LLM 產生「可套用的結構化操作」 ──────────────────────

export interface LLMEditPlanContext {
  userRequest: string;
  parts: { part_id: string; name: string }[];
  sourceParts?: { part_id: string; name: string }[];
  history?: { request: string; summary: string }[];
  measureCount: number;
  ensemble?: string;
  styleAddendum?: string;
}

export interface LLMEditOp {
  op: "transpose" | "articulation" | "dynamic" | "rest" | "reassign"
    | "enrich" | "simplify";
  part_id: string;
  measure_start: number;
  measure_end: number;
  semitones?: number;
  articulation?: string;
  mode?: "set" | "add" | "clear";
  dynamic?: string;
  source_part_id?: string;
  target_part_id?: string;
  density?: "light" | "medium" | "full";
  texture?: "block" | "arpeggio" | "strum" | "octave";
  level?: "light" | "medium" | "full";
  target_difficulty?: number;
  reason: string;
}

export interface LLMEditPlan {
  summary: string;
  operations: LLMEditOp[];
  notes?: string;
}

const EDIT_PLAN_SYSTEM_PROMPT =
  `你是 Score Arranger 的「自然語言改譜」助手。使用者用自然語言描述想對改編後的譜做什麼修改, 你要把它轉成「可直接套用的結構化操作」。

你只能使用以下七種操作 (operation):

1. transpose — 移調區間內所有音符 / 和弦
   { "op": "transpose", "part_id": <string>, "measure_start": <int>, "measure_end": <int>, "semitones": <int>, "reason": <string> }
   semitones 正數升高、負數降低; 降八度 = -12, 升八度 = +12; 範圍 ±48。

2. articulation — 設定區間內所有音符 / 和弦的演奏法
   { "op": "articulation", "part_id": <string>, "measure_start": <int>, "measure_end": <int>, "articulation": <string>, "mode": <string>, "reason": <string> }
   articulation 僅限: staccato, staccatissimo, tenuto, accent, marcato, spiccato, legato, pizzicato
   mode: "set" (取代既有) / "add" (附加) / "clear" (清除全部, 此時可省略 articulation)

3. dynamic — 設定區間內所有音符 / 和弦的力度
   { "op": "dynamic", "part_id": <string>, "measure_start": <int>, "measure_end": <int>, "dynamic": <string>, "reason": <string> }
   dynamic 僅限: ppp, pp, p, mp, mf, f, ff, fff, sf, fp

4. rest — 把區間內所有音符 / 和弦變成休止符 (清空該段)
   { "op": "rest", "part_id": <string>, "measure_start": <int>, "measure_end": <int>, "reason": <string> }

5. reassign — 把某個來源聲部整個改分配給另一位演奏者 / 譜表
   { "op": "reassign", "source_part_id": <string>, "target_part_id": <string>, "reason": <string> }
   source_part_id 必須來自「來源聲部」清單; target_part_id 必須來自「可用聲部」清單。
   注意: reassign 會以來源重建整個目標譜, 不與其他操作合併為同一次復原。

6. enrich — 把區間內稀疏的旋律單音加厚成和弦
   { "op": "enrich", "part_id": <string>, "measure_start": <int>, "measure_end": <int>, "density": <string>, "texture": <string>, "target_difficulty": <int 或省略>, "reason": <string> }
   density: "light" (只加在第一拍) / "medium" (整數拍, 預設) / "full" (每個音都加)
   texture: "block" (方塊和弦, 預設) / "arpeggio" (琶音) / "strum" (刷弦) / "octave" (八度疊置)
   target_difficulty: 選填 1-5。使用者說「加到某難度 / 變難一點 / 提高難度」時填; 填了系統會自動挑 density (此時 density 可省略)。
   適用情境: 使用者覺得某聲部「和弦太少 / 太單薄 / 太空 / 不夠難 / 想加厚加豐富」, 或想要琶音 / 刷弦織體。
   octave 織體: 把旋律音疊上低八度成八度雙音 — 弦樂 (小提琴等) 想加技巧難度 / 想要八度時用。
   和弦音取自原曲同一時間點的實際和聲 (不會亂編), 並自動過樂器可演奏性檢查;
   只對未鎖定的旋律單音生效, 低音與既有和弦不動。

7. simplify — 把區間內的譜「降難度」(enrich 的反向)
   { "op": "simplify", "part_id": <string>, "measure_start": <int>, "measure_end": <int>, "level": <string>, "reason": <string> }
   level: "light" (和弦留三和弦) / "medium" (留雙音, 預設) / "full" (退到單音)
   手法: 和弦瘦身、八度收摺 (超音域音收回)、去裝飾、剝除困難弓法。
   適用情境: 使用者覺得某聲部「太難 / 太複雜 / 想簡單一點 / 給初學者 / 降難度」。
   旋律永遠保留 (和弦瘦身只省內聲部, 旋律恆在頂端); 只對未鎖定事件生效。

規則:
- 操作 1-4 的 part_id 必須完全等於「可用聲部」清單中列出的值, 不可自創或猜測。
- measure_start / measure_end 必須落在總小節數範圍內, 且 measure_start <= measure_end。
- reason 用繁體中文, 一句話說明音樂理由。
- 若使用者訊息含「先前已套用的修改」, 這是接續對話: 新要求可能是對先前結果的微調 (如「再輕一點」「那大提琴呢」), 請結合上下文理解。
- 若使用者要求無法用上述操作達成 (例如重寫旋律、加裝飾音), operations 留空陣列, 並在 notes 說明原因。

輸出格式 — 只輸出「一個」JSON 物件, 不要 markdown 圍欄, 不要任何多餘文字:
{"summary":"<繁中, 一句話總結>","operations":[<0 個以上 operation>],"notes":"<選填提醒>"}`;


/** 從 LLM 原始輸出抽出 JSON 物件 — 容忍 markdown 圍欄與前後雜訊。 */
function extractJSONObject(raw: string): string {
  let s = raw.trim();
  // 去掉 ```json ... ``` 圍欄
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM 未回傳有效 JSON");
  }
  return s.slice(start, end + 1);
}

/** 解析並清理 LLM 改譜計畫 — 座標 coerce 成整數並 clamp 到譜面範圍。 */
function parseEditPlan(raw: string, ctx: LLMEditPlanContext): LLMEditPlan {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJSONObject(raw)) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `無法解析 LLM 回應為 JSON: ${e instanceof Error ? e.message : e}`,
    );
  }
  const maxM = Math.max(1, ctx.measureCount);
  const clampM = (v: unknown): number => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return 1;
    return Math.min(maxM, Math.max(1, n));
  };
  const rawOps = Array.isArray(parsed.operations) ? parsed.operations : [];
  const operations: LLMEditOp[] = rawOps
    .filter((o): o is Record<string, unknown> =>
      !!o && typeof o === "object")
    .map((o) => {
      let ms = clampM(o.measure_start);
      let me = clampM(o.measure_end);
      if (ms > me) [ms, me] = [me, ms];
      const op: LLMEditOp = {
        op: o.op as LLMEditOp["op"],
        part_id: String(o.part_id ?? ""),
        measure_start: ms,
        measure_end: me,
        reason: typeof o.reason === "string" ? o.reason : "",
      };
      if (o.op === "transpose") {
        op.semitones = Math.round(Number(o.semitones) || 0);
      } else if (o.op === "articulation") {
        op.articulation = typeof o.articulation === "string"
          ? o.articulation
          : undefined;
        op.mode = (o.mode === "add" || o.mode === "clear")
          ? o.mode
          : "set";
      } else if (o.op === "dynamic") {
        op.dynamic = typeof o.dynamic === "string" ? o.dynamic : undefined;
      } else if (o.op === "reassign") {
        op.source_part_id = typeof o.source_part_id === "string"
          ? o.source_part_id
          : "";
        op.target_part_id = typeof o.target_part_id === "string"
          ? o.target_part_id
          : "";
      } else if (o.op === "enrich") {
        op.density = (o.density === "light" || o.density === "full")
          ? o.density
          : "medium";
        op.texture = (o.texture === "arpeggio" || o.texture === "strum"
          || o.texture === "octave")
          ? o.texture
          : "block";
        if (
          o.target_difficulty != null
          && Number.isFinite(Number(o.target_difficulty))
        ) {
          const td = Math.round(Number(o.target_difficulty));
          if (td >= 1 && td <= 5) op.target_difficulty = td;
        }
      } else if (o.op === "simplify") {
        op.level = (o.level === "light" || o.level === "full")
          ? o.level
          : "medium";
      }
      // "rest" 不需額外欄位
      return op;
    });
  return {
    summary: typeof parsed.summary === "string"
      ? parsed.summary
      : "(LLM 未提供摘要)",
    operations,
    notes: typeof parsed.notes === "string" && parsed.notes.trim()
      ? parsed.notes
      : undefined,
  };
}


export async function callLLMEditPlan(
  ctx: LLMEditPlanContext,
): Promise<LLMEditPlan> {
  const cfg = resolveConfig();
  if (!cfg) {
    throw new Error("LLM 未設定 — 請先到「AI 模型設定」設定 provider, 或設 LLM_API_KEY 環境變數");
  }

  const partList = ctx.parts.length
    ? ctx.parts
      .map((p) => `  - part_id="${p.part_id}" → ${p.name}`)
      .join("\n")
    : "  (尚無 target 聲部)";
  const sourceList = ctx.sourceParts?.length
    ? ctx.sourceParts
      .map((p) => `  - part_id="${p.part_id}" → ${p.name}`)
      .join("\n")
    : "  (無)";
  const historyBlock = ctx.history?.length
    ? [
      "先前已套用的修改 (依序):",
      ...ctx.history.map(
        (h, i) =>
          `  ${i + 1}. 使用者要求「${h.request}」→ 已套用: ${h.summary}`,
      ),
      "",
    ]
    : [];
  const userMessage = [
    `編制: ${ctx.ensemble ?? "未指定"}`,
    `總小節數: ${ctx.measureCount}`,
    ...(ctx.styleAddendum ? [`風格脈絡: ${ctx.styleAddendum}`] : []),
    "可用聲部 (改編後的目標譜):",
    partList,
    "來源聲部 (僅供 reassign 操作使用):",
    sourceList,
    "",
    ...historyBlock,
    "使用者要求:",
    ctx.userRequest,
  ].join("\n");

  const raw = await callProvider(
    cfg, EDIT_PLAN_SYSTEM_PROMPT, userMessage, 1500,
  );
  if (!raw) {
    throw new Error("LLM 回應為空");
  }
  return parseEditPlan(raw, ctx);
}


// ── 可演奏性問題 LLM 解讀 — 解釋問題 + 從引擎既有建議中推薦 ──────────────

export interface LLMIssueExplainContext {
  issueDescription: string;
  instrument?: string;
  measure: number;
  ensemble?: string;
  suggestions: { code: string; label: string }[];
}

export interface LLMIssueExplanation {
  explanation: string;
  recommended: string | null;
  reasoning: string;
}

const ISSUE_EXPLAIN_SYSTEM_PROMPT =
  `你是 Score Arranger 的可演奏性問題顧問。使用者在改編譜時遇到一個「可演奏性問題」, 你要做兩件事:
1. 用白話解釋這個問題在音樂 / 演奏上代表什麼、為什麼值得處理。
2. 從使用者提供的「可選修正建議」清單中, 推薦一個最適合的, 並說明理由。

重要原則:
- 你只能從清單中挑一個既有的建議, 絕對不可自創新的修正方式。
- 演算法已經產生並排序了這些建議; 你的角色是「解讀 + 判斷哪個最適合此情境」, 不是取代演算法。
- 若清單為空、或沒有一個適合, recommended 設為 null, 並在 reasoning 說明原因。

輸出只有「一個」JSON 物件, 不要 markdown 圍欄, 不要多餘文字:
{"explanation":"<繁中, 2-3 句: 這問題是什麼、為何重要>","recommended":"<推薦建議的 code 字串, 或 null>","reasoning":"<繁中, 1-2 句: 為何推薦這個 (或為何都不推薦)>"}`;


function parseIssueExplanation(
  raw: string, validCodes: string[],
): LLMIssueExplanation {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJSONObject(raw)) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `無法解析 LLM 回應為 JSON: ${e instanceof Error ? e.message : e}`,
    );
  }
  // 防 LLM 幻覺 — recommended 必須是清單中真實存在的 code
  let recommended = typeof parsed.recommended === "string"
    ? parsed.recommended
    : null;
  if (recommended && !validCodes.includes(recommended)) {
    recommended = null;
  }
  return {
    explanation: typeof parsed.explanation === "string"
      ? parsed.explanation
      : "(LLM 未提供解釋)",
    recommended,
    reasoning: typeof parsed.reasoning === "string"
      ? parsed.reasoning
      : "",
  };
}


export async function callLLMIssueExplain(
  ctx: LLMIssueExplainContext,
): Promise<LLMIssueExplanation> {
  const cfg = resolveConfig();
  if (!cfg) {
    throw new Error("LLM 未設定 — 請先到「AI 模型設定」設定 provider, 或設 LLM_API_KEY 環境變數");
  }

  const suggestionLines = ctx.suggestions.length
    ? ctx.suggestions
      .map((s) => `  - ${s.code}: ${s.label}`)
      .join("\n")
    : "  (無可用建議)";
  const userMessage = [
    `編制: ${ctx.ensemble ?? "未指定"}`,
    `樂器 / 聲部: ${ctx.instrument ?? "未指定"}`,
    `位置: 第 ${ctx.measure} 小節`,
    `問題: ${ctx.issueDescription}`,
    "可選修正建議:",
    suggestionLines,
  ].join("\n");

  const raw = await callProvider(
    cfg, ISSUE_EXPLAIN_SYSTEM_PROMPT, userMessage, 500,
  );
  if (!raw) {
    throw new Error("LLM 回應為空");
  }
  return parseIssueExplanation(raw, ctx.suggestions.map((s) => s.code));
}

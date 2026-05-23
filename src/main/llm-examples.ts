/**
 * llm-examples — 自然語言改譜 few-shot 例子庫 (RAG / retrieval-augmented)
 *
 * 用途: callLLMEditPlan 把使用者的 request 跟此庫做 keyword 比對, 抓 top-N
 * 相關範例插進 prompt. 讓 LLM 看過真實的「自然語言 → operations」對應,
 * 顯著提升小模型 (e.g. Ollama llama3.1:8b) 的命中率, 也減少大模型在罕見
 * 操作 (level / enrich octave) 上的「沒看過就亂寫」狀況。
 *
 * 規模刻意保持小 (~12 條): 全部塞進 prompt 也只佔不到 2k tokens. 之後
 * 要擴充可改成「embedding + cosine」, 不過 keyword 對小庫已經很夠。
 */

export interface EditExample {
  /** 簡短 tag, 主要給人 debug 看 */
  id: string;
  /** 中文自然語言請求 */
  request: string;
  /** 用來 retrieval 的關鍵字 (預先抽出, 避免每次 tokenize) */
  keywords: string[];
  /** 對應的 LLM 應該產生的輸出 (JSON-stringified) — 直接給 LLM 看 */
  response: string;
}


/**
 * Curated examples — 每種 op 至少 1 條, 常用 op (transpose / dynamic /
 * articulation / level) 各 2 條. part_id 用 placeholder ("violin_1" 等),
 * LLM 會自行對應到 prompt 的「可用聲部」清單.
 */
export const EDIT_EXAMPLES: EditExample[] = [
  // transpose
  {
    id: "transpose_down_octave",
    request: "小提琴第 5-8 小節太高了, 降一個八度",
    keywords: ["小提琴", "violin", "高", "降", "下", "八度", "octave", "transpose"],
    response: JSON.stringify({
      summary: "小提琴 m.5-8 降一個八度",
      operations: [{
        op: "transpose",
        part_id: "violin_1",
        measure_start: 5,
        measure_end: 8,
        semitones: -12,
        reason: "m.5-8 落在小提琴極高音域, 降八度回到舒適區",
      }],
    }),
  },
  {
    id: "transpose_up_fifth",
    request: "大提琴整段升五度試試",
    keywords: ["大提琴", "cello", "升", "上", "高", "transpose", "五度"],
    response: JSON.stringify({
      summary: "大提琴整段升完全五度",
      operations: [{
        op: "transpose",
        part_id: "cello_1",
        measure_start: 1,
        measure_end: 32,
        semitones: 7,
        reason: "整段上升 7 半音 (完全五度), 移到較亮的音域",
      }],
    }),
  },

  // articulation
  {
    id: "articulation_staccato",
    request: "中間 8 小節弦樂全部斷奏",
    keywords: ["斷奏", "staccato", "短", "跳", "articulation"],
    response: JSON.stringify({
      summary: "弦樂 m.9-16 改為 staccato",
      operations: [{
        op: "articulation",
        part_id: "violin_1",
        measure_start: 9,
        measure_end: 16,
        articulation: "staccato",
        mode: "set",
        reason: "中段需要輕快的彈跳感, 改用 staccato 弓法",
      }],
    }),
  },
  {
    id: "articulation_clear",
    request: "清掉所有的記號",
    keywords: ["清掉", "清除", "去掉", "清空", "clear", "移除"],
    response: JSON.stringify({
      summary: "清除所有 articulation 標記",
      operations: [{
        op: "articulation",
        part_id: "violin_1",
        measure_start: 1,
        measure_end: 32,
        mode: "clear",
        reason: "使用者要求清除全部演奏法標記",
      }],
    }),
  },

  // dynamic
  {
    id: "dynamic_crescendo_target",
    request: "結尾要強",
    keywords: ["結尾", "強", "大聲", "ff", "forte", "dynamic", "強"],
    response: JSON.stringify({
      summary: "尾段 ff",
      operations: [{
        op: "dynamic",
        part_id: "violin_1",
        measure_start: 25,
        measure_end: 32,
        dynamic: "ff",
        reason: "結尾製造高潮, 全奏 ff",
      }],
    }),
  },
  {
    id: "dynamic_pp_opening",
    request: "開頭弱一點",
    keywords: ["開頭", "弱", "小聲", "pp", "piano", "dynamic", "輕"],
    response: JSON.stringify({
      summary: "開頭 pp",
      operations: [{
        op: "dynamic",
        part_id: "violin_1",
        measure_start: 1,
        measure_end: 4,
        dynamic: "pp",
        reason: "開頭用 pp 醞釀張力",
      }],
    }),
  },

  // rest
  {
    id: "rest_silence_violin2",
    request: "小提琴二在第 10-12 小節休息",
    keywords: ["休息", "休止", "停", "靜", "rest", "不要", "不彈"],
    response: JSON.stringify({
      summary: "Violin 2 m.10-12 全休止",
      operations: [{
        op: "rest",
        part_id: "violin_2",
        measure_start: 10,
        measure_end: 12,
        reason: "讓 violin 2 休息三小節, 凸顯 violin 1 的主題",
      }],
    }),
  },

  // reassign
  {
    id: "reassign_melody_to_cello",
    request: "把第一小提琴的旋律給大提琴",
    keywords: ["大提琴", "cello", "給", "讓", "reassign", "改派", "分配"],
    response: JSON.stringify({
      summary: "把 violin 1 的部分改派給 cello 1",
      operations: [{
        op: "reassign",
        source_part_id: "violin_1_source",
        target_part_id: "cello_1",
        reason: "把原本給 violin 1 的旋律整段改交給 cello",
      }],
    }),
  },

  // enrich
  {
    id: "enrich_chord_block",
    request: "小提琴的旋律太單薄, 加和弦",
    keywords: ["單薄", "空", "稀", "加厚", "和弦", "豐富", "enrich", "厚"],
    response: JSON.stringify({
      summary: "violin 1 m.1-16 旋律加厚為方塊和弦",
      operations: [{
        op: "enrich",
        part_id: "violin_1",
        measure_start: 1,
        measure_end: 16,
        density: "medium",
        texture: "block",
        reason: "旋律單音聽起來太單薄, 用方塊和弦加厚",
      }],
    }),
  },
  {
    id: "enrich_octave_violin",
    request: "小提琴整段加八度",
    keywords: ["八度", "octave", "雙音", "double", "stop", "加厚"],
    response: JSON.stringify({
      summary: "violin 1 加八度織體",
      operations: [{
        op: "enrich",
        part_id: "violin_1",
        measure_start: 1,
        measure_end: 32,
        density: "full",
        texture: "octave",
        reason: "用八度雙音強化旋律, 增加技巧難度",
      }],
    }),
  },

  // simplify
  {
    id: "simplify_for_beginner",
    request: "鋼琴左手太難, 簡化一點",
    keywords: ["難", "複雜", "簡化", "簡單", "初學", "簡", "simplify"],
    response: JSON.stringify({
      summary: "piano lower m.1-32 全段簡化",
      operations: [{
        op: "simplify",
        part_id: "piano_1_lower",
        measure_start: 1,
        measure_end: 32,
        level: "medium",
        reason: "左手太複雜, 用 medium 級簡化",
      }],
    }),
  },

  // level
  {
    id: "level_to_target",
    request: "整段大提琴調到難度 3",
    keywords: ["難度", "level", "等級", "調到", "難度 3", "難度 2", "目標"],
    response: JSON.stringify({
      summary: "cello 整段抹平到難度 3",
      operations: [{
        op: "level",
        part_id: "cello_1",
        measure_start: 1,
        measure_end: 32,
        target_difficulty: 3,
        reason: "把難度抹平到目標 3, 太簡單的會加厚、太難的會簡化",
      }],
    }),
  },
];


/**
 * 給定使用者 request, 從庫中找 top-K 最相關的 examples.
 *
 * 用最簡單的 keyword overlap 計分:
 *   score = (request 命中 example.keywords 的個數) * 2 +
 *           (request 命中 example.request 的字數 / 10)
 * 平分時取列表順序在前的 (deterministic, 方便測試).
 *
 * 為什麼不用 embedding: 庫只有 ~12 條, embedding 加上 vector store 是
 * over-engineering. keyword overlap 在這種規模上已經非常準。
 */
export function retrieveExamples(
  request: string, topK: number = 3,
): EditExample[] {
  if (!request.trim()) return [];
  const lower = request.toLowerCase();
  const scored = EDIT_EXAMPLES.map((ex, idx) => {
    let score = 0;
    for (const kw of ex.keywords) {
      if (lower.includes(kw.toLowerCase())) score += 2;
    }
    // bigram-ish: 從 example.request 取 2-字 滑動窗口跟 user request 比
    // (對中文有效, 因為中文沒 word boundary)
    const exReqLower = ex.request.toLowerCase();
    for (let i = 0; i < exReqLower.length - 1; i++) {
      const bg = exReqLower.slice(i, i + 2);
      if (bg.trim().length === 2 && lower.includes(bg)) score += 0.3;
    }
    return { ex, score, idx };
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored
    .filter((s) => s.score > 0)
    .slice(0, topK)
    .map((s) => s.ex);
}


/**
 * 把 retrieved examples 格式化成 prompt 片段 — 給 LLM 看「樣本對照」.
 *
 * 格式刻意像對話 (user / assistant), 因為 instruction-tuned 模型對這種
 * pattern 學得最好。
 */
export function formatExamplesForPrompt(examples: EditExample[]): string {
  if (examples.length === 0) return "";
  return [
    "",
    "參考範例 (僅示範格式與思路, 你的回答仍要依當前的「可用聲部」清單):",
    ...examples.flatMap((ex) => [
      `[使用者]: ${ex.request}`,
      `[輸出]: ${ex.response}`,
      "",
    ]),
  ].join("\n");
}

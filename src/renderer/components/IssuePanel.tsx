/**
 * IssuePanel — 可演奏性問題面板
 *
 * 顯示優先序:
 * 1. 若有 arrangementIssues (改編後): 顯示 target_score 的問題,建議按鈕可實際 apply
 * 2. 否則 fallback 到 analysis.playability (source 上的分析,唯讀)
 *
 * 點選任一問題 → 通知雙面板捲到該小節
 * 點選建議按鈕 → 呼叫 engine.applySuggestion,自動重新渲染 target
 */

import { useEffect, useRef, useState } from "react";
import type { ArrangementIssue, PlayabilityIssue } from "@shared/types";
import { AssignmentsPanel } from "./AssignmentsPanel";
import { FingerboardSimulator } from "./FingerboardSimulator";
import { RepairTimeline } from "./RepairTimeline";
import { useSessionStore } from "../stores/sessionStore";
import { getLocale, onLocaleChange, t } from "../utils/i18n";
import { recordApply, sortByPreference } from "../utils/preferences";

/** 從 part_id 推斷弦樂器類型 (給指板模擬器用) */
function stringInstrumentOf(
  partId: string,
): "violin" | "viola" | "cello" | null {
  const p = partId.toLowerCase();
  if (p.includes("violin") || p.includes("violino")) return "violin";
  if (p.includes("viola")) return "viola";
  if (p.includes("cello") || p.includes("violoncello")) return "cello";
  return null;
}

const SEVERITY_META = {
  error: { icon: "🔴", label: "錯誤", colorVar: "--error-fg" },
  warning: { icon: "🟡", label: "警告", colorVar: "--warning-fg" },
  info: { icon: "🟢", label: "提示", colorVar: "--success-fg" },
} as const;

/** issue code → 簡短人類標籤 (給「同類收合」的群組標題用)。未列出者 fallback 到 code。 */
const ISSUE_SHORT_LABEL: Record<string, string> = {
  E_PITCH_BELOW_RANGE: "音域過低",
  E_PITCH_ABOVE_RANGE: "音域過高",
  E_STRING_CHORD_EXCEED: "和弦音數超過上限",
  E_NOTE_BELOW_STRING: "音低於該弦",
  E_NON_ADJACENT_STRINGS: "跨非相鄰弦",
  E_VIOLIN_FRET_TOO_HIGH: "小提琴把位過高",
  E_VIOLIN_STRETCH_EXCEED: "小提琴伸展超限",
  E_VIOLA_FRET_TOO_HIGH: "中提琴把位過高",
  E_VIOLA_STRETCH_EXCEED: "中提琴伸展超限",
  E_CELLO_FRET_TOO_HIGH: "大提琴把位過高",
  E_CELLO_STRETCH_EXCEED: "大提琴伸展超限",
  E_MONOPHONIC_CHORD: "單音樂器奏和弦",
  E_PIANO_HAND_SPAN: "鋼琴單手跨距超限",
  E_PIANO_HAND_SPAN_EXCEED: "鋼琴單手跨距超限",
  W_PITCH_OUT_OF_COMFORTABLE: "超出舒適音域",
  W_PITCH_EXTREME: "接近極限音域",
  W_VIOLIN_STRETCH_LARGE: "小提琴伸展偏大",
  W_VIOLA_STRETCH_LARGE: "中提琴伸展偏大",
  W_CELLO_STRETCH_LARGE: "大提琴伸展偏大",
  W_PIANO_HAND_SPAN_LARGE: "鋼琴單手跨距偏大",
  W_VIOLIN_TRIPLE_QUAD_STOP: "小提琴三/四音和弦",
  W_VIOLA_TRIPLE_QUAD_STOP: "中提琴三/四音和弦",
  W_CELLO_TRIPLE_QUAD_STOP: "大提琴三/四音和弦",
  W_PARALLEL_FIFTHS: "平行五度",
  W_PARALLEL_OCTAVES: "平行八度",
};

function shortLabel(code: string): string {
  return ISSUE_SHORT_LABEL[code] ?? code;
}

/** suggestion code → 中文標籤 (給 LLM 解讀與按鈕顯示用)。 */
const SUGGESTION_LABEL: Record<string, string> = {
  S_OMIT_NOTE: "省略此音",
  S_OMIT_INNER_VOICE: "省略內聲部音",
  S_OCTAVE_UP: "上移八度",
  S_OCTAVE_DOWN: "下移八度",
  S_OCTAVE_TRANSPOSE_OUTER: "外聲部移八度",
  S_REDISTRIBUTE_HANDS: "重新分配左右手",
  S_SPLIT_TO_PARTS: "拆分到其他聲部",
  S_REVOICE_PASSAGE: "重配整段聲位",
};

/** 把同一 severity 的 issue 依 code 收合; 數量多的排前面 (大問題優先)。 */
function groupByCode(
  list: UnifiedIssue[],
): Array<[string, UnifiedIssue[]]> {
  const byCode = new Map<string, UnifiedIssue[]>();
  for (const issue of list) {
    const arr = byCode.get(issue.code);
    if (arr) arr.push(issue);
    else byCode.set(issue.code, [issue]);
  }
  return [...byCode.entries()].sort((a, b) => b[1].length - a[1].length);
}

interface UnifiedIssue {
  partId: string;
  measure: number;
  voiceId: number | null;        // null = 來自 analysis (無法 apply)
  eventIndex: number | null;
  severity: "error" | "warning" | "info";
  code: string;
  params: Record<string, unknown>;
  suggestions: { code: string; params: Record<string, unknown> }[];
}

function fromArrangementIssue(i: ArrangementIssue): UnifiedIssue {
  return {
    partId: i.part_id,
    measure: i.measure,
    voiceId: i.voice_id,
    eventIndex: i.event_index,
    severity: i.severity,
    code: i.code,
    params: i.params,
    suggestions: i.suggestions,
  };
}

function fromPlayabilityIssue(
  i: PlayabilityIssue,
  partId: string,
): UnifiedIssue {
  return {
    partId,
    measure: i.measure,
    voiceId: null,
    eventIndex: null,
    severity: i.severity,
    code: i.code,
    params: i.params,
    suggestions: i.suggestions,
  };
}

export function IssuePanel() {
  const analysis = useSessionStore((s) => s.analysis);
  const arrangementIssues = useSessionStore((s) => s.arrangementIssues);
  const setHighlightedMeasure = useSessionStore(
    (s) => s.setHighlightedMeasure,
  );
  const setTargetMusicXML = useSessionStore((s) => s.setTargetMusicXML);
  const setArrangementIssues = useSessionStore((s) => s.setArrangementIssues);
  const setError = useSessionStore((s) => s.setError);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setHistoryFlags = useSessionStore((s) => s.setHistoryFlags);
  const targetMusicXML = useSessionStore((s) => s.targetMusicXML);
  const arrangement = useSessionStore((s) => s.arrangement);
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["error", "warning"]),
  );
  const [busyIssueKey, setBusyIssueKey] = useState<string | null>(null);
  /** 預覽中的原始 musicxml 備份 — 用 ref 避免 closure 抓到過時值 */
  const previewBackupRef = useRef<string | null>(null);
  /** 每次 hover 啟動 preview 取得一個 token, 回來時若 token 不再是最新就忽略 */
  const previewTokenRef = useRef<number>(0);
  const hoverTimerRef = useRef<number | null>(null);
  // i18n locale 變更時強制 re-render
  const [, setLocaleTick] = useState(0);
  useEffect(() => onLocaleChange(() => setLocaleTick((n) => n + 1)), []);
  void getLocale;

  // LLM 問題解讀 — 一次只展開一個 issue 的解讀
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [explainKey, setExplainKey] = useState<string | null>(null);
  const [explainData, setExplainData] = useState<
    LLMIssueExplanation | null
  >(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  useEffect(() => {
    window.scoreArranger.llmIsAvailable()
      .then(setLlmAvailable)
      .catch(() => setLlmAvailable(false));
  }, []);

  const handleExplain = async (issue: UnifiedIssue, issueKey: string) => {
    if (explainKey === issueKey) {
      // 再點一次 → 收起
      setExplainKey(null);
      setExplainData(null);
      setExplainError(null);
      return;
    }
    setExplainKey(issueKey);
    setExplainData(null);
    setExplainError(null);
    setExplainLoading(true);
    try {
      const res = await window.scoreArranger.llmExplainIssue({
        issueDescription: t(issue.code, issue.params),
        instrument: issue.partId,
        measure: issue.measure,
        ensemble: arrangement?.name,
        suggestions: issue.suggestions.map((s) => ({
          code: s.code,
          label: SUGGESTION_LABEL[s.code] ?? s.code,
        })),
      });
      if (res.ok && res.data) {
        setExplainData(res.data);
      } else {
        setExplainError(res.error ?? "AI 解讀失敗");
      }
    } catch (e) {
      setExplainError(e instanceof Error ? e.message : String(e));
    } finally {
      setExplainLoading(false);
    }
  };

  // 整合來源
  const issues: UnifiedIssue[] = [];
  const canApply = arrangementIssues.length > 0;
  if (canApply) {
    issues.push(...arrangementIssues.map(fromArrangementIssue));
  } else if (analysis) {
    const playability = analysis.playability ?? {};
    for (const [partId, report] of Object.entries(playability)) {
      for (const i of report.issues) {
        issues.push(fromPlayabilityIssue(i, partId));
      }
    }
  }

  if (!analysis && arrangementIssues.length === 0) {
    return (
      <div style={{ padding: 16, color: "var(--fg-tertiary)" }}>
        (尚未執行分析或改編)
      </div>
    );
  }

  const groups = {
    error: issues.filter((i) => i.severity === "error"),
    warning: issues.filter((i) => i.severity === "warning"),
    info: issues.filter((i) => i.severity === "info"),
  };

  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  };

  const handleApply = async (issue: UnifiedIssue, suggestionCode: string) => {
    if (issue.voiceId == null || issue.eventIndex == null) {
      setError("此問題來自分析報告 (source),無法直接套用,請先改編");
      return;
    }
    const key = `${issue.partId}-${issue.measure}-${issue.voiceId}-${issue.eventIndex}`;
    setBusyIssueKey(key);
    setLoading(true, `套用 ${suggestionCode}...`);
    // 套用真實 apply 後 preview 備份失效
    previewBackupRef.current = null;
    previewTokenRef.current++;
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    try {
      const res = await window.scoreArranger.engine.applySuggestion(
        issue.partId,
        issue.measure,
        issue.voiceId,
        issue.eventIndex,
        suggestionCode,
      );
      if (res.ok && res.data) {
        if (res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        setError(null);
        // 記錄使用者偏好 (apply +1)
        recordApply(suggestionCode);
      } else {
        setError(res.error ?? "套用失敗");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setBusyIssueKey(null);
    }
  };

  /** hover 建議按鈕時預覽結果 (目標面板暫顯預覽)
   *
   * Race fix:
   * - debounce 200ms (避免快速掃過時瘋狂 fetch)
   * - token 機制丟棄過時 response
   * - 備份用 ref (預覽未開始時鎖定當時的「真實」target),避免 closure 抓到 stale
   */
  const handlePreviewStart = (issue: UnifiedIssue, suggestionCode: string) => {
    if (issue.voiceId == null || issue.eventIndex == null) return;
    if (!canApply) return;

    // 第一次進入預覽循環 → 立刻鎖定「當前真實的 target」為備份
    if (previewBackupRef.current == null) {
      previewBackupRef.current = targetMusicXML;
    }

    // 取消前次的 debounce timer
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current);
    }

    const myToken = ++previewTokenRef.current;
    hoverTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await window.scoreArranger.engine.previewSuggestion(
          issue.partId,
          issue.measure,
          issue.voiceId!,
          issue.eventIndex!,
          suggestionCode,
        );
        if (myToken !== previewTokenRef.current) return;
        if (res.ok && res.data?.previewable && res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
      } catch {
        /* 預覽失敗忽略 */
      }
    }, 200);
  };

  /** 離開建議按鈕時還原預覽 */
  const handlePreviewEnd = () => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    previewTokenRef.current++;
    if (previewBackupRef.current != null) {
      setTargetMusicXML(previewBackupRef.current);
      previewBackupRef.current = null;
    }
  };

  const repair = arrangement?.repair;

  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      <AssignmentsPanel />
      {repair && (
        <RepairTimeline
          timeline={repair.timeline ?? []}
          converged={repair.converged}
          severityBefore={repair.severity_before}
          severityAfter={repair.severity_after}
          qualityBefore={repair.quality_before}
          qualityAfter={repair.quality_after}
          finalMusicXML={arrangement?.target_musicxml ?? null}
          onScrub={(xml) => {
            if (xml) setTargetMusicXML(xml);
            else if (arrangement?.target_musicxml) {
              setTargetMusicXML(arrangement.target_musicxml);
            }
          }}
        />
      )}
      <div
        style={{
          padding: "6px 12px",
          fontSize: 11,
          color: "var(--fg-tertiary)",
          background: "var(--bg-tertiary)",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        {canApply
          ? `改編結果 — 🔴 ${groups.error.length} 錯誤 · `
            + `🟡 ${groups.warning.length} 警告 · `
            + `🟢 ${groups.info.length} 提示 (點建議可直接套用)`
          : `分析報告 — 🔴 ${groups.error.length} 錯誤 · `
            + `🟡 ${groups.warning.length} 警告 · `
            + `🟢 ${groups.info.length} 提示 (改編後可套用建議)`}
      </div>
      {(Object.keys(SEVERITY_META) as Array<keyof typeof SEVERITY_META>).map(
        (sev) => {
          const meta = SEVERITY_META[sev];
          const list = groups[sev];
          const isExpanded = expanded.has(sev);
          return (
            <section
              key={sev}
              style={{ borderBottom: "1px solid var(--border-light)" }}
            >
              <header
                onClick={() => toggle(sev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  userSelect: "none",
                  background: "var(--bg-secondary)",
                  fontWeight: 600,
                  color: `var(${meta.colorVar})`,
                }}
              >
                <span>{isExpanded ? "▾" : "▸"}</span>
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span
                  style={{
                    color: "var(--fg-muted)",
                    fontWeight: 400,
                  }}
                >
                  ({list.length})
                </span>
              </header>
              {isExpanded && (
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {list.length === 0 && (
                    <li
                      style={{
                        padding: "8px 24px",
                        color: "var(--fg-tertiary)",
                        fontSize: 13,
                      }}
                    >
                      無此類問題
                    </li>
                  )}
                  {groupByCode(list).map(([groupCode, codeIssues]) => {
                    const groupKey = `${sev}:${groupCode}`;
                    const groupOpen = expanded.has(groupKey);
                    return (
                      <li
                        key={groupKey}
                        style={{
                          borderTop: "1px solid var(--border-light)",
                        }}
                      >
                        {/* 同類收合的群組標題 */}
                        <div
                          onClick={() => toggle(groupKey)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 24px",
                            cursor: "pointer",
                            userSelect: "none",
                            fontSize: 13,
                            color: "var(--fg-secondary)",
                          }}
                        >
                          <span style={{ color: "var(--fg-tertiary)" }}>
                            {groupOpen ? "▾" : "▸"}
                          </span>
                          <span style={{ fontWeight: 600 }}>
                            {shortLabel(groupCode)}
                          </span>
                          <span style={{ color: "var(--fg-muted)" }}>
                            ×{codeIssues.length}
                          </span>
                        </div>
                        {groupOpen && (
                          <ul
                            style={{
                              margin: 0,
                              padding: 0,
                              listStyle: "none",
                            }}
                          >
                            {codeIssues.map((issue, idx) => {
                              const key =
                                `${issue.partId}-${issue.measure}`
                                + `-${groupCode}-${idx}`;
                              const busyKey =
                                issue.voiceId != null
                                && issue.eventIndex != null
                                  ? `${issue.partId}-${issue.measure}`
                                    + `-${issue.voiceId}-${issue.eventIndex}`
                                  : null;
                              const isBusy = busyKey === busyIssueKey;
                              return (
                                <li
                                  key={key}
                                  onClick={() =>
                                    setHighlightedMeasure(issue.measure)}
                                  style={{
                                    padding: "8px 36px",
                                    fontSize: 13,
                                    borderTop:
                                      "1px solid var(--border-light)",
                                    cursor: "pointer",
                                    color: "var(--fg-secondary)",
                                    opacity: isBusy ? 0.5 : 1,
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.background =
                                      "var(--bg-hover)")}
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.background =
                                      "transparent")}
                                >
                                  <div>
                                    <strong>m.{issue.measure}</strong>{" "}
                                    <span
                                      style={{ color: "var(--fg-muted)" }}
                                    >
                                      ({issue.partId})
                                    </span>
                                    <div
                                      style={{
                                        marginTop: 2,
                                        fontSize: 12,
                                        color: "var(--fg-muted)",
                                      }}
                                    >
                                      {t(issue.code, issue.params)}
                                    </div>
                                  </div>
                                  {(() => {
                                    // 弦樂演奏衝突 → 顯示指板模擬器
                                    const inst = stringInstrumentOf(
                                      issue.partId,
                                    );
                                    const midis = issue.params
                                      .event_midis as number[] | undefined;
                                    if (
                                      inst && Array.isArray(midis)
                                      && midis.length > 0
                                      && (issue.code.includes("STRING")
                                        || issue.code.includes(
                                          "NON_ADJACENT",
                                        )
                                        || issue.code.includes("STRETCH")
                                        || issue.code.includes("FRET")
                                        || issue.code.includes(
                                          "BELOW_STRING",
                                        )
                                        || issue.code.includes(
                                          "TRIPLE_QUAD",
                                        ))
                                    ) {
                                      return (
                                        <div
                                          style={{ marginTop: 6 }}
                                          onClick={(e) =>
                                            e.stopPropagation()}
                                        >
                                          <FingerboardSimulator
                                            instrument={inst}
                                            pitches={midis}
                                          />
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {issue.suggestions.length > 0 && (
                                    <div
                                      style={{
                                        marginTop: 4,
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 4,
                                      }}
                                    >
                                      {sortByPreference(
                                        issue.suggestions,
                                      ).map((s, si) => {
                                        const isRec = explainKey === key
                                          && explainData?.recommended
                                            === s.code;
                                        return (
                                          <button
                                            key={si}
                                            disabled={isBusy || !canApply}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleApply(issue, s.code);
                                            }}
                                            onMouseEnter={() =>
                                              handlePreviewStart(
                                                issue, s.code,
                                              )}
                                            onMouseLeave={handlePreviewEnd}
                                            title={
                                              canApply
                                                ? `hover 預覽 / 點擊套用 ${s.code}`
                                                : "需先執行改編才可套用建議"
                                            }
                                            style={{
                                              fontSize: 11,
                                              padding: "2px 8px",
                                              border: isRec
                                                ? "2px solid var(--accent)"
                                                : "1px solid var(--border)",
                                              background: canApply
                                                ? "var(--button-bg)"
                                                : "var(--bg-tertiary)",
                                              color: canApply
                                                ? "var(--button-fg)"
                                                : "var(--fg-tertiary)",
                                              borderRadius: 4,
                                              fontWeight: isRec ? 700 : 400,
                                              cursor: canApply
                                                ? "pointer"
                                                : "not-allowed",
                                            }}
                                          >
                                            {isRec ? "★ " : ""}
                                            {s.code.replace(/^S_/, "")}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {llmAvailable && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleExplain(issue, key);
                                      }}
                                      style={{
                                        marginTop: 4,
                                        fontSize: 11,
                                        padding: "2px 8px",
                                        border: "1px dashed var(--border)",
                                        background: "transparent",
                                        color: "var(--fg-muted)",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                      }}
                                    >
                                      {explainLoading && explainKey === key
                                        ? "AI 解讀中..."
                                        : explainKey === key
                                        ? "收起解讀"
                                        : "💡 AI 解讀"}
                                    </button>
                                  )}
                                  {explainKey === key
                                    && (explainData || explainError) && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        marginTop: 4,
                                        padding: "6px 8px",
                                        background: "var(--bg-secondary)",
                                        borderLeft:
                                          "3px solid var(--accent)",
                                        borderRadius: 4,
                                        fontSize: 12,
                                        lineHeight: 1.6,
                                      }}
                                    >
                                      {explainError
                                        ? `⚠ ${explainError}`
                                        : explainData && (
                                          <>
                                            <div>
                                              {explainData.explanation}
                                            </div>
                                            {explainData.recommended && (
                                              <div
                                                style={{ marginTop: 4 }}
                                              >
                                                建議{" "}
                                                <strong>
                                                  {SUGGESTION_LABEL[
                                                    explainData
                                                      .recommended
                                                  ] ?? explainData
                                                    .recommended}
                                                </strong>
                                                {explainData.reasoning
                                                  ? ` — ${explainData.reasoning}`
                                                  : ""}
                                              </div>
                                            )}
                                            {!explainData.recommended
                                              && explainData.reasoning
                                              && (
                                                <div
                                                  style={{
                                                    marginTop: 4,
                                                    color:
                                                      "var(--fg-muted)",
                                                  }}
                                                >
                                                  {explainData.reasoning}
                                                </div>
                                              )}
                                          </>
                                        )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        },
      )}
    </div>
  );
}

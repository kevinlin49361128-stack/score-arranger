/**
 * NLEditDialog — 自然語言改譜
 *
 * 使用者用自然語言描述想對「改編後的譜」做什麼修改, LLM 回傳一組
 * 「可直接套用的結構化操作」(transpose / articulation / dynamic / rest /
 * reassign)。使用者在預覽清單逐項確認 (可勾選 / 取消) 後才送出 —
 * 人機協作, 非全自動。支援接續對話 (多輪): 先前已套用的修改會帶進
 * 下一輪的 LLM context, 使用者可說「再輕一點」「那大提琴呢」。
 *
 * 觸發點: Toolbar「🤖 改譜」按鈕 (需先完成一次改編)
 * 套用: 區間操作走 engine.applyEditOps (整批一次 undo);
 *       reassign 走 engine.reassign (各自獨立 undo, 會先於區間操作執行)。
 */

import { useEffect, useMemo, useState } from "react";
import type { ArrangementIssue } from "@shared/types";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

interface Props {
  onClose: () => void;
}

interface NamedPart {
  part_id: string;
  name: string;
}

type PlayerLite = {
  player_id: string;
  display_name: string;
  staves: number;
};

/** 由 arrangement.players 推導 target part_id — 對齊 arranger.py 的命名規則。 */
function derivePartsFromPlayers(players: PlayerLite[]): NamedPart[] {
  const parts: NamedPart[] = [];
  for (const p of players) {
    if (p.staves === 2) {
      parts.push({
        part_id: `${p.player_id}_upper`,
        name: t("nlEdit.partRightHand", { name: p.display_name }),
      });
      parts.push({
        part_id: `${p.player_id}_lower`,
        name: t("nlEdit.partLeftHand", { name: p.display_name }),
      });
    } else {
      parts.push({ part_id: p.player_id, name: p.display_name });
    }
  }
  return parts;
}

/** target part_id → (player_id, staff) — reassign 需要拆回 engine 的參數。 */
function splitTargetPartId(
  partId: string,
  players: PlayerLite[],
): { player_id: string; staff: string } | null {
  for (const p of players) {
    if (p.staves === 2) {
      if (partId === `${p.player_id}_upper`) {
        return { player_id: p.player_id, staff: "upper" };
      }
      if (partId === `${p.player_id}_lower`) {
        return { player_id: p.player_id, staff: "lower" };
      }
    } else if (partId === p.player_id) {
      return { player_id: p.player_id, staff: "main" };
    }
  }
  return null;
}

const OP_ICON: Record<LLMEditOp["op"], string> = {
  transpose: "↕",
  articulation: "♪",
  dynamic: "𝆑",
  rest: "𝄽",
  reassign: "⇄",
  enrich: "✚",
  simplify: "➖",
};

/** 把一個 op 轉成人類可讀的描述。 */
function describeOp(
  op: LLMEditOp,
  lookupTarget: (id: string) => string,
  lookupSource: (id: string) => string,
): string {
  if (op.op === "reassign") {
    return t("nlEdit.opReassign", {
      source: lookupSource(op.source_part_id ?? ""),
      target: lookupTarget(op.target_part_id ?? ""),
    });
  }
  const range = op.measure_start === op.measure_end
    ? t("nlEdit.opRangeSingle", { n: op.measure_start })
    : t("nlEdit.opRangeSpan", {
      start: op.measure_start,
      end: op.measure_end,
    });
  const partName = lookupTarget(op.part_id);
  if (op.op === "transpose") {
    const st = op.semitones ?? 0;
    if (st === 0) {
      return t("nlEdit.opTransposeNoop", { part: partName, range });
    }
    const dir = st > 0
      ? t("nlEdit.transposeUp")
      : t("nlEdit.transposeDown");
    const oct = Math.abs(st) % 12 === 0
      ? t("nlEdit.octaveSuffix", { n: Math.abs(st) / 12 })
      : "";
    return t("nlEdit.opTranspose", {
      part: partName,
      range,
      dir,
      semitones: Math.abs(st),
      oct,
    });
  }
  if (op.op === "articulation") {
    if (op.mode === "clear") {
      return t("nlEdit.opArticulationClear", { part: partName, range });
    }
    const verb = op.mode === "add"
      ? t("nlEdit.articulationAdd")
      : t("nlEdit.articulationSet");
    return t("nlEdit.opArticulation", {
      part: partName,
      range,
      verb,
      articulation: op.articulation ?? "?",
    });
  }
  if (op.op === "rest") {
    return t("nlEdit.opRest", { part: partName, range });
  }
  if (op.op === "enrich") {
    const densityLabel = op.density === "light"
      ? t("nlEdit.density.light")
      : op.density === "full"
      ? t("nlEdit.density.full")
      : t("nlEdit.density.medium");
    const textureLabel = op.texture === "arpeggio"
      ? t("nlEdit.texture.arpeggio")
      : op.texture === "strum"
      ? t("nlEdit.texture.strum")
      : op.texture === "octave"
      ? t("nlEdit.texture.octave")
      : t("nlEdit.texture.block");
    if (op.target_difficulty != null) {
      return t("nlEdit.opEnrichTargeted", {
        part: partName,
        range,
        texture: textureLabel,
        difficulty: op.target_difficulty,
      });
    }
    return t("nlEdit.opEnrich", {
      part: partName,
      range,
      texture: textureLabel,
      density: densityLabel,
    });
  }
  if (op.op === "simplify") {
    const levelLabel = op.level === "light"
      ? t("nlEdit.level.light")
      : op.level === "full"
      ? t("nlEdit.level.full")
      : t("nlEdit.level.medium");
    return t("nlEdit.opSimplify", {
      part: partName,
      range,
      level: levelLabel,
    });
  }
  return t("nlEdit.opDynamic", {
    part: partName,
    range,
    dynamic: op.dynamic ?? "?",
  });
}

export function NLEditDialog({ onClose }: Props) {
  useLocale();
  const {
    arrangement,
    sourcePath,
    styleAddendum,
    setTargetMusicXML,
    setArrangementIssues,
    setHistoryFlags,
  } = useSessionStore();

  const players = useMemo<PlayerLite[]>(
    () => arrangement?.players ?? [],
    [arrangement],
  );
  const parts = useMemo<NamedPart[]>(
    () => derivePartsFromPlayers(players),
    [players],
  );
  const [sourceParts, setSourceParts] = useState<NamedPart[]>([]);

  const lookupTarget = useMemo(() => {
    const m = new Map(parts.map((p) => [p.part_id, p.name]));
    return (id: string) => m.get(id) ?? t("nlEdit.unknownPart", { id });
  }, [parts]);
  const lookupSource = useMemo(() => {
    const m = new Map(sourceParts.map((p) => [p.part_id, p.name]));
    return (id: string) => m.get(id) ?? t("nlEdit.unknownSource", { id });
  }, [sourceParts]);

  /** op 是否指向真實存在的聲部 (LLM 幻覺防線)。 */
  const opIsValid = useMemo(() => {
    const targetIds = new Set(parts.map((p) => p.part_id));
    const sourceIds = new Set(sourceParts.map((p) => p.part_id));
    return (op: LLMEditOp): boolean => {
      if (op.op === "reassign") {
        return sourceIds.has(op.source_part_id ?? "")
          && targetIds.has(op.target_part_id ?? "");
      }
      return targetIds.has(op.part_id);
    };
  }, [parts, sourceParts]);

  const [available, setAvailable] = useState<boolean | null>(null);
  const [measureCount, setMeasureCount] = useState(0);
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<LLMEditPlan | null>(null);
  const [planRequest, setPlanRequest] = useState("");
  const [selected, setSelected] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);
  // 多輪對話 — 已套用的回合 (帶進下一輪 LLM context)
  const [history, setHistory] = useState<
    { request: string; summary: string }[]
  >([]);

  useEffect(() => {
    window.scoreArranger.llmIsAvailable().then(setAvailable).catch(() => {
      setAvailable(false);
    });
    window.scoreArranger.engine.listNavigation()
      .then((res) => {
        if (res.ok && res.data) setMeasureCount(res.data.total_measures);
      })
      .catch(() => {});
    if (sourcePath) {
      window.scoreArranger.engine.listSourceParts(sourcePath)
        .then((res) => {
          if (res.ok && Array.isArray(res.data)) {
            setSourceParts(
              res.data.map((p) => ({
                part_id: p.part_id,
                name: p.display_name,
              })),
            );
          }
        })
        .catch(() => {});
    }
  }, [sourcePath]);

  const handleGenerate = async () => {
    if (!request.trim()) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    setAppliedMsg(null);
    try {
      const res = await window.scoreArranger.llmEditPlan({
        userRequest: request.trim(),
        parts,
        sourceParts,
        history,
        measureCount: measureCount || 9999,
        ensemble: arrangement?.name,
        styleAddendum: styleAddendum || undefined,
      });
      if (res.ok && res.data) {
        setPlan(res.data);
        setPlanRequest(request.trim());
        setSelected(res.data.operations.map((op) => opIsValid(op)));
      } else {
        setError(res.error ?? t("nlEdit.planFailed"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!plan) return;
    const chosen = plan.operations.filter(
      (op, i) => selected[i] && opIsValid(op),
    );
    if (chosen.length === 0) return;
    const reassignOps = chosen.filter((op) => op.op === "reassign");
    const rangeOps = chosen.filter((op) => op.op !== "reassign");
    setApplying(true);
    setError(null);
    try {
      let lastXml: string | null = null;
      let lastIssues: ArrangementIssue[] | null = null;
      let lastUndo = false;
      let lastRedo = false;
      let touched = 0;

      // reassign 先做 — 它以來源重建整個目標譜
      for (const op of reassignOps) {
        const split = splitTargetPartId(op.target_part_id ?? "", players);
        if (!split) {
          throw new Error(
            t("nlEdit.reassignTargetInvalid", { id: op.target_part_id }),
          );
        }
        const res = await window.scoreArranger.engine.reassign(
          op.source_part_id ?? "",
          split.player_id,
          split.staff,
        );
        if (!res.ok || !res.data) {
          throw new Error(res.error ?? t("nlEdit.reassignFailed"));
        }
        lastXml = res.data.target_musicxml ?? lastXml;
        lastIssues = res.data.issues ?? lastIssues;
        lastUndo = res.data.can_undo;
        lastRedo = res.data.can_redo;
        touched += 1;
      }

      // 區間操作 — 整批一次套用
      if (rangeOps.length > 0) {
        const res = await window.scoreArranger.engine.applyEditOps(rangeOps);
        if (!res.ok || !res.data) {
          throw new Error(res.error ?? t("nlEdit.applyFailed"));
        }
        lastXml = res.data.target_musicxml ?? lastXml;
        lastIssues = res.data.issues ?? lastIssues;
        lastUndo = res.data.can_undo;
        lastRedo = res.data.can_redo;
        touched += res.data.results.reduce((s, r) => s + r.changed, 0);
      }

      if (lastXml) setTargetMusicXML(lastXml);
      if (lastIssues) setArrangementIssues(lastIssues);
      setHistoryFlags(lastUndo, lastRedo);
      setHistory((h) => [
        ...h,
        { request: planRequest, summary: plan.summary },
      ]);
      const undoNote = reassignAndRangeNote(
        reassignOps.length,
        rangeOps.length,
      );
      setAppliedMsg(
        t("nlEdit.appliedMsg", {
          count: chosen.length,
          touched,
          undoNote,
        }),
      );
      setPlan(null);
      setRequest("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  };

  const selectedCount = selected.filter(Boolean).length;

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
          width: 580,
          maxHeight: "84vh",
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
          <strong style={{ flex: 1, fontSize: 14 }}>
            {t("nlEdit.title")}
          </strong>
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
            {t("nlEdit.close")}
          </button>
        </header>

        <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
          {available === false && (
            <div
              style={{
                padding: 12,
                background: "var(--info-bg)",
                color: "var(--info-fg)",
                borderRadius: 4,
                fontSize: 13,
                lineHeight: 1.6,
                marginBottom: 14,
              }}
            >
              <strong>{t("nlEdit.noModelTitle")}</strong>
              <p style={{ margin: "6px 0 0" }}>
                {t("nlEdit.noModelBody")}
              </p>
            </div>
          )}

          {parts.length === 0 && (
            <div
              style={{
                padding: 12,
                background: "var(--info-bg)",
                color: "var(--info-fg)",
                borderRadius: 4,
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {t("nlEdit.noArrangement")}
            </div>
          )}

          {/* 多輪對話紀錄 */}
          {history.length > 0 && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: "var(--bg-secondary)",
                borderRadius: 4,
                fontSize: 11,
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: "var(--fg-muted)" }}>
                {t("nlEdit.historyTitle")}
              </strong>
              {history.map((h, i) => (
                <div key={i} style={{ marginTop: 3 }}>
                  <span style={{ color: "var(--fg-tertiary)" }}>
                    {i + 1}.
                  </span>{" "}
                  「{h.request}」→ {h.summary}
                </div>
              ))}
            </div>
          )}

          {/* 可用聲部提示 */}
          {parts.length > 0 && (
            <div
              style={{
                fontSize: 11,
                color: "var(--fg-muted)",
                marginBottom: 8,
              }}
            >
              {t("nlEdit.editableParts")}{" "}
              {parts.map((p) => p.name).join(" · ")}
              {measureCount > 0
                && t("nlEdit.measureCount", { n: measureCount })}
            </div>
          )}

          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={history.length > 0
              ? t("nlEdit.placeholderFollowUp")
              : t("nlEdit.placeholderInitial")}
            rows={4}
            disabled={parts.length === 0}
            style={{
              width: "100%",
              padding: 9,
              border: "1px solid var(--border)",
              background: "var(--bg-panel)",
              color: "var(--fg-primary)",
              borderRadius: 4,
              fontSize: 13,
              resize: "vertical",
              boxSizing: "border-box",
              lineHeight: 1.5,
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
              onClick={handleGenerate}
              disabled={loading || !request.trim() || parts.length === 0}
              style={{
                padding: "6px 14px",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                border: "none",
                borderRadius: 4,
                cursor: loading ? "wait" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                opacity: (!request.trim() || parts.length === 0) ? 0.5 : 1,
              }}
            >
              {loading ? t("nlEdit.thinking") : t("nlEdit.generatePlan")}
            </button>
            <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
              {t("nlEdit.proposalNote")}
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
                whiteSpace: "pre-wrap",
              }}
            >
              ⚠ {error}
            </div>
          )}

          {appliedMsg && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                background: "var(--bg-secondary)",
                borderLeft: "3px solid var(--ok, #3a9d5d)",
                borderRadius: 4,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              ✓ {appliedMsg}
            </div>
          )}

          {/* 方案預覽 */}
          {plan && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                {t("nlEdit.planHeading")}
              </div>
              <div
                style={{
                  padding: 10,
                  background: "var(--bg-secondary)",
                  borderRadius: 4,
                  fontSize: 12,
                  lineHeight: 1.6,
                  marginBottom: 10,
                }}
              >
                {plan.summary}
              </div>

              {plan.operations.length === 0 && (
                <div
                  style={{
                    padding: 10,
                    background: "var(--info-bg)",
                    color: "var(--info-fg)",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {t("nlEdit.noOps")}
                </div>
              )}

              {plan.operations.map((op, i) => {
                const valid = opIsValid(op);
                return (
                  <label
                    key={`${op.op}-${i}`}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      padding: "8px 10px",
                      border: "1px solid var(--border-light)",
                      borderRadius: 4,
                      marginBottom: 6,
                      cursor: valid ? "pointer" : "not-allowed",
                      opacity: valid ? 1 : 0.55,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={(selected[i] ?? false) && valid}
                      disabled={!valid}
                      onChange={(e) => {
                        const next = [...selected];
                        next[i] = e.target.checked;
                        setSelected(next);
                      }}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        <span style={{ marginRight: 5 }}>
                          {OP_ICON[op.op]}
                        </span>
                        {describeOp(op, lookupTarget, lookupSource)}
                      </div>
                      {op.reason && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--fg-muted)",
                            marginTop: 2,
                          }}
                        >
                          {op.reason}
                        </div>
                      )}
                      {!valid && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--error-fg)",
                            marginTop: 2,
                          }}
                        >
                          {t("nlEdit.opPartMissing")}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}

              {plan.notes && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: "var(--code-bg)",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "var(--fg-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  💬 {plan.notes}
                </div>
              )}
            </div>
          )}
        </div>

        {plan && plan.operations.length > 0 && (
          <footer
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{ flex: 1, fontSize: 11, color: "var(--fg-tertiary)" }}
            >
              {t("nlEdit.selectedCount", {
                selected: selectedCount,
                total: plan.operations.length,
              })}
            </span>
            <button
              onClick={handleApply}
              disabled={applying || selectedCount === 0}
              style={{
                padding: "6px 16px",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                border: "none",
                borderRadius: 4,
                cursor: applying ? "wait" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                opacity: selectedCount === 0 ? 0.5 : 1,
              }}
            >
              {applying
                ? t("nlEdit.applying")
                : t("nlEdit.applySelected", { n: selectedCount })}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

/** 套用後的復原提示文字 — reassign 與區間操作的 undo 粒度不同。 */
function reassignAndRangeNote(
  reassignCount: number,
  rangeCount: number,
): string {
  if (reassignCount > 0 && rangeCount > 0) {
    return t("nlEdit.undoNoteMixed");
  }
  if (reassignCount > 0) {
    return t("nlEdit.undoNoteReassign");
  }
  return t("nlEdit.undoNoteRange");
}

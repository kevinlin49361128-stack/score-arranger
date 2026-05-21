/**
 * NLEditDialog — 自然語言改譜
 *
 * 使用者用自然語言描述想對「改編後的譜」做什麼修改, LLM 回傳一組
 * 「可直接套用的結構化操作」(transpose / articulation / dynamic)。
 * 使用者在預覽清單逐項確認 (可勾選 / 取消) 後才送出 — 人機協作, 非全自動。
 *
 * 觸發點: Toolbar「🤖 改譜」按鈕 (需先完成一次改編)
 * 套用走 engine.applyEditOps → 整批共用一次 undo。
 */

import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";

interface Props {
  onClose: () => void;
}

interface TargetPart {
  part_id: string;
  name: string;
}

/** 由 arrangement.players 推導 target part_id — 對齊 arranger.py 的命名規則。 */
function derivePartsFromPlayers(
  players: { player_id: string; display_name: string; staves: number }[],
): TargetPart[] {
  const parts: TargetPart[] = [];
  for (const p of players) {
    if (p.staves === 2) {
      parts.push({
        part_id: `${p.player_id}_upper`,
        name: `${p.display_name}（右手）`,
      });
      parts.push({
        part_id: `${p.player_id}_lower`,
        name: `${p.display_name}（左手）`,
      });
    } else {
      parts.push({ part_id: p.player_id, name: p.display_name });
    }
  }
  return parts;
}

/** 把一個 op 轉成人類可讀的中文描述。 */
function describeOp(op: LLMEditOp, partName: string): string {
  const range = op.measure_start === op.measure_end
    ? `第 ${op.measure_start} 小節`
    : `第 ${op.measure_start}–${op.measure_end} 小節`;
  if (op.op === "transpose") {
    const st = op.semitones ?? 0;
    if (st === 0) return `${partName}・${range}・移調 0 (無變化)`;
    const dir = st > 0 ? "升高" : "降低";
    const oct = Math.abs(st) % 12 === 0
      ? `（${Math.abs(st) / 12} 個八度）`
      : "";
    return `${partName}・${range}・${dir} ${Math.abs(st)} 個半音${oct}`;
  }
  if (op.op === "articulation") {
    if (op.mode === "clear") return `${partName}・${range}・清除所有演奏法`;
    const verb = op.mode === "add" ? "附加" : "設為";
    return `${partName}・${range}・演奏法${verb} ${op.articulation ?? "?"}`;
  }
  return `${partName}・${range}・力度設為 ${op.dynamic ?? "?"}`;
}

const OP_ICON: Record<LLMEditOp["op"], string> = {
  transpose: "↕",
  articulation: "♪",
  dynamic: "𝆑",
};

export function NLEditDialog({ onClose }: Props) {
  const {
    arrangement,
    setTargetMusicXML,
    setArrangementIssues,
    setHistoryFlags,
  } = useSessionStore();

  const parts = useMemo<TargetPart[]>(
    () => derivePartsFromPlayers(arrangement?.players ?? []),
    [arrangement],
  );
  const partName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of parts) m.set(p.part_id, p.name);
    return (id: string) => m.get(id) ?? `⚠ 未知聲部 ${id}`;
  }, [parts]);

  const [available, setAvailable] = useState<boolean | null>(null);
  const [measureCount, setMeasureCount] = useState(0);
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<LLMEditPlan | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  useEffect(() => {
    window.scoreArranger.llmIsAvailable().then(setAvailable).catch(() => {
      setAvailable(false);
    });
    window.scoreArranger.engine.listNavigation()
      .then((res) => {
        if (res.ok && res.data) setMeasureCount(res.data.total_measures);
      })
      .catch(() => {});
  }, []);

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
        measureCount: measureCount || 9999,
        ensemble: arrangement?.name,
      });
      if (res.ok && res.data) {
        setPlan(res.data);
        setSelected(res.data.operations.map(() => true));
      } else {
        setError(res.error ?? "AI 產生改譜方案失敗");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!plan) return;
    const ops = plan.operations.filter((_, i) => selected[i]);
    if (ops.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const res = await window.scoreArranger.engine.applyEditOps(ops);
      if (res.ok && res.data) {
        if (res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues ?? []);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        const total = res.data.results.reduce(
          (s, r) => s + r.changed,
          0,
        );
        setAppliedMsg(
          `已套用 ${ops.length} 項操作, 共影響 ${total} 個音符 / 和弦。`
          + "（可用工具列 ↶ 一次還原整批）",
        );
        setPlan(null);
      } else {
        setError(res.error ?? "套用失敗");
      }
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
          <strong style={{ flex: 1, fontSize: 14 }}>🤖 自然語言改譜</strong>
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
              <strong>尚未設定 AI 模型</strong>
              <p style={{ margin: "6px 0 0" }}>
                請先到工具列 ⚙ →「AI 模型設定」選擇 provider 並設好
                endpoint / model（本地 Ollama 免 API key）。
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
              尚未完成改編 — 請先「改編」產生目標譜, 才能用自然語言修改。
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
              可改動的聲部:{" "}
              {parts.map((p) => p.name).join(" · ")}
              {measureCount > 0 && `　(共 ${measureCount} 小節)`}
            </div>
          )}

          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={
              "用一句話描述想做的修改, 例如:\n"
              + "• 把小提琴第 9-16 小節降一個八度\n"
              + "• 第 1-4 小節整段改成 staccato\n"
              + "• 讓鋼琴右手第 20-24 小節更輕 (p)"
            }
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
              {loading ? "AI 思考中..." : "產生改譜方案"}
            </button>
            <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
              AI 只會提案, 須由你逐項確認後才會套用
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
                改譜方案
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
                  AI 無法用目前支援的操作 (移調 / 演奏法 / 力度) 達成此要求。
                </div>
              )}

              {plan.operations.map((op, i) => {
                const unknownPart = !parts.some(
                  (p) => p.part_id === op.part_id,
                );
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
                      cursor: unknownPart ? "not-allowed" : "pointer",
                      opacity: unknownPart ? 0.55 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected[i] ?? false}
                      disabled={unknownPart}
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
                        {describeOp(op, partName(op.part_id))}
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
                      {unknownPart && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--error-fg)",
                            marginTop: 2,
                          }}
                        >
                          AI 指定的聲部不存在, 此項無法套用
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
              已選 {selectedCount} / {plan.operations.length} 項
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
              {applying ? "套用中..." : `套用選取的 ${selectedCount} 項`}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

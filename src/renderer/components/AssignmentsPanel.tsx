/**
 * AssignmentsPanel — 顯示當前 arrangement 的所有 assignments,
 * 並提供「重新分配到不同 player/staff」功能。
 *
 * Phase 1: 用 dropdown 改變 target (非真實 drag),呼叫 server.reassign。
 */

import { useEffect, useState } from "react";
import { QualityBadge } from "./QualityBadge";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

export function AssignmentsPanel() {
  useLocale();
  const arrangement = useSessionStore((s) => s.arrangement);
  const targetMusicXML = useSessionStore((s) => s.targetMusicXML);
  const setTargetMusicXML = useSessionStore((s) => s.setTargetMusicXML);
  const setArrangementIssues = useSessionStore(
    (s) => s.setArrangementIssues,
  );
  const setHistoryFlags = useSessionStore((s) => s.setHistoryFlags);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<
    Record<string, DifficultyEntry>
  >({});
  /** 進行中拖曳的 source part id (拖曳期間用於高亮可放下的目標) */
  const [draggingSourceId, setDraggingSourceId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // 每次 target 變動 → 重算難度 (debounce 400ms 避免快速編輯時暴衝)
  useEffect(() => {
    if (!arrangement) {
      setDifficulty({});
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await window.scoreArranger.engine.computeDifficulty();
        if (res.ok && res.data) {
          setDifficulty(res.data);
        }
      } catch {
        /* 忽略, 難度只是輔助資訊 */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [arrangement, targetMusicXML]);

  /** 把每個 player 的 parts 合併出一個 0-5 的最大難度, 顯示為徽章 */
  const playerDifficulty = (playerId: string): DifficultyEntry | null => {
    const matching = Object.values(difficulty).filter((d) =>
      d.part_id.startsWith(`${playerId}_`) || d.part_id === playerId
    );
    if (matching.length === 0) return null;
    return matching.reduce(
      (best, cur) => (cur.score > best.score ? cur : best),
    );
  };

  if (!arrangement || arrangement.assignments.length === 0) {
    return null;
  }

  // 列出所有可選目標 (player + staff)
  const targetOptions: { value: string; label: string }[] = [];
  for (const p of arrangement.players) {
    if (p.staves === 2) {
      targetOptions.push({
        value: `${p.player_id}|upper`,
        label: `${p.display_name} (R.H.)`,
      });
      targetOptions.push({
        value: `${p.player_id}|lower`,
        label: `${p.display_name} (L.H.)`,
      });
    } else {
      targetOptions.push({
        value: `${p.player_id}|main`,
        label: p.display_name,
      });
    }
  }

  const handleReassign = async (
    sourcePartId: string,
    targetValue: string,
  ) => {
    const [targetPlayerId, targetStaff] = targetValue.split("|");
    if (!targetPlayerId || !targetStaff) return;
    const key = `${sourcePartId}->${targetValue}`;
    setBusyKey(key);
    setLoading(true, t("assign.reassigning", { part: sourcePartId }));
    try {
      const res = await window.scoreArranger.engine.reassign(
        sourcePartId,
        targetPlayerId,
        targetStaff,
      );
      if (res.ok && res.data) {
        if (res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        setError(null);
      } else {
        setError(res.error ?? t("assign.reassignFailed"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setBusyKey(null);
    }
  };

  return (
    <div style={{ borderBottom: "1px solid var(--border-light)" }}>
      <div
        style={{
          padding: "6px 12px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--fg-muted)",
          background: "var(--bg-tertiary)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            // 0.1.37: en/ja 標題比較長, flex parent 空間不足時不要垂直拆字
            // (預設 break-all 行為下日文/中文會一個字一行). flexShrink:0 確保
            // 標題自己保完整, 沒空間則讓 QualityBadge 或右側 difficulty 自己縮.
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {t("assign.title", { n: arrangement.assignments.length })}
        </span>
        <QualityBadge />
        {Object.keys(difficulty).length > 0 && (
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 4,
              alignItems: "center",
              textTransform: "none",
              letterSpacing: 0,
              fontWeight: 400,
              fontSize: 10,
            }}
            title={t("assign.difficultyTip")}
          >
            {arrangement.players.map((p) => {
              const d = playerDifficulty(p.player_id);
              if (!d) return null;
              return (
                <DifficultyBadge
                  key={p.player_id}
                  name={p.display_name}
                  score={d.score}
                  label={d.label}
                />
              );
            })}
          </span>
        )}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {arrangement.assignments.map((a) => {
          const currentValue = a.target.replace("/", "|");
          const isBusy = busyKey?.startsWith(`${a.source_part}->`);
          return (
            <li
              key={a.id}
              onDragOver={(e) => {
                if (draggingSourceId && draggingSourceId !== a.source_part) {
                  e.preventDefault();
                  setDragOverTarget(`${a.target.replace("/", "|")}`);
                }
              }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={(e) => {
                if (!draggingSourceId) return;
                e.preventDefault();
                const targetValue = a.target.replace("/", "|");
                setDragOverTarget(null);
                setDraggingSourceId(null);
                // 把拖來的 source 重指派到「我這列的 target」
                handleReassign(draggingSourceId, targetValue);
              }}
              style={{
                padding: "6px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--fg-secondary)",
                borderBottom: "1px solid var(--border-light)",
                opacity: isBusy ? 0.5 : 1,
                background: dragOverTarget === a.target.replace("/", "|")
                  ? "rgba(124, 92, 255, 0.12)"
                  : "transparent",
                outline: dragOverTarget === a.target.replace("/", "|")
                  ? "2px dashed rgba(124, 92, 255, 0.7)"
                  : "none",
              }}
            >
              <span
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingSourceId(a.source_part);
                }}
                onDragEnd={() => {
                  setDraggingSourceId(null);
                  setDragOverTarget(null);
                }}
                style={{
                  minWidth: 140,
                  color: "var(--fg-primary)",
                  fontWeight: 500,
                  cursor: "grab",
                  opacity: draggingSourceId === a.source_part ? 0.4 : 1,
                  userSelect: "none",
                }}
                title={t("assign.dragHint")}
              >
                ⋮⋮ {a.source_part}
              </span>
              <span style={{ color: "var(--fg-tertiary)" }}>→</span>
              <select
                value={currentValue}
                disabled={isBusy}
                onChange={(e) => handleReassign(a.source_part, e.target.value)}
                style={{
                  padding: "2px 6px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-panel)",
                  color: "var(--fg-primary)",
                  borderRadius: 4,
                  fontSize: 12,
                  flex: 1,
                  cursor: isBusy ? "not-allowed" : "pointer",
                }}
              >
                {targetOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--fg-tertiary)",
                  padding: "1px 6px",
                  background: "var(--code-bg)",
                  borderRadius: 3,
                }}
              >
                {a.function}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


function DifficultyBadge(
  { name, score, label }: { name: string; score: number; label: string },
) {
  useLocale();
  // 顏色: 1=綠, 3=黃, 5=紅; 用 HSL 線性插值 (120 → 0 度色相)
  const ratio = Math.max(0, Math.min(1, (score - 1) / 4));
  const hue = 120 - 120 * ratio;
  return (
    <span
      title={t("assign.difficultyBadgeTip", {
        name,
        label,
        score: score.toFixed(1),
      })}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: "1px 6px",
        borderRadius: 10,
        background: `hsla(${hue}, 70%, 45%, 0.18)`,
        color: `hsl(${hue}, 70%, 35%)`,
        border: `1px solid hsla(${hue}, 70%, 45%, 0.5)`,
        fontWeight: 600,
      }}
    >
      {name.slice(0, 6)} {score.toFixed(1)}
    </span>
  );
}

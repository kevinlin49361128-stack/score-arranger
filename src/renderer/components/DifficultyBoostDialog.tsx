/**
 * DifficultyBoostDialog — 加難度
 *
 * 為單一聲部、單一小節範圍, 套用一組「技巧難度」手法:
 *   八度疊置 (enrich octave) / 雙音和弦 (enrich block) /
 *   移高把位 (transpose +12) / 困難弓法 (articulation spiccato)。
 * 四個手法各對應一個 applyEditOps 操作, 整批一次套用、一次復原。
 * 所有結果都經引擎的樂器可演奏性檢查 (小提琴 → check_violin_chord …)。
 *
 * 觸發點: Toolbar「💪 加難度」按鈕 (需先完成一次改編)。
 * 這是「兩者都做」決策中的專屬面板 —— 不會編曲的人也能直接操作;
 * 偏好自然語言的人仍可走 NLEditDialog。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
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

type Intensity = "conservative" | "balanced" | "virtuosic";

interface TechSel {
  octave: boolean;
  doubleStop: boolean;
  higherPosition: boolean;
  bowing: boolean;
}

/** 由 arrangement.players 推導 target part_id — 對齊 arranger.py 命名規則。 */
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

export function DifficultyBoostDialog({ onClose }: Props) {
  useLocale();
  const {
    arrangement,
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

  const [partId, setPartId] = useState("");
  const [measureCount, setMeasureCount] = useState(0);
  const [mStart, setMStart] = useState(1);
  const [mEnd, setMEnd] = useState(1);
  const [tech, setTech] = useState<TechSel>({
    octave: true,
    doubleStop: true,
    higherPosition: false,
    bowing: false,
  });
  const [intensity, setIntensity] = useState<Intensity>("balanced");
  const [difficulty, setDifficulty] = useState<
    Record<string, DifficultyEntry>
  >({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  // 預設選第一個聲部
  useEffect(() => {
    if (parts.length > 0 && !parts.some((p) => p.part_id === partId)) {
      setPartId(parts[0].part_id);
    }
  }, [parts, partId]);

  // 抓總小節數 — 預設範圍 = 整首
  useEffect(() => {
    window.scoreArranger.engine.listNavigation()
      .then((res) => {
        if (res.ok && res.data && res.data.total_measures > 0) {
          setMeasureCount(res.data.total_measures);
          setMEnd(res.data.total_measures);
        }
      })
      .catch(() => {});
  }, []);

  const refreshDifficulty = useCallback(() => {
    window.scoreArranger.engine.computeDifficulty()
      .then((res) => {
        if (res.ok && res.data) setDifficulty(res.data);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshDifficulty();
  }, [refreshDifficulty]);

  const current = partId ? difficulty[partId] : undefined;
  const anyTech = tech.octave || tech.doubleStop
    || tech.higherPosition || tech.bowing;

  const handleApply = async () => {
    if (!partId || !anyTech || applying) return;
    let lo = Math.min(mStart, mEnd);
    let hi = Math.max(mStart, mEnd);
    if (measureCount > 0) {
      lo = Math.max(1, Math.min(lo, measureCount));
      hi = Math.max(1, Math.min(hi, measureCount));
    } else {
      lo = Math.max(1, lo);
      hi = Math.max(1, hi);
    }
    const density: "light" | "medium" | "full" =
      intensity === "conservative"
        ? "light"
        : intensity === "virtuosic"
        ? "full"
        : "medium";
    const base = { part_id: partId, measure_start: lo, measure_end: hi };
    const ops: LLMEditOp[] = [];
    if (tech.octave) {
      ops.push({
        op: "enrich", ...base, texture: "octave", density,
        reason: t("boost.reason.octave"),
      });
    }
    if (tech.doubleStop) {
      ops.push({
        op: "enrich", ...base, texture: "block", density,
        reason: t("boost.reason.doubleStop"),
      });
    }
    if (tech.bowing) {
      ops.push({
        op: "articulation", ...base, articulation: "spiccato",
        mode: "add", reason: t("boost.reason.bowing"),
      });
    }
    // transpose 放最後 — 連同前面加出的和弦一起升高把位
    if (tech.higherPosition) {
      ops.push({
        op: "transpose", ...base, semitones: 12,
        reason: t("boost.reason.higherPosition"),
      });
    }

    setApplying(true);
    setError(null);
    setAppliedMsg(null);
    try {
      const res = await window.scoreArranger.engine.applyEditOps(ops);
      if (!res.ok || !res.data) {
        throw new Error(res.error ?? t("boost.failed"));
      }
      if (res.data.target_musicxml) {
        setTargetMusicXML(res.data.target_musicxml);
      }
      if (res.data.issues) setArrangementIssues(res.data.issues);
      setHistoryFlags(res.data.can_undo, res.data.can_redo);
      const touched = res.data.results.reduce((s, r) => s + r.changed, 0);
      setAppliedMsg(
        touched > 0
          ? t("boost.applied", { count: ops.length, touched })
          : t("boost.appliedNoChange"),
      );
      refreshDifficulty();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  };

  const techItems: {
    key: keyof TechSel;
    label: string;
    desc: string;
  }[] = [
    {
      key: "octave",
      label: t("boost.tech.octave"),
      desc: t("boost.tech.octaveDesc"),
    },
    {
      key: "doubleStop",
      label: t("boost.tech.doubleStop"),
      desc: t("boost.tech.doubleStopDesc"),
    },
    {
      key: "higherPosition",
      label: t("boost.tech.higherPosition"),
      desc: t("boost.tech.higherPositionDesc"),
    },
    {
      key: "bowing",
      label: t("boost.tech.bowing"),
      desc: t("boost.tech.bowingDesc"),
    },
  ];

  const intensityItems: { key: Intensity; label: string }[] = [
    { key: "conservative", label: t("boost.intensity.conservative") },
    { key: "balanced", label: t("boost.intensity.balanced") },
    { key: "virtuosic", label: t("boost.intensity.virtuosic") },
  ];

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
          maxHeight: "86vh",
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
            {t("boost.title")}
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
          {parts.length === 0
            ? (
              <div
                style={{
                  padding: 12,
                  background: "var(--info-bg)",
                  color: "var(--info-fg)",
                  borderRadius: 4,
                  fontSize: 13,
                }}
              >
                {t("nlEdit.noArrangement")}
              </div>
            )
            : (
              <>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--fg-muted)",
                    lineHeight: 1.6,
                    marginBottom: 14,
                  }}
                >
                  {t("boost.intro")}
                </div>

                {/* 聲部 + 小節範圍 */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <label style={{ flex: "1 1 200px", fontSize: 12 }}>
                    <div
                      style={{
                        color: "var(--fg-muted)",
                        marginBottom: 4,
                      }}
                    >
                      {t("boost.partLabel")}
                    </div>
                    <select
                      value={partId}
                      onChange={(e) => setPartId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-panel)",
                        color: "var(--fg-primary)",
                        borderRadius: 4,
                        fontSize: 13,
                      }}
                    >
                      {parts.map((p) => (
                        <option key={p.part_id} value={p.part_id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: "0 0 auto", fontSize: 12 }}>
                    <div
                      style={{
                        color: "var(--fg-muted)",
                        marginBottom: 4,
                      }}
                    >
                      {t("boost.rangeLabel")}
                      {measureCount > 0
                        && ` (1–${measureCount})`}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <input
                        type="number"
                        min={1}
                        max={measureCount || undefined}
                        value={mStart}
                        onChange={(e) =>
                          setMStart(Math.max(1, Number(e.target.value) || 1))}
                        style={numInput}
                      />
                      <span
                        style={{ color: "var(--fg-muted)", fontSize: 12 }}
                      >
                        {t("boost.rangeTo")}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={measureCount || undefined}
                        value={mEnd}
                        onChange={(e) =>
                          setMEnd(Math.max(1, Number(e.target.value) || 1))}
                        style={numInput}
                      />
                    </div>
                  </label>
                </div>

                {/* 技巧手法 */}
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--fg-muted)",
                    marginBottom: 6,
                  }}
                >
                  {t("boost.techLabel")}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  {techItems.map((item) => {
                    const on = tech[item.key];
                    return (
                      <label
                        key={item.key}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          padding: "9px 10px",
                          border: `1px solid ${
                            on ? "var(--accent)" : "var(--border-light)"
                          }`,
                          borderRadius: 6,
                          cursor: "pointer",
                          background: on
                            ? "var(--bg-secondary)"
                            : "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setTech((prev) => ({
                              ...prev,
                              [item.key]: e.target.checked,
                            }))}
                          style={{ marginTop: 2 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{ fontSize: 12.5, fontWeight: 600 }}
                          >
                            {item.label}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--fg-muted)",
                              marginTop: 2,
                              lineHeight: 1.5,
                            }}
                          >
                            {item.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* 炫技強度 */}
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--fg-muted)",
                    marginBottom: 6,
                  }}
                >
                  {t("boost.intensityLabel")}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 14,
                  }}
                >
                  {intensityItems.map((item) => {
                    const on = intensity === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setIntensity(item.key)}
                        style={{
                          flex: 1,
                          padding: "7px 4px",
                          border: `1px solid ${
                            on ? "var(--accent)" : "var(--border)"
                          }`,
                          background: on
                            ? "var(--accent)"
                            : "var(--button-bg)",
                          color: on
                            ? "var(--accent-fg)"
                            : "var(--button-fg)",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12.5,
                          fontWeight: on ? 600 : 400,
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* 目前難度 */}
                {current && (
                  <div
                    style={{
                      padding: "8px 12px",
                      background: "var(--bg-secondary)",
                      borderRadius: 4,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: "var(--fg-muted)" }}>
                      {t("boost.currentDifficulty")}
                    </span>
                    <strong style={{ fontSize: 16 }}>
                      {current.score.toFixed(1)}
                    </strong>
                    <span style={{ color: "var(--fg-muted)" }}>
                      / 5 · {current.label}
                    </span>
                  </div>
                )}

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
                {!anyTech && !error && (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 11.5,
                      color: "var(--fg-tertiary)",
                    }}
                  >
                    {t("boost.noTech")}
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
              </>
            )}
        </div>

        {parts.length > 0 && (
          <footer
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={handleApply}
              disabled={applying || !anyTech || !partId}
              style={{
                padding: "7px 18px",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                border: "none",
                borderRadius: 4,
                cursor: applying ? "wait" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                opacity: (!anyTech || !partId) ? 0.5 : 1,
              }}
            >
              {applying ? t("boost.applying") : t("boost.apply")}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

const numInput: React.CSSProperties = {
  width: 56,
  padding: "6px 6px",
  border: "1px solid var(--border)",
  background: "var(--bg-panel)",
  color: "var(--fg-primary)",
  borderRadius: 4,
  fontSize: 13,
  textAlign: "center",
};

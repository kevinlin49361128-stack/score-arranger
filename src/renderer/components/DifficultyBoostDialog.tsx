/**
 * DifficultyBoostDialog — 難度調節 (雙向)
 *
 * 為單一聲部、單一小節範圍, 套用「難度調節」:
 *
 *   加難度 (boost): 八度疊置 / 雙音和弦 / 移高把位 / 困難弓法
 *     —— 對應 enrich / transpose / articulation op。
 *   降難度 (reduce): 和弦瘦身 / 八度收摺 / 去裝飾 / 簡化弓法
 *     —— 對應 simplify op (引擎一次套用四種手法)。
 *
 * 整批一次套用、一次復原。所有結果都經引擎的樂器可演奏性檢查。
 * 觸發點: Toolbar「💪 難度調節」按鈕 (需先完成一次改編)。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";
import { QualityDeltaBadge, type QualityDelta } from "./QualityDeltaBadge";
import { findStudent, useStudents } from "../stores/studentStore";

interface Props {
  onClose: () => void;
}

interface NamedPart {
  part_id: string;
  name: string;
  /** 樂器 id (例: "violin", "piano") — 用來過濾不適用的加難度手法. */
  instrument_id: string;
}

type PlayerLite = {
  player_id: string;
  display_name: string;
  staves: number;
  primary_instrument: string;
};

/** 樂器分類 — 決定哪些加難度手法可用. */
type InstrumentFamily =
  | "bowed_string"   // violin, viola, cello, double_bass — 可弓法 + 雙音
  | "plucked"        // guitar, lute, harp — 雙音 OK, 沒弓法
  | "keyboard"       // piano, harpsichord — 雙音 OK, 沒弓法
  | "wind_mono"      // flute, clarinet, oboe, trumpet 等單音管樂 — 都不行
  | "other";         // voice / 未知

function classifyInstrument(id: string): InstrumentFamily {
  const i = id.toLowerCase();
  if (
    i.startsWith("violin") || i.startsWith("viola") || i.startsWith("cello")
    || i === "double_bass" || i === "contrabass"
  ) return "bowed_string";
  if (i === "guitar" || i === "lute" || i === "harp") return "plucked";
  if (i === "piano" || i === "harpsichord") return "keyboard";
  if (i === "voice" || i.startsWith("soprano") || i.startsWith("alto")
    || i.startsWith("tenor") || i.startsWith("bass_voice")) return "other";
  // 預設管樂 (flute/oboe/clarinet/bassoon/trumpet/horn/trombone/tuba/sax/recorder)
  return "wind_mono";
}

type Direction = "boost" | "reduce" | "target";
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
        instrument_id: p.primary_instrument,
      });
      parts.push({
        part_id: `${p.player_id}_lower`,
        name: t("nlEdit.partLeftHand", { name: p.display_name }),
        instrument_id: p.primary_instrument,
      });
    } else {
      parts.push({
        part_id: p.player_id,
        name: p.display_name,
        instrument_id: p.primary_instrument,
      });
    }
  }
  return parts;
}

/** 強度 → enrich density / simplify level (兩者用同一組三檔)。 */
function intensityToAmount(i: Intensity): "light" | "medium" | "full" {
  return i === "conservative" ? "light" : i === "virtuosic" ? "full" : "medium";
}

export function DifficultyBoostDialog({ onClose }: Props) {
  useLocale();
  const {
    arrangement,
    setTargetMusicXML,
    setArrangementIssues,
    setHistoryFlags,
    flashEditedMeasures,
    saveVariant,
  } = useSessionStore();

  const players = useMemo<PlayerLite[]>(
    () => arrangement?.players ?? [],
    [arrangement],
  );
  const parts = useMemo<NamedPart[]>(
    () => derivePartsFromPlayers(players),
    [players],
  );

  const [direction, setDirection] = useState<Direction>("boost");
  const [targetDiff, setTargetDiff] = useState(3);
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
  const [qualityDelta, setQualityDelta] = useState<QualityDelta | null>(null);
  // 0.1.39: 「為 X 學生」整合 — 選後自動帶程度 + 樂器配對
  const students = useStudents();
  const [studentId, setStudentId] = useState<string | null>(null);

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
  // 降難度 / 目標難度不需勾手法; 只有加難度需至少勾一種手法
  const canApply = direction !== "boost" || anyTech;

  const handleApply = async () => {
    if (!partId || !canApply || applying) return;
    let lo = Math.min(mStart, mEnd);
    let hi = Math.max(mStart, mEnd);
    if (measureCount > 0) {
      lo = Math.max(1, Math.min(lo, measureCount));
      hi = Math.max(1, Math.min(hi, measureCount));
    } else {
      lo = Math.max(1, lo);
      hi = Math.max(1, hi);
    }
    const amount = intensityToAmount(intensity);
    const base = { part_id: partId, measure_start: lo, measure_end: hi };
    const ops: LLMEditOp[] = [];

    if (direction === "target") {
      ops.push({
        op: "level", ...base, target_difficulty: targetDiff,
        reason: t("boost.reason.level"),
      });
    } else if (direction === "reduce") {
      ops.push({
        op: "simplify", ...base, level: amount,
        reason: t("boost.reason.simplify"),
      });
    } else {
      if (tech.octave) {
        ops.push({
          op: "enrich", ...base, texture: "octave", density: amount,
          reason: t("boost.reason.octave"),
        });
      }
      if (tech.doubleStop) {
        ops.push({
          op: "enrich", ...base, texture: "block", density: amount,
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
    }

    setApplying(true);
    setError(null);
    setAppliedMsg(null);
    setQualityDelta(null);
    try {
      // D2 品質 lint — 套用前後對比改編品質
      const beforeRes = await window.scoreArranger.engine.computeQuality();
      const before = beforeRes.ok ? beforeRes.data : null;
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
      const rs = res.data.results;
      if (rs.length > 0) {
        flashEditedMeasures(
          Math.min(...rs.map((r) => r.measure_start)),
          Math.max(...rs.map((r) => r.measure_end)),
        );
      }
      // 0.1.30: transpose 音域保護 — 若有跳過事件, 加 note 提示使用者
      // (避免疑惑「為何按了升高把位但某些段落沒升上去」)
      const skippedOOR = rs.reduce(
        (s, r) => s + (r.skipped_out_of_range ?? 0), 0,
      );
      const baseMsg = touched > 0
        ? t("boost.applied", { count: ops.length, touched })
        : t("boost.appliedNoChange");
      setAppliedMsg(
        skippedOOR > 0
          ? `${baseMsg} · ${t("boost.skippedOutOfRange", { n: skippedOOR })}`
          : baseMsg,
      );
      // D1 編輯版本樹 — 每次成功編輯自動存 variant, 方便事後比較 / 還原
      const noteRange = `m${lo}-${hi}`;
      const variantNote = direction === "target"
        ? `${t("boost.direction.target")} ${targetDiff} · ${noteRange}`
        : direction === "reduce"
        ? `${t("boost.direction.reduce")} · ${noteRange} · ${
          intensity === "conservative"
            ? t("boost.level.light")
            : intensity === "virtuosic"
            ? t("boost.level.full")
            : t("boost.level.medium")
        }`
        : `${t("boost.direction.boost")} · ${noteRange} · ${
          intensity === "conservative"
            ? t("boost.intensity.conservative")
            : intensity === "virtuosic"
            ? t("boost.intensity.virtuosic")
            : t("boost.intensity.balanced")
        }`;
      saveVariant(undefined, variantNote);
      if (before) {
        const afterRes = await window.scoreArranger.engine.computeQuality();
        if (afterRes.ok && afterRes.data) {
          const a = afterRes.data;
          setQualityDelta({
            melody: a.melody_preservation - before.melody_preservation,
            harmony: a.harmony_completeness - before.harmony_completeness,
            playability: a.playability - before.playability,
            overall: a.overall - before.overall,
          });
        }
      }
      refreshDifficulty();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  };

  // 樂器感知過濾 — 不同樂器 family 適用不同加難度手法.
  // 規則:
  //   - octave (八度疊置): 通用 — 所有樂器都能升八度
  //   - doubleStop (雙音和弦): 不適用 monophonic 管樂 (flute/oboe/clarinet 等)
  //   - higherPosition (整段升八度 / 移高把位): 通用 — 任何樂器
  //   - bowing (spiccato 跳弓): 只適用弓弦樂 (violin/viola/cello/double_bass)
  const currentFamily: InstrumentFamily = useMemo(() => {
    const p = parts.find((x) => x.part_id === partId);
    return p ? classifyInstrument(p.instrument_id) : "other";
  }, [parts, partId]);

  const techApplies = useCallback(
    (key: keyof TechSel): boolean => {
      switch (key) {
        case "octave":
        case "higherPosition":
          return true;
        case "doubleStop":
          return currentFamily !== "wind_mono";
        case "bowing":
          return currentFamily === "bowed_string";
      }
    },
    [currentFamily],
  );

  // 切換聲部時自動取消不適用的勾選, 避免送出無效 op
  useEffect(() => {
    setTech((prev) => ({
      octave: prev.octave && techApplies("octave"),
      doubleStop: prev.doubleStop && techApplies("doubleStop"),
      higherPosition: prev.higherPosition && techApplies("higherPosition"),
      bowing: prev.bowing && techApplies("bowing"),
    }));
  }, [techApplies]);

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

  const intensityItems: { key: Intensity; label: string }[] =
    direction === "boost"
      ? [
        { key: "conservative", label: t("boost.intensity.conservative") },
        { key: "balanced", label: t("boost.intensity.balanced") },
        { key: "virtuosic", label: t("boost.intensity.virtuosic") },
      ]
      : [
        { key: "conservative", label: t("boost.level.light") },
        { key: "balanced", label: t("boost.level.medium") },
        { key: "virtuosic", label: t("boost.level.full") },
      ];

  const directionItems: { key: Direction; label: string }[] = [
    { key: "boost", label: t("boost.direction.boost") },
    { key: "reduce", label: t("boost.direction.reduce") },
    { key: "target", label: t("boost.direction.target") },
  ];

  return (
    <div
      className="fx-modal-backdrop"
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
        className="fx-modal-card"
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

                {/* 0.1.39: 「為 X 學生」picker — 選後自動帶程度 + 配對樂器
                    student.notes 之後會在 LLM 改編建議裡塞 prompt (v2). */}
                {students.length > 0 && (
                  <div style={{
                    marginBottom: 14, padding: 10,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-light)",
                    borderRadius: 6,
                  }}>
                    <label style={{ fontSize: 12 }}>
                      <div style={{
                        color: "var(--fg-muted)", marginBottom: 4,
                      }}>
                        👥 {t("boost.forStudent")}
                      </div>
                      <select
                        value={studentId ?? ""}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          setStudentId(id);
                          const s = findStudent(id);
                          if (s) {
                            // 套用學生程度 → target difficulty
                            setTargetDiff(s.skill_level);
                            // 找配對的 part (依 instrument_id 對齊)
                            const matchPart = parts.find((p) =>
                              p.instrument_id.toLowerCase()
                                === s.instrument.toLowerCase()
                            );
                            if (matchPart) setPartId(matchPart.part_id);
                            setAppliedMsg(t("boost.forStudent.applied",
                              { name: s.name }));
                            window.setTimeout(() => setAppliedMsg(null), 2500);
                          }
                        }}
                        style={{
                          width: "100%", padding: "6px 8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-panel)",
                          color: "var(--fg-primary)",
                          borderRadius: 4, fontSize: 13,
                        }}
                      >
                        <option value="">
                          {t("boost.forStudent.none")}
                        </option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {s.instrument} · {t(
                              "students.gradeLabel", { grade: s.skill_level },
                            )}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {/* 方向: 加難度 / 降難度 */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 14,
                  }}
                >
                  {directionItems.map((item) => {
                    const on = direction === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setDirection(item.key)}
                        style={{
                          flex: 1,
                          padding: "8px 4px",
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
                          fontSize: 13,
                          fontWeight: on ? 700 : 400,
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
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

                {/* 加難度: 技巧手法勾選 */}
                {direction === "boost" && (
                  <>
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
                      {techItems.filter((it) => techApplies(it.key)).map((item) => {
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
                                on
                                  ? "var(--accent)"
                                  : "var(--border-light)"
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
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                }}
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
                  </>
                )}

                {/* 降難度: 手法說明 */}
                {direction === "reduce" && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--fg-muted)",
                      lineHeight: 1.6,
                      padding: "10px 12px",
                      background: "var(--bg-secondary)",
                      borderRadius: 6,
                      marginBottom: 14,
                    }}
                  >
                    {t("boost.reduceDesc")}
                  </div>
                )}

                {/* 目標難度: 1-5 選擇器 */}
                {direction === "target" && (
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--fg-muted)",
                        marginBottom: 6,
                      }}
                    >
                      {t("boost.targetLabel")}
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, marginBottom: 6 }}
                    >
                      {[1, 2, 3, 4, 5].map((n) => {
                        const on = targetDiff === n;
                        return (
                          <button
                            key={n}
                            onClick={() => setTargetDiff(n)}
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
                              fontSize: 13,
                              fontWeight: on ? 700 : 400,
                            }}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--fg-tertiary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {t("boost.targetHint")}
                    </div>
                  </div>
                )}

                {/* 強度 (目標難度模式不需要) */}
                {direction !== "target" && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--fg-muted)",
                      marginBottom: 6,
                    }}
                  >
                    {direction === "boost"
                      ? t("boost.intensityLabel")
                      : t("boost.levelLabel")}
                  </div>
                )}
                {direction !== "target" && (
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
                )}

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
                {direction === "boost" && !anyTech && !error && (
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
                <QualityDeltaBadge delta={qualityDelta} />
                {appliedMsg && (
                  <div
                    className="fx-pulse"
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
              disabled={applying || !canApply || !partId}
              style={{
                padding: "7px 18px",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                border: "none",
                borderRadius: 4,
                cursor: applying ? "wait" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                opacity: (!canApply || !partId) ? 0.5 : 1,
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

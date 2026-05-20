/**
 * MeasureEditor — In-app 樂譜編輯面板 (Phase 1)
 *
 * 點 target 譜面任一小節時開啟,列出該小節所有 part 的事件,
 * 提供每個事件的編輯操作:
 *  - 移八度 (↑ / ↓)
 *  - 改力度 (pp / p / mp / mf / f / ff)
 *  - 替換為休止符 (刪除)
 *
 * 這是 Flat.io 等競品的最小可用編輯版本。
 * 真實 note-level 編輯 (改音高、加音、改節奏) 留 Phase 2/3。
 */

import { useEffect, useState } from "react";
import type { MeasureEvent } from "@shared/types";
import { LLMSuggestionDialog } from "./LLMSuggestionDialog";
import { useSessionStore } from "../stores/sessionStore";
import { useMidiInput } from "../hooks/useMidiInput";

interface MeasureEditorProps {
  measure: number | null;
  onClose: () => void;
  /** 點擊譜面的概估 MIDI 音高, 用於自動選定最接近的事件 */
  pitchHint?: number;
}

const DYNAMIC_OPTIONS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"];

export function MeasureEditor(
  { measure, onClose, pitchHint }: MeasureEditorProps,
) {
  const [events, setEvents] = useState<MeasureEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  /** 當前選定事件 (用於鍵盤 ↑/↓ 轉調) */
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showLLM, setShowLLM] = useState(false);

  // MIDI 輸入: 按外接鍵盤 → 修改 selected event 的音高為該鍵
  const midiState = useMidiInput((midi) => {
    if (measure == null || !selectedKey) return;
    const ev = events.find(
      (x) => `${x.part_id}-${x.voice_id}-${x.event_index}` === selectedKey,
    );
    if (!ev || ev.kind === "rest") return;
    // 計算當前音高與目標的半音差
    let curMidi: number | null = null;
    if (ev.kind === "note" && ev.midi != null) curMidi = ev.midi;
    else if (ev.kind === "chord" && ev.midis && ev.midis.length > 0) {
      curMidi = ev.midis[ev.midis.length - 1];  // 取最高音
    }
    if (curMidi == null) return;
    const semitones = midi - curMidi;
    if (semitones === 0) return;
    doEdit(ev, "transpose", { semitones });
  });
  const setTargetMusicXML = useSessionStore((s) => s.setTargetMusicXML);
  const setArrangementIssues = useSessionStore(
    (s) => s.setArrangementIssues,
  );
  const setHistoryFlags = useSessionStore((s) => s.setHistoryFlags);
  const setGlobalLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);
  const arrangement = useSessionStore((s) => s.arrangement);

  const fetchEvents = async (m: number) => {
    setLoading(true);
    try {
      const res = await window.scoreArranger.engine.listMeasureEvents(m);
      if (res.ok && res.data) {
        setEvents(res.data.events);
      } else {
        setEvents([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (measure != null) fetchEvents(measure);
    else setEvents([]);
  }, [measure]);

  // 當 events 或 pitchHint 變動 → 預選最接近的事件
  useEffect(() => {
    if (events.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (pitchHint == null) {
      // 預設選第一個音符事件
      const first = events.find((e) => e.kind !== "rest");
      if (first) {
        setSelectedKey(
          `${first.part_id}-${first.voice_id}-${first.event_index}`,
        );
      }
      return;
    }
    // 找與 pitchHint 最接近的事件
    let best: MeasureEvent | null = null;
    let bestDist = Infinity;
    for (const e of events) {
      let evPitch: number | null = null;
      if (e.kind === "note" && e.midi != null) evPitch = e.midi;
      else if (e.kind === "chord" && e.midis && e.midis.length > 0) {
        // 取最接近 hint 的單音
        evPitch = e.midis.reduce(
          (best, m) =>
            Math.abs(m - pitchHint) < Math.abs(best - pitchHint) ? m : best,
        );
      }
      if (evPitch == null) continue;
      const d = Math.abs(evPitch - pitchHint);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    if (best) {
      setSelectedKey(`${best.part_id}-${best.voice_id}-${best.event_index}`);
    }
  }, [events, pitchHint]);

  // 鍵盤快捷鍵: ↑/↓ = ±1 半音, Shift+↑/↓ = ±1 八度, Delete = 換成休止符
  useEffect(() => {
    if (measure == null || !selectedKey) return;
    const onKey = async (e: KeyboardEvent) => {
      // 忽略 input/select 內按鍵
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const ev = events.find(
        (x) => `${x.part_id}-${x.voice_id}-${x.event_index}` === selectedKey,
      );
      if (!ev) return;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const dir = e.key === "ArrowUp" ? 1 : -1;
        if (e.shiftKey) {
          await doEdit(ev, dir > 0 ? "octave_up" : "octave_down");
        } else {
          await doEdit(ev, "transpose", { semitones: dir });
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        await doEdit(ev, "delete");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, events, measure]);

  if (measure == null) return null;
  if (!arrangement) return null;

  /** 對整個 measure 的某個 part 套用 articulation. */
  const doSetArticulation = async (
    partId: string,
    voiceId: number,
    articulation: string,
    mode: "set" | "add" | "clear",
  ) => {
    if (measure == null) return;
    setGlobalLoading(true, `套用 ${articulation || "clear"}...`);
    try {
      const res = await window.scoreArranger.engine.setMeasureArticulation(
        partId, measure, voiceId, articulation, mode,
      );
      if (res.ok && res.data) {
        if (res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        setError(null);
        await fetchEvents(measure);
      } else {
        setError(res.error ?? "套用 articulation 失敗");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGlobalLoading(false);
    }
  };

  const doEdit = async (
    e: MeasureEvent,
    action: string,
    extra: Record<string, unknown> = {},
  ) => {
    const key = `${e.part_id}-${e.voice_id}-${e.event_index}-${action}`;
    setBusyKey(key);
    setGlobalLoading(true, `編輯 ${action}...`);
    try {
      const res = await window.scoreArranger.engine.editEvent(
        e.part_id, measure, e.voice_id, e.event_index, action, extra,
      );
      if (res.ok && res.data) {
        if (res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        setError(null);
        // 重新抓事件
        await fetchEvents(measure);
      } else {
        setError(res.error ?? "編輯失敗");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGlobalLoading(false);
      setBusyKey(null);
    }
  };

  const renderPitchInfo = (e: MeasureEvent) => {
    if (e.kind === "note") return e.pitch;
    if (e.kind === "chord") return e.pitches?.join("·") ?? "";
    return "(休止)";
  };

  // 按 part_id 分組
  const grouped: Record<string, MeasureEvent[]> = {};
  for (const e of events) {
    (grouped[e.part_id] = grouped[e.part_id] ?? []).push(e);
  }

  const sm: React.CSSProperties = {
    padding: "2px 6px",
    fontSize: 11,
    border: "1px solid var(--border)",
    background: "var(--button-bg)",
    color: "var(--button-fg)",
    borderRadius: 3,
    cursor: "pointer",
  };

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        background: "var(--bg-panel)",
        borderLeft: "1px solid var(--border)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
      }}
    >
      <header
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <strong style={{ flex: 1, fontSize: 14 }}>
          編輯 第 {measure} 小節
        </strong>
        {midiState.enabled && midiState.devices.length > 0 && (
          <span
            title={`MIDI: ${midiState.devices.join(", ")} 已連線, 按鍵替換選定音高`}
            style={{
              fontSize: 10,
              padding: "2px 6px",
              background: "rgba(34, 197, 94, 0.15)",
              color: "rgb(34, 197, 94)",
              borderRadius: 8,
              fontWeight: 600,
              marginRight: 6,
            }}
          >
            🎹 {midiState.devices.length}
          </span>
        )}
        <button
          onClick={() => setShowLLM(true)}
          title="用 Claude AI 問改編建議"
          style={{
            padding: "4px 10px",
            border: "1px solid var(--button-border)",
            background: "var(--button-bg)",
            color: "var(--button-fg)",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            marginRight: 4,
          }}
        >
          🤖
        </button>
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
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading && (
          <div style={{ padding: 16, color: "var(--fg-tertiary)", fontSize: 13 }}>
            ⌛ 載入小節事件...
          </div>
        )}
        {!loading && events.length === 0 && (
          <div style={{ padding: 16, color: "var(--fg-tertiary)", fontSize: 13 }}>
            此小節沒有事件
          </div>
        )}
        {Object.entries(grouped).map(([partId, list]) => (
          <section
            key={partId}
            style={{ borderBottom: "1px solid var(--border-light)" }}
          >
            <div
              style={{
                padding: "6px 14px",
                background: "var(--bg-secondary)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--fg-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ flex: 1 }}>{partId} ({list.length})</span>
              <span style={{
                fontSize: 10,
                textTransform: "none",
                color: "var(--fg-tertiary)",
              }}>
                articulation:
              </span>
              {(["legato", "staccato", "tenuto", "pizzicato", "marcato"] as const)
                .map((a) => (
                  <button
                    key={a}
                    onClick={() => doSetArticulation(partId, list[0]?.voice_id ?? 1, a, "set")}
                    style={{
                      padding: "2px 6px",
                      border: "1px solid var(--border-light)",
                      background: "var(--bg-base)",
                      color: "var(--fg-secondary)",
                      borderRadius: 3,
                      fontSize: 10,
                      textTransform: "none",
                      cursor: "pointer",
                    }}
                    title={`整個小節 ${partId} 套用 ${a}`}
                  >
                    {a}
                  </button>
                ))}
              <button
                onClick={() => doSetArticulation(partId, list[0]?.voice_id ?? 1, "", "clear")}
                style={{
                  padding: "2px 6px",
                  border: "1px solid var(--border-light)",
                  background: "var(--bg-base)",
                  color: "var(--fg-muted)",
                  borderRadius: 3,
                  fontSize: 10,
                  textTransform: "none",
                  cursor: "pointer",
                }}
                title="清除所有 articulation"
              >
                clear
              </button>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {list.map((e) => {
                const eventKey = `${e.part_id}-${e.voice_id}-${e.event_index}`;
                const myKeyPrefix = `${eventKey}-`;
                const isBusy = busyKey?.startsWith(myKeyPrefix);
                const isSelected = selectedKey === eventKey;
                return (
                  <li
                    key={`${e.voice_id}-${e.event_index}`}
                    onClick={() => setSelectedKey(eventKey)}
                    tabIndex={0}
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      color: "var(--fg-secondary)",
                      borderBottom: "1px solid var(--border-light)",
                      opacity: isBusy ? 0.5 : 1,
                      background: isSelected
                        ? "var(--bg-hover)"
                        : "transparent",
                      borderLeft: isSelected
                        ? "3px solid var(--accent)"
                        : "3px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{ color: "var(--fg-primary)", fontWeight: 500 }}
                      >
                        {renderPitchInfo(e)}
                      </span>
                      <span
                        style={{
                          color: "var(--fg-tertiary)",
                          fontSize: 11,
                          fontFamily: "monospace",
                        }}
                      >
                        ♩ {e.duration}
                      </span>
                      {e.dynamic && (
                        <span
                          style={{
                            background: "var(--code-bg)",
                            padding: "1px 6px",
                            borderRadius: 3,
                            fontSize: 10,
                            fontStyle: "italic",
                          }}
                        >
                          {e.dynamic}
                        </span>
                      )}
                    </div>
                    {e.kind !== "rest" && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 4,
                          alignItems: "center",
                        }}
                      >
                        <button
                          disabled={isBusy}
                          onClick={() => doEdit(e, "toggle_lock")}
                          style={{
                            ...sm,
                            background: e.is_locked
                              ? "var(--accent)"
                              : sm.background,
                            color: e.is_locked
                              ? "var(--accent-fg)"
                              : sm.color,
                          }}
                          title={e.is_locked
                            ? "已鎖定 — repair 不會動此音, 點擊解鎖"
                            : "鎖定此音 — repair 不會覆寫"}
                        >
                          {e.is_locked ? "🔒" : "🔓"}
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => doEdit(e, "octave_up")}
                          style={sm}
                          title="上移八度"
                        >
                          ↑8va
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => doEdit(e, "octave_down")}
                          style={sm}
                          title="下移八度"
                        >
                          ↓8va
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => doEdit(e, "transpose", {
                            semitones: 1,
                          })}
                          style={sm}
                          title="+1 半音"
                        >
                          +♯
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => doEdit(e, "transpose", {
                            semitones: -1,
                          })}
                          style={sm}
                          title="-1 半音"
                        >
                          −♭
                        </button>
                        <select
                          disabled={isBusy}
                          value={e.dynamic ?? ""}
                          onChange={(ev) =>
                            doEdit(e, "set_dynamic", {
                              dynamic: ev.target.value || null,
                            })}
                          style={{
                            ...sm,
                            paddingRight: 18,
                          }}
                          title="改力度"
                        >
                          <option value="">(無)</option>
                          {DYNAMIC_OPTIONS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <button
                          disabled={isBusy}
                          onClick={() => doEdit(e, "halve_duration")}
                          style={sm}
                          title="時值縮一半 (♩ → ♪)"
                        >
                          ÷2
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => doEdit(e, "double_duration")}
                          style={sm}
                          title="時值加倍 (♪ → ♩)"
                        >
                          ×2
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => doEdit(e, "add_dot")}
                          style={sm}
                          title="加附點 (×1.5)"
                        >
                          ♩.
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => doEdit(e, "delete")}
                          style={{
                            ...sm,
                            color: "var(--error-fg)",
                            borderColor: "var(--error-fg)",
                          }}
                          title="替換為休止符"
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div
        style={{
          padding: "8px 14px",
          fontSize: 11,
          color: "var(--fg-tertiary)",
          borderTop: "1px solid var(--border-light)",
          background: "var(--bg-secondary)",
        }}
      >
        💡 點任一行選定該事件, 按 <kbd>↑</kbd>/<kbd>↓</kbd> 移半音, <kbd>⇧↑</kbd>/<kbd>⇧↓</kbd> 移八度, <kbd>Del</kbd> 刪除。⌘Z 可 undo。
      </div>
      {showLLM && (
        <LLMSuggestionDialog
          context={describeMeasureForLLM(measure, events)}
          ensemble={arrangement.players
            .map((p) => p.display_name)
            .join(", ")}
          onClose={() => setShowLLM(false)}
        />
      )}
    </aside>
  );
}

/** 把目前 measure 的事件列表轉成 LLM 容易理解的純文字描述 */
function describeMeasureForLLM(
  measure: number | null,
  events: MeasureEvent[],
): string {
  if (measure == null || events.length === 0) {
    return "(沒有事件)";
  }
  const byPart: Record<string, MeasureEvent[]> = {};
  for (const e of events) {
    (byPart[e.part_id] = byPart[e.part_id] ?? []).push(e);
  }
  const lines: string[] = [`第 ${measure} 小節:`];
  for (const [part, list] of Object.entries(byPart)) {
    lines.push(`- ${part}:`);
    for (const e of list) {
      let desc = "";
      if (e.kind === "note") desc = `音 ${e.pitch}`;
      else if (e.kind === "chord") {
        desc = `和弦 [${(e.pitches ?? []).join(" + ")}]`;
      } else desc = "休止";
      const dyn = e.dynamic ? ` (${e.dynamic})` : "";
      lines.push(`  • ${desc}, 時值 ${e.duration}${dyn}`);
    }
  }
  return lines.join("\n");
}

/**
 * 0.1.61: 節拍器浮動面板 (重新設計 A1-A5,B1,C1-C2,D4,E1 + F1)。
 *
 * 獨立於樂譜播放 — 用 useMetronome (lookahead 排程)。可從樂譜帶入速度/拍號 (F1)、
 * 顯示義式速度術語 (D4)、視覺拍點燈 (E1)、每拍重音點擊切換 (A5)。
 * 訓練器 (D1 漸進加速 / D2 靜音) 在面板下方 (見 useMetronome trainer)。
 */
import { useEffect } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";
import { bpmToTempoTerm } from "../utils/tempoTerms";
import {
  type AccentLevel,
  type MetronomeSoundId,
  useMetronome,
} from "../hooks/useMetronome";

const SOUND_IDS: MetronomeSoundId[] = ["woodblock", "click", "beep", "cowbell"];
const SUBDIVISIONS = [
  { n: 1, glyph: "♩" },
  { n: 2, glyph: "♫" },
  { n: 3, glyph: "³" },
  { n: 4, glyph: "♬" },
];
const NUMERATORS = [2, 3, 4, 5, 6, 7, 9, 12];
const DENOMINATORS = [2, 4, 8];

export function MetronomePanel() {
  useLocale();
  const open = useSessionStore((s) => s.metronomeOpen);
  const setOpen = useSessionStore((s) => s.setMetronomeOpen);
  const arrangement = useSessionStore((s) => s.arrangement);

  const m = useMetronome();
  const { state, stop } = m;

  // 面板關閉時停止節拍器 (避免背景一直響)。stop 為 useCallback-stable。
  useEffect(() => {
    if (!open && state.isRunning) stop();
  }, [open, state.isRunning, stop]);

  if (!open) return null;

  const term = bpmToTempoTerm(state.bpm);
  const tempo = arrangement?.tempo ?? null;

  const pullFromScore = () => {
    if (!tempo) return;
    m.setBpm(tempo.base_bpm);
    m.setTimeSig(
      tempo.time_signature.numerator,
      tempo.time_signature.denominator,
    );
  };

  const accentColor = (lvl: AccentLevel): string =>
    lvl === "accent"
      ? "var(--accent)"
      : lvl === "mute"
        ? "var(--border)"
        : "var(--fg-muted)";

  return (
    <div
      className="fx-modal"
      style={{
        position: "fixed",
        right: 18,
        bottom: 70,
        width: 290,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        zIndex: 90,
        padding: 16,
        color: "var(--fg-primary)",
        fontSize: 13,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <strong style={{ fontSize: 14 }}>{t("metronome.title")}</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title={t("metronome.close")}
          style={closeBtn}
        >
          ✕
        </button>
      </div>

      {/* BPM 大顯示 + 義式術語 */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
          ♩ = {state.bpm}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{term}</div>
      </div>

      {/* BPM 滑桿 + ± + Tap */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button type="button" onClick={() => m.setBpm(state.bpm - 1)} style={stepBtn}>−</button>
        <input
          type="range"
          min={20}
          max={300}
          value={state.bpm}
          onChange={(e) => m.setBpm(parseInt(e.target.value, 10))}
          style={{ flex: 1 }}
        />
        <button type="button" onClick={() => m.setBpm(state.bpm + 1)} style={stepBtn}>+</button>
        <button type="button" onClick={m.tap} style={tapBtn} title={t("metronome.tap.title")}>
          {t("metronome.tap")}
        </button>
      </div>

      {/* 拍號 */}
      <div style={{ ...row, marginTop: 12 }}>
        <span style={label}>{t("metronome.timeSig")}</span>
        <select
          value={state.numerator}
          onChange={(e) =>
            m.setTimeSig(parseInt(e.target.value, 10), state.denominator)}
          style={miniSelect}
        >
          {NUMERATORS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ opacity: 0.6 }}>/</span>
        <select
          value={state.denominator}
          onChange={(e) =>
            m.setTimeSig(state.numerator, parseInt(e.target.value, 10))}
          style={miniSelect}
        >
          {DENOMINATORS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {tempo && (
          <button type="button" onClick={pullFromScore} style={pullBtn}
            title={t("metronome.fromScore.title")}>
            {t("metronome.fromScore")}
          </button>
        )}
      </div>

      {/* 拍點燈 + 重音 (點擊循環 accent/normal/mute) */}
      <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
        {state.accents.map((lvl, i) => {
          const active = state.currentBeat === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => m.cycleAccent(i)}
              title={t("metronome.accent.title")}
              style={{
                width: 26,
                height: 34,
                borderRadius: 6,
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                background: active ? accentColor(lvl) : "transparent",
                color: active ? "var(--accent-fg)" : accentColor(lvl),
                fontWeight: lvl === "accent" ? 700 : 400,
                fontSize: lvl === "mute" ? 10 : 13,
                cursor: "pointer",
                transition: "transform .08s, background .08s",
                transform: active ? "scale(1.12)" : "scale(1)",
              }}
            >
              {lvl === "mute" ? "·" : i + 1}
            </button>
          );
        })}
      </div>

      {/* 細分 */}
      <div style={{ ...row, marginTop: 12 }}>
        <span style={label}>{t("metronome.subdivision")}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {SUBDIVISIONS.map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => m.setSubdivision(s.n)}
              style={{
                ...miniBtn,
                background: state.subdivision === s.n
                  ? "var(--accent)" : "transparent",
                color: state.subdivision === s.n
                  ? "var(--accent-fg)" : "var(--fg-primary)",
              }}
            >
              {s.glyph}
            </button>
          ))}
        </div>
      </div>

      {/* 音色 + 音量 */}
      <div style={{ ...row, marginTop: 10 }}>
        <span style={label}>{t("metronome.sound")}</span>
        <select
          value={state.soundId}
          onChange={(e) => m.setSoundId(e.target.value as MetronomeSoundId)}
          style={{ ...miniSelect, flex: 1 }}
        >
          {SOUND_IDS.map((id) => (
            <option key={id} value={id}>{t(`metronome.sound.${id}`)}</option>
          ))}
        </select>
      </div>
      <div style={{ ...row, marginTop: 8 }}>
        <span style={label}>🔊</span>
        <input
          type="range"
          min={-30}
          max={0}
          value={state.volumeDb}
          onChange={(e) => m.setVolumeDb(parseInt(e.target.value, 10))}
          style={{ flex: 1 }}
        />
      </div>

      {/* 練習訓練器 D1/D2 */}
      <div style={{ ...row, marginTop: 12 }}>
        <span style={label}>{t("metronome.trainer")}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {(["off", "speedUp", "mute"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => m.setTrainer({ mode })}
              style={{
                ...miniBtn,
                width: "auto",
                padding: "0 8px",
                fontSize: 11,
                background: state.trainer.mode === mode
                  ? "var(--accent)" : "transparent",
                color: state.trainer.mode === mode
                  ? "var(--accent-fg)" : "var(--fg-primary)",
              }}
            >
              {mode === "off"
                ? t("metronome.trainer.off")
                : mode === "speedUp"
                  ? t("metronome.trainer.speedUp")
                  : t("metronome.trainer.mute")}
            </button>
          ))}
        </div>
      </div>
      {state.trainer.mode === "speedUp" && (
        <div style={{ ...row, marginTop: 6, fontSize: 11, flexWrap: "wrap" }}>
          <span style={{ color: "var(--fg-muted)" }}>
            {t("metronome.trainer.everyBars")}
          </span>
          <input type="number" min={1} max={16} value={state.trainer.everyBars}
            onChange={(e) =>
              m.setTrainer({ everyBars: parseInt(e.target.value, 10) || 1 })}
            style={numInput} />
          <span style={{ color: "var(--fg-muted)" }}>
            {t("metronome.trainer.byBpm")}
          </span>
          <input type="number" min={1} max={30} value={state.trainer.byBpm}
            onChange={(e) =>
              m.setTrainer({ byBpm: parseInt(e.target.value, 10) || 1 })}
            style={numInput} />
          <span style={{ color: "var(--fg-muted)" }}>
            {t("metronome.trainer.toBpm")}
          </span>
          <input type="number" min={40} max={300} value={state.trainer.maxBpm}
            onChange={(e) =>
              m.setTrainer({ maxBpm: parseInt(e.target.value, 10) || 160 })}
            style={numInput} />
        </div>
      )}
      {state.trainer.mode === "mute" && (
        <div style={{ ...row, marginTop: 6, fontSize: 11, flexWrap: "wrap" }}>
          <span style={{ color: "var(--fg-muted)" }}>
            {t("metronome.trainer.everyBars")}
          </span>
          <input type="number" min={1} max={16} value={state.trainer.everyBars}
            onChange={(e) =>
              m.setTrainer({ everyBars: parseInt(e.target.value, 10) || 1 })}
            style={numInput} />
          <span style={{ color: "var(--fg-muted)" }}>
            🔇 {state.trainer.muteBars}
          </span>
          <input type="number" min={1} max={8} value={state.trainer.muteBars}
            onChange={(e) =>
              m.setTrainer({ muteBars: parseInt(e.target.value, 10) || 1 })}
            style={numInput} />
        </div>
      )}

      {/* Start / Stop */}
      <button
        type="button"
        onClick={m.toggle}
        style={{
          width: "100%",
          marginTop: 14,
          padding: "10px 0",
          borderRadius: 8,
          border: "none",
          background: state.isRunning ? "#c44545" : "var(--accent)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        {state.isRunning ? `■ ${t("metronome.stop")}` : `▶ ${t("metronome.start")}`}
      </button>
    </div>
  );
}

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--fg-muted)",
  cursor: "pointer",
  fontSize: 14,
};
const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const label: React.CSSProperties = {
  fontSize: 12,
  color: "var(--fg-muted)",
  minWidth: 44,
};
const miniSelect: React.CSSProperties = {
  fontSize: 13,
  padding: "3px 6px",
  border: "1px solid var(--border)",
  borderRadius: 5,
  background: "var(--bg-elevated, var(--bg-panel))",
  color: "var(--fg-primary)",
};
const miniBtn: React.CSSProperties = {
  width: 34,
  height: 28,
  border: "1px solid var(--border)",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 14,
};
const numInput: React.CSSProperties = {
  width: 44,
  fontSize: 11,
  padding: "2px 4px",
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--bg-elevated, var(--bg-panel))",
  color: "var(--fg-primary)",
};
const stepBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  border: "1px solid var(--border)",
  borderRadius: 5,
  background: "transparent",
  color: "var(--fg-primary)",
  cursor: "pointer",
  fontSize: 15,
};
const tapBtn: React.CSSProperties = {
  padding: "0 10px",
  height: 26,
  border: "1px solid var(--accent)",
  borderRadius: 5,
  background: "transparent",
  color: "var(--accent)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};
const pullBtn: React.CSSProperties = {
  marginLeft: "auto",
  padding: "0 8px",
  height: 26,
  border: "1px solid var(--border)",
  borderRadius: 5,
  background: "transparent",
  color: "var(--fg-muted)",
  cursor: "pointer",
  fontSize: 11,
};

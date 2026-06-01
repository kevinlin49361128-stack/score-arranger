/**
 * MelodyRoutingPanel — 主旋律路線編輯器 (M-UI)
 *
 * 逐樂段指定主旋律落在哪個聲部 (+ 加倍 / 移低聲部移調)。設計理念 (見
 * docs/melody_routing_ui_mockup.html): 預設全自動, 只覆寫在意的樂段; 旋律遊走
 * 做成看得見的彩色路徑; 選低聲部就地跳出移調選項。
 *
 * 自包含: 從 sessionStore 讀 arrangement (聲部 + 小節數), 編輯後把 routing
 * 交給 onApply (由 Toolbar 用 arrangeCustom 重改編)。
 */
import { useMemo, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

export interface MelodyRoutingEntry {
  span: [number, number];
  targets: string[];
  register?: "natural" | "octave_down" | "key_down";
}

const VOICE_COLORS = [
  "#5b8cff", "#36c5d6", "#5ec77e", "#e0a458",
  "#c98bdb", "#e0697e", "#9aa4b2", "#d4b94e",
];
// 低音域樂器 → 主旋律放進去通常要移調 (顯示移調選項)。
const LOW_INSTRUMENTS = new Set([
  "viola", "cello", "violoncello", "double_bass", "contrabass",
  "bassoon", "trombone", "tuba", "bass_clarinet", "baritone_sax",
  "french_horn", "horn",
]);

const SEG_SIZE = 4; // 每段小節數 (MVP; 引擎以小節 coalesce, 之後可換真樂句邊界)

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (routing: MelodyRoutingEntry[]) => void;
}

interface SegState {
  targets: string[]; // 空 = 自動
  register: "natural" | "octave_down" | "key_down";
}

export function MelodyRoutingPanel({ open, onClose, onApply }: Props) {
  useLocale();
  const arrangement = useSessionStore((s) => s.arrangement);

  const voices = useMemo(
    () =>
      (arrangement?.players ?? []).map((p, i) => ({
        id: p.player_id,
        name: p.display_name,
        instrument: p.primary_instrument,
        color: VOICE_COLORS[i % VOICE_COLORS.length],
        low: LOW_INSTRUMENTS.has(p.primary_instrument),
      })),
    [arrangement],
  );

  const measureCount = useMemo(() => {
    // span?.[1] + filter — 防呆: 萬一某 assignment 沒帶 span (如舊版 engine
    // 的 arrange_custom 回應), 退回 0 顯示空狀態, 不要讓整個 renderer 崩潰。
    const spans = (arrangement?.assignments ?? [])
      .map((a) => a.span?.[1])
      .filter((n): n is number => typeof n === "number");
    return spans.length ? Math.max(...spans) : 0;
  }, [arrangement]);

  const segments = useMemo(() => {
    const segs: Array<[number, number]> = [];
    for (let m = 1; m <= measureCount; m += SEG_SIZE) {
      segs.push([m, Math.min(m + SEG_SIZE - 1, measureCount)]);
    }
    return segs;
  }, [measureCount]);

  const [seg, setSeg] = useState<Record<number, SegState>>({});
  const [sel, setSel] = useState<number>(-1);

  if (!open) return null;
  if (!arrangement || voices.length === 0 || measureCount === 0) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: 24, color: "var(--fg-muted)" }}>
          {t("melodyRouting.needArrangement")}
        </div>
      </Overlay>
    );
  }

  const stOf = (i: number): SegState =>
    seg[i] ?? { targets: [], register: "octave_down" };
  const isAuto = (i: number) => stOf(i).targets.length === 0;
  const needsReg = (i: number) =>
    stOf(i).targets.some((id) => voices.find((v) => v.id === id)?.low);

  function setSegState(i: number, patch: Partial<SegState>) {
    setSeg((prev) => ({ ...prev, [i]: { ...stOf(i), ...patch } }));
  }
  function toggleVoice(i: number, id: string) {
    const cur = stOf(i).targets;
    let next: string[];
    if (cur.includes(id)) next = cur.filter((x) => x !== id);
    else next = cur.length >= 2 ? [cur[1], id] : [...cur, id];
    setSegState(i, { targets: next });
  }
  function applyPreset(p: string) {
    const next: Record<number, SegState> = {};
    segments.forEach(([_s, _e], i) => {
      if (p === "auto") return;
      if (p === "allFirst") next[i] = { targets: [voices[0].id], register: "octave_down" };
      else if (p === "split") next[i] = { targets: [voices[i % 2]?.id ?? voices[0].id], register: "octave_down" };
      else if (p === "rotate") next[i] = { targets: [voices[i % voices.length].id], register: "octave_down" };
    });
    setSeg(next);
    setSel(-1);
  }

  function buildRouting(): MelodyRoutingEntry[] {
    const out: MelodyRoutingEntry[] = [];
    segments.forEach(([s, e], i) => {
      const st = stOf(i);
      if (st.targets.length === 0) return; // auto
      out.push({
        span: [s, e],
        targets: st.targets,
        register: needsReg(i) ? st.register : "natural",
      });
    });
    return out;
  }

  const label = (i: number) => {
    const st = stOf(i);
    if (st.targets.length === 0) return t("melodyRouting.auto");
    return st.targets
      .map((id) => voices.find((v) => v.id === id)?.name ?? "?")
      .join(" + ");
  };
  const segBg = (i: number) => {
    const st = stOf(i);
    if (st.targets.length === 0) return "var(--bg-elev, #2a3140)";
    const cs = st.targets.map((id) => voices.find((v) => v.id === id)?.color ?? "#888");
    return cs.length > 1 ? `linear-gradient(90deg, ${cs[0]}, ${cs[1]})` : cs[0];
  };
  const overrides = segments.filter((_s, i) => !isAuto(i)).length;

  return (
    <Overlay onClose={onClose}>
      <div style={{ padding: "18px 20px", minWidth: 560, maxWidth: 860 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>{t("melodyRouting.title")}</h2>
          <button onClick={onClose} className="sa-icon-btn" aria-label="close" style={{ fontSize: 18, background: "none", border: 0, color: "var(--fg-muted)", cursor: "pointer" }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: "0 0 12px" }}>
          {t("melodyRouting.hint", { overrides, total: segments.length })}
        </p>

        {/* presets */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
          {[
            ["allFirst", t("melodyRouting.preset.allFirst")],
            ["split", t("melodyRouting.preset.split")],
            ["rotate", t("melodyRouting.preset.rotate")],
            ["auto", t("melodyRouting.preset.auto")],
          ].map(([k, lbl]) => (
            <button key={k} onClick={() => applyPreset(k)} style={chipStyle(false)}>{lbl}</button>
          ))}
        </div>

        {/* path ribbon */}
        <div style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border, #2a2f3a)", marginBottom: 3 }}>
          {segments.map((_s, i) => (
            <div key={i} style={{ flex: 1, background: segBg(i), borderRight: i < segments.length - 1 ? "1px solid #0009" : "none", position: "relative" }}>
              {!isAuto(i) && needsReg(i) && (
                <span style={{ position: "absolute", top: 0, right: 2, fontSize: 8, color: "#0c1220", fontWeight: 700 }}>
                  {stOf(i).register === "key_down" ? "↓K" : "↓8"}
                </span>
              )}
            </div>
          ))}
        </div>
        {/* segment strip */}
        <div style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: 4 }}>
          {segments.map(([s, e], i) => (
            <button
              key={i}
              onClick={() => setSel(i)}
              title={`mm.${s}-${e}`}
              style={{
                flex: "1 0 52px", minWidth: 52, height: 42, borderRadius: 6,
                border: sel === i ? "2px solid var(--accent, #7aa2ff)" : "1px solid var(--border, #2a2f3a)",
                background: "var(--bg-elev, #1d2129)", cursor: "pointer", color: "var(--fg)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                position: "relative", padding: 0,
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: isAuto(i) ? 400 : 700, color: isAuto(i) ? "var(--fg-muted)" : "var(--fg)" }}>{label(i)}</span>
              <span style={{ fontSize: 9, color: "var(--fg-muted)" }}>{`m${s}-${e}`}</span>
              {!isAuto(i) && stOf(i).targets.length > 1 && (
                <span style={{ position: "absolute", top: 2, left: 4, fontSize: 9 }}>＝</span>
              )}
            </button>
          ))}
        </div>

        {/* detail */}
        {sel >= 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border, #2a2f3a)", paddingTop: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--accent, #7aa2ff)", marginBottom: 8 }}>
              {t("melodyRouting.segLabel", { from: segments[sel][0], to: segments[sel][1] })}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 6 }}>{t("melodyRouting.pickVoices")}</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
              {voices.map((v) => {
                const on = stOf(sel).targets.includes(v.id);
                return (
                  <button key={v.id} onClick={() => toggleVoice(sel, v.id)} style={chipStyle(on)}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: v.color, display: "inline-block", marginRight: 6 }} />
                    {v.name}
                  </button>
                );
              })}
            </div>
            {needsReg(sel) && (
              <div style={{ padding: "9px 11px", background: "var(--bg-elev, #1a1d24)", border: "1px solid #5552", borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#e0a458", marginBottom: 5 }}>{t("melodyRouting.lowWarn")}</div>
                {(["octave_down", "key_down"] as const).map((r) => (
                  <label key={r} style={{ fontSize: 12.5, marginRight: 14, cursor: "pointer", color: "var(--fg)" }}>
                    <input type="radio" name="mr-reg" checked={stOf(sel).register === r} onChange={() => setSegState(sel, { register: r })} style={{ marginRight: 4 }} />
                    {t(`melodyRouting.reg.${r}`)}
                  </label>
                ))}
                <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 5 }}>{t("melodyRouting.rebalanceNote")}</div>
              </div>
            )}
            <button onClick={() => { setSegState(sel, { targets: [] }); }} style={chipStyle(false)}>{t("melodyRouting.toAuto")}</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnStyle(true)}>{t("melodyRouting.cancel")}</button>
          <button onClick={() => { onApply(buildRouting()); onClose(); }} style={btnStyle(false)}>{t("melodyRouting.apply")}</button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "#0008", backdropFilter: "blur(3px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-panel, #171a21)", border: "1px solid var(--border, #2a2f3a)", borderRadius: 14, boxShadow: "0 18px 60px #000a", maxHeight: "86vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function chipStyle(on: boolean): React.CSSProperties {
  return {
    fontSize: 12.5, padding: "5px 12px", borderRadius: 18,
    border: on ? "1.5px solid var(--fg, #fff)" : "1px solid var(--border, #2a2f3a)",
    background: on ? "var(--accent-dim, #2a3550)" : "var(--bg-elev, #222732)",
    color: on ? "#fff" : "var(--fg, #cdd5e0)", cursor: "pointer",
    display: "inline-flex", alignItems: "center",
  };
}
function btnStyle(ghost: boolean): React.CSSProperties {
  return {
    padding: "9px 18px", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
    border: ghost ? "1px solid var(--border, #2a2f3a)" : "0",
    background: ghost ? "var(--bg-elev, #222732)" : "var(--accent, #7aa2ff)",
    color: ghost ? "var(--fg)" : "#06101f",
  };
}

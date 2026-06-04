/**
 * TessituraPanel — VIZ-2 音域帶狀圖
 *
 * 每改編聲部一條帶: 實際用到的音域 (used) 疊在樂器舒適 (comfortable) / 絕對
 * (absolute) 區間上。一眼看出哪個聲部頂到/超出音域 —— 正是 issue panel 在逐筆
 * 抓的可演奏性, 但這裡用視覺一次看完。資料來自引擎 tessitura (當前 arrangement)。
 */
import { useEffect, useState } from "react";

import type { TessituraPart } from "../../shared/types";
import { t } from "../utils/i18n";
import { useSessionStore } from "../stores/sessionStore";

// MIDI number → 音名 (軸標籤用, 不含八度細節僅供參考)
function midiName(m: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[m % 12]}${Math.floor(m / 12) - 1}`;
}

export function TessituraPanel(): JSX.Element | null {
  const arrangement = useSessionStore((s) => s.arrangement);
  const [parts, setParts] = useState<TessituraPart[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!arrangement) {
      setParts([]);
      return;
    }
    void (async () => {
      try {
        const res = await window.scoreArranger.engine.tessitura();
        if (!cancelled && res.ok && res.data) setParts(res.data.parts);
      } catch {
        if (!cancelled) setParts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [arrangement]);

  if (!parts.length) return null;

  // 共用音高刻度: 取所有聲部 absolute (退而求 used) 的極值
  const lo = Math.min(
    ...parts.map((p) => p.absolute_low ?? p.used_low),
  );
  const hi = Math.max(
    ...parts.map((p) => p.absolute_high ?? p.used_high),
  );
  const span = Math.max(1, hi - lo);
  const pct = (m: number) => ((m - lo) / span) * 100;

  return (
    <div style={{ padding: "8px 4px" }}>
      <div
        style={{
          fontSize: 12, fontWeight: 700, color: "var(--gold, #d9a441)",
          marginBottom: 8, letterSpacing: 0.5,
        }}
      >
        {t("viz.tessitura.heading")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {parts.map((p) => {
          const outAbs = (p.out_absolute ?? 0) > 0;
          const outCmf = (p.out_comfortable ?? 0) > 0;
          const usedColor = outAbs
            ? "var(--error-fg, #c9655a)"
            : outCmf
              ? "var(--warning-fg, #d9a441)"
              : "var(--green, #5fae6b)";
          const cLo = p.comfortable_low ?? p.used_low;
          const cHi = p.comfortable_high ?? p.used_high;
          const tip = [
            `${t("viz.tessitura.used")} ${midiName(p.used_low)}–${midiName(p.used_high)}`,
            p.comfortable_low != null
              ? `${t("viz.tessitura.comfortable")} ${midiName(cLo)}–${midiName(cHi)}`
              : "",
            outCmf ? `${t("viz.tessitura.outComfort")} ${p.out_comfortable}` : "",
            outAbs ? `${t("viz.tessitura.outAbsolute")} ${p.out_absolute}` : "",
          ].filter(Boolean).join(" · ");
          return (
            <div key={p.part_id} title={tip}>
              <div
                style={{
                  fontSize: 11, color: "var(--fg-muted)", marginBottom: 2,
                  display: "flex", justifyContent: "space-between",
                }}
              >
                <span>{p.display_name}</span>
                {(outAbs || outCmf) && (
                  <span style={{ color: usedColor, fontWeight: 600 }}>
                    {outAbs
                      ? t("viz.tessitura.flagAbsolute")
                      : t("viz.tessitura.flagComfort")}
                  </span>
                )}
              </div>
              {/* 刻度軌: absolute(底) → comfortable(帶) → used(實) */}
              <div
                style={{
                  position: "relative", height: 12, borderRadius: 6,
                  background: "var(--bg-panel)", border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                {/* comfortable 區間 — 淡帶 */}
                <div
                  style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: `${pct(cLo)}%`, width: `${pct(cHi) - pct(cLo)}%`,
                    background: "rgba(255,255,255,0.07)",
                  }}
                />
                {/* used 區間 — 實心條 */}
                <div
                  style={{
                    position: "absolute", top: 2, bottom: 2,
                    left: `${pct(p.used_low)}%`,
                    width: `${Math.max(1.5, pct(p.used_high) - pct(p.used_low))}%`,
                    background: usedColor, borderRadius: 4,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

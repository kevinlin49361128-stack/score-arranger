/**
 * MicPracticePanel — 0.1.35 Performance-Following
 *
 * 點工具列 🎤 → 開麥克風 → 即時顯示偵測到的音高 + cents 偏差.
 * 同時跑「最近 5 秒」的 pitch trail 視覺化 (橫向折線, 半音格線).
 *
 * 設計範圍 (MVP v1):
 * - 純監聽 — 顯示「你正在唱/拉/吹什麼」
 * - 不對比 target_score (留 v2)
 * - 不存 session log (留 v2)
 * - 完成: 用 user 真的感受到「軟體在聽我了」, 把流量先做出來
 *
 * 為什麼不一次做完全自動評估: 真正的 score-following 需要 DTW 對齊
 * + onset 偵測 + 拍子追蹤, 是另一個 2 週工程. MVP 先驗證 mic 鏈路打通,
 * 同時提供有用的調音 / 練習功能.
 */

import { useEffect, useRef, useState } from "react";
import {
  type PitchSample,
  PitchMonitor,
  midiToName,
} from "../utils/pitchMonitor";
import { t, useLocale } from "../utils/i18n";

interface Props {
  onClose: () => void;
}

const TRAIL_SECONDS = 5;
const TRAIL_PIXELS_PER_SEC = 80;
const TRAIL_HEIGHT = 280;
// 顯示音域 (MIDI) — A2 (45) 到 A6 (93), 含絕大多數樂器
const SHOW_MIDI_MIN = 45;
const SHOW_MIDI_MAX = 93;

export function MicPracticePanel({ onClose }: Props) {
  useLocale();
  const [state, setState] = useState<
    "idle" | "requesting" | "listening" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<PitchSample | null>(null);
  const monitorRef = useRef<PitchMonitor | null>(null);
  const trailRef = useRef<PitchSample[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // 啟動 / 停止
  const start = async () => {
    if (monitorRef.current) return;
    setState("requesting");
    setError(null);
    try {
      const m = new PitchMonitor({ pollHz: 30 });
      m.onSample((s) => {
        setLatest(s);
        // trail buffer: 留 TRAIL_SECONDS 秒
        trailRef.current.push(s);
        const cutoff = s.t - TRAIL_SECONDS * 1000;
        while (
          trailRef.current.length > 0 && trailRef.current[0].t < cutoff
        ) {
          trailRef.current.shift();
        }
      });
      await m.start();
      monitorRef.current = m;
      setState("listening");
      // 開 rAF 畫 trail
      const draw = () => {
        drawTrail(canvasRef.current, trailRef.current);
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch (e) {
      setState("error");
      // 0.1.46 D2: 區分錯誤類型, 給可操作建議
      const raw = e instanceof Error ? e.message : String(e);
      const name = e instanceof Error ? e.name : "";
      let hint = raw;
      if (name === "NotAllowedError" || /permission|denied/i.test(raw)) {
        hint = t("micPractice.error.permission");
      } else if (name === "NotFoundError" || /no.*device|device.*not.*found/i.test(raw)) {
        hint = t("micPractice.error.noDevice");
      } else if (name === "NotReadableError" || /in use|busy/i.test(raw)) {
        hint = t("micPractice.error.inUse");
      } else if (/not.*support|secure/i.test(raw)) {
        hint = t("micPractice.error.notSupported");
      }
      setError(hint);
    }
  };

  const stop = async () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (monitorRef.current) {
      await monitorRef.current.stop();
      monitorRef.current = null;
    }
    trailRef.current = [];
    setLatest(null);
    setState("idle");
  };

  // unmount 清理
  useEffect(() => {
    return () => {
      stop().catch(() => {});
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 110, display: "flex", alignItems: "center",
        justifyContent: "center",
      }}
      onClick={() => {
        stop().then(onClose);
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 600, maxHeight: "85vh", background: "var(--bg-panel)",
          borderRadius: 8, border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        <header
          style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <strong style={{ flex: 1, fontSize: 14 }}>
            🎤 {t("micPractice.title")}
          </strong>
          <button
            onClick={() => stop().then(onClose)}
            style={{
              padding: "4px 12px", fontSize: 12,
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)", borderRadius: 4,
              color: "var(--fg-primary)", cursor: "pointer",
            }}
          >
            {t("micPractice.close")}
          </button>
        </header>

        <div style={{ padding: 16, overflow: "auto" }}>
          <p style={{
            fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.6,
            marginBottom: 12,
          }}>
            {t("micPractice.intro")}
          </p>

          {state === "idle" && (
            <button
              onClick={start}
              style={{
                width: "100%", padding: "12px 18px",
                background: "var(--accent)",
                color: "var(--bg-panel)",
                border: "none", borderRadius: 6, cursor: "pointer",
                fontSize: 14, fontWeight: 600,
              }}
            >
              🎙 {t("micPractice.startBtn")}
            </button>
          )}

          {state === "requesting" && (
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
              {t("micPractice.requestingPermission")}
            </div>
          )}

          {state === "error" && (
            <div
              style={{
                padding: 10, background: "var(--error-bg)",
                color: "var(--error-fg)", borderRadius: 4, fontSize: 12,
              }}
            >
              ⚠ {t("micPractice.errorPrefix")}: {error}
            </div>
          )}

          {state === "listening" && (
            <>
              {/* 當前音高大字顯示 */}
              <NowPlaying sample={latest} />
              {/* trail canvas */}
              <div
                style={{
                  marginTop: 14, border: "1px solid var(--border-light)",
                  borderRadius: 6, overflow: "hidden",
                  background: "var(--bg-secondary)",
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={TRAIL_SECONDS * TRAIL_PIXELS_PER_SEC}
                  height={TRAIL_HEIGHT}
                  style={{
                    display: "block", width: "100%", height: TRAIL_HEIGHT,
                  }}
                />
              </div>
              <p style={{
                marginTop: 10, fontSize: 11,
                color: "var(--fg-tertiary)", lineHeight: 1.6,
              }}>
                {t("micPractice.legendHint")}
              </p>
              <button
                onClick={stop}
                style={{
                  marginTop: 14, width: "100%", padding: "10px 16px",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)", borderRadius: 6,
                  color: "var(--fg-primary)", fontSize: 13, cursor: "pointer",
                }}
              >
                ⏹ {t("micPractice.stopBtn")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NowPlaying({ sample }: { sample: PitchSample | null }) {
  useLocale();
  if (!sample || sample.midi === null) {
    return (
      <div style={{
        textAlign: "center", padding: "22px 0",
        color: "var(--fg-tertiary)", fontSize: 14,
      }}>
        {t("micPractice.waitingForSignal")}
      </div>
    );
  }
  const cents = sample.cents ?? 0;
  const inTune = Math.abs(cents) <= 10;
  const color = inTune ? "#34d399"
    : Math.abs(cents) <= 25 ? "var(--accent)"
    : "#ef4444";
  return (
    <div style={{ textAlign: "center", padding: "18px 0" }}>
      <div style={{ fontSize: 48, fontWeight: 700, fontFamily: "var(--serif)",
                    color, lineHeight: 1, letterSpacing: ".02em" }}>
        {midiToName(sample.midi)}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: "var(--fg-muted)",
                    fontVariantNumeric: "tabular-nums" }}>
        {sample.hz?.toFixed(1)} Hz
        {"  ·  "}
        <span style={{ color }}>
          {cents > 0 ? `+${cents}` : cents}¢
        </span>
        {inTune && " ✓"}
      </div>
    </div>
  );
}

/** 把 trail 畫進 canvas — 一條 pitch 折線 + 半音格線. */
function drawTrail(
  canvas: HTMLCanvasElement | null,
  trail: PitchSample[],
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  // bg
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, w, h);

  // 半音格線 (淡灰) — 每個 C 標 label
  const midiRange = SHOW_MIDI_MAX - SHOW_MIDI_MIN;
  for (let m = SHOW_MIDI_MIN; m <= SHOW_MIDI_MAX; m++) {
    const y = h - ((m - SHOW_MIDI_MIN) / midiRange) * h;
    if (m % 12 === 0) {
      // C — 較亮
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px sans-serif";
      ctx.fillText(midiToName(m), 4, y - 2);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
    }
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // pitch trail
  if (trail.length < 2) return;
  const now = trail[trail.length - 1].t;
  const start = now - TRAIL_SECONDS * 1000;

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#d8843a"; // accent gold
  let drawing = false;
  ctx.beginPath();
  for (const s of trail) {
    if (s.midi === null) {
      drawing = false;
      continue;
    }
    if (s.midi < SHOW_MIDI_MIN || s.midi > SHOW_MIDI_MAX) continue;
    const midiFloat = s.midi + (s.cents ?? 0) / 100;
    const x = 28 + ((s.t - start) / (TRAIL_SECONDS * 1000)) * (w - 28);
    const y = h - ((midiFloat - SHOW_MIDI_MIN) / midiRange) * h;
    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

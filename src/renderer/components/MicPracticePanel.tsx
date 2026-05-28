/**
 * MicPracticePanel — 0.1.35 Performance-Following / 0.1.54 H 跟拍
 *
 * 兩種模式:
 * - monitor (現況): 開麥克風 → 顯示音高 + cents 偏差 + 5 秒 pitch trail.
 * - follow (0.1.54): 軟體找你拉到第幾小節, 同步 highlight 在 score 上.
 *
 * 設計選擇 (避免博士論文等級複雜度): 不做 onset / DTW, 純看 pitch 序列
 * 對位 — 細節見 utils/scoreFollower.ts.
 *
 * 為什麼留 monitor: 練習前空拉 / 調音 / 試錄音, 不一定有改編譜.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type PitchSample,
  PitchMonitor,
  midiToName,
} from "../utils/pitchMonitor";
import {
  type MelodyPitch,
  deviationSemitones,
  expectedMidiForMeasure,
  extractMelodyPitches,
  findCurrentMeasure,
} from "../utils/scoreFollower";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

interface Props {
  onClose: () => void;
}

type Mode = "monitor" | "follow";

const TRAIL_SECONDS = 5;
const TRAIL_PIXELS_PER_SEC = 80;
const TRAIL_HEIGHT = 280;
// 顯示音域 (MIDI) — A2 (45) 到 A6 (93), 含絕大多數樂器
const SHOW_MIDI_MIN = 45;
const SHOW_MIDI_MAX = 93;

// follow 模式 — 每 250ms 重算對位
const FOLLOW_INTERVAL_MS = 250;
// 取最近 8 個 sample (~270ms @ 30Hz) 做 sliding window 匹配
const FOLLOW_WINDOW = 8;
// 信心度低於此值不更新 highlight, 避免抖動
const FOLLOW_CONFIDENCE_THRESHOLD = 0.6;

export function MicPracticePanel({ onClose }: Props) {
  useLocale();
  const arrangement = useSessionStore((s) => s.arrangement);
  const setHighlightedMeasure = useSessionStore((s) => s.setHighlightedMeasure);

  // 從 arrangement 抽出旋律序列 (只在 arrangement 變動時重算)
  const melody = useMemo<MelodyPitch[]>(
    () => extractMelodyPitches(arrangement),
    [arrangement],
  );
  const canFollow = melody.length > 0;

  const [mode, setMode] = useState<Mode>("monitor");
  const [state, setState] = useState<
    "idle" | "requesting" | "listening" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<PitchSample | null>(null);
  const [followStatus, setFollowStatus] = useState<{
    measure: number | null;
    confidence: number;
  }>({ measure: null, confidence: 0 });

  const monitorRef = useRef<PitchMonitor | null>(null);
  const trailRef = useRef<PitchSample[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const followIntervalRef = useRef<number | null>(null);
  // 用 ref 拿最新 melody / mode, 避免 setInterval 閉包抓到舊值
  const melodyRef = useRef<MelodyPitch[]>(melody);
  const modeRef = useRef<Mode>(mode);
  // follow 對位的 anchor — 上一輪算出的 measure, 用作下一輪 startHint
  const followHintRef = useRef<number>(1);

  useEffect(() => {
    melodyRef.current = melody;
  }, [melody]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // arrangement 消失 → follow 失效, 強制回 monitor
  useEffect(() => {
    if (!canFollow && mode === "follow") setMode("monitor");
  }, [canFollow, mode]);

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
      // follow tick — 不管 mode 都跑, 內部按 mode 判斷; 換 mode 不用重起
      followIntervalRef.current = window.setInterval(() => {
        if (modeRef.current !== "follow") return;
        const mel = melodyRef.current;
        if (mel.length === 0) return;
        // 取最近 FOLLOW_WINDOW 個 sample
        const recent = trailRef.current.slice(-FOLLOW_WINDOW);
        if (recent.length === 0) return;
        const res = findCurrentMeasure(recent, mel, followHintRef.current);
        setFollowStatus({ measure: res.measure, confidence: res.confidence });
        if (res.confidence >= FOLLOW_CONFIDENCE_THRESHOLD) {
          followHintRef.current = res.measure;
          setHighlightedMeasure(res.measure);
        }
      }, FOLLOW_INTERVAL_MS);
    } catch (e) {
      setState("error");
      // 0.1.46 D2: 區分錯誤類型, 給可操作建議
      const raw = e instanceof Error ? e.message : String(e);
      const name = e instanceof Error ? e.name : "";
      let hint = raw;
      if (name === "NotAllowedError" || /permission|denied/i.test(raw)) {
        hint = t("micPractice.error.permission");
      } else if (
        name === "NotFoundError" || /no.*device|device.*not.*found/i.test(raw)
      ) {
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
    if (followIntervalRef.current !== null) {
      clearInterval(followIntervalRef.current);
      followIntervalRef.current = null;
    }
    if (monitorRef.current) {
      await monitorRef.current.stop();
      monitorRef.current = null;
    }
    trailRef.current = [];
    setLatest(null);
    setFollowStatus({ measure: null, confidence: 0 });
    setState("idle");
  };

  // unmount 清理
  useEffect(() => {
    return () => {
      stop().catch(() => {});
    };
  }, []);

  // 當前期望音 (給偏差顯示用) — 用 follow 算出的 measure 找
  const expectedMidi = followStatus.measure !== null
    ? expectedMidiForMeasure(melody, followStatus.measure)
    : null;
  const deviation = mode === "follow"
    ? deviationSemitones(latest?.midi ?? null, expectedMidi)
    : null;

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
          <ModeToggle
            mode={mode}
            canFollow={canFollow}
            onChange={setMode}
          />
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
              {mode === "follow" && (
                <FollowStatus
                  status={followStatus}
                  deviation={deviation}
                />
              )}
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

function ModeToggle({
  mode,
  canFollow,
  onChange,
}: {
  mode: Mode;
  canFollow: boolean;
  onChange: (m: Mode) => void;
}) {
  useLocale();
  const btn = (m: Mode, label: string, disabled = false) => {
    const active = mode === m;
    return (
      <button
        onClick={() => {
          if (!disabled) onChange(m);
        }}
        disabled={disabled}
        title={
          disabled && m === "follow" ? t("mic.follow.noArrangement") : undefined
        }
        style={{
          padding: "4px 10px", fontSize: 12,
          background: active ? "var(--accent)" : "var(--bg-tertiary)",
          color: active ? "var(--bg-panel)" : "var(--fg-primary)",
          border: "1px solid var(--border)",
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          borderRadius: 0,
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      style={{
        display: "inline-flex", borderRadius: 4, overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      {btn("monitor", t("mic.mode.monitor"))}
      {btn("follow", t("mic.mode.follow"), !canFollow)}
    </div>
  );
}

function FollowStatus({
  status,
  deviation,
}: {
  status: { measure: number | null; confidence: number };
  deviation: number | null;
}) {
  useLocale();
  const pct = Math.round(status.confidence * 100);
  const synced = status.measure !== null && status.confidence > 0.3;
  const offThreshold = 1; // > 1 semitone 視為偏
  const isOff = deviation !== null && Math.abs(deviation) > offThreshold;

  return (
    <div
      style={{
        padding: "10px 12px", background: "var(--bg-secondary)",
        border: "1px solid var(--border-light)", borderRadius: 6,
        marginBottom: 10,
      }}
    >
      {synced ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-primary)" }}>
          {t("mic.follow.measure", { n: status.measure! })}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
          {t("mic.follow.waitingForSync")}
        </div>
      )}
      {/* 信心 bar */}
      <div
        style={{
          marginTop: 8, height: 6, background: "var(--bg-tertiary)",
          borderRadius: 3, overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`, height: "100%",
            background: pct >= 60
              ? "#34d399"
              : pct >= 30 ? "var(--accent)" : "#ef4444",
            transition: "width 120ms linear",
          }}
        />
      </div>
      <div
        style={{
          marginTop: 4, fontSize: 11, color: "var(--fg-tertiary)",
          display: "flex", justifyContent: "space-between",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{t("mic.follow.confidence", { pct })}</span>
        {isOff && deviation !== null && (
          <span style={{ color: "#ef4444", fontWeight: 600 }}>
            {deviation < 0
              ? t("mic.follow.deviationLow", { n: Math.abs(deviation) })
              : t("mic.follow.deviationHigh", { n: deviation })}
          </span>
        )}
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

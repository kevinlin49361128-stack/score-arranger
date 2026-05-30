/**
 * 0.1.61: 獨立節拍器引擎 (節拍器重新設計 A1-A5,B1,C1-C2,D1-D3,E1)。
 *
 * 為什麼不用 Tone.Transport: 樂譜播放 (PlaybackControls) 已獨佔 Transport
 * 與其 bpm。節拍器要能「不播樂譜也獨立跑」且 bpm 自主, 所以採經典的
 * lookahead 排程 (《A Tale of Two Clocks》): 用 setInterval 提前把點擊排到
 * AudioContext 的精確時間軸上, 完全不碰 Transport。視覺拍點則用 rAF 讀
 * audio time 對齊, 不靠 setState 的時序 (避免抖動)。
 *
 * 音色全部合成 (Tone 合成節點), 不載網路取樣 — CSP / 離線皆安全。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

export type AccentLevel = "accent" | "normal" | "mute";
export type MetronomeSoundId = "woodblock" | "click" | "beep" | "cowbell";
export type TrainerMode = "off" | "speedUp" | "mute";

export interface TrainerConfig {
  mode: TrainerMode;
  /** speedUp: 每 N 小節加速; mute: 連續 N 小節有聲 */
  everyBars: number;
  /** speedUp: 每次 +M BPM */
  byBpm: number;
  /** speedUp: 加速上限 BPM */
  maxBpm: number;
  /** mute: 有聲後靜音 K 小節 (練內在拍感) */
  muteBars: number;
}

export interface MetronomeState {
  isRunning: boolean;
  bpm: number;
  numerator: number;
  denominator: number;
  /** 每拍重音強度, 長度 = numerator */
  accents: AccentLevel[];
  /** 每拍細分數: 1=無, 2=八分, 3=三連音, 4=十六分 */
  subdivision: number;
  soundId: MetronomeSoundId;
  volumeDb: number;
  /** 目前拍 (0-based); 停止時 -1。給視覺拍點燈用 */
  currentBeat: number;
  /** D1/D2 練習訓練器 */
  trainer: TrainerConfig;
}

const MIN_BPM = 20;
const MAX_BPM = 300;

/** 預設每拍重音: 第一拍 accent, 其餘 normal */
function defaultAccents(n: number): AccentLevel[] {
  return Array.from({ length: n }, (_, i) => (i === 0 ? "accent" : "normal"));
}

type Tier = "accent" | "normal" | "sub";

/**
 * 依音色 + 強度算出 (音高, 時長秒, 音量dB 偏移)。
 * accent 高且響、normal 中、sub (細分) 更高更小聲更短。
 */
function clickSpec(
  sound: MetronomeSoundId,
  tier: Tier,
): { freq: number; dur: number; gain: number } {
  const base: Record<MetronomeSoundId, number> = {
    woodblock: 1200,
    click: 2000,
    beep: 880,
    cowbell: 800,
  };
  const f = base[sound];
  if (tier === "accent") return { freq: f * 1.5, dur: 0.03, gain: 0 };
  if (tier === "normal") return { freq: f, dur: 0.03, gain: -5 };
  return { freq: f * 1.5, dur: 0.018, gain: -12 }; // sub
}

export function useMetronome() {
  const [state, setState] = useState<MetronomeState>({
    isRunning: false,
    bpm: 100,
    numerator: 4,
    denominator: 4,
    accents: defaultAccents(4),
    subdivision: 1,
    soundId: "woodblock",
    volumeDb: -6,
    currentBeat: -1,
    trainer: {
      mode: "off",
      everyBars: 2,
      byBpm: 5,
      maxBpm: 160,
      muteBars: 1,
    },
  });

  // scheduler 讀「最新值」要靠 ref — setInterval 閉包抓不到新 state
  const sRef = useRef(state);
  sRef.current = state;

  // 合成音色節點 (lazy)
  const synthRef = useRef<Tone.Synth | null>(null);
  const noiseRef = useRef<Tone.NoiseSynth | null>(null);
  const metalRef = useRef<Tone.MetalSynth | null>(null);
  const gainRef = useRef<Tone.Gain | null>(null);

  // lookahead scheduler 內部狀態
  const timerRef = useRef<number | null>(null);
  const nextBeatTimeRef = useRef(0);
  const beatRef = useRef(0);
  /** 第幾小節 (0-based) — 給訓練器在小節邊界判斷 */
  const barIndexRef = useRef(0);
  /** 本小節是否靜音 (D2 靜音訓練器) */
  const mutedRef = useRef(false);
  /** 排程中的視覺拍點佇列: (beat, audioTime) */
  const visualQueueRef = useRef<Array<{ beat: number; time: number }>>([]);
  const rafRef = useRef<number | null>(null);

  const ensureNodes = useCallback(() => {
    if (!gainRef.current) {
      gainRef.current = new Tone.Gain(
        Tone.dbToGain(sRef.current.volumeDb),
      ).toDestination();
    }
    if (!synthRef.current) {
      synthRef.current = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
      }).connect(gainRef.current);
    }
    if (!noiseRef.current) {
      noiseRef.current = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
      }).connect(gainRef.current);
    }
    if (!metalRef.current) {
      metalRef.current = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
        harmonicity: 5.1,
        resonance: 4000,
        octaves: 1.2,
      }).connect(gainRef.current);
    }
  }, []);

  /** 在精確的 audio time 觸發一次點擊 */
  const fireClick = useCallback((tier: Tier, time: number) => {
    const { soundId } = sRef.current;
    const spec = clickSpec(soundId, tier);
    const vel = Tone.dbToGain(spec.gain);
    try {
      if (soundId === "click") {
        noiseRef.current?.triggerAttackRelease(spec.dur, time, vel);
      } else if (soundId === "cowbell") {
        metalRef.current?.triggerAttackRelease(spec.dur, time, vel);
      } else {
        synthRef.current?.triggerAttackRelease(
          spec.freq, spec.dur, time, vel,
        );
      }
    } catch {
      /* 重疊觸發偶發 — 忽略 */
    }
  }, []);

  /** 排一整拍 (主點 + 細分點) 到 time 起的時間軸。muted 時不發聲但仍亮拍點。 */
  const scheduleBeat = useCallback(
    (beat: number, time: number, muted: boolean) => {
      const s = sRef.current;
      if (!muted) {
        const level = s.accents[beat] ?? "normal";
        if (level !== "mute") {
          fireClick(level === "accent" ? "accent" : "normal", time);
        }
        // 細分: 把這一拍均分, 第 1 個是主點 (上面已打), 其餘為 sub
        const beatSec = 60 / s.bpm;
        for (let k = 1; k < s.subdivision; k++) {
          fireClick("sub", time + (beatSec * k) / s.subdivision);
        }
      }
      visualQueueRef.current.push({ beat, time });
    },
    [fireClick],
  );

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    visualQueueRef.current = [];
    setState((p) => ({ ...p, isRunning: false, currentBeat: -1 }));
  }, []);

  const start = useCallback(async () => {
    await Tone.start();
    ensureNodes();
    if (gainRef.current) {
      gainRef.current.gain.value = Tone.dbToGain(sRef.current.volumeDb);
    }
    const ctx = Tone.getContext();
    beatRef.current = 0;
    barIndexRef.current = 0;
    mutedRef.current = false;
    nextBeatTimeRef.current = ctx.currentTime + 0.1;
    visualQueueRef.current = [];

    // lookahead: 每 25ms 把未來 ~120ms 內的拍排好
    const SCHEDULE_AHEAD = 0.12;
    timerRef.current = window.setInterval(() => {
      const now = Tone.getContext().currentTime;
      while (nextBeatTimeRef.current < now + SCHEDULE_AHEAD) {
        const beat = beatRef.current;
        // 小節邊界 (downbeat) → 套訓練器
        if (beat === 0) {
          const s0 = sRef.current;
          const tr = s0.trainer;
          const bar = barIndexRef.current;
          if (tr.mode === "speedUp") {
            mutedRef.current = false;
            if (bar > 0 && bar % tr.everyBars === 0 && s0.bpm < tr.maxBpm) {
              setState((p) => ({
                ...p,
                bpm: Math.min(MAX_BPM, tr.maxBpm, p.bpm + tr.byBpm),
              }));
            }
          } else if (tr.mode === "mute") {
            const cycle = Math.max(1, tr.everyBars + tr.muteBars);
            mutedRef.current = (bar % cycle) >= tr.everyBars;
          } else {
            mutedRef.current = false;
          }
          barIndexRef.current = bar + 1;
        }
        scheduleBeat(beat, nextBeatTimeRef.current, mutedRef.current);
        nextBeatTimeRef.current += 60 / sRef.current.bpm;
        beatRef.current = (beat + 1) % sRef.current.numerator;
      }
    }, 25);

    // 視覺拍點: rAF 讀 audio time, 到點才更新 currentBeat (避免排程時就 setState)
    const tick = () => {
      const now = Tone.getContext().currentTime;
      const q = visualQueueRef.current;
      let nextBeat = -1;
      while (q.length && q[0].time <= now) {
        nextBeat = q[0].beat;
        q.shift();
      }
      if (nextBeat >= 0) {
        setState((p) => (p.currentBeat === nextBeat
          ? p
          : { ...p, currentBeat: nextBeat }));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    setState((p) => ({ ...p, isRunning: true }));
  }, [ensureNodes, scheduleBeat]);

  const toggle = useCallback(() => {
    if (sRef.current.isRunning) stop();
    else void start();
  }, [start, stop]);

  // === setters ===
  const setBpm = useCallback((n: number) => {
    const bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(n)));
    setState((p) => ({ ...p, bpm }));
  }, []);

  const setTimeSig = useCallback((numerator: number, denominator: number) => {
    setState((p) => {
      const n = Math.max(1, Math.min(16, numerator));
      // numerator 變了 → 重置重音長度 (保留既有, 多退少補)
      const accents = Array.from({ length: n }, (_, i) =>
        p.accents[i] ?? (i === 0 ? "accent" : "normal"));
      return { ...p, numerator: n, denominator, accents };
    });
  }, []);

  const cycleAccent = useCallback((beatIndex: number) => {
    setState((p) => {
      const order: AccentLevel[] = ["accent", "normal", "mute"];
      const cur = p.accents[beatIndex] ?? "normal";
      const next = order[(order.indexOf(cur) + 1) % order.length];
      const accents = p.accents.slice();
      accents[beatIndex] = next;
      return { ...p, accents };
    });
  }, []);

  const setSubdivision = useCallback((n: number) => {
    setState((p) => ({ ...p, subdivision: Math.max(1, Math.min(4, n)) }));
  }, []);

  const setSoundId = useCallback((soundId: MetronomeSoundId) => {
    setState((p) => ({ ...p, soundId }));
  }, []);

  const setVolumeDb = useCallback((volumeDb: number) => {
    setState((p) => ({ ...p, volumeDb }));
    if (gainRef.current) gainRef.current.gain.value = Tone.dbToGain(volumeDb);
  }, []);

  const setTrainer = useCallback((patch: Partial<TrainerConfig>) => {
    setState((p) => ({ ...p, trainer: { ...p.trainer, ...patch } }));
    // 重新計時 — 換訓練模式時從第 0 小節重算
    barIndexRef.current = 0;
    mutedRef.current = false;
  }, []);

  // Tap tempo — 取最近 4 次間隔平均
  const tapTimesRef = useRef<number[]>([]);
  const tap = useCallback(() => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    // 間隔 > 2s 視為重新開始
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
      const avgMs = sum / (taps.length - 1);
      setBpm(60000 / avgMs);
    }
  }, [setBpm]);

  // 卸載清理
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      synthRef.current?.dispose();
      noiseRef.current?.dispose();
      metalRef.current?.dispose();
      gainRef.current?.dispose();
    };
  }, []);

  return {
    state,
    start,
    stop,
    toggle,
    setBpm,
    setTimeSig,
    cycleAccent,
    setSubdivision,
    setSoundId,
    setVolumeDb,
    setTrainer,
    tap,
  };
}

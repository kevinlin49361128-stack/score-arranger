/**
 * pitchMonitor — 0.1.35 Performance-Following 麥克風即時音高偵測
 *
 * 用 Web Audio AnalyserNode 取時域樣本 → pitchy (McLeod / YIN 變形) 找
 * 基頻 → 轉成 MIDI + cents 偏差. 在 30Hz 左右輪詢 (一秒 30 個 sample),
 * 比真人演奏的音速變化還快, 視覺更新流暢.
 *
 * 設計原則:
 * - 純 client-side, 音訊不離開機器
 * - 不錄音 — AnalyserNode 只看當下 frame, 不存 buffer
 * - clarity (pitchy 回傳的信賴度 0~1) < 0.85 視為「沒在演奏」, 不報告
 *
 * 為什麼用 pitchy 不用 Tone.js: Tone 也有 PitchShift 但沒有純偵測 API.
 * pitchy 是 8KB ESM library, 啟動成本低, 跨樂器 (人聲 / 鋼琴 / 弦樂) 表現都不錯.
 */

import { PitchDetector } from "pitchy";

export interface PitchSample {
  /** Unix epoch ms */
  t: number;
  /** detected frequency in Hz, or null if no clear pitch */
  hz: number | null;
  /** MIDI note number (60 = C4), or null */
  midi: number | null;
  /** cents off from nearest semitone (-50 ~ +50), or null */
  cents: number | null;
  /** 0..1 confidence from pitchy */
  clarity: number;
}

export interface PitchMonitorOptions {
  /** Sample rate in Hz for polling pitchy (default 30) */
  pollHz?: number;
  /** clarity 必須 ≥ 此值才視為有效音 (default 0.85) */
  minClarity?: number;
  /** AnalyserNode FFT size — 影響時間解析度 vs 頻率解析度 trade-off
   *  (default 2048 → 約 46ms 窗口 @ 44.1kHz, 適合 60Hz 以上的音高) */
  fftSize?: number;
}

export class PitchMonitor {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private rafId: number | null = null;
  private intervalId: number | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private detector: PitchDetector<Float32Array<ArrayBuffer>> | null = null;

  private listeners = new Set<(s: PitchSample) => void>();
  private opts: Required<PitchMonitorOptions>;

  constructor(options: PitchMonitorOptions = {}) {
    this.opts = {
      pollHz: options.pollHz ?? 30,
      minClarity: options.minClarity ?? 0.85,
      fftSize: options.fftSize ?? 2048,
    };
  }

  /** Subscribe to pitch samples. Returns unsubscribe fn. */
  onSample(cb: (s: PitchSample) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** 啟動麥克風 + 開始輪詢. 拋出 error 若使用者拒絕授權. */
  async start(): Promise<void> {
    if (this.audioCtx) return; // 已啟動

    // 1. getUserMedia — 會跳系統權限框
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    // 2. 連 AudioContext + AnalyserNode
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = this.opts.fftSize;
    source.connect(this.analyser);

    this.buffer = new Float32Array(this.analyser.fftSize);
    this.detector = PitchDetector.forFloat32Array(this.analyser.fftSize);

    // 3. setInterval 輪詢 (比 rAF 更可預測, 不受 throttling 影響)
    const periodMs = 1000 / this.opts.pollHz;
    this.intervalId = window.setInterval(() => this.tick(), periodMs);
  }

  /** 停止 + 釋放麥克風 (使用者必看, macOS 會撤掉橘點 indicator). */
  async stop(): Promise<void> {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      await this.audioCtx.close();
      this.audioCtx = null;
    }
    this.analyser = null;
    this.buffer = null;
    this.detector = null;
  }

  private tick() {
    if (!this.analyser || !this.buffer || !this.detector || !this.audioCtx) {
      return;
    }
    this.analyser.getFloatTimeDomainData(this.buffer);
    const [hz, clarity] = this.detector.findPitch(
      this.buffer,
      this.audioCtx.sampleRate,
    );
    const sample: PitchSample = {
      t: Date.now(),
      hz: null,
      midi: null,
      cents: null,
      clarity,
    };
    if (clarity >= this.opts.minClarity && hz > 30 && hz < 4000) {
      const midiFloat = 69 + 12 * Math.log2(hz / 440);
      const midiInt = Math.round(midiFloat);
      const cents = Math.round((midiFloat - midiInt) * 100);
      sample.hz = hz;
      sample.midi = midiInt;
      sample.cents = cents;
    }
    this.listeners.forEach((cb) => cb(sample));
  }
}

/** MIDI 數字 → 人類可讀音名 (e.g. 60 → "C4"). */
export function midiToName(midi: number): string {
  const NAMES = [
    "C", "C♯", "D", "D♯", "E", "F",
    "F♯", "G", "G♯", "A", "A♯", "B",
  ];
  const octave = Math.floor(midi / 12) - 1;
  return `${NAMES[midi % 12]}${octave}`;
}

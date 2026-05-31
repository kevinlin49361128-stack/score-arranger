/**
 * 0.1.65 C1: 節拍器發聲的單一來源。
 *
 * 獨立節拍器 (useMetronome) 與播放中的點擊 (PlaybackControls) 共用這一套
 * MetronomeVoice + 音色定義 —— 修 #4「兩套節拍器音色各走各的」。改一處兩邊一致。
 * 全合成 (Tone), 不載取樣, CSP / 離線皆安全。
 */
import * as Tone from "tone";

export type MetronomeSoundId = "woodblock" | "click" | "beep" | "cowbell";
export const METRONOME_SOUND_IDS: MetronomeSoundId[] = [
  "woodblock",
  "click",
  "beep",
  "cowbell",
];
export type ClickTier = "accent" | "normal" | "sub";

/** 依音色 + 強度算 (音高, 時長秒, 音量dB)。accent 高且響, normal 中, sub 更高更小聲更短。 */
function clickSpec(
  sound: MetronomeSoundId,
  tier: ClickTier,
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

/**
 * 一組節拍器發聲器 (3 個合成節點 + 共用 gain)。在精確的 AudioContext 時間觸發點擊。
 * 兩個使用情境各自 new 一個 instance, 但音色邏輯共用此檔, 不再分歧。
 */
export class MetronomeVoice {
  private synth: Tone.Synth;
  private noise: Tone.NoiseSynth;
  private metal: Tone.MetalSynth;
  private gain: Tone.Gain;

  constructor(volumeDb = 0) {
    this.gain = new Tone.Gain(Tone.dbToGain(volumeDb)).toDestination();
    this.synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    }).connect(this.gain);
    this.noise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
    }).connect(this.gain);
    this.metal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
      harmonicity: 5.1,
      resonance: 4000,
      octaves: 1.2,
    }).connect(this.gain);
  }

  setVolumeDb(db: number): void {
    this.gain.gain.value = Tone.dbToGain(db);
  }

  /** 在 audio time 觸發一次點擊。重疊觸發偶發 → 忽略。 */
  fire(soundId: MetronomeSoundId, tier: ClickTier, time: number): void {
    const spec = clickSpec(soundId, tier);
    const vel = Tone.dbToGain(spec.gain);
    try {
      if (soundId === "click") {
        this.noise.triggerAttackRelease(spec.dur, time, vel);
      } else if (soundId === "cowbell") {
        this.metal.triggerAttackRelease(spec.dur, time, vel);
      } else {
        this.synth.triggerAttackRelease(spec.freq, spec.dur, time, vel);
      }
    } catch {
      /* overlap */
    }
  }

  dispose(): void {
    this.synth.dispose();
    this.noise.dispose();
    this.metal.dispose();
    this.gain.dispose();
  }
}

/**
 * bowedStringSynth — 弦樂物理建模 (C1): 弓弦 Karplus-Strong / 數位波導。
 *
 * 為何不用 PluckSynth: PluckSynth 是「撥弦」(KS 一次激發後衰減) —— 拉長音會死掉,
 * 不適合弓弦的持續音。這裡用「弓弦 KS」拓樸:
 *
 *   弓 (gated noise excitation) → LowpassCombFilter (= 弦, delay=1/freq + 阻尼迴授)
 *
 * 音符按住時, 弓的激發持續餵進梳狀濾波器迴路 → 共振成持續音; 放弓時切激發 → 自然
 * 衰減。delayTime = 1/freq 決定音高, resonance 決定延音, dampening 決定亮度。
 *
 * 介面與 Tone.Sampler / PolySynth 一致 (triggerAttackRelease + connect), 所以
 * PlaybackControls 的排程迴圈與 router 不必改, 只要在「physical」模式時換成它。
 *
 * 刻意放成獨立模組 (不塞進 2270 行的 PlaybackControls) —— 也順手推進 Epic C 的拆分。
 */
import * as Tone from "tone";

/** 單一發聲體 = 一條弦 + 一把弓。voice pool 輪替使用。 */
class BowedVoice {
  readonly comb: Tone.LowpassCombFilter;
  private readonly bow: Tone.Noise;
  private readonly bowGain: Tone.Gain;
  /** 此 voice 預計閒置的 AudioContext 時刻 (供 round-robin 略過仍在發聲者)。 */
  freeAt = 0;

  constructor(out: Tone.ToneAudioNode) {
    // 弦: 梳狀濾波 + 迴授阻尼。resonance 高 = 延音長; dampening = 高頻衰減 (亮度)。
    this.comb = new Tone.LowpassCombFilter({
      delayTime: 0.01,
      resonance: 0.93,
      dampening: 3200,
    });
    this.bowGain = new Tone.Gain(0);
    // 弓毛摩擦近似為帶限雜訊; pink 比 white 更接近弓的能量分佈。
    this.bow = new Tone.Noise("pink").start();
    this.bow.connect(this.bowGain);
    this.bowGain.connect(this.comb);
    this.comb.connect(out);
  }

  play(freq: number, dur: number, time: number, vel: number): void {
    // 音高 = 弦長 (delay)。夾住避免極端值讓 comb 失真。
    const delay = Math.min(0.05, Math.max(1 / 8000, 1 / freq));
    this.comb.delayTime.setValueAtTime(delay, time);
    // 高音更亮 (dampening 隨頻率升高); 低音較暗。dampening 是純 setter (非 Param)。
    this.comb.dampening = Math.min(8000, 1800 + freq * 1.6);

    // 弓的力度包絡: 起弓 ~45ms 漸入 → 持續 → 放弓 ~120ms 漸出 (弓不是瞬間止音)。
    const g = this.bowGain.gain;
    const peak = 0.18 + 0.32 * Math.min(1, Math.max(0, vel));
    const attack = 0.045;
    const release = 0.12;
    const hold = Math.max(0.04, dur - release);
    g.cancelScheduledValues(time);
    g.setValueAtTime(0.0001, time);
    g.linearRampToValueAtTime(peak, time + Math.min(attack, dur * 0.5));
    g.setValueAtTime(peak, time + hold);
    g.linearRampToValueAtTime(0.0001, time + hold + release);

    this.freeAt = time + dur + release + 0.05;
  }

  dispose(): void {
    this.bow.stop();
    this.bow.dispose();
    this.bowGain.dispose();
    this.comb.dispose();
  }
}

/**
 * 複音弓弦合成器。介面相容 Sampler/PolySynth:
 *   .connect(dest) / .triggerAttackRelease(note, dur, time, velocity) / .dispose()
 */
export class PolyBowedString {
  private readonly out: Tone.Gain;
  private readonly voices: BowedVoice[];
  private rr = 0;

  constructor(voiceCount = 12, outputGain = 0.85) {
    this.out = new Tone.Gain(outputGain);
    this.voices = Array.from(
      { length: voiceCount }, () => new BowedVoice(this.out),
    );
  }

  connect(dest: Tone.InputNode): this {
    this.out.connect(dest);
    return this;
  }

  triggerAttackRelease(
    note: Tone.Unit.Frequency | number,
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Seconds,
    velocity = 0.8,
  ): this {
    const freq = typeof note === "number"
      ? note
      : Tone.Frequency(note).toFrequency();
    const dur = typeof duration === "number"
      ? duration
      : Tone.Time(duration).toSeconds();
    const t = time ?? Tone.now();

    // round-robin, 但優先挑已閒置的 voice (減少切斷仍在響的音)。
    let v = this.voices[this.rr % this.voices.length];
    for (let k = 0; k < this.voices.length; k++) {
      const cand = this.voices[(this.rr + k) % this.voices.length];
      if (cand.freeAt <= t) { v = cand; this.rr = this.rr + k + 1; break; }
      if (k === this.voices.length - 1) this.rr++;
    }
    v.play(freq, dur, t, velocity);
    return this;
  }

  dispose(): void {
    for (const v of this.voices) v.dispose();
    this.out.dispose();
  }
}

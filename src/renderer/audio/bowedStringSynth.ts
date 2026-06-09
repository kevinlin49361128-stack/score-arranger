/**
 * bowedStringSynth — 弦樂物理建模 (C1): Helmholtz 鋸齒 + 弓毛梳狀濾波。
 *
 * v2 設計動機 (Kevin 耳驗):「聽起來像連續超高次震動、有傅立葉/梳狀的空隙感」——
 * 這正是「純 Karplus-Strong 梳狀濾波」的指紋: 梳狀濾波在 f,2f,3f… 形成「等距尖銳
 * 共振齒」, 高 resonance 時高次齒持續鳴響, 雜訊在齒間拍頻 → 金屬感 + 空隙。
 *
 * 真實弓弦的弦運動是 Helmholtz「鋸齒位移」—— 完整且平滑滾降 (1/n) 的諧波列, 不是
 * 孤立的梳狀齒。所以 v2 改成「混合模型」:
 *
 *   主體音 (Helmholtz):  鋸齒 osc(freq) → 力度→亮度 lowpass → toneGain(envelope)
 *   弓毛質感 (bow noise): pink noise → bowGain(envelope) → LowpassCombFilter(弦)
 *
 * 鋸齒提供連續平滑的諧波列 (聽起來「是弓弦」), 梳狀只當「弓毛摩擦」的細微質感疊上去
 * (resonance 調低, 不再主宰音色), 兩者相加 → 沒有原本的傅立葉空隙感。delayTime=1/freq
 * 讓梳狀的共振與鋸齒基頻一致, 鋸齒 freq 也=同一音高, 兩路相互強化、音高清楚。
 *
 * 介面與 Tone.Sampler / PolySynth 一致 (triggerAttackRelease + connect), 排程迴圈
 * 與 router 不必改。刻意獨立成模組 (不塞進 2270 行 PlaybackControls)。
 */
import * as Tone from "tone";

/** 套一個「起弓漸入 → 持續 → 放弓漸出」的力度包絡到某個 gain param。 */
function applyBowEnvelope(
  g: Tone.Param<"gain">,
  time: number,
  peak: number,
  dur: number,
  attack: number,
  release: number,
): void {
  const hold = Math.max(0.04, dur - release);
  g.cancelScheduledValues(time);
  g.setValueAtTime(0.0001, time);
  g.linearRampToValueAtTime(peak, time + Math.min(attack, dur * 0.5));
  g.setValueAtTime(peak, time + hold);
  g.linearRampToValueAtTime(0.0001, time + hold + release);
}

/** 單一發聲體 = 一條弦 + 一把弓。voice pool 輪替使用。 */
class BowedVoice {
  // 弓毛質感路: 雜訊 → 梳狀濾波 (弦)
  readonly comb: Tone.LowpassCombFilter;
  private readonly bow: Tone.Noise;
  private readonly bowGain: Tone.Gain;
  // Helmholtz 主體音路: 鋸齒 → 力度濾波 → 包絡
  private readonly saw: Tone.Oscillator;
  private readonly sawFilter: Tone.Filter;
  private readonly toneGain: Tone.Gain;
  /** 此 voice 預計閒置的 AudioContext 時刻 (供 round-robin 略過仍在發聲者)。 */
  freeAt = 0;

  constructor(out: Tone.ToneAudioNode) {
    // 弓毛質感: 梳狀 resonance 調低 (0.93→0.82) → 不再主宰、只當摩擦細節;
    //   dampening 也壓低 → 高次梳狀齒衰減更快, 去金屬感。
    this.comb = new Tone.LowpassCombFilter({
      delayTime: 0.01,
      resonance: 0.82,
      dampening: 2600,
    });
    this.bowGain = new Tone.Gain(0);
    this.bow = new Tone.Noise("pink").start();
    this.bow.connect(this.bowGain);
    this.bowGain.connect(this.comb);
    this.comb.connect(out);

    // Helmholtz 主體: 鋸齒 = 弓弦弦運動的位移波形, 諧波列完整且 1/n 平滑滾降。
    this.saw = new Tone.Oscillator(220, "sawtooth").start();
    // 力度→亮度: pp 只透幾個諧波 (暗), ff 開到很亮。也順手濾掉鋸齒最刺的頂端。
    this.sawFilter = new Tone.Filter({
      type: "lowpass",
      frequency: 2500,
      rolloff: -12,
    });
    this.toneGain = new Tone.Gain(0);
    this.saw.connect(this.sawFilter);
    this.sawFilter.connect(this.toneGain);
    this.toneGain.connect(out);
  }

  play(freq: number, dur: number, time: number, vel: number): void {
    const v = Math.min(1, Math.max(0, vel));
    const attack = 0.06; // 弓起音比撥弦慢
    const release = 0.14;

    // 弦 (梳狀): 音高 = 弦長 (delay)。夾住避免極端值失真。
    const delay = Math.min(0.05, Math.max(1 / 8000, 1 / freq));
    this.comb.delayTime.setValueAtTime(delay, time);
    this.comb.dampening = Math.min(7000, 1600 + freq * 1.4);

    // Helmholtz 鋸齒: 同一音高; 力度決定亮度 (透幾個諧波 → 透很多諧波)。
    this.saw.frequency.setValueAtTime(freq, time);
    const sawCutoff = Math.min(9000, freq * (3 + 7 * v));
    this.sawFilter.frequency.setTargetAtTime(sawCutoff, time, 0.02);

    // 兩路同形包絡: 鋸齒當主體 (較大), 梳狀雜訊當弓毛質感 (較小)。
    applyBowEnvelope(this.toneGain.gain, time, 0.16 + 0.2 * v, dur, attack, release);
    applyBowEnvelope(this.bowGain.gain, time, 0.05 + 0.08 * v, dur, attack, release);

    this.freeAt = time + dur + release + 0.05;
  }

  dispose(): void {
    this.bow.stop();
    this.bow.dispose();
    this.bowGain.dispose();
    this.comb.dispose();
    this.saw.stop();
    this.saw.dispose();
    this.sawFilter.dispose();
    this.toneGain.dispose();
  }
}

/** 琴體共振 (body resonance): 真樂器「合成器感 vs 真實感」最關鍵的差別。
 * 弦的振動經琴橋傳到木質琴身, 琴身在特定頻率有共振峰 (formant) —— 這些峰把乾淨的
 * 鋸齒/梳狀染成「有木頭味的樂器」。用幾個 peaking EQ 串接近似 (freq, Q, gain dB):
 *   - violin: ~280Hz 主氣腔(A0)、~460/620Hz 主木質(B1±)、~3kHz bridge hill(歌唱般明亮)
 *   - cello : ~100Hz A0、~200Hz 主木質、~400Hz、~1.5kHz bridge hill
 * 數值取自小提琴/大提琴聲學文獻的典型共振區 (近似, 非特定名琴)。 */
type BodyType = "violin" | "cello" | "none";
const BODY_FORMANTS: Record<string, Array<[number, number, number]>> = {
  violin: [[280, 1.2, 5], [460, 2.0, 4], [620, 2.6, 3], [3000, 0.7, 4]],
  cello: [[100, 1.0, 4], [200, 1.8, 5], [400, 2.6, 3], [1500, 0.7, 3]],
};

/**
 * 複音弓弦合成器。介面相容 Sampler/PolySynth:
 *   .connect(dest) / .triggerAttackRelease(note, dur, time, velocity) / .dispose()
 */
export class PolyBowedString {
  private readonly out: Tone.Gain;
  private readonly bodyFilters: Tone.Filter[];
  /** 訊號鏈末端 (琴體共振串接後)；connect() 從這裡接出去。 */
  private readonly tail: Tone.ToneAudioNode;
  private readonly voices: BowedVoice[];
  private rr = 0;

  constructor(voiceCount = 12, outputGain = 0.85, body: BodyType = "none") {
    this.out = new Tone.Gain(outputGain);
    this.voices = Array.from(
      { length: voiceCount }, () => new BowedVoice(this.out),
    );
    // 琴體共振: out → [peaking EQ 串] → tail。沒指定 body 就直通。
    const formants = BODY_FORMANTS[body];
    this.bodyFilters = [];
    let node: Tone.ToneAudioNode = this.out;
    if (formants) {
      for (const [frequency, Q, gain] of formants) {
        const filt = new Tone.Filter({ type: "peaking", frequency, Q, gain });
        node.connect(filt);
        node = filt;
        this.bodyFilters.push(filt);
      }
    }
    this.tail = node;
  }

  connect(dest: Tone.InputNode): this {
    this.tail.connect(dest);
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
    for (const f of this.bodyFilters) f.dispose();
    this.out.dispose();
  }
}

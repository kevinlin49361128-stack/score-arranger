/**
 * instrumentConfig — 取樣樂器的單一事實來源 (URL 集 + baseUrl + release + 音量)。
 *
 * 為何獨立成模組: (1) 播放器 (PlaybackControls) 與音訊 QA harness
 * (scripts/audio-qa) 必須量「同一份」設定 — 內聯在 2300 行元件裡會逼 harness
 * 複製常數, 一改就漂移; (2) 順手推進 Epic C 的 PlaybackControls 拆分。
 *
 * 音量值是 Kevin 耳驗過的平衡基準 (鋼琴 -6 為參考點) — 改任何一個值前先跑
 * `npm run audio-qa` 確認 delta 漂移在 ±2dB 內。
 */

export const SALAMANDER_BASE = "https://tonejs.github.io/audio/salamander/";
// nbrosowsky/tonejs-instruments: 多種樂器 sample 集合, MIT, 可線上載入
export const TONEJS_INSTRUMENTS_BASE =
  "https://nbrosowsky.github.io/tonejs-instruments/samples/";
// gleitz/midi-js-soundfonts (FluidR3_GM, MIT): tonejs-instruments 沒有大鍵琴,
// 改用此 soundfont 的真實大鍵琴取樣。
export const HARPSICHORD_BASE =
  "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/harpsichord-mp3/";

// tonejs-instruments violin 確認存在的 sample 集
export const VIOLIN_URLS: Record<string, string> = {
  A3: "violin/A3.mp3",
  C4: "violin/C4.mp3",
  E4: "violin/E4.mp3",
  G4: "violin/G4.mp3",
  A4: "violin/A4.mp3",
  C5: "violin/C5.mp3",
  E5: "violin/E5.mp3",
  G5: "violin/G5.mp3",
  A5: "violin/A5.mp3",
  C6: "violin/C6.mp3",
  E6: "violin/E6.mp3",
  G6: "violin/G6.mp3",
  A6: "violin/A6.mp3",
  C7: "violin/C7.mp3",
};

export const CELLO_URLS: Record<string, string> = {
  E2: "cello/E2.mp3",
  A2: "cello/A2.mp3",
  D3: "cello/D3.mp3",
  G3: "cello/G3.mp3",
  C4: "cello/C4.mp3",
  E4: "cello/E4.mp3",
  A4: "cello/A4.mp3",
};

// 注意: flute/G4.mp3 與 G5.mp3 在 CDN 上是 404 (audio-qa 首跑抓到) — 引用它們
// 會讓整個 flute sampler 載入失敗、默默退回合成器。缺的音由 Sampler 內插。
export const FLUTE_URLS: Record<string, string> = {
  C4: "flute/C4.mp3",
  E4: "flute/E4.mp3",
  C5: "flute/C5.mp3",
  E5: "flute/E5.mp3",
  C6: "flute/C6.mp3",
};

// 注意: clarinet/A3.mp3 與 A4.mp3 在 CDN 上是 404 (audio-qa 抓到) — 同 flute,
// 引用會讓整個 sampler 載入失敗、默默退回合成器。缺的音由 Sampler 內插。
export const CLARINET_URLS: Record<string, string> = {
  D3: "clarinet/D3.mp3",
  F3: "clarinet/F3.mp3",
  D4: "clarinet/D4.mp3",
  F4: "clarinet/F4.mp3",
  D5: "clarinet/D5.mp3",
  F5: "clarinet/F5.mp3",
};

// tonejs-instruments guitar-nylon — 古典吉他取樣 (魯特琴也共用此 sampler)
export const GUITAR_URLS: Record<string, string> = {
  B1: "guitar-nylon/B1.mp3",
  D2: "guitar-nylon/D2.mp3",
  E2: "guitar-nylon/E2.mp3",
  A2: "guitar-nylon/A2.mp3",
  E3: "guitar-nylon/E3.mp3",
  G3: "guitar-nylon/G3.mp3",
  A3: "guitar-nylon/A3.mp3",
  B3: "guitar-nylon/B3.mp3",
  E4: "guitar-nylon/E4.mp3",
  A4: "guitar-nylon/A4.mp3",
  A5: "guitar-nylon/A5.mp3",
};

export const HARP_URLS: Record<string, string> = {
  E1: "harp/E1.mp3",
  D2: "harp/D2.mp3",
  C3: "harp/C3.mp3",
  E3: "harp/E3.mp3",
  G3: "harp/G3.mp3",
  D4: "harp/D4.mp3",
  A4: "harp/A4.mp3",
  C5: "harp/C5.mp3",
  E5: "harp/E5.mp3",
  D6: "harp/D6.mp3",
  F6: "harp/F6.mp3",
};

// Salamander 取樣的 ABC 標記 — Tone.Sampler 會在缺音時自動 transpose
export const PIANO_URLS: Record<string, string> = {
  A0: "A0.mp3",
  C1: "C1.mp3",
  "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3",
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
  "D#6": "Ds6.mp3",
  "F#6": "Fs6.mp3",
  A6: "A6.mp3",
  C7: "C7.mp3",
  "D#7": "Ds7.mp3",
  "F#7": "Fs7.mp3",
  A7: "A7.mp3",
  C8: "C8.mp3",
};

// gleitz FluidR3 大鍵琴 — 全 88 鍵皆有, 此處每 3 半音取一個 (Sampler 內插)。
export const HARPSICHORD_URLS: Record<string, string> = {
  C2: "C2.mp3", Eb2: "Eb2.mp3", Gb2: "Gb2.mp3", A2: "A2.mp3",
  C3: "C3.mp3", Eb3: "Eb3.mp3", Gb3: "Gb3.mp3", A3: "A3.mp3",
  C4: "C4.mp3", Eb4: "Eb4.mp3", Gb4: "Gb4.mp3", A4: "A4.mp3",
  C5: "C5.mp3", Eb5: "Eb5.mp3", Gb5: "Gb5.mp3", A5: "A5.mp3",
  C6: "C6.mp3",
};

export interface SamplerConfig {
  urls: Record<string, string>;
  baseUrl: string;
  /** Tone.Sampler release (秒) */
  release: number;
  /** sampler.volume.value (dB) — 平衡基準, 改前必跑 audio-qa */
  volume: number;
}

export type SamplerKey =
  | "piano" | "violin" | "cello" | "flute"
  | "clarinet" | "guitar" | "harp" | "harpsichord";

export const SAMPLER_CONFIGS: Record<SamplerKey, SamplerConfig> = {
  piano: { urls: PIANO_URLS, baseUrl: SALAMANDER_BASE, release: 1, volume: -6 },
  violin: { urls: VIOLIN_URLS, baseUrl: TONEJS_INSTRUMENTS_BASE, release: 0.6, volume: -8 },
  cello: { urls: CELLO_URLS, baseUrl: TONEJS_INSTRUMENTS_BASE, release: 0.8, volume: -8 },
  flute: { urls: FLUTE_URLS, baseUrl: TONEJS_INSTRUMENTS_BASE, release: 0.4, volume: -10 },
  clarinet: { urls: CLARINET_URLS, baseUrl: TONEJS_INSTRUMENTS_BASE, release: 0.5, volume: -10 },
  guitar: { urls: GUITAR_URLS, baseUrl: TONEJS_INSTRUMENTS_BASE, release: 0.8, volume: -8 },
  harp: { urls: HARP_URLS, baseUrl: TONEJS_INSTRUMENTS_BASE, release: 0.8, volume: -8 },
  // 0.1.61: FluidR3 GM 大鍵琴取樣本身錄製偏小聲 + 撥弦衰減快, 與弦樂 (-8)
  // 同 dB 聽感上明顯弱; 提升到 -2 補償, 讓獨奏 / 合奏 (小提琴+大鍵琴) 平衡。
  harpsichord: { urls: HARPSICHORD_URLS, baseUrl: HARPSICHORD_BASE, release: 0.4, volume: -2 },
};

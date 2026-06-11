/**
 * audio-qa harness (browser 端) — 在 headless Chromium 內離線 render 各取樣
 * 樂器的測試樂句, 回傳 PCM (base64) 給 Node 端量響度 + 寫 WAV。
 *
 * 關鍵: import 的是 app 本體的 instrumentConfig / vsco2Manifest — 量到的就是
 * app 用的設定 (含 VSCO 逐層 gainDb + VSCO_TRIM), 不會跟播放器漂移。
 *
 * keys:
 *   - 8 個基本取樣樂器 (nbrosowsky/salamander/FluidR3)
 *   - {violin,viola,cello}_vsco — VSCO sustain bank (vel 0.8 → loud 層,
 *     與播放器的力度門檻一致); 斷言其 Δ vs piano 不漂移 → 換取樣集不破平衡
 *   - violin_vsco_stacc — staccato 層短音樂句 (bounce 耳驗用 + 電平監看)
 */
import * as Tone from "tone";
import { shapePhrasing } from "../../src/renderer/audio/expressivity";
import {
  SAMPLER_CONFIGS,
  VSCO_TRIM,
  type SamplerKey,
} from "../../src/renderer/audio/instrumentConfig";
import { VSCO2_MANIFEST } from "../../src/renderer/data/vsco2Manifest";

type VscoInst = "violin" | "viola" | "cello";
type QaKey =
  | SamplerKey
  | `${VscoInst}_vsco`
  | "violin_vsco_stacc"
  | "violin_expr";

/** 每件樂器在舒適音域的 5 音測試樂句 (落在各自的取樣涵蓋內)。 */
const PHRASES: Record<string, string[]> = {
  piano: ["C4", "E4", "G4", "C5", "G4"],
  violin: ["G4", "A4", "B4", "C5", "D5"],
  cello: ["C3", "D3", "E3", "F3", "G3"],
  flute: ["C5", "D5", "E5", "F5", "G5"],
  clarinet: ["D4", "E4", "F4", "G4", "A4"],
  guitar: ["E3", "G3", "A3", "B3", "E4"],
  harp: ["C4", "E4", "G4", "A4", "C5"],
  harpsichord: ["C4", "E4", "G4", "A4", "C5"],
  // VSCO 變體用與 nb 同樂器一致的樂句 → Δ 可直接比
  violin_vsco: ["G4", "A4", "B4", "C5", "D5"],
  viola_vsco: ["C4", "D4", "E4", "F4", "G4"],
  cello_vsco: ["C3", "D3", "E3", "F3", "G3"],
  violin_vsco_stacc: ["G4", "A4", "B4", "C5", "D5"],
  // 表現力 A/B: 同 violin 樂句 + shapePhrasing — 與 violin.wav 對聽
  violin_expr: ["G4", "A4", "B4", "C5", "D5"],
};

const NOTE_SPACING = 0.5;
const NOTE_DUR = 0.45;
const VELOCITY = 0.8;
const TAIL = 1.5; // 留殘響/release 衰減
const SAMPLE_RATE = 44100;

function f32ToBase64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

interface SamplerSpec {
  urls: Record<string, string>;
  baseUrl: string;
  release: number;
  volume: number;
  noteDur: number;
}

function specFor(key: QaKey): SamplerSpec {
  if (key === "violin_expr") {
    const cfg = SAMPLER_CONFIGS.violin;
    return {
      urls: cfg.urls,
      baseUrl: cfg.baseUrl,
      release: cfg.release,
      volume: cfg.volume,
      noteDur: NOTE_DUR,
    };
  }
  if (key.endsWith("_vsco") || key.endsWith("_stacc")) {
    const inst = key.split("_")[0] as VscoInst;
    const artic = key.endsWith("_stacc") ? "staccato" : "sustain";
    // vel 0.8 ≥ 0.5 → 播放器選 loud 層 (與 schedule loop 門檻一致)
    const layer = VSCO2_MANIFEST[inst][artic].loud;
    return {
      urls: layer.urls,
      baseUrl: "",
      release: artic === "staccato" ? 0.3 : 0.7,
      volume: layer.gainDb + VSCO_TRIM[inst],
      noteDur: artic === "staccato" ? 0.15 : NOTE_DUR,
    };
  }
  const cfg = SAMPLER_CONFIGS[key as SamplerKey];
  return {
    urls: cfg.urls,
    baseUrl: cfg.baseUrl,
    release: cfg.release,
    volume: cfg.volume,
    noteDur: NOTE_DUR,
  };
}

declare global {
  interface Window {
    renderInstrument: (key: QaKey) => Promise<{
      sampleRate: number;
      pcmBase64: string;
    }>;
    qaKeys: QaKey[];
  }
}

window.qaKeys = [
  ...(Object.keys(SAMPLER_CONFIGS) as SamplerKey[]),
  "violin_vsco",
  "viola_vsco",
  "cello_vsco",
  "violin_vsco_stacc",
  "violin_expr",
];

window.renderInstrument = async (key: QaKey) => {
  const spec = specFor(key);
  const phrase = PHRASES[key];
  const duration = phrase.length * NOTE_SPACING + TAIL;

  const buf = await Tone.Offline(
    async () => {
      const sampler = new Tone.Sampler({
        urls: spec.urls,
        baseUrl: spec.baseUrl,
        release: spec.release,
      });
      sampler.volume.value = spec.volume;
      sampler.toDestination();
      // Tone.loaded() 在 offline context 內等所有 buffer 載完 (走網路抓取樣)
      await Tone.loaded();
      let events = phrase.map((note, i) => ({
        name: note,
        time: i * NOTE_SPACING,
        duration: spec.noteDur,
        velocity: VELOCITY,
      }));
      // violin_expr: 走與播放器相同的表現力造型 → 與 violin.wav A/B 對聽
      if (key === "violin_expr") events = shapePhrasing(events);
      for (const ev of events) {
        sampler.triggerAttackRelease(ev.name, ev.duration, ev.time, ev.velocity);
      }
    },
    duration,
    1,
    SAMPLE_RATE,
  );

  const pcm = buf.getChannelData(0);
  return { sampleRate: SAMPLE_RATE, pcmBase64: f32ToBase64(pcm) };
};

/**
 * audio-qa harness (browser 端) — 在 headless Chromium 內離線 render 各取樣
 * 樂器的測試樂句, 回傳 PCM (base64) 給 Node 端量響度 + 寫 WAV。
 *
 * 關鍵: import 的是 app 本體的 instrumentConfig — 量到的就是 app 用的設定,
 * 不會跟播放器漂移。
 */
import * as Tone from "tone";
import {
  SAMPLER_CONFIGS,
  type SamplerKey,
} from "../../src/renderer/audio/instrumentConfig";

/** 每件樂器在舒適音域的 5 音測試樂句 (落在各自的取樣涵蓋內)。 */
const PHRASES: Record<SamplerKey, string[]> = {
  piano: ["C4", "E4", "G4", "C5", "G4"],
  violin: ["G4", "A4", "B4", "C5", "D5"],
  cello: ["C3", "D3", "E3", "F3", "G3"],
  flute: ["C5", "D5", "E5", "F5", "G5"],
  clarinet: ["D4", "E4", "F4", "G4", "A4"],
  guitar: ["E3", "G3", "A3", "B3", "E4"],
  harp: ["C4", "E4", "G4", "A4", "C5"],
  harpsichord: ["C4", "E4", "G4", "A4", "C5"],
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

declare global {
  interface Window {
    renderInstrument: (key: SamplerKey) => Promise<{
      sampleRate: number;
      pcmBase64: string;
    }>;
    qaKeys: SamplerKey[];
  }
}

window.qaKeys = Object.keys(SAMPLER_CONFIGS) as SamplerKey[];

window.renderInstrument = async (key: SamplerKey) => {
  const cfg = SAMPLER_CONFIGS[key];
  const phrase = PHRASES[key];
  const duration = phrase.length * NOTE_SPACING + TAIL;

  const buf = await Tone.Offline(
    async () => {
      const sampler = new Tone.Sampler({
        urls: cfg.urls,
        baseUrl: cfg.baseUrl,
        release: cfg.release,
      });
      sampler.volume.value = cfg.volume;
      sampler.toDestination();
      // Tone.loaded() 在 offline context 內等所有 buffer 載完 (走網路抓取樣)
      await Tone.loaded();
      phrase.forEach((note, i) => {
        sampler.triggerAttackRelease(
          note, NOTE_DUR, i * NOTE_SPACING, VELOCITY,
        );
      });
    },
    duration,
    1,
    SAMPLE_RATE,
  );

  const pcm = buf.getChannelData(0);
  return { sampleRate: SAMPLE_RATE, pcmBase64: f32ToBase64(pcm) };
};

/**
 * audioExport — 用 Tone.Offline 把 MIDI 渲染成 WAV
 *
 * 為了在 Offline 環境穩定運作, 不使用網路 Sampler, 改用純合成 (PolySynth)。
 * 若使用者想要鋼琴音色, 可在主播放器使用 Salamander, 但匯出統一用合成。
 */

import * as Tone from "tone";
import type { Midi } from "@tonejs/midi";

/** AudioBuffer → WAV Blob (16-bit PCM, 44.1kHz) */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const frameLength = buffer.length;
  const dataLength = frameLength * numChannels * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataLength);
  const view = new DataView(ab);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);              // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // 交錯寫入樣本
  const offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  let pos = 0;
  for (let i = 0; i < frameLength; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset + pos, sample, true);
      pos += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * 把 Midi 渲染成 WAV Blob。
 *
 * 限制:
 *  - 使用純合成 (PolySynth), 不嘗試載入網路樣本
 *  - 渲染速度與曲長無關 (Offline 模式), 通常 30 秒曲渲染 < 2 秒
 */
export async function renderMidiToWav(
  midi: Midi,
  options: {
    sampleRate?: number;
    /** 渲染時長; 預設用 midi.duration + 1 (留尾巴衰減) */
    durationSec?: number;
  } = {},
): Promise<Blob> {
  const sampleRate = options.sampleRate ?? 44100;
  const duration = options.durationSec ?? midi.duration + 1.5;

  const toneBuffer = await Tone.Offline((ctx) => {
    const transport = ctx.transport;
    // 全局 reverb (室內樂空間感) — 所有 instruments connect 到此.
    // Tone.Offline 內部 context 接管全域 ctor — 直接 new Tone.X 就會落到 offline ctx.
    const reverb = new Tone.Reverb({ decay: 1.4, wet: 0.12 }).toDestination();
    midi.tracks.forEach((track) => {
      if (track.notes.length === 0) return;
      const name = (track.instrument?.name || track.name || "").toLowerCase();
      // harpsichord 必須在 piano 前先檢查 — 用 Karplus-Strong pluck pool
      // (離線渲染不載網路取樣; 參數與 PlaybackControls 的退路合成器一致)
      if (name.includes("harpsichord") || name.includes("clavecin")
          || name.includes("cembalo")) {
        const pool = Array.from({ length: 16 }, () => {
          const p = new Tone.PluckSynth({
            attackNoise: 4,
            dampening: 4500,
            resonance: 0.78,
            release: 0.4,
          } as ConstructorParameters<typeof Tone.PluckSynth>[0]);
          p.volume.value = -9;
          p.connect(reverb);
          return p;
        });
        let cursor = 0;
        track.notes.forEach((note) => {
          const v = pool[cursor];
          cursor = (cursor + 1) % pool.length;
          try {
            v.triggerAttack(note.name, note.time + 0.05);
          } catch { /* overlap */ }
        });
        return;
      }
      // 其他樂器: PolySynth + 不同 oscillator/envelope
      let oscType: "sine" | "triangle" | "sawtooth" | "square" = "triangle";
      let volume = -10;
      const envelope = { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.5 };
      if (name.includes("piano")) {
        oscType = "triangle";
        volume = -8;
      } else if (name.includes("violin") || name.includes("string")) {
        oscType = "sawtooth";
        volume = -12;
      } else if (name.includes("flute") || name.includes("clarinet")
                 || name.includes("oboe")) {
        oscType = "sine";
        volume = -10;
      } else if (name.includes("trumpet") || name.includes("horn")
                 || name.includes("trombone") || name.includes("tuba")) {
        oscType = "sawtooth";
        volume = -14;
      }
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: oscType },
        envelope,
      });
      synth.connect(reverb);
      synth.volume.value = volume;

      track.notes.forEach((note) => {
        synth.triggerAttackRelease(
          note.name,
          note.duration,
          note.time + 0.05,
          note.velocity,
        );
      });
    });
    transport.start();
  }, duration);
  void sampleRate;
  // Tone v15: Offline 回傳 ToneAudioBuffer; 取出底層 AudioBuffer
  const buffer = (toneBuffer as unknown as { _buffer?: AudioBuffer })
    ._buffer
    ?? (toneBuffer as unknown as AudioBuffer);
  return audioBufferToWav(buffer as AudioBuffer);
}

/** 觸發瀏覽器下載 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

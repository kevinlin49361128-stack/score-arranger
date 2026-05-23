/**
 * PlaybackControls — 播放 / 暫停 / 停止 + 跟隨游標 + 進度條
 *
 * 音色 (首次播放時 async 載入取樣, 失敗則退回合成):
 * - 鋼琴: Salamander Grand Piano 取樣
 * - 小提琴 / 大提琴 / 長笛 / 單簧管: nbrosowsky/tonejs-instruments 取樣
 * - 大鍵琴: gleitz/midi-js-soundfonts (FluidR3) 取樣, 退路為 Karplus-Strong 合成
 * - 其他: PolySynth 退路
 */

import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

type PlayState = "idle" | "loading" | "playing" | "paused";

const SALAMANDER_BASE = "https://tonejs.github.io/audio/salamander/";
// nbrosowsky/tonejs-instruments: 多種樂器 sample 集合, MIT,可線上載入
const TONEJS_INSTRUMENTS_BASE =
  "https://nbrosowsky.github.io/tonejs-instruments/samples/";
// gleitz/midi-js-soundfonts (FluidR3_GM, MIT): tonejs-instruments 沒有大鍵琴,
// 改用此 soundfont 的真實大鍵琴取樣。
const HARPSICHORD_BASE =
  "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/harpsichord-mp3/";

// tonejs-instruments violin 確認存在的 sample 集
const VIOLIN_URLS: Record<string, string> = {
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

const CELLO_URLS: Record<string, string> = {
  E2: "cello/E2.mp3",
  A2: "cello/A2.mp3",
  D3: "cello/D3.mp3",
  G3: "cello/G3.mp3",
  C4: "cello/C4.mp3",
  E4: "cello/E4.mp3",
  A4: "cello/A4.mp3",
};

const FLUTE_URLS: Record<string, string> = {
  C4: "flute/C4.mp3",
  E4: "flute/E4.mp3",
  G4: "flute/G4.mp3",
  C5: "flute/C5.mp3",
  E5: "flute/E5.mp3",
  G5: "flute/G5.mp3",
  C6: "flute/C6.mp3",
};

const CLARINET_URLS: Record<string, string> = {
  D3: "clarinet/D3.mp3",
  F3: "clarinet/F3.mp3",
  A3: "clarinet/A3.mp3",
  D4: "clarinet/D4.mp3",
  F4: "clarinet/F4.mp3",
  A4: "clarinet/A4.mp3",
  D5: "clarinet/D5.mp3",
  F5: "clarinet/F5.mp3",
};

// tonejs-instruments guitar-nylon — 古典吉他取樣 (魯特琴也共用此 sampler)
const GUITAR_URLS: Record<string, string> = {
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

const HARP_URLS: Record<string, string> = {
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
const PIANO_URLS: Record<string, string> = {
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
const HARPSICHORD_URLS: Record<string, string> = {
  C2: "C2.mp3", Eb2: "Eb2.mp3", Gb2: "Gb2.mp3", A2: "A2.mp3",
  C3: "C3.mp3", Eb3: "Eb3.mp3", Gb3: "Gb3.mp3", A3: "A3.mp3",
  C4: "C4.mp3", Eb4: "Eb4.mp3", Gb4: "Gb4.mp3", A4: "A4.mp3",
  C5: "C5.mp3", Eb5: "Eb5.mp3", Gb5: "Gb5.mp3", A5: "A5.mp3",
  C6: "C6.mp3",
};

/**
 * Karplus-Strong 多聲部撥弦合成器 — wrap a pool of Tone.PluckSynth.
 *
 * Tone.PluckSynth 本身單音, 不能直接餵給 Tone.PolySynth (後者要 Monophonic).
 * 用 round-robin 配置 16 個 voice, 每個 triggerAttackRelease 找下一個 free voice.
 * 對 harpsichord 4-音和弦 + 旋律 8 音同時鳴響的場景綽綽有餘.
 */
class PolyPluckSynth {
  private voices: Tone.PluckSynth[];
  private cursor = 0;
  private _volumeNode: Tone.Volume;
  /** Volume Param 對外 (跟 Tone.PolySynth / Sampler 介面一致 — obj.volume.value). */
  readonly volume: Tone.Param<"decibels">;

  constructor(voiceCount: number, options: Partial<{
    attackNoise: number;
    dampening: number;
    resonance: number;
    release: number;
  }>) {
    this._volumeNode = new Tone.Volume(0);
    this.volume = this._volumeNode.volume;
    this.voices = Array.from({ length: voiceCount }, () => {
      const v = new Tone.PluckSynth({
        // 調過的撥弦參數: 高 attackNoise 給清脆的撥片起音, 低 resonance +
        // 短 release 對應大鍵琴 jack 放開即止音的乾衰減 (不是長殘響)。
        attackNoise: options.attackNoise ?? 4,
        dampening: options.dampening ?? 4500,
        resonance: options.resonance ?? 0.78,
        release: options.release ?? 0.4,
      } as ConstructorParameters<typeof Tone.PluckSynth>[0]);
      v.connect(this._volumeNode);
      return v;
    });
  }

  connect(destination: Tone.ToneAudioNode): this {
    this._volumeNode.connect(destination);
    return this;
  }

  toDestination(): this {
    this._volumeNode.toDestination();
    return this;
  }

  triggerAttackRelease(
    note: string | string[] | number,
    _duration: Tone.Unit.Time,
    time?: Tone.Unit.Time,
    _velocity?: number,
  ): this {
    const notes = Array.isArray(note) ? note : [note];
    for (const n of notes) {
      const v = this.voices[this.cursor];
      this.cursor = (this.cursor + 1) % this.voices.length;
      try {
        v.triggerAttack(n as Tone.Unit.Frequency, time);
      } catch {
        /* ignore — pluck overlap */
      }
    }
    return this;
  }

  dispose(): this {
    this.voices.forEach((v) => {
      v.dispose();
    });
    this._volumeNode.dispose();
    return this;
  }
}


interface InstrumentRouter {
  /** 路由 track index → instrument key ("piano" | "violin" | ...) */
  routeTrack: (trackIndex: number, trackName: string) => string;
  /** 取得對應 instrument 的可發聲節點 */
  get: (key: string) =>
    | Tone.PolySynth | Tone.Sampler | PolyPluckSynth;
}

interface PlaybackControlsProps {
  /** 播放對象: source = 原譜, target = 改編結果 (預設 target). */
  side?: "source" | "target";
  /** Compact 模式: 只顯示 ▶/⏸/⏹ 與 progress, 隱藏 loop / 取樣 / 游標模式. */
  compact?: boolean;
}

export function PlaybackControls(
  { side = "target", compact = false }: PlaybackControlsProps = {} as any,
) {
  useLocale();
  const arrangement = useSessionStore((s) => s.arrangement);
  const sourcePath = useSessionStore((s) => s.sourcePath);
  const sourceMusicXML = useSessionStore((s) => s.sourceMusicXML);
  const setError = useSessionStore((s) => s.setError);
  const setPlaybackMeasure = useSessionStore((s) => s.setPlaybackMeasure);
  const setPlaybackProgress = useSessionStore((s) => s.setPlaybackProgress);
  const playbackProgress = useSessionStore((s) => s.playbackProgress);
  const activeSide = useSessionStore((s) => s.activePlaybackSide);
  const setActiveSide = useSessionStore((s) => s.setActivePlaybackSide);
  const requestedLoop = useSessionStore((s) => s.requestedLoop);

  const [state, setState] = useState<PlayState>("idle");
  const [useSamples, setUseSamples] = useState(true);
  /** 範圍循環: loopStart/End 為 measure number (1-based), null = 不 loop */
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  /** 慢速練習 — 1.0 = 原速, 0.75 = 75%, 0.5 = 50%. 排程時把 note.time /
   * note.duration 都 ×(1/rate), measureStarts 同樣縮放, 所以播放游標跟得上. */
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  /** 聲部 mute — set of track index. 在 handlePlay scheduling 時跳過. */
  const [mutedTracks, setMutedTracks] = useState<Set<number>>(new Set());
  /** 上一次播放 MIDI 的 track 列表 — 提供 mute popover 用 */
  const [knownTracks, setKnownTracks] = useState<
    { idx: number; name: string }[]
  >([]);
  // arrangement / sourceMusicXML 換了 → 重設 mute (track index 對映可能完全變了)
  // 不重設的話, 舊 arrangement 的 mute(3) 會殘留到新 arrangement 上, 而新譜
  // 的 track-3 可能根本不是同一個樂器, 變成「不知為何某個聲部沒聲音」。
  // ref: smoke test 0.1.16 發現的 bug.
  useEffect(() => {
    setMutedTracks(new Set());
    setKnownTracks([]);
  }, [arrangement, sourceMusicXML]);
  /** mute popover 開關 */
  const [muteOpen, setMuteOpen] = useState(false);
  const muteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!muteOpen) return;
    const onClick = (e: MouseEvent) => {
      if (muteRef.current && !muteRef.current.contains(e.target as Node)) {
        setMuteOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [muteOpen]);
  // Refs 鏡像給 RAF loop 用 (避免 stale closure)
  const loopStartRef = useRef<number | null>(null);
  const loopEndRef = useRef<number | null>(null);
  const loopEnabledRef = useRef<boolean>(false);
  useEffect(() => {
    loopStartRef.current = loopStart;
  }, [loopStart]);
  useEffect(() => {
    loopEndRef.current = loopEnd;
  }, [loopEnd]);
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  // 練習模式 — 外部請求 loop 一段 (PracticePanel 點選最難小節)
  useEffect(() => {
    if (!requestedLoop?.tick) return;
    setLoopStart(requestedLoop.start);
    setLoopEnd(requestedLoop.end);
    setLoopEnabled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedLoop?.tick]);

  const pianoRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  const violinRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  const celloRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  const fluteRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  const clarinetRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  /** 古典吉他取樣 (魯特琴路由也指向此 sampler — 最接近的撥弦音色). */
  const guitarRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  const harpRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  /** 大鍵琴: 取樣 (gleitz FluidR3); 退路為 Karplus-Strong 撥弦合成. */
  const harpsichordRef = useRef<Tone.Sampler | PolyPluckSynth | null>(null);
  const harpsichordFallbackRef = useRef<PolyPluckSynth | null>(null);
  const fallbackRef = useRef<Tone.PolySynth | null>(null);
  const violinFallbackRef = useRef<Tone.PolySynth | null>(null);
  /** 全局 reverb — 讓所有樂器有些空間感, 不再像乾的合成 sample. */
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const samplesLoadedRef = useRef(false);
  const sampleLoadFailedRef = useRef(false);
  // 防重入: 啟動播放是 async (取 MIDI + 首次載入取樣)。期間若再次點擊,
  // 第二次 handlePlay 會與第一次並行搶 Tone.Transport (singleton) —
  // stopAllScheduled 互砍排程、startTracking 開出兩個 RAF loop, 造成
  // 「有聲音沒游標 / 有游標沒聲音」這類錯亂。ref 是同步的, 能擋住連點
  // (button disabled 依賴 re-render, 來不及擋住極快的第二下)。
  const playStartingRef = useRef(false);

  const scheduledIdsRef = useRef<number[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const totalDurationRef = useRef<number>(0);
  /** 預計算的 measure 邊界時間表 (秒),index 0 = 第 1 小節起始 */
  const measureStartsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      stopAllScheduled();
      cancelRaf();
      pianoRef.current?.dispose?.();
      violinRef.current?.dispose?.();
      celloRef.current?.dispose?.();
      fluteRef.current?.dispose?.();
      clarinetRef.current?.dispose?.();
      guitarRef.current?.dispose?.();
      harpRef.current?.dispose?.();
      harpsichordRef.current?.dispose?.();
      harpsichordFallbackRef.current?.dispose?.();
      fallbackRef.current?.dispose?.();
      violinFallbackRef.current?.dispose?.();
      reverbRef.current?.dispose?.();
      pianoRef.current = null;
      violinRef.current = null;
      celloRef.current = null;
      fluteRef.current = null;
      clarinetRef.current = null;
      guitarRef.current = null;
      harpRef.current = null;
      harpsichordRef.current = null;
      harpsichordFallbackRef.current = null;
      fallbackRef.current = null;
      violinFallbackRef.current = null;
      reverbRef.current = null;
    };
  }, []);

  // 載入樂器
  const ensureInstruments = async (): Promise<InstrumentRouter> => {
    // === 全局 reverb master bus ===
    // 所有樂器都先 connect 進 reverb, reverb 再 .toDestination().
    // wet=0.12 讓房間感不會蓋掉旋律. decay=1.4 對應小室內樂的空間.
    if (!reverbRef.current) {
      const rv = new Tone.Reverb({ decay: 1.4, wet: 0.12 });
      rv.toDestination();
      // Tone.Reverb 用 async generate impulse response; 等它 ready 再返回
      try {
        await rv.ready;
      } catch {
        /* ignore */
      }
      reverbRef.current = rv;
    }
    const bus = reverbRef.current as Tone.Reverb;

    // Fallback synth (純合成,通用)
    if (!fallbackRef.current) {
      fallbackRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.4 },
      });
      fallbackRef.current.connect(bus);
      fallbackRef.current.volume.value = -8;
    }
    // Violin fallback (鋸齒波 + 長 attack 模擬弓奏)
    if (!violinFallbackRef.current) {
      violinFallbackRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.3 },
      });
      violinFallbackRef.current.connect(bus);
      violinFallbackRef.current.volume.value = -10;
    }
    // Harpsichord 退路: Karplus-Strong 撥弦合成 (Tone.PluckSynth pool).
    // 取樣載入失敗或使用者關閉取樣時使用; 取樣可用時改用下方 Sampler.
    if (!harpsichordFallbackRef.current) {
      const hps = new PolyPluckSynth(16, {});
      hps.connect(bus);
      hps.volume.value = -9;
      harpsichordFallbackRef.current = hps;
    }

    if (useSamples && !samplesLoadedRef.current && !sampleLoadFailedRef.current) {
      // 逐樂器獨立載入取樣。關鍵: 不再用全域 await Tone.loaded() —
      // 那個只要「任何一個」樂器的任何一個取樣檔失敗就整批 reject, 害得
      // 整個四重奏 (violin/cello) 一起退成刺耳的合成器音色 (使用者回報的
      // 「音色像合成器/破音」)。改成每個 sampler 用自己的 onload/onerror
      // 結算, 單一樂器失敗只回退它自己, 其餘樂器照常使用真實取樣。
      const buildSampler = (
        urls: Record<string, string>,
        baseUrl: string,
        release: number,
        volume: number,
      ): { sampler: Tone.Sampler; ready: Promise<void> } => {
        let settle: () => void = () => {};
        const ready = new Promise<void>((res) => {
          settle = res;
        });
        const sampler = new Tone.Sampler({
          urls,
          baseUrl,
          release,
          onload: () => settle(),
          onerror: () => settle(),
        });
        sampler.connect(bus);
        sampler.volume.value = volume;
        // 逾時保險: 20 秒還沒結算就放行 (避免 await 永遠卡死)
        window.setTimeout(() => settle(), 20_000);
        return { sampler, ready };
      };

      const piano = buildSampler(PIANO_URLS, SALAMANDER_BASE, 1, -6);
      const violin = buildSampler(VIOLIN_URLS, TONEJS_INSTRUMENTS_BASE, 0.6, -8);
      const cello = buildSampler(CELLO_URLS, TONEJS_INSTRUMENTS_BASE, 0.8, -8);
      const flute = buildSampler(FLUTE_URLS, TONEJS_INSTRUMENTS_BASE, 0.4, -10);
      const clarinet =
        buildSampler(CLARINET_URLS, TONEJS_INSTRUMENTS_BASE, 0.5, -10);
      const guitar = buildSampler(GUITAR_URLS, TONEJS_INSTRUMENTS_BASE, 0.8, -8);
      const harp = buildSampler(HARP_URLS, TONEJS_INSTRUMENTS_BASE, 0.8, -8);
      const harpsichord =
        buildSampler(HARPSICHORD_URLS, HARPSICHORD_BASE, 0.4, -8);
      const all = [
        piano, violin, cello, flute, clarinet, guitar, harp, harpsichord,
      ];
      await Promise.all(all.map((x) => x.ready));

      // 逐一結算: 真的載入完成 (.loaded) 才用取樣器, 否則回退該樂器合成器。
      pianoRef.current = piano.sampler.loaded
        ? piano.sampler
        : fallbackRef.current;
      violinRef.current = violin.sampler.loaded
        ? violin.sampler
        : violinFallbackRef.current;
      celloRef.current = cello.sampler.loaded
        ? cello.sampler
        : violinFallbackRef.current;
      fluteRef.current = flute.sampler.loaded
        ? flute.sampler
        : fallbackRef.current;
      clarinetRef.current = clarinet.sampler.loaded
        ? clarinet.sampler
        : fallbackRef.current;
      guitarRef.current = guitar.sampler.loaded
        ? guitar.sampler
        : fallbackRef.current;
      harpRef.current = harp.sampler.loaded
        ? harp.sampler
        : fallbackRef.current;
      harpsichordRef.current = harpsichord.sampler.loaded
        ? harpsichord.sampler
        : harpsichordFallbackRef.current;
      // 沒載成功的 sampler 釋放掉省記憶體
      for (const x of all) {
        if (!x.sampler.loaded) x.sampler.dispose?.();
      }
      const failed = all.filter((x) => !x.sampler.loaded).length;
      if (failed > 0) {
        console.warn(
          `[playback] ${failed} 種樂器取樣未載入, 已逐樂器回退合成`,
        );
      }
      sampleLoadFailedRef.current = failed > 0;
      samplesLoadedRef.current = true;
    } else if (!pianoRef.current || !violinRef.current) {
      pianoRef.current = pianoRef.current ?? fallbackRef.current;
      violinRef.current = violinRef.current ?? violinFallbackRef.current;
    }

    return {
      routeTrack: (_idx, name) => {
        const low = name.toLowerCase();
        // harpsichord 必須在 piano fallback 前先檢查 (因預設 fallback 是 piano)
        if (low.includes("harpsichord") || low.includes("clavecin")
          || low.includes("cembalo")) return "harpsichord";
        if (
          low.includes("cello")
          || low.includes("violoncello")
          || low.includes("contrabass")
          || low.includes("double_bass")
          || low.includes("bass_voice")
        ) return "cello";
        if (
          low.includes("violin") || low.includes("vln")
          || low.includes("vl.") || low.includes("violino")
          || low.includes("viola") || low.includes("soprano")
          || low.includes("alto")
        ) return "violin";
        if (low.includes("flute") || low.includes("piccolo")) return "flute";
        if (
          low.includes("clarinet") || low.includes("oboe")
          || low.includes("bassoon")
        ) return "clarinet";
        if (
          low.includes("tenor") || low.includes("horn")
        ) return "clarinet";
        // 撥弦樂器: 魯特琴沒有專屬取樣 → 路由到吉他 sampler (最近的撥弦音色)
        if (low.includes("guitar") || low.includes("lute")) return "guitar";
        if (low.includes("harp")) return "harp";
        return "piano";
      },
      get: (key) => {
        if (key === "violin") return violinRef.current ?? violinFallbackRef.current!;
        if (key === "cello") return celloRef.current ?? violinFallbackRef.current!;
        if (key === "flute") return fluteRef.current ?? fallbackRef.current!;
        if (key === "clarinet") return clarinetRef.current ?? fallbackRef.current!;
        if (key === "guitar") return guitarRef.current ?? fallbackRef.current!;
        if (key === "harp") return harpRef.current ?? fallbackRef.current!;
        if (key === "harpsichord") {
          return harpsichordRef.current ?? harpsichordFallbackRef.current!;
        }
        return pianoRef.current ?? fallbackRef.current!;
      },
    };
  };

  const stopAllScheduled = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    scheduledIdsRef.current = [];
  };

  const cancelRaf = () => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  /** 二分搜尋: 在 measure 起始時間表中找 seconds 對應的 measure (1-based) */
  const findMeasureAt = (seconds: number): number => {
    const starts = measureStartsRef.current;
    if (starts.length === 0) return 1;
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= seconds) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  /** 從 MIDI 預計算每個 measure 起始的秒數 (支援變速 / 變拍號) */
  const computeMeasureStarts = (
    midi: Midi,
    pickupQuarters: number = 0,
  ): number[] => {
    const tsigs = [...midi.header.timeSignatures].sort(
      (a, b) => a.ticks - b.ticks,
    );
    if (tsigs.length === 0) {
      // 缺拍號 → 預設 4/4
      tsigs.push({
        ticks: 0,
        timeSignature: [4, 4],
        measures: 0,
      } as unknown as (typeof tsigs)[number]);
    }

    let maxTime = 0;
    for (const track of midi.tracks) {
      for (const n of track.notes) {
        const end = n.time + n.duration;
        if (end > maxTime) maxTime = end;
      }
    }
    if (maxTime === 0) return [0];

    const ppq = midi.header.ppq;
    const starts: number[] = [];
    let measureTicks = 0;
    // safety 上限避免極端 MIDI 卡死
    for (let i = 0; i < 10_000; i++) {
      const startSec = midi.header.ticksToSeconds(measureTicks);
      starts.push(startSec);
      if (startSec > maxTime + 1) break;
      // 此 measure 適用的 timeSignature
      let tsig = tsigs[0];
      for (const t of tsigs) {
        if (t.ticks <= measureTicks) tsig = t;
        else break;
      }
      const [num, denom] = tsig.timeSignature;
      const measureTickLen = (ppq * num * 4) / denom;
      // 第一個小節是起拍 (不完全) 時用較短的 ticks, 後續正常。
      // 不修這個的話 starts[1] 會晚 (整段 - 起拍) 拍, 游標跟著延遲。
      const thisMeasureTicks = (i === 0 && pickupQuarters > 0)
        ? ppq * pickupQuarters
        : measureTickLen;
      measureTicks += thisMeasureTicks;
    }
    return starts;
  };

  const startTracking = () => {
    let prevMeasure = -1;
    // start("+0.1") 後約 100ms 內 Tone.Transport.state 仍是 "stopped" —
    // 這段啟動空窗期絕不可 return, 否則 rAF loop 第一幀就死掉,
    // setPlaybackMeasure 永遠不會被呼叫 → playbackMeasure 卡在 null →
    // 譜面播放游標完全不出現。改用 sawStarted 旗標: 只有「曾 started
    // 之後又離開 started」才收工; 啟動前最多寬限 4 秒。
    let sawStarted = false;
    const trackBegin = performance.now();
    const loop = () => {
      const tstate = Tone.Transport.state;
      if (tstate === "started") {
        sawStarted = true;
      } else if (sawStarted) {
        rafIdRef.current = null;  // 播完 / 暫停 / 停止 → 收工
        return;
      } else if (performance.now() - trackBegin > 4000) {
        rafIdRef.current = null;  // 4 秒還沒啟動 → 視為失敗, 別讓 loop 永跑
        return;
      }
      const seconds = Tone.Transport.seconds;
      const total = totalDurationRef.current;
      const progress = total > 0 ? Math.min(1, seconds / total) : 0;
      setPlaybackProgress(progress);

      const measure = findMeasureAt(seconds);

      // === 範圍循環 ===
      const lStart = loopStartRef.current;
      const lEnd = loopEndRef.current;
      if (
        loopEnabledRef.current && lStart != null && lEnd != null
        && lEnd > lStart
      ) {
        const starts = measureStartsRef.current;
        const endIdx = Math.min(lEnd - 1, starts.length - 1);
        const startIdx = Math.max(0, lStart - 1);
        const loopEndSec = endIdx + 1 < starts.length
          ? starts[endIdx + 1]
          : total;
        if (seconds >= loopEndSec) {
          const loopStartSec = starts[startIdx] ?? 0;
          Tone.Transport.seconds = loopStartSec;
          prevMeasure = -1;
        }
      }

      if (measure !== prevMeasure) {
        setPlaybackMeasure(measure);
        prevMeasure = measure;
      }
      rafIdRef.current = requestAnimationFrame(loop);
    };
    rafIdRef.current = requestAnimationFrame(loop);
  };

  const handlePlay = async () => {
    if (state === "paused") {
      Tone.Transport.start();
      startTracking();
      setState("playing");
      setActiveSide(side);
      return;
    }
    if (state === "playing") return;
    // 已在啟動另一次播放 → 忽略連點 (見 playStartingRef 宣告處)
    if (playStartingRef.current) return;
    // source 模式: 需要 sourcePath; target 模式: 需要 arrangement
    if (side === "source" && !sourcePath && !sourceMusicXML) {
      setError(t("playback.error.noSource"));
      return;
    }
    if (side === "target" && !arrangement) {
      setError(t("playback.error.noArrangement"));
      return;
    }

    playStartingRef.current = true;
    setState("loading");
    setError(null);
    setActiveSide(side);
    try {
      const res = side === "source"
        ? await window.scoreArranger.engine.toSourceMidi(
            sourcePath ?? undefined,
          )
        : await window.scoreArranger.engine.toMidi();
      if (!res.ok || !res.data) {
        setError(res.error ?? t("playback.error.getMidiFailed"));
        setState("idle");
        setActiveSide(null);
        return;
      }
      const midiBytes = base64ToUint8Array(res.data.midi_base64);
      const midi = new Midi(midiBytes);

      await Tone.start();
      const router = await ensureInstruments();

      stopAllScheduled();
      Tone.Transport.position = 0;
      // 用 MIDI 首個 tempo 作為 Tone.Transport 的初始 BPM
      // (變速由各 note 的 absolute time 處理,不需要 Transport.bpm 動態追)
      const bpm = midi.header.tempos[0]?.bpm ?? 120;
      Tone.Transport.bpm.value = bpm;
      // 預算 measure 起始時間表,支援變速 / 變拍號 / 起拍 (不完全小節)
      // 起拍長度從 listNavigation 拿; 沒抓到時當 0 (與舊行為一致)。
      let pickupQuarters = 0;
      try {
        const nav = await window.scoreArranger.engine.listNavigation();
        if (nav.ok && nav.data) {
          pickupQuarters = nav.data.pickup_offset_quarters ?? 0;
        }
      } catch {
        /* listNavigation 失敗 → 假設無起拍 */
      }
      // 慢速練習 — 把所有時間軸 ×(1/rate). 注意要在 scheduling 跟 measure
      // starts 同時套用, 不然播放游標位置會跟聲音脫節。
      const stretch = 1 / playbackRate;
      measureStartsRef.current = computeMeasureStarts(midi, pickupQuarters)
        .map((s) => s * stretch);

      // 把 track 列表更新到 state, 給 mute popover 顯示用. 用 idx 區分,
      // name 為空時 fallback 給 "Track N+1" — 避免 popover 顯示空白行.
      // engine 送過來的 partName 可能是 "Violin I  [violin]" 格式
      // (display + instrument_id, 同時給 routeTrack 跟使用者看), popover
      // 只給使用者看, 去掉 "[...]" 標籤. routeTrack 用 raw t.name, 不受影響.
      setKnownTracks(midi.tracks.map((t, i) => {
        const raw = t.name?.trim() || "";
        const display = raw.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
        return { idx: i, name: display || raw || `Track ${i + 1}` };
      }));

      let lastTime = 0;
      midi.tracks.forEach((track, trackIdx) => {
        // mute: 此 track 在 mutedTracks 內 → 整段跳過排程 (連 lastTime 都不算)
        if (mutedTracks.has(trackIdx)) return;
        const key = router.routeTrack(trackIdx, track.name);
        const instrument = router.get(key);
        for (const note of track.notes) {
          const noteTime = note.time * stretch;
          const noteDur = note.duration * stretch;
          const id = Tone.Transport.schedule((time) => {
            instrument.triggerAttackRelease(
              note.name,
              noteDur,
              time,
              note.velocity,
            );
          }, noteTime);
          scheduledIdsRef.current.push(id);
          if (noteTime + noteDur > lastTime) {
            lastTime = noteTime + noteDur;
          }
        }
      });
      totalDurationRef.current = lastTime;

      Tone.Transport.scheduleOnce(() => {
        cancelRaf();
        setState("idle");
        setPlaybackMeasure(null);
        setPlaybackProgress(1);
        setActiveSide(null);
        stopAllScheduled();
      }, lastTime + 0.3);

      Tone.Transport.start("+0.1");
      startTracking();
      setState("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("idle");
    } finally {
      playStartingRef.current = false;
    }
  };

  const handlePause = () => {
    if (state !== "playing") return;
    Tone.Transport.pause();
    cancelRaf();
    setState("paused");
  };

  /** 回到開頭 (不停止 — 若正在播放就跳到 0 繼續, 暫停就指針回 0) */
  const handleRewind = () => {
    Tone.Transport.seconds = 0;
    setPlaybackProgress(0);
    setPlaybackMeasure(1);
  };

  const handleStop = () => {
    stopAllScheduled();
    cancelRaf();
    setPlaybackMeasure(null);
    setPlaybackProgress(0);
    setState("idle");
    setActiveSide(null);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (state === "idle" || state === "loading") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = ratio * totalDurationRef.current;
    Tone.Transport.seconds = target;
    setPlaybackProgress(ratio);
    // seek 後立即同步 measure (即使在 paused 狀態, 游標也跟著拖曳走)
    const newMeasure = findMeasureAt(target);
    if (Number.isFinite(newMeasure)) setPlaybackMeasure(newMeasure);
  };

  const btn: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid var(--button-border)",
    borderRadius: 4,
    background: "var(--button-bg)",
    color: "var(--button-fg)",
    cursor: "pointer",
    fontSize: 13,
    minWidth: 40,
  };

  // 互斥邏輯: 若 active side 不是本實例, 本實例的播放鈕應強制停掉舊播放, 再啟新
  const isThisSidePlaying = activeSide === side && state === "playing";
  const isThisSidePaused = activeSide === side && state === "paused";
  // 本實例的 disabled 條件: 對應素材沒有, 或別人在 loading
  const haveMaterial = side === "source"
    ? !!(sourcePath || sourceMusicXML)
    : !!arrangement;
  const disabled = !haveMaterial || state === "loading";
  const progressPercent = Math.round(playbackProgress * 100);
  const sideLabel = side === "source"
    ? t("playback.side.source")
    : t("playback.side.target");

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        alignItems: "center",
        // active 那邊用 accent 邊框, 讓使用者一眼看到誰在播
        padding: compact ? "2px 6px" : 0,
        border: compact
          ? `1px solid ${
              isThisSidePlaying || isThisSidePaused
                ? "var(--accent)"
                : "var(--border)"
            }`
          : "none",
        borderRadius: 4,
      }}
    >
      <button
        onClick={handleRewind}
        disabled={disabled || (activeSide != null && activeSide !== side)}
        style={{
          ...btn,
          opacity: (disabled || (activeSide != null && activeSide !== side))
            ? 0.4 : 1,
        }}
        title={t("playback.rewind.title", { side: sideLabel })}
      >
        ⏮
      </button>
      {isThisSidePlaying ? (
        <button
          onClick={handlePause}
          style={btn}
          title={t("playback.pause.title")}
        >
          ⏸
        </button>
      ) : (
        <button
          onClick={handlePlay}
          disabled={disabled || (activeSide != null && activeSide !== side
            && state === "playing")}
          style={{
            ...btn,
            opacity: (
              disabled || (activeSide != null && activeSide !== side
                && state === "playing")
            ) ? 0.4 : 1,
            background: isThisSidePaused ? "var(--accent)" : btn.background,
            color: isThisSidePaused ? "var(--accent-fg)" : btn.color,
          }}
          title={isThisSidePaused
            ? t("playback.resume.title", { side: sideLabel })
            : t("playback.play.title", { side: sideLabel })}
        >
          {state === "loading" && activeSide === side
            ? "⌛"
            : "▶"}
        </button>
      )}
      <button
        onClick={handleStop}
        disabled={state === "idle"}
        style={{ ...btn, opacity: state === "idle" ? 0.5 : 1 }}
        title={t("playback.stop.title")}
      >
        ⏹
      </button>
      <div
        onClick={handleSeek}
        style={{
          width: 140,
          height: 6,
          background: "var(--bg-tertiary)",
          borderRadius: 3,
          marginLeft: 6,
          cursor: state === "idle" ? "default" : "pointer",
          position: "relative",
          border: "1px solid var(--border-light)",
        }}
        title={state === "idle"
          ? t("playback.progress.idle")
          : t("playback.progress.seek", { percent: progressPercent })}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: "100%",
            background: "var(--accent)",
            borderRadius: 3,
            transition: "width 80ms linear",
          }}
        />
      </div>
      {/* 速度 — compact / non-compact 都顯示, 練習用很常切 */}
      <label
        title={t("playback.rate.title")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          fontSize: 11,
          color: "var(--fg-muted)",
          marginLeft: 8,
        }}
      >
        🐢
        <select
          value={playbackRate}
          onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
          disabled={state !== "idle"}
          style={{
            fontSize: 11,
            padding: "1px 3px",
            border: "1px solid var(--border)",
            borderRadius: 3,
            background: "var(--bg-panel)",
            color: "var(--fg-primary)",
          }}
        >
          <option value={1}>1.0x</option>
          <option value={0.75}>0.75x</option>
          <option value={0.5}>0.5x</option>
        </select>
      </label>
      {/* 聲部 mute — compact / non-compact 都顯示. 內容 popover, 點外部關閉 */}
      <div
        ref={muteRef}
        style={{ position: "relative", marginLeft: 4 }}
      >
        <button
          type="button"
          onClick={() => setMuteOpen((x) => !x)}
          title={t("playback.mute.title")}
          style={{
            ...btn,
            fontSize: 11,
            padding: "4px 8px",
            minWidth: 0,
            background: mutedTracks.size > 0
              ? "var(--accent)" : btn.background,
            color: mutedTracks.size > 0
              ? "var(--accent-fg)" : btn.color,
          }}
        >
          {mutedTracks.size > 0 ? `🔇 ${mutedTracks.size}` : "🎚"}
        </button>
        {muteOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              minWidth: 180,
              maxHeight: 280,
              overflowY: "auto",
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              padding: 8,
              zIndex: 100,
              fontSize: 12,
            }}
          >
            <div style={{
              fontSize: 11,
              color: "var(--fg-muted)",
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span>{t("playback.mute.heading")}</span>
              {mutedTracks.size > 0 && (
                <button
                  type="button"
                  onClick={() => setMutedTracks(new Set())}
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    background: "transparent",
                    color: "var(--fg-muted)",
                    cursor: "pointer",
                  }}
                >
                  {t("playback.mute.clear")}
                </button>
              )}
            </div>
            {knownTracks.length === 0 ? (
              <div style={{ color: "var(--fg-tertiary)", fontSize: 11 }}>
                {t("playback.mute.empty")}
              </div>
            ) : (
              knownTracks.map((tr) => {
                const muted = mutedTracks.has(tr.idx);
                return (
                  <label
                    key={tr.idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 0",
                      cursor: "pointer",
                      color: muted
                        ? "var(--fg-tertiary)"
                        : "var(--fg-primary)",
                      textDecoration: muted ? "line-through" : "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!muted}
                      onChange={(e) => {
                        setMutedTracks((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.delete(tr.idx);
                          else next.add(tr.idx);
                          return next;
                        });
                      }}
                    />
                    {tr.name}
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>
      {!compact && (
        <label
          title={
            sampleLoadFailedRef.current
              ? t("playback.samples.failed")
              : t("playback.samples.hint")
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "var(--fg-muted)",
            marginLeft: 4,
          }}
        >
          <input
            type="checkbox"
            checked={useSamples}
            onChange={(e) => setUseSamples(e.target.checked)}
            disabled={state !== "idle"}
          />
          {t("playback.samples.label")}
        </label>
      )}

      {!compact && (
        <>
          <label
            title={t("playback.loop.hint")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--fg-muted)",
              marginLeft: 8,
            }}
          >
            <input
              type="checkbox"
              checked={loopEnabled}
              onChange={(e) => setLoopEnabled(e.target.checked)}
            />
            🔁
          </label>
          <input
            type="number"
            min={1}
            placeholder={t("playback.loop.from.placeholder")}
            value={loopStart ?? ""}
            onChange={(e) => setLoopStart(
              e.target.value ? parseInt(e.target.value, 10) : null,
            )}
            style={{
              width: 50,
              padding: "2px 4px",
              fontSize: 11,
              border: "1px solid var(--border)",
              borderRadius: 3,
              background: "var(--bg-panel)",
              color: "var(--fg-primary)",
            }}
            title={t("playback.loop.from.title")}
          />
          <span style={{ color: "var(--fg-tertiary)", fontSize: 11 }}>–</span>
          <input
            type="number"
            min={1}
            placeholder={t("playback.loop.to.placeholder")}
            value={loopEnd ?? ""}
            onChange={(e) => setLoopEnd(
              e.target.value ? parseInt(e.target.value, 10) : null,
            )}
            style={{
              width: 50,
              padding: "2px 4px",
              fontSize: 11,
              border: "1px solid var(--border)",
              borderRadius: 3,
              background: "var(--bg-panel)",
              color: "var(--fg-primary)",
            }}
            title={t("playback.loop.to.title")}
          />
        </>
      )}
    </div>
  );
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

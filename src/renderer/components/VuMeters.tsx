/**
 * VuMeters — 聲部即時音量表 (VIZ-1)
 *
 * 為何 velocity-based 而非真實 audio 計量: 多軌路由到「共享樂器節點」
 * (violin1 + violin2 → 同一個 sampler), audio graph 無法分軌計量。改用
 * MIDI velocity × 混音增益 在當下播放時間的值 —— 這正是使用者能透過混音台
 * 控制的訊號, 對「聲部平衡」這個目的反而更直接、也精準到每一軌。
 *
 * 效能: 播放前把每軌的 velocity envelope 烤成 Float32Array (每 step 秒一格),
 * rAF 只做 O(1) 查表 + 直接寫 DOM bar 高度 (不經 React state), 故父層 2000 行
 * 的 PlaybackControls 不會每幀重繪。
 */
import { useEffect, useRef } from "react";
import * as Tone from "tone";

export interface VoiceEnv {
  /** 每格秒數 */
  step: number;
  /** trackIdx → 每格的 peak velocity (0..1) */
  env: Map<number, Float32Array>;
}

interface Props {
  /** 軌列表 (idx + 顯示名) — 結構層, 隨改編變動才重繪 */
  tracks: { idx: number; name: string }[];
  /** velocity envelope — 每次播放重建, 經 ref 傳 (只做動畫不觸發重繪) */
  envRef: React.MutableRefObject<VoiceEnv | null>;
  /** 此播放器是否正在播 (只有 active 的播放器跟著 transport 動) */
  playing: boolean;
  /** raw velocity → 有效電平 (套混音增益 + mute/solo; 0 = 靜音) — 須 useCallback 穩定 */
  levelFor: (idx: number, raw: number) => number;
}

const PALETTE = [
  "#d9a441", "#6b9bd1", "#5fae6b", "#c9655a",
  "#a987d1", "#d18f5f", "#5fb0ae", "#c76b9b",
];

export function VuMeters({ tracks, envRef, playing, levelFor }: Props): JSX.Element | null {
  const fills = useRef<(HTMLDivElement | null)[]>([]);
  const levels = useRef<number[]>([]);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const write = (i: number, v: number) => {
      const el = fills.current[i];
      if (el) el.style.height = `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
    };

    if (!playing) {
      // 停止 → 平滑衰減到 0 後收掉 rAF
      const decay = () => {
        let any = false;
        tracks.forEach((_, i) => {
          const cur = (levels.current[i] ?? 0) * 0.8;
          levels.current[i] = cur;
          write(i, cur);
          if (cur > 0.01) any = true;
        });
        raf.current = any ? requestAnimationFrame(decay) : null;
      };
      raf.current = requestAnimationFrame(decay);
      return () => {
        if (raf.current) cancelAnimationFrame(raf.current);
      };
    }

    const loop = () => {
      const ve = envRef.current;
      const s = Tone.Transport.seconds;
      tracks.forEach((t, i) => {
        let raw = 0;
        if (ve) {
          const arr = ve.env.get(t.idx);
          if (arr?.length) {
            const b = Math.min(
              arr.length - 1,
              Math.max(0, Math.floor(s / ve.step)),
            );
            raw = arr[b] ?? 0;
          }
        }
        const target = Math.min(1, levelFor(t.idx, raw));
        // 快上慢下 (像真實 VU 的 attack/release)
        const cur = levels.current[i] ?? 0;
        const next = target > cur ? target : cur * 0.82 + target * 0.18;
        levels.current[i] = next;
        write(i, next);
      });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, tracks, envRef, levelFor]);

  if (!tracks.length) return null;
  return (
    <div
      title="聲部即時音量"
      style={{
        display: "flex", alignItems: "flex-end", gap: 2,
        height: 18, marginLeft: 8,
      }}
    >
      {tracks.map((t, i) => (
        <div
          key={t.idx}
          title={t.name}
          style={{
            width: 5, height: "100%", borderRadius: 2,
            background: "var(--bg-panel)", border: "1px solid var(--border)",
            display: "flex", alignItems: "flex-end", overflow: "hidden",
          }}
        >
          <div
            ref={(el) => { fills.current[i] = el; }}
            style={{
              width: "100%", height: "0%",
              background: PALETTE[i % PALETTE.length],
            }}
          />
        </div>
      ))}
    </div>
  );
}

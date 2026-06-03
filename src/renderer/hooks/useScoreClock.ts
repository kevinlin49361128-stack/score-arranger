/**
 * useScoreClock — 抓並快取當前 arrangement 的統一時間模型 (架構改造 Phase A)。
 *
 * 引擎以 quarter 為基準建一份 TimeMap, 前端用它查「秒↔小節↔quarter」, 取代
 * PlaybackControls/節拍器/loop 各自推時間。抓失敗 (離線/無 arrangement) 回 null,
 * 消費端應退回舊路徑 (漸進遷移, 不一次切換)。
 */
import { useEffect, useState } from "react";

import type { ScoreClockRes } from "../generated/rpc-types";
import { useSessionStore } from "../stores/sessionStore";

export function useScoreClock(): ScoreClockRes | null {
  const arrangement = useSessionStore((s) => s.arrangement);
  const targetMusicXML = useSessionStore((s) => s.targetMusicXML);
  const [clock, setClock] = useState<ScoreClockRes | null>(null);

  useEffect(() => {
    let alive = true;
    if (!arrangement) {
      setClock(null);
      return;
    }
    window.scoreArranger.engine
      .scoreClock()
      .then((res) => {
        if (alive && res.ok && res.data) setClock(res.data);
      })
      .catch(() => {
        /* 時間模型抓失敗不致命 — 消費端退回舊路徑 */
      });
    return () => {
      alive = false;
    };
  }, [arrangement, targetMusicXML]);

  return clock;
}

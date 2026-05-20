/**
 * PresetLibrary — 預設古典樂譜選單
 *
 * 從 music21 corpus 載入內建作品,無需使用者準備 MusicXML 檔。
 */

import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";

interface Preset {
  corpus_path: string;
  display_name: string;
  era: string;
  ensemble?: string;          // 編制簡述 e.g. "SATB 聖詠"
  measures?: number;          // 約略小節數,方便估算
}

const PRESETS: Preset[] = [
  // ─── Baroque ─────────────────────────────────────────────
  {
    corpus_path: "bach/bwv66.6",
    display_name: "Bach 聖詠 BWV 66/6",
    era: "Baroque",
    ensemble: "SATB",
    measures: 10,
  },
  {
    corpus_path: "bach/bwv7.7",
    display_name: "Bach 聖詠 BWV 7/7",
    era: "Baroque",
    ensemble: "SATB",
    measures: 19,
  },
  {
    corpus_path: "bach/bwv57.8",
    display_name: "Bach 聖詠 BWV 57/8",
    era: "Baroque",
    ensemble: "SATB",
    measures: 13,
  },
  {
    corpus_path: "bach/bwv4.8",
    display_name: "Bach 聖詠 BWV 4/8 (Christ lag in Todesbanden)",
    era: "Baroque",
    ensemble: "SATB",
    measures: 14,
  },
  {
    corpus_path: "bach/bwv227.7",
    display_name: "Bach 經文歌 BWV 227 第 7 樂章",
    era: "Baroque",
    ensemble: "SATB",
    measures: 13,
  },
  {
    corpus_path: "bach/bwv281",
    display_name: "Bach 聖詠 BWV 281 (Christus, der ist mein Leben)",
    era: "Baroque",
    ensemble: "SATB",
    measures: 9,
  },
  {
    corpus_path: "bach/bwv344",
    display_name: "Bach 聖詠 BWV 344",
    era: "Baroque",
    ensemble: "SATB",
    measures: 24,
  },
  {
    corpus_path: "bach/bwv1.6",
    display_name: "Bach 聖詠 BWV 1/6 (含法國號)",
    era: "Baroque",
    ensemble: "5 parts",
    measures: 21,
  },
  {
    corpus_path: "corelli/opus3no1/1grave",
    display_name: "Corelli 三重奏鳴曲 op.3/1 Grave",
    era: "Baroque",
    ensemble: "Trio Sonata",
    measures: 19,
  },

  // ─── Classical ───────────────────────────────────────────
  {
    corpus_path: "mozart/k80/movement1",
    display_name: "Mozart 弦樂四重奏 K.80 第一樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 67,
  },
  {
    corpus_path: "mozart/k80/movement2",
    display_name: "Mozart 弦樂四重奏 K.80 第二樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 84,
  },
  {
    corpus_path: "mozart/k155/movement1",
    display_name: "Mozart 弦樂四重奏 K.155 第一樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
  },
  {
    corpus_path: "mozart/k155/movement2",
    display_name: "Mozart 弦樂四重奏 K.155 第二樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
  },
  {
    corpus_path: "mozart/k155/movement3",
    display_name: "Mozart 弦樂四重奏 K.155 第三樂章 (Minuet)",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 103,
  },
  {
    corpus_path: "mozart/k156/movement1",
    display_name: "Mozart 弦樂四重奏 K.156 第一樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 180,
  },
  {
    corpus_path: "mozart/k156/movement2",
    display_name: "Mozart 弦樂四重奏 K.156 第二樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 37,
  },
  {
    corpus_path: "mozart/k156/movement4",
    display_name: "Mozart 弦樂四重奏 K.156 第四樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 24,
  },
  {
    corpus_path: "beethoven/opus18no1/movement1",
    display_name: "Beethoven 弦樂四重奏 op.18/1 第一樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 313,
  },
  {
    corpus_path: "beethoven/opus18no1/movement2",
    display_name: "Beethoven 弦樂四重奏 op.18/1 第二樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 110,
  },
  {
    corpus_path: "beethoven/opus18no1/movement3",
    display_name: "Beethoven 弦樂四重奏 op.18/1 第三樂章 (Scherzo)",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 145,
  },
  {
    corpus_path: "beethoven/opus18no1/movement4",
    display_name: "Beethoven 弦樂四重奏 op.18/1 第四樂章",
    era: "Classical",
    ensemble: "弦樂四重奏",
    measures: 381,
  },
  {
    corpus_path: "beethoven/opus132",
    display_name: "Beethoven 弦樂四重奏 op.132 (晚期)",
    era: "Classical",
    ensemble: "弦樂四重奏 (長)",
    measures: 1124,
  },

  // ─── Romantic ────────────────────────────────────────────
  {
    corpus_path: "chopin/mazurka06-2",
    display_name: "Chopin Mazurka op.6 no.2",
    era: "Romantic",
    ensemble: "鋼琴獨奏",
    measures: 75,
  },
  {
    corpus_path: "schubert/Lindenbaum",
    display_name: "Schubert 菩提樹 (Der Lindenbaum)",
    era: "Romantic",
    ensemble: "聲樂 + 鋼琴",
    measures: 82,
  },
  {
    corpus_path: "schumann_clara/opus17/movement3",
    display_name: "Clara Schumann 鋼琴三重奏 op.17 第三樂章",
    era: "Romantic",
    ensemble: "鋼琴三重奏",
    measures: 80,
  },
  {
    corpus_path: "schumann_robert/dichterliebe_no2",
    display_name: "Schumann 詩人之戀 第 2 首",
    era: "Romantic",
    ensemble: "聲樂 + 鋼琴",
    measures: 18,
  },
  {
    corpus_path: "schumann_robert/opus48no2",
    display_name: "Schumann op.48 no.2",
    era: "Romantic",
    measures: 18,
  },
];

const ERA_LABELS: Record<string, string> = {
  Baroque: "巴洛克",
  Classical: "古典",
  Romantic: "浪漫派",
};

interface PresetLibraryProps {
  buttonStyle: React.CSSProperties;
  disabled?: boolean;
}

export function PresetLibrary({ buttonStyle, disabled }: PresetLibraryProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {
    setSourcePath,
    setSourceMusicXML,
    setTargetMusicXML,
    setAnalysis,
    setArrangement,
    setLoading,
    setError,
    setMode,
    snapshotToTab,
    newTab,
    activeTabId,
    tabs,
  } = useSessionStore();

  // 點外部關閉
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        wrapperRef.current
        && !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  /** 對超大樂譜 (>200 小節) 載入前先要使用者確認 */
  const LARGE_THRESHOLD = 200;
  const HUGE_THRESHOLD = 600;

  const handleLoad = async (preset: Preset) => {
    if (preset.measures && preset.measures > LARGE_THRESHOLD) {
      const warning = preset.measures > HUGE_THRESHOLD
        ? `這份樂譜有 ${preset.measures} 小節 — 非常大, OSMD 渲染可能需要 30–90 秒並可能讓畫面短暫無回應 (renderer 在處理超長 SVG)。\n\n建議先把「自動縮放」和「上下排列 ribbon」關掉再載入, 或先試短一點的範例。\n\n要繼續嗎?`
        : `這份樂譜有 ${preset.measures} 小節 (>${LARGE_THRESHOLD}) — 較大, 第一次渲染可能花 10–30 秒。\n\n要繼續嗎?`;
      if (!confirm(warning)) return;
    }
    return _doLoad(preset);
  };

  const _doLoad = async (preset: Preset) => {
    // 超大樂譜 → 自動關掉 ribbon + autoFit, 避免 renderer 卡死
    if (preset.measures && preset.measures > HUGE_THRESHOLD) {
      const store = useSessionStore.getState();
      if (store.panelLayout === "vertical") store.setPanelLayout("horizontal");
      if (store.autoFit) store.toggleAutoFit();
      if (store.zoom > 0.6) store.setZoom(0.5);
    }
    setOpen(false);
    setError(null);
    // 清掉先前狀態
    setAnalysis(null);
    setArrangement(null);
    setTargetMusicXML(null);

    const virtualPath = `corpus:${preset.corpus_path}`;
    if (!activeTabId && tabs.length === 0) newTab();
    setLoading(true, `載入 ${preset.display_name}...`);
    try {
      const res = await window.scoreArranger.engine.toMusicXML(virtualPath);
      if (res.ok && res.data) {
        setSourcePath(virtualPath);
        setSourceMusicXML(res.data);
        setMode("setup");
        snapshotToTab();
      } else {
        setError(res.error ?? "載入失敗");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // 按時期分組
  const grouped: Record<string, Preset[]> = {};
  for (const p of PRESETS) {
    (grouped[p.era] = grouped[p.era] ?? []).push(p);
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        style={buttonStyle}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        範例 ▾
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
            zIndex: 100,
            minWidth: 420,
            maxHeight: 540,
            overflow: "auto",
          }}
        >
          {Object.entries(grouped).map(([era, presets]) => (
            <div key={era}>
              <div
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--fg-tertiary)",
                  textTransform: "uppercase",
                  borderBottom: "1px solid var(--border-light)",
                  background: "var(--bg-secondary)",
                }}
              >
                {ERA_LABELS[era] ?? era}
              </div>
              {presets.map((p) => (
                <button
                  key={p.corpus_path}
                  onClick={() => handleLoad(p)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--fg-primary)",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "var(--bg-hover)")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{p.display_name}</span>
                    {p.measures && p.measures > HUGE_THRESHOLD && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: 3,
                          background: "rgba(239, 68, 68, 0.18)",
                          color: "rgb(239, 68, 68)",
                          fontWeight: 600,
                          letterSpacing: 0.3,
                        }}
                        title="非常大 — 載入可能花數十秒, ribbon/autofit 會自動關閉"
                      >
                        XL
                      </span>
                    )}
                    {p.measures && p.measures > LARGE_THRESHOLD
                      && p.measures <= HUGE_THRESHOLD && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: 3,
                          background: "rgba(234, 179, 8, 0.18)",
                          color: "rgb(202, 138, 4)",
                          fontWeight: 600,
                          letterSpacing: 0.3,
                        }}
                        title="較大 — 第一次載入可能花 10–30 秒"
                      >
                        L
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--fg-tertiary)",
                      marginTop: 2,
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <span>{p.corpus_path}</span>
                    {p.ensemble && <span>· {p.ensemble}</span>}
                    {p.measures && <span>· {p.measures}m</span>}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

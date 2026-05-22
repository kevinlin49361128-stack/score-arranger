/**
 * PresetLibrary — 預設古典樂譜選單
 *
 * 從 music21 corpus 載入內建作品,無需使用者準備 MusicXML 檔。
 */

import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

interface Preset {
  corpus_path: string;
  name_key: string;           // i18n key — 曲目顯示名
  era: string;
  ensemble_key?: string;      // i18n key — 編制簡述
  measures?: number;          // 約略小節數,方便估算
}

const PRESETS: Preset[] = [
  // ─── Baroque ─────────────────────────────────────────────
  {
    corpus_path: "bach/bwv66.6",
    name_key: "preset.piece.bwv66.6",
    era: "Baroque",
    ensemble_key: "preset.ensemble.satb",
    measures: 10,
  },
  {
    corpus_path: "bach/bwv7.7",
    name_key: "preset.piece.bwv7.7",
    era: "Baroque",
    ensemble_key: "preset.ensemble.satb",
    measures: 19,
  },
  {
    corpus_path: "bach/bwv57.8",
    name_key: "preset.piece.bwv57.8",
    era: "Baroque",
    ensemble_key: "preset.ensemble.satb",
    measures: 13,
  },
  {
    corpus_path: "bach/bwv4.8",
    name_key: "preset.piece.bwv4.8",
    era: "Baroque",
    ensemble_key: "preset.ensemble.satb",
    measures: 14,
  },
  {
    corpus_path: "bach/bwv227.7",
    name_key: "preset.piece.bwv227.7",
    era: "Baroque",
    ensemble_key: "preset.ensemble.satb",
    measures: 13,
  },
  {
    corpus_path: "bach/bwv281",
    name_key: "preset.piece.bwv281",
    era: "Baroque",
    ensemble_key: "preset.ensemble.satb",
    measures: 9,
  },
  {
    corpus_path: "bach/bwv344",
    name_key: "preset.piece.bwv344",
    era: "Baroque",
    ensemble_key: "preset.ensemble.satb",
    measures: 24,
  },
  {
    corpus_path: "bach/bwv1.6",
    name_key: "preset.piece.bwv1.6",
    era: "Baroque",
    ensemble_key: "preset.ensemble.5parts",
    measures: 21,
  },
  {
    corpus_path: "corelli/opus3no1/1grave",
    name_key: "preset.piece.corelliOp3no1Grave",
    era: "Baroque",
    ensemble_key: "preset.ensemble.trioSonata",
    measures: 19,
  },
  {
    corpus_path: "handel/rinaldo/Lascia_chio_pianga",
    name_key: "preset.piece.handelRinaldoLascia",
    era: "Baroque",
    ensemble_key: "preset.ensemble.voiceAccomp",
    measures: 54,
  },

  // ─── Classical ───────────────────────────────────────────
  {
    corpus_path: "mozart/k80/movement1",
    name_key: "preset.piece.k80m1",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 67,
  },
  {
    corpus_path: "mozart/k80/movement2",
    name_key: "preset.piece.k80m2",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 84,
  },
  {
    corpus_path: "mozart/k80/movement3",
    name_key: "preset.piece.k80m3",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 52,
  },
  {
    corpus_path: "mozart/k80/movement4",
    name_key: "preset.piece.k80m4",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 71,
  },
  {
    corpus_path: "mozart/k155/movement1",
    name_key: "preset.piece.k155m1",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
  },
  {
    corpus_path: "mozart/k155/movement2",
    name_key: "preset.piece.k155m2",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
  },
  {
    corpus_path: "mozart/k155/movement3",
    name_key: "preset.piece.k155m3",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 103,
  },
  {
    corpus_path: "mozart/k156/movement1",
    name_key: "preset.piece.k156m1",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 180,
  },
  {
    corpus_path: "mozart/k156/movement2",
    name_key: "preset.piece.k156m2",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 37,
  },
  {
    corpus_path: "mozart/k156/movement3",
    name_key: "preset.piece.k156m3",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 62,
  },
  {
    corpus_path: "mozart/k156/movement4",
    name_key: "preset.piece.k156m4",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 24,
  },
  {
    corpus_path: "mozart/k458/movement1",
    name_key: "preset.piece.k458m1",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 283,
  },
  {
    corpus_path: "mozart/k458/movement2",
    name_key: "preset.piece.k458m2",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 63,
  },
  {
    corpus_path: "mozart/k458/movement3",
    name_key: "preset.piece.k458m3",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 53,
  },
  {
    corpus_path: "mozart/k458/movement4",
    name_key: "preset.piece.k458m4",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 335,
  },
  {
    corpus_path: "haydn/opus1no1/movement1",
    name_key: "preset.piece.haydnOp1no1m1",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 66,
  },
  {
    corpus_path: "haydn/opus1no1/movement2",
    name_key: "preset.piece.haydnOp1no1m2",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 62,
  },
  {
    corpus_path: "haydn/opus74no1/movement1",
    name_key: "preset.piece.haydnOp74no1m1",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
  },
  {
    corpus_path: "haydn/opus74no1/movement2",
    name_key: "preset.piece.haydnOp74no1m2",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 174,
  },
  {
    corpus_path: "haydn/opus74no1/movement3",
    name_key: "preset.piece.haydnOp74no1m3",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 113,
  },
  {
    corpus_path: "haydn/opus74no1/movement4",
    name_key: "preset.piece.haydnOp74no1m4",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 287,
  },
  {
    corpus_path: "beethoven/opus18no1/movement1",
    name_key: "preset.piece.beethovenOp18no1m1",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 313,
  },
  {
    corpus_path: "beethoven/opus18no1/movement2",
    name_key: "preset.piece.beethovenOp18no1m2",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 110,
  },
  {
    corpus_path: "beethoven/opus18no1/movement3",
    name_key: "preset.piece.beethovenOp18no1m3",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 145,
  },
  {
    corpus_path: "beethoven/opus18no1/movement4",
    name_key: "preset.piece.beethovenOp18no1m4",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartet",
    measures: 381,
  },
  {
    corpus_path: "beethoven/opus59no1/movement1",
    name_key: "preset.piece.beethovenOp59no1m1",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartetLong",
    measures: 400,
  },
  {
    corpus_path: "beethoven/opus132",
    name_key: "preset.piece.beethovenOp132",
    era: "Classical",
    ensemble_key: "preset.ensemble.stringQuartetLong",
    measures: 1124,
  },
  {
    corpus_path: "mozart/k545/movement1_exposition",
    name_key: "preset.piece.k545m1Exposition",
    era: "Classical",
    ensemble_key: "preset.ensemble.pianoSolo",
    measures: 12,
  },

  // ─── Romantic ────────────────────────────────────────────
  {
    corpus_path: "chopin/mazurka06-2",
    name_key: "preset.piece.chopinMazurka06.2",
    era: "Romantic",
    ensemble_key: "preset.ensemble.pianoSolo",
    measures: 75,
  },
  {
    corpus_path: "joplin/maple_leaf_rag",
    name_key: "preset.piece.joplinMapleLeafRag",
    era: "Romantic",
    ensemble_key: "preset.ensemble.pianoSolo",
    measures: 85,
  },
  {
    corpus_path: "schubert/Lindenbaum",
    name_key: "preset.piece.schubertLindenbaum",
    era: "Romantic",
    ensemble_key: "preset.ensemble.voicePiano",
    measures: 82,
  },
  {
    corpus_path: "schumann_clara/opus17/movement3",
    name_key: "preset.piece.claraSchumannOp17m3",
    era: "Romantic",
    ensemble_key: "preset.ensemble.pianoTrio",
    measures: 80,
  },
  {
    corpus_path: "schumann_robert/dichterliebe_no2",
    name_key: "preset.piece.schumannDichterliebeNo2",
    era: "Romantic",
    ensemble_key: "preset.ensemble.voicePiano",
    measures: 18,
  },
  {
    corpus_path: "schumann_robert/opus48no2",
    name_key: "preset.piece.schumannOp48no2",
    era: "Romantic",
    measures: 18,
  },
  {
    corpus_path: "verdi/laDonnaEMobile",
    name_key: "preset.piece.verdiLaDonnaEMobile",
    era: "Romantic",
    ensemble_key: "preset.ensemble.voiceAccomp",
    measures: 35,
  },
];

const ERA_LABEL_KEYS: Record<string, string> = {
  Baroque: "preset.era.baroque",
  Classical: "preset.era.classical",
  Romantic: "preset.era.romantic",
};

interface PresetLibraryProps {
  buttonStyle: React.CSSProperties;
  disabled?: boolean;
}

export function PresetLibrary({ buttonStyle, disabled }: PresetLibraryProps) {
  useLocale();
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

  // 空狀態功能按鈕 — ScoreViewer 用 CustomEvent 呼叫
  useEffect(() => {
    const handler = () => { setOpen(true); };
    window.addEventListener("sa:request-open-preset-library", handler);
    return () => {
      window.removeEventListener("sa:request-open-preset-library", handler);
    };
  }, []);

  /** 對超大樂譜 (>200 小節) 載入前先要使用者確認 */
  const LARGE_THRESHOLD = 200;
  const HUGE_THRESHOLD = 600;

  const handleLoad = async (preset: Preset) => {
    if (preset.measures && preset.measures > LARGE_THRESHOLD) {
      const warning = preset.measures > HUGE_THRESHOLD
        ? t("preset.confirm.huge", { measures: preset.measures })
        : t("preset.confirm.large", {
          measures: preset.measures,
          threshold: LARGE_THRESHOLD,
        });
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
    setLoading(true, t("preset.loading", { name: t(preset.name_key) }));
    try {
      const res = await window.scoreArranger.engine.toMusicXML(virtualPath);
      if (res.ok && res.data) {
        setSourcePath(virtualPath);
        setSourceMusicXML(res.data);
        setMode("setup");
        snapshotToTab();
      } else {
        setError(res.error ?? t("preset.error.loadFailed"));
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
        {t("preset.button")}
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
                {ERA_LABEL_KEYS[era] ? t(ERA_LABEL_KEYS[era]) : era}
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
                    <span>{t(p.name_key)}</span>
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
                        title={t("preset.badge.xl.title")}
                      >
                        {t("preset.badge.xl")}
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
                        title={t("preset.badge.l.title")}
                      >
                        {t("preset.badge.l")}
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
                    {p.ensemble_key && <span>· {t(p.ensemble_key)}</span>}
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

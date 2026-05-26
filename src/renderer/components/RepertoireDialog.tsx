/**
 * RepertoireDialog — 0.1.41 曲目資料庫 (取代舊版 PresetLibrary dropdown)
 *
 * 設計目標:
 * - 獨立 modal, 不再用 dropdown
 * - 多維篩選: 時代 / 編制 / 作曲家 / 形式 / ABRSM 等級 / 教學標籤
 * - 全文搜尋 (標題 + 作曲家)
 * - 結果列表顯示完整 metadata
 *
 * 設計取捨:
 * - 篩選器側欄 left, 結果列表 right (傳統 facet search 模式)
 * - 篩選一律 AND (era ∩ ensemble ∩ ...), 同類別內 OR (Baroque OR Classical)
 * - 預設無選 = 全顯示
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  abrsmDescription, ALL_ENSEMBLES, ALL_ERAS, ALL_FORMS, ALL_TAGS,
  composerMonogram, ensembleIcon, type EnsembleType, type Era, ERA_BAND,
  eraFontFamily, type Form, henleDescription, listComposers, REPERTOIRE,
  type RepertoireEntry, type TeachingTag,
} from "../data/repertoireCatalog";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

interface Props {
  onClose: () => void;
}

/** 大樂譜載入確認門檻 (跟舊版同步) */
const LARGE_THRESHOLD = 200;
const HUGE_THRESHOLD = 600;


export function RepertoireDialog({ onClose }: Props) {
  useLocale();
  const {
    setSourcePath, setSourceMusicXML, setTargetMusicXML,
    setAnalysis, setArrangement, setLoading, setError, setMode,
    snapshotToTab, newTab, activeTabId, tabs,
  } = useSessionStore();

  // ─── 篩選狀態 (空 Set = 不過濾) ───────────────────────────────────────
  const [eras, setEras] = useState<Set<Era>>(new Set());
  const [ensembles, setEnsembles] = useState<Set<EnsembleType>>(new Set());
  const [forms, setForms] = useState<Set<Form>>(new Set());
  const [composers, setComposers] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<Set<TeachingTag>>(new Set());
  const [gradeMin, setGradeMin] = useState<number>(1);
  const [gradeMax, setGradeMax] = useState<number>(9);
  const [search, setSearch] = useState("");

  const composerList = useMemo(() => listComposers(), []);

  // ─── 套用篩選 ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return REPERTOIRE.filter((e) => {
      if (eras.size && !eras.has(e.era)) return false;
      if (ensembles.size && !ensembles.has(e.ensemble)) return false;
      if (forms.size && !forms.has(e.form)) return false;
      if (composers.size && !composers.has(e.composer)) return false;
      if (tags.size && !e.tags.some((t) => tags.has(t))) return false;
      // grade filter: 取 grade 或 henle_level 任一在範圍內就過. 兩個都沒
      // 就不被 grade filter 過濾 (避免無分級曲被 filter 掉)
      if (gradeMin > 1 || gradeMax < 9) {
        const g = e.grade ?? e.henle_level;
        if (g !== undefined && (g < gradeMin || g > gradeMax)) return false;
      }
      if (q) {
        const hay = `${e.title} ${e.composer} ${e.corpus_path}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [eras, ensembles, forms, composers, tags, gradeMin, gradeMax, search]);

  const activeFilterCount =
    eras.size + ensembles.size + forms.size + composers.size + tags.size
    + (gradeMin > 1 || gradeMax < 9 ? 1 : 0)
    + (search.trim() ? 1 : 0);

  const clearAll = () => {
    setEras(new Set()); setEnsembles(new Set()); setForms(new Set());
    setComposers(new Set()); setTags(new Set());
    setGradeMin(1); setGradeMax(9); setSearch("");
  };

  // ─── 載入曲目 (與舊版邏輯一致, 大樂譜 confirm) ────────────────────────
  const handleLoad = async (entry: RepertoireEntry) => {
    if (entry.measures && entry.measures > LARGE_THRESHOLD) {
      const warning = entry.measures > HUGE_THRESHOLD
        ? t("preset.confirm.huge", { measures: entry.measures })
        : t("preset.confirm.large", {
          measures: entry.measures, threshold: LARGE_THRESHOLD,
        });
      if (!confirm(warning)) return;
    }
    // 超大樂譜 → 自動關掉 ribbon + autoFit
    if (entry.measures && entry.measures > HUGE_THRESHOLD) {
      const store = useSessionStore.getState();
      if (store.panelLayout === "vertical") store.setPanelLayout("horizontal");
      if (store.autoFit) store.toggleAutoFit();
      if (store.zoom > 0.6) store.setZoom(0.5);
    }
    onClose();
    setError(null);
    setAnalysis(null);
    setArrangement(null);
    setTargetMusicXML(null);

    const virtualPath = `corpus:${entry.corpus_path}`;
    if (!activeTabId && tabs.length === 0) newTab();
    setLoading(true, t("preset.loading", { name: entry.title }));
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

  // ESC 關閉
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 110, display: "flex", alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 980, maxWidth: "95vw", height: "85vh",
          background: "var(--bg-panel)",
          borderRadius: 8, border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <header style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <strong style={{ flex: "0 0 auto", fontSize: 14 }}>
            📚 {t("repertoire.title")}
          </strong>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("repertoire.searchPlaceholder")}
            style={{
              flex: 1, padding: "5px 10px", fontSize: 13,
              borderRadius: 4, border: "1px solid var(--border)",
              background: "var(--bg-input)", color: "var(--fg-primary)",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
            {t("repertoire.results", {
              filtered: filtered.length, total: REPERTOIRE.length,
            })}
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              style={{
                padding: "4px 10px", fontSize: 11,
                background: "transparent", color: "var(--accent)",
                border: "1px solid var(--accent)", borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {t("repertoire.clearAll", { n: activeFilterCount })}
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: "4px 12px", fontSize: 12,
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)", borderRadius: 4,
              color: "var(--fg-primary)", cursor: "pointer",
            }}
          >
            {t("repertoire.close")}
          </button>
        </header>

        {/* ── Body: 篩選側欄 + 結果列表 ───────────────────────────── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* === 左側篩選 === */}
          <aside style={{
            width: 260, borderRight: "1px solid var(--border)",
            padding: 12, overflow: "auto",
            background: "var(--bg-secondary)",
          }}>
            <FilterGroup title={t("repertoire.filter.era")}>
              {ALL_ERAS.map((e) => (
                <FilterChip
                  key={e}
                  label={t(`repertoire.era.${e.toLowerCase()}`)}
                  active={eras.has(e)}
                  onClick={() => toggle(eras, e, setEras)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title={t("repertoire.filter.ensemble")}>
              {ALL_ENSEMBLES.map((e) => (
                <FilterChip
                  key={e}
                  label={t(`repertoire.ensemble.${slugifyKey(e)}`)}
                  active={ensembles.has(e)}
                  onClick={() => toggle(ensembles, e, setEnsembles)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title={t("repertoire.filter.form")}>
              {ALL_FORMS.map((f) => (
                <FilterChip
                  key={f}
                  label={t(`repertoire.form.${slugifyKey(f)}`)}
                  active={forms.has(f)}
                  onClick={() => toggle(forms, f, setForms)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title={t("repertoire.filter.composer")}>
              {composerList.map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  active={composers.has(c)}
                  onClick={() => toggle(composers, c, setComposers)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title={t("repertoire.filter.grade")}>
              <div style={{ fontSize: 11, color: "var(--fg-muted)",
                marginBottom: 6 }}>
                {t("repertoire.gradeRange", {
                  min: gradeMin, max: gradeMax,
                })}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range" min={1} max={9} value={gradeMin}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setGradeMin(v);
                    if (v > gradeMax) setGradeMax(v);
                  }}
                  style={{ flex: 1 }}
                  title={t("repertoire.gradeMinTip")}
                />
                <input
                  type="range" min={1} max={9} value={gradeMax}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setGradeMax(v);
                    if (v < gradeMin) setGradeMin(v);
                  }}
                  style={{ flex: 1 }}
                  title={t("repertoire.gradeMaxTip")}
                />
              </div>
              <div style={{ fontSize: 10, color: "var(--fg-tertiary)",
                marginTop: 4 }}>
                {t("repertoire.gradeNote")}
              </div>
            </FilterGroup>

            <FilterGroup title={t("repertoire.filter.tags")}>
              {ALL_TAGS.map((tag) => (
                <FilterChip
                  key={tag}
                  label={t(`preset.tag.${tag}`)}
                  active={tags.has(tag)}
                  onClick={() => toggle(tags, tag, setTags)}
                />
              ))}
            </FilterGroup>
          </aside>

          {/* === 右側結果列表 === */}
          <section style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {filtered.length === 0 ? (
              <div style={{
                padding: 40, textAlign: "center", color: "var(--fg-muted)",
                fontSize: 13,
              }}>
                {t("repertoire.empty")}
              </div>
            ) : (
              filtered.map((entry) => (
                <EntryRow
                  key={entry.corpus_path}
                  entry={entry}
                  onLoad={handleLoad}
                />
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ─────────────────────────────────────────────────────

function FilterGroup(
  { title, children }: { title: string; children: React.ReactNode },
) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "var(--fg-tertiary)",
        textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function FilterChip(
  { label, active, onClick }: {
    label: string; active: boolean; onClick: () => void;
  },
) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 9px", fontSize: 11, borderRadius: 12,
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent)" : "var(--bg-panel)",
        color: active ? "var(--accent-fg)" : "var(--fg-primary)",
        cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function EntryRow(
  { entry, onLoad }: {
    entry: RepertoireEntry;
    onLoad: (e: RepertoireEntry) => void;
  },
) {
  return (
    <button
      onClick={() => onLoad(entry)}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "10px 12px", marginBottom: 4,
        border: "1px solid var(--border-light)",
        borderLeft: `4px solid ${ERA_BAND[entry.era]}`,
        borderRadius: 6,
        background: "var(--bg-panel)", color: "var(--fg-primary)",
        cursor: "pointer", fontSize: 13,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-panel)")}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* A2 作曲家 monogram 字章 — 24px 圓形 */}
        <span
          title={`${entry.composer} (${entry.composer_dates})`}
          style={{
            display: "inline-flex", alignItems: "center",
            justifyContent: "center",
            width: 26, height: 26, borderRadius: "50%",
            background: ERA_BAND[entry.era],
            color: "#fdf6e3",
            fontSize: 10, fontWeight: 700,
            letterSpacing: 0.2,
            flexShrink: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            border: "1px solid rgba(0,0,0,0.15)",
          }}
        >
          {composerMonogram(entry.composer)}
        </span>
        <strong
          style={{
            flex: 1, lineHeight: 1.3,
            // B4 視覺升級 — 標題依時代套用對應字型
            fontFamily: eraFontFamily(entry.era),
          }}
        >
          {entry.title}
        </strong>
        {/* A4 編制 icon — 16px SVG */}
        <svg
          width="18" height="18" viewBox="0 0 16 16"
          fill="none"
          stroke="var(--fg-secondary)" strokeWidth="1.2"
          strokeLinecap="round"
          style={{ flexShrink: 0, opacity: 0.75 }}
          aria-label={entry.ensemble}
        >
          <path d={ensembleIcon(entry.ensemble)} />
        </svg>
        {entry.measures && entry.measures > HUGE_THRESHOLD && (
          <span style={badgeStyle("rgba(239,68,68,0.18)", "rgb(239,68,68)")}
                title={t("preset.badge.xl.title")}>XL</span>
        )}
        {entry.measures && entry.measures > LARGE_THRESHOLD
          && entry.measures <= HUGE_THRESHOLD && (
          <span style={badgeStyle("rgba(234,179,8,0.18)", "rgb(202,138,4)")}
                title={t("preset.badge.l.title")}>L</span>
        )}
      </div>
      <div style={{
        fontSize: 11, color: "var(--fg-tertiary)",
        marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap",
        alignItems: "center",
      }}>
        <span>{entry.composer} ({entry.composer_dates})</span>
        <span>·</span>
        <span>{t(`repertoire.era.${entry.era.toLowerCase()}`)}</span>
        <span>·</span>
        <span>{t(`repertoire.ensemble.${slugifyKey(entry.ensemble)}`)}</span>
        {entry.measures && <><span>·</span><span>{entry.measures}m</span></>}
        {entry.grade && (
          <span
            title={`ABRSM Grade ${entry.grade} — ${abrsmDescription(entry.grade)}`}
            style={{
              display: "inline-flex", alignItems: "center",
              justifyContent: "center",
              padding: "1px 6px", borderRadius: 8,
              border: "1px solid var(--accent)",
              color: "var(--accent)",
              fontSize: 10, fontWeight: 700,
              background: "var(--bg-panel)",
            }}
          >
            ABRSM {entry.grade}
          </span>
        )}
        {entry.henle_level && (
          <span
            title={`Henle ${entry.henle_level} — ${henleDescription(entry.henle_level)}`}
            style={{
              padding: "1px 6px", borderRadius: 8,
              border: "1px solid var(--border)",
              color: "var(--fg-secondary)",
              fontSize: 10, fontWeight: 600,
              background: "var(--bg-secondary)",
            }}
          >
            Henle {entry.henle_level}
          </span>
        )}
        {entry.tags.map((tag) => (
          <span key={tag} style={{
            padding: "1px 6px", fontSize: 10, borderRadius: 8,
            background: "var(--bg-secondary)",
            color: "var(--fg-muted)",
            border: "1px solid var(--border-light)",
          }}>
            {t(`preset.tag.${tag}`)}
          </span>
        ))}
      </div>
    </button>
  );
}

function badgeStyle(bg: string, color: string): React.CSSProperties {
  return {
    fontSize: 9, padding: "1px 5px", borderRadius: 3,
    background: bg, color: color, fontWeight: 600,
    letterSpacing: 0.3,
  };
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

function toggle<T>(
  current: Set<T>, value: T, setter: (s: Set<T>) => void,
) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

/** "String Quartet" → "stringQuartet" (給 i18n key 用) */
function slugifyKey(s: string): string {
  return s
    .replace(/[\s+]+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1)
                            : w[0].toUpperCase() + w.slice(1)))
    .join("");
}

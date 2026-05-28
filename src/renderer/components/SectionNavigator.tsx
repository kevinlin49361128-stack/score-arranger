/**
 * SectionNavigator — 段落/樂章/排練記號跳轉
 *
 * 對大作品 (交響曲、奏鳴曲) 非常有用 — 不必狂滑動譜面。
 * 顯示位置: TabStrip 旁的小下拉, 只在有 sections 或 rehearsal marks 時出現。
 *
 * 0.1.56 J: 加 "📝 筆記" 模式 — 指揮 / 樂手對每個 rehearsal mark / section
 * 寫排練筆記 (e.g. "B 段銅管太大, 大提琴 cresc."), 存 localStorage.
 */

import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import {
  setRehearsalNote,
  useRehearsalNotes,
} from "../stores/rehearsalNotesStore";
import { t, useLocale } from "../utils/i18n";

export function SectionNavigator() {
  useLocale();
  const sourcePath = useSessionStore((s) => s.sourcePath);
  const arrangement = useSessionStore((s) => s.arrangement);
  const targetMusicXML = useSessionStore((s) => s.targetMusicXML);
  const setHighlightedMeasure = useSessionStore(
    (s) => s.setHighlightedMeasure,
  );
  const [nav, setNav] = useState<NavigationResult | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  // 0.1.56 J: 排練筆記 — score_id 用 sourcePath; 換譜會自動切換 list
  const notes = useRehearsalNotes(sourcePath);

  useEffect(() => {
    if (!sourcePath) {
      setNav(null);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await window.scoreArranger.engine.listNavigation();
        if (res.ok && res.data) setNav(res.data);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [sourcePath, arrangement, targetMusicXML]);

  if (!nav) return null;
  const hasSections = nav.movements.some((m) => m.sections.length > 0);
  const hasMarks = nav.rehearsal_marks.length > 0;
  if (!hasSections && !hasMarks) return null;

  const jumpTo = (measure: number) => {
    setHighlightedMeasure(measure);
  };

  // 0.1.56 J: 把所有 marks (rehearsal marks + section starts) 整理成
  // 統一的 entries 給排練筆記面板用. 排序依 measure.
  const noteEntries: { id: string; label: string; measure: number }[] = [];
  for (const r of nav.rehearsal_marks) {
    noteEntries.push({
      id: `mark-${r.mark}`, label: r.mark, measure: r.measure,
    });
  }
  for (const mv of nav.movements) {
    for (const s of mv.sections) {
      noteEntries.push({
        id: `sec-${s.section_id}`,
        label: s.name,
        measure: s.start,
      });
    }
  }
  noteEntries.sort((a, b) => a.measure - b.measure);

  return (
    <div style={{
      background: "var(--bg-tertiary)",
      borderBottom: "1px solid var(--border-light)",
    }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        fontSize: 12,
      }}
    >
      <span style={{ color: "var(--fg-muted)" }}>
        {t("section.navLabel")}
      </span>
      {hasSections && (
        <select
          onChange={(e) => {
            const m = parseInt(e.target.value, 10);
            if (Number.isFinite(m)) jumpTo(m);
            e.target.value = "";
          }}
          defaultValue=""
          style={selStyle}
        >
          <option value="" disabled>{t("section.sectionsOption")}</option>
          {nav.movements.map((mv) =>
            mv.sections.length === 0 ? null : (
              <optgroup key={mv.movement_id} label={mv.title}>
                {mv.sections.map((s) => (
                  <option key={s.section_id} value={s.start}>
                    {s.name} (m.{s.start}–{s.end})
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
      )}
      {hasMarks && (
        <select
          onChange={(e) => {
            const m = parseInt(e.target.value, 10);
            if (Number.isFinite(m)) jumpTo(m);
            e.target.value = "";
          }}
          defaultValue=""
          style={selStyle}
        >
          <option value="" disabled>{t("section.marksOption")}</option>
          {nav.rehearsal_marks.map((r) => (
            <option key={r.measure} value={r.measure}>
              {r.mark} (m.{r.measure})
            </option>
          ))}
        </select>
      )}
      <span style={{ color: "var(--fg-tertiary)" }}>
        {t("section.totalMeasures", { n: nav.total_measures })}
      </span>
      {/* 0.1.56 J: 排練筆記 toggle — 只在 sourcePath 有 (才能存) 顯示 */}
      {sourcePath && noteEntries.length > 0 && (
        <button
          type="button"
          onClick={() => setNotesOpen((x) => !x)}
          title={t("section.notes.title")}
          style={{
            ...selStyle,
            background: notesOpen
              ? "var(--accent)" : "var(--button-bg)",
            color: notesOpen ? "#fff" : "var(--fg-primary)",
          }}
        >
          📝 {notes.length > 0 && (
            <span style={{ marginLeft: 2, fontSize: 10 }}>
              {notes.length}
            </span>
          )}
        </button>
      )}
    </div>
    {notesOpen && sourcePath && (
      <div style={{
        padding: "8px 12px",
        borderTop: "1px solid var(--border-light)",
        background: "var(--bg-panel)",
        maxHeight: 280, overflow: "auto",
        fontSize: 11,
      }}>
        <div style={{
          color: "var(--fg-muted)",
          marginBottom: 6,
          fontWeight: 600,
        }}>
          {t("section.notes.heading")}
        </div>
        {noteEntries.map((e) => {
          const existing = notes.find((n) => n.mark_id === e.id);
          return (
            <div key={e.id} style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 6,
              marginBottom: 6,
              alignItems: "flex-start",
            }}>
              <button
                type="button"
                onClick={() => jumpTo(e.measure)}
                style={{
                  ...selStyle,
                  minWidth: 70,
                  textAlign: "left",
                  fontSize: 11,
                }}
                title={`m.${e.measure}`}
              >
                {e.label}
              </button>
              <textarea
                defaultValue={existing?.notes ?? ""}
                placeholder={t("section.notes.placeholder")}
                onBlur={(ev) => {
                  setRehearsalNote(
                    sourcePath, e.id, e.measure, ev.target.value,
                  );
                }}
                style={{
                  resize: "vertical",
                  minHeight: 22,
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  padding: "2px 4px",
                  fontSize: 11,
                  fontFamily: "inherit",
                  background: "var(--bg)",
                  color: "var(--fg-primary)",
                }}
                rows={1}
              />
            </div>
          );
        })}
      </div>
    )}
    </div>
  );
}

const selStyle: React.CSSProperties = {
  padding: "2px 6px",
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontSize: 12,
  background: "var(--button-bg)",
  color: "var(--fg-primary)",
  cursor: "pointer",
};

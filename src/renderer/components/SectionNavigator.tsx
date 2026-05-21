/**
 * SectionNavigator — 段落/樂章/排練記號跳轉
 *
 * 對大作品 (交響曲、奏鳴曲) 非常有用 — 不必狂滑動譜面。
 * 顯示位置: TabStrip 旁的小下拉, 只在有 sections 或 rehearsal marks 時出現。
 */

import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        background: "var(--bg-tertiary)",
        borderBottom: "1px solid var(--border-light)",
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

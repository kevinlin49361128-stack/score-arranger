/**
 * ArrangementTitle — 改編標題自訂
 *
 * 讓使用者為改編版命名。標題寫進 target_score.metadata['title'], 匯出 (PDF/
 * MusicXML) 與譜面顯示共用 → 同時根治「來源無標題時匯出漏出 'Music21 Fragment'」
 * (引擎 ir_to_music21 已收斂成 'Untitled', 這裡讓使用者給真正的名字)。
 *
 * 當前標題從 targetMusicXML 解出 (避免額外引擎讀取); 'Untitled' 視為未命名 →
 * 顯示 placeholder 引導。提交 (Enter / blur) 才呼叫引擎, 回傳新 XML 觸發重繪。
 */
import { useEffect, useState } from "react";

import { t } from "../utils/i18n";
import { useSessionStore } from "../stores/sessionStore";

function parseTitle(xml: string | null): string {
  if (!xml) return "";
  const m =
    xml.match(/<work-title>([^<]*)<\/work-title>/) ??
    xml.match(/<movement-title>([^<]*)<\/movement-title>/);
  const raw = (m?.[1] ?? "").trim();
  // fallback 'Untitled' 不算使用者命名 → 當空, 顯示 placeholder
  return raw === "Untitled" ? "" : raw;
}

export function ArrangementTitle(): JSX.Element | null {
  const arrangement = useSessionStore((s) => s.arrangement);
  const targetMusicXML = useSessionStore((s) => s.targetMusicXML);
  const setTargetMusicXML = useSessionStore((s) => s.setTargetMusicXML);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  // 譜換了 (改編 / 重命名 / 編輯) → 同步輸入框
  useEffect(() => {
    setValue(parseTitle(targetMusicXML));
  }, [targetMusicXML]);

  if (!arrangement) return null;

  const commit = async () => {
    const next = value.trim();
    if (next === parseTitle(targetMusicXML)) return; // 沒變, 不打引擎
    setSaving(true);
    try {
      const res = await window.scoreArranger.engine.setTitle(next);
      if (res.ok && res.data) {
        // 回傳的乾淨標題: 'Untitled' → 清空顯示
        setValue(res.data.title === "Untitled" ? "" : res.data.title);
        if (res.data.target_musicxml != null) {
          setTargetMusicXML(res.data.target_musicxml);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        padding: "6px 8px", display: "flex", alignItems: "center", gap: 6,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{ fontSize: 11, color: "var(--fg-muted)", whiteSpace: "nowrap" }}
      >
        {t("arrange.title.label")}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder={t("arrange.title.placeholder")}
        disabled={saving}
        title={t("arrange.title.hint")}
        style={{
          flex: 1, minWidth: 0, fontSize: 12, padding: "3px 6px",
          border: "1px solid var(--border)", borderRadius: 4,
          background: "var(--bg-panel)", color: "var(--fg-primary)",
        }}
      />
    </div>
  );
}

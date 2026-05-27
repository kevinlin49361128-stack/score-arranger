/**
 * ExportMenu — 匯出下拉選單
 *
 * 涵蓋:
 * - 總譜: MusicXML / MIDI / PDF / WAV
 * - 分譜: 每位演奏者一份 PDF (一次下載全部)
 *
 * 5 匯出 mode 的 ExportPanel 有更詳細的逐項操作; 此 dropdown 是 quick access.
 */

import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

interface ExportMenuProps {
  buttonStyle: React.CSSProperties;
  disabled?: boolean;
}

export function ExportMenu({ buttonStyle, disabled }: ExportMenuProps) {
  useLocale();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 0.1.46 D1: 接 ⌘E 快捷鍵打開選單
  useEffect(() => {
    const onRequest = () => {
      if (!disabled) setOpen(true);
    };
    window.addEventListener("sa:request-open-export-menu", onRequest);
    return () => {
      window.removeEventListener("sa:request-open-export-menu", onRequest);
    };
  }, [disabled]);
  const {
    setLoading,
    setError,
    arrangement,
    targetMusicXML,
  } = useSessionStore();

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

  const handleExportFile = async (kind: "musicxml" | "midi") => {
    setOpen(false);
    const path = await window.scoreArranger.exportFileDialog(kind);
    if (!path) return;
    setLoading(true, t("exportMenu.loading.exportFile", {
      format: kind === "midi" ? "MIDI" : "MusicXML",
    }));
    try {
      const res = kind === "midi"
        ? await window.scoreArranger.engine.exportTargetMidi(path)
        : await window.scoreArranger.engine.exportTargetMusicXML(path);
      if (res.ok) {
        setError(null);
      } else {
        setError(res.error ?? t("exportMenu.error.exportFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setOpen(false);
    if (!targetMusicXML) {
      setError(t("exportMenu.error.noArrangement"));
      return;
    }
    setLoading(true, t("exportMenu.loading.generatePdf"));
    try {
      const { exportPdfFromMusicXML } = await import("../utils/pdfExport");
      await exportPdfFromMusicXML(targetMusicXML, "arrangement.pdf");
      setError(null);
    } catch (e) {
      setError(t("exportMenu.error.pdfFailed", {
        message: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllPartsPDF = async () => {
    setOpen(false);
    if (!arrangement) {
      setError(t("exportMenu.error.noArrangement"));
      return;
    }
    setLoading(
      true,
      t("exportMenu.loading.batchPartPdf", {
        count: arrangement.players.length,
      }),
    );
    try {
      const { exportPdfFromMusicXML } = await import("../utils/pdfExport");
      let i = 0;
      const failures: string[] = [];
      for (const p of arrangement.players) {
        i++;
        setLoading(
          true,
          t("exportMenu.loading.partPdfProgress", {
            index: i,
            total: arrangement.players.length,
            name: p.display_name,
          }),
        );
        try {
          const res = await window.scoreArranger.engine.targetPartMusicXML(
            p.player_id,
          );
          if (!res.ok || !res.data) {
            failures.push(`${p.display_name}: ${res.error ?? "no data"}`);
            continue;
          }
          const safeName = p.display_name.replace(/\s+/g, "_");
          await exportPdfFromMusicXML(res.data.musicxml, `${safeName}.pdf`);
          // 給瀏覽器時間處理下載 (避免連續呼叫被吃)
          await new Promise((r) => setTimeout(r, 500));
        } catch (perErr) {
          failures.push(
            `${p.display_name}: ${
              perErr instanceof Error ? perErr.message : String(perErr)
            }`,
          );
        }
      }
      if (failures.length > 0) {
        setError(t("exportMenu.error.somePartsFailed", {
          count: failures.length,
          details: failures.join("; "),
        }));
      } else {
        setError(null);
      }
    } catch (e) {
      setError(t("exportMenu.error.partExportFailed", {
        message: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleExportWAV = async () => {
    setOpen(false);
    if (!arrangement) {
      setError(t("exportMenu.error.noArrangement"));
      return;
    }
    setLoading(true, t("exportMenu.loading.renderAudio"));
    try {
      const midiRes = await window.scoreArranger.engine.toMidi();
      if (!midiRes.ok || !midiRes.data) {
        setError(midiRes.error ?? t("exportMenu.error.getMidiFailed"));
        return;
      }
      const { Midi } = await import("@tonejs/midi");
      const { renderMidiToWav, downloadBlob } = await import(
        "../utils/audioExport"
      );
      const midiBytes = Uint8Array.from(
        atob(midiRes.data.midi_base64),
        (c) => c.charCodeAt(0),
      );
      const midi = new Midi(midiBytes);
      const blob = await renderMidiToWav(midi);
      downloadBlob(blob, `${arrangement.name.replace(/\s+/g, "_")}.wav`);
      setError(null);
    } catch (e) {
      setError(t("exportMenu.error.wavFailed", {
        message: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setLoading(false);
    }
  };

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 14px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--fg-primary)",
    borderBottom: "1px solid var(--border-light)",
  };

  const groupHeader: React.CSSProperties = {
    padding: "4px 14px",
    fontSize: 10,
    fontWeight: 600,
    color: "var(--fg-tertiary)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border-light)",
  };

  const hover = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
    e.currentTarget.style.background = on
      ? "var(--bg-hover)"
      : "transparent";
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        style={buttonStyle}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={t("exportMenu.button.title")}
      >
        {t("exportMenu.button")}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            // 對齊到按鈕「右」邊, 避免 dropdown 超出視窗右側
            right: 0,
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
            zIndex: 100,
            minWidth: 220,
          }}
        >
          <div style={groupHeader}>{t("exportMenu.group.fullScore")}</div>
          <button
            onClick={handleExportPDF}
            disabled={!targetMusicXML}
            style={{ ...itemStyle, opacity: targetMusicXML ? 1 : 0.4 }}
            onMouseEnter={(e) => hover(e, true)}
            onMouseLeave={(e) => hover(e, false)}
          >
            {t("exportMenu.item.pdf")}
            <div style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
              {t("exportMenu.item.pdf.desc")}
            </div>
          </button>
          <button
            onClick={() => handleExportFile("musicxml")}
            disabled={!targetMusicXML}
            style={{ ...itemStyle, opacity: targetMusicXML ? 1 : 0.4 }}
            onMouseEnter={(e) => hover(e, true)}
            onMouseLeave={(e) => hover(e, false)}
          >
            {t("exportMenu.item.musicxml")}
            <div style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
              {t("exportMenu.item.musicxml.desc")}
            </div>
          </button>
          <button
            onClick={() => handleExportFile("midi")}
            disabled={!targetMusicXML}
            style={{ ...itemStyle, opacity: targetMusicXML ? 1 : 0.4 }}
            onMouseEnter={(e) => hover(e, true)}
            onMouseLeave={(e) => hover(e, false)}
          >
            {t("exportMenu.item.midi")}
            <div style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
              {t("exportMenu.item.midi.desc")}
            </div>
          </button>
          <button
            onClick={handleExportWAV}
            disabled={!arrangement}
            style={{ ...itemStyle, opacity: arrangement ? 1 : 0.4 }}
            onMouseEnter={(e) => hover(e, true)}
            onMouseLeave={(e) => hover(e, false)}
          >
            {t("exportMenu.item.wav")}
            <div style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
              {t("exportMenu.item.wav.desc")}
            </div>
          </button>

          {arrangement && arrangement.players.length > 0 && (
            <>
              <div style={groupHeader}>
                {t("exportMenu.group.parts")}
              </div>
              <button
                onClick={handleExportAllPartsPDF}
                style={itemStyle}
                onMouseEnter={(e) => hover(e, true)}
                onMouseLeave={(e) => hover(e, false)}
              >
                {t("exportMenu.item.allPartsPdf", {
                  count: arrangement.players.length,
                })}
                <div style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
                  {arrangement.players.map((p) => p.display_name).join(", ")}
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

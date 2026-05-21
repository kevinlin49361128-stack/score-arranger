/**
 * ExportPanel — Export mode 的內容
 *
 * 集中顯示三種匯出選項與說明,作為「最終交付」階段。
 */

import type { IpcResponse } from "@shared/types";
import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";

interface ExportOption {
  /** i18n key — label 為 t() 後的顯示名稱 */
  labelKey: string;
  /** 顯示用副檔名 (檔名格式不翻譯, 但 open_external 為文字需翻) */
  ext: string;
  extKey?: string;
  descKey: string;
  kind: "musicxml" | "midi" | "sarr" | "pdf" | "open_external" | "wav";
}

const OPTIONS: ExportOption[] = [
  {
    labelKey: "export.option.openExternal.label",
    ext: "",
    extKey: "export.option.openExternal.ext",
    descKey: "export.option.openExternal.desc",
    kind: "open_external",
  },
  {
    labelKey: "export.option.musicxml.label",
    ext: ".musicxml",
    descKey: "export.option.musicxml.desc",
    kind: "musicxml",
  },
  {
    labelKey: "export.option.pdf.label",
    ext: ".pdf",
    descKey: "export.option.pdf.desc",
    kind: "pdf",
  },
  {
    labelKey: "export.option.midi.label",
    ext: ".mid",
    descKey: "export.option.midi.desc",
    kind: "midi",
  },
  {
    labelKey: "export.option.wav.label",
    ext: ".wav",
    descKey: "export.option.wav.desc",
    kind: "wav",
  },
  {
    labelKey: "export.option.sarr.label",
    ext: ".sarr",
    descKey: "export.option.sarr.desc",
    kind: "sarr",
  },
];

export function ExportPanel() {
  useLocale();
  const arrangement = useSessionStore((s) => s.arrangement);
  const sourcePath = useSessionStore((s) => s.sourcePath);
  const targetMusicXML = useSessionStore((s) => s.targetMusicXML);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);

  const handleExport = async (opt: ExportOption) => {
    if (!arrangement && opt.kind !== "sarr") {
      setError(t("export.error.noArrangement"));
      return;
    }
    if (opt.kind === "sarr" && !sourcePath) {
      setError(t("export.error.nothingToSave"));
      return;
    }

    // 「在外部編輯器開啟」: 寫到暫存後 shell.openPath
    if (opt.kind === "open_external") {
      if (!targetMusicXML) {
        setError(t("export.error.noMusicXML"));
        return;
      }
      setLoading(true, t("export.loading.openExternal"));
      try {
        const baseName = arrangement?.name?.replace(/\s+/g, "_") ?? "arrangement";
        const res = await window.scoreArranger.openInExternalEditor(
          targetMusicXML, baseName,
        );
        if (!res.ok) {
          setError(res.error ?? t("export.error.openFailed"));
        } else {
          setError(null);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // WAV: 純前端用 Tone.Offline 渲染
    if (opt.kind === "wav") {
      if (!arrangement) {
        setError(t("export.error.noArrangementShort"));
        return;
      }
      setLoading(true, t("export.loading.renderAudio"));
      try {
        const midiRes = await window.scoreArranger.engine.toMidi();
        if (!midiRes.ok || !midiRes.data) {
          setError(midiRes.error ?? t("export.error.getMidiFailed"));
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
        setError(t("export.error.wavFailed", {
          message: e instanceof Error ? e.message : String(e),
        }));
      } finally {
        setLoading(false);
      }
      return;
    }

    // PDF: 純前端產生,不需檔案對話框 (jsPDF save 直接觸發瀏覽器下載)
    if (opt.kind === "pdf") {
      if (!targetMusicXML) {
        setError(t("export.error.noMusicXML"));
        return;
      }
      setLoading(true, t("export.loading.generatePdf"));
      try {
        // Dynamic import: 拖延 verovio (~7MB) + jsPDF 到使用者首次點 PDF
        const { exportPdfFromMusicXML } = await import("../utils/pdfExport");
        await exportPdfFromMusicXML(targetMusicXML, "arrangement.pdf");
        setError(null);
      } catch (e) {
        setError(t("export.error.pdfFailed", {
          message: e instanceof Error ? e.message : String(e),
        }));
      } finally {
        setLoading(false);
      }
      return;
    }

    let path: string | null;
    if (opt.kind === "sarr") {
      path = await window.scoreArranger.saveProjectDialog();
    } else {
      path = await window.scoreArranger.exportFileDialog(opt.kind);
    }
    if (!path) return;

    setLoading(true, t("export.loading.exporting", { label: t(opt.labelKey) }));
    try {
      let res: IpcResponse<unknown>;
      if (opt.kind === "musicxml") {
        res = await window.scoreArranger.engine.exportTargetMusicXML(path);
      } else if (opt.kind === "midi") {
        res = await window.scoreArranger.engine.exportTargetMidi(path);
      } else {
        res = await window.scoreArranger.engine.saveProject(
          path,
          sourcePath!,
        );
      }
      if (!res.ok) {
        setError(res.error ?? t("export.error.exportFailed"));
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-panel)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        padding: 16,
        background: "var(--bg-base)",
      }}
    >
      <div
        style={{
          marginBottom: 16,
          fontSize: 13,
          color: "var(--fg-muted)",
        }}
      >
        {t("export.intro")}
      </div>
      <PartsExportSection />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {OPTIONS.map((opt) => {
          const disabled = !arrangement && opt.kind !== "sarr";
          return (
            <div
              key={opt.kind}
              style={{
                ...cardStyle,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--fg-primary)",
                }}
              >
                {t(opt.labelKey)}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: "var(--fg-tertiary)",
                    fontWeight: 400,
                  }}
                >
                  {opt.extKey ? t(opt.extKey) : opt.ext}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--fg-muted)",
                  lineHeight: 1.5,
                  flex: 1,
                }}
              >
                {t(opt.descKey)}
              </div>
              <button
                onClick={() => handleExport(opt)}
                disabled={disabled}
                style={{
                  padding: "8px 14px",
                  border: "1px solid var(--accent)",
                  background: "var(--accent)",
                  color: "var(--accent-fg)",
                  borderRadius: 4,
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {t("export.button.exportAs", { label: t(opt.labelKey) })}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ============================================================================
// 分譜匯出區塊 — 每個 player 一個按鈕, 點即下載該 part 的 PDF
// ============================================================================

function PartsExportSection() {
  useLocale();
  const arrangement = useSessionStore((s) => s.arrangement);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);

  if (!arrangement || arrangement.players.length === 0) return null;

  const exportPart = async (playerId: string, displayName: string) => {
    setLoading(true, t("export.parts.loading.generatePartPdf", {
      name: displayName,
    }));
    try {
      const res = await window.scoreArranger.engine.targetPartMusicXML(
        playerId,
      );
      if (!res.ok || !res.data) {
        setError(res.error ?? t("export.parts.error.getPartFailed"));
        return;
      }
      const { exportPdfFromMusicXML } = await import("../utils/pdfExport");
      const safeName = displayName.replace(/\s+/g, "_");
      await exportPdfFromMusicXML(res.data.musicxml, `${safeName}.pdf`);
      setError(null);
    } catch (e) {
      setError(t("export.parts.error.partExportFailed", {
        message: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setLoading(false);
    }
  };

  const exportAllPartsPDF = async () => {
    if (!arrangement) return;
    setLoading(
      true,
      t("export.parts.loading.batchPartPdf", {
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
          t("export.parts.loading.partPdfProgress", {
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
        setError(t("export.parts.error.somePartsFailed", {
          count: failures.length,
          details: failures.join("; "),
        }));
      } else {
        setError(null);
      }
    } catch (e) {
      setError(t("export.parts.error.batchFailed", {
        message: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setLoading(false);
    }
  };

  const exportPartMusicXML = async (
    playerId: string,
    displayName: string,
  ) => {
    setLoading(true, t("export.parts.loading.exportPartMusicXML", {
      name: displayName,
    }));
    try {
      const res = await window.scoreArranger.engine.targetPartMusicXML(
        playerId,
      );
      if (!res.ok || !res.data) {
        setError(res.error ?? t("export.parts.error.getPartFailed"));
        return;
      }
      // 透過 Blob 直接下載
      const blob = new Blob([res.data.musicxml], {
        type: "application/vnd.recordare.musicxml+xml",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${displayName.replace(/\s+/g, "_")}.musicxml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 16,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--fg-primary)",
          marginBottom: 6,
        }}
      >
        {t("export.parts.title")}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--fg-muted)",
          marginBottom: 12,
        }}
      >
        {t("export.parts.desc")}
      </div>
      <button
        onClick={exportAllPartsPDF}
        style={{
          padding: "6px 14px",
          fontSize: 13,
          fontWeight: 600,
          background: "var(--accent)",
          color: "var(--accent-fg)",
          border: "1px solid var(--accent)",
          borderRadius: 4,
          cursor: "pointer",
          marginBottom: 12,
        }}
        title={t("export.parts.downloadAllPdf.title", {
          count: arrangement.players.length,
        })}
      >
        {t("export.parts.downloadAllPdf", {
          count: arrangement.players.length,
        })}
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {arrangement.players.map((p) => (
          <div
            key={p.player_id}
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              padding: "6px 8px",
              border: "1px solid var(--border-light)",
              borderRadius: 6,
              background: "var(--bg-tertiary)",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "var(--fg-primary)",
                fontWeight: 500,
                marginRight: 6,
              }}
            >
              {p.display_name}
            </span>
            <button
              onClick={() => exportPart(p.player_id, p.display_name)}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background: "var(--accent)",
                color: "var(--accent-fg)",
                border: "1px solid var(--accent)",
                borderRadius: 4,
                cursor: "pointer",
              }}
              title={t("export.parts.downloadPartPdf.title")}
            >
              PDF
            </button>
            <button
              onClick={() =>
                exportPartMusicXML(p.player_id, p.display_name)}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background: "var(--button-bg)",
                color: "var(--button-fg)",
                border: "1px solid var(--button-border)",
                borderRadius: 4,
                cursor: "pointer",
              }}
              title={t("export.parts.downloadPartXml.title")}
            >
              XML
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

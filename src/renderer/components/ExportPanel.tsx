/**
 * ExportPanel — Export mode 的內容
 *
 * 集中顯示三種匯出選項與說明,作為「最終交付」階段。
 */

import type { IpcResponse } from "@shared/types";
import { useSessionStore } from "../stores/sessionStore";

interface ExportOption {
  label: string;
  ext: string;
  description: string;
  kind: "musicxml" | "midi" | "sarr" | "pdf" | "open_external" | "wav";
}

const OPTIONS: ExportOption[] = [
  {
    label: "在 MuseScore / Dorico 開啟",
    ext: "外部編輯器",
    description:
      "直接用系統預設樂譜軟體開啟改編結果,進行進階記譜編輯(力度、表情、版面、分譜)。返回 APP 後可重新匯入修改版。",
    kind: "open_external",
  },
  {
    label: "MusicXML",
    ext: ".musicxml",
    description:
      "標準樂譜交換格式。可在 MuseScore、Dorico、Sibelius、Finale 開啟,適合印譜或繼續編輯。",
    kind: "musicxml",
  },
  {
    label: "PDF (列印用)",
    ext: ".pdf",
    description:
      "透過 verovio 渲染為 SVG 後輸出 PDF。直接可印,適合給演奏者紙本。",
    kind: "pdf",
  },
  {
    label: "MIDI",
    ext: ".mid",
    description:
      "MIDI 演奏資料。可在 Logic Pro、Cubase、Ableton 等 DAW 開啟,適合進一步混音或編曲。",
    kind: "midi",
  },
  {
    label: "WAV (試聽用)",
    ext: ".wav",
    description:
      "純合成音色快速渲染為 WAV (44.1kHz 16-bit)。適合分享試聽,不適合正式發行。",
    kind: "wav",
  },
  {
    label: "Score Arranger 專案",
    ext: ".sarr",
    description:
      "完整保留來源、改編、修改狀態。下次回到 Score Arranger 可繼續編輯。",
    kind: "sarr",
  },
];

export function ExportPanel() {
  const arrangement = useSessionStore((s) => s.arrangement);
  const sourcePath = useSessionStore((s) => s.sourcePath);
  const targetMusicXML = useSessionStore((s) => s.targetMusicXML);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);

  const handleExport = async (opt: ExportOption) => {
    if (!arrangement && opt.kind !== "sarr") {
      setError("尚無改編結果可匯出,請先執行「改編」");
      return;
    }
    if (opt.kind === "sarr" && !sourcePath) {
      setError("尚無內容可儲存");
      return;
    }

    // 「在外部編輯器開啟」: 寫到暫存後 shell.openPath
    if (opt.kind === "open_external") {
      if (!targetMusicXML) {
        setError("尚無 MusicXML 內容");
        return;
      }
      setLoading(true, "開啟外部編輯器...");
      try {
        const baseName = arrangement?.name?.replace(/\s+/g, "_") ?? "arrangement";
        const res = await window.scoreArranger.openInExternalEditor(
          targetMusicXML, baseName,
        );
        if (!res.ok) {
          setError(res.error ?? "開啟失敗");
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
        setError("尚無改編結果");
        return;
      }
      setLoading(true, "渲染音訊 (首次載入合成引擎)...");
      try {
        const midiRes = await window.scoreArranger.engine.toMidi();
        if (!midiRes.ok || !midiRes.data) {
          setError(midiRes.error ?? "取得 MIDI 失敗");
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
        setError(`WAV 匯出失敗: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    // PDF: 純前端產生,不需檔案對話框 (jsPDF save 直接觸發瀏覽器下載)
    if (opt.kind === "pdf") {
      if (!targetMusicXML) {
        setError("尚無 MusicXML 內容");
        return;
      }
      setLoading(true, "產生 PDF (首次需載入引擎)...");
      try {
        // Dynamic import: 拖延 verovio (~7MB) + jsPDF 到使用者首次點 PDF
        const { exportPdfFromMusicXML } = await import("../utils/pdfExport");
        await exportPdfFromMusicXML(targetMusicXML, "arrangement.pdf");
        setError(null);
      } catch (e) {
        setError(`PDF 匯出失敗: ${e instanceof Error ? e.message : String(e)}`);
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

    setLoading(true, `匯出 ${opt.label}...`);
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
        setError(res.error ?? "匯出失敗");
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
        選擇要匯出的格式。對音樂人最常用的是 MusicXML 給 MuseScore / Dorico 印譜。
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
                {opt.label}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: "var(--fg-tertiary)",
                    fontWeight: 400,
                  }}
                >
                  {opt.ext}
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
                {opt.description}
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
                匯出為 {opt.label}
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
  const arrangement = useSessionStore((s) => s.arrangement);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);

  if (!arrangement || arrangement.players.length === 0) return null;

  const exportPart = async (playerId: string, displayName: string) => {
    setLoading(true, `產生 ${displayName} 分譜 PDF...`);
    try {
      const res = await window.scoreArranger.engine.targetPartMusicXML(
        playerId,
      );
      if (!res.ok || !res.data) {
        setError(res.error ?? "取得分譜失敗");
        return;
      }
      const { exportPdfFromMusicXML } = await import("../utils/pdfExport");
      const safeName = displayName.replace(/\s+/g, "_");
      await exportPdfFromMusicXML(res.data.musicxml, `${safeName}.pdf`);
      setError(null);
    } catch (e) {
      setError(
        `分譜匯出失敗: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const exportAllPartsPDF = async () => {
    if (!arrangement) return;
    setLoading(
      true,
      `批次產生 ${arrangement.players.length} 份分譜 PDF...`,
    );
    try {
      const { exportPdfFromMusicXML } = await import("../utils/pdfExport");
      let i = 0;
      const failures: string[] = [];
      for (const p of arrangement.players) {
        i++;
        setLoading(
          true,
          `分譜 PDF ${i}/${arrangement.players.length}: ${p.display_name}...`,
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
        setError(`部分分譜失敗 (${failures.length}): ${failures.join("; ")}`);
      } else {
        setError(null);
      }
    } catch (e) {
      setError(
        `批次匯出失敗: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const exportPartMusicXML = async (
    playerId: string,
    displayName: string,
  ) => {
    setLoading(true, `匯出 ${displayName} MusicXML...`);
    try {
      const res = await window.scoreArranger.engine.targetPartMusicXML(
        playerId,
      );
      if (!res.ok || !res.data) {
        setError(res.error ?? "取得分譜失敗");
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
        分譜 (每位演奏者一份)
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--fg-muted)",
          marginBottom: 12,
        }}
      >
        把改編結果依演奏者拆成獨立譜面。給弦樂四重奏團員時, 每人只要拿自己那份。
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
        title={`一次下載全部 ${arrangement.players.length} 份 PDF 分譜`}
      >
        📥 下載全部 PDF ({arrangement.players.length})
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
              title="下載此演奏者的 PDF 分譜"
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
              title="下載此演奏者的 MusicXML"
            >
              XML
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

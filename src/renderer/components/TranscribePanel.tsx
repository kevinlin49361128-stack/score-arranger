/**
 * TranscribePanel — 移植 (樂器替換 + 移調) mode 的下方面板
 *
 * 流程:
 *   1. 載入 source 後自動 list_source_parts → 顯示各 part 的目前樂器
 *   2. 使用者設定: 每個 part 的 target instrument + semitones (留空 = 自動推)
 *   3. 點「套用移植」→ engine.transcribe → 結果寫進 target panel
 *
 * 設計:
 *   - 預設按「instrument 群組」設定 (e.g. 所有 violin → 同 target)
 *   - 進階: 個別 part 可獨立指定 (協奏曲獨奏專用 ← 用 part_id mapping)
 *   - semitones 旁邊有 "建議" 按鈕呼叫 suggest_transposition
 *   - 結果區顯示: semitones_used + adjustments_count + warnings
 */

import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";

const TARGET_OPTIONS = [
  // 弦樂
  { id: "violin", label: "Violin" },
  { id: "viola", label: "Viola" },
  { id: "cello", label: "Violoncello" },
  { id: "double_bass", label: "Double Bass" },
  // 木管
  { id: "flute", label: "Flute" },
  { id: "oboe", label: "Oboe" },
  { id: "clarinet_bb", label: "Clarinet (B♭)" },
  { id: "bassoon", label: "Bassoon" },
  // 銅管
  { id: "horn_f", label: "French Horn" },
  { id: "trumpet_bb", label: "Trumpet (B♭)" },
  { id: "trombone", label: "Trombone" },
  { id: "tuba", label: "Tuba" },
  // 鍵盤
  { id: "piano", label: "Piano" },
];

interface PartRow {
  part_id: string;
  instrument_id: string;
  display_name: string;
  target: string;
  semitones: string;       // 空字串 = 自動
  fit_to_range: boolean;
  per_part: boolean;       // 是否用 part_id 級別映射
}

export function TranscribePanel() {
  const sourcePath = useSessionStore((s) => s.sourcePath);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);
  const setTargetMusicXML = useSessionStore((s) => s.setTargetMusicXML);
  const setArrangement = useSessionStore((s) => s.setArrangement);
  const setArrangementIssues = useSessionStore((s) => s.setArrangementIssues);
  const setHistoryFlags = useSessionStore((s) => s.setHistoryFlags);
  const setMode = useSessionStore((s) => s.setMode);
  const snapshotToTab = useSessionStore((s) => s.snapshotToTab);

  const [parts, setParts] = useState<PartRow[]>([]);
  const [lastResult, setLastResult] = useState<TranscribeResult | null>(null);

  // 載入 source parts
  useEffect(() => {
    if (!sourcePath) {
      setParts([]);
      return;
    }
    (async () => {
      try {
        const res = await window.scoreArranger.engine.listSourceParts(
          sourcePath,
        );
        if (res.ok && res.data) {
          setParts(res.data.map((p) => ({
            ...p,
            target: p.instrument_id,   // 預設不變
            semitones: "",              // 自動推
            fit_to_range: true,
            per_part: false,
          })));
        }
      } catch {
        /* ignore */
      }
    })();
  }, [sourcePath]);

  const updateRow = (idx: number, patch: Partial<PartRow>) => {
    setParts((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  };

  /** 套用「同樂器一起改」: 對選定 instrument 的所有 part 設相同 target */
  const bulkSet = (instrumentId: string, target: string) => {
    setParts((prev) =>
      prev.map((r) =>
        r.instrument_id === instrumentId
          ? { ...r, target, per_part: false }
          : r
      )
    );
  };

  const querySuggestion = async (
    source: string,
    target: string,
    idx: number,
  ) => {
    try {
      const res = await window.scoreArranger.engine.suggestTransposition(
        source, target,
      );
      if (res.ok && res.data) {
        updateRow(idx, { semitones: String(res.data.semitones) });
      }
    } catch {
      /* ignore */
    }
  };

  const handleApply = async () => {
    if (!sourcePath) return;
    // 構造 mapping. 規則:
    //  - per_part=true: 用 part_id 當 key
    //  - per_part=false 且 target != instrument_id: 用 instrument_id 當 key
    //    (同樂器多 part 共用同 target, 由 transcribe 處理)
    const mapping: Record<string, TranscribeMappingValue> = {};
    const seenInstruments = new Set<string>();
    for (const row of parts) {
      if (row.target === row.instrument_id && !row.per_part) continue;
      const semis = row.semitones.trim() === ""
        ? null
        : parseInt(row.semitones, 10);
      const val: TranscribeMappingValue = {
        instrument: row.target,
        semitones: Number.isFinite(semis as number) ? semis : null,
        fit_to_range: row.fit_to_range,
        preserve_octave: true,
      };
      if (row.per_part) {
        mapping[row.part_id] = val;
      } else {
        if (seenInstruments.has(row.instrument_id)) continue;
        mapping[row.instrument_id] = val;
        seenInstruments.add(row.instrument_id);
      }
    }
    if (Object.keys(mapping).length === 0) {
      setError("沒有任何 part 設定了移植目標");
      return;
    }
    setLoading(true, "套用移植中...");
    setError(null);
    try {
      const res = await window.scoreArranger.engine.transcribe(
        sourcePath, mapping,
      );
      if (!res.ok || !res.data) {
        setError(res.error ?? "移植失敗");
        return;
      }
      const data = res.data;
      setTargetMusicXML(data.target_musicxml ?? null);
      setArrangement(data);
      setArrangementIssues(data.issues ?? []);
      setHistoryFlags(false, false);
      setLastResult(data);
      setMode("arrange");  // 進入 arrange mode 看結果 (與 arrange 工作流一致)
      snapshotToTab();
    } finally {
      setLoading(false);
    }
  };

  if (!sourcePath) {
    return (
      <div style={{ padding: 16, color: "var(--fg-tertiary)" }}>
        請先在 1 設定 mode 匯入樂譜。
      </div>
    );
  }
  if (parts.length === 0) {
    return (
      <div style={{ padding: 16, color: "var(--fg-tertiary)" }}>
        載入 source parts 中...
      </div>
    );
  }

  const hasChanges = parts.some((r) =>
    r.target !== r.instrument_id || r.per_part
  );

  return (
    <div style={{ overflow: "auto", height: "100%", padding: 12 }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--fg-muted)",
          marginBottom: 12,
          lineHeight: 1.6,
        }}
      >
        把 source 的部分樂器替換成另一種, 自動處理移調與音域。預設「同樂器
        合併設定」; 勾「per-part」可單獨指定 (協奏曲只換獨奏用這個)。半音數
        留空 = 自動推算 (cello→violin 預設 +19 等慣例)。
      </div>

      <table style={{ width: "100%", fontSize: 12 }}>
        <thead>
          <tr style={{
            background: "var(--bg-tertiary)",
            color: "var(--fg-muted)",
          }}>
            <th style={cellHead}>Part</th>
            <th style={cellHead}>原樂器</th>
            <th style={cellHead}>→ 目標樂器</th>
            <th style={cellHead}>半音</th>
            <th style={cellHead}>Fit</th>
            <th style={cellHead}>Per-part</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((row, idx) => {
            const changed = row.target !== row.instrument_id;
            return (
              <tr
                key={row.part_id}
                style={{
                  borderBottom: "1px solid var(--border-light)",
                  background: changed
                    ? "rgba(124, 92, 255, 0.08)"
                    : "transparent",
                }}
              >
                <td style={cell}>{row.part_id}</td>
                <td style={cell}>{row.display_name}</td>
                <td style={cell}>
                  <select
                    value={row.target}
                    onChange={(e) =>
                      row.per_part
                        ? updateRow(idx, { target: e.target.value })
                        : bulkSet(row.instrument_id, e.target.value)}
                    style={selStyle}
                  >
                    <option value={row.instrument_id}>
                      (不變) {row.instrument_id}
                    </option>
                    {TARGET_OPTIONS.filter((o) => o.id !== row.instrument_id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                  </select>
                </td>
                <td style={cell}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="text"
                      placeholder="自動"
                      value={row.semitones}
                      onChange={(e) =>
                        updateRow(idx, { semitones: e.target.value })}
                      style={{
                        ...selStyle,
                        width: 56,
                        textAlign: "center",
                      }}
                      title="留空 = 自動推算"
                    />
                    {changed && (
                      <button
                        onClick={() => querySuggestion(
                          row.instrument_id, row.target, idx,
                        )}
                        style={btnSmall}
                        title="查詢慣例 / 自動推算"
                      >
                        建議
                      </button>
                    )}
                  </div>
                </td>
                <td style={cell}>
                  <input
                    type="checkbox"
                    checked={row.fit_to_range}
                    onChange={(e) =>
                      updateRow(idx, { fit_to_range: e.target.checked })}
                    title="超出目標音域時自動八度位移"
                  />
                </td>
                <td style={cell}>
                  <input
                    type="checkbox"
                    checked={row.per_part}
                    onChange={(e) =>
                      updateRow(idx, { per_part: e.target.checked })}
                    title="勾選 = 只移植這一個 part (協奏曲獨奏用)"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={handleApply}
          disabled={!hasChanges}
          style={{
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 600,
            background: hasChanges ? "var(--accent)" : "var(--bg-tertiary)",
            color: hasChanges ? "var(--accent-fg)" : "var(--fg-tertiary)",
            border: "none",
            borderRadius: 4,
            cursor: hasChanges ? "pointer" : "not-allowed",
          }}
        >
          ⇆ 套用移植
        </button>
        {!hasChanges && (
          <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
            尚未變更任何 part 的目標
          </span>
        )}
      </div>

      {lastResult && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "var(--bg-secondary)",
            borderLeft: "3px solid var(--accent)",
            borderRadius: 4,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <strong>上次套用結果</strong>
          <div>
            移調: {Object.entries(lastResult.semitones_used)
              .map(([k, v]) => `${k}=${v > 0 ? "+" : ""}${v}`)
              .join(", ")}
          </div>
          <div>
            自動八度修正: {lastResult.adjustments_count} 個音符
          </div>
          {lastResult.warnings.length > 0 && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ color: "var(--warning-fg)" }}>
                ⚠ Warnings ({lastResult.warnings.length})
              </summary>
              <ul style={{ margin: "6px 0", paddingLeft: 18 }}>
                {lastResult.warnings.map((w, i) => (
                  <li key={i} style={{ fontSize: 11 }}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

const cellHead: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "left",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontWeight: 600,
  borderBottom: "1px solid var(--border)",
};

const cell: React.CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "middle",
  color: "var(--fg-primary)",
};

const selStyle: React.CSSProperties = {
  padding: "3px 6px",
  fontSize: 12,
  border: "1px solid var(--border)",
  background: "var(--bg-panel)",
  color: "var(--fg-primary)",
  borderRadius: 3,
};

const btnSmall: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: 10,
  border: "1px solid var(--button-border)",
  background: "var(--button-bg)",
  color: "var(--button-fg)",
  borderRadius: 3,
  cursor: "pointer",
};

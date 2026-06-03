/**
 * TargetPanel — 改編後樂譜面板 (右欄 / 下欄)
 *
 * 包含:
 *   - Panel header: 標題 + compact 播放控制
 *   - ScoreViewer 渲染改編譜 MusicXML; 帶熱圖 / diff / 編輯閃光
 *
 * 點小節 → 呼叫 onMeasureClick (App 接 MeasureEditor 開啟).
 * 拖音符 → 呼叫 onNoteDrag (App 接 transpose IPC).
 *
 * 0.1.28: 從 App.tsx 抽出. 純呈現; click / drag 邏輯保留在 App.
 */

import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { toSoundingPitchXML } from "../utils/displayPitch";
import { t as tr, useLocale } from "../utils/i18n";
import { recordApply } from "../utils/preferences";
import { shortLabel, suggestionLabel } from "./IssuePanel";
import { PlaybackControls } from "./PlaybackControls";
import { type IssueFix, type IssueMarker, ScoreViewer } from "./ScoreViewer";

interface TargetPanelProps {
  onMeasureClick: (m: number, hint?: { approxPitch?: number }) => void;
  onNoteDrag: (
    measure: number, approxPitch: number, semitones: number,
  ) => void | Promise<void>;
  measureDifficulty?: Map<number, number>;
  diffMeasures?: Set<number>;
}

export function TargetPanel({
  onMeasureClick, onNoteDrag, measureDifficulty, diffMeasures,
}: TargetPanelProps) {
  useLocale();
  const {
    targetMusicXML,
    arrangement,
    highlightedMeasure,
    highlightFlashTick,
    playbackMeasure,
    activePlaybackSide,
    playbackSyncBoth,
    editFlash,
    displayPitchMode,
    setDisplayPitchMode,
    arrangementIssues,
    setTargetMusicXML,
    setArrangementIssues,
    setHistoryFlags,
    setError,
    setLoading,
  } = useSessionStore();

  // 0.1.90: 行內 issue 標記 — 把改編問題彙整成「每小節一個 ⚠」, 帶 Quick Fix。
  // 一個小節可能多個問題; 取最高 severity 當標籤, fixes 收齊該小節所有可套修復。
  const issueMarkers = useMemo<IssueMarker[]>(() => {
    if (!arrangementIssues?.length) return [];
    const rank = { error: 3, warning: 2, info: 1 } as const;
    const byMeasure = new Map<number, IssueMarker>();
    for (const iss of arrangementIssues) {
      const fixes: IssueFix[] =
        iss.voice_id != null && iss.event_index != null
          ? (iss.suggestions ?? []).map((s) => ({
              label: suggestionLabel(s.code),
              partId: iss.part_id,
              measure: iss.measure,
              voiceId: iss.voice_id,
              eventIndex: iss.event_index,
              code: s.code,
            }))
          : [];
      const prev = byMeasure.get(iss.measure);
      if (!prev) {
        byMeasure.set(iss.measure, {
          measure: iss.measure,
          severity: iss.severity,
          label: shortLabel(iss.code),
          fixes,
        });
      } else {
        if (rank[iss.severity] > rank[prev.severity]) {
          prev.severity = iss.severity;
          prev.label = shortLabel(iss.code);
        }
        prev.fixes.push(...fixes);
      }
    }
    return [...byMeasure.values()];
  }, [arrangementIssues]);

  // 0.1.90 S3: 套用「移八度」類 fix 後, 觸發方向性 ghost 提示。
  const [fixGhost, setFixGhost] = useState<{
    measure: number;
    direction: "up" | "down";
    tick: number;
  } | null>(null);

  const handleApplyFix = async (fix: IssueFix): Promise<void> => {
    if (fix.voiceId == null || fix.eventIndex == null) return;
    setLoading(true, tr("issue.applying", { code: fix.code }));
    try {
      const res = await window.scoreArranger.engine.applySuggestion(
        fix.partId,
        fix.measure,
        fix.voiceId,
        fix.eventIndex,
        fix.code,
      );
      if (res.ok && res.data) {
        if (res.data.target_musicxml) {
          setTargetMusicXML(res.data.target_musicxml);
        }
        setArrangementIssues(res.data.issues);
        setHistoryFlags(res.data.can_undo, res.data.can_redo);
        setError(null);
        recordApply(fix.code);
        // S3: 移八度類 fix → 在該小節放方向性 ghost
        const dir =
          fix.code === "S_OCTAVE_UP"
            ? "up"
            : fix.code === "S_OCTAVE_DOWN"
              ? "down"
              : null;
        if (dir) {
          setFixGhost((p) => ({
            measure: fix.measure,
            direction: dir,
            tick: (p?.tick ?? 0) + 1,
          }));
        }
      } else {
        setError(res.error ?? tr("issue.applyFailed"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // 0.1.55 移調樂器: 切到實音時把 written pitch + <transpose> 轉成
  // sounding pitch (剝 <transpose>). 預設 written 直接用原 XML, 無成本.
  // 對非移調 part 為 no-op.
  const renderedMusicXML = useMemo(() => {
    if (displayPitchMode === "sounding") {
      return toSoundingPitchXML(targetMusicXML);
    }
    return targetMusicXML;
  }, [targetMusicXML, displayPitchMode]);

  // 判斷此譜是否含移調樂器 — 沒含時 toggle 不顯示 (避免 UI 雜訊)
  const hasTransposingPart = useMemo(() => {
    if (!targetMusicXML) return false;
    return targetMusicXML.includes("<transpose>");
  }, [targetMusicXML]);

  // 0.1.48 B3: 偵測巴洛克 continuo 自動實現狀態
  const [continuoChords, setContinuoChords] = useState<number>(0);
  useEffect(() => {
    if (!arrangement || !targetMusicXML) {
      setContinuoChords(0);
      return;
    }
    let cancelled = false;
    void window.scoreArranger.engine.getContinuoStatus().then((res) => {
      if (cancelled) return;
      if (res.ok && res.data?.has_continuo) {
        setContinuoChords(res.data.realized_chord_count);
      } else {
        setContinuoChords(0);
      }
    });
    return () => { cancelled = true; };
  }, [arrangement, targetMusicXML]);

  return (
    <div
      style={{
        background: "var(--bg-panel)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          borderBottom: "1px solid var(--border-light)",
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "var(--fg-muted)",
        }}
      >
        <span style={{ fontWeight: 600 }}>
          {tr("app.panel.targetTitle")}
        </span>
        {/* 0.1.48 B3: 巴洛克 continuo 自動實現徽章 */}
        {continuoChords > 0 && (
          <span
            title={tr("target.continuo.tooltip", {
              count: String(continuoChords),
            })}
            style={{
              fontSize: 10, fontWeight: 600,
              padding: "1px 7px", borderRadius: 8,
              background: "rgba(176, 138, 69, 0.18)",
              color: "rgb(146, 88, 4)",
              border: "1px solid rgba(176, 138, 69, 0.35)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            🎹 {tr("target.continuo.label", {
              count: String(continuoChords),
            })}
          </span>
        )}
        {/* 0.1.55 移調樂器 — 記譜音 / 實音 切換. 沒移調 part 就不顯示. */}
        {hasTransposingPart && (
          <div
            title={tr("target.pitchMode.tooltip")}
            style={{
              display: "inline-flex",
              border: "1px solid var(--border-light)",
              borderRadius: 4,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {(["written", "sounding"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDisplayPitchMode(mode)}
                style={{
                  padding: "1px 6px",
                  fontSize: 10,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: displayPitchMode === mode
                    ? "var(--accent)" : "transparent",
                  color: displayPitchMode === mode
                    ? "var(--accent-fg)" : "var(--fg-muted)",
                }}
              >
                {tr(`target.pitchMode.${mode}`)}
              </button>
            ))}
          </div>
        )}
        <PlaybackControls side="target" compact />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <ScoreViewer
          label={
            arrangement
              ? tr("app.panel.targetLabel.result", { name: arrangement.name })
              : tr("app.panel.targetLabel.default")
          }
          musicXmlContent={renderedMusicXML}
          highlightedMeasure={highlightedMeasure}
          highlightFlashTick={highlightFlashTick}
          // 改編譜自己在播 或 toolbar 同步模式時才顯示游標
          playbackMeasure={
            activePlaybackSide === "target" || playbackSyncBoth
              ? playbackMeasure
              : null
          }
          onMeasureClick={onMeasureClick}
          onNoteDrag={onNoteDrag}
          measureDifficulty={measureDifficulty}
          diffMeasures={diffMeasures}
          editFlash={editFlash}
          isAutoFitReference={!!targetMusicXML}
          issueMarkers={issueMarkers}
          onApplyFix={handleApplyFix}
          fixGhost={fixGhost}
        />
      </div>
    </div>
  );
}

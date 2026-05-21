/**
 * RepairTimeline — 修復迴圈時間軸 scrubber
 *
 * 改編時若啟用「修復」, 引擎會跑最多 10 次定向修復迭代. 本元件把每一步
 * 視覺化成一條時間軸, 使用者可以拖拽 slider 檢視:
 *   - 每步修了哪個問題 (issue_code) / 用哪個策略 (applied_strategy)
 *   - 嚴重度分數如何遞減
 *   - 該步的譜面快照 (透過 onScrub 把 MusicXML 送回 ScoreViewer 預覽)
 *
 * slider 拖到「最終」位置 = 顯示改編完成的譜.
 */

import { useState } from "react";
import type { QualityScores, RepairTimelineEntry } from "@shared/types";
import { t, useLocale } from "../utils/i18n";

interface Props {
  timeline: RepairTimelineEntry[];
  converged: boolean;
  severityBefore: number;
  severityAfter: number;
  /** 修復前/後的改編品質 (melody/harmony/playability) */
  qualityBefore?: QualityScores | null;
  qualityAfter?: QualityScores | null;
  /** 最終 (修復完成) 的 MusicXML — slider 最右端 */
  finalMusicXML: string | null;
  /** 拖拽時回呼: 把該步的 MusicXML 送出去預覽; null = 還原最終版 */
  onScrub: (musicxml: string | null) => void;
}

/** 一項品質的 before→after 顯示, after 退步時標警示色。 */
function QualityDelta(
  { label, before, after }: {
    label: string;
    before: number;
    after: number;
  },
) {
  useLocale();
  const improved = after >= before - 0.001;
  return (
    <span>
      {label}{" "}
      <span style={{ color: "var(--fg-muted)" }}>{before.toFixed(2)}</span>
      →
      <span style={{ color: improved ? "#34d399" : "#f59e0b" }}>
        {after.toFixed(2)}
      </span>
    </span>
  );
}

export function RepairTimeline(
  { timeline, converged, severityBefore, severityAfter,
    qualityBefore, qualityAfter, finalMusicXML, onScrub }: Props,
) {
  useLocale();
  // step 0 = 改編完成 (最終); step 1..N = 第 N 次迭代後
  // slider 值: N = 最終, 0 = 第一步前... 用 index into [...timeline, final]
  const totalSteps = timeline.length;
  const [step, setStep] = useState(totalSteps); // 預設停在最終

  if (totalSteps === 0) {
    return (
      <div style={{
        padding: "6px 12px",
        fontSize: 11,
        color: "var(--fg-tertiary)",
        background: "var(--bg-tertiary)",
        borderTop: "1px solid var(--border-light)",
      }}>
        {t("repair.noRepairNeeded")}
      </div>
    );
  }

  const handleScrub = (s: number) => {
    setStep(s);
    if (s >= totalSteps) {
      onScrub(finalMusicXML);
    } else {
      // s = 0 表示第一次迭代後; timeline[s] 是第 s+1 步... 用 timeline[s]
      onScrub(timeline[s]?.target_musicxml ?? finalMusicXML);
    }
  };

  const current = step < totalSteps ? timeline[step] : null;
  const reduction = severityBefore > 0
    ? Math.round((1 - severityAfter / severityBefore) * 100)
    : 0;

  return (
    <div style={{
      padding: "8px 12px",
      background: "var(--bg-tertiary)",
      borderTop: "1px solid var(--border-light)",
      fontSize: 12,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
      }}>
        <span style={{ fontWeight: 600, color: "var(--fg-muted)" }}>
          {t("repair.timelineTitle")}
        </span>
        <span style={{
          fontSize: 11,
          color: converged ? "#34d399" : "#f59e0b",
        }}>
          {converged
            ? t("repair.converged", { steps: totalSteps, pct: reduction })
            : t("repair.notConverged", { steps: totalSteps })}
        </span>
        <span style={{
          marginLeft: "auto",
          fontSize: 11,
          color: "var(--fg-tertiary)",
        }}>
          {step >= totalSteps
            ? t("repair.viewingFinal")
            : t("repair.viewingStep", { step: step + 1 })}
        </span>
      </div>

      {/* 修復前後品質 — 嚴重度遞減之外, 顯示對音樂品質的實際影響 */}
      {qualityBefore && qualityAfter && (
        <div style={{
          fontSize: 11,
          color: "var(--fg-tertiary)",
          marginBottom: 6,
        }}>
          {t("repair.qualityPrefix")}{" "}
          <QualityDelta
            label={t("repair.qualityMelody")}
            before={qualityBefore.melody_preservation}
            after={qualityAfter.melody_preservation}
          />
          {" · "}
          <QualityDelta
            label={t("repair.qualityHarmony")}
            before={qualityBefore.harmony_completeness}
            after={qualityAfter.harmony_completeness}
          />
          {" · "}
          <QualityDelta
            label={t("repair.qualityPlayability")}
            before={qualityBefore.playability}
            after={qualityAfter.playability}
          />
        </div>
      )}

      {/* slider */}
      <input
        type="range"
        min={0}
        max={totalSteps}
        step={1}
        value={step}
        onChange={(e) => handleScrub(parseInt(e.target.value, 10))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />

      {/* 步驟刻度 */}
      <div style={{
        display: "flex",
        gap: 2,
        marginTop: 2,
      }}>
        {timeline.map((entry, i) => (
          <button
            key={i}
            onClick={() => handleScrub(i)}
            title={t("repair.stepTick", {
              step: i + 1,
              code: entry.issue_code,
            }) + (entry.applied_strategy
              ? ` → ${entry.applied_strategy}`
              : ` ${t("repair.noStrategyShort")}`)}
            style={{
              flex: 1,
              height: 6,
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
              background: i === step
                ? "var(--accent)"
                : entry.applied_strategy
                ? "#34d39955"
                : "#f59e0b55",
            }}
          />
        ))}
        <button
          onClick={() => handleScrub(totalSteps)}
          title={t("repair.finalTick")}
          style={{
            flex: 1,
            height: 6,
            border: "none",
            borderRadius: 2,
            cursor: "pointer",
            background: step >= totalSteps ? "var(--accent)" : "#34d39988",
          }}
        />
      </div>

      {/* 當前步驟細節 */}
      {current && (
        <div style={{
          marginTop: 6,
          padding: "6px 8px",
          background: "var(--bg-secondary)",
          borderRadius: 4,
          fontSize: 11,
          color: "var(--fg-secondary)",
        }}>
          <div>
            <strong>
              {t("repair.stepLabel", { step: current.iteration + 1 })}
            </strong>{" "}
            {t("repair.repairedCodePrefix")}{" "}
            <code style={{
              background: "var(--code-bg)",
              padding: "0 4px",
              borderRadius: 3,
            }}>{current.issue_code}</code>{" "}
            @ {current.issue_location}
          </div>
          <div style={{ color: "var(--fg-tertiary)", marginTop: 2 }}>
            {t("repair.strategyLabel")}{" "}
            {current.applied_strategy ?? t("repair.noStrategy")}
            {" · "}
            {t("repair.severityLabel")} {current.score_before.toFixed(1)} →{" "}
            {current.score_after.toFixed(1)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * QualityDeltaBadge — D2 品質 lint
 *
 * 顯示一次編輯前後的改編品質 delta:旋律保留 / 和聲完整 / 可演奏性。
 * 在 NLEditDialog / DifficultyBoostDialog 套用成功後渲染, 讓使用者
 * 看見「這次改動對品質的影響」—— 人機協作的護欄。
 *
 * delta = after - before, 各項皆 0-1 範圍。顯示為百分點變化:
 *   +5%  綠色 (改善)
 *   -3%  橘色 (退步)
 *   ±0%  灰色 (持平, |d| < 0.005)
 */

import { t, useLocale } from "../utils/i18n";

export interface QualityDelta {
  melody: number;
  harmony: number;
  playability: number;
  overall: number;
}

interface Props {
  delta: QualityDelta | null;
}

function fmtDelta(d: number): { text: string; color: string } {
  if (Math.abs(d) < 0.005) {
    return { text: "±0%", color: "var(--fg-tertiary)" };
  }
  const pct = Math.round(d * 100);
  if (d > 0) {
    return { text: `+${pct}%`, color: "var(--ok, #3a9d5d)" };
  }
  return { text: `${pct}%`, color: "#d8843a" };
}

export function QualityDeltaBadge({ delta }: Props) {
  useLocale();
  if (!delta) return null;
  const items = [
    { label: t("quality.delta.melody"), v: delta.melody },
    { label: t("quality.delta.harmony"), v: delta.harmony },
    { label: t("quality.delta.playability"), v: delta.playability },
  ];
  return (
    <div
      style={{
        marginTop: 8,
        padding: "8px 12px",
        background: "var(--bg-secondary)",
        borderRadius: 4,
        fontSize: 11.5,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: "var(--fg-muted)", fontWeight: 700 }}>
        {t("quality.delta.label")}
      </span>
      {items.map((it) => {
        const f = fmtDelta(it.v);
        return (
          <span key={it.label}>
            <span style={{ color: "var(--fg-muted)" }}>{it.label}</span>
            {" "}
            <span style={{ color: f.color, fontWeight: 700 }}>{f.text}</span>
          </span>
        );
      })}
    </div>
  );
}

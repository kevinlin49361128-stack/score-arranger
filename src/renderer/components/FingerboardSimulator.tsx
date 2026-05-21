/**
 * FingerboardSimulator — 2D 弦樂指板衝突視覺化
 *
 * 給定一個和弦的 MIDI 音高, 在小提琴 / 中提琴 / 大提琴指板上畫出按弦位置,
 * 讓不懂弦樂的人 (鋼琴家 / 作曲者) 一眼看懂演奏的物理極限:
 *   - 綠點: 可行的按弦位置
 *   - 紅點: 衝突 (兩音被迫同弦 / 跨非相鄰弦 / 把位過高)
 *
 * 弦的調音是物理常數, 直接寫在前端.
 */

import { t, useLocale } from "../utils/i18n";

interface Props {
  instrument: "violin" | "viola" | "cello";
  /** 和弦的 MIDI 音高 (1-4 音) */
  pitches: number[];
}

interface StringTuning {
  /** 空弦 MIDI */
  open: number;
  /** 弦名 (顯示用) */
  name: string;
}

const TUNINGS: Record<Props["instrument"], StringTuning[]> = {
  // index 0 = 最低弦
  violin: [
    { open: 55, name: "G" },
    { open: 62, name: "D" },
    { open: 69, name: "A" },
    { open: 76, name: "E" },
  ],
  viola: [
    { open: 48, name: "C" },
    { open: 55, name: "G" },
    { open: 62, name: "D" },
    { open: 69, name: "A" },
  ],
  cello: [
    { open: 36, name: "C" },
    { open: 43, name: "G" },
    { open: 50, name: "D" },
    { open: 57, name: "A" },
  ],
};

/** 一根弦上的實用按弦範圍 (半音). 0 = 空弦, 24 = 高兩個八度 (已是高把位). */
const MAX_POSITION = 24;
/** 舒適把位上限 — 超過視為高難度 */
const COMFORTABLE_POSITION = 12;

const PITCH_NAMES = ["C", "C♯", "D", "D♯", "E", "F",
  "F♯", "G", "G♯", "A", "A♯", "B"];

function midiName(midi: number): string {
  return `${PITCH_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

interface PlacedNote {
  midi: number;
  /** 被指派到的弦 index, -1 = 無解 */
  stringIndex: number;
  position: number;
  conflict: "none" | "same-string" | "out-of-range" | "non-adjacent";
}

/**
 * 把和弦音指派到弦上 — 每音一弦, 偏好低把位.
 * 回傳每個音的指派結果 + 衝突標記.
 */
function placeChord(
  pitches: number[],
  strings: StringTuning[],
): PlacedNote[] {
  const sorted = [...pitches].sort((a, b) => a - b);
  const used = new Set<number>();
  const placed: PlacedNote[] = [];

  for (const midi of sorted) {
    // 候選: 每根弦上 0..MAX_POSITION 的位置
    const candidates: { stringIndex: number; position: number }[] = [];
    strings.forEach((s, si) => {
      const pos = midi - s.open;
      if (pos >= 0 && pos <= MAX_POSITION) {
        candidates.push({ stringIndex: si, position: pos });
      }
    });

    if (candidates.length === 0) {
      placed.push({
        midi, stringIndex: -1, position: -1, conflict: "out-of-range",
      });
      continue;
    }
    // 偏好未被佔用的弦, 其次低把位
    const free = candidates.filter((c) => !used.has(c.stringIndex));
    const pool = free.length > 0 ? free : candidates;
    pool.sort((a, b) => a.position - b.position);
    const chosen = pool[0];
    const conflict: PlacedNote["conflict"] = free.length === 0
      ? "same-string"
      : "none";
    used.add(chosen.stringIndex);
    placed.push({
      midi,
      stringIndex: chosen.stringIndex,
      position: chosen.position,
      conflict,
    });
  }

  // 跨非相鄰弦檢查
  const usedStrings = placed
    .filter((p) => p.stringIndex >= 0)
    .map((p) => p.stringIndex)
    .sort((a, b) => a - b);
  if (usedStrings.length >= 2) {
    const span = usedStrings[usedStrings.length - 1] - usedStrings[0];
    if (span > usedStrings.length - 1) {
      // 有跳過的弦 → 非相鄰
      for (const p of placed) {
        if (p.conflict === "none") p.conflict = "non-adjacent";
      }
    }
  }
  return placed;
}

export function FingerboardSimulator({ instrument, pitches }: Props) {
  useLocale();
  const strings = TUNINGS[instrument];
  const placed = placeChord(pitches, strings);
  const hasConflict = placed.some((p) => p.conflict !== "none");

  // SVG 尺寸
  const W = 360;
  const H = 24 + strings.length * 34;
  const padX = 36;
  const stringGap = 34;
  const fretRange = MAX_POSITION;
  const usableW = W - padX - 16;

  const posToX = (pos: number) => padX + (pos / fretRange) * usableW;
  // 弦 index 0 (最低弦) 畫在最下面
  const stringToY = (si: number) =>
    16 + (strings.length - 1 - si) * stringGap;

  const conflictColor = (c: PlacedNote["conflict"]) =>
    c === "none" ? "#34d399"        // 綠
      : c === "same-string" ? "#ef4444"  // 紅
      : c === "out-of-range" ? "#f59e0b" // 橘
      : "#ef4444";

  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg-secondary)",
      borderRadius: 6,
      border: "1px solid var(--border-light)",
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--fg-muted)",
        marginBottom: 6,
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}>
        <span>
          {t(`fingerboard.instrument.${instrument}`)}
          {t("fingerboard.titleSuffix")}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 400,
          color: hasConflict ? "#ef4444" : "#34d399",
        }}>
          {hasConflict
            ? t("fingerboard.conflictDetected")
            : t("fingerboard.playable")}
        </span>
      </div>

      <svg width={W} height={H} style={{ display: "block" }}>
        {/* 把位格線 (每 4 半音一條) */}
        {[4, 8, 12, 16, 20, 24].map((pos) => (
          <g key={pos}>
            <line
              x1={posToX(pos)}
              y1={8}
              x2={posToX(pos)}
              y2={H - 8}
              stroke={pos === COMFORTABLE_POSITION
                ? "var(--fg-tertiary)"
                : "var(--border-light)"}
              strokeWidth={pos === COMFORTABLE_POSITION ? 1.5 : 1}
              strokeDasharray={pos === COMFORTABLE_POSITION ? "none" : "2 3"}
            />
            <text
              x={posToX(pos)}
              y={H - 1}
              fontSize={8}
              fill="var(--fg-tertiary)"
              textAnchor="middle"
            >
              {pos === COMFORTABLE_POSITION
                ? t("fingerboard.comfortLimit")
                : pos}
            </text>
          </g>
        ))}

        {/* 弦 */}
        {strings.map((s, si) => {
          const y = stringToY(si);
          return (
            <g key={si}>
              <line
                x1={padX}
                y1={y}
                x2={W - 16}
                y2={y}
                stroke="var(--fg-tertiary)"
                strokeWidth={1 + si * 0.5}
              />
              <text
                x={padX - 8}
                y={y + 3}
                fontSize={10}
                fill="var(--fg-muted)"
                textAnchor="end"
                fontWeight={600}
              >
                {s.name}
              </text>
            </g>
          );
        })}

        {/* 音符按弦位置 */}
        {placed.map((p, i) => {
          if (p.stringIndex < 0) {
            // 超出指板 — 畫在最右側外
            return (
              <g key={i}>
                <circle
                  cx={W - 8}
                  cy={H / 2}
                  r={6}
                  fill="#f59e0b"
                />
                <title>
                  {t("fingerboard.noteOutOfRange", {
                    note: midiName(p.midi),
                  })}
                </title>
              </g>
            );
          }
          const x = posToX(p.position);
          const y = stringToY(p.stringIndex);
          const color = conflictColor(p.conflict);
          return (
            <g key={i}>
              {/* glow */}
              <circle cx={x} cy={y} r={9} fill={color} opacity={0.25} />
              <circle cx={x} cy={y} r={6} fill={color} />
              <text
                x={x}
                y={y - 11}
                fontSize={9}
                fill="var(--fg-primary)"
                textAnchor="middle"
                fontWeight={600}
              >
                {midiName(p.midi)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 衝突說明 */}
      {hasConflict && (
        <ul style={{
          margin: "4px 0 0",
          padding: "0 0 0 16px",
          fontSize: 11,
          color: "var(--fg-secondary)",
        }}>
          {placed.some((p) => p.conflict === "same-string") && (
            <li style={{ color: "#ef4444" }}>
              {t("fingerboard.conflictSameString")}
            </li>
          )}
          {placed.some((p) => p.conflict === "non-adjacent") && (
            <li style={{ color: "#ef4444" }}>
              {t("fingerboard.conflictNonAdjacent")}
            </li>
          )}
          {placed.some((p) => p.conflict === "out-of-range") && (
            <li style={{ color: "#f59e0b" }}>
              {t("fingerboard.conflictOutOfRange")}
            </li>
          )}
          {placed.some(
            (p) => p.conflict === "none" && p.position > COMFORTABLE_POSITION,
          ) && (
            <li style={{ color: "#f59e0b" }}>
              {t("fingerboard.conflictHighPosition")}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

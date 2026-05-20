/**
 * OnboardingWizard — 首次使用 3 步驟引導
 *
 * 流程:
 *   Step 1 — 從 5 個推薦範例選一首 (bach / mozart / corelli / ...)
 *   Step 2 — 選目標編制 (3 個常見預設)
 *   Step 3 — 確認 → 自動執行: 載入 corpus → 改編 → 切到 arrange mode
 *
 * 觸發條件: localStorage 沒 "score-arranger.onboarded" 旗標 + 沒有任何分頁打開.
 * 完成後寫旗標, 不再打擾.
 */

import { useState } from "react";

interface Props {
  onSkip: () => void;
  /** 完成時 callback — Toolbar 串接 import-from-corpus + arrange flow. */
  onComplete: (config: {
    corpusPath: string;
    ensemble: string;
    skillLevel: "amateur" | "intermediate" | "professional";
  }) => Promise<void>;
}

interface SampleScore {
  corpus: string;
  title: string;
  composer: string;
  description: string;
  defaultEnsemble: string;
  defaultSkill: "amateur" | "intermediate" | "professional";
}

const SAMPLES: SampleScore[] = [
  {
    corpus: "corpus:bach/bwv66.6",
    title: "BWV 66.6 (Chorale)",
    composer: "J. S. Bach",
    description: "SATB 四部和聲, 短小完整, 改成弦四最直觀.",
    defaultEnsemble: "string_quartet",
    defaultSkill: "intermediate",
  },
  {
    corpus: "corpus:corelli/opus3no1/1grave",
    title: "Op.3 No.1 'Grave'",
    composer: "Corelli",
    description: "巴洛克三重奏鳴曲. 改成 baroque_trio_sonata 自動加大鍵琴 continuo.",
    defaultEnsemble: "baroque_trio_sonata",
    defaultSkill: "professional",
  },
  {
    corpus: "corpus:mozart/k155/movement1",
    title: "K.155 第一樂章",
    composer: "Mozart",
    description: "弦樂四重奏小品. 改編成小提琴+鋼琴或大鍵琴獨奏練手感.",
    defaultEnsemble: "violin_piano",
    defaultSkill: "intermediate",
  },
  {
    corpus: "corpus:beethoven/opus18no1/movement1",
    title: "Op.18 No.1 第一樂章",
    composer: "Beethoven",
    description: "古典弦四經典. 試 piano_solo 或木管五重奏看不同編制風格.",
    defaultEnsemble: "piano_solo",
    defaultSkill: "professional",
  },
  {
    corpus: "corpus:haydn/opus74no1/movement1",
    title: "Op.74 No.1 第一樂章",
    composer: "Haydn",
    description: "海頓晚期弦四. 對比 Mozart / Beethoven 風格.",
    defaultEnsemble: "string_quartet",
    defaultSkill: "professional",
  },
];

const ENSEMBLE_DISPLAY: Record<string, string> = {
  violin_piano: "小提琴 + 鋼琴",
  string_quartet: "弦樂四重奏",
  piano_solo: "鋼琴獨奏",
  harpsichord_solo: "大鍵琴獨奏",
  violin_harpsichord: "小提琴 + 大鍵琴",
  baroque_trio_sonata: "巴洛克三重奏鳴曲",
  woodwind_quintet: "木管五重奏",
  brass_quintet: "銅管五重奏",
};

export function OnboardingWizard({ onSkip, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSample, setSelectedSample] = useState<SampleScore>(SAMPLES[0]);
  const [ensemble, setEnsemble] = useState<string>(SAMPLES[0].defaultEnsemble);
  const [skillLevel, setSkillLevel] = useState<
    "amateur" | "intermediate" | "professional"
  >(SAMPLES[0].defaultSkill);
  const [running, setRunning] = useState(false);

  const handleNext = () => {
    if (step === 1) {
      setEnsemble(selectedSample.defaultEnsemble);
      setSkillLevel(selectedSample.defaultSkill);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => setStep((s) => (s > 1 ? (s - 1) as 1 | 2 : 1));

  const handleStart = async () => {
    setRunning(true);
    try {
      await onComplete({
        corpusPath: selectedSample.corpus,
        ensemble,
        skillLevel,
      });
      localStorage.setItem("score-arranger.onboarded", "1");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--bg-panel)",
          color: "var(--fg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 28,
          maxWidth: 640,
          width: "92%",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>
            歡迎使用 Score Arranger
          </h2>
          <button
            onClick={onSkip}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fg-muted)",
              cursor: "pointer",
              fontSize: 12,
            }}
            title="跳過引導, 之後不再顯示"
          >
            跳過
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
          3 步驟讓你看到改編結果. 步驟 {step} / 3
        </div>

        {/* Progress dots */}
        <div style={{
          display: "flex", gap: 6, margin: "12px 0 20px 0",
        }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: s <= step
                  ? "var(--accent)"
                  : "var(--border-light)",
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <Step1
            samples={SAMPLES}
            selected={selectedSample}
            onSelect={(s) => {
              setSelectedSample(s);
              setEnsemble(s.defaultEnsemble);
              setSkillLevel(s.defaultSkill);
            }}
          />
        )}
        {step === 2 && (
          <Step2
            ensemble={ensemble}
            onChange={setEnsemble}
            skillLevel={skillLevel}
            onSkillChange={setSkillLevel}
          />
        )}
        {step === 3 && (
          <Step3
            sample={selectedSample}
            ensemble={ensemble}
            skillLevel={skillLevel}
          />
        )}

        <div style={{
          marginTop: 24,
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
        }}>
          <button
            onClick={handleBack}
            disabled={step === 1 || running}
            style={{
              ...btnSecondary,
              opacity: step === 1 ? 0.4 : 1,
            }}
          >
            ← 上一步
          </button>
          {step < 3
            ? (
              <button onClick={handleNext} style={btnPrimary}>
                下一步 →
              </button>
            )
            : (
              <button
                onClick={handleStart}
                disabled={running}
                style={btnPrimary}
              >
                {running ? "改編中..." : "開始改編"}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

function Step1(
  { samples, selected, onSelect }: {
    samples: SampleScore[];
    selected: SampleScore;
    onSelect: (s: SampleScore) => void;
  },
) {
  return (
    <>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>
        步驟 1 / 選一首範例樂譜
      </h3>
      <div style={{
        fontSize: 12, color: "var(--fg-muted)", marginBottom: 12,
      }}>
        以下 5 首都已內建, 不需下載. 之後也可以從工具列「匯入」載入自己的譜.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {samples.map((s) => (
          <button
            key={s.corpus}
            onClick={() => onSelect(s)}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              background: selected.corpus === s.corpus
                ? "var(--bg-hover, rgba(77,140,255,0.12))"
                : "var(--bg-secondary)",
              border: selected.corpus === s.corpus
                ? "1.5px solid var(--accent)"
                : "1px solid var(--border-light)",
              borderRadius: 6,
              cursor: "pointer",
              color: "var(--fg-primary)",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {s.composer} — {s.title}
            </div>
            <div style={{
              fontSize: 11, color: "var(--fg-muted)", marginTop: 2,
            }}>
              {s.description}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function Step2(
  { ensemble, onChange, skillLevel, onSkillChange }: {
    ensemble: string;
    onChange: (v: string) => void;
    skillLevel: "amateur" | "intermediate" | "professional";
    onSkillChange: (v: "amateur" | "intermediate" | "professional") => void;
  },
) {
  return (
    <>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>
        步驟 2 / 選目標編制
      </h3>
      <div style={{
        fontSize: 12, color: "var(--fg-muted)", marginBottom: 12,
      }}>
        改編引擎會把 source 各聲部分配到你選的編制. 若編制人數比 source 多,
        會自動補完內聲部.
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
      }}>
        {Object.entries(ENSEMBLE_DISPLAY).map(([key, label]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: "10px 12px",
              background: ensemble === key
                ? "var(--bg-hover, rgba(77,140,255,0.12))"
                : "var(--bg-secondary)",
              border: ensemble === key
                ? "1.5px solid var(--accent)"
                : "1px solid var(--border-light)",
              borderRadius: 6,
              cursor: "pointer",
              color: "var(--fg-primary)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>
        演奏者技術水平
      </h3>
      <div style={{ display: "flex", gap: 6 }}>
        {(
          [
            ["amateur", "業餘", "簡化和弦, 避難段"],
            ["intermediate", "中級", "中庸"],
            ["professional", "專業", "完整呈現"],
          ] as const
        ).map(([key, label, hint]) => (
          <button
            key={key}
            onClick={() => onSkillChange(key)}
            style={{
              flex: 1,
              padding: "10px 8px",
              background: skillLevel === key
                ? "var(--bg-hover, rgba(77,140,255,0.12))"
                : "var(--bg-secondary)",
              border: skillLevel === key
                ? "1.5px solid var(--accent)"
                : "1px solid var(--border-light)",
              borderRadius: 6,
              cursor: "pointer",
              color: "var(--fg-primary)",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 10, color: "var(--fg-muted)" }}>
              {hint}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function Step3(
  { sample, ensemble, skillLevel }: {
    sample: SampleScore;
    ensemble: string;
    skillLevel: "amateur" | "intermediate" | "professional";
  },
) {
  return (
    <>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>
        步驟 3 / 開始
      </h3>
      <div style={{
        fontSize: 12, color: "var(--fg-muted)", marginBottom: 16,
      }}>
        按「開始改編」, 系統會載入樂譜並執行改編. 約 5-10 秒看到結果.
      </div>

      <div style={{
        padding: 16,
        background: "var(--bg-secondary)",
        borderRadius: 6,
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        <Row label="樂譜" value={`${sample.composer} — ${sample.title}`} />
        <Row label="目標編制" value={ENSEMBLE_DISPLAY[ensemble] ?? ensemble} />
        <Row
          label="技術水平"
          value={
            { amateur: "業餘", intermediate: "中級", professional: "專業" }[
              skillLevel
            ]
          }
        />
      </div>

      <div style={{
        marginTop: 16,
        fontSize: 11,
        color: "var(--fg-muted)",
        textAlign: "center",
      }}>
        完成後可以在工具列換不同編制 / 風格 preset, 隨時微調.
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
      <span style={{
        color: "var(--fg-muted)",
        width: 80,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "8px 18px",
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "var(--accent-fg)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 18px",
  border: "1px solid var(--button-border)",
  background: "var(--button-bg)",
  color: "var(--button-fg)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 14,
};

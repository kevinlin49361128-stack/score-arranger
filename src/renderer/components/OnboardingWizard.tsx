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

import { t, useLocale } from "../utils/i18n";

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
  /** i18n key — 樂曲標題。 */
  titleKey: string;
  composer: string;
  /** i18n key — 範例描述。 */
  descKey: string;
  defaultEnsemble: string;
  defaultSkill: "amateur" | "intermediate" | "professional";
}

const SAMPLES: SampleScore[] = [
  {
    corpus: "corpus:bach/bwv66.6",
    titleKey: "onboard.sample.bach.title",
    composer: "J. S. Bach",
    descKey: "onboard.sample.bach.desc",
    defaultEnsemble: "string_quartet",
    defaultSkill: "intermediate",
  },
  {
    corpus: "corpus:corelli/opus3no1/1grave",
    titleKey: "onboard.sample.corelli.title",
    composer: "Corelli",
    descKey: "onboard.sample.corelli.desc",
    defaultEnsemble: "baroque_trio_sonata",
    defaultSkill: "professional",
  },
  {
    corpus: "corpus:mozart/k155/movement1",
    titleKey: "onboard.sample.mozart.title",
    composer: "Mozart",
    descKey: "onboard.sample.mozart.desc",
    defaultEnsemble: "violin_piano",
    defaultSkill: "intermediate",
  },
  {
    corpus: "corpus:beethoven/opus18no1/movement1",
    titleKey: "onboard.sample.beethoven.title",
    composer: "Beethoven",
    descKey: "onboard.sample.beethoven.desc",
    defaultEnsemble: "piano_solo",
    defaultSkill: "professional",
  },
  {
    corpus: "corpus:haydn/opus74no1/movement1",
    titleKey: "onboard.sample.haydn.title",
    composer: "Haydn",
    descKey: "onboard.sample.haydn.desc",
    defaultEnsemble: "string_quartet",
    defaultSkill: "professional",
  },
];

/** ensemble id → i18n key。 */
const ENSEMBLE_LABEL_KEYS: Record<string, string> = {
  violin_piano: "onboard.ensemble.violinPiano",
  string_quartet: "onboard.ensemble.stringQuartet",
  piano_solo: "onboard.ensemble.pianoSolo",
  harpsichord_solo: "onboard.ensemble.harpsichordSolo",
  violin_harpsichord: "onboard.ensemble.violinHarpsichord",
  baroque_trio_sonata: "onboard.ensemble.baroqueTrioSonata",
  woodwind_quintet: "onboard.ensemble.woodwindQuintet",
  brass_quintet: "onboard.ensemble.brassQuintet",
  guitar_solo: "onboard.ensemble.guitarSolo",
  lute_solo: "onboard.ensemble.luteSolo",
  harp_solo: "onboard.ensemble.harpSolo",
  flute_guitar: "onboard.ensemble.fluteGuitar",
};

export function OnboardingWizard({ onSkip, onComplete }: Props) {
  useLocale();
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
            {t("onboard.title")}
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
            title={t("onboard.skip.title")}
          >
            {t("onboard.skip")}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
          {t("onboard.progress", { step })}
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
            {t("onboard.back")}
          </button>
          {step < 3
            ? (
              <button onClick={handleNext} style={btnPrimary}>
                {t("onboard.next")}
              </button>
            )
            : (
              <button
                onClick={handleStart}
                disabled={running}
                style={btnPrimary}
              >
                {running ? t("onboard.arranging") : t("onboard.start")}
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
  useLocale();
  return (
    <>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>
        {t("onboard.step1.heading")}
      </h3>
      <div style={{
        fontSize: 12, color: "var(--fg-muted)", marginBottom: 12,
      }}>
        {t("onboard.step1.hint")}
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
              {s.composer} — {t(s.titleKey)}
            </div>
            <div style={{
              fontSize: 11, color: "var(--fg-muted)", marginTop: 2,
            }}>
              {t(s.descKey)}
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
  useLocale();
  return (
    <>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>
        {t("onboard.step2.heading")}
      </h3>
      <div style={{
        fontSize: 12, color: "var(--fg-muted)", marginBottom: 12,
      }}>
        {t("onboard.step2.hint")}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
      }}>
        {Object.entries(ENSEMBLE_LABEL_KEYS).map(([key, labelKey]) => (
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
            {t(labelKey)}
          </button>
        ))}
      </div>

      <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>
        {t("onboard.step2.skillHeading")}
      </h3>
      <div style={{ display: "flex", gap: 6 }}>
        {(
          [
            ["amateur", "onboard.skill.amateur", "onboard.skill.amateur.hint"],
            [
              "intermediate",
              "onboard.skill.intermediate",
              "onboard.skill.intermediate.hint",
            ],
            [
              "professional",
              "onboard.skill.professional",
              "onboard.skill.professional.hint",
            ],
          ] as const
        ).map(([key, labelKey, hintKey]) => (
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
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {t(labelKey)}
            </div>
            <div style={{ fontSize: 10, color: "var(--fg-muted)" }}>
              {t(hintKey)}
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
  useLocale();
  const skillKey: Record<typeof skillLevel, string> = {
    amateur: "onboard.skill.amateur",
    intermediate: "onboard.skill.intermediate",
    professional: "onboard.skill.professional",
  };
  return (
    <>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>
        {t("onboard.step3.heading")}
      </h3>
      <div style={{
        fontSize: 12, color: "var(--fg-muted)", marginBottom: 16,
      }}>
        {t("onboard.step3.hint")}
      </div>

      <div style={{
        padding: 16,
        background: "var(--bg-secondary)",
        borderRadius: 6,
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        <Row
          label={t("onboard.step3.scoreLabel")}
          value={`${sample.composer} — ${t(sample.titleKey)}`}
        />
        <Row
          label={t("onboard.step3.ensembleLabel")}
          value={
            ENSEMBLE_LABEL_KEYS[ensemble]
              ? t(ENSEMBLE_LABEL_KEYS[ensemble])
              : ensemble
          }
        />
        <Row
          label={t("onboard.step3.skillLabel")}
          value={t(skillKey[skillLevel])}
        />
      </div>

      <div style={{
        marginTop: 16,
        fontSize: 11,
        color: "var(--fg-muted)",
        textAlign: "center",
      }}>
        {t("onboard.step3.footnote")}
      </div>

      {/* 0.1.46 D5: LLM 改譜功能 onboarding 提示.
          改編完之後立刻告訴使用者「⌘/ 用自然語言修改」這個 power feature,
          避免新功能被埋沒在 toolbar 角落. */}
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        background: "linear-gradient(135deg, "
          + "rgba(176, 138, 69, 0.12), rgba(196, 119, 138, 0.08))",
        border: "1px solid rgba(176, 138, 69, 0.25)",
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.5,
        color: "var(--fg-secondary)",
      }}>
        <strong style={{ color: "var(--fg-primary)" }}>
          {t("onboard.step3.llmTip.title")}
        </strong>
        <br />
        {t("onboard.step3.llmTip.body")}
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

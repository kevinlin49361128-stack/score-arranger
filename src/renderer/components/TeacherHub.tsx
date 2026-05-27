/**
 * TeacherHub — 0.1.44 教師中心 (歸 1 hub).
 *
 * 取代散落 4 個工具列按鈕 (👥 學生 / 練習 / 麥克風 / 加難度) 用單一入口統一.
 *
 * Tab 結構:
 * - 👥 學生: 內嵌 StudentsPanel (CRUD)
 * - 🎚️ 難度: launch DifficultyBoostDialog
 * - 🎵 慢速練習: launch PracticePanel
 * - 🎤 麥克風: launch MicPracticePanel
 *
 * 設計取捨:
 * - Students 內嵌, 因為 CRUD 簡單 + 老師最常用
 * - Difficulty / Practice / Mic launch 出獨立 dialog, 因為這些功能本身就是
 *   針對「當前 arrangement」的工具, 維持原 modal 不重寫節省成本
 * - 曲目庫 (RepertoireDialog) 不放進來 — 純改編使用者也用, 保留工具列獨立按鈕
 */

import { useState } from "react";

import { useSessionStore } from "../stores/sessionStore";
import { t, useLocale } from "../utils/i18n";
import { DifficultyBoostDialog } from "./DifficultyBoostDialog";
import { MicPracticePanel } from "./MicPracticePanel";
import { PracticePanel } from "./PracticePanel";
import { StudentsPanel } from "./StudentsDialog";

interface Props {
  onClose: () => void;
}

type Tab = "students" | "difficulty" | "practice" | "mic";

const TAB_META: Record<Tab, { icon: string; key: string }> = {
  students: { icon: "👥", key: "teacherHub.tab.students" },
  difficulty: { icon: "🎚️", key: "teacherHub.tab.difficulty" },
  practice: { icon: "🎵", key: "teacherHub.tab.practice" },
  mic: { icon: "🎤", key: "teacherHub.tab.mic" },
};

export function TeacherHub({ onClose }: Props) {
  useLocale();
  const [tab, setTab] = useState<Tab>("students");
  const [launched, setLaunched] = useState<"difficulty" | "practice" | "mic" | null>(null);
  const { arrangement } = useSessionStore();

  // launched dialog 開著時, hub 自己淡背景
  if (launched === "difficulty") {
    return (
      <DifficultyBoostDialog onClose={() => setLaunched(null)} />
    );
  }
  if (launched === "practice") {
    return (
      <PracticePanel onClose={() => setLaunched(null)} />
    );
  }
  if (launched === "mic") {
    return (
      <MicPracticePanel onClose={() => setLaunched(null)} />
    );
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 110, display: "flex", alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720, maxWidth: "92vw", height: "78vh",
          background: "var(--bg-panel)",
          borderRadius: 8, border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 12px 48px rgba(0,0,0,0.4)",
        }}
      >
        <header style={{
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <strong style={{ flex: 1, fontSize: 15 }}>
            🎓 {t("teacherHub.title")}
          </strong>
          <button
            onClick={onClose}
            style={{
              padding: "4px 12px", fontSize: 12,
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)", borderRadius: 4,
              color: "var(--fg-primary)", cursor: "pointer",
            }}
          >
            {t("teacherHub.close")}
          </button>
        </header>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Tab sidebar */}
          <nav style={{
            width: 160, borderRight: "1px solid var(--border)",
            background: "var(--bg-secondary)", flexShrink: 0,
            overflow: "auto",
          }}>
            {(Object.keys(TAB_META) as Tab[]).map((k) => {
              const meta = TAB_META[k];
              const needsArrangement = k === "difficulty" || k === "practice";
              const isLocked = needsArrangement && !arrangement;
              // 0.1.46 D3: 允許 click 鎖定 tab — 切到該 tab 後顯示
              // 「需先改編」說明卡, 而不是 disabled 完全擋掉.
              return (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  title={isLocked ? t("teacherHub.needsArrangement") : ""}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    width: "100%",
                    padding: "12px 14px", border: "none",
                    background: tab === k ? "var(--accent)" : "transparent",
                    color: tab === k ? "var(--accent-fg)"
                      : "var(--fg-primary)",
                    cursor: "pointer",
                    fontSize: 13, textAlign: "left",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <span>{meta.icon} {t(meta.key)}</span>
                  {isLocked && (
                    <span
                      title={t("teacherHub.needsArrangement")}
                      style={{
                        marginLeft: "auto", fontSize: 11,
                        color: tab === k ? "var(--accent-fg)"
                          : "var(--fg-tertiary)",
                      }}
                    >🔒</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Tab content */}
          <main style={{
            flex: 1, overflow: "auto",
            display: "flex", flexDirection: "column",
          }}>
            {tab === "students" && <StudentsPanel />}
            {tab === "difficulty" && (
              arrangement
                ? (
                  <LaunchPanel
                    titleKey="teacherHub.difficulty.title"
                    descKey="teacherHub.difficulty.desc"
                    buttonKey="teacherHub.difficulty.open"
                    onLaunch={() => setLaunched("difficulty")}
                  />
                )
                : <NeedsArrangementCard onClose={onClose} />
            )}
            {tab === "practice" && (
              arrangement
                ? (
                  <LaunchPanel
                    titleKey="teacherHub.practice.title"
                    descKey="teacherHub.practice.desc"
                    buttonKey="teacherHub.practice.open"
                    onLaunch={() => setLaunched("practice")}
                  />
                )
                : <NeedsArrangementCard onClose={onClose} />
            )}
            {tab === "mic" && (
              <LaunchPanel
                titleKey="teacherHub.mic.title"
                descKey="teacherHub.mic.desc"
                buttonKey="teacherHub.mic.open"
                onLaunch={() => setLaunched("mic")}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * LaunchPanel — 統一的「開啟工具」介紹 + 按鈕,
 * 給 difficulty / practice / mic 用 (這些工具仍是獨立 dialog).
 */
function LaunchPanel({
  titleKey, descKey, buttonKey, onLaunch,
}: {
  titleKey: string;
  descKey: string;
  buttonKey: string;
  onLaunch: () => void;
}) {
  useLocale();
  return (
    <div style={{
      padding: 24, display: "flex", flexDirection: "column",
      gap: 14, alignItems: "flex-start",
    }}>
      <h2 style={{
        fontSize: 15, fontWeight: 600, margin: 0,
        color: "var(--fg-primary)",
      }}>
        {t(titleKey)}
      </h2>
      <p style={{
        fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.7,
        margin: 0, maxWidth: 460,
      }}>
        {t(descKey)}
      </p>
      <button
        onClick={onLaunch}
        style={{
          padding: "8px 18px", fontSize: 13, fontWeight: 600,
          background: "var(--accent)", color: "var(--accent-fg)",
          border: "none", borderRadius: 6, cursor: "pointer",
        }}
      >
        {t(buttonKey)} →
      </button>
    </div>
  );
}

/**
 * 0.1.46 D3 — 沒改編譜時 difficulty / practice tab 顯示這張卡片.
 * 替使用者交代為何鎖住, 給可操作路徑 (關 Hub → 工具列開譜 → 改編).
 */
function NeedsArrangementCard({ onClose }: { onClose: () => void }) {
  useLocale();
  const goToToolbar = () => {
    onClose();
    // 沒源檔: 開「試用範例」(RepertoireDialog). 有源檔: 不能直接觸發 arrange
    // (需 ensemble pick), 故引導使用者注意工具列.
    window.dispatchEvent(new CustomEvent("sa:request-open-repertoire"));
  };
  return (
    <div style={{
      padding: 32, display: "flex", flexDirection: "column",
      gap: 16, alignItems: "center", textAlign: "center",
      maxWidth: 480, margin: "40px auto",
    }}>
      <div style={{ fontSize: 48, opacity: 0.6 }}>🎼</div>
      <h2 style={{
        fontSize: 16, fontWeight: 600, margin: 0,
        color: "var(--fg-primary)",
      }}>
        {t("teacherHub.locked.title")}
      </h2>
      <p style={{
        fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.7,
        margin: 0,
      }}>
        {t("teacherHub.locked.body")}
      </p>
      <ol style={{
        textAlign: "left", fontSize: 12, color: "var(--fg-secondary)",
        lineHeight: 1.8, paddingLeft: 18, margin: 0,
      }}>
        <li>{t("teacherHub.locked.step1")}</li>
        <li>{t("teacherHub.locked.step2")}</li>
        <li>{t("teacherHub.locked.step3")}</li>
      </ol>
      <button
        onClick={goToToolbar}
        style={{
          marginTop: 8,
          padding: "9px 22px", fontSize: 13, fontWeight: 600,
          background: "var(--accent)", color: "var(--accent-fg)",
          border: "none", borderRadius: 6, cursor: "pointer",
        }}
      >
        {t("teacherHub.locked.cta")}
      </button>
    </div>
  );
}

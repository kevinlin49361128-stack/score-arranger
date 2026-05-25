/**
 * AboutDialog — 關於 / 法律聲明 / 致謝
 *
 * 從 Toolbar 的 ⚙ menu 開啟。內容是 NOTICE.md 的摘要 + 連結。
 *
 * Tab 結構: 概述 | 第三方授權 | 音訊樣本 | 樂譜版權 | AI / 隱私 | 商標
 */

import { Fragment, useState } from "react";

import { t, useLocale } from "../utils/i18n";

interface AboutDialogProps {
  onClose: () => void;
}

type Section =
  | "overview"
  | "licenses"
  | "samples"
  | "corpus"
  | "ai-privacy"
  | "disclaimer"
  | "trademarks";

const SECTION_LABEL_KEYS: Record<Section, string> = {
  overview: "about.tab.overview",
  licenses: "about.tab.licenses",
  samples: "about.tab.samples",
  corpus: "about.tab.corpus",
  "ai-privacy": "about.tab.aiPrivacy",
  disclaimer: "about.tab.disclaimer",
  trademarks: "about.tab.trademarks",
};

export function AboutDialog({ onClose }: AboutDialogProps) {
  useLocale();
  const [section, setSection] = useState<Section>("overview");

  return (
    <div
      className="fx-modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="fx-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720,
          maxWidth: "90vw",
          height: "80vh",
          background: "var(--bg-panel)",
          borderRadius: 8,
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 12px 48px rgba(0,0,0,0.4)",
        }}
      >
        <header
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <strong style={{ fontSize: 16, flex: 1 }}>
            Score Arranger
          </strong>
          <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
            v0.1.40
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "4px 12px",
              border: "1px solid var(--button-border)",
              background: "var(--button-bg)",
              color: "var(--button-fg)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {t("about.close")}
          </button>
        </header>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Tab list */}
          <nav
            style={{
              width: 140,
              borderRight: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              flexShrink: 0,
              overflow: "auto",
            }}
          >
            {(Object.keys(SECTION_LABEL_KEYS) as Section[]).map((k) => (
              <button
                key={k}
                onClick={() => setSection(k)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  border: "none",
                  background: section === k
                    ? "var(--accent)"
                    : "transparent",
                  color: section === k
                    ? "var(--accent-fg)"
                    : "var(--fg-primary)",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                {t(SECTION_LABEL_KEYS[k])}
              </button>
            ))}
          </nav>

          {/* Content */}
          <main
            style={{
              flex: 1,
              padding: 20,
              overflow: "auto",
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--fg-secondary)",
            }}
          >
            {section === "overview" && <Overview />}
            {section === "licenses" && <Licenses />}
            {section === "samples" && <Samples />}
            {section === "corpus" && <Corpus />}
            {section === "ai-privacy" && <AIPrivacy />}
            {section === "disclaimer" && <Disclaimer />}
            {section === "trademarks" && <Trademarks />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sections
// ============================================================================

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{
    fontSize: 14,
    fontWeight: 600,
    color: "var(--fg-primary)",
    margin: "16px 0 8px",
  }}>
    {children}
  </h2>
);

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code style={{
    background: "var(--code-bg)",
    padding: "1px 6px",
    borderRadius: 3,
    fontSize: 11,
  }}>
    {children}
  </code>
);

const Pill: React.FC<{ children: React.ReactNode; color?: string }> = (
  { children, color = "var(--accent)" },
) => (
  <span style={{
    display: "inline-block",
    padding: "1px 7px",
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 3,
    background: `${color}22`,
    color,
    letterSpacing: 0.3,
  }}>
    {children}
  </span>
);

/**
 * 翻譯一段含 {token} 佔位的字串, 把每個 token 換成對應的 React 節點
 * (如 <strong>、<Code>)。純文字段落原樣保留。
 */
function interpolate(
  key: string,
  nodes: Record<string, React.ReactNode>,
): React.ReactNode[] {
  const tpl = t(key);
  const parts = tpl.split(/(\{\w+\})/g);
  return parts.map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    if (m && m[1] in nodes) {
      return <Fragment key={i}>{nodes[m[1]]}</Fragment>;
    }
    return part;
  });
}

function Overview() {
  useLocale();
  return (
    <div>
      <p>
        <strong>Score Arranger</strong> {t("about.overview.intro")}
      </p>
      <p>
        {t("about.overview.positioningLabel")}
        <strong>{t("about.overview.positioningTerm")}</strong>
        {t("about.overview.positioningRest")}
      </p>
      <H2>{t("about.overview.licenseHeading")}</H2>
      <p>
        {interpolate("about.overview.licenseBody", {
          openSource: (
            <strong>{t("about.overview.licenseOpenSource")}</strong>
          ),
          gpl: <strong>GNU General Public License v3.0 (GPL-3.0-only)</strong>,
        })}
      </p>
      <p style={{
        marginTop: 8, fontSize: 12, color: "var(--fg-tertiary)",
      }}>
        {t("about.overview.legalDocsHint")}
        {" "}
        <Code>LICENSE</Code>, <Code>NOTICE.md</Code>,
        {" "}<Code>THIRD_PARTY_LICENSES.md</Code>, <Code>PRIVACY.md</Code>,
        {" "}<Code>DISCLAIMER.md</Code>, <Code>SOURCE.md</Code>,
        {" "}<Code>CONTRIBUTING.md</Code>, <Code>SECURITY.md</Code>
      </p>
      <H2>{t("about.overview.creditsHeading")}</H2>
      <p>
        {t("about.overview.creditsIntro")}
      </p>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          <strong>music21</strong> (BSD) — {t("about.overview.credit.music21")}
        </li>
        <li>
          <strong>OpenSheetMusicDisplay</strong> (BSD)
          {" "}— {t("about.overview.credit.osmd")}
        </li>
        <li>
          <strong>Verovio</strong> (<Pill color="#f59e0b">LGPL-3.0</Pill>)
          {" "}— {t("about.overview.credit.verovio")}
        </li>
        <li>
          <strong>Tone.js</strong> (MIT) — {t("about.overview.credit.tone")}
        </li>
        <li>
          <strong>Salamander Grand Piano</strong>
          {" "}(<Pill color="#3b82f6">CC-BY 3.0</Pill>) by Alexander Holm
          {" "}— {t("about.overview.credit.salamander")}
        </li>
        <li>
          <strong>Anthropic Claude API</strong>
          {" "}— {t("about.overview.credit.claude")}
        </li>
      </ul>
      <p style={{ marginTop: 12, color: "var(--fg-tertiary)" }}>
        {interpolate("about.overview.creditsFootnote", {
          notice: <Code>NOTICE.md</Code>,
        })}
      </p>

      {/*
        贊助區塊 — 完全自願, 不影響任何功能可用性. LMS 批准產品後把 href
        改成 product 直連 (目前指向 store 首頁也合法可用).
        TODO: LMS 批准後改成 https://kevin-lin.lemonsqueezy.com/buy/<UUID>
      */}
      <H2>{t("about.overview.supportHeading")}</H2>
      <p>{t("about.overview.supportIntro")}</p>
      <p style={{ marginTop: 8 }}>
        <a
          href="https://kevin-lin.lemonsqueezy.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "var(--accent)",
            color: "var(--accent-fg)",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          ☕ {t("about.overview.supportCta")}
        </a>
      </p>
      <p style={{
        marginTop: 8, color: "var(--fg-tertiary)", fontSize: 12,
      }}>
        {t("about.overview.supportNote")}
      </p>

      <H2>{t("about.overview.versionHeading")}</H2>
      <p>{t("about.overview.versionLine")}</p>
    </div>
  );
}

function Licenses() {
  useLocale();
  const LIBS: [string, string, string][] = [
    ["music21", "BSD-3-Clause", "about.licenses.role.music21"],
    ["OpenSheetMusicDisplay", "BSD-3-Clause", "about.licenses.role.osmd"],
    ["Verovio", "LGPL-3.0-or-later", "about.licenses.role.verovio"],
    ["Tone.js", "MIT", "about.licenses.role.tone"],
    ["@tonejs/midi", "MIT", "about.licenses.role.tonejsMidi"],
    ["jsPDF", "MIT", "about.licenses.role.jspdf"],
    ["React", "MIT", "about.licenses.role.react"],
    ["Zustand", "MIT", "about.licenses.role.zustand"],
    ["Electron", "MIT", "about.licenses.role.electron"],
    ["MCP SDK", "MIT", "about.licenses.role.mcpSdk"],
  ];
  return (
    <div>
      <p>{t("about.licenses.intro")}</p>
      <table style={{
        width: "100%",
        fontSize: 12,
        borderCollapse: "collapse",
        marginTop: 8,
      }}>
        <thead>
          <tr style={{ background: "var(--bg-tertiary)" }}>
            <th style={cellStyle}>{t("about.licenses.col.component")}</th>
            <th style={cellStyle}>{t("about.licenses.col.license")}</th>
            <th style={cellStyle}>{t("about.licenses.col.role")}</th>
          </tr>
        </thead>
        <tbody>
          {LIBS.map(([name, license, roleKey]) => (
            <tr key={name} style={{ borderBottom: "1px solid var(--border-light)" }}>
              <td style={cellStyle}><strong>{name}</strong></td>
              <td style={cellStyle}>
                {license.includes("LGPL")
                  ? <Pill color="#f59e0b">{license}</Pill>
                  : <span style={{ color: "var(--fg-muted)" }}>{license}</span>}
              </td>
              <td style={cellStyle}>{t(roleKey)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H2>{t("about.licenses.verovioHeading")}</H2>
      <p>{t("about.licenses.verovioIntro")}</p>
      <ol style={{ paddingLeft: 18 }}>
        <li>
          <strong>{t("about.licenses.verovioReplaceTerm")}</strong>
          {t("about.licenses.verovioReplaceBody")}
        </li>
        <li>
          <strong>{t("about.licenses.verovioSourceTerm")}</strong>
          {interpolate("about.licenses.verovioSourceBody", {
            repo: <Code>github.com/rism-digital/verovio</Code>,
          })}
        </li>
        <li>
          <strong>{t("about.licenses.verovioNoRestrictTerm")}</strong>
          {t("about.licenses.verovioNoRestrictBody")}
        </li>
      </ol>
    </div>
  );
}

function Samples() {
  useLocale();
  return (
    <div>
      <p>
        {interpolate("about.samples.intro", {
          notBundled: <strong>{t("about.samples.notBundled")}</strong>,
        })}
      </p>
      <H2>Salamander Grand Piano</H2>
      <p>
        {t("about.samples.licenseLabel")}
        <Pill color="#3b82f6">CC-BY 3.0</Pill>{" "}
        — © Alexander Holm
      </p>
      <p>
        {t("about.samples.sourceLabel")}
        <Code>tonejs.github.io/audio/salamander/</Code>
      </p>
      <p style={{ color: "var(--fg-muted)" }}>
        {t("about.samples.salamanderNote")}
      </p>
      <H2>tonejs-instruments</H2>
      <p>
        {t("about.samples.sourceLabel")}
        <Code>github.com/nbrosowsky/tonejs-instruments</Code>
        {" "}— © Nicholas Brosowsky et al.
      </p>
      <p style={{ color: "var(--fg-muted)" }}>
        {t("about.samples.tonejsNote")}
      </p>
    </div>
  );
}

function Corpus() {
  useLocale();
  return (
    <div>
      <p>{t("about.corpus.intro")}</p>
      <H2>{t("about.corpus.worksHeading")}</H2>
      <p>
        {interpolate("about.corpus.worksBody", {
          publicDomain: <strong>{t("about.corpus.publicDomain")}</strong>,
        })}
      </p>
      <H2>{t("about.corpus.encodingHeading")}</H2>
      <p style={{ color: "var(--fg-muted)" }}>
        {t("about.corpus.encodingBody")}
      </p>
      <blockquote style={{
        margin: "8px 0",
        padding: "8px 12px",
        borderLeft: "3px solid var(--accent)",
        background: "var(--bg-tertiary)",
        fontSize: 12,
        color: "var(--fg-muted)",
      }}>
        {t("about.corpus.quote")}
      </blockquote>
      <p>
        <strong>{t("about.corpus.adviceTerm")}</strong>
        {interpolate("about.corpus.adviceBody", {
          xml: <Code>.xml</Code>,
        })}
      </p>
    </div>
  );
}

function AIPrivacy() {
  useLocale();
  return (
    <div>
      <H2>{t("about.aiPrivacy.aiHeading")}</H2>
      <p>{t("about.aiPrivacy.aiIntro")}</p>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          <strong>{t("about.aiPrivacy.apiKeyTerm")}</strong>
          {interpolate("about.aiPrivacy.apiKeyBody", {
            envVar: <Code>ANTHROPIC_API_KEY</Code>,
          })}
        </li>
        <li>
          <strong>{t("about.aiPrivacy.sentDataTerm")}</strong>
          {t("about.aiPrivacy.sentDataBody")}
        </li>
        <li>
          <strong>{t("about.aiPrivacy.termsTerm")}</strong>
          {t("about.aiPrivacy.termsBody")}
        </li>
        <li>
          <strong>{t("about.aiPrivacy.disableTerm")}</strong>
          {interpolate("about.aiPrivacy.disableBody", {
            envVar: <Code>ANTHROPIC_API_KEY</Code>,
          })}
        </li>
      </ul>

      <H2>{t("about.aiPrivacy.privacyHeading")}</H2>
      <p>
        {interpolate("about.aiPrivacy.willNotIntro", {
          willNot: <strong>{t("about.aiPrivacy.willNot")}</strong>,
        })}
      </p>
      <ul style={{ paddingLeft: 18 }}>
        <li>{t("about.aiPrivacy.willNot.telemetry")}</li>
        <li>{t("about.aiPrivacy.willNot.upload")}</li>
        <li>{t("about.aiPrivacy.willNot.track")}</li>
      </ul>
      <p>
        {interpolate("about.aiPrivacy.willIntro", {
          will: <strong>{t("about.aiPrivacy.will")}</strong>,
        })}
      </p>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          <Code>localStorage</Code>
          {t("about.aiPrivacy.will.localStorage")}
        </li>
        <li>
          <Code>~/.score-arranger/sessions/*.json</Code>
          {t("about.aiPrivacy.will.sessions")}
        </li>
        <li>
          <Code>/tmp/score-arranger/*.musicxml</Code>
          {t("about.aiPrivacy.will.tmp")}
        </li>
      </ul>
    </div>
  );
}

function Disclaimer() {
  useLocale();
  return (
    <div>
      {/*
        免責 / 使用條款 (informal EULA). 三大重點:
        1. 改作權 — 使用者自負匯入樂譜的合法使用權.
        2. AS IS — 演算法輔助非保證, 開發者不擔賠償.
        3. 預期用途 — 教育 / 編曲輔助, 不是「機械式自動產譜」.
        為將來上 App Store 預埋的 EULA 條文. 現在不強制使用者勾選同意,
        但已明確列在 About 對話框內供查閱.
      */}
      <H2>{t("about.disclaimer.copyrightHeading")}</H2>
      <p>{t("about.disclaimer.copyrightIntro")}</p>
      <ul style={{ paddingLeft: 18 }}>
        <li>{t("about.disclaimer.copyright.publicDomain")}</li>
        <li>
          <strong>{t("about.disclaimer.copyright.copyrightedTerm")}</strong>
          {t("about.disclaimer.copyright.copyrightedBody")}
        </li>
        <li>{t("about.disclaimer.copyright.userResponsibility")}</li>
      </ul>

      <H2>{t("about.disclaimer.asIsHeading")}</H2>
      <p>{t("about.disclaimer.asIsIntro")}</p>
      <ul style={{ paddingLeft: 18 }}>
        <li>{t("about.disclaimer.asIs.advisoryOnly")}</li>
        <li>{t("about.disclaimer.asIs.noWarranty")}</li>
        <li>{t("about.disclaimer.asIs.userVerification")}</li>
      </ul>

      <H2>{t("about.disclaimer.liabilityHeading")}</H2>
      <p style={{ color: "var(--fg-muted)" }}>
        {t("about.disclaimer.liabilityBody")}
      </p>

      <H2>{t("about.disclaimer.aiThirdPartyHeading")}</H2>
      <p>{t("about.disclaimer.aiThirdPartyBody")}</p>
    </div>
  );
}

function Trademarks() {
  useLocale();
  return (
    <div>
      <p>{t("about.trademarks.intro")}</p>
      <ul style={{ paddingLeft: 18 }}>
        <li><strong>MuseScore</strong> — MuseScore BVBA</li>
        <li><strong>Dorico</strong> — Steinberg Media Technologies GmbH</li>
        <li><strong>Sibelius</strong> — Avid Technology, Inc.</li>
        <li><strong>Claude / Anthropic</strong> — Anthropic, PBC</li>
        <li><strong>MX Master</strong> — Logitech International S.A.</li>
      </ul>
      <p style={{ color: "var(--fg-muted)", marginTop: 12 }}>
        {interpolate("about.trademarks.note", {
          nominativeFairUse: (
            <strong>{t("about.trademarks.nominativeFairUse")}</strong>
          ),
        })}
      </p>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "6px 10px",
  textAlign: "left",
  borderBottom: "1px solid var(--border-light)",
  verticalAlign: "top",
};

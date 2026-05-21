/**
 * AboutDialog — 關於 / 法律聲明 / 致謝
 *
 * 從 Toolbar 的 ⚙ menu 開啟。內容是 NOTICE.md 的摘要 + 連結。
 *
 * Tab 結構: 概述 | 第三方授權 | 音訊樣本 | 樂譜版權 | AI / 隱私 | 商標
 */

import { useState } from "react";

interface AboutDialogProps {
  onClose: () => void;
}

type Section =
  | "overview"
  | "licenses"
  | "samples"
  | "corpus"
  | "ai-privacy"
  | "trademarks";

const SECTION_LABELS: Record<Section, string> = {
  overview: "概述",
  licenses: "第三方授權",
  samples: "音訊樣本",
  corpus: "樂譜版權",
  "ai-privacy": "AI / 隱私",
  trademarks: "商標",
};

export function AboutDialog({ onClose }: AboutDialogProps) {
  const [section, setSection] = useState<Section>("overview");

  return (
    <div
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
            v0.1.0
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
            關閉
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
            {(Object.keys(SECTION_LABELS) as Section[]).map((k) => (
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
                {SECTION_LABELS[k]}
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

function Overview() {
  return (
    <div>
      <p>
        <strong>Score Arranger</strong> 是一款桌面應用程式, 目的是協助音樂人將
        管弦樂總譜智慧改編為較小編制 (如弦樂四重奏、小提琴 + 鋼琴、鋼琴獨奏等)。
      </p>
      <p>
        定位: <strong>人機協作改編工具</strong>, 非全自動替代。AI 提供分析、
        修復、品質量化, 你保有最終決定權。
      </p>
      <H2>本軟體授權</H2>
      <p>
        Score Arranger 為<strong>開源軟體</strong>, 以{" "}
        <strong>GNU General Public License v3.0</strong> (GPL-3.0) 釋出。
        你可以自由使用、研究、修改與散布; 衍生作品須以相同授權開源。
        免費提供, 無廣告、無遙測。
      </p>
      <H2>授權與致謝摘要</H2>
      <p>
        Score Arranger 站在許多開源專案的肩膀上:
      </p>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          <strong>music21</strong> (BSD) — 樂譜解析核心
        </li>
        <li>
          <strong>OpenSheetMusicDisplay</strong> (BSD) — 內建譜面渲染
        </li>
        <li>
          <strong>Verovio</strong> (<Pill color="#f59e0b">LGPL-3.0</Pill>)
          — PDF 匯出
        </li>
        <li>
          <strong>Tone.js</strong> (MIT) — 音訊播放
        </li>
        <li>
          <strong>Salamander Grand Piano</strong>
          {" "}(<Pill color="#3b82f6">CC-BY 3.0</Pill>) by Alexander Holm
          — 鋼琴取樣
        </li>
        <li>
          <strong>Anthropic Claude API</strong> — 可選 AI 改編建議
        </li>
      </ul>
      <p style={{ marginTop: 12, color: "var(--fg-tertiary)" }}>
        詳細版本與條款請見「第三方授權」分頁; 完整 NOTICE 在原始碼 repo 的{" "}
        <Code>NOTICE.md</Code>。
      </p>
      <H2>版本</H2>
      <p>0.1.0 — © 2026 Kevin Lin · GPL-3.0</p>
    </div>
  );
}

function Licenses() {
  const LIBS = [
    ["music21", "BSD-3-Clause", "MusicXML 解析 / 寫入, 樂理分析"],
    ["OpenSheetMusicDisplay", "BSD-3-Clause", "譜面 SVG 渲染"],
    ["Verovio", "LGPL-3.0-or-later", "PDF 匯出渲染"],
    ["Tone.js", "MIT", "Web Audio 引擎"],
    ["@tonejs/midi", "MIT", "MIDI 解析"],
    ["jsPDF", "MIT", "PDF 組裝"],
    ["React", "MIT", "UI 框架"],
    ["Zustand", "MIT", "狀態管理"],
    ["Electron", "MIT", "桌面 runtime"],
    ["MCP SDK", "MIT", "Model Context Protocol"],
  ];
  return (
    <div>
      <p>
        每個第三方元件採用的授權如下。所有授權都允許商業使用,
        除 Verovio (LGPL) 有額外條件 (見下方)。
      </p>
      <table style={{
        width: "100%",
        fontSize: 12,
        borderCollapse: "collapse",
        marginTop: 8,
      }}>
        <thead>
          <tr style={{ background: "var(--bg-tertiary)" }}>
            <th style={cellStyle}>元件</th>
            <th style={cellStyle}>授權</th>
            <th style={cellStyle}>用途</th>
          </tr>
        </thead>
        <tbody>
          {LIBS.map(([name, license, role]) => (
            <tr key={name} style={{ borderBottom: "1px solid var(--border-light)" }}>
              <td style={cellStyle}><strong>{name}</strong></td>
              <td style={cellStyle}>
                {license.includes("LGPL")
                  ? <Pill color="#f59e0b">{license}</Pill>
                  : <span style={{ color: "var(--fg-muted)" }}>{license}</span>}
              </td>
              <td style={cellStyle}>{role}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H2>Verovio (LGPL-3.0) — 特別聲明</H2>
      <p>
        Verovio 採用 GNU Lesser General Public License v3 (或更新版本)。
        其用於 Score Arranger 的 PDF 匯出功能。LGPL 條款下:
      </p>
      <ol style={{ paddingLeft: 18 }}>
        <li>
          <strong>替換權</strong> — 終端使用者有權以自行修改的版本替換
          Verovio 元件。在 Score Arranger 中, Verovio 是以動態載入的
          獨立 bundle 提供, 替換該檔案即可行使此權利。
        </li>
        <li>
          <strong>原始碼可取得性</strong> — 對應版本的原始碼公開於{" "}
          <Code>github.com/rism-digital/verovio</Code>。
          Score Arranger 未對 Verovio 做修改。
        </li>
        <li>
          <strong>無額外限制</strong> — LGPL 不要求在渲染輸出上顯示
          歸屬字串。我們關閉了 Verovio 預設的
          "MEI engraved with Verovio" footer 以保持譜面整潔; 本歸屬聲明
          代之以做正式致謝。
        </li>
      </ol>
    </div>
  );
}

function Samples() {
  return (
    <div>
      <p>
        播放功能使用線上音訊樣本, <strong>不打包進 App</strong>,
        首次播放時從各自的官方 CDN 載入。
      </p>
      <H2>Salamander Grand Piano</H2>
      <p>
        License: <Pill color="#3b82f6">CC-BY 3.0</Pill>{" "}
        — © Alexander Holm
      </p>
      <p>
        Source: <Code>tonejs.github.io/audio/salamander/</Code>
      </p>
      <p style={{ color: "var(--fg-muted)" }}>
        CC-BY 3.0 授權要求, 凡使用該樣本產生衍生作品時必須給予歸屬。
        本 About 頁面之顯示即為合規之歸屬聲明。
      </p>
      <H2>tonejs-instruments</H2>
      <p>
        Source: <Code>github.com/nbrosowsky/tonejs-instruments</Code>
        {" "}— © Nicholas Brosowsky et al.
      </p>
      <p style={{ color: "var(--fg-muted)" }}>
        此集合內各樂器樣本授權不同, 詳見原專案 LICENSE 檔。Score Arranger
        僅在使用者啟用對應樂器時才會載入相應檔案。
      </p>
    </div>
  );
}

function Corpus() {
  return (
    <div>
      <p>
        Score Arranger 的「範例 ▾」選單列出約 30 首 music21 內建 corpus
        作品作為快速試用素材。
      </p>
      <H2>樂曲本身</H2>
      <p>
        所有列出的作曲家 (Bach, Mozart, Beethoven, Schubert, Chopin 等)
        都已逝世逾 70 年, 作品本身在絕大多數司法管轄區內已進入
        <strong>公共領域</strong>。
      </p>
      <H2>MusicXML 編碼</H2>
      <p style={{ color: "var(--fg-muted)" }}>
        雖然樂曲本身是公領域, 但 music21 corpus 內各 MusicXML 編碼檔可能
        有額外的版權聲明或限制。music21 corpus license 明文:
      </p>
      <blockquote style={{
        margin: "8px 0",
        padding: "8px 12px",
        borderLeft: "3px solid var(--accent)",
        background: "var(--bg-tertiary)",
        fontSize: 12,
        color: "var(--fg-muted)",
      }}>
        "Some encodings included in the corpus may not be used for
        commercial uses or have other restrictions: please see the licenses
        embedded in individual compositions or directories for more details."
      </blockquote>
      <p>
        <strong>商業發行建議</strong>:
        若計畫將基於 corpus 編碼產出的改編作品商業發行,
        請逐一檢視 music21 來源樹中每個 <Code>.xml</Code> 檔的版權標頭。
        或直接匯入您自己取得授權的 MusicXML 檔。
      </p>
    </div>
  );
}

function AIPrivacy() {
  return (
    <div>
      <H2>AI 改編建議 (可選)</H2>
      <p>
        Score Arranger 的「🤖 AI 建議」功能透過 Anthropic Claude API
        提供改編顧問。
      </p>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          <strong>API Key</strong>: 使用者透過環境變數 {" "}
          <Code>ANTHROPIC_API_KEY</Code> 自行提供。Key 不會打包進 App,
          不會被儲存到磁碟, 不會傳給 Score Arranger 開發者。
        </li>
        <li>
          <strong>送出資料</strong>: 使用者按下 🤖 時, 僅該小節的譜面段落
          (音符、力度) 與使用者輸入的問題會送至 Claude API。
        </li>
        <li>
          <strong>使用條款</strong>: 使用 Claude API 需遵守 Anthropic 的{" "}
          AUP (Acceptable Use Policy) 與商業條款。
        </li>
        <li>
          <strong>停用</strong>: 不設定 <Code>ANTHROPIC_API_KEY</Code>{" "}
          則完全不發送 API 請求。
        </li>
      </ul>

      <H2>隱私聲明</H2>
      <p>Score Arranger <strong>不會</strong>:</p>
      <ul style={{ paddingLeft: 18 }}>
        <li>蒐集遙測或使用分析</li>
        <li>主動上傳樂譜到任何伺服器 (除上述可選 AI 功能)</li>
        <li>追蹤使用者行為</li>
      </ul>
      <p>Score Arranger <strong>會</strong> 在你的本機儲存:</p>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          <Code>localStorage</Code> — 主題 / 排列方向 / 縮放 / tab 清單 /
          AI 建議偏好計數
        </li>
        <li>
          <Code>~/.score-arranger/sessions/*.json</Code> — 各 tab 的
          arrangement 狀態 (跨 App 啟動保持)
        </li>
        <li>
          <Code>/tmp/score-arranger/*.musicxml</Code> — 用「在外部編輯器
          開啟」時的暫存檔, 系統會自動清理
        </li>
      </ul>
    </div>
  );
}

function Trademarks() {
  return (
    <div>
      <p>下列商標屬於其各自所有人:</p>
      <ul style={{ paddingLeft: 18 }}>
        <li><strong>MuseScore</strong> — MuseScore BVBA</li>
        <li><strong>Dorico</strong> — Steinberg Media Technologies GmbH</li>
        <li><strong>Sibelius</strong> — Avid Technology, Inc.</li>
        <li><strong>Claude / Anthropic</strong> — Anthropic, PBC</li>
        <li><strong>MX Master</strong> — Logitech International S.A.</li>
      </ul>
      <p style={{ color: "var(--fg-muted)", marginTop: 12 }}>
        這些名稱在 Score Arranger 介面與文件內以
        <strong>指稱性合理使用 (nominative fair use)</strong> 方式出現,
        僅為標示與這些產品互通的功能 (如「在 MuseScore 開啟」)。
        Score Arranger 與這些公司無任何附屬或代言關係。
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

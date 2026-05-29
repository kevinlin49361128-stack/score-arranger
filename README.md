# Score Arranger

> 智慧樂譜改編桌面應用 —— 把管弦樂總譜改編為較小編制（弦樂四重奏、小提琴 + 鋼琴、鋼琴獨奏等）。

定位是「智慧輔助改編工具」：人機協作，不是全自動替代。引擎負責分析、帶約束的聲部分配、可演奏性檢查與品質量化；音樂上的判斷與最終決定權留給你。

<!-- 截圖位：把畫面截圖存成 docs/screenshot.png 後，取消下一行註解 ↓ -->
<!-- ![Score Arranger](docs/screenshot.png) -->

## 下載

macOS 安裝檔（`.dmg`，已經過 Apple 公證）：到 **[介紹網頁](https://kevinlin49361128-stack.github.io/score-arranger-web/)** 下載。

> 首次開啟請保持連網一次（Gatekeeper 會做一次線上查驗），之後即可離線使用。

## 功能

- **匯入**：MusicXML / MIDI / ABC / Lilypond，以及 PDF（透過 Audiveris OMR）、鋼琴錄音（透過 basic-pitch AMT）
- **分析**：主旋律偵測、聲部功能標記、和聲分析、樂句邊界偵測
- **改編**：帶約束的聲部分配 + 定向修復迴圈；樂句級旋律換手；多種目標編制
- **可演奏性檢查**：音域、多音能力、弦樂和弦、弓法等規則驗證
- **互動**：雙面板譜面顯示（OSMD）、問題面板、In-app 編輯、播放、A/B 比較
- **匯出**：MusicXML、MIDI、PDF 分譜

## 亮點 — 引擎裡的演算法

幾個值得指出的設計選擇：

- **帶約束的聲部分配 + 定向修復迴圈** —— 改編不只是「把音符搬位置」。引擎先做帶約束的聲部分配，再用定向修復處理可演奏性問題（移八度 → 省略次要音 → 重分配聲部 → 整段重分配）。每輪必須嚴格減少全局問題數，否則回滾；最大迭代 10 次，超過交由人類處理。
- **樂器知識庫 + 弦樂指法 Viterbi DP** —— 每個樂器有完整 profile（音域、多音能力、弓法、技術約束）。弦樂和弦過專屬檢查器（≤4 音、相鄰弦、可達把位）；`fingering.py` 的 `find_best_fingering_sequence` 跨事件做維特比 DP，把位轉移成本內建，不是逐音貪婪。
- **難度閉環控制器** —— `enrich`（加厚）與 `simplify`（簡化）是雙向運算元，`difficulty.py` 是 5 因子（音域 / 密度 / 和弦 / 節奏 / 技巧）的目標函式，`difficulty_control` 把它們接成閉環：給定目標難度，系統自動加厚 / 簡化 / 逐小節抹平。
- **人機協作護欄** —— LLM 改譜面板把自然語言轉成 8 種結構化操作（transpose / articulation / dynamic / rest / reassign / enrich / simplify / level），使用者勾選確認才套用；每次編輯後顯示品質 delta（旋律保留 / 和聲完整 / 可演奏性）作為護欄。
- **MCP server** —— 把整套引擎能力（arrange、apply_edit_ops、compute_difficulty、compute_quality 等）暴露給外部 AI agent（Claude Desktop、Cursor 等），可跑完整自主改編對話。
- **IR → MusicXML 直接序列化** —— 繞過 music21 匯出，自製 hairpin / ornament 補充解析，解掉 music21 匯出時丟失的標記。

## 技術棧

- **前端**：Electron + React + TypeScript + Vite + Zustand
- **譜面渲染**：OpenSheetMusicDisplay (OSMD)
- **引擎**：Python（music21 做初始解析，自訂輕量 IR 做後續運算）
- **前後端通訊**：Electron 主程序 ↔ Python child process，stdin/stdout JSON-Lines 協定
- **播放**：Tone.js

## 從原始碼建置

需求：Node.js ≥ 22、Python ≥ 3.11。

```sh
# 前端依賴
npm install

# Python 引擎（建立 venv；[dev] 額外含 pytest / ruff / mypy）
cd engine
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cd ..
```

### 常用指令

```sh
npm run dev          # 開發環境 (renderer + main + electron)
npm run typecheck    # TypeScript 型別檢查
npm run lint         # Biome lint
npm run test         # 前端單元測試 (Vitest)
npm run dist:mac     # 打包 macOS app (簽章版)

cd engine && .venv/bin/python -m pytest   # 引擎測試
```

macOS 簽章 + 公證的完整 release 流程見 [`release-mac.sh`](release-mac.sh)。

## 專案結構

```
src/
  main/          Electron 主程序 (python-bridge、IPC)
  renderer/      React 前端 (components、stores、hooks)
engine/
  core/          Python 引擎 (parser、analyzer、arranger、validator、server)
  tests/         引擎單元測試 (pytest)
build/           electron-builder 的 buildResources (icon、entitlements)
docs/            設計規格文件 (architecture.md 架構設計書、IR/樂句/和聲/Player 規格等)
```

## 文件

- [`docs/architecture.md`](docs/architecture.md) — 完整架構設計書
- [`docs/`](docs/) — IR 規格、樂句偵測規格、MCP 設定等
- [`NOTICE.md`](NOTICE.md) — 第三方元件授權與致謝

## 支持開發

Score Arranger 是免費的開源軟體，所有功能都不付費鎖定。若這個工具對你有幫助，歡迎透過 Lemon Squeezy 隨意贊助 — 贊助會用於以下開支：

- Apple Developer Program 年費（$99/yr）
- 程式碼簽章 + macOS 公證
- 開發時間（新樂器、新編制、Bug 修復）

<!-- TODO: LMS 批准後改成 product 直連 -->
**[☕ Buy me a coffee on Lemon Squeezy](https://kevin-lin.lemonsqueezy.com)** _(Pay what you want; minimum $1)_

贊助是純粹自願 — 不影響任何功能可用性。

## 授權與法律

Score Arranger 以 **[GPL-3.0-only](LICENSE)** 釋出（SPDX: `GPL-3.0-only`）。
你可以自由使用、研究、修改與散布；衍生作品須以相同授權（GPL-3.0-only）開源。

本專案站在許多開源元件的肩膀上 —— music21、OpenSheetMusicDisplay、
Verovio、Tone.js 等，各自的授權與致謝整理於 [`NOTICE.md`](NOTICE.md)；
完整自動產出的相依套件清單（npm + Python frozen）見
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md)。

| 文件 | 內容 |
|------|------|
| [`LICENSE`](LICENSE) | GPL-3.0 全文 |
| [`NOTICE.md`](NOTICE.md) | 第三方元件 / 音訊樣本 / 範例樂譜授權概述 |
| [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) | 自動產出的完整 npm + Python 相依清單 |
| [`PRIVACY.md`](PRIVACY.md) | 隱私 — 何時連網、寫什麼到 disk、資料流 |
| [`DISCLAIMER.md`](DISCLAIMER.md) | 無擔保 + 責任範圍 + 使用者對輸入/輸出的責任 |
| [`SOURCE.md`](SOURCE.md) | GPL §6 對應源碼義務 + Verovio LGPL 替換步驟 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 貢獻流程 + DCO 條款 |
| [`SECURITY.md`](SECURITY.md) | 安全漏洞回報 |

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
docs/            設計規格文件
architecture.md  完整架構設計書
```

## 文件

- [`architecture.md`](architecture.md) — 完整架構設計書
- [`docs/`](docs/) — IR 規格、樂句偵測規格、MCP 設定等
- [`NOTICE.md`](NOTICE.md) — 第三方元件授權與致謝

## 授權

Score Arranger 以 **GNU General Public License v3.0** 釋出（全文見 [`LICENSE`](LICENSE)）。
你可以自由使用、研究、修改與散布；衍生作品須以相同授權（GPL-3.0）開源。

本專案站在許多開源元件的肩膀上 —— music21、OpenSheetMusicDisplay、Verovio、Tone.js 等，各自的授權與致謝整理於 [`NOTICE.md`](NOTICE.md)。

# Score Arranger

智慧樂譜改編桌面應用 —— 協助音樂人將管弦樂總譜改編為較小編制（弦樂四重奏、小提琴+鋼琴、鋼琴獨奏等）。定位是「智慧輔助改編工具」：人機協作，不是全自動替代。

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
- **前後端通訊**：Electron 主程序 spawn Python child process，stdin/stdout JSON-Lines 協定
- **播放**：Tone.js

## 開發環境設定

需求：Node.js ≥ 22、Python ≥ 3.12。

```sh
# 前端依賴
npm install

# Python 引擎 (建立 venv)
cd engine
python3 -m venv .venv
.venv/bin/pip install -e .
cd ..
```

## 常用指令

```sh
npm run dev          # 啟動開發環境 (renderer + main + electron)
npm run typecheck    # TypeScript 型別檢查 (renderer + main)
npm run lint         # Biome lint
npm run test         # 前端單元測試 (Vitest)
npm run dist:mac     # 打包 macOS app (簽章版)

# 引擎測試
cd engine && .venv/bin/python -m pytest
```

macOS 簽章 + 公證的完整 release 流程見 `release-mac.sh`。

## 專案結構

```
src/
  main/         Electron 主程序 (python-bridge、IPC)
  renderer/     React 前端 (components、stores、hooks)
engine/
  core/         Python 引擎 (parser、analyzer、arranger、validator、server)
  tests/        引擎單元測試 (pytest)
build/          electron-builder 的 buildResources (icon、entitlements)
docs/           設計規格 (ir-spec、phrase-detection-spec 等)
architecture.md 完整架構設計書
```

## 文件

- [`architecture.md`](architecture.md) — 完整架構設計書
- [`docs/`](docs/) — IR 規格、樂句偵測規格、MCP 設定等
- [`NOTICE.md`](NOTICE.md) — 第三方授權與致謝

## 開發階段

- **Phase 1 MVP**：Parser + Analysis + 基礎 Arrangement + OSMD 顯示 — 已完成
- **Phase 2**：互動式 UI、多編制、完整可演奏性檢查、播放、undo/redo — 進行中
- **Phase 3**：A/B 比較、PDF 分譜匯出、LLM 輔助建議

# Score Arranger — AGENTS.md

## 專案概述

Score Arranger 是一款桌面應用程式，目的是協助音樂人將管弦樂總譜智慧改編為較小編制（如弦樂四重奏、小提琴+鋼琴、鋼琴獨奏等）。核心定位是「智慧輔助改編工具」——人機協作，非全自動替代。

## 技術棧

- **前端**: Electron + React + TypeScript
- **譜面渲染**: OpenSheetMusicDisplay (OSMD) — 基於 MusicXML 的開源渲染引擎
- **核心引擎**: Python (music21 生態系做初始解析，自訂輕量 IR 做後續運算)
- **前後端通訊**: 本地 HTTP API 或 Electron IPC → Python child process
- **播放引擎**: Tone.js 或 SoundFont
- **交換格式**: MusicXML 為主要格式，MIDI 為次要格式
- **效能備案**: 核心演算法如有效能瓶頸，改用 Rust + WASM/FFI

## 架構核心模組

1. **Score Parser** — MusicXML/MIDI → Internal Representation (IR)
2. **Analysis Engine** — 主旋律偵測、和聲分析、聲部功能標記
3. **Arrangement Engine** — 帶約束的聲部分配 + 定向修復迴圈
4. **Instrument Knowledge Base** — 樂器音域、多音能力、技術約束資料庫
5. **Playability Validator** — 靜態規則驗證 + 動態序列模擬
6. **UI Layer** — 雙面板 (原始總譜 / 目標譜) + 問題面板 + 播放

## 關鍵設計約束

- 主旋律在同一樂句內必須維持在同一聲部，僅允許在樂句邊界換聲部
- 小提琴和弦最多四音且必須在相鄰弦上，弓法約束不可違反
- 修復迴圈採用定向修復 (Directed Repair)，非隨機蒙地卡羅
- 每次修復必須嚴格減少全局問題數，否則回滾
- 最大迭代次數 10 次，超過交由使用者手動處理
- 修復策略優先序: 移八度 > 省略次要音 > 重分配聲部 > 改寫演奏法 > 整段重分配

## 開發分階段

- **Phase 0 (4-6週)**: 純 Python CLI 驗證核心可行性 — music21 解析可靠度、旋律偵測準確率、弦樂和弦檢查
- **Phase 1 MVP (3-4月)**: Parser + Analysis + 基礎 Arrangement + OSMD 顯示，僅支援「小提琴+鋼琴」編制
- **Phase 2 (3-4月)**: 互動式 UI、多編制、完整可演奏性檢查、播放引擎、undo/redo
- **Phase 3**: A/B 比較、擴展樂器知識庫、PDF 分譜匯出、LLM 輔助建議

## 程式碼慣例

- Python: 使用 dataclass 定義資料模型，型別標注必須完整
- TypeScript: strict mode，React 使用 functional components + hooks
- 所有音樂術語變數名用英文 (e.g. `melody`, `bass_line`, `harmony_fill`)
- 使用者面向的文字一律使用繁體中文
- 完整設計規格書位於 `docs/architecture.md`

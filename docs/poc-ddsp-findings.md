# 音色 D PoC: DDSP/MIDI-DDSP 神經渲染 — 可行性結論 (2026-06-11)

## 結論: 此路徑目前**不可行** (pip 路線), time-box 內判定不續投

## 證據
在 python3.12 (本機唯一可用版本) + arm64 macOS 上:

```
pip install --dry-run midi-ddsp / ddsp
→ ERROR: Failed to build 'crepe'
  ModuleNotFoundError: No module named 'imp'   # imp 在 py3.12 已移除
```

- `midi-ddsp 0.2.6` (2022) 釘 `ddsp==3.2.0` + `tensorflowjs<3.19` + `crepe<0.0.13`
- 整條鏈釘死 TensorFlow 2.8 世代 → **無 py3.12 wheel、無 arm64 原生 wheel**
- `crepe` 連 metadata 解析都過不了 (py3.12 移除 `imp`)
- Magenta/DDSP 專案 2023 後停止維護, 生態系已 rot

## 若日後要做, 可行路線 (按成本排序)
1. **brew 裝 python@3.10 + 手動依賴手術** — `tensorflow-macos` 替代 `tensorflow`
   + `--no-deps` 逐包裝。脆、~3GB、隨時再 rot。不建議。
2. **ONNX 匯出** — 把 DDSP 模型 (decoder 部分) 轉 ONNX, 用 onnxruntime
   (homr 已驗證 onnxruntime 在本專案環境可行)。需要先在能跑 TF 的環境匯出,
   工程量中等, 但擺脫 TF 依賴後可長期維護。**若續投, 走這條。**
3. **torch 重實作** (社群 ddsp-pytorch) — 只有合成端、無 MIDI-DDSP 的
   expression generator (那才是對本專案有價值的部分: note→expression→audio)。

## 對整體規劃的影響
P (QA harness)、A (VSCO 正規化)、B (表現力) 已落地, 已涵蓋「匯出示範音檔」
需求的大部分價值 (既有 OfflineContext 音訊匯出 #32 + A/B 的音質提升直接讓
匯出檔變好聽)。D 的差異化價值 (神經級擬真) 維持在 backlog, 觸發條件:
DDSP 生態系出現維護版 / ONNX 社群匯出可用 / 出現新的輕量 note→audio 模型。

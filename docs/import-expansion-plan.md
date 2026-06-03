# 匯入 / 曲庫擴充 — 變更與計劃

> 13 項 / 5 phase。Kevin 已授權整批。本檔追蹤進度與每項的 scope、動到的檔案、依賴、驗證。
> 決策依據：`docs/import-expansion-decision.html`、`docs/b1-online-corpus-decision.html`。

## 狀態總覽

| Phase | 項目 | 狀態 |
|---|---|---|
| P1 速贏 | C1 JVM heap、C4 暫存清理、(B2 已修確認) | ✅ 完成 + 驗證 |
| 戰略 | **B1 線上曲庫層** | ✅ 建完 + 各層驗過（in-app 最後一哩待 build+run） |
| A 來源 | A2 OpenScore SQ、A1 CPDL、A4 KernScores、A3 Mutopia | ⬜ 待做（走 B1） |
| 架構 | B3 統一路由器、B4 持久快取、B5 匯入 UX | ⬜ 待做 |
| PDF 大檔 | C2 chunk OMR、C3 背景/進度/取消 | ⬜ 待做 |

---

## 已完成

### Phase 1（速贏）— engine
- **C1 JVM heap**：`engine/core/omr/audiveris.py` 加 `_audiveris_heap_mb()` / `_audiveris_env()`，依系統 RAM 設 `_JAVA_OPTIONS=-Xmx`（夾 2–4GB，尊重使用者既設）。大 PDF OOM 主因解除。
- **C4 暫存清理**：同檔 `_new_managed_omr_dir()` — OMR 產出改放受控根，保留最近 3 份，不再漏滿 /tmp。
- **C4 256MB buffer / B2 grace-note**：查證為「已做好」。B2 有既存 regression test（K146/K200）。
- **測試**：`tests/test_omr_audiveris.py` +4。**驗證**：43 pass、mypy baseline 0/0。

### B1 線上曲庫層
- **主程序**：`src/main/corpus-fetch.ts`（新）— manifest 抓取、下載、**sha256 驗證**、`userData/corpus_cache`、**500MB LRU**、離線退回磁碟 manifest、只接受本 repo release origin。
- **接線**：`index.ts`（IPC）+ `preload.ts`（`corpus.listRemote/resolve/clearCache`）+ `types.d.ts` + `RepertoireDialog.tsx`（曲目庫合併遠端 + ☁徽章 + 載入分流）+ `repertoireCatalog.ts`（+`remote`）+ `i18n.library.ts`。引擎不動。
- **Host**：`corpus-v1` GitHub release（標 not-latest，不擾 0.1.82 auto-update）— `catalog.json` + 5 首 seed。curl + sha256 驗過。
- **驗證**：typecheck + biome clean。修掉一個 `.mxl/.musicxml` 副檔名 bug。
- **未驗**：in-app 實際下載→載入（需 build+run；`net.fetch`/`app` 無法獨立跑）。

---

## 待辦（執行順序）

### ▶ 下一步（待 Kevin 選）：build+run 驗 B1 最後一哩
跑一次 live build，在曲目庫點雲端曲確認「下載→快取→載入」。建議做完再往 A，因為 A 依賴 B1 真的會動。

### A 曲庫來源（走 B1，不進 binary）— 依賴 B1
- 寫 `scripts/build-corpus.py`：從來源抓 CC0/PD `.mxl` → 過濾（grace-note 已 OK）→ 算 sha256 → 產 catalog entry → 上傳 `corpus-v1`。
- 動到：新腳本、`corpus-v1` release（加資產，**不動 app 程式碼**）。
- 順序/難度：**A2 OpenScore SQ (S)** 暖管線 → **A4 KernScores (S)** → **A1 CPDL (M)** → **A3 Mutopia (M)**。
- 策略：每來源先 10–20 首驗管線，再放量。

### B3 統一匯入路由器 — M
- engine：新 `import_file(path)` 以副檔名 + magic bytes 嗅探，分流 MusicXML/MIDI/Kern/ABC/PDF/audio；server.py 收斂 `_method_parse`/`_pdf`/`_audio`。
- 動到：`engine/core/`（新 importer）、`server.py`、`index.ts`、`preload.ts`、`Toolbar.tsx`（dialog filter）。

### B4 持久內容雜湊快取 — M
- engine：`parser.py` 的 4-slot 記憶體 LRU → 磁碟 content-hash 快取，跨 session 重用。
- 動到：`parser.py`（或新 cache 模組）。需管快取大小 / 失效。

### B5 匯入 UX — S
- renderer：拖放 + 最近檔案 + 從 URL 匯入（過 origin 白名單，沿用 corpus-fetch 模式）。
- 動到：`App.tsx`/`Toolbar.tsx`、main（URL 抓取）。

### C2 分頁 chunk OMR + 拼接 — L
- engine：`audiveris.py` 切頁段（`-sheets`）逐段 OMR + MusicXML 拼接（**跨段小節/聲部編號對齊** = 真功夫，與 timeline「同源 grid」同概念）。
- 動到：`audiveris.py`、`server.py`、新 stitch 模組。

### C3 背景 OMR + 進度 + 取消 — M
- main：背景任務 + 新 `omr_status()` 輪詢（`{pages_done,total}`）+ 取消 kill subprocess。
- renderer：進度條 + 取消鈕。
- 動到：`server.py`、`python-bridge.ts`、`index.ts`、OMR UX 元件。**與 C2 一起做最划算。**

---

## 發版策略
- 程式碼目前**未提交**（工作區）。`corpus-v1` release 已 live（現有 app 無感）。
- 建議切點：**P1 + B1 → 0.1.83 一起發**；A 首批 + B3/B4/B5 → 0.1.84；C2+C3 → 0.1.85。
- 每 phase 驗證門檻：engine = pytest + mypy baseline；前端 = typecheck + biome + vitest；UI 動到的盡量 build+run 或 computer-use 看一眼。

## 開放問題
1. **B1 最後一哩**：現在 build+run 驗，還是等隨 0.1.83 上線你自己點？（建議現在驗）
2. **發版切點**：P1+B1 先發 0.1.83，還是等 A 首批一起？
3. **A 來源優先**：建議 A2（OpenScore String Quartets, S）先暖管線。

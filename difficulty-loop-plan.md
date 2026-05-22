# 難度閉環控制器 — 架構規劃 (A1 + A2 + A3)

> Claude 於 2026-05-22 撰寫。這是「一次規劃、分批實作」的規劃產物。
> 下次 session 直接照這份開工,從第一批 (A1) 開始。

---

## 〇、決策紀錄 (使用者 2026-05-22)

整合路線決策文件 (`integration-roadmap-planning.html`) 的回覆:

- **第一個動工:** A1 簡化
- **這輪範圍:** 全部 9 個整合 (A1·C·A2·A3·B·D2·F·E·D1)
- **難度閉環:** 一次規劃、分批做 ← 本文件處理 A1/A2/A3 這三項

C·B·D2·F·E·D1 不在本文件範圍,各自獨立規劃。

---

## 一、核心洞察 (為什麼三者是同一件事)

`repair.py` 已經是一個通用的**導向式優化器**:策略庫 + 評分函式
(`severity_score`) + quality-aware 候選挑選器 (`_pick_best_candidate`)。
它目前只接「減少可演奏性問題」這一個目標。

A1/A2/A3 就是把同一個迴圈接上**「難度目標」**這個新目標:

| 元件 | 角色 |
|---|---|
| `enrich.py` (已完成) | **加難度**的運算元集合 (octave / block / arpeggio / strum) |
| **A1 簡化** | **降難度**的運算元集合 —— enrich 的鏡像 |
| `difficulty.py` (已完成, 5 因子) | **目標函式** —— 全曲分數 + per-measure 分數 |
| **A3 通用控制器** | 閉環:給定目標難度, 搜尋運算元讓分數收斂 |
| **A2 難度抹平** | 控制器的一種模式:逐小節把分數推進目標帶 |

→ A1 是缺的那半邊運算元;A3 是把運算元接上目標的迴圈;A2 是 A3 的
per-measure 特例。**先有運算元 (A1)、再有迴圈 (A3)、再有特例 (A2)。**

---

## 二、架構分層

```
Layer 4  接線層    server.py op kinds + LLMEditOp + 前端面板
Layer 3  控制器    difficulty_control.py  ← A3 / A2
Layer 2  目標函式  difficulty.py (已完成)
Layer 1  運算元    enrich.py (已完成) + simplify.py (新, A1)
```

### Layer 1 — 運算元

- **`enrich.py`** — 已完成 (加法運算元)。
- **`simplify.py`** (新, A1) — 減法運算元,鏡像 `enrich.py` 的結構。
  公開函式: `simplify_part(part_measures, m_start, m_end, level, instrument_id) -> int`
  (`level`: `"light" | "medium" | "full"`,鏡像 enrich 的 density)。
  內部手法:
  1. **和弦瘦身** — 4 音和弦 → 三和弦 → (極端) 單音。複用
     `repair.py` 的 `_harmonic_omit_choice` (挑最不重要的和弦音)。
  2. **八度收摺** — 把八度疊置 / 寬音域音收回。複用
     `repair.py` 的 `_shift_pitch_octave`。
  3. **去裝飾** — 移除 ornament / grace note / trill。
  4. **節奏簡化** — 短時值合併成長音 (細碎音群 → 骨幹音)。
  5. **演奏法簡化** — 剝除困難弓法 (spiccato → 一般)。

### Layer 2 — 目標函式

`difficulty.py` 已完成且夠用:`analyze_part_difficulty()` 給全曲 5 因子
分數;`MeasureDifficulty` 給 per-measure 分數。A2/A3 直接用,**不需改**。

### Layer 3 — 控制器

**`difficulty_control.py`** (新) — 收掉 `enrich.choose_density` (Phase C
那個只挑 enrich 密度的窄版),由本模組的通用版取代。

- **A3** `converge_difficulty(part, source, target, *, band, max_iter)`
  全曲閉環:每輪產生候選編輯 (enrich 或 simplify),用
  `|difficulty - target|` 評分,留最佳、無進步則停。終止條件鏡像
  `repair_loop` (max_iter、嚴格改善否則回滾)。
- **A2** `level_difficulty(part, source, target, *, band)`
  逐小節:對每個 `MeasureDifficulty` 落在目標帶外的小節 —— 太難 →
  `simplify_part`,太簡單 → `enrich_part` —— 把難度曲線抹平。
  實作上就是「對每個小節各跑一次 A3 的 converge」。

### Layer 4 — 接線層

- `server.py`:新增 op kind **`simplify`** (鏡像 `enrich` 的驗證 +
  套用分支);A2/A3 走既有 enrich op 的 `target_difficulty` 欄位 ——
  **語意擴充**:有了 simplify 後,`target_difficulty` 可往下也可往上
  收斂 (現在只會往上加)。
- `LLMEditOp` (llm.ts + types.d.ts):加 `simplify` kind;NL edit-plan
  prompt 學會它。
- 前端:**把現有的「💪 加難度」面板 (DifficultyBoostDialog) 擴成
  雙向的「難度調節」面板** —— 不要再開一個幾乎一樣的「降難度」面板。
  加一個「目標難度」滑桿:低於現值 → 走 simplify,高於 → 走 enrich,
  「抹平」模式 → 走 A2。

---

## 三、三批交付 (分批做)

實作順序 = 依賴順序:**A1 → A3 → A2**。

| 批次 | 內容 | 交付的使用者價值 |
|---|---|---|
| **Batch 1 — A1** | `simplify.py` + `simplify` op + 測試 + 前端面板擴成雙向 | 「把譜改簡單給學生」—— 完整可用功能 |
| **Batch 2 — A3** | `difficulty_control.py` 的 `converge_difficulty` + 收掉 `choose_density` + 目標難度滑桿 | 「把這個聲部調到難度 3」雙向都行 |
| **Batch 3 — A2** | `level_difficulty` + 接難度熱圖 + 「抹平難度曲線」按鈕 | 「整首設定到 grade 4」,消除爆難小節 |

每批都是一個可獨立 ship 的完整功能 + 一次 KBIR build。

> 註:A2 理論上可在 A3 之前做成「獨立的 per-measure 簡單迴圈」,
> 但那會跟 A3 的通用迴圈重工。既然決定「一次規劃」,就讓 A2 當 A3
> 的特例,A3 先行。

---

## 四、關鍵設計決策

1. **旋律保護 (最重要)。** simplify 絕不可刪旋律音、絕不可把旋律簡化掉。
   每次 simplify 後用 `quality.py` 的 melody-preservation 把關 ——
   低於門檻就回滾該步。enrich 已保證「旋律在和弦頂端」;simplify 要
   保證「旋律恆在」。
2. **複用 repair.py 但不改它的公開介面。** `strategy_omit_note` 等是
   issue-driven (吃 `LocatedIssue`)。simplify 是 range-driven —— 直接
   呼叫內部 helper (`_harmonic_omit_choice`、`_shift_pitch_octave`),
   不要硬套 issue 包裝。必要時把那兩個 helper 從 repair.py 抽到共用
   模組。
3. **undo 一致。** 全部走 `apply_edit_ops` 的 history snapshot ——
   一次調節 = 一次 undo。
4. **鎖定事件不碰。** 尊重 `is_locked` (enrich 已如此)。
5. **終止條件。** 鏡像 `repair_loop`:max_iter (建議 10)、每輪須嚴格
   逼近目標否則回滾。
6. **`target_difficulty` 語意擴充而非新欄位。** 不新增欄位;讓既有
   enrich op 的 `target_difficulty` 在「有 simplify 可用」後自然支援
   雙向收斂。

---

## 五、未決問題 / 風險

- **節奏簡化的正確性。** 把細碎音群併成骨幹音牽涉「哪些是裝飾、哪些是
  結構音」的判斷 —— 比和弦瘦身難。Batch 1 可先做「和弦瘦身 + 八度收摺
  + 去裝飾 + 演奏法簡化」四項,**節奏簡化列為 Batch 1 的延伸或 Batch 2
  再補**。
- **simplify 後可能破壞聲部進行。** 瘦身後留下的音可能產生平行五/八度。
  可選擇性接 `voice_leading.py` 檢查,但不擋 —— 列為警告。
- **A2 的「目標帶寬度」δ。** 太窄會過度編輯、太寬等於沒抹平。預設
  建議 ±0.4 (難度 1-5 級),之後依實測調。

---

## 六、Batch 1 (A1) 的 task 拆解 — 下次 session 可直接開工

1. `engine/core/simplify.py` — `simplify_part()` + 四個手法
   (和弦瘦身 / 八度收摺 / 去裝飾 / 演奏法簡化)。
2. 若需要,把 `_harmonic_omit_choice` / `_shift_pitch_octave` 從
   `repair.py` 抽成共用 helper。
3. `engine/core/server.py` — `_method_apply_edit_ops` 加 `simplify`
   op kind (驗證 + 套用分支,鏡像 `enrich`)。
4. `engine/tests/test_simplify.py` — 鏡像 `test_enrich.py`;含旋律
   保護測試。跑全套 pytest。
5. `src/main/llm.ts` + `src/renderer/types.d.ts` — `LLMEditOp` 加
   `simplify`;EDIT_PLAN_SYSTEM_PROMPT 加說明。
6. `NLEditDialog.tsx` + `i18n.editing.ts` — describeOp 支援 simplify。
7. `DifficultyBoostDialog.tsx` — 擴成雙向「難度調節」:加方向 /
   目標選擇;低於現值走 simplify。
8. typecheck + biome + vitest → KBIR build → 安裝。

# Phrase Detection — 樂句邊界偵測演算法規格書

> 版本: 0.1.0 (Draft)
> 最後更新: 2026-05-18
> 對應 architecture.md 章節 4.2、IR spec §3.4

---

## 1. 問題定義

**輸入**: 一個 `Part` 在一個 `Section` 範圍內的事件序列
**輸出**: `list[Phrase]` — 樂句邊界列表,每個 Phrase 標註信心分數

**為何重要**:
- 「主旋律在同一樂句內不可換聲部」是改編的核心約束 (CLAUDE.md §關鍵設計約束)
- 樂句切分錯誤 → 主旋律分配錯誤 → 整個改編出問題
- 但**樂句切分本身有歧義**,系統不能假裝永遠對

---

## 2. 設計原則

1. **多訊號加權,不依賴單一啟發**
   單一規則 (例如「遇到休止符就切」) 在實際樂譜上會大量誤切或漏切。

2. **DP 全域最佳化,非貪婪**
   貪婪在強訊號稀疏處會產生 1 小節或 20 小節的怪異樂句。DP 結合長度先驗做全曲最佳切分。

3. **每個邊界附帶信心分數**
   讓 UI 區分「強信號邊界」(實線顯示) 與「猜測邊界」(虛線顯示)。

4. **使用者覆寫優先於系統判斷**
   `Phrase.is_user_edited == True` 的邊界不參與重新偵測。

5. **每聲部獨立偵測,跨聲部對齊**
   不同樂器的樂句切分可能不同 (旋律聲部 vs 伴奏聲部)。但**主旋律聲部的樂句邊界**會用於跨聲部對齊。

---

## 3. 邊界訊號清單

每個訊號回傳候選邊界列表: `list[(measure: int, offset: Fraction, weight: float, reason: str)]`

### 3.1 強訊號 (weight = 1.0)

| 訊號 | 偵測規則 | 註 |
|------|----------|-----|
| **長休止符** | 連續休止 ≥ 1 拍 (四分音符) | 古典樂中休止符是最強的樂句分界 |
| **雙縱線 / 終止線** | `Measure.barline_left == "double"` 或 `"final"` | 出版者明確標註的段落分界 |
| **延長記號 (Fermata)** | `RestEvent.fermata == True` 或 `NoteEvent.articulations` 含 `"fermata"` | Fermata 強烈暗示樂句結束 |
| **圓滑線結束** | 圓滑線最後一個音符之後 | 圓滑線是作曲家明示的「一口氣」 |
| **使用者編輯邊界** | `Phrase.is_user_edited == True` | 鎖定,不可移除 |

### 3.2 中訊號 (weight = 0.6)

| 訊號 | 偵測規則 | 註 |
|------|----------|-----|
| **完全終止式 (Authentic Cadence)** | 經 `harmonic_analyzer` 偵測 V → I (或 V7 → I) | 需 4.2.2 和聲分析支援,Phase 1 可降為弱訊號 |
| **不完全終止式 (Half Cadence)** | 偵測 X → V | 比完全終止稍弱 |
| **速度變化** | `Measure.tempo_bpm` 或 `tempo_text` 變化 | "Allegro" → "Andante" 是強段落分界 |
| **拍號變化** | `Measure.time_signature` 變化 | |
| **排練記號** | `Measure.rehearsal_mark != None` | 出版者預設的分段點 |

### 3.3 弱訊號 (weight = 0.3)

| 訊號 | 偵測規則 | 註 |
|------|----------|-----|
| **大跳音程** | 相鄰音符音程 ≥ 七度 (12 半音) | 大跳常標示樂句切換 |
| **力度驟變** | 連續兩音符 dynamic 跨度 ≥ 4 級 (e.g. ff → p) | 「subito」效果 |
| **旋律輪廓轉折** | 連續上行/下行 ≥ 4 音後反向 | 旋律方向反轉常為樂句中點或切點 |
| **時值對比** | 短音群 → 長音 (或反之),時值比 ≥ 4:1 | 「呼吸點」啟發 |
| **重複的開頭** | 偵測到動機重複 (motivic repetition) | Phase 2 才實作,需 motif 分析 |

---

## 4. 長度先驗 (Length Prior)

古典樂句長度有強統計分布:

| 長度 (小節) | 出現頻率 | 範例 |
|-------------|----------|------|
| 1 | 罕見 (5%) | 過渡片段 |
| 2 | 常見 (15%) | 動機 |
| **4** | **最常見 (40%)** | 標準古典樂句 |
| **8** | **次常見 (25%)** | 大樂句、二部曲式半句 |
| 6 | 偶見 (5%) | 三部小節的 hemiola |
| 16 | 偶見 (5%) | 浪漫派長句 |
| > 16 | 罕見 (5%) | 華格納式持續 |

採用混合高斯先驗:
```
P(length = n) ∝ 0.4 * N(n; μ=4, σ=1.5) + 0.3 * N(n; μ=8, σ=2.0) + 0.05 * N(n; μ=16, σ=4.0) + baseline
```

實作時取 `log(P)` 作為先驗分數。

**約束**:
- 最短樂句: 2 小節 (1 小節通常是動機,不獨立成樂句)
- 最長樂句: 32 小節 (超過視為系統判斷失敗,需使用者介入)

---

## 5. 演算法

### 5.1 流程

```
INPUT: Part p, Section s
OUTPUT: list[Phrase]

1. 收集所有候選邊界 (合併 §3.1-3.3 訊號)
   candidates = collect_all_signals(p, s)
   
2. 對同一位置多訊號重合,加權累加
   merged = merge_by_position(candidates)
   # e.g. 同小節同位置同時有 "long_rest" + "slur_end" → weight = 1.0 + 1.0 = 2.0
   
3. 加入 section 邊界 (起點與終點必為樂句邊界)
   merged = [section.start, ...merged, section.end + 1]
   
4. DP 求最佳切分
   best_split = dp_segment(merged, length_prior)
   
5. 建構 Phrase 物件,寫入信心分數
   phrases = build_phrases(best_split, merged)
   
RETURN phrases
```

### 5.2 DP 公式

設候選邊界序列 `B = [b_0, b_1, ..., b_n]`,其中 `b_0 = section.start`, `b_n = section.end + 1`。
邊界 `b_i` 的訊號權重為 `w_i`。

定義:
- `dp[i]` = 從 `b_0` 切到 `b_i` 的最佳分數
- `length(i, j) = b_j.measure - b_i.measure` (以小節為單位)
- `prior(len)` = §4 的對數先驗分數
- 段內訊號獎勵 = 0 (中間訊號未被選用視為「未切此處」,不獎不罰)

遞推:
```
dp[0] = 0
dp[i] = max over j < i where 2 <= length(j, i) <= 32:
           dp[j] + w_i + prior(length(j, i))
parent[i] = argmax
```

回溯 `parent[n]` 得到最佳切分序列。

### 5.3 信心分數計算

```python
def confidence(boundary_signal_weight: float) -> float:
    # weight ∈ [0, ∞), confidence ∈ [0, 1]
    return 1 - exp(-boundary_signal_weight)
    # weight=0.3 (單弱訊號) → conf≈0.26
    # weight=0.6 (單中訊號) → conf≈0.45
    # weight=1.0 (單強訊號) → conf≈0.63
    # weight=2.0 (雙強訊號重合) → conf≈0.86
```

UI 應用:
- conf ≥ 0.6: 邊界用實線顯示
- 0.3 ≤ conf < 0.6: 邊界用點劃線顯示 + 提示「系統較不確定」
- conf < 0.3: 邊界用虛線顯示

---

## 6. 多聲部對齊

每個聲部獨立跑 phrase detection,但 Analysis Engine 需提供「**對齊樂句**」概念:

```python
@dataclass
class AlignedPhrase:
    """跨聲部對齊的樂句邊界。
    
    以主旋律聲部 (melody source) 的樂句為主,
    其他聲部的最近邊界 (容忍 ±1 小節) 對齊到此。
    無法對齊者,記為各自獨立。
    """
    section_id: int
    aligned_id: int
    span: tuple[int, int]  # 對齊後的小節範圍
    per_part_phrases: dict[str, int]  # part_id → phrase_id
    is_master: bool = False  # True = 主旋律聲部
```

---

## 7. 使用者覆寫介面

`AnalysisEngine.set_phrase_boundaries(part_id, section_id, boundaries: list[int])`:
- 重新建立此 part 在此 section 內的 Phrase,全部標 `is_user_edited = True`
- 觸發下游重新分析 (melody track 重識別、改編重跑)

`AnalysisEngine.move_phrase_boundary(part_id, old_measure: int, new_measure: int)`:
- 局部調整,只影響受影響的兩個樂句
- 標記 `is_user_edited = True`

`AnalysisEngine.reset_phrases(part_id, section_id)`:
- 清除使用者編輯,重跑偵測

---

## 8. 測試方法

### 8.1 Ground Truth 建立

從以下來源收集人工標註的樂句邊界,作為評估資料集:

| 來源 | 數量目標 | 風格 |
|------|----------|------|
| Mozart 弦樂四重奏 (3 首) | ~120 樂句 | 古典時期,規則最強 |
| Beethoven 鋼琴奏鳴曲 (2 首慢板) | ~80 樂句 | 古典晚期,樂句較長 |
| Chopin 夜曲 (2 首) | ~50 樂句 | 浪漫派,模糊邊界較多 |
| Brahms 室內樂片段 (1 首) | ~40 樂句 | 樂句綿延,挑戰性高 |
| Debussy 鋼琴小品 (1 首) | ~30 樂句 | 印象派,規則最弱 |

每首由 2 位音樂人獨立標註,衝突時討論決定。

### 8.2 評估指標

```python
def evaluate(predicted: list[int], gold: list[int], tolerance: int = 1) -> dict:
    """
    tolerance: 允許邊界誤差小節數 (預設 ±1)
    """
    tp = count_matched(predicted, gold, tolerance)
    fp = len(predicted) - tp
    fn = len(gold) - tp
    
    precision = tp / (tp + fp)
    recall = tp / (tp + fn)
    f1 = 2 * precision * recall / (precision + recall)
    
    # 額外指標
    boundary_displacement = avg_distance(matched_pairs)  # 平均偏移小節數
    
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "avg_displacement": boundary_displacement,
    }
```

### 8.3 Phase 0 通過標準

- 古典時期作品 (Mozart, Haydn): F1 ≥ 0.75
- 浪漫派作品: F1 ≥ 0.60
- 印象派作品: F1 ≥ 0.45 (此風格本身就難,系統承認限制)
- 平均邊界偏移 ≤ 1.5 小節

未達標時的應對:
1. 檢視訊號權重是否需重新平衡 (用 ground truth 做迴歸調參)
2. 補充訊號 (motif repetition 提前到 Phase 0)
3. 接受並在 UI 上提示「此風格系統判斷較不穩,建議手動檢視」

---

## 9. 已知限制

1. **賦格與對位作品**: 主題在不同聲部遞迴,單聲部樂句偵測會錯亂。Phase 1 標註為「不支援」,Phase 2 引入 subject tracking 後處理。

2. **無調性 / 序列音樂**: 終止式訊號失效,大幅依賴弱訊號。Phase 1 接受 F1 < 0.5。

3. **連環樂句 (Wagner-style endless melody)**: 樂句邊界本身就模糊。系統會傾向切過長,需使用者大量介入。

4. **節奏複雜現代作品 (Bartók, Stravinsky)**: 拍號頻繁變化會產生過多中訊號,可能過度切分。

---

## 10. 變更紀錄

| 版本 | 日期 | 變更 |
|------|------|------|
| 0.1.0 | 2026-05-18 | 初版 |

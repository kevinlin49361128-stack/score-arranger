# Score Arranger — 產品狀態 + 市場地位分析

**版本：** 0.1.21（2026-05-23）
**作者：** Kevin Lin
**狀態：** 個人開發專案，可散佈但未公開營運

---

## 1. 產品現況快照

### 1.1 量化指標

| 指標 | 數值 |
|---|---|
| 程式碼規模 | engine Python ~30k LOC, renderer TS ~25k LOC |
| 測試覆蓋 | 615 engine pytest + 10 frontend vitest，全綠 |
| 功能模組 | 22 個主要模組（parser/analyzer/arranger/validator/...） |
| 樂器知識庫 | 18 種樂器（弦/管/鍵盤），含音域/多音/弓法/技巧約束 |
| 內建範例庫 | 45 首（巴洛克 → 浪漫派，含 Bach/Mozart/Beethoven/Brahms） |
| 支援匯入格式 | MusicXML / MIDI / ABC / Lilypond / PDF (OMR) / 音訊 (AMT) |
| 支援匯出格式 | MusicXML / MIDI / PDF 總譜 / PDF 分譜 |
| 支援編制 | 7 個預設 + 自訂 ensemble builder |
| 改編品質指標 | 旋律保留 + 和聲完整 + 可演奏性（三軸量化） |
| 散佈版本 | macOS Apple Silicon，已 Developer ID 簽章 + 公證 |
| 安裝檔大小 | 192MB ZIP / 200MB DMG（含 PyInstaller 凍結引擎） |
| 開源授權 | GPL-3.0 |

### 1.2 技術棧

- **前端**：Electron 42 + React 18 + TypeScript + Vite + Zustand
- **譜面渲染**：OpenSheetMusicDisplay (OSMD) + Verovio（PDF 匯出）
- **引擎**：Python 3.11+（music21 解析、自訂 IR、規則 + DP 演算法）
- **播放**：Tone.js + 真實取樣（Salamander Piano、nbrosowsky 弦樂、gleitz 大鍵琴）
- **AI 整合**：Anthropic API / OpenAI-compat / Ollama（LLM 改譜）+ MCP server

### 1.3 9 個關鍵功能差異化點

1. **約束式聲部分配 + 定向修復迴圈** — 不是「搬位置 + 修改錯誤」，而是改編當下就遵守約束；修復每輪必須嚴格減少全局問題數，否則 rollback
2. **樂句級主旋律換手** — 主旋律僅在樂句邊界換聲部（音樂上自然），不是任意小節跳換
3. **弦樂指法 Viterbi DP** — 跨事件最佳化把位轉移成本
4. **雙向難度閉環控制** — 給定目標難度 1-5，自動加厚或簡化抹平（業界獨家）
5. **巴洛克 figured-bass continuo realization** — 解析 `<figured-bass>` → 自動實現
6. **自然語言改譜** — LLM 翻成 8 種結構化操作，使用者勾選確認，顯示品質 delta
7. **MCP server** — 暴露整套引擎能力給外部 AI agent
8. **直接 IR → MusicXML 序列化** — 繞過 music21 匯出的記譜 bug
9. **完整可演奏性檢查** — 音域、多音、弦樂和弦、弓法、平行 5/8 度…

### 1.4 安全強化（0.1.20-0.1.21）

通過完整 security audit + 修補：
- Electron 31 → 42（清 17 條 CVE）
- 完整 CSP（限第三方 SoundFont 域名）
- Navigation guard + sandbox + dialog token
- LLM op 白名單
- MCP 寫檔路徑限制（拒 `~/.ssh` / `~/Library`）
- JSON-RPC size limit
- 整體風險：低（單機桌面 + 公證 + contextIsolation + sandbox）

---

## 2. 競品比較矩陣

### 2.1 直接競品：notation software 內建編曲功能

| 工具 | 自動改編 | 樂句感知 | 難度閉環 | 指法 DP | figured-bass | LLM 整合 | 價格 | 平台 |
|---|---|---|---|---|---|---|---|---|
| **Sibelius** (Avid) | ✅ 130+ style template (pattern matching) | ❌ | ❌ | ❌ | ❌ | ❌ | $199/年 訂閱 | Win/Mac |
| **Dorico** (Steinberg) | △ Reduce/Explode（陽春） | ❌ | ❌ | ❌ | ❌ | ❌ | $579 買斷 | Win/Mac/iPad |
| **MuseScore 4** | ❌ 只有手動 Implode + community plugin | ❌ | ❌ | ❌ | ❌ | ❌ | 免費 (GPL) | Win/Mac/Linux |
| **Capella** | ❌ | ❌ | ❌ | ❌ | ✅ realize figured bass | ❌ | EUR 99-199 | Win/Mac |
| **LilyPond** | △ 手寫 Scheme `\partcombine` | ❌ | ❌ | ❌ | ❌ | ❌ | 免費 (GPL) | Win/Mac/Linux |
| **Finale** | (停產 2024) | — | — | — | — | — | — | — |
| **Score Arranger 0.1.21** | ✅ 約束式分配 + 定向修復 | ✅ phrase-aware handoff | ✅ 雙向閉環 1-5 級 | ✅ Viterbi DP | ✅ MVP | ✅ NL panel + MCP | 免費 (GPL) | Mac (Apple Silicon) |

### 2.2 教師/學生向工具

| 工具 | 給定難度 → 簡化 | 顯示指法 | 古典樂譜支援 | 模式 |
|---|---|---|---|---|
| **Soundslice** | 手動編輯 | ❌ | ✅ | Web |
| **ScoreCloud** | ❌ | ❌ | △ 流行樂為主 | Win/Mac/iOS |
| **Solfeg.io** | ✅（簡化流行歌） | ❌ | ❌ 流行樂為主 | Web |
| **Flat.io** | ❌（雲端協作） | ❌ | ✅ | Web |
| **Score Arranger** | ✅ 自動雙向閉環 | ✅ 弦樂 Viterbi DP | ✅ 古典為主 | Mac 桌面 |

### 2.3 AI 音樂生成（不直接競爭，但常被混淆）

| 工具 | 模式 | 是否改編 input | 商業狀態 |
|---|---|---|---|
| **Suno / Udio / AIVA** | from-scratch 生成 | ❌ | 訂閱 SaaS |
| **MuseNet** | (OpenAI 已關) | — | — |
| **AnthemScore** | audio→MIDI + 簡易拆譜 | △ | $79 買斷 |
| **學界（ISMIR 論文）** | piano reduction (BERT) | ✅ 但無產品化 | 研究 prototype |
| **學界（violin fingering）** | BLSTM/VAE | ✅ 99.1% accuracy | 研究 prototype |

---

## 3. 市場規模

- **全球 notation software 市場**：約 **$1-1.5B 年產值**（中位數，多源估值 $0.5B-$2.74B），CAGR ~8%
- **MuseScore.com**：200k+ DAU、1.3M+ 公開譜、月活 < 45M（EU 數據）— 市場主導者
- **用戶結構**：作曲家 / 編曲家 / 音樂教師 / 學生 / 業餘音樂人；教育市場是主要成長驅力

---

## 4. Score Arranger 的市場定位

### 4.1 真實競爭優勢（有量化或事實支撐）

| 優勢 | 證據 |
|---|---|
| **唯一的雙向難度閉環** | 競品掃過：MuseScore/Dorico/Sibelius/Capella 皆無 |
| **唯一的樂句級主旋律換手** | Sibelius Arrange 是 style template，不看樂句 |
| **唯一商業整合的弦樂指法 DP** | 學界有 prototype，無 notation app 整合 |
| **唯一的 LLM 改譜 + MCP** | 競品為 2026 LLM-agent 時代留下整整 12-18 個月 lead time |
| **playability check** 完整度 | MuseScore/Sibelius 不做 ex-ante validation |

### 4.2 真實劣勢（必須誠實面對）

| 劣勢 | 影響 |
|---|---|
| **macOS-only** | 立刻砍掉 70%+ 市場（音樂教師、學校教室幾乎全 Windows） |
| **GPL-3.0** | 個人無感；商業 OEM / 教育機構整合會被法務擋；自己也擋掉了未來商業化選項 |
| **品牌 / 信任** | 個人開源 vs Avid（30 年）/ Steinberg（Yamaha 子公司） |
| **編輯功能完整度** | 不是 Sibelius 替代品，是「改編加值層」；新手會嫌缺基礎功能 |
| **沒有原生 OMR 入口（要外掛 Audiveris）** | 教師最大痛點，但目前要先裝 Audiveris |
| **沒有訂閱、沒有付費** | 沒有商業模式 = 沒有 marketing budget = 沒有觸及力 |

### 4.3 可佔的 niche（按優先序）

1. **古典弦樂教師**（特別是小提琴 / 弦樂老師）
   - 痛點：「給程度 X 的學生簡化這首」+「顯示把位指法」
   - 競品全做不到。
   - 預估族群：全球古典樂教師 ~50 萬人（音樂院 / 私人 / 學校），活躍 macOS 用戶 ~15-20%
2. **業餘室內樂團體**（弦樂四重奏、教會合奏、社區樂團）
   - 想拉某首交響曲但需要降難度版本
3. **編曲教學**
   - 拿「LLM 改譜面板顯示中間決策」教學生「為什麼這樣分配聲部」
4. **不建議直攻**專業編曲師
   - 他們有 Sibelius/Finale workflow，且大多 Windows

### 4.4 LLM 整合的真實價值評估

| 對誰 | 是噱頭 還是 真實優勢 |
|---|---|
| 資深編曲師 | **噱頭** — 他們已會說「把第二小提琴從 D 弦換到 A 弦」，不需要 NL |
| 音樂教師 | **真實優勢** — 「這段太難了，幫我簡化」是教師日常語言 |
| 業餘者 | **真實優勢** — 不懂術語，但會描述想要的感覺 |
| MCP 暴露 | **目前是技術示範** — 1-2 年內 AI agent 生態成熟後變成 moat |

---

## 5. 致命的反方論點

1. **「自動編曲」是 1990s 就有的功能** — Sibelius Arrange 上市超過 25 年，市場接受度始終不高。表示**人們可能本來就不要全自動，要的是工具效率**。Score Arranger 的「人機協作」定位是對的，但要避免被誤定位成「AI 自動編曲機」。

2. **macOS-only + 個人專案 + 無商業模式** — 進教育機構幾乎不可能；個人用戶買單意願是大問號。GitHub Star 可以拿，下載量上不去。

3. **MuseScore/Dorico 隨時可能加類似功能** — 2026 是「所有 notation software 加 LLM」的元年。先發優勢窗口可能只有 **12-18 個月**。MuseScore 5 / Dorico 7 一旦加 NL 改譜面板，Score Arranger 的 LLM 賣點立刻被攤平。

4. **唯一護城河是引擎深度（難度閉環 + 樂句 handoff + 指法 DP）** — 這些是大廠 1-2 年才追得上的，但**只對「真的會用到」的使用者有差** — 也就是音樂教師 + 業餘室內樂這個小但精準的 niche。

---

## 6. 戰略建議

### 6.1 短期（3 個月內）

1. **聚焦弦樂教師 niche** — landing page 主標改成「為學生編譜的智慧助手」，不是「智慧樂譜改編工具」
2. **真實使用者訪談 ≥ 5 位** — 音樂教師 / 業餘室內樂團體
3. **不要追完整 notation editor 功能** — 維持「改編加值層」定位，匯出到 MuseScore/Dorico 編輯
4. **GitHub Release + 社群觸及** — Reddit r/violinist、r/violinteacher、台灣音樂教師 FB 社團

### 6.2 中期（6-12 個月）

1. **Windows 版** — 砍掉 macOS-only 限制，市場立刻 ×3+
2. **OMR 原生整合**（內建 Audiveris bundle 或自寫輕量 OMR） — 教師痛點
3. **再評估授權** — GPL-3.0 vs MIT/dual-license（讓商業整合可能）
4. **教學內容** — YouTube / 文章示範「3 步驟把交響曲改編給學生」

### 6.3 長期（1-2 年）

1. **AI agent workflow** — MCP 整合 Claude Desktop / Cursor，做「對話式編曲」demo
2. **小規模商業化** — 教育機構 site license（保持個人免費）
3. **學術合作** — 跟音樂院合作做使用研究，發 ISMIR 論文（指法 DP / 難度閉環演算法可發 paper）

---

## 7. 一句話總結

> Score Arranger 是**目前唯一**把「樂句感知改編 + 雙向難度閉環 + 弦樂指法 DP + LLM 改譜」**整合在同一個工具**的桌面 app。引擎深度有 12-18 個月 lead time，但 macOS-only + GPL + 個人專案的組合**嚴重限制觸及力**。
>
> 戰略上，應該**捨棄追平 Sibelius/Dorico 完整度的幻想**，把弦樂教師 niche 打深、做出 Windows 版，並考慮授權彈性化。
>
> 引擎差異化是真的；商業可行性是大問號。

---

*Sources: Steinberg / Avid 官方產品頁、MuseScore.org、Capella software、VerifiedMarket / Valuates Reports、ISMIR 2024-2026 論文、GitHub Tsung-Ping/Violin-Fingering-Generation。*

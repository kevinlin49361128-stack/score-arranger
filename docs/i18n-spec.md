# i18n 與音樂術語語言規範

> 版本: 0.1.0 (Draft)
> 最後更新: 2026-05-18
> 對應前次討論「介面語言配置」

---

## 1. 四維度語言模型

Score Arranger 的「語言」不是單一維度,而是**四個獨立維度**,常被混淆:

| 維度 | 範例 | 該本地化? | Phase 1 預設 |
|------|------|-----------|-------------|
| **A. UI 介面文字** | 「匯入總譜」「套用建議」 | ✅ 完全本地化 | 繁體中文 (zh-TW) |
| **B. 音樂表情術語** | `allegro`, `pp`, `staccato`, `cresc.` | ❌ **永不翻譯** | 義大利文原樣 |
| **C. 樂器名稱** | Violin / 小提琴 / Violino | ⚠️ 雙語並列顯示 | 中＋英 |
| **D. 音高記法** | C4 vs H4 vs Do₄ | ✅ 使用者可選 | 英文制 (C-D-E-F-G-A-B) |

### 1.1 為何「音樂術語永不翻譯」

樂譜上若把 `pianissimo` 翻成「很弱」:
- 樂譜輸出後其他音樂人 (指揮、樂團夥伴) 看不懂
- 出版慣例違反 (全世界出版社都用義大利文)
- 細節遺失 (`p`, `pp`, `ppp` 三級在中文只能「弱、很弱、極弱」勉強對應,且失去視覺對稱)

**例外**: 使用者面向的**說明文字** (issue 卡片描述、tooltip) 可以翻譯。

```
譜面上保留:    Allegro con brio  ♩=132  ff  staccato
Issue 卡片翻譯: 「第 32 小節 小提琴: 五音和弦超出弦數,建議省略第五音」
```

### 1.2 為何「音高記法可選」

古典樂教育傳統強烈分歧:

| 系統 | C | D | E | F | G | A | B♭ | B | 使用地區/場景 |
|------|---|---|---|---|---|---|----|---|---------------|
| **英文制** | C | D | E | F | G | A | B♭ | B | 英美、台灣現代音樂教育 |
| **德文制** | C | D | E | F | G | A | **B** | **H** | 德奧、東歐、巴洛克文獻 |
| **固定唱名** | Do | Re | Mi | Fa | Sol | La | Si♭ | Si | 法、義、西、拉丁系 |
| **首調唱名** | (隨調性移動) | | | | | | | | 台灣中小學音樂課、合唱訓練 |

**關鍵陷阱**: 德文制的 `B` = 英文制的 `B♭`,讀錯一個半音。讀巴赫文獻 (BWV) 或舒曼書信時常見。

**內部一律用 MIDI number** (見 ir-spec.md §3.1),顯示層才轉換。

---

## 2. UI 文字 i18n (維度 A)

### 2.1 技術選型

- **前端 (Renderer)**: `react-i18next`
  - 命名空間 (namespace) 支援
  - 巢狀 key 結構
  - Pluralization 支援
  - 動態切換 locale 不需重啟
  
- **後端 (Python Engine)**: 訊息以**錯誤代碼**回傳,絕不在 Python 寫死中文
  ```python
  # 不要:
  return Error("和弦音數超過弦數")
  
  # 要:
  return Error(code="E_STRING_CHORD_EXCEED", params={"chord_size": 5, "max": 4})
  ```
  前端的 i18n 字典把 code → 翻譯字串

### 2.2 Locale 代碼

採用 BCP 47:
- `zh-TW` 繁體中文 (Phase 1)
- `zh-CN` 簡體中文 (Phase 2)
- `en` 英文 (Phase 2)
- `ja` 日本語 (Phase 3)
- `de` 德文 (Phase 3+,音樂市場大但本地化成本高)

### 2.3 字典檔結構

```
src/renderer/i18n/
├── index.ts                # i18next 初始化
├── locales/
│   ├── zh-TW/
│   │   ├── common.json     # 共用 UI (按鈕、選單)
│   │   ├── setup.json      # Setup mode
│   │   ├── analyze.json    # Analyze mode
│   │   ├── arrange.json    # Arrange mode
│   │   ├── refine.json     # Refine mode
│   │   ├── export.json     # Export mode
│   │   ├── issues.json     # 問題訊息 (對應後端 error codes)
│   │   ├── instruments.json # 樂器名稱中譯
│   │   └── tooltips.json   # 提示文字
│   └── (other locales)
```

### 2.4 Key 命名規範

```
<namespace>.<section>.<element>
```

範例:
```json
{
  "common.button.import": "匯入總譜",
  "common.button.export": "匯出",
  "common.button.apply": "套用",
  "common.button.dismiss": "忽略",
  "setup.title": "編制設定",
  "setup.ensemble.violin_piano": "小提琴 + 鋼琴",
  "analyze.legend.melody": "主旋律",
  "analyze.legend.bass": "低音",
  "arrange.drag.hint": "拖拽到目標聲部以重新分配",
  "issues.E_STRING_CHORD_EXCEED": "和弦音數 {{chord_size}} 超過 {{max}} 弦限制",
  "issues.W_PIANO_HAND_SPAN": "{{hand}}手跨度 {{span}} 半音,需要大手型"
}
```

**規則**:
- 全小寫,以 `.` 分隔
- 錯誤代碼用大寫 (與後端 error code 一致): `issues.E_*`, `issues.W_*`, `issues.I_*`
- 參數用 `{{name}}` (i18next 標準)

### 2.5 樂譜內部標記 (Hover Tooltip) 的特殊處理

譜面上某個和弦有錯誤,hover 顯示提示。提示包含**兩種文字**混合:

```
譜面顯示:  [和弦 C-E-G-B-D♯]   ← 譜面文字一律不翻譯 (音名等)
Tooltip:   m.32 小提琴: 五音和弦超出弦數限制 ← UI 文字翻譯
建議1:     省略第五音 (移除 D♯) ← UI 文字翻譯, 但 D♯ 是音名不翻譯
建議2:     拆為琶音           ← UI 文字翻譯
```

**實作**: 後端回傳結構化 issue,前端組裝:
```ts
const issue = {
  code: "E_STRING_CHORD_EXCEED",
  location: { measure: 32, part: "violin" },
  params: { 
    chord_pitches: ["C4", "E4", "G4", "B4", "D#5"],  // 音名: 顯示層轉換
    chord_size: 5,
    max: 4
  },
  suggestions: [
    { code: "S_OMIT_NOTE", params: { note: "D#5" } },
    { code: "S_ARPEGGIATE", params: {} },
  ]
};
// 前端: t(issue.code, issue.params) → "m.32 小提琴: 五音和弦超出 4 弦限制"
```

---

## 3. 音樂表情術語 (維度 B)

### 3.1 完全不翻譯的清單

| 類別 | 範例 | 處理方式 |
|------|------|----------|
| 力度 | `ppp`, `pp`, `p`, `mp`, `mf`, `f`, `ff`, `fff`, `sf`, `sfz`, `fp` | 原樣顯示 |
| 速度標記 | `Allegro`, `Andante`, `Largo`, `Presto` | 原樣顯示 |
| 速度變化 | `ritardando`, `accelerando`, `rit.`, `accel.`, `a tempo` | 原樣顯示 |
| 演奏法 | `staccato`, `legato`, `pizzicato`, `arco`, `con sordino`, `senza sordino` | 原樣顯示 |
| 漸變 | `crescendo`, `diminuendo`, `cresc.`, `dim.`, `decresc.` | 原樣顯示 |
| 反覆 | `D.C.`, `D.S.`, `al Fine`, `al Coda` | 原樣顯示 |
| 結構 | `Coda`, `Segno`, `Fine` | 原樣顯示 |

### 3.2 例外: 解釋性 Tooltip 可翻譯

當使用者**hover 在術語上**或**首次使用**時,可顯示解釋:

```
譜面: Allegro con brio
Tooltip (zh-TW): 「快板,帶活力地」(義大利文)
```

實作方式:
- 維護一份 `musical-terms-glossary.json`,key = 義大利文原文, value = 各語言釋義
- Phase 2 才實作,Phase 1 不做

```json
{
  "allegro": {
    "zh-TW": "快板,通常 ♩=120-168",
    "en": "Fast, typically ♩=120-168"
  },
  "con brio": {
    "zh-TW": "帶活力地、有精神地",
    "en": "with vigor, spirited"
  }
}
```

---

## 4. 樂器名稱 (維度 C)

### 4.1 多語對照資料

每個樂器在 InstrumentProfile 內維護多語名稱:

```python
@dataclass
class InstrumentNames:
    en: str                              # "Violin"
    en_abbr: str                         # "Vln."
    it: str                              # "Violino"
    it_abbr: str                         # "Vl."
    de: str                              # "Violine"
    de_abbr: str                         # "Vl."
    fr: str                              # "Violon"
    fr_abbr: str                         # "Vn."
    zh_tw: str                           # "小提琴"
    zh_tw_abbr: str                      # "小提"
    ja: str                              # "ヴァイオリン"
    ja_abbr: str                         # "Vn"
```

### 4.2 顯示策略

| 情境 | 顯示語言 | 範例 |
|------|----------|------|
| **譜面上的聲部標籤** | 跟隨原譜 (匯入時偵測),或使用者全域設定 | "Violin I" 或 "Violino I" |
| **編制選擇器** | UI locale + 英文括號 | "小提琴 (Violin)" |
| **Player 清單** | 雙語並列 | "🎻 小提琴 / Violin" |
| **Issue 訊息中提到樂器** | UI locale | 「小提琴的把位跳躍...」 |
| **匯出檔案** | 跟隨原譜慣例或使用者選擇 | 視 Layout 設定 |

### 4.3 樂器 ID 永遠用英文蛇形

內部識別碼與顯示完全解耦:
```python
"violin", "viola", "cello", "double_bass",
"flute", "oboe", "clarinet_in_bb", "bassoon",
"horn_in_f", "trumpet_in_bb", "trombone", "tuba",
"piano", "harpsichord", "organ", "harp",
"timpani", "snare_drum", ...
```

---

## 5. 音高記法系統 (維度 D)

### 5.1 內部表示

IR 內 `Pitch.midi_number` 是唯一真相 (0-127)。`Pitch.spelling` 預設用**英文制 + ASCII**:
- 升: `#` (不用 `♯`)
- 降: `b` (不用 `♭`)
- 重升: `##`
- 重降: `bb`
- 還原: `n` (僅在拼寫歧義時使用)
- 八度: 國際標準 (中央 C = C4)

範例: `"C4"`, `"F#5"`, `"Bb3"`, `"C##4"`, `"Cb3"`

### 5.2 顯示層轉換

使用者設定 `notation_system` 影響顯示:

| 設定 | midi=58 (B♭3) 顯示為 | midi=59 (B3) 顯示為 |
|------|-----------------------|---------------------|
| `english` (預設) | `B♭3` 或 `Bb3` | `B3` |
| `german` | `B3` | **`H3`** ⚠️ |
| `fixed_solfege` | `Si♭3` | `Si3` |
| `movable_solfege` | (依當前調性) | (依當前調性) |

⚠️ 德文制要小心: B/H 對應是音樂人最常吵的點。UI 切換時應跳出一次性提示:「您已切換為德文制,請注意 B 代表英文制的 B♭」。

### 5.3 升降號顯示

```
notation_system + accidental_style 組合:
- english + ascii:     C#4, Bb3
- english + unicode:   C♯4, B♭3
- german + ascii:      Cis4, B3   ← 德文用 -is/-es 後綴
- german + unicode:    Cis4, B3
- solfege + ascii:     Do#4, Sib3
- solfege + unicode:   Do♯4, Si♭3
```

### 5.4 八度標示

| 設定 | C4 顯示為 |
|------|-----------|
| `american` (預設) | `C4` |
| `helmholtz` | `c'` (小寫 + 上撇) ← 古典德奧傳統 |
| `none` | `C` (不標八度,僅用於講解抽象音高) |

Helmholtz 對照表:
```
C2 = C,,     C3 = C,      C4 = c       C5 = c'      C6 = c''
```

---

## 6. 使用者設定面板 (Phase 2)

UI 在「偏好設定」提供:

```
┌─ 偏好設定 ───────────────────────────────┐
│                                          │
│ 介面語言:    [繁體中文 ▼]                  │
│                                          │
│ 音名系統:    (●) 英文 (C-D-E-F-G-A-B)     │
│              ( ) 德文 (C-D-E-F-G-A-B-H)   │
│              ( ) 固定唱名 (Do-Re-Mi-...)  │
│              ( ) 首調唱名                  │
│                                          │
│ 升降號:      (●) Unicode (♯ ♭)            │
│              ( ) ASCII (# b)              │
│                                          │
│ 八度標示:    (●) 美式 (C4)                 │
│              ( ) Helmholtz (c')           │
│                                          │
│ 樂器名稱:    [雙語並列 ▼]                  │
│              選項: 中文 / 英文 / 義大利文  │
│                    / 雙語並列             │
│                                          │
└──────────────────────────────────────────┘
```

Phase 1: 不開放設定面板,寫死預設值 (繁中 + 英文制 + Unicode + 美式 + 雙語並列)。

---

## 7. 各 Phase 支援範圍

| Phase | UI 語言 | 音樂術語 | 樂器名稱 | 音名系統 |
|-------|---------|----------|----------|----------|
| **Phase 1** | zh-TW 單一 | 義大利文不可改 | 中英雙語固定 | 英文制不可改 |
| **Phase 2** | + zh-CN, en | 同上 | 加入義/德可選 | + 德文制可選 |
| **Phase 3** | + ja | 加入 hover 解釋 | + 法、俄 | + 唱名系統 |

---

## 8. 開發守則

### 8.1 Python 端 (Engine)

1. **絕不寫死 UI 字串**: 所有訊息透過 `code` + `params` 結構回傳
2. **絕不假設客戶端 locale**: 不在 Engine 內做翻譯查表
3. **樂器內部 ID 用英文蛇形,顯示名透過 InstrumentNames 取**

```python
# 好:
issue = PlayabilityIssue(
    code="E_STRING_CHORD_EXCEED",
    severity=IssueSeverity.ERROR,
    location=(32, 0),
    target_part_id="violin",
    params={"chord_size": 5, "max": 4}
)

# 不好 (寫死中文):
issue = PlayabilityIssue(
    severity=IssueSeverity.ERROR,
    description="小提琴和弦音數 5 超過 4 弦限制"
)
```

### 8.2 TypeScript/React 端 (UI)

1. **絕不在 component 內寫死中文字串**,一律走 `t(key)`
2. **音名/和弦名透過 `formatPitch(pitch, prefs)` 統一格式化**
3. **樂器名透過 `formatInstrumentName(id, prefs, context)` 統一**

```tsx
// 好:
<button>{t('common.button.apply')}</button>
<span>{formatPitch(note.pitch, userPrefs)}</span>

// 不好:
<button>套用</button>
<span>{note.pitch.spelling}</span>  // 沒考慮使用者設定
```

### 8.3 不可違反的紅線

1. ❌ Python 回傳中文字串給前端
2. ❌ 譜面上的音樂表情術語被翻譯成中文
3. ❌ 在多處重複維護同一個樂器的中譯
4. ❌ 用 `if locale == 'zh-TW': ...` 這種硬編碼分支

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|------|------|------|
| 0.1.0 | 2026-05-18 | 初版,定義四維度模型與 Phase 1 範圍 |

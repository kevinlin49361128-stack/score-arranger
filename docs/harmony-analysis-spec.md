# 完整羅馬數字和聲分析 — 設計規格 (A1b)

> **狀態**: 設計階段 / 0.1.28 skeleton only
> **背景**: A1a (0.1.27 已實作) 用啟發式守住 80% 場景 (三度/七度禁刪).
> 本文件設計完整版 — 把和聲分析升級成「真正的羅馬數字」, 讓 repair / quality /
> LLM 提示都能用上和聲功能語境.

---

## 1. 為什麼需要

當下 (A1a) 的 `_harmonic_omit_choice` 用音程啟發式:

- 三度 (3 / 4 半音) → 保留
- 七度 (10 / 11 半音) → 保留
- 完全五度 / 八度 → 可省
- 重複根音 → 最該省

問題:

1. **看不到調性** — 不知道目前是 C major 還是 a minor.
2. **看不到和弦功能** — V7 的 7 度 (致音, 必留) vs ii 的 7 度 (添加音, 可省).
3. **看不到語境** — 終止式裡的 vii°6 vs 經過和弦的 vii°6, 結構地位差異大.
4. **LLM 提示寫不出和聲術語** — 現在說「省略次要音」, 不能說「省略 V7 的 root, 因為 bass 已有」.

---

## 2. 設計目標

A1b 完成後:

- ✅ 每個 measure / beat 標一個 `HarmonicRegion`: 調性 + 羅馬數字 + 反轉位
- ✅ `repair.omit_note` 能依和弦功能決定刪音優先級 (V7 致音絕對留, I 重複根音先省)
- ✅ `quality.harmony_completeness` 升級為「和弦覆蓋率」(各和弦音是否在 target 出現)
- ✅ LLM `llmEditPlan` 多送和聲 context 給模型, 可寫出「請保留 V7 的導音」這類指令

---

## 3. 資料模型

```python
# engine/core/ir.py 新增 (Phase 1)

@dataclass
class Key:
    """調性. tonic = MIDI pitch class (0-11); mode = 'major' / 'minor'."""
    tonic: int
    mode: Literal["major", "minor"]

    @property
    def name(self) -> str:
        """例如 "C major", "a minor"."""
        ...

@dataclass
class RomanNumeral:
    """羅馬數字標記. 例如 V7, vii°6, IV6/4, N6 (拿坡里六和弦)."""
    degree: int                 # 1-7 (I, ii, iii, ...)
    quality: Literal[
        "major", "minor", "diminished", "augmented",
        "dominant7", "minor7", "major7", "half_diminished", "fully_diminished",
    ]
    inversion: int = 0          # 0 = 原位, 1 = 第一轉位, 2, 3
    applied_to: int | None = None  # 副屬 / 副下屬 用 (V7/V → applied_to=5)
    figure_string: str = ""     # 用於人類可讀展示, 例 "V7", "vii°6/V"

@dataclass
class HarmonicRegion:
    """一個和弦的時間區間 + 羅馬數字."""
    start_quarter: Fraction     # 起點 (整曲時間軸)
    end_quarter: Fraction       # 終點
    key: Key                    # 當下調性
    roman: RomanNumeral
    confidence: float           # 0-1 (分析信心 — 模稜兩可區間 < 0.7)
```

---

## 4. 模組規劃

```
engine/core/analyzer/
├── harmony.py             # 既有: chord identification (pitch-class set → quality)
├── harmony_function.py    # 新增: 羅馬數字 + 功能標記
└── key_detection.py       # 新增: 調性偵測 (整曲 + per-section)
```

### 4.1 `key_detection.py`

**演算法**: Krumhansl-Schmuckler key-finding (KK profile correlation)

- 用 24 個 key profile (12 major + 12 minor), 與曲子 pitch-class histogram 算 Pearson correlation
- per-section 也跑一次, 找轉調 boundaries (correlation 在某點突然轉強)
- 輸出: `dict[Section, Key]`

### 4.2 `harmony_function.py`

**演算法**: per-beat HMM (Hidden Markov Model)

- 狀態 = (Key, RomanNumeral) 組合
- 觀察 = 該 beat 的 pitch-class set
- 轉移機率: 用語法慣性 (V → I > V → IV > V → VI 等), 從訓練集學或寫 Bach chorale 統計
- Emission 機率: pitch-class set 與和弦 ideal pitches 的 cosine similarity
- Viterbi 解出最佳序列

**訓練資料**: Bach BWV 1-371 chorales (music21 corpus 內建, 已有羅馬數字標註可學)

### 4.3 整合點

- `repair.py` `_harmonic_omit_choice`:
  - 查當下 beat 的 `HarmonicRegion`
  - 若是 V7 → 七音 (致音) penalty score 設極高 (絕對保留)
  - 若是 I → root 重複者最該省 (現在已部分做)
- `quality.py` `harmony_completeness`:
  - 改為「每個 HarmonicRegion 的 ideal pitches 在 target 出現的比例」
- LLM `llmEditPlan`:
  - context 多加一行 `"current_chord": "V7/V (D7) in C major"`

---

## 5. 為什麼 0.1.28 沒做完

**工作量估算**:

| 模組 | 工時 |
|---|---|
| Key 偵測 (KK profile) + 測試 | 1 天 |
| HMM 和聲分析骨架 + Bach chorale 標註 fixture | 2 天 |
| Viterbi 解碼 + 連續性正則化 | 1 天 |
| repair / quality 整合 | 1 天 |
| 整合測試 + 邊界情境 (轉調 / 大小調混合 / 半音和聲) | 2 天 |
| **小計** | **約 1 週** |

一晚做完只會有半套 — 沒 Bach chorale 訓練資料的 HMM 是垃圾, 沒測過的羅馬數字分析會誤導 repair → 反而比啟發式 (A1a) 更糟. 故 0.1.28 只留**設計文件 + 模組骨架 + TODO**, 不接進主流程.

---

## 6. Phase 0 — 骨架 (本次 ship)

只建空模組:

```python
# engine/core/analyzer/harmony_function.py
"""
羅馬數字和聲分析 — A1b skeleton.

A1a (0.1.27) 已實作啟發式刪音 (三度/七度禁刪).
A1b 將在此加完整羅馬數字分析. 規格見 docs/harmony-analysis-spec.md.
"""

from __future__ import annotations

# TODO(A1b): implement key_detection + HMM-based roman numeral analysis
# 期望 API:
#   def analyze_harmony(score: Score) -> list[HarmonicRegion]: ...
#   def find_region_at(regions: list[HarmonicRegion], beat: float) -> HarmonicRegion | None: ...
```

下次 ship 時把這個檔案實作完, repair / quality / LLM 三處接入即可.

---

## 7. 反方論點 (為何不做)

| 反方 | 我的回應 |
|---|---|
| 「A1a 已守住 80% 場景, A1b 邊際效益低」 | 部分對 — 但 V7 的 7 音是「定屬七和弦走向」的關鍵, A1a 看不到, 一刪就壞掉 V→I 終止式. 這個 20% 場景音樂上很關鍵 |
| 「HMM + Viterbi 在現代 music21 dataset 上表現有限, MLP/Transformer 更好」 | 對, 但訓練成本太高. HMM + Bach chorale 啟發式 baseline 比現在啟發式好得多, 夠用 |
| 「LLM 已可分析和聲, 為何不直接問 LLM」 | LLM 不能跑 per-beat (太慢 + 太貴). 引擎本地分析是正路 |

---

## 8. 結論

A1b 已寫設計, 待專注時間 (1 週) 才實作. 0.1.28 維持 A1a 啟發式, 不破壞既有功能.

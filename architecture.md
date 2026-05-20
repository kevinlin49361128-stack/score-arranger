# Score Arranger — 架構設計規格書

> 版本: 0.1.0 (Draft)
> 最後更新: 2026-05-18

---

## 1. 產品定位與目標

### 1.1 問題陳述

現有記譜軟體（Dorico、Sibelius、MuseScore）的「縮編」功能僅執行機械式的音符合併，不考慮樂器的物理約束、演奏可行性、或音樂結構的語義。音樂人在進行管弦改編（如總譜縮編為弦樂四重奏或小提琴+鋼琴）時，仍需完全依賴人工逐音處理。

### 1.2 產品定位

Score Arranger 定位為**智慧輔助改編工具**——系統提供分析、建議與自動約束檢查，人類保留最終音樂決策權。不追求「一鍵完美改編」，而是讓改編工作流程從「逐音手動處理」提升為「審閱與微調系統建議」。

### 1.3 目標使用者

- 需要為排練或演出準備改編譜的職業/業餘音樂人
- 音樂系學生進行配器法練習
- 小型室內樂團需要將管弦曲目改編為可用編制

### 1.4 支援的改編方向

| 原始編制 | 目標編制 |
|----------|----------|
| 管弦樂總譜 | 弦樂四重奏 |
| 管弦樂總譜 | 小提琴 + 鋼琴 |
| 管弦樂總譜 | 鋼琴獨奏 (Piano Reduction) |
| 管弦樂總譜 | 木管五重奏 |
| 室內樂 | 不同編制的室內樂 |
| 鋼琴譜 | 弦樂四重奏 (反向展開) |

Phase 1 僅支援「管弦樂 → 小提琴 + 鋼琴」。

---

## 2. 使用者工作流程

整個操作流程對應音樂人改編時的實際思維順序：

```
Step 1: 匯入總譜 (MusicXML/MIDI)
  ↓
Step 2: 選擇目標編制
  ↓
Step 3: 系統自動分析與初步分配 (可即時預覽)
  ↓
Step 4: 互動式調整 (拖拽重新分配、手動覆寫)
  ↓
Step 5: 可演奏性檢查與建議 (紅/黃/綠燈號 + 一鍵修正)
  ↓
Step 6: 匯出 (MusicXML / MIDI / PDF分譜)
```

### 2.1 關鍵 UI 互動

- **拖拽重新分配**: 在原始譜面板選取樂句，拖至目標聲部。拖拽中即時顯示音域是否超出。
- **問題面板一鍵修正**: 每個問題附帶多個替代方案，可點擊預覽（播放比較），確認後一鍵套用。
- **分段處理**: 大型作品可按段落分別處理，系統確保段落間聲部分配一致性。
- **A/B 比較**: 保存多版改編方案，快速切換比較。

---

## 3. 系統架構

```
┌─────────────────────────────────────────────────┐
│                   前端 (UI Layer)                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐  │
│  │ 總譜瀏覽器 │ │ 編制選擇器 │ │ 互動式分配編輯│  │
│  └───────────┘ └───────────┘ └───────────────┘  │
│  ┌───────────┐ ┌──────────────────────────────┐  │
│  │ 播放引擎  │ │ 可演奏性問題面板 (Issue Panel)│  │
│  └───────────┘ └──────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│               中介層 (Service Layer)              │
│  ┌─────────────────────────────────────────────┐ │
│  │          Arrangement Session Manager         │ │
│  │   (管理整個改編 session 的狀態與 undo/redo)   │ │
│  └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│               核心引擎 (Core Engine)              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │Score     │ │Analysis  │ │Arrangement      │  │
│  │Parser    │ │Engine    │ │Engine           │  │
│  │(解析層)  │ │(分析層)  │ │(改編決策層)     │  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
│  ┌──────────┐ ┌──────────────────────────────┐   │
│  │Constraint│ │Playability Validator         │   │
│  │Database  │ │(可演奏性驗證器)               │   │
│  └──────────┘ └──────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│             資料層 (Data Layer)                   │
│  ┌───────────┐ ┌────────────┐ ┌──────────────┐  │
│  │Instrument │ │Arrangement │ │ User Project  │  │
│  │Knowledge  │ │Rule Sets   │ │ Storage      │  │
│  │Base       │ │            │ │              │  │
│  └───────────┘ └────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────┘
```

### 3.1 前後端通訊架構

```
Electron (Renderer Process)
    ↕ IPC
Electron (Main Process)
    ↕ child_process.spawn / HTTP localhost
Python Core Engine
```

Python 核心引擎以獨立 process 運行，透過 JSON-based API 與 Electron 通訊。選擇此架構而非將 Python 編譯為 WASM 的原因：music21 依賴大量 CPython 生態系（numpy 等），無法直接編譯為 WASM。

---

## 4. 核心模組詳細設計

### 4.1 Score Parser (譜面解析層)

**職責**: 將外部格式轉換為 Internal Representation (IR)。

**輸入格式**:
- MusicXML (.musicxml, .xml) — 主要格式，資訊最完整
- MIDI (.mid, .midi) — 次要格式，需額外的 track-to-part 對應

**解析策略**: 使用 music21 `converter.parse()` 做初始解析，立即轉換為自訂輕量 IR。後續所有運算在 IR 上進行。原因：music21 物件模型在大型總譜上記憶體消耗高、遍歷慢。

#### 4.1.1 Internal Representation (IR) 資料模型

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

class VoiceFunction(Enum):
    MELODY = "melody"
    BASS = "bass"
    COUNTERMELODY = "countermelody"
    HARMONY_FILL = "harmony_fill"
    PEDAL = "pedal"
    ORNAMENTAL = "ornamental"
    UNASSIGNED = "unassigned"

@dataclass
class Pitch:
    midi_number: int          # MIDI 音高編號 (e.g. 60 = C4)
    spelling: str             # 音名拼寫 (e.g. "C4", "F#5")
    
@dataclass
class NoteEvent:
    pitch: Pitch
    duration: float           # 以四分音符為單位 (1.0 = quarter)
    onset: float              # 在小節內的起始位置
    articulations: list[str]  # ["staccato", "accent", ...]
    dynamic: Optional[str]    # "pp", "p", "mp", "mf", "f", "ff"
    is_tied_from: bool        # 是否從前一音符延續
    is_tied_to: bool          # 是否延續到下一音符
    slur_group: Optional[int] # 所屬圓滑線群組 ID
    
@dataclass
class ChordEvent:
    """同時發聲的多個音"""
    notes: list[Pitch]
    duration: float
    onset: float
    articulations: list[str]
    
@dataclass
class RestEvent:
    duration: float
    onset: float

@dataclass
class Voice:
    """單一聲部內的事件序列"""
    events: list[NoteEvent | ChordEvent | RestEvent]
    
@dataclass
class Measure:
    number: int
    voices: dict[int, Voice]            # voice_id → Voice
    time_signature: Optional[tuple]     # (numerator, denominator)
    key_signature: Optional[str]        # e.g. "D major"
    tempo: Optional[float]              # BPM (如果此小節有速度標記)
    expressions: list[str]              # ["cresc.", "rit.", ...]
    rehearsal_mark: Optional[str]       # 排練記號

@dataclass
class Part:
    id: str                             # 唯一識別符
    name: str                           # 樂器名稱 (e.g. "Violin I")
    instrument: str                     # 標準樂器識別 (e.g. "violin")
    measures: list[Measure]
    # 以下由 Analysis Engine 填入
    function_tags: dict[int, VoiceFunction]  # section_index → 該段落的功能標記
    
@dataclass
class Section:
    """段落/樂句邊界 (全曲層級)"""
    id: int
    name: Optional[str]                 # "Exposition", "Development", etc.
    start_measure: int
    end_measure: int
    phrases: list[tuple[int, int]]      # 樂句邊界 [(start, end), ...]

@dataclass
class Score:
    metadata: dict                      # title, composer, etc.
    parts: list[Part]
    sections: list[Section]
    measure_count: int
    global_tempo: float                 # 預設 BPM
    global_key: str                     # 預設調性
    global_time_signature: tuple        # 預設拍號
```

#### 4.1.2 設計決策紀錄

- `function_tags` 放在 Part 而非 Measure 上，因為聲部功能以 section 為單位判定，不逐小節變化。
- `Section` 獨立於 parts 存在，段落結構是全曲共享概念。
- IR 使用純 Python dataclass，不依賴 music21 物件，確保序列化與效能。

---

### 4.2 Analysis Engine (分析層)

**職責**: 填入 IR 中的語義資訊——段落邊界、樂句邊界、聲部功能標記、和聲分析。

#### 4.2.1 主旋律偵測 (Melody Extraction)

採用多層篩選策略：

**第一層 — Skyline Algorithm**: 取每個時間點的最高音。在大多數古典作品中提供 60-70% 基礎準確率。

**第二層 — Contour + Rhythm Salience 評分**: 對每個聲部在每個 section 內計算：
- 級進運動比例 (stepwise_ratio): 相鄰音符為二度的比例，旋律聲部通常 > 0.6
- 音符密度 (note_density): 單位時間內音符數量
- 節奏多樣性 (rhythm_variety): 不同時值的種類數
- 加權公式: `melody_score = 0.4 * skyline_match + 0.3 * stepwise_ratio + 0.2 * note_density + 0.1 * rhythm_variety`

**第三層 — Dynamic/Articulation 權重**: 標記為 f、solo、espressivo 的聲部額外加分。

**樂句同聲部約束的實作**:
```python
def assign_melody_to_target(score: Score, target_ensemble: Ensemble):
    for section in score.sections:
        for phrase_start, phrase_end in section.phrases:
            # 在此樂句範圍內識別主旋律來源
            melody_source = identify_melody_part(score, phrase_start, phrase_end)
            
            # 整個樂句鎖定到同一目標聲部
            target_voice = select_best_target_voice(
                melody_source, 
                target_ensemble,
                phrase_range=(phrase_start, phrase_end)
            )
            
            # 記錄分配: 此樂句的旋律從 melody_source → target_voice
            yield Assignment(
                source=melody_source,
                target=target_voice,
                measure_range=(phrase_start, phrase_end),
                function=VoiceFunction.MELODY,
                is_phrase_locked=True  # 樂句內不可拆分
            )
```

#### 4.2.2 和聲分析 (Harmonic Analysis)

逐拍進行和弦辨識，標記和弦功能。用途：判斷哪些音是和弦音（必須保留）、哪些是經過音/裝飾音（可省略）。

music21 的 `roman.romanNumeralFromChord()` 作為起點。對複雜和聲（增六和弦、拿坡里等）需補充規則。

#### 4.2.3 聲部功能標記 (Voice Function Labeling)

對每個 Part 在每個 Section 內標記功能角色。判斷邏輯優先序：

1. 最高聲部 + 旋律特徵 → `MELODY`
2. 最低聲部 + 根音/五音為主 → `BASS`
3. 與旋律形成對位運動 → `COUNTERMELODY`
4. 長音持續 → `PEDAL`
5. 和弦內音填充 → `HARMONY_FILL`
6. 快速音群裝飾 → `ORNAMENTAL`

改編取捨優先級（壓縮比大時）: MELODY > BASS > COUNTERMELODY > PEDAL > HARMONY_FILL > ORNAMENTAL

---

### 4.3 Instrument Knowledge Base (樂器知識庫)

#### 4.3.1 InstrumentProfile 資料模型

```python
@dataclass
class StringDef:
    """弦樂器的單弦定義"""
    open_pitch: Pitch       # 空弦音高
    index: int              # 弦序號 (0=最低弦)
    
@dataclass
class InstrumentProfile:
    name: str                           # "Violin"
    family: str                         # "string_bowed", "keyboard", "woodwind", ...
    
    # === 音域 ===
    range_absolute: tuple[Pitch, Pitch]      # 物理極限
    range_comfortable: tuple[Pitch, Pitch]   # 常用舒適音域
    range_professional: tuple[Pitch, Pitch]  # 專業級可用音域
    
    # === 多音能力 ===
    max_simultaneous_notes: int         # violin=4, piano=10, flute=1
    polyphony_constraints: list[str]    # 描述性約束條件
    
    # === 弦樂特有 ===
    strings: Optional[list[StringDef]]
    max_stretch_semitones: int          # 同把位最大伸展 (半音數)
    position_change_cost: dict          # {shift_distance: difficulty_score}
    
    # === 鍵盤特有 ===
    max_hand_span_semitones: int        # 單手最大跨度
    independent_voices_per_hand: int    # 每手可獨立聲部數
    
    # === 管樂特有 ===
    breath_required: bool
    max_sustained_beats: int            # 無換氣最大持續拍數 (依速度調整)
    
    # === 通用 ===
    available_techniques: list[str]     # ["pizz", "arco", "tremolo", ...]
    sustain_type: str                   # "bow", "breath", "pedal", "decay"
    transposition: int                  # 移調樂器的半音偏移 (0=C調樂器)
```

#### 4.3.2 預建樂器 Profile (Phase 1)

**小提琴 (Violin)**:
- 弦: G3, D4, A4, E5
- 音域 (absolute): G3 — C8 (含泛音)
- 音域 (comfortable): G3 — E7
- 音域 (professional): G3 — A7
- 最大同時發聲: 4 (每弦一音)
- 同把位伸展: 一般 4 半音，含伸展 6 半音
- 和弦約束: 必須在相鄰弦上；三音/四音和弦需分弓或短促弓奏
- 不可能: 跨越非相鄰弦的同時發聲 (e.g. G弦+A弦跳過D弦的雙音)

**鋼琴 (Piano)**:
- 音域: A0 — C8
- 最大同時發聲: 理論 10，實務單手 5
- 單手跨度: 一般 8-9 半音 (八度)，專業 10-11 半音
- 特殊: 踏板延音、可快速重複同音
- 獨立聲部: 每手 2 條 (共 4 條最大)

#### 4.3.3 弦樂和弦可行性檢查

```python
def validate_string_chord(
    chord: list[Pitch], 
    instrument: InstrumentProfile
) -> ValidationResult:
    """
    驗證一個和弦在弦樂器上是否可行。
    回傳: Ok(difficulty_score) | Warning(message, suggestions) | Error(message, suggestions)
    """
    if len(chord) > len(instrument.strings):
        return Error(
            f"和弦音數 {len(chord)} 超過弦數 {len(instrument.strings)}",
            suggestions=[
                Suggestion("省略最不重要的音", auto_removable_notes(chord)),
                Suggestion("拆為分解和弦", arpeggiate(chord)),
            ]
        )
    
    # 嘗試將每個音分配到弦上 (最低音配最低弦)
    sorted_chord = sorted(chord, key=lambda p: p.midi_number)
    assignments = []
    
    for note, string in zip(sorted_chord, instrument.strings):
        if note.midi_number < string.open_pitch.midi_number:
            return Error(f"{note.spelling} 低於 {string.open_pitch.spelling} 弦空弦音")
        fret = note.midi_number - string.open_pitch.midi_number
        assignments.append(StringAssignment(string=string, fret=fret, note=note))
    
    # 檢查相鄰弦上的音程必須在弦樂器上
    used_string_indices = [a.string.index for a in assignments]
    for i in range(len(used_string_indices) - 1):
        gap = used_string_indices[i+1] - used_string_indices[i]
        if gap > 1:
            return Error(
                f"和弦跨越非相鄰弦 (弦 {used_string_indices[i]} 到 {used_string_indices[i+1]})",
                suggestions=[Suggestion("重新排列音高或省略音")]
            )
    
    # 檢查同把位伸展
    if len(assignments) >= 2:
        fret_positions = [a.fret for a in assignments if a.fret > 0]
        if fret_positions:
            stretch = max(fret_positions) - min(fret_positions)
            if stretch > instrument.max_stretch_semitones:
                return Warning(
                    f"把位伸展 {stretch} 半音超出舒適範圍 ({instrument.max_stretch_semitones})",
                    suggestions=[Suggestion("調整音高配置以減少伸展")]
                )
    
    return Ok(difficulty_score=sum(a.fret for a in assignments) / len(assignments))
```

#### 4.3.4 鋼琴手距檢查

```python
def validate_piano_hand_span(
    notes: list[Pitch],
    hand: str  # "left" | "right"
) -> ValidationResult:
    if len(notes) <= 1:
        return Ok(difficulty_score=0)
    
    sorted_notes = sorted(notes, key=lambda p: p.midi_number)
    span = sorted_notes[-1].midi_number - sorted_notes[0].midi_number
    
    if span > 12:  # 超過八度+大三度
        return Error(
            f"{'左' if hand == 'left' else '右'}手跨度 {span} 半音不可行",
            suggestions=[
                Suggestion("省略內聲部音", remove_inner_voices(notes)),
                Suggestion("將最外音移八度", adjust_octave(notes)),
                Suggestion("拆分到另一手", redistribute(notes)),
            ]
        )
    elif span > 10:  # 超過大十度
        return Warning(
            f"{'左' if hand == 'left' else '右'}手跨度 {span} 半音，需要大手型",
            suggestions=[Suggestion("可考慮使用琶音")]
        )
    
    return Ok(difficulty_score=span / 12.0)
```

---

### 4.4 Arrangement Engine (改編決策引擎)

**輸入**: 分析完成的 IR (含 function_tags) + 目標編制 InstrumentProfile 集合
**輸出**: Assignment Map — 每個原始聲部的每個 section 對應到哪個目標聲部

#### 4.4.1 分配演算法 — 規則驅動的四階段貪婪分配

```
Phase 1: 骨架分配 (確定性)
  - MELODY → 目標編制中音域最適且音色明亮的高音樂器
  - BASS   → 目標編制中最低音域的樂器
  
Phase 2: 填充分配 (啟發式)
  - COUNTERMELODY → 未被佔用的樂器中音域最接近者
  - HARMONY_FILL  → 鍵盤樂器 (如有) 或分散到有空餘能力的聲部
  - PEDAL         → 鍵盤左手 / 弦樂低音持續音
  - ORNAMENTAL    → 壓縮編制中優先捨棄

Phase 3: 衝突解決
  - 同一目標樂器在同一時間超載時:
    - 鋼琴: 檢查手距，必要時省略次要音或移八度
    - 弦樂: 檢查多音和弦可行性，必要時改分解和弦或省略音
    - 管樂: 嚴格單音，多餘音必須移到其他聲部或捨棄

Phase 4: 連貫性修正
  - 確保「樂句同聲部」約束
  - 檢查聲部交叉 (voice crossing)
  - 平滑處理聲部切換點
```

#### 4.4.2 目標編制範例: 小提琴 + 鋼琴

| 原始功能 | 分配目標 | 備註 |
|----------|----------|------|
| MELODY | Violin | 主要旋律載體 |
| BASS | Piano L.H. | 低音線 |
| COUNTERMELODY | Piano R.H. 或 Violin (與旋律交替) | 視音域決定 |
| HARMONY_FILL | Piano R.H. / L.H. | 分散填入鍵盤 |
| PEDAL | Piano L.H. (持續低音) | 配合踏板 |
| ORNAMENTAL | 優先捨棄，或簡化後併入 Violin | 依音樂重要性判斷 |

---

### 4.5 Playability Validator (可演奏性驗證器) + 定向修復迴圈

#### 4.5.1 驗證層次

**層次 A — 靜態規則驗證 (即時)**:
- 音域合法性
- 和弦可行性 (音數、弦距、手距)
- 管樂換氣可行性

**層次 B — 動態序列驗證 (較重)**:
- 弦樂把位路徑模擬 (連續把位跳躍在當前速度下是否可行)
- 鋼琴手部橫移模擬 (快速段落的手位移動)
- 管樂氣息模擬 (連續吹奏時間 vs 換氣點)

**層次 C — 音響結果驗證 (人工)**:
- MIDI/SoundFont 播放，使用者耳朵判斷音樂性
- 系統僅提供播放功能，不自動判斷

#### 4.5.2 Issue 資料模型

```python
class IssueSeverity(Enum):
    ERROR = "error"       # 物理上不可能演奏 (紅)
    WARNING = "warning"   # 技術上可行但難度很高 (黃)
    INFO = "info"         # 建議改善但非必要 (綠)

@dataclass
class Suggestion:
    description: str                    # 用音樂術語描述
    preview: list[NoteEvent]            # 修改後的音符序列
    auto_apply: bool                    # 是否可一鍵套用
    strategy_level: int                 # 對應修復策略 1-5
    
@dataclass
class PlayabilityIssue:
    severity: IssueSeverity
    location: tuple[int, int]           # (start_measure, end_measure)
    target_part: str                    # 目標聲部名稱
    description: str                    # 繁體中文描述
    suggestions: list[Suggestion]       # 至少一個替代方案
    is_resolved: bool = False
    is_manual: bool = False             # 標記為需人工處理
```

#### 4.5.3 定向修復迴圈 (Directed Repair Loop)

```
初始生成 (Arrangement Engine, 軟約束)
    ↓
全譜驗證 (Playability Validator)
    ↓
有 ERROR/WARNING? ── 否 ──→ 完成 ✓
    │
   是
    ↓
取最嚴重問題，嘗試修復策略 (按優先序)
    ↓
修復後重新驗證受影響區域 (非全譜)
    ↓
問題數嚴格遞減? ── 否 ──→ 回滾，試下一策略
    │
   是
    ↓
回到驗證步驟 (最多 10 次迭代)
超過上限則剩餘問題標記為「需人工處理」
```

#### 4.5.4 修復策略優先序 (按音樂影響從小到大)

| 優先級 | 策略 | 說明 | 影響範圍 |
|--------|------|------|----------|
| 1 | 音高微調 | 移八度 | 單一音符 |
| 2 | 省略次要音 | 省略重複根音 > 五音 > 三音 | 單一和弦 |
| 3 | 重新分配到其他聲部 | 移至有空餘容量的聲部 | 局部數小節 |
| 4 | 改寫演奏法 | 和弦→琶音、長音→震音、簡化節奏 | 局部段落 |
| 5 | 段落重新分配 | 整個樂句範圍內重新考慮分配方案 | 整個樂句 |

#### 4.5.5 修復迴圈演算法

```python
def repair_loop(score: Score, target_score: TargetScore, max_iterations: int = 10):
    """
    定向修復迴圈。
    保證: 每次迭代全局問題數嚴格遞減，否則回滾。
    """
    for iteration in range(max_iterations):
        issues = validate_all(target_score)
        
        # 過濾只處理 ERROR 和 WARNING
        actionable = [i for i in issues if i.severity != IssueSeverity.INFO]
        
        if not actionable:
            return target_score  # 收斂
        
        # 取最嚴重的問題
        target_issue = actionable[0]  # 已按嚴重度排序
        current_error_count = len(actionable)
        
        # 嘗試修復策略 (按優先序)
        repaired = False
        for suggestion in target_issue.suggestions:
            snapshot = target_score.snapshot()
            
            suggestion.apply(target_score)
            
            # 只重新驗證受影響區域
            new_issues = validate_scope(
                target_score, 
                scope=suggestion.affected_scope
            )
            new_error_count = count_actionable(new_issues)
            
            if new_error_count < current_error_count:
                repaired = True
                break  # 此策略有效
            else:
                target_score.restore(snapshot)  # 回滾
        
        if not repaired:
            # 所有策略都無法改善，標記為需人工處理
            target_issue.is_manual = True
            continue
    
    return target_score  # 達到最大迭代，剩餘交使用者

def validate_scope(target_score: TargetScore, scope: set) -> list[PlayabilityIssue]:
    """只驗證指定的小節範圍和聲部，避免全譜掃描"""
    issues = []
    for measure_range, part_id in scope:
        issues.extend(validate_part_range(target_score, part_id, measure_range))
    return issues
```

#### 4.5.6 動態序列驗證 — 弦樂把位模擬器

```python
@dataclass
class PositionState:
    current_position: int = 1       # 當前把位 (1-based)
    current_string: int = 0         # 當前所在弦

class StringPositionSimulator:
    """
    模擬弦樂演奏者的左手狀態，
    追蹤把位遷移並評估在特定速度下的可行性。
    """
    def __init__(self, instrument: InstrumentProfile):
        self.instrument = instrument
        self.state = PositionState()
    
    def simulate_passage(
        self, 
        notes: list[NoteEvent], 
        tempo_bpm: float
    ) -> list[PlayabilityIssue]:
        issues = []
        
        for i in range(1, len(notes)):
            prev = notes[i - 1]
            curr = notes[i]
            
            required_position = self._calculate_position(curr.pitch)
            shift_distance = abs(required_position - self.state.current_position)
            
            if shift_distance == 0:
                continue
            
            # 計算實際可用時間 (秒)
            beat_duration = 60.0 / tempo_bpm
            time_available = (curr.onset - prev.onset) * beat_duration
            
            # 經驗法則: 每個把位跳躍約需 0.1 秒基礎 + 距離係數
            time_needed = 0.08 + shift_distance * 0.03
            
            if time_needed > time_available * 0.8:  # 留 20% 餘裕
                severity = (IssueSeverity.ERROR 
                           if time_needed > time_available 
                           else IssueSeverity.WARNING)
                issues.append(PlayabilityIssue(
                    severity=severity,
                    location=(curr.onset, curr.onset),
                    target_part=self.instrument.name,
                    description=(
                        f"從第{self.state.current_position}把位"
                        f"跳至第{required_position}把位"
                        f"(距離{shift_distance})，"
                        f"在 ♩={tempo_bpm} 下"
                        f"{'不可行' if severity == IssueSeverity.ERROR else '有難度'}"
                    ),
                    suggestions=self._suggest_alternatives(prev, curr)
                ))
            
            self.state.current_position = required_position
        
        return issues
    
    def _calculate_position(self, pitch: Pitch) -> int:
        """根據音高推算最佳把位"""
        # 簡化邏輯: 找到能演奏此音的最低把位
        for string in reversed(self.instrument.strings):
            semitones_above = pitch.midi_number - string.open_pitch.midi_number
            if 0 <= semitones_above <= 12:
                position = max(1, (semitones_above - 3) // 2 + 1)
                return position
        return 1
    
    def _suggest_alternatives(
        self, prev: NoteEvent, curr: NoteEvent
    ) -> list[Suggestion]:
        suggestions = []
        # 策略1: 當前音移八度以減少把位跳躍
        octave_shifted = Pitch(
            midi_number=curr.pitch.midi_number - 12,
            spelling=curr.pitch.spelling  # 需重新計算
        )
        if self._is_in_range(octave_shifted):
            suggestions.append(Suggestion(
                description="下移八度以減少把位跳躍",
                preview=[NoteEvent(pitch=octave_shifted, duration=curr.duration, 
                                   onset=curr.onset, articulations=curr.articulations,
                                   dynamic=curr.dynamic, is_tied_from=False, 
                                   is_tied_to=False, slur_group=None)],
                auto_apply=True,
                strategy_level=1
            ))
        return suggestions
```

---

## 5. 前端 UI 設計

### 5.1 技術選型

| 層面 | 技術 | 理由 |
|------|------|------|
| 框架 | Electron | 跨平台桌面應用、可嵌入 OSMD |
| UI 框架 | React + TypeScript | 元件化、型別安全 |
| 譜面渲染 | OpenSheetMusicDisplay (OSMD) | 開源 MusicXML 渲染、品質接近出版等級 |
| 播放 | Tone.js + SoundFont | 瀏覽器環境可用的音訊引擎 |
| 狀態管理 | Zustand 或 Redux Toolkit | 管理複雜的 undo/redo 狀態 |

### 5.2 核心佈局

```
┌────────────────────────────────────────────────────────┐
│ 工具列: [匯入] [匯出] [▶播放] [⏹停止] [↩undo] [↪redo]  │
│         [編制: 小提琴+鋼琴 ▼]                           │
├──────────────────────┬─────────────────────────────────┤
│                      │                                 │
│  原始總譜面板 (唯讀)  │    目標譜面板 (可編輯)           │
│                      │                                 │
│  色彩標記:            │    即時更新的改編結果             │
│  🔴 MELODY           │                                 │
│  🔵 BASS             │    拖拽分配入口                   │
│  🟢 COUNTERMELODY    │                                 │
│  🟡 HARMONY_FILL     │                                 │
│  ⚪ ORNAMENTAL       │                                 │
│                      │                                 │
├──────────────────────┴─────────────────────────────────┤
│  問題面板 (Issue Panel)                    [全部展開/收合]│
│                                                        │
│  🔴 ERROR  m.32-34 Violin: 五音和弦超出弦數限制          │
│     → [方案A: 省略第五音] [方案B: 移至鋼琴] [方案C: 琶音] │
│                                                        │
│  🟡 WARNING  m.45 Piano L.H.: 左手跨度11度              │
│     → [方案A: 省略內音] [方案B: 琶音處理]                │
│                                                        │
│  🟢 INFO  m.67-70 Violin: 把位跳躍可簡化                │
│     → [方案A: 重新選擇把位]                              │
└────────────────────────────────────────────────────────┘
```

### 5.3 關鍵互動規格

#### 拖拽重新分配
- 使用者在原始譜面板選取一段（最小單位：樂句）
- 拖拽到目標譜面板的特定聲部
- 拖拽過程中即時顯示: 音域匹配度（綠/黃/紅色覆蓋）
- 放下後觸發局部重分配 + 重新驗證

#### 問題面板互動
- 每個建議方案可點擊「預覽」→ 播放修改前後的 A/B 比較
- 確認後點擊「套用」→ 一鍵修改 + 重新驗證受影響區域
- 「全部自動修正」按鈕 → 執行完整 repair_loop

#### Undo/Redo
- 每次操作（手動調整、套用建議、自動修復）都產生一個 snapshot
- Ctrl+Z / Ctrl+Y 在 snapshot 間切換
- 狀態管理使用 immutable data pattern

---

## 6. 資料流

```
使用者匯入 MusicXML
    ↓
[Score Parser] → IR (Internal Representation)
    ↓
[Analysis Engine] → IR + function_tags + section_map + phrase_boundaries
    ↓
使用者選擇目標編制
    ↓
[Arrangement Engine]
    ├── Phase 1-4: 規則驅動分配
    ├── [Playability Validator]: 靜態 + 動態驗證
    ├── [Repair Loop]: 定向修復 (最多 10 次)
    └── 輸出: TargetScore + Issue List
    ↓
[UI 渲染]
    ├── 原始譜面板 (IR → OSMD)
    ├── 目標譜面板 (TargetScore → OSMD)
    └── 問題面板 (Issue List → React Components)
    ↓
使用者互動調整
    ├── 拖拽重新分配 → 局部重分配 → 局部重新驗證
    ├── 套用建議方案 → 局部修改 → 局部重新驗證
    └── 手動編輯 → 直接修改 TargetScore → 重新驗證
    ↓
使用者匯出
    ├── MusicXML (可在 MuseScore/Dorico 繼續編輯)
    ├── MIDI (供 DAW 使用)
    └── PDF (分譜，每個聲部獨立頁面)
```

---

## 7. 開發階段規劃

### Phase 0 — 核心可行性驗證 (4-6 週)

**目標**: 用純 Python CLI 驗證三個核心假設。

**驗證項目**:
1. music21 解析 MusicXML 的可靠度（測試 10 首不同風格作品）
2. 主旋律偵測演算法準確率（用已知旋律的作品做 ground truth）
3. 弦樂和弦可行性檢查正確性（手動建立測試案例集）

**具體測試方法**:
- 取一首莫札特弦樂四重奏的管弦改編版，反向測試：輸入管弦版，看系統分配結果與原弦樂四重奏版的相似度
- 量化指標：音符保留率、音域違規率、聲部功能匹配率

**交付物**: 
- Python CLI tool，接受 MusicXML 輸入，輸出分析報告（JSON）
- 測試結果報告與可行性評估

### Phase 1 — MVP (3-4 個月)

**目標**: 最小可用產品，僅支援「管弦樂 → 小提琴 + 鋼琴」。

**功能範圍**:
- Score Parser (MusicXML)
- Analysis Engine (旋律偵測 + 聲部功能標記)
- Arrangement Engine (四階段分配 + 基礎修復迴圈)
- Playability Validator (層次 A: 靜態規則)
- OSMD 譜面顯示（雙面板，唯讀）
- 問題面板（顯示 ERROR 級問題 + 建議）
- 匯出 MusicXML

**不做的**:
- 互動式拖拽
- 播放引擎
- 多種目標編制
- A/B 比較
- Undo/Redo

### Phase 2 — 完整可用版 (3-4 個月)

**新增功能**:
- 互動式拖拽重新分配
- 完整三級可演奏性檢查（含層次 B 動態序列驗證）
- 播放引擎 (Tone.js + SoundFont)
- 多種目標編制（弦樂四重奏、鋼琴獨奏、木管五重奏）
- Undo/Redo
- 問題面板一鍵修正 + 預覽 A/B 比較

### Phase 3 — 打磨與擴展

**新增功能**:
- A/B 版本比較
- 擴展樂器知識庫（豎琴、打擊、銅管細項）
- PDF 分譜匯出
- 分段處理模式（大型作品按段落分別處理）
- LLM 輔助建議（可選：對 HARMONY_FILL 改編方式給出多風格選項）
- MIDI 輸入支援（含 track-to-part 對應 UI）

---

## 8. 技術風險與對策

| 風險 | 嚴重度 | 對策 |
|------|--------|------|
| 主旋律偵測不準確 | 中 | 永遠提供手動覆寫；自動偵測只是建議 |
| 可演奏性規則覆蓋率不足 | 中 | Phase 1 只做基礎物理約束，逐版擴充；建立使用者回饋機制 |
| music21 效能瓶頸 | 高 | 解析後立即轉輕量 IR；備案: Rust + WASM 重寫核心路徑 |
| OSMD 渲染能力限制 | 低 | OSMD 可顯示標準記譜；特殊標記用自訂 SVG overlay |
| 樂句分割準確度 | 中 | 結合規則 (休止符、呼吸記號) + 啟發式 (旋律曲線轉折)；允許手動調整 |
| Electron 應用體積過大 | 低 | Python 引擎可選打包為獨立 binary (PyInstaller) 或要求使用者安裝 Python |

---

## 9. 專案目錄結構 (規劃)

```
score-arranger/
├── CLAUDE.md                     # Claude Code 專案記憶
├── README.md
├── package.json                  # Electron + React
├── tsconfig.json
├── docs/
│   └── architecture.md           # 本文件
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.ts
│   │   └── python-bridge.ts      # 與 Python 引擎的通訊層
│   ├── renderer/                 # React UI
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ScoreViewer.tsx          # OSMD 總譜瀏覽器
│   │   │   ├── TargetScoreEditor.tsx    # 目標譜面板
│   │   │   ├── EnsembleSelector.tsx     # 編制選擇器
│   │   │   ├── IssuePanel.tsx           # 問題面板
│   │   │   └── PlaybackControls.tsx     # 播放控制
│   │   ├── stores/
│   │   │   └── sessionStore.ts          # 狀態管理 + undo/redo
│   │   └── hooks/
│   │       └── useArrangement.ts
│   └── shared/
│       └── types.ts              # 前後端共用型別定義
├── engine/                       # Python 核心引擎
│   ├── requirements.txt
│   ├── server.py                 # HTTP API server
│   ├── core/
│   │   ├── ir.py                 # Internal Representation 資料模型
│   │   ├── parser.py             # Score Parser
│   │   ├── analyzer.py           # Analysis Engine
│   │   ├── arranger.py           # Arrangement Engine
│   │   ├── validator.py          # Playability Validator
│   │   └── repair.py             # 定向修復迴圈
│   ├── instruments/
│   │   ├── base.py               # InstrumentProfile 基礎類
│   │   ├── violin.py
│   │   ├── piano.py
│   │   ├── viola.py
│   │   ├── cello.py
│   │   └── registry.py           # 樂器註冊表
│   └── tests/
│       ├── test_parser.py
│       ├── test_analyzer.py
│       ├── test_arranger.py
│       ├── test_validator.py
│       └── fixtures/             # 測試用 MusicXML 檔案
│           ├── mozart_k458.musicxml
│           └── ...
└── resources/
    └── soundfonts/               # SoundFont 音色檔
```

---

## 附錄 A: 術語表

| 術語 | 定義 |
|------|------|
| IR (Internal Representation) | 系統內部的樂譜資料模型 |
| Reduction | 將大編制總譜壓縮為小編制的改編 |
| Voice Function | 聲部在音樂結構中的功能角色 |
| Directed Repair | 針對特定問題的定向修復策略 |
| Skyline Algorithm | 取每時間點最高音的旋律提取演算法 |
| Phrase Boundary | 樂句的起始/結束邊界 |
| String Assignment | 弦樂和弦中每個音對應到哪根弦的分配 |
| Position (把位) | 弦樂左手在指板上的位置 |

## 附錄 B: 參考資源

- music21 文件: https://web.mit.edu/music21/doc/
- OpenSheetMusicDisplay: https://github.com/opensheetmusicdisplay/opensheetmusicdisplay
- MusicXML 規格: https://www.w3.org/2021/06/musicxml40/
- Tone.js: https://tonejs.github.io/
- Samuel Adler, *The Study of Orchestration* — 配器法參考
- Walter Piston, *Orchestration* — 配器法參考

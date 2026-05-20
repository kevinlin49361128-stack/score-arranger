# Internal Representation (IR) — 資料模型規格書

> 版本: 0.1.0 (Draft)
> 最後更新: 2026-05-18
> 狀態: Phase 0 設計階段
> 對應 architecture.md 章節 4.1

---

## 1. 文件目的與範圍

本文件定義 Score Arranger 內部統一的樂譜資料模型 (Internal Representation, IR)。所有後續模組 — Analysis Engine、Arrangement Engine、Playability Validator、UI Renderer — 一律在 IR 上運算，不直接依賴 music21 物件。

### 1.1 為何需要獨立 IR

| 動機 | 說明 |
|------|------|
| **效能** | music21 物件模型遍歷慢、記憶體消耗高,大型總譜 (1000+ 小節) 在 music21 上做迴圈分析會卡頓 |
| **可序列化** | 改編 session 需存檔、undo/redo 需快照、前後端 IPC 需 JSON,music21 物件無法直接序列化 |
| **解耦** | 未來若 music21 替換為 partitura 或自製 parser,只需改 parser 層,下游不變 |
| **語義增強** | IR 攜帶分析結果 (聲部功能、樂句邊界),music21 沒有對應概念 |

### 1.2 IR 不涵蓋的範圍

- **記譜排版細節** (符桿方向、音符空間佔位、跨頁處理): 由 OSMD 渲染層處理
- **音訊合成參數** (SoundFont 選擇、混音): 由 Playback Engine 處理
- **使用者介面狀態** (選取、捲動位置): 由 Frontend Store 處理

---

## 2. 設計原則

1. **時間用 `Fraction`,不用 `float`**
   - 連音 (5:4, 7:8) 與複雜節奏在浮點下累積誤差,整曲跑下來小節對不齊
   - 序列化時 `Fraction(3, 8)` → `"3/8"` 字串
   
2. **音高分離: 實際發聲 vs 譜上記譜**
   - `Pitch.midi_number` = concert pitch (實際發聲)
   - `Pitch.written_midi` = 譜上看到的音 (移調樂器才非 None)
   - 所有分析在 concert pitch 上進行
   - 渲染與匯出時轉換回 written pitch

3. **不可變優先 (immutable-first)**
   - 所有 dataclass 加 `frozen=True` 是目標,但因 Analysis Engine 需回填 `function_tags`,實務上採「**分層可變性**」: 結構不可變,標註可變
   - 詳見章節 6 (Mutation Policy)

4. **平坦結構優於深層巢狀**
   - 「全域元素」(反覆記號、力度漸變、踏板) 放在 Score 層級,以 (measure, offset) 對應到位置
   - 不在每個 NoteEvent 上重複攜帶這些資訊

5. **音樂術語永遠用英文/義大利文,使用者語言僅在顯示層**
   - dynamic = `"pp"` 而非 `"很弱"`
   - articulation = `"staccato"` 而非 `"斷奏"`
   - i18n 在 UI 完成,IR 是中性格式

6. **顯式優於隱式**
   - 弱起小節用 `is_pickup: bool` 標註,不用「第 0 小節」這種隱式約定
   - 反覆段落明確展開,不留給下游推斷

---

## 3. 完整資料模型

### 3.1 基礎型別

```python
from dataclasses import dataclass, field
from enum import Enum
from fractions import Fraction
from typing import Optional, Literal

# 時間單位: 一律使用 Fraction,以四分音符為 1
# 例: 八分音符 = Fraction(1, 2), 三連音四分音符 = Fraction(2, 3)
TimePoint = Fraction       # 在小節內的 offset
Duration = Fraction        # 音符時值

@dataclass(frozen=True)
class Pitch:
    midi_number: int                    # 0-127, 實際發聲音高 (concert pitch)
    spelling: str                       # 音名拼寫, e.g. "C#4", "Bb3", "Fbb5"
    written_midi: Optional[int] = None  # 譜上記譜音高 (None = 同 midi_number)
    written_spelling: Optional[str] = None
```

**spelling 格式規範**:
- 音名: `A-G`
- 升降號: `#`, `##` (重升), `b`, `bb` (重降), `n` (還原,僅在臨時記號需要時)
- 八度: 國際標準 (中央 C = `C4`, MIDI 60)
- 範例: `"C4"`, `"F#5"`, `"Bb3"`, `"Cx4"` (重升用 `x` 避免與 `##` 混淆? 待定。**初步採用 `##` 統一**。)

### 3.2 音樂事件 (Events)

```python
class EventType(Enum):
    NOTE = "note"
    CHORD = "chord"
    REST = "rest"

@dataclass
class GraceNote:
    """裝飾音 (前倚音)"""
    pitch: Pitch
    grace_type: Literal["acciaccatura", "appoggiatura"]
    # acciaccatura: 短倚音 (有斜線), 不佔主音時值
    # appoggiatura: 長倚音 (無斜線), 佔主音的一半時值

@dataclass
class Ornament:
    """奧納門特 (顫音、漣音、迴音等)"""
    kind: Literal[
        "trill", "mordent", "inverted_mordent",
        "turn", "inverted_turn", "tremolo",
        "arpeggio_up", "arpeggio_down"
    ]
    upper_aux: Optional[Pitch] = None   # 上助音 (顫音/迴音用)
    lower_aux: Optional[Pitch] = None   # 下助音
    realization: Optional[list["NoteEvent"]] = None
    # realization 由 Analysis Engine 展開,用於可演奏性分析
    # 例: trill on C4 → realization = [C4, D4, C4, D4, ...]

@dataclass
class Tuplet:
    """連音標記。同一連音群組的所有音符共用同一 bracket_id。"""
    actual: int       # 實際音符數 (3 for triplet)
    normal: int       # 正常音符數 (2 for triplet, i.e. 3:2)
    bracket_id: int   # 此小節內的連音群組編號 (區分多個連音)

@dataclass
class TechniqueAnnotation:
    """演奏法標註。Phase 1 大多為 None,Phase 2 由 validator 與使用者填入。"""
    bow_direction: Optional[Literal["up", "down"]] = None
    string_index: Optional[int] = None     # 弦序 (0=最低弦)
    position: Optional[int] = None          # 把位 (1-based)
    fingering: Optional[str] = None         # 指法 ("1", "2", "3", "4" for strings; "L1"-"R5" for piano)
    breath_mark_after: bool = False         # 此音後是否換氣
    pedal_action: Optional[Literal["down", "up", "change"]] = None

@dataclass
class NoteEvent:
    """單一音符事件"""
    pitch: Pitch
    duration: Duration
    onset: TimePoint                         # 小節內起始位置
    articulations: list[str] = field(default_factory=list)
    # articulations 合法值: "staccato", "staccatissimo", "tenuto", "accent",
    # "marcato", "fermata", "pizzicato", "arco", "harmonic", "snap_pizz", ...
    dynamic: Optional[str] = None            # "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sf", "sfz", "fp"
    is_tied_from: bool = False               # 從前一音延續
    is_tied_to: bool = False                 # 延續到下一音
    slur_group: Optional[int] = None         # 圓滑線群組 ID
    grace_before: list[GraceNote] = field(default_factory=list)
    ornament: Optional[Ornament] = None
    tuplet: Optional[Tuplet] = None
    technique: Optional[TechniqueAnnotation] = None
    lyric: Optional[str] = None              # 歌詞 (聲樂作品)

@dataclass
class ChordEvent:
    """同時發聲的多個音。
    
    與 NoteEvent 的差異: 多個音同時開始且時值相同。
    若是琶音或不同時開始的「假和弦」,應該用多個 NoteEvent 表達。
    """
    pitches: list[Pitch]                     # 必須 ≥ 2,且不能有同音高重複
    duration: Duration
    onset: TimePoint
    articulations: list[str] = field(default_factory=list)
    dynamic: Optional[str] = None
    is_tied_from: bool = False
    is_tied_to: bool = False
    slur_group: Optional[int] = None
    grace_before: list[GraceNote] = field(default_factory=list)
    ornament: Optional[Ornament] = None
    tuplet: Optional[Tuplet] = None
    technique: Optional[TechniqueAnnotation] = None

@dataclass
class RestEvent:
    duration: Duration
    onset: TimePoint
    fermata: bool = False                    # 延長記號

Event = NoteEvent | ChordEvent | RestEvent
```

### 3.3 聲部與小節

```python
@dataclass
class Voice:
    """單一聲部內的事件序列。
    
    Divisi (弦樂分部) 用 is_divisi + divisi_branches 表達:
    一個 Voice 內可包含 2 個 sub-Voice,代表「第一/第二部」分奏。
    """
    voice_id: int                            # 在 Measure 內唯一
    events: list[Event] = field(default_factory=list)
    is_divisi: bool = False
    divisi_branches: Optional[list["Voice"]] = None
    # 若 is_divisi == True, events 留空, divisi_branches 含 2 個 Voice

@dataclass
class Measure:
    number: int                              # 小節編號 (見 §5.1 編號規則)
    is_pickup: bool = False                  # 弱起 (anacrusis)
    voices: dict[int, Voice] = field(default_factory=dict)
    time_signature: Optional[tuple[int, int]] = None    # (4, 4); None = 沿用前一小節
    key_signature: Optional[str] = None      # "D major", "F# minor"; None = 沿用
    tempo_bpm: Optional[float] = None        # 速度標記 (BPM); None = 沿用
    tempo_text: Optional[str] = None         # "Allegro con brio" 等文字標記
    rehearsal_mark: Optional[str] = None     # "A", "B", "1", "21" 等排練記號
    barline_left: Literal["normal", "double", "final", "repeat_start"] = "normal"
    barline_right: Literal["normal", "double", "final", "repeat_end"] = "normal"
```

### 3.4 樂句、段落、聲部功能

```python
class VoiceFunction(Enum):
    MELODY = "melody"
    BASS = "bass"
    COUNTERMELODY = "countermelody"
    HARMONY_FILL = "harmony_fill"
    PEDAL = "pedal"
    ORNAMENTAL = "ornamental"
    UNASSIGNED = "unassigned"

@dataclass
class Phrase:
    """樂句邊界。樂句是「主旋律不可跨聲部切換」的最小單位。"""
    phrase_id: int                           # 全曲唯一
    start: tuple[int, TimePoint]             # (measure_number, offset)
    end: tuple[int, TimePoint]
    detection_confidence: float = 0.0        # 0-1, 系統對此邊界的信心
    is_user_edited: bool = False             # 使用者手動調整過

@dataclass
class Section:
    """段落 (全曲層級, 例如「呈示部」「發展部」)"""
    section_id: int
    name: Optional[str] = None               # "Exposition", "Development", "Recapitulation", "Coda"
    start_measure: int
    end_measure: int                         # 包含
    phrases: list[Phrase] = field(default_factory=list)

@dataclass
class MelodyTrack:
    """同一 section 內可能存在的多條旋律線。
    
    例: 對位作品中木管與弦樂的對話, 賦格中主題在不同聲部遞進。
    """
    track_id: int
    source_part_id: str                      # 來源聲部
    span: tuple[int, int]                    # (start_measure, end_measure)
    role: Literal["primary", "secondary", "antiphonal"]
    paired_with: Optional[int] = None        # antiphonal 對位夥伴的 track_id
    salience_score: float = 0.0              # melody_score (見 §4.2.1)
```

### 3.5 樂譜層級

```python
@dataclass
class Part:
    """單一樂器聲部 (對應總譜上一行五線譜)"""
    part_id: str                             # 唯一識別,蛇形 e.g. "violin_1", "horn_in_f_1"
    name_display: str                        # 顯示名 e.g. "Violin I"
    instrument_id: str                       # 標準樂器識別 e.g. "violin", "horn_f"
    measures: list[Measure] = field(default_factory=list)
    # 以下由 Analysis Engine 填入
    function_tags: dict[int, VoiceFunction] = field(default_factory=dict)
    # key = section_id, value = 該段落的功能標記
    # 假設: 同一段落內聲部功能不變; 若需更細粒度可擴展為 (section_id, phrase_id) → Function

@dataclass
class DynamicHairpin:
    """力度漸變 (crescendo / diminuendo)"""
    hairpin_id: int
    part_id: str                             # 屬於哪個聲部 (None = 全部聲部)
    start: tuple[int, TimePoint]
    end: tuple[int, TimePoint]
    kind: Literal["crescendo", "diminuendo", "subito"]
    start_dynamic: Optional[str] = None      # 起始力度 (若 dynamic 標記在範圍內)
    end_dynamic: Optional[str] = None

@dataclass
class RepeatStructure:
    """反覆記號與跳躍結構"""
    repeat_id: int
    kind: Literal[
        "simple_repeat",    # ‖: ... :‖
        "volta",            # 1./2. 房子
        "dc",               # Da Capo
        "ds",               # Dal Segno
        "coda",             # to Coda
        "segno",            # 記號 §
        "fine"              # 終止
    ]
    span: Optional[tuple[int, int]] = None   # 對 simple_repeat / volta
    volta_number: Optional[int] = None       # 1 or 2 for volta
    jump_target: Optional[str] = None        # "Coda" or "Segno" for dc/ds
    target_measure: Optional[int] = None     # 解析後的目標小節

@dataclass
class PedalMark:
    """鋼琴踏板"""
    part_id: str
    span: tuple[tuple[int, TimePoint], tuple[int, TimePoint]]
    kind: Literal["sustain", "una_corda", "sostenuto"]

@dataclass
class Movement:
    """樂章 (多樂章作品)"""
    movement_id: int                         # 1-based
    title: Optional[str] = None              # "I. Allegro con brio"
    measure_count: int = 0
    sections: list[Section] = field(default_factory=list)

@dataclass
class Score:
    """完整樂譜"""
    # === 元數據 ===
    metadata: dict[str, str] = field(default_factory=dict)
    # 推薦 key: "title", "composer", "arranger", "copyright", "source_format"
    
    # === 結構 ===
    movements: list[Movement] = field(default_factory=list)
    parts: list[Part] = field(default_factory=list)
    
    # === 全域元素 ===
    hairpins: list[DynamicHairpin] = field(default_factory=list)
    repeats: list[RepeatStructure] = field(default_factory=list)
    pedals: list[PedalMark] = field(default_factory=list)
    melody_tracks: list[MelodyTrack] = field(default_factory=list)
    
    # === 預設值 (第一小節未指定時使用) ===
    default_tempo_bpm: float = 120.0
    default_key: str = "C major"
    default_time_signature: tuple[int, int] = (4, 4)
    
    # === Parser 警告 ===
    parse_warnings: list[str] = field(default_factory=list)
    # 解析時發現的非規範元素 (e.g. 無法識別的記號) 記錄於此,不中斷流程
    
    # === IR 版本 ===
    ir_version: str = "0.1.0"
```

---

## 4. music21 → IR 對應表

| music21 物件 | IR 對應 | 備註 |
|--------------|---------|------|
| `score.Score` | `Score` | 頂層 |
| `stream.Part` | `Part` | 一個總譜聲部 |
| `stream.Measure` | `Measure` | 小節 |
| `stream.Voice` | `Voice` | 聲部內子聲部 |
| `note.Note` | `NoteEvent` | 單音 |
| `chord.Chord` | `ChordEvent` | 和弦 (注意: music21 把單音也可能放在 Chord 裡,需檢查 pitches 長度) |
| `note.Rest` | `RestEvent` | 休止符 |
| `meter.TimeSignature` | `Measure.time_signature` | 拍號 |
| `key.KeySignature` | `Measure.key_signature` | 調號 |
| `tempo.MetronomeMark` | `Measure.tempo_bpm` + `tempo_text` | 速度 |
| `dynamics.Dynamic` | `NoteEvent.dynamic` 或 `DynamicHairpin` | 點力度 vs 漸變 |
| `dynamics.DynamicWedge` | `DynamicHairpin` | crescendo/diminuendo |
| `expressions.Trill` 等 | `Ornament` | |
| `expressions.TextExpression` | `Measure.tempo_text` 或 fallback to `parse_warnings` | |
| `spanner.Slur` | `NoteEvent.slur_group` | 為每個 slur 分配 ID |
| `articulations.Staccato` 等 | `NoteEvent.articulations` | |
| `bar.Repeat` | `RepeatStructure` | |
| `repeat.Coda`/`Segno` | `RepeatStructure` | |
| `instrument.Instrument` | `Part.instrument_id` (透過 registry 映射) | |
| `duration.Tuplet` | `NoteEvent.tuplet` | |
| `note.Note.tie` | `is_tied_from` / `is_tied_to` | |

### 4.1 已知的解析陷阱

1. **單音被包成 Chord**: music21 在某些 MusicXML 寫法下會把單音解析為 `Chord` 含一個 pitch。Parser 須檢查 `len(chord.pitches) == 1` 並轉為 `NoteEvent`。

2. **隱式拍號繼承**: music21 不會在每小節重複拍號,但 IR 設計也採此模式 (None = 沿用),需保留繼承關係追溯函式。

3. **移調樂器**: music21 預設給出 sounding pitch (concert),但有時譜面是 written。需明確指定 `transpose=True/False`,以及在 IR 中固定存 concert pitch。

4. **Grace notes 的時值**: music21 grace notes `duration.quarterLength == 0`,IR 把它移到母音符的 `grace_before` 列表,不獨立為事件。

5. **Tuplet bracket 共享**: music21 中三連音的 3 個音符各帶 `Tuplet` 物件且為**獨立實例**,IR 需識別「同一 bracket」並指派相同 `bracket_id`。

---

## 5. 編號與識別

### 5.1 小節編號規則

- 多樂章作品: 每樂章獨立從 1 開始
- 弱起小節: 標記為 `Measure.number = 0`, `is_pickup = True`
- 反覆段落: 不重新編號 (反覆展開後仍引用原小節號)
- 跨樂章引用: 用 `(movement_id, measure_number)` 二元組

### 5.2 聲部識別

- `Part.part_id` 為人類可讀的蛇形字串,需在 Score 內唯一
- 同樂器多聲部用後綴: `"violin_1"`, `"violin_2"`, `"trumpet_in_bb_1"`, ...
- `Part.instrument_id` 對應 Instrument Knowledge Base 的 key (見 4.3 模組)

### 5.3 ID 系統總覽

| ID 欄位 | 唯一範圍 | 型別 |
|---------|----------|------|
| `Movement.movement_id` | Score 內 | int (1-based) |
| `Part.part_id` | Score 內 | str (蛇形) |
| `Section.section_id` | Score 內 | int |
| `Phrase.phrase_id` | Score 內 | int |
| `MelodyTrack.track_id` | Score 內 | int |
| `Measure.number` | Movement 內 | int (0 或 1-based,見 §5.1) |
| `Voice.voice_id` | Measure 內 | int |
| `Tuplet.bracket_id` | Measure 內 | int |
| `Ornament` / `GraceNote` / `TechniqueAnnotation` | (無 ID,依附於 NoteEvent) | — |
| `DynamicHairpin.hairpin_id` | Score 內 | int |
| `RepeatStructure.repeat_id` | Score 內 | int |

---

## 6. 可變性政策 (Mutation Policy)

IR 採「**分層可變性**」:

| 層級 | 可變性 | 說明 |
|------|--------|------|
| 結構性欄位 (pitch, duration, onset, voice 組成) | **凍結** | 解析後不可修改; 改編產生「目標 Score」是新物件 |
| 分析標註 (function_tags, melody_tracks, phrases) | **可寫一次** | Analysis Engine 填入,之後變使用者覆寫才重置 |
| 演奏法 (technique) | **可變** | Validator 與使用者持續更新 |
| 解析警告 (parse_warnings) | **僅 append** | 從不刪除 |

實作上不全用 `frozen=True` (那會讓 mutation 太痛苦),而是在 Score 層級提供:
- `Score.snapshot() -> Score`: 深拷貝
- `Score.restore(snapshot)`: 整體替換
- 改編操作 (assign / reassign) 必須先 snapshot 再修改,失敗則 restore

---

## 7. 序列化格式

IR 需序列化以支援:
1. 專案存檔 (`.sarr` 檔案,實為 JSON + 壓縮)
2. 前後端 IPC (JSON over stdio / HTTP)
3. Undo/Redo 快照 (記憶體內快速 deepcopy)

### 7.1 JSON 編碼規則

| Python 型別 | JSON 表示 |
|-------------|-----------|
| `Fraction(n, d)` | `"n/d"` 字串 (e.g. `"3/8"`),整數時為 `"2"` |
| `Pitch` | `{"midi": 60, "spelling": "C4"}` |
| `Enum` | 字串值 (e.g. `"melody"`) |
| `tuple` | JSON array |
| `Optional[T] = None` | JSON `null` |
| `dataclass` | JSON object,key 為欄位名 |

### 7.2 版本相容性

- Score 攜帶 `ir_version`,載入時檢查
- Major version 不同: 拒絕載入並提示升級
- Minor version 較新但 Major 同: 嘗試載入,丟棄未知欄位並記錄到 `parse_warnings`
- Patch version: 完全相容

---

## 8. 驗證規則 (Invariants)

IR 物件建立後必須滿足以下不變式。提供 `ir.validate(score) -> list[ValidationError]` 函式。

### 8.1 強制不變式 (違反 = 程式 bug)

1. `NoteEvent.duration > 0`
2. `ChordEvent.pitches` 長度 ≥ 2,且無重複 midi_number
3. `Tuplet.actual > Tuplet.normal > 0`
4. `Phrase.start <= Phrase.end` (按 measure, offset 字典序)
5. `Section` 範圍不重疊 (同一 Movement 內)
6. `Voice.is_divisi == True` ⇒ `len(divisi_branches) == 2` 且 `events == []`
7. `Pitch.midi_number` ∈ [0, 127]

### 8.2 軟約束 (違反 = parse_warning)

1. 拍號變化應出現在小節開頭
2. 同一 Measure 內所有 Voice 的事件總時長應等於拍號定義的時值
3. `is_tied_to == True` 的音符後必須有 `is_tied_from == True` 的同音高音符
4. Slur group ID 應在合理範圍內成對出現

---

## 9. 邊緣案例範例

### 9.1 三連音 (Triplet) 表達

「四分音符的三連音」(三個八分音符,等於兩個八分音符的時值):

```python
Measure(number=1, time_signature=(4, 4), voices={
    1: Voice(voice_id=1, events=[
        NoteEvent(
            pitch=Pitch(60, "C4"),
            duration=Fraction(1, 3),   # 八分音符在三連音中 = 1/3 quarter
            onset=Fraction(0),
            tuplet=Tuplet(actual=3, normal=2, bracket_id=0),
        ),
        NoteEvent(
            pitch=Pitch(62, "D4"),
            duration=Fraction(1, 3),
            onset=Fraction(1, 3),
            tuplet=Tuplet(actual=3, normal=2, bracket_id=0),  # 同一 bracket
        ),
        NoteEvent(
            pitch=Pitch(64, "E4"),
            duration=Fraction(1, 3),
            onset=Fraction(2, 3),
            tuplet=Tuplet(actual=3, normal=2, bracket_id=0),
        ),
        # 接下來是普通的四分音符
        NoteEvent(
            pitch=Pitch(65, "F4"),
            duration=Fraction(1),
            onset=Fraction(1),
        ),
    ]),
})
```

### 9.2 顫音 (Trill) 與展開

```python
# 譜面: C4 全音符,上方有 tr 記號
NoteEvent(
    pitch=Pitch(60, "C4"),
    duration=Fraction(4),
    onset=Fraction(0),
    ornament=Ornament(
        kind="trill",
        upper_aux=Pitch(62, "D4"),  # 根據調號自動判斷
        # realization 在 Analysis Engine 填入:
        realization=[
            NoteEvent(pitch=Pitch(60, "C4"), duration=Fraction(1, 8), onset=Fraction(0)),
            NoteEvent(pitch=Pitch(62, "D4"), duration=Fraction(1, 8), onset=Fraction(1, 8)),
            # ... 重複
        ]
    ),
)
```

### 9.3 移調樂器 (法國號 in F)

「譜上 C4 的 horn in F,實際發聲為 F3 (低完全五度)」:

```python
NoteEvent(
    pitch=Pitch(
        midi_number=53,           # F3, concert pitch
        spelling="F3",
        written_midi=60,          # C4, 譜上看到的音
        written_spelling="C4",
    ),
    duration=Fraction(1),
    onset=Fraction(0),
)
```

分析永遠用 `midi_number`,渲染輸出移調樂器分譜時用 `written_midi`。

### 9.4 弦樂分部 (Divisi)

第一小提琴在某段落分為兩部 (上下不是和弦,而是分人演奏):

```python
Voice(
    voice_id=1,
    is_divisi=True,
    events=[],  # 必須為空
    divisi_branches=[
        Voice(voice_id=11, events=[NoteEvent(pitch=Pitch(72, "C5"), ...)]),
        Voice(voice_id=12, events=[NoteEvent(pitch=Pitch(64, "E4"), ...)]),
    ],
)
```

分配時 divisi 視為「兩個獨立的 melody source」,可能進入不同目標聲部。

### 9.5 一次反覆與 Volta

譜面:
```
‖: m.1 m.2 [1. m.3 m.4 :‖ [2. m.5 m.6 ‖
```

```python
score.repeats = [
    RepeatStructure(
        repeat_id=0,
        kind="simple_repeat",
        span=(1, 4),                      # 反覆 m.1-m.4 (含 volta 1)
    ),
    RepeatStructure(
        repeat_id=1,
        kind="volta",
        span=(3, 4),
        volta_number=1,
    ),
    RepeatStructure(
        repeat_id=2,
        kind="volta",
        span=(5, 6),
        volta_number=2,
    ),
]

# Score Parser 提供 `expand_repeats(score) -> Score` 方法
# 展開後的 Score 為線性序列 m.1, m.2, m.3, m.4 (第一次), m.1, m.2, m.5, m.6
# 分析在展開後的 Score 上進行,渲染時轉回 compact 形式
```

---

## 10. 未來擴展點 (Phase 2+)

預留但 Phase 1 不實作的欄位,以避免 schema 破壞:

- `NoteEvent.cue_size: bool` — 提示音 (cue note)
- `NoteEvent.is_hidden: bool` — 隱藏音符 (僅供分析,不顯示)
- `Part.staff_count: int` — 多五線譜聲部 (鋼琴 2,豎琴 2)
- `Score.parts_grouping: list[PartGroup]` — 樂器分組 (弦樂組、木管組)
- `Voice.comments: list[Comment]` — 使用者註解 (Phase 3 協作功能)
- `MelodyTrack.user_locked: bool` — 使用者鎖定不允許重分配

---

## 11. 變更紀錄

| 版本 | 日期 | 變更 |
|------|------|------|
| 0.1.0 | 2026-05-18 | 初版,涵蓋 Phase 0/1 需求 |

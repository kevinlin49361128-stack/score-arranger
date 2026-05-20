# Player / Layout 抽象 — 編制與版面分離

> 版本: 0.1.0 (Draft)
> 最後更新: 2026-05-18
> 對應 architecture.md 章節 5、UX 設計提案 §2.2.D

---

## 1. 概念

Score Arranger 的核心資料抽象借鑑 Dorico 的成熟設計,把「**改編產出**」拆成三層:

```
Source ─────► Player ─────► Layout
(原始素材)     (改編後的     (輸出版面)
              演奏者)
```

| 概念 | 中文 | 定義 | 範例 |
|------|------|------|------|
| **Source** | 來源 | 匯入的原始樂譜 (唯讀) | 「貝多芬第五號交響曲總譜」 |
| **Player** | 演奏者 | 改編後的一個演奏單位 (人) | 「小提琴手」「鋼琴手」 |
| **Layout** | 版面 | 從特定 Player 子集合產出的可印譜面 | 「雙人總譜」「小提琴分譜」「鋼琴分譜」 |

### 1.1 為何要分離

從現實情境出發:

1. **一個 Player 可演奏多種樂器**: 木管演奏者常一人兼長笛與短笛,改編時應視為**同一 Player**(避免兩個樂器同時被分配)。

2. **一份改編產出多種版面**: 同一份「小提琴+鋼琴」改編,需要:
   - 雙人合奏總譜 (兩個聲部上下顯示)
   - 小提琴分譜 (只看自己那部)
   - 鋼琴分譜 (含小提琴提示音)
   
   三者基於同樣的 Player 配置,只差版面選擇。

3. **未來擴展**: 同一份分析結果可同時產出多種編制 (弦樂四重奏 / 鋼琴獨奏 / 小+鋼),共用前端分析,只換 Player 配置。

### 1.2 與架構文件章節 5 的關係

architecture.md 章節 5 的「目標譜面板」實際上是 **Layout 的視覺呈現**。原文件未明確分離「Player 配置」與「Layout 選擇」這兩件事,在 Phase 2 擴展到多編制時會痛。本規格補強此處。

---

## 2. 資料模型

### 2.1 Source

```python
@dataclass
class Source:
    """匯入的原始樂譜,改編過程中唯讀。"""
    source_id: str                       # 唯一識別
    score: Score                         # 完整 IR (見 ir-spec.md)
    file_path: Optional[str] = None      # 原檔路徑
    imported_at: str = ""                # ISO 時間戳
    notes: str = ""                      # 使用者備註
```

### 2.2 Player

```python
@dataclass
class Player:
    """改編後的演奏單位 (一個「人」)。"""
    player_id: str                       # 唯一識別,蛇形 e.g. "player_violin"
    display_name: str                    # 「小提琴」 (使用者可改)
    instruments: list[str]               # 樂器 instrument_id 列表
    # 多樂器: 例如木管手 ["flute", "piccolo"], 改編時系統會避免雙樂器同時佔用
    primary_instrument: str              # instruments[0] 預設
    skill_level: Literal["amateur", "intermediate", "professional"] = "professional"
    # 影響可演奏性檢查的嚴格度: amateur 對技術約束更寬鬆地警告
    custom_constraints: dict = field(default_factory=dict)
    # 可覆寫 InstrumentProfile 預設值,例如「此演奏者手較小,改為 7 半音」
```

### 2.3 Assignment

「**改編的核心**」: 把 Source 的某段音樂分配給某個 Player 的某個樂器。

```python
@dataclass
class Assignment:
    """單一分配記錄。多個 Assignment 組成完整改編。"""
    assignment_id: int
    
    # 來源
    source_part_id: str                  # Source 中的 Part
    source_voice_id: Optional[int]       # 來源 Voice (None = 整個 Part)
    
    # 目標
    target_player_id: str
    target_instrument: str               # Player.instruments 之一
    target_staff: Optional[Literal["upper", "lower"]] = None
    # 對鋼琴等雙手樂器:upper=右手,lower=左手
    
    # 範圍
    span: tuple[int, int]                # (start_measure, end_measure)
    
    # 語義
    function: VoiceFunction              # 此分配的功能角色
    is_phrase_locked: bool = False       # 樂句約束鎖
    
    # 修改紀錄
    is_user_edited: bool = False
    is_auto_generated: bool = True
```

### 2.4 Arrangement

「**一次改編**」: 一組 Player 與一組 Assignment。

```python
@dataclass
class Arrangement:
    """一次完整的改編。對應使用者「方案 A」「方案 B」。"""
    arrangement_id: str
    name: str                            # "弦四 - 省略內聲部版"
    source_id: str                       # 對應 Source
    players: list[Player]
    assignments: list[Assignment]
    
    # 衍生資料 (Arrangement Engine 產出)
    target_score: Score                  # 改編後的 IR (與 Source.score 結構相同但內容不同)
    issues: list[PlayabilityIssue] = field(default_factory=list)
    
    # 版本控制 (見 §4)
    parent_arrangement_id: Optional[str] = None  # 從哪個分支來
    created_at: str = ""
    last_modified_at: str = ""
```

### 2.5 Layout

```python
@dataclass
class Layout:
    """版面: 從 Arrangement 產生可印譜面。"""
    layout_id: str
    name: str                            # "雙人總譜" / "小提琴分譜"
    arrangement_id: str
    
    # 包含哪些 Player
    included_players: list[str]          # player_id 列表
    
    # 版面類型
    layout_type: Literal["full_score", "part", "condensed"] = "full_score"
    # full_score: 所有 included_players 上下排列
    # part: 通常一個 Player,顯示分譜
    # condensed: 多個 Player 壓縮顯示 (例如管樂組)
    
    # 顯示選項
    show_cue_notes: bool = False         # 分譜時是否顯示其他聲部的提示音
    transpose_to_concert: bool = False   # 移調樂器是否顯示為 concert pitch
    page_format: str = "A4"
    
    # 渲染快取 (UI 層,不存檔)
    _rendered_at: Optional[str] = None
```

### 2.6 Project

「**最頂層**」: 整個使用者專案。

```python
@dataclass
class Project:
    """使用者專案,對應一份 .sarr 檔案。"""
    project_id: str
    name: str
    
    sources: list[Source] = field(default_factory=list)
    # 通常只有 1 個 source,但 Phase 3 支援多 source 拼接 (如將協奏曲三樂章分別匯入)
    
    arrangements: list[Arrangement] = field(default_factory=list)
    # 多個 = A/B 版本比較
    
    layouts: list[Layout] = field(default_factory=list)
    
    active_arrangement_id: Optional[str] = None  # 當前編輯中的版本
    active_layout_id: Optional[str] = None
    
    # 後設資料
    created_at: str = ""
    saved_at: str = ""
    app_version: str = ""
    
    # 設定
    user_preferences: dict = field(default_factory=dict)
    # i18n locale、音名系統、UI 偏好,見 i18n-spec.md
```

---

## 3. 標準 Layout 範本

Phase 1 預設提供:

| Layout 名稱 | 包含 Players | 類型 | 用途 |
|-------------|--------------|------|------|
| **雙人合奏總譜** | 全部 | `full_score` | 排練、研讀 |
| **小提琴分譜** | violin | `part` | 演奏 |
| **鋼琴分譜** | piano | `part` | 演奏 |

Phase 2 新增:
| **小提琴分譜 (含提示)** | violin (主) + piano (提示音) | `part` | 排練用 |

---

## 4. A/B 版本管理 (Branching)

借鑑 Figma / Git 的分支模型。

### 4.1 操作

| 操作 | 行為 |
|------|------|
| **Branch** | 從當前 Arrangement 複製出新 Arrangement,`parent_arrangement_id` 指向源頭 |
| **Rename** | 改 `Arrangement.name` |
| **Switch** | 切換 `Project.active_arrangement_id` |
| **Compare** | UI 並排顯示兩個 Arrangement 的差異 |
| **Merge** | 不提供 — 改編產物難以機械式合併,使用者用手動複製代替 |
| **Delete** | 刪除 Arrangement (確認對話框); 若是當前 active 則切到 parent |

### 4.2 版本樹資料模型

```python
# Arrangement.parent_arrangement_id 構成樹狀結構
# UI 用樹狀視覺化呈現

# 範例:
#   v1 (初始自動分配)
#    ├── v2 (省略內聲部版)
#    │   └── v4 (進一步簡化)
#    └── v3 (保留全部和聲版)
```

### 4.3 版本比較 (Diff)

```python
def diff_arrangements(a: Arrangement, b: Arrangement) -> ArrangementDiff:
    """比較兩個改編版本的差異。"""
    return ArrangementDiff(
        added_assignments=[...],     # b 有 a 無
        removed_assignments=[...],   # a 有 b 無
        modified_assignments=[...],  # 同 source 但不同 target / function
        issue_count_delta={"error": -2, "warning": +1, "info": 0},
    )
```

UI 呈現:
- 兩 Layout 上下對齊
- 差異小節以底色標示 (新增=綠、移除=紅、修改=藍)
- 側欄列出差異清單

---

## 5. 操作介面 (Service Layer API)

```python
class ArrangementService:
    def create_arrangement(
        self, 
        source_id: str, 
        target_ensemble: list[Player],
        name: str = "自動分配 v1"
    ) -> Arrangement:
        """執行四階段分配 + 修復迴圈,產出新 Arrangement。"""
    
    def reassign(
        self,
        arrangement_id: str,
        source_selection: tuple[str, int, int],  # (part_id, start_m, end_m)
        target_player_id: str,
        target_staff: Optional[str] = None
    ) -> Arrangement:
        """使用者拖拽: 把 source 範圍重新分配給目標 player。
        返回新 Arrangement (自動 branch)。"""
    
    def apply_suggestion(
        self,
        arrangement_id: str,
        issue_id: int,
        suggestion_index: int
    ) -> Arrangement:
        """套用問題面板的建議。"""
    
    def branch_arrangement(
        self, 
        arrangement_id: str, 
        new_name: str
    ) -> Arrangement:
        """從現有 Arrangement 分支。"""
    
    def delete_arrangement(self, arrangement_id: str) -> None:
        ...


class LayoutService:
    def create_layout(self, ...) -> Layout: ...
    def export_layout(self, layout_id: str, format: str, path: str) -> None: ...
    # format: "musicxml" | "midi" | "pdf"
```

---

## 6. UI 對應

### 6.1 左側 Panel 結構

```
專案: 貝多芬第五交響曲改編
├─ 📁 Sources (1)
│   └─ 🎼 完整總譜 (Beethoven Sym.5)
├─ 👥 Players (2)
│   ├─ 🎻 小提琴
│   └─ 🎹 鋼琴
├─ 📑 Arrangements (3)
│   ├─ v1 自動分配 (當前)
│   ├─  └─ v2 省略內聲部
│   └─  └─ v3 保留全和聲
└─ 🖨 Layouts (3)
    ├─ 雙人合奏總譜
    ├─ 小提琴分譜
    └─ 鋼琴分譜
```

### 6.2 Setup Mode 的對應

- **匯入** → 建立 Source
- **選擇編制** → 建立 Players (從預設範本或自訂)
- **產生改編** → 建立 Arrangement (執行分配演算法)

### 6.3 Export Mode 的對應

- **選擇 Layout** → 選擇要匯出的版面
- **匯出** → `LayoutService.export_layout`

---

## 7. 序列化: .sarr 檔案結構

```
project.sarr (實為 .zip)
├─ manifest.json          # Project 元數據, IR 版本
├─ sources/
│   └─ source_1.json      # Source 完整 IR
├─ arrangements/
│   ├─ arr_v1.json        # Arrangement (含 target_score IR)
│   ├─ arr_v2.json
│   └─ arr_v3.json
├─ layouts/
│   └─ layouts.json       # 所有 Layout 定義
├─ preferences.json       # user_preferences
└─ thumbnails/            # PDF 預覽快取
    └─ arr_v1_layout_1.png
```

**為何用 zip**: Source IR 可能很大 (100KB-1MB),分檔後個別 Arrangement 也可單獨載入加速。zip 壓縮可大幅減少體積 (典型 70% 壓縮率)。

---

## 8. 設計決策紀錄

### 8.1 為何 Arrangement 內含 target_score 完整副本而非 diff

**選擇**: 每個 Arrangement 存完整 `target_score`,不存對 Source 的 diff。

**理由**:
- Diff 結構複雜 (新增聲部、刪除聲部、修改演奏法...),實作成本高
- 演算法效率: 分析、渲染、匯出都需完整 IR,反覆 patch diff 會慢
- 儲存成本可接受: zip 壓縮後典型 < 10MB
- 比較功能仍可實現: 用兩個完整 IR 計算 diff 給 UI 顯示

**代價**: 同一 Source 多個 Arrangement 的共通部分會重複儲存。Phase 3 可加入「壓縮儲存」優化。

### 8.2 為何 Layout 不存譜面內容

Layout 只存「**配置**」(包含哪些 player、顯示選項),譜面內容**永遠由 Arrangement.target_score + Layout 配置即時計算**。避免 target_score 改動後 Layout 不同步的 bug。

### 8.3 為何不引入「Group」概念

Dorico 有 Player Group (例如「弦樂組」),Score Arranger Phase 1 不引入,理由:
- Phase 1 目標編制小 (2-5 人),分組無實質效益
- 增加學習成本
- Phase 2 若擴展到管弦級編制再引入

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|------|------|------|
| 0.1.0 | 2026-05-18 | 初版,Phase 1 範圍 |

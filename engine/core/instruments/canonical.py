"""
樂器 ID 正規化 — single source of truth

過去問題:
- parser 用 "clarinet_in_bb", "horn_in_f", "trumpet_in_bb"
- registry / ensemble templates 用 "clarinet_bb", "horn_f", "trumpet_bb"
- ir_to_music21 兩種都不接, 導致解析後拿不到 profile / clef

修法 (reviewer 建議):
- 統一 canonical id 為較短形式 (e.g. "clarinet_bb")
- normalize_instrument_id() 接受任何已知別名 / 顯示名 / 大小寫變體
- parser / writer / registry 全部走這個函式
"""

from __future__ import annotations

# === 唯一的合法 instrument_id 集合 ===
CANONICAL_IDS: set[str] = {
    # 弦樂
    "violin", "viola", "cello", "double_bass",
    # 鍵盤
    "piano", "harpsichord",
    # 木管
    "flute", "oboe", "clarinet_bb", "bassoon",
    # 銅管
    "horn_f", "trumpet_bb", "trombone", "tuba",
    # 撥弦 / 打擊
    "harp", "timpani",
    # 聲樂
    "soprano", "alto", "tenor", "bass_voice",
}


# === Alias → canonical ===
# 涵蓋:
#  - 舊命名 (clarinet_in_bb)
#  - 純名稱 (clarinet, horn, trumpet → 假設最常見的調性)
#  - 顯示名 (cello / violoncello, double_bass / contrabass)
ALIASES: dict[str, str] = {
    # === 弦 ===
    "violoncello": "cello",
    "contrabass": "double_bass",
    "string_bass": "double_bass",
    # 義大利 / 巴洛克 (Corelli, Vivaldi corpus 用)
    "violino": "violin",
    "violino_i": "violin",
    "violino_ii": "violin",
    "violino_1": "violin",
    "violino_2": "violin",
    "viola_da_braccio": "viola",
    "violone": "cello",            # 17 世紀 violone, 沒 sample 用 cello 代
    "viola_da_gamba": "cello",
    "aria_player": "violin",       # music21 corpus 某些古樂用的 generic class
    # === 木管 — 統一到 B♭ clarinet / 預設 trumpet B♭ ===
    "clarinet": "clarinet_bb",
    "clarinet_in_bb": "clarinet_bb",
    "clarinet_in_b_flat": "clarinet_bb",
    "clarinet_b_flat": "clarinet_bb",
    # === 銅管 ===
    "horn": "horn_f",
    "horn_in_f": "horn_f",
    "french_horn": "horn_f",
    "trumpet": "trumpet_bb",
    "trumpet_in_bb": "trumpet_bb",
    "trumpet_in_b_flat": "trumpet_bb",
    "trumpet_in_c": "trumpet_bb",
    # === 聲樂 ===
    "bass": "bass_voice",          # 'Bass' 在 chorale 是聲部不是 double bass
    # === 鍵盤 ===
    "organ": "piano",              # 沒 organ sample, 暫用 piano
    "harmonium": "piano",
    "fortepiano": "piano",
    "klavier": "piano",
    "harpsichord": "harpsichord",  # 已 canonical, 保持
}


# 包含關鍵字 → canonical (給 normalize_instrument_id fallback 用,
# 處理 "Violino I." / "Violone e Organo" 這種帶後綴的情況)
KEYWORD_HINTS: list[tuple[str, str]] = [
    # 注意順序: 先匹配最具體的, 再匹配廣義
    ("violone", "cello"),       # 必須在 "violin" 之前
    ("violin", "violin"),
    ("violino", "violin"),
    ("viola", "viola"),
    ("violoncello", "cello"),
    ("cello", "cello"),
    ("contrabass", "double_bass"),
    ("double_bass", "double_bass"),
    ("flute", "flute"),
    ("piccolo", "flute"),
    ("oboe", "oboe"),
    ("clarinet", "clarinet_bb"),
    ("bassoon", "bassoon"),
    ("horn", "horn_f"),
    ("trumpet", "trumpet_bb"),
    ("trombone", "trombone"),
    ("tuba", "tuba"),
    ("harp", "harp"),
    ("timpani", "timpani"),
    ("piano", "piano"),
    ("klavier", "piano"),
    ("harpsichord", "harpsichord"),
    ("soprano", "soprano"),
    ("alto", "alto"),
    ("tenor", "tenor"),
]


def normalize_instrument_id(name: str | None) -> str:
    """把任意樂器名稱 / 別名正規化到 canonical id。

    流程:
      1. 若已是 canonical, 直接回傳
      2. 標準化 (lowercase, 空白/dash → underscore, 移除多餘符號)
      3. 查 ALIASES
      4. 取第一個 token 再查一次
      5. 都不行 → 回傳標準化後的字串 (caller 自行決定是否 fallback)

    e.g.:
      "Clarinet in B-flat" → "clarinet_bb"
      "French Horn"        → "horn_f"
      "Violoncello"        → "cello"
      "Piano"              → "piano"
    """
    if not name:
        return "unknown"
    raw = name.strip()
    # 已是 canonical (case-sensitive 比對, 因為 canonical 全部小寫)
    if raw in CANONICAL_IDS:
        return raw
    # 標準化
    s = (
        raw.lower()
        .replace("-", "_")
        .replace(" ", "_")
        .replace("/", "_")
        .replace(".", "")
    )
    # 連續底線壓平
    while "__" in s:
        s = s.replace("__", "_")
    if s in CANONICAL_IDS:
        return s
    if s in ALIASES:
        return ALIASES[s]
    # 第一個 token (例如 "trumpet_part_1" → "trumpet")
    first = s.split("_")[0]
    if first in CANONICAL_IDS:
        return first
    if first in ALIASES:
        return ALIASES[first]
    # 關鍵字模糊匹配 — 對 "Violino I." / "Violone e Organo" 等帶後綴名稱有效
    for keyword, canonical in KEYWORD_HINTS:
        if keyword in s:
            return canonical
    return s  # 回傳標準化後字串, 至少 lowercase + underscore

"""
隨 app 出貨的範例樂譜。

為何不直接用 music21 corpus:
  PyInstaller 凍結後 music21 的 corpus 路徑解析會壞 (corpus.parse /
  corpus.search 找不到資料目錄)。所以把前端 PresetLibrary 精選的範例
  先匯出成獨立 .musicxml 檔, 隨 app 一起打包, 由本模組解析 `corpus:<id>`。

corpus_id 對應前端 PresetLibrary / OnboardingWizard 的 'corpus:<id>'。
檔名規則: corpus_id 的 '/' → '_', '.' → '-', 加 .musicxml。
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

# 隨附的範例 corpus_id —— 必須與前端 PresetLibrary 的 PRESETS 一致。
SAMPLE_CORPUS_IDS: list[str] = [
    # Baroque
    "bach/bwv66.6",
    "bach/bwv7.7",
    "bach/bwv57.8",
    "bach/bwv4.8",
    "bach/bwv227.7",
    "bach/bwv281",
    "bach/bwv344",
    "bach/bwv1.6",
    "corelli/opus3no1/1grave",
    "handel/rinaldo/Lascia_chio_pianga",
    # Classical — 弦樂四重奏
    "mozart/k80/movement1",
    "mozart/k80/movement2",
    "mozart/k80/movement3",
    "mozart/k80/movement4",
    "mozart/k155/movement1",
    "mozart/k155/movement2",
    "mozart/k155/movement3",
    "mozart/k156/movement1",
    "mozart/k156/movement2",
    "mozart/k156/movement3",
    "mozart/k156/movement4",
    "mozart/k458/movement1",
    "mozart/k458/movement2",
    "mozart/k458/movement3",
    "mozart/k458/movement4",
    "haydn/opus1no1/movement1",
    "haydn/opus1no1/movement2",
    "haydn/opus74no1/movement1",
    "haydn/opus74no1/movement2",
    "haydn/opus74no1/movement3",
    "haydn/opus74no1/movement4",
    "beethoven/opus18no1/movement1",
    "beethoven/opus18no1/movement2",
    "beethoven/opus18no1/movement3",
    "beethoven/opus18no1/movement4",
    "beethoven/opus59no1/movement1",
    "beethoven/opus132",
    # Classical — 鋼琴
    "mozart/k545/movement1_exposition",
    # Romantic
    "chopin/mazurka06-2",
    "joplin/maple_leaf_rag",
    "schubert/Lindenbaum",
    "schumann_clara/opus17/movement3",
    "schumann_robert/dichterliebe_no2",
    "schumann_robert/opus48no2",
    "verdi/laDonnaEMobile",
    # 0.1.40: OpenScore Lieder (CC0, MusicXML native)
    "openscore/beethoven_op48_1_bitten",
    "openscore/beethoven_op48_2_liebe",
    "openscore/beethoven_op48_3_tode",
    "openscore/beethoven_op48_4_ehre",
    "openscore/beethoven_op52_3_ruhe",
    "openscore/schubert_d795_1_wandern",
    "openscore/schubert_d795_2_wohin",
    "openscore/schubert_d795_20_wiegenlied",
    "openscore/schumann_op39_5_mondnacht",
    "openscore/schumann_op48_1_mai",
    "openscore/schumann_op48_7_grolle",
    "openscore/schumann_op42_1_seitich",
    "openscore/brahms_op43_1_ewigeliebe",
    # 0.1.42: music21 corpus export — 補時代 / 地理多樣性
    # Bach 聖詠 (10 首加碼)
    "bach/bwv269",
    "bach/bwv347",
    "bach/bwv267",
    "bach/bwv17.7",
    "bach/bwv40.8",
    "bach/bwv38.6",
    "bach/bwv33.6",
    "bach/bwv277",
    "bach/bwv178.7",
    "bach/bwv32.6",
    # 文藝復興
    "ciconia/quod_jactatur",
    "palestrina/Kyrie",
    "palestrina/Agnus",
    # 巴洛克補充
    "cpebach/h186",
    # 浪漫補充 (美 / 夏威夷)
    "beach/prayer_of_a_tired_child",
    "liliuokalani/aloha_oe",
    # 現代 (20 世紀)
    "schoenberg/opus19/movement2",
    "schoenberg/opus19/movement6",
    "webern/webern_dormi_jesu_op_16_no_2",
    # 0.1.43: 加碼 — OpenScore Lieder 25 首 + 美 / Medieval 3 首
    # OpenScore Lieder 大師名曲
    "openscore/brahms_op49_4_wiegenlied",
    "openscore/brahms_op43_2_mainacht",
    "openscore/brahms_op121_3_otod",
    "openscore/schubert_op3_3_heidenroeslein",
    "openscore/schubert_d839_ave_maria",
    "openscore/schubert_op59_3_dubist",
    "openscore/schubert_op59_4_lachen",
    "openscore/schumann_op39_3_waldes",
    "openscore/schumann_op39_12_fruhling",
    "openscore/schumann_op48_13_traum",
    "openscore/schumann_op42_2_herrlichste",
    "openscore/mahler_kinder_1_sonn",
    "openscore/mahler_kinder_4_oft",
    "openscore/mahler_gesellen_2_gieng",
    "openscore/mahler_gesellen_4_augen",
    "openscore/wolf_morike_12_verbor",
    "openscore/wolf_morike_9_nimmer",
    "openscore/strauss_op27_2_caecilie",
    "openscore/strauss_op27_3_heimliche",
    "openscore/strauss_op27_4_morgen",
    "openscore/faure_op27_1_chanson",
    "openscore/debussy_ariettes_2_ilpleure",
    "openscore/debussy_bilitis_1_flute",
    "openscore/berlioz_nuits_1_villanelle",
    # trecento (Medieval 義大利 ars nova, 14C)
    "trecento/PMFC_04-Cara mi donna",
    # 0.1.44: Humdrum (humdrum-tools / craigsapp KernScores) — 110 首
    # PD compositions, encoding 屬 CCARH/Sapp grey-zone (同 music21 corpus risk).
    # Bach Two-Part Inventions BWV 772-786 (全 15)
    "bach_invention_01",
    "bach_invention_02",
    "bach_invention_03",
    "bach_invention_04",
    "bach_invention_05",
    "bach_invention_06",
    "bach_invention_07",
    "bach_invention_08",
    "bach_invention_09",
    "bach_invention_10",
    "bach_invention_11",
    "bach_invention_12",
    "bach_invention_13",
    "bach_invention_14",
    "bach_invention_15",
    # Beethoven 16 弦樂四重奏 mvt 1 (op.18 No.1-5, op.59 No.1-3, op.74, op.95,
    # op.127, op.130, op.131, op.132, op.135). 缺 op.18 No.6 (parser 不認 grace).
    "beethoven_quartet_01_1",
    "beethoven_quartet_02_1",
    "beethoven_quartet_03_1",
    "beethoven_quartet_04_1",
    "beethoven_quartet_05_1",
    "beethoven_quartet_07_1",
    "beethoven_quartet_08_1",
    "beethoven_quartet_09_1",
    "beethoven_quartet_10_1",
    "beethoven_quartet_11_1",
    "beethoven_quartet_12_1",
    "beethoven_quartet_13_1",
    "beethoven_quartet_14_1",
    "beethoven_quartet_15_1",
    "beethoven_quartet_16_1",
    # Beethoven 32 鋼琴奏鳴曲 mvt 1 (全套, op.2 No.1 ~ op.111)
    "beethoven_sonata_01_1",
    "beethoven_sonata_02_1",
    "beethoven_sonata_03_1",
    "beethoven_sonata_04_1",
    "beethoven_sonata_05_1",
    "beethoven_sonata_06_1",
    "beethoven_sonata_07_1",
    "beethoven_sonata_08_1",
    "beethoven_sonata_09_1",
    "beethoven_sonata_10_1",
    "beethoven_sonata_11_1",
    "beethoven_sonata_12_1",
    "beethoven_sonata_13_1",
    "beethoven_sonata_14_1",
    "beethoven_sonata_15_1",
    "beethoven_sonata_16_1",
    "beethoven_sonata_17_1",
    "beethoven_sonata_18_1",
    "beethoven_sonata_19_1",
    "beethoven_sonata_20_1",
    "beethoven_sonata_21_1",
    "beethoven_sonata_22_1",
    "beethoven_sonata_23_1",
    "beethoven_sonata_24_1",
    "beethoven_sonata_25_1",
    "beethoven_sonata_26_1",
    "beethoven_sonata_27_1",
    "beethoven_sonata_28_1",
    "beethoven_sonata_29_1",
    "beethoven_sonata_30_1",
    "beethoven_sonata_31_1",
    "beethoven_sonata_32_1",
    # Chopin Mazurkas (7 首補充)
    "chopin_mazurka_07_1",
    "chopin_mazurka_07_2",
    "chopin_mazurka_17_4",
    "chopin_mazurka_24_2",
    "chopin_mazurka_33_2",
    "chopin_mazurka_67_4",
    "chopin_mazurka_68_4",
    # Chopin 24 Preludes Op.28 (全套 — 缺 No.21 parser 不認 grace)
    "chopin_prelude_28_01",
    "chopin_prelude_28_02",
    "chopin_prelude_28_03",
    "chopin_prelude_28_04",
    "chopin_prelude_28_05",
    "chopin_prelude_28_06",
    "chopin_prelude_28_07",
    "chopin_prelude_28_08",
    "chopin_prelude_28_09",
    "chopin_prelude_28_10",
    "chopin_prelude_28_11",
    "chopin_prelude_28_12",
    "chopin_prelude_28_13",
    "chopin_prelude_28_14",
    "chopin_prelude_28_15",
    "chopin_prelude_28_16",
    "chopin_prelude_28_17",
    "chopin_prelude_28_18",
    "chopin_prelude_28_19",
    "chopin_prelude_28_20",
    "chopin_prelude_28_22",
    "chopin_prelude_28_23",
    "chopin_prelude_28_24",
    # Haydn 鋼琴奏鳴曲 (2 首代表)
    "haydn_sonata_37_1",
    "haydn_sonata_50_1",
    # Joplin rags (2 首補充)
    "joplin_entertainer",
    "joplin_solace",
    # Mozart 鋼琴奏鳴曲 mvt 1 (16 首 — 缺 K.545 已有 / K.310 parser 不認 grace)
    "mozart_sonata_01_1",
    "mozart_sonata_02_1",
    "mozart_sonata_04_1",
    "mozart_sonata_05_1",
    "mozart_sonata_06_1",
    "mozart_sonata_07_1",
    "mozart_sonata_08_1",
    "mozart_sonata_09_1",
    "mozart_sonata_10_1",
    "mozart_sonata_12_1",
    "mozart_sonata_13_1",
    "mozart_sonata_14_1",
    "mozart_sonata_15_1",
    "mozart_sonata_17_1",
    # 0.1.45: 大擴充 91 首 — Scarlatti 15 + Bach 370 Chorales 50 +
    # OpenScore Lieder 26 (Schwanengesang/Winterreise/Frauenliebe 完整化 +
    # Berlioz/Mahler/Wolf 補強)
    # Scarlatti Keyboard Sonatas (15 首) — 修 0.1.44 錯誤 kk### 檔名為
    # 正確的 L<longo>K<kirkpatrick> 格式. corpus_id 用 K-number 不變.
    "scarlatti_K001",
    "scarlatti_K055",
    "scarlatti_K084",
    "scarlatti_K113",
    "scarlatti_K139",
    # K.146 / K.200 ChordEvent.duration=0 grace-note parser bug — 暫跳過
    "scarlatti_K165",
    "scarlatti_K238",
    "scarlatti_K330",
    "scarlatti_K384",
    "scarlatti_K406",
    "scarlatti_K491",
    "scarlatti_K502",
    "scarlatti_K534",
    # Bach 370 Chorales (50 首均勻取樣自 chor001-371, SATB 內聲部教材)
    "bach_chorale_001",
    "bach_chorale_008",
    "bach_chorale_016",
    "bach_chorale_024",
    "bach_chorale_032",
    "bach_chorale_040",
    "bach_chorale_048",
    "bach_chorale_056",
    "bach_chorale_064",
    "bach_chorale_072",
    "bach_chorale_080",
    "bach_chorale_088",
    "bach_chorale_096",
    "bach_chorale_104",
    "bach_chorale_112",
    "bach_chorale_120",
    "bach_chorale_128",
    "bach_chorale_136",
    "bach_chorale_144",
    "bach_chorale_152",
    "bach_chorale_160",
    "bach_chorale_168",
    "bach_chorale_176",
    "bach_chorale_184",
    "bach_chorale_192",
    "bach_chorale_200",
    "bach_chorale_208",
    "bach_chorale_216",
    "bach_chorale_224",
    "bach_chorale_232",
    "bach_chorale_240",
    "bach_chorale_248",
    "bach_chorale_256",
    "bach_chorale_264",
    "bach_chorale_272",
    "bach_chorale_280",
    "bach_chorale_288",
    "bach_chorale_296",
    "bach_chorale_304",
    "bach_chorale_312",
    "bach_chorale_320",
    "bach_chorale_328",
    "bach_chorale_336",
    "bach_chorale_344",
    "bach_chorale_352",
    "bach_chorale_360",
    "bach_chorale_365",
    "bach_chorale_367",
    "bach_chorale_369",
    "bach_chorale_371",
    # OpenScore Lieder 大型套曲 (26 首)
    # Schubert Schwanengesang D.957 (8)
    "openscore/schubert_d957_01_liebesbotschaft",
    "openscore/schubert_d957_04_staendchen",
    "openscore/schubert_d957_05_aufenthalt",
    "openscore/schubert_d957_07_abschied",
    "openscore/schubert_d957_09_ihrbild",
    "openscore/schubert_d957_11_diestadt",
    "openscore/schubert_d957_13_doppelganger",
    "openscore/schubert_d957_14_taubenpost",
    # Schubert Winterreise D.911 (6)
    "openscore/schubert_d911_01_gutenacht",
    "openscore/schubert_d911_05_lindenbaum",
    "openscore/schubert_d911_11_fruhlingstraum",
    "openscore/schubert_d911_13_diepost",
    "openscore/schubert_d911_15_diekraehe",
    "openscore/schubert_d911_24_leiermann",
    # Schumann Frauenliebe Op.42 補完 (6, 加上 0.1.43 No.1/2 共 8 首)
    "openscore/schumann_op42_3_fassen",
    "openscore/schumann_op42_4_ring",
    "openscore/schumann_op42_5_helft",
    # 6_Suesser / 7_Herzen ChordEvent.duration=0 grace-note bug — 暫跳過
    "openscore/schumann_op42_8_schmerz",
    # Berlioz Les nuits d'été 補強 (2)
    "openscore/berlioz_nuits_2_spectre",
    "openscore/berlioz_nuits_4_absence",
    # Mahler Des Knaben Wunderhorn (1)
    "openscore/mahler_wunderhorn_7_rhein",
    # Wolf Eichendorff-Lieder (3)
    # Mörike No.5 Tambour: ChordEvent.duration=0 grace-note bug — 暫跳過
    "openscore/wolf_eichendorff_3_verschwiegene",
    "openscore/wolf_eichendorff_12_heimweh",
    "openscore/wolf_eichendorff_18_erwartung",
]

_SET = set(SAMPLE_CORPUS_IDS)

_COMPOSER = {
    "bach": "J. S. Bach",
    "corelli": "Corelli",
    "handel": "Handel",
    "mozart": "Mozart",
    "haydn": "Haydn",
    "beethoven": "Beethoven",
    "chopin": "Chopin",
    "joplin": "Joplin",
    "schubert": "Schubert",
    "schumann_clara": "Clara Schumann",
    "schumann_robert": "Schumann",
    "verdi": "Verdi",
}


def _slug(corpus_id: str) -> str:
    # 0.1.40: openscore/<slug> → openscore_<slug>.mxl
    # (OpenScore corpus 用 '.mxl' 壓縮格式而非 .musicxml, 故 . 不替換)
    if corpus_id.startswith("openscore/"):
        return "openscore_" + corpus_id[len("openscore/"):]
    return corpus_id.replace("/", "_").replace(".", "-")


def _sample_dir() -> Path:
    """範例檔目錄 — 凍結模式走 PyInstaller _MEIPASS, 否則走原始碼目錄。"""
    if getattr(sys, "frozen", False):
        base = getattr(sys, "_MEIPASS", None)
        if base:
            return Path(base) / "core" / "sample_scores"
    return Path(__file__).parent / "sample_scores"


def resolve(corpus_id: str) -> Optional[Path]:
    """corpus_id → 隨附 .musicxml / .mxl 路徑; 不在清單或檔不存在 → None.

    0.1.40: 也試 .mxl (壓縮 MusicXML, OpenScore 用此格式).
    """
    if corpus_id not in _SET:
        return None
    base = _sample_dir() / _slug(corpus_id)
    for ext in (".musicxml", ".mxl"):
        p = base.with_suffix(ext)
        if p.exists():
            return p
    return None


def list_samples() -> list[dict[str, str]]:
    """給 list_corpus 用 — 只列出實際存在的隨附範例。"""
    out: list[dict[str, str]] = []
    for cid in SAMPLE_CORPUS_IDS:
        if resolve(cid) is not None:
            composer = _COMPOSER.get(cid.split("/")[0], cid.split("/")[0])
            out.append({
                "corpus_path": cid,
                "composer": composer,
                "title": cid,
            })
    return out

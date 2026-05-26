"""隨 app 出貨的範例樂譜 (core/samples.py) regression test。

打包版 (PyInstaller frozen) 不含 music21 corpus, 只靠 core/sample_scores/
下的隨附 .musicxml。本檔確保:
  - SAMPLE_CORPUS_IDS 清單與前端 PresetLibrary 的 PRESETS 一致 (58 首)
    0.1.40 新增 13 OpenScore Lieder (CC0).
  - 每個 corpus_id 都有對應且存在的 .musicxml
  - corpus:<id> 能被 parse_musicxml 解析成有效 IR
"""

from __future__ import annotations

import pytest

from core import samples
from core.ir_validate import validate
from core.parser import parse_musicxml


def test_sample_count():
    """PresetLibrary 精選 58 首 — 數量不可漂移 (0.1.40)."""
    assert len(samples.SAMPLE_CORPUS_IDS) == 299
    assert len(set(samples.SAMPLE_CORPUS_IDS)) == 299  # 無重複


def test_all_samples_resolve():
    """每個 corpus_id 都必須對應到實際存在的隨附檔。"""
    missing = [cid for cid in samples.SAMPLE_CORPUS_IDS
               if samples.resolve(cid) is None]
    assert missing == [], f"缺少隨附 .musicxml: {missing}"


def test_list_samples_returns_all():
    """list_samples() (給 list_corpus RPC 用) 應列出全部 58 首。"""
    listed = samples.list_samples()
    assert len(listed) == 299
    for entry in listed:
        assert entry["corpus_path"] in set(samples.SAMPLE_CORPUS_IDS)
        assert entry["composer"]
        assert entry["title"]


def test_unknown_corpus_id_returns_none():
    """不在清單內的 id → resolve 回 None (不可誤指到別的檔)。"""
    assert samples.resolve("bach/does-not-exist") is None
    assert samples.resolve("") is None


# music21 corpus 已知資料瑕疵 — 不算 parser bug, 容許通過。
#   chopin/mazurka06-2: 來源檔在曲中夾雜 number="0" 的小節 → 編號倒序。
_KNOWN_DATA_QUIRKS = {"E_MEASURE_NUMBER_BACKWARDS"}


@pytest.mark.parametrize("corpus_id", samples.SAMPLE_CORPUS_IDS)
def test_sample_parses_to_valid_ir(corpus_id):
    """corpus:<id> 能解析成通過驗證的 IR — 這是打包版能載入範例的保證。"""
    ir = parse_musicxml(f"corpus:{corpus_id}")
    assert len(ir.parts) > 0
    assert any(len(p.measures) > 0 for p in ir.parts)
    result = validate(ir)
    real_errors = [e for e in result.errors
                   if e.code not in _KNOWN_DATA_QUIRKS]
    if real_errors:
        msgs = "\n".join(f"  {e.code}: {e.message}" for e in real_errors[:5])
        pytest.fail(f"{corpus_id} 解析後驗證失敗:\n{msgs}")

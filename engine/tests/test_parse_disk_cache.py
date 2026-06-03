"""B4: 持久 (磁碟) 解析快取 — 依檔案內容 hash 跨 session 重用。"""
from __future__ import annotations

import shutil
from pathlib import Path

import core.parser as P

SRC = str(
    Path(__file__).parent.parent / "core" / "sample_scores" / "bach_bwv66-6.musicxml"
)


def _no_reparse(*_args, **_kwargs):
    raise AssertionError("應命中磁碟快取, 不該重新 parse_stream")


def test_disk_cache_hit_skips_reparse(tmp_path, monkeypatch):
    monkeypatch.setattr(P, "_DISK_CACHE_DIR", tmp_path / "pc")
    P.clear_parse_cache()
    s1 = P.parse_musicxml(SRC)
    assert s1.parts
    pkls = list((tmp_path / "pc").glob("*.pkl"))
    assert len(pkls) == 1, "cold parse 應寫一份磁碟快取"

    # 清掉記憶體快取 → 第二次必須走磁碟; 若命中, parse_stream 不該被呼叫
    P.clear_parse_cache()
    monkeypatch.setattr(P, "parse_stream", _no_reparse)
    s2 = P.parse_musicxml(SRC)
    assert len(s2.parts) == len(s1.parts)
    assert s2.metadata.get("source_path") == SRC


def test_disk_cache_content_keyed_across_paths(tmp_path, monkeypatch):
    """同內容不同路徑 → 仍命中 (key 是內容 hash, 非路徑/mtime)。"""
    monkeypatch.setattr(P, "_DISK_CACHE_DIR", tmp_path / "pc")
    P.clear_parse_cache()
    s1 = P.parse_musicxml(SRC)

    other = tmp_path / "renamed_copy.musicxml"
    shutil.copyfile(SRC, other)
    P.clear_parse_cache()
    monkeypatch.setattr(P, "parse_stream", _no_reparse)  # 命中就不會被呼叫
    s2 = P.parse_musicxml(str(other))
    assert len(s2.parts) == len(s1.parts)
    # 命中後 source_path 應對齊「當前」路徑
    assert s2.metadata.get("source_path") == str(other)


def test_disk_cache_corrupt_falls_back(tmp_path, monkeypatch):
    """快取檔損毀 / 不相容 → 當 miss + 重 parse, 不崩。"""
    monkeypatch.setattr(P, "_DISK_CACHE_DIR", tmp_path / "pc")
    P.clear_parse_cache()
    s1 = P.parse_musicxml(SRC)

    P.clear_parse_cache()
    for p in (tmp_path / "pc").glob("*.pkl"):
        p.write_bytes(b"not a valid pickle")
    s2 = P.parse_musicxml(SRC)  # 不應 raise
    assert len(s2.parts) == len(s1.parts)


def test_disk_cache_version_bump_invalidates(tmp_path, monkeypatch):
    """版本號變動 → 舊 key 不再命中 (走重 parse)。"""
    monkeypatch.setattr(P, "_DISK_CACHE_DIR", tmp_path / "pc")
    monkeypatch.setattr(P, "_PARSE_CACHE_VERSION", 1)
    P.clear_parse_cache()
    P.parse_musicxml(SRC)
    # 模擬 IR 改版
    monkeypatch.setattr(P, "_PARSE_CACHE_VERSION", 2)
    P.clear_parse_cache()
    s2 = P.parse_musicxml(SRC)  # 新版 key → 不該撞舊快取
    assert s2.parts
    keys = {p.name.split("_")[0] for p in (tmp_path / "pc").glob("*.pkl")}
    assert "v2" in keys

"""Phase B: Project Schema v2 + v1→v2 遷移測試。"""
import pytest

from core.project_schema import (
    PROJECT_FORMAT,
    PROJECT_VERSION_V2,
    coerce_to_v2,
    detect_version,
    make_project_v2,
    migrate_v1_to_v2,
)


def _v1_sample() -> dict:
    return {
        "format": PROJECT_FORMAT,
        "version": "0.1.0",
        "source_path": "/scores/x.musicxml",
        "arrangement": {
            "arrangement_id": "a1", "name": "弦四版", "source_id": "s1",
            "players": [], "assignments": [],
        },
        "target_score": {"parts": []},
    }


def test_detect_version_defaults_to_v1():
    assert detect_version({"version": "0.1.0"}) == "0.1.0"
    assert detect_version({"version": "2"}) == "2"
    assert detect_version({}) == "0.1.0"  # 無欄位 → 最舊


def test_migrate_v1_to_v2_keeps_all_data():
    v2 = migrate_v1_to_v2(_v1_sample())
    assert v2["version"] == PROJECT_VERSION_V2
    assert v2["sources"][0]["path"] == "/scores/x.musicxml"
    assert v2["sources"][0]["source_id"] == "s1"
    # target_score 從頂層收進 arrangement
    assert v2["arrangements"][0]["arrangement_id"] == "a1"
    assert v2["arrangements"][0]["target_score"] == {"parts": []}
    assert v2["active"]["arrangement_id"] == "a1"
    # v2 新增的收斂位 (開空集, 後續 slice 填)
    assert v2["layouts"] == {} and v2["practice"] == {}
    assert v2["rehearsal_notes"] == []


def test_coerce_v1_migrates():
    v2 = coerce_to_v2(_v1_sample())
    assert v2["version"] == PROJECT_VERSION_V2
    assert len(v2["arrangements"]) == 1


def test_coerce_v2_is_passthrough():
    v2 = make_project_v2(sources=[], arrangements=[], active_arrangement_id="a")
    assert coerce_to_v2(v2) is v2  # 已是 v2 → 原樣回傳


def test_coerce_rejects_bad_format():
    with pytest.raises(ValueError):
        coerce_to_v2({"format": "not-a-project"})


def test_coerce_rejects_unknown_version():
    with pytest.raises(ValueError):
        coerce_to_v2({"format": PROJECT_FORMAT, "version": "99"})

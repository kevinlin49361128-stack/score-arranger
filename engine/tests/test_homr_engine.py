"""homr 引擎 runner (可選 OMR 引擎) 單元測試。

不需真的裝 homr: 用 /bin/echo 當假執行檔測偵測路徑; 缺失/錯誤路徑測 fallback。
"""
import os

import pytest

from core.omr import HomrError, HomrStatus, detect_homr, image_to_musicxml


def _set_homr_path(monkeypatch, path):
    monkeypatch.setenv("HOMR_PATH", path)


def test_detect_homr_available_when_path_runs(monkeypatch):
    # /bin/echo 接受 --help 且有輸出 → 偵測為可用
    _set_homr_path(monkeypatch, "/bin/echo")
    s = detect_homr()
    assert isinstance(s, HomrStatus)
    assert s.available is True
    assert s.homr_path == "/bin/echo"
    assert s.missing == []


def test_detect_homr_missing_when_not_found(monkeypatch):
    _set_homr_path(monkeypatch, "/nonexistent/homr-xyz")
    monkeypatch.setattr("shutil.which", lambda _name: None)
    s = detect_homr()
    assert s.available is False
    assert "homr" in s.missing
    assert s.install_hints  # 給 UI 安裝指引
    assert "github.com/liebharc/homr" in s.install_hints.get("homepage", "")


def test_image_to_musicxml_errors_when_unavailable(monkeypatch, tmp_path):
    img = tmp_path / "page.png"
    img.write_bytes(b"\x89PNG\r\n")  # 假影像 (內容不重要, 走不到 homr)
    _set_homr_path(monkeypatch, "/nonexistent/homr-xyz")
    monkeypatch.setattr("shutil.which", lambda _name: None)
    with pytest.raises(HomrError):
        image_to_musicxml(str(img))


def test_image_to_musicxml_missing_file(monkeypatch):
    _set_homr_path(monkeypatch, "/bin/echo")
    with pytest.raises(FileNotFoundError):
        image_to_musicxml("/nope/missing-image.png")

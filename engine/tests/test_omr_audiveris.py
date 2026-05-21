"""Audiveris OMR 模組單元測試

由於 Audiveris 可能未安裝, 大部分測試走 mock; 真實 invoke 測試
標記為 skipif 未偵測到 Audiveris.
"""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from core.omr.audiveris import (
    AudiverisError,
    AudiverisStatus,
    _find_audiveris,
    detect_audiveris,
    pdf_to_musicxml,
)


class TestDetect:
    def test_detect_returns_status_struct(self):
        s = detect_audiveris()
        assert isinstance(s, AudiverisStatus)
        # 至少回傳結構正確 — available 與 missing 互斥
        assert isinstance(s.available, bool)
        assert isinstance(s.missing, list)
        if s.available:
            assert s.missing == []
            assert s.audiveris_path is not None
            assert s.java_ok
        else:
            assert len(s.missing) >= 1

    def test_missing_audiveris_gives_install_hint(self):
        with patch("core.omr.audiveris._find_audiveris", return_value=None):
            s = detect_audiveris()
            assert not s.available
            assert "audiveris" in s.missing
            assert "audiveris" in s.install_hints
            # 提示訊息至少包含下載 URL 或 brew 字樣
            text = s.install_hints["audiveris"].lower()
            assert "audiveris" in text or "brew" in text or "github" in text

    def test_missing_java_gives_install_hint(self):
        with patch("core.omr.audiveris._detect_java", return_value=None):
            s = detect_audiveris()
            assert not s.java_ok
            assert "java" in s.missing
            assert "java" in s.install_hints

    def test_env_var_override(self, tmp_path):
        # 偽造一個檔案當成 audiveris path
        fake = tmp_path / "audiveris"
        fake.write_text("#!/bin/sh\necho fake")
        fake.chmod(0o755)
        old = os.environ.get("AUDIVERIS_PATH")
        try:
            os.environ["AUDIVERIS_PATH"] = str(fake)
            found = _find_audiveris()
            assert found == str(fake)
        finally:
            if old is None:
                os.environ.pop("AUDIVERIS_PATH", None)
            else:
                os.environ["AUDIVERIS_PATH"] = old


class TestPdfToMusicXML:
    def test_missing_pdf_raises(self):
        with pytest.raises(FileNotFoundError):
            pdf_to_musicxml("/nonexistent/file.pdf")

    def test_non_pdf_raises(self, tmp_path):
        not_pdf = tmp_path / "foo.txt"
        not_pdf.write_text("not a pdf")
        with pytest.raises(AudiverisError, match="非 PDF"):
            pdf_to_musicxml(str(not_pdf))

    def test_audiveris_missing_raises_clear_error(self, tmp_path):
        fake_pdf = tmp_path / "test.pdf"
        fake_pdf.write_bytes(b"%PDF-1.4\nfake\n%%EOF")
        with patch(
            "core.omr.audiveris.detect_audiveris",
            return_value=AudiverisStatus(
                available=False, java_ok=False, audiveris_path=None,
                version=None, missing=["java", "audiveris"],
                install_hints={"audiveris": "install hint"},
            ),
        ):
            with pytest.raises(AudiverisError, match="不可用"):
                pdf_to_musicxml(str(fake_pdf))

    @staticmethod
    def _available_status() -> AudiverisStatus:
        return AudiverisStatus(
            available=True, java_ok=True,
            audiveris_path="/fake/audiveris", version="5.10",
            missing=[], install_hints={},
        )

    def test_partial_output_returned_on_nonzero_exit(self, tmp_path):
        """Audiveris 退出碼非 0 但已產出 .mxl → 仍回傳 (部分辨識結果)。"""
        fake_pdf = tmp_path / "song.pdf"
        fake_pdf.write_bytes(b"%PDF-1.4\nfake\n%%EOF")
        out_dir = tmp_path / "out"
        out_dir.mkdir()
        produced = out_dir / "song" / "song.mxl"
        produced.parent.mkdir()
        produced.write_bytes(b"x" * 2000)  # > 256 bytes

        fake_result = MagicMock(
            returncode=1, stdout="", stderr="Error in export",
        )
        with patch(
            "core.omr.audiveris.detect_audiveris",
            return_value=self._available_status(),
        ), patch(
            "core.omr.audiveris.subprocess.run", return_value=fake_result,
        ):
            out = pdf_to_musicxml(str(fake_pdf), output_dir=str(out_dir))
        assert out == str(produced)

    def test_nonzero_exit_no_output_raises_with_log(self, tmp_path):
        """退出碼非 0 且無任何輸出 → 拋錯, 並寫出完整 log。"""
        fake_pdf = tmp_path / "song.pdf"
        fake_pdf.write_bytes(b"%PDF-1.4\nfake\n%%EOF")
        out_dir = tmp_path / "out"
        out_dir.mkdir()
        fake_result = MagicMock(returncode=1, stdout="boom", stderr="fatal")
        with patch(
            "core.omr.audiveris.detect_audiveris",
            return_value=self._available_status(),
        ), patch(
            "core.omr.audiveris.subprocess.run", return_value=fake_result,
        ):
            with pytest.raises(AudiverisError, match="無可用輸出"):
                pdf_to_musicxml(str(fake_pdf), output_dir=str(out_dir))
        assert (out_dir / "audiveris.log").exists()

    @pytest.mark.skipif(
        not detect_audiveris().available,
        reason="Audiveris not installed locally",
    )
    def test_real_invoke_with_minimal_pdf(self, tmp_path):
        """Smoke test: 若本機有裝 Audiveris, 跑一次真實轉檔."""
        # 取個現有 sample (本 repo 沒附 PDF, 跳過真實測試是合理的)
        sample = Path(__file__).parent / "fixtures" / "sample.pdf"
        if not sample.exists():
            pytest.skip("no sample.pdf fixture")
        out = pdf_to_musicxml(str(sample), output_dir=str(tmp_path))
        assert Path(out).exists()
        assert out.endswith((".mxl", ".xml"))

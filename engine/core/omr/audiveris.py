"""
Audiveris OMR 整合 — PDF → MusicXML

Audiveris (https://github.com/Audiveris/audiveris) 是目前最成熟的開源 OMR.
GPLv3 授權, 我們透過 child process 呼叫 CLI, 避免授權污染主程式 (Score Arranger
本體不 link / bundle Audiveris 二進位).

CLI 用法 (Audiveris 5.x):
    audiveris -batch -export -output <out_dir> -- <input.pdf>

輸出: <out_dir>/<basename>/<basename>.mxl  (壓縮 MusicXML)
或      <out_dir>/<basename>/<basename>.xml (未壓縮, 若 -option export.formatXml=true)

偵測路徑:
- macOS: /Applications/Audiveris.app/Contents/MacOS/Audiveris
- macOS Homebrew: /opt/homebrew/bin/audiveris, /usr/local/bin/audiveris
- Linux: /usr/bin/audiveris, /usr/local/bin/audiveris
- 環境變數: AUDIVERIS_PATH (使用者自訂)
- PATH 中: 任何叫 audiveris 的執行檔
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


class AudiverisError(RuntimeError):
    """Audiveris 執行或環境錯誤."""


@dataclass
class AudiverisStatus:
    available: bool
    java_ok: bool
    audiveris_path: Optional[str]
    version: Optional[str]
    missing: list[str]               # ["java", "audiveris"]
    install_hints: dict[str, str]    # {platform: url_or_text}


# === 平台特定的常見安裝位置 ===
_COMMON_PATHS_DARWIN = [
    "/Applications/Audiveris.app/Contents/MacOS/Audiveris",
    "/opt/homebrew/bin/audiveris",
    "/usr/local/bin/audiveris",
    str(Path.home() / "Applications/Audiveris.app/Contents/MacOS/Audiveris"),
]
_COMMON_PATHS_LINUX = [
    "/usr/bin/audiveris",
    "/usr/local/bin/audiveris",
    "/opt/audiveris/bin/audiveris",
    "/snap/bin/audiveris",
]
_COMMON_PATHS_WIN32 = [
    r"C:\Program Files\Audiveris\bin\audiveris.bat",
    r"C:\Program Files (x86)\Audiveris\bin\audiveris.bat",
]


def _candidate_paths() -> list[str]:
    env = os.environ.get("AUDIVERIS_PATH")
    if env:
        return [env]
    if sys.platform == "darwin":
        return _COMMON_PATHS_DARWIN
    if sys.platform == "win32":
        return _COMMON_PATHS_WIN32
    return _COMMON_PATHS_LINUX


def _find_audiveris() -> Optional[str]:
    """搜尋常見路徑 + PATH, 回傳 audiveris 執行檔位置 (找不到 None)."""
    # 1. 環境變數 / 常見路徑 — exists + executable
    for p in _candidate_paths():
        if p and Path(p).exists():
            return p
    # 2. PATH (Windows 上 audiveris.bat, 其他 audiveris)
    for name in ("audiveris", "Audiveris"):
        found = shutil.which(name)
        if found:
            return found
    return None


def _detect_java() -> Optional[str]:
    """檢查 java 是否在 PATH; 回傳版本字串 (None 表示找不到)."""
    java = shutil.which("java")
    if not java:
        return None
    try:
        # java -version 把版本印到 stderr
        result = subprocess.run(
            [java, "-version"],
            capture_output=True, text=True, timeout=5,
        )
        out = result.stderr or result.stdout
        first = out.splitlines()[0] if out else ""
        return first.strip() or "unknown"
    except Exception:
        return "unknown"


def _detect_audiveris_version(path: str) -> Optional[str]:
    """執行 audiveris --version 取得版本字串 (失敗回 None)."""
    try:
        result = subprocess.run(
            [path, "-help"],
            capture_output=True, text=True, timeout=15,
        )
        out = (result.stdout + result.stderr).strip()
        # 通常第一行類似 "Audiveris 5.3.1" 或 java header
        for line in out.splitlines():
            low = line.lower()
            if "audiveris" in low and any(c.isdigit() for c in line):
                return line.strip()
        return "unknown"
    except Exception:
        return None


_INSTALL_HINTS = {
    "darwin": (
        "macOS: 從 https://github.com/Audiveris/audiveris/releases 下載 "
        ".dmg 安裝, 或用 Homebrew: brew install --cask audiveris"
    ),
    "linux": (
        "Linux: 從 https://github.com/Audiveris/audiveris/releases 下載, "
        "或 snap install audiveris"
    ),
    "win32": (
        "Windows: 從 https://github.com/Audiveris/audiveris/releases 下載 "
        ".zip 解壓後執行 bin\\audiveris.bat. 需先安裝 Java 17+ JRE."
    ),
    "java": (
        "需要 Java 17+ JRE. macOS: brew install openjdk@17; "
        "Linux: apt install openjdk-17-jre; "
        "Windows: https://adoptium.net/temurin/releases/?version=17"
    ),
}


def detect_audiveris() -> AudiverisStatus:
    """檢查 Audiveris + Java 是否可用. 回傳 AudiverisStatus."""
    java_version = _detect_java()
    java_ok = java_version is not None

    audiveris_path = _find_audiveris()
    audiveris_version = (
        _detect_audiveris_version(audiveris_path) if audiveris_path else None
    )

    missing: list[str] = []
    if not java_ok:
        missing.append("java")
    if not audiveris_path:
        missing.append("audiveris")

    platform_key = (
        "darwin" if sys.platform == "darwin"
        else "win32" if sys.platform == "win32"
        else "linux"
    )
    hints: dict[str, str] = {}
    if not audiveris_path:
        hints["audiveris"] = _INSTALL_HINTS[platform_key]
    if not java_ok:
        hints["java"] = _INSTALL_HINTS["java"]

    return AudiverisStatus(
        available=java_ok and audiveris_path is not None,
        java_ok=java_ok,
        audiveris_path=audiveris_path,
        version=audiveris_version,
        missing=missing,
        install_hints=hints,
    )


def pdf_to_musicxml(
    pdf_path: str,
    output_dir: Optional[str] = None,
    timeout_sec: int = 300,
) -> str:
    """把 PDF 用 Audiveris 轉成 MusicXML, 回傳產出檔案路徑.

    Args:
        pdf_path: 來源 PDF 絕對路徑.
        output_dir: 輸出目錄 (None 則用 temp dir, 由 caller 處理清理).
        timeout_sec: 子程序超時 (OMR 大譜可能要 1-2 分鐘).

    Returns:
        產出的 .mxl 或 .xml 路徑.

    Raises:
        AudiverisError: Audiveris 未安裝 / 執行失敗 / 找不到輸出.
        FileNotFoundError: pdf_path 不存在.
    """
    pdf = Path(pdf_path).expanduser().resolve()
    if not pdf.exists():
        raise FileNotFoundError(str(pdf))
    if pdf.suffix.lower() != ".pdf":
        raise AudiverisError(f"非 PDF 檔: {pdf}")

    status = detect_audiveris()
    if not status.available:
        raise AudiverisError(
            f"Audiveris 不可用 — 缺: {', '.join(status.missing)}. "
            f"提示: {'; '.join(status.install_hints.values())}"
        )
    assert status.audiveris_path is not None

    out_dir = Path(output_dir) if output_dir else Path(tempfile.mkdtemp(
        prefix="audiveris_"))
    out_dir.mkdir(parents=True, exist_ok=True)

    # Audiveris 5.x CLI:
    #   audiveris -batch -export -output <out_dir> -- <input.pdf>
    cmd = [
        status.audiveris_path,
        "-batch",
        "-export",
        "-output", str(out_dir),
        "--",
        str(pdf),
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout_sec,
        )
    except subprocess.TimeoutExpired as e:
        raise AudiverisError(
            f"Audiveris 超時 ({timeout_sec}s); PDF 過大或頁面複雜"
        ) from e
    except OSError as e:
        raise AudiverisError(f"Audiveris 啟動失敗: {e}") from e

    # 搜尋輸出 — 不論 returncode 都先找。
    # Audiveris 常在「某聲部匯出例外」下退出碼非 0, 但其餘部分仍寫出
    # 可用的 .mxl; OMR 結果本就需人工校對, 回傳 best-effort 優於整個失敗。
    stem = pdf.stem
    candidates = [
        out_dir / stem / f"{stem}.mxl",
        out_dir / stem / f"{stem}.xml",
        out_dir / f"{stem}.mxl",
        out_dir / f"{stem}.xml",
    ]
    found: Optional[Path] = next(
        (c for c in candidates if c.exists() and c.stat().st_size > 256),
        None,
    )
    if found is None:
        # 後備: 在 out_dir 內遞迴找任意非空 .mxl/.xml
        for ext in ("*.mxl", "*.xml"):
            for f in sorted(out_dir.rglob(ext)):
                if f.stat().st_size > 256:
                    found = f
                    break
            if found is not None:
                break

    if found is not None:
        if result.returncode != 0:
            print(
                f"[omr] Audiveris 退出碼 {result.returncode} 但已產出 "
                f"{found.name} — 以部分辨識結果匯入 (建議仔細校對)",
                file=sys.stderr,
            )
        return str(found)

    # 完全沒有輸出 — 寫完整 log 供診斷, 再失敗。
    log_path = out_dir / "audiveris.log"
    try:
        log_path.write_text(
            f"$ {' '.join(cmd)}\n\n"
            f"--- exit code: {result.returncode} ---\n\n"
            f"--- stdout ---\n{result.stdout or ''}\n\n"
            f"--- stderr ---\n{result.stderr or ''}\n",
            encoding="utf-8",
        )
    except OSError:
        log_path = None  # type: ignore[assignment]
    err = (result.stderr or result.stdout or "").strip()
    log_hint = f" (完整 log: {log_path})" if log_path else ""
    raise AudiverisError(
        f"Audiveris 退出碼 {result.returncode}, 無可用輸出{log_hint}. "
        f"{err[-400:] if len(err) > 400 else err}"
    )

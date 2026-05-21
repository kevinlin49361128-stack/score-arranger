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
import re
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


def _find_export(search_dir: Path) -> Optional[Path]:
    """在目錄內遞迴找出 Audiveris 匯出的 MusicXML — .mxl 優先, 須非空。

    Audiveris 會對檔名套用 alias (例: IMSLP83072-… → IMSLP83072.mxl),
    故不靠固定檔名, 直接遞迴搜尋。
    """
    for ext in ("*.mxl", "*.xml"):
        for f in sorted(search_dir.rglob(ext)):
            if f.is_file() and f.stat().st_size > 256:
                return f
    return None


def pdf_to_musicxml(
    pdf_path: str,
    output_dir: Optional[str] = None,
    timeout_sec: int = 600,
) -> str:
    """把 PDF 用 Audiveris 轉成 MusicXML, 回傳產出檔案路徑.

    Args:
        pdf_path: 來源 PDF 絕對路徑.
        output_dir: 輸出目錄 (None 則用 temp dir, 由 caller 處理清理).
        timeout_sec: 單次子程序超時 (整本掃描譜 OMR 可能要數分鐘).

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
    found = _find_export(out_dir)
    if found is not None:
        if result.returncode != 0:
            print(
                f"[omr] Audiveris 退出碼 {result.returncode} 但已產出 "
                f"{found.name} — 以部分辨識結果匯入 (建議仔細校對)",
                file=sys.stderr,
            )
        return str(found)

    # 無輸出 — Audiveris 整本匯出是 all-or-nothing: 只要任一 sheet 被判
    # invalid (IMSLP 總譜常見的純文字說明頁、版權頁), 整本就拒絕匯出。
    # 對策: 主跑已完成 OMR 並寫出 .omr 辨識快取; 從輸出解析無效頁編號,
    # 吃 .omr 快取用 -sheets 排除無效頁「只重新匯出」—— 不重跑 OMR, 數秒
    # 完成, 故不會撞到 caller 的整體 timeout。
    combined = f"{result.stdout or ''}\n{result.stderr or ''}"
    invalid = sorted({int(n) for n in re.findall(r"#(\d+)\s+flagged as invalid", combined)})
    total_match = re.search(r"(\d+)\s+sheets?\s+in\b", combined)
    total = int(total_match.group(1)) if total_match else 0
    omr_caches = sorted(out_dir.rglob("*.omr"))
    omr_cache = omr_caches[0] if omr_caches else None

    retry_result: Optional[subprocess.CompletedProcess[str]] = None
    if invalid and total > len(invalid) and omr_cache is not None:
        valid = [n for n in range(1, total + 1) if n not in invalid]
        # 吃 .omr 重新匯出時 Audiveris 會忽略 -output, 直接寫在 .omr 旁邊
        # (即 out_dir 內), 故重試後仍以 _find_export(out_dir) 搜尋。
        retry_cmd = [
            cmd[0],  # 同一個 audiveris 執行檔
            "-batch",
            "-export",
            "-sheets", *(str(n) for n in valid),
            "--",
            str(omr_cache),
        ]
        print(
            f"[omr] Audiveris 判定第 {', '.join(map(str, invalid))} 頁無樂譜 "
            f"(共 {total} 頁); 排除後重新匯出其餘 {len(valid)} 頁",
            file=sys.stderr,
        )
        try:
            retry_result = subprocess.run(
                retry_cmd, capture_output=True, text=True,
                timeout=timeout_sec,
            )
        except (subprocess.TimeoutExpired, OSError):
            retry_result = None
        retry_found = _find_export(out_dir)
        if retry_found is not None:
            if retry_result is None or retry_result.returncode != 0:
                rc = (
                    retry_result.returncode
                    if retry_result is not None else "timeout"
                )
                print(
                    f"[omr] 重新匯出退出碼 {rc} 但已產出 {retry_found.name} "
                    f"— 以部分辨識結果匯入 (建議仔細校對)",
                    file=sys.stderr,
                )
            return str(retry_found)

    # 完全沒有輸出 (含排除無效頁的重試) — 寫完整 log 供診斷, 再失敗。
    log_path = out_dir / "audiveris.log"
    log_text = (
        f"$ {' '.join(cmd)}\n\n"
        f"--- exit code: {result.returncode} ---\n\n"
        f"--- stdout ---\n{result.stdout or ''}\n\n"
        f"--- stderr ---\n{result.stderr or ''}\n"
    )
    if retry_result is not None:
        log_text += (
            f"\n--- retry (-sheets) exit code: {retry_result.returncode} ---\n\n"
            f"--- retry stdout ---\n{retry_result.stdout or ''}\n\n"
            f"--- retry stderr ---\n{retry_result.stderr or ''}\n"
        )
    try:
        log_path.write_text(log_text, encoding="utf-8")
    except OSError:
        log_path = None  # type: ignore[assignment]
    err = (result.stderr or result.stdout or "").strip()
    log_hint = f" (完整 log: {log_path})" if log_path else ""
    raise AudiverisError(
        f"Audiveris 退出碼 {result.returncode}, 無可用輸出{log_hint}. "
        f"{err[-400:] if len(err) > 400 else err}"
    )

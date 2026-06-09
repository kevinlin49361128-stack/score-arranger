"""homr OMR 引擎整合 — 可選的 end-to-end 引擎 (與 Audiveris 並列)。

決策 docs/decision-pdf-omr.html: 導入 end-to-end OMR 引擎但**保留 Audiveris**,
做成使用者可選引擎。homr (ONNXRuntime + 內建 transformer/segnet 模型) 比照
Audiveris 走「**外部可選工具 + engine shell 呼叫**」—— 不打包進凍結 engine
(homr 全包 ~437MB 會脹爆 app), 改由使用者按需安裝, engine 偵測到才提供此引擎。

spike 實測 (2026-06-09, 乾淨 typeset 輸入): 95% 音符 recall, pc 分布 cosine 1.000,
key/拍號/譜號正確 (真掃描會較差; 此為上界)。homr 吃**單頁影像** (非 PDF);
PDF 需先 rasterize 成頁圖再逐頁送 (留作後續)。
"""
from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


class HomrError(RuntimeError):
    """homr 執行或環境錯誤。"""


@dataclass
class HomrStatus:
    available: bool
    homr_path: Optional[str]
    version: Optional[str]
    missing: list[str] = field(default_factory=list)
    install_hints: dict[str, str] = field(default_factory=dict)


_INSTALL_HINTS = {
    "all": "pip install homr (Python 3.10–3.12; 內建 ONNX 模型約 150–200MB), "
           "或設環境變數 HOMR_PATH 指向已安裝的 homr 執行檔。",
    "homepage": "https://github.com/liebharc/homr",
}


def _candidate_paths() -> list[str]:
    """homr 執行檔候選位置: HOMR_PATH > app 可選下載位置 > 常見 venv/bin。"""
    env = os.environ.get("HOMR_PATH")
    if env:
        return [env]
    home = Path.home()
    return [
        # app 的 download-on-demand 安裝位置 (前端可下載 homr 到此)
        str(home / ".score-arranger" / "homr" / "bin" / "homr"),
        str(home / ".local" / "bin" / "homr"),
        "/opt/homebrew/bin/homr",
        "/usr/local/bin/homr",
    ]


def _find_homr() -> Optional[str]:
    for p in _candidate_paths():
        if p and Path(p).exists():
            return p
    return shutil.which("homr")


def _detect_version(path: str) -> Optional[str]:
    try:
        r = subprocess.run([path, "--help"], capture_output=True,
                           text=True, timeout=15)
        return "installed" if (r.stdout or r.stderr) else "unknown"
    except Exception:
        return None


def detect_homr() -> HomrStatus:
    """偵測 homr 可用性 (給 UI 引擎選擇器判斷是否提供此引擎)。"""
    path = _find_homr()
    if not path:
        return HomrStatus(False, None, None,
                          missing=["homr"], install_hints=_INSTALL_HINTS)
    ver = _detect_version(path)
    return HomrStatus(
        available=ver is not None, homr_path=path, version=ver,
        missing=[] if ver else ["homr"],
        install_hints={} if ver else _INSTALL_HINTS,
    )


def image_to_musicxml(
    image_path: str, timeout_sec: int = 600,
) -> str:
    """用 homr 把單頁譜面影像轉 MusicXML, 回傳產出檔路徑。

    homr 把結果寫到 <image_basename>.musicxml (影像同目錄)。

    Raises:
        HomrError: homr 未安裝 / 執行失敗 / 無產出。
        FileNotFoundError: image_path 不存在。
    """
    img = Path(image_path).expanduser().resolve()
    if not img.exists():
        raise FileNotFoundError(str(img))
    status = detect_homr()
    if not status.available or not status.homr_path:
        raise HomrError("homr 未安裝; " + _INSTALL_HINTS["all"])
    try:
        subprocess.run(
            [status.homr_path, str(img)],
            capture_output=True, text=True, timeout=timeout_sec, check=True,
        )
    except subprocess.TimeoutExpired as e:
        raise HomrError(f"homr 逾時 ({timeout_sec}s)") from e
    except subprocess.CalledProcessError as e:
        tail = (e.stderr or "")[-500:]
        raise HomrError(f"homr 失敗: {tail}") from e
    out = img.with_suffix(".musicxml")
    if not out.exists():
        raise HomrError(f"homr 未產出 MusicXML ({out})")
    return str(out)

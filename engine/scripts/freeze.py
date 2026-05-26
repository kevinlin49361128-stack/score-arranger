#!/usr/bin/env python3
"""
freeze.py — 跨平台 PyInstaller 凍結 (0.1.45 加, 取代 freeze.sh 給 Windows CI 用).

Mac dev 仍可用 bash freeze.sh (功能相同, 純 bash 比較貼近現有 release-mac.sh
流程). Windows GitHub Actions runner 沒有 bash, 改呼叫此 python 版本.

平台差異:
- --add-data 分隔符: Unix ':' / Windows ';'
- PyInstaller venv 路徑: Unix .venv/bin/ / Windows .venv/Scripts/
- 沒 .venv (CI 環境直接用系統 / setup-python) → fall back sys.executable
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ENGINE_ROOT = Path(__file__).parent.parent.resolve()
SEP = ";" if sys.platform == "win32" else ":"

# venv 路徑 (本機開發用); CI 沒 venv 直接用 sys.executable
VENV_PY = ENGINE_ROOT / (
    ".venv/Scripts/python.exe" if sys.platform == "win32"
    else ".venv/bin/python"
)
py = str(VENV_PY) if VENV_PY.exists() else sys.executable

cmd = [
    py, "-m", "PyInstaller", "--noconfirm", "--onedir",
    "--name", "score-arranger-engine",
    "--collect-all", "music21",
    "--collect-submodules", "core",
    "--exclude-module", "mcp.cli",
    "--add-data",
    f"{ENGINE_ROOT / 'core' / 'sample_scores'}{SEP}core/sample_scores",
    "--paths", ".",
    "--distpath", "build-pyi/dist",
    "--workpath", "build-pyi/work",
    "--specpath", "build-pyi",
    "core/cli.py",
]
print(f"$ {' '.join(cmd)}", flush=True)
subprocess.run(cmd, check=True, cwd=ENGINE_ROOT)

# 瘦身: 移除 music21 用不到的大型資料 (~79MB)
M21 = (
    ENGINE_ROOT
    / "build-pyi/dist/score-arranger-engine/_internal/music21"
)
corpus = M21 / "corpus"
if corpus.exists():
    for child in corpus.iterdir():
        if child.is_dir() and child.name != "_metadataCache":
            shutil.rmtree(child)
        elif child.is_file() and child.suffix != ".py":
            child.unlink()

scala = M21 / "scale/scala/scl"
if scala.exists():
    shutil.rmtree(scala)

print("[OK] Frozen + slimmed: build-pyi/dist/score-arranger-engine/")

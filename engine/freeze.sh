#!/usr/bin/env bash
# 凍結 Python engine 成獨立執行檔 (PyInstaller)。
#
# 產出: build-pyi/dist/score-arranger-engine/  (onedir — 含執行檔 + _internal/)
# 由 electron-builder 經 extraResources 帶進 .app 的 resources/engine/。
#
# 注意:
#   --exclude-module mcp.cli  — mcp.cli import 時呼叫 sys.exit(1), 會中斷 build
#   --add-data sample_scores  — 隨附範例樂譜 (凍結後 music21 corpus 路徑會壞)
set -euo pipefail
cd "$(dirname "$0")"

VENV_PY=".venv/bin/python"
if [ ! -x "$VENV_PY" ]; then
  echo "error: $VENV_PY 不存在 — 先建立 venv 並 pip install" >&2
  exit 1
fi

# --add-data 的 SRC 用絕對路徑 — PyInstaller 會把相對 SRC 當成相對
# --specpath 解析, 不是 cwd。
ENGINE_ROOT="$(pwd)"

"$VENV_PY" -m PyInstaller --noconfirm --onedir \
  --name score-arranger-engine \
  --collect-all music21 \
  --collect-submodules core \
  --exclude-module mcp.cli \
  --add-data "${ENGINE_ROOT}/core/sample_scores:core/sample_scores" \
  --paths . \
  --distpath build-pyi/dist \
  --workpath build-pyi/work \
  --specpath build-pyi \
  core/cli.py

# ── 瘦身: 移除 music21 用不到的大型資料 (~79MB) ──────────────────
# #103 後範例改隨附 (core/sample_scores), 引擎不再呼叫 music21.corpus;
# scala 自訂音階檔也沒用到。保留各模組的 .py → music21 仍可正常 import。
M21="build-pyi/dist/score-arranger-engine/_internal/music21"
if [ -d "$M21/corpus" ]; then
  # corpus/ 樂譜資料 (~66MB) — 留 .py 與 _metadataCache
  find "$M21/corpus" -mindepth 1 -maxdepth 1 -type d \
    ! -name "_metadataCache" -exec rm -rf {} +
  find "$M21/corpus" -maxdepth 1 -type f ! -name "*.py" -delete
fi
# scala 音階檔庫 (~15MB)
rm -rf "$M21/scale/scala/scl"

echo "✓ 凍結完成 (已瘦身): build-pyi/dist/score-arranger-engine/"

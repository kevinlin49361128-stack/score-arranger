#!/usr/bin/env bash
# Mypy baseline 比對 — CI 抓 regression 用.
#
# 策略: 0.1.28 引入 mypy 時有 68 個 type error (見 mypy-baseline.txt).
# 一次清零成本太高, 採 ratchet 模式 — 每次允許錯誤數 ≤ baseline.
# 修掉幾個就更新 baseline; CI 抓到比 baseline 多就 fail.
#
# 用法: bash engine/scripts/check_mypy_baseline.sh
set -euo pipefail

ENGINE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ENGINE_DIR"

BASELINE_FILE="mypy-baseline.txt"
if [[ ! -f "$BASELINE_FILE" ]]; then
    echo "ERROR: $BASELINE_FILE 不存在"
    exit 2
fi
BASELINE=$(cat "$BASELINE_FILE" | tr -d '[:space:]')

PYTHON="${PYTHON:-.venv/bin/python}"
if [[ ! -x "$PYTHON" ]]; then
    PYTHON=python3
fi

# mypy 自己 exit code: 0 = clean, 非 0 = 有錯 — 我們吃掉 (用 || true)
# 我們的 exit code: 0 = ≤ baseline, 1 = > baseline (regression)
set +e
MYPY_OUT=$("$PYTHON" -m mypy core 2>&1)
set -e
ACTUAL=$(echo "$MYPY_OUT" | grep -E "^Found [0-9]+ error" | awk '{print $2}' || echo "")
# 「Success: no issues」沒有 Found 行
if [[ -z "$ACTUAL" ]]; then
    if echo "$MYPY_OUT" | grep -q "Success"; then
        ACTUAL=0
    else
        echo "ERROR: 無法解析 mypy 輸出"
        echo "$MYPY_OUT" | tail -5
        exit 2
    fi
fi

echo "Mypy baseline: $BASELINE"
echo "Mypy current:  $ACTUAL"

if (( ACTUAL > BASELINE )); then
    echo ""
    echo "❌ Regression: $ACTUAL > $BASELINE."
    echo "新增 type error. 修掉新增的, 或檢討是否真的需要這個型別."
    exit 1
elif (( ACTUAL < BASELINE )); then
    echo ""
    echo "✓ 修了 $((BASELINE - ACTUAL)) 個 error. 別忘了把 $BASELINE_FILE 改成 $ACTUAL."
    exit 0
else
    echo "✓ 與 baseline 相同."
    exit 0
fi

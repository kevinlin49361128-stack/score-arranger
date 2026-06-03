"""Phase 0: schema-first RPC 契約守則。

守住兩件事:
  1. CONTRACTS 的 method 名稱都真的存在於 server.METHODS (契約不指向不存在的 method)。
  2. 生成的 src/renderer/generated/rpc-types.ts 不過時 (改了 schema 沒重跑 codegen → fail)。
"""
import subprocess
import sys
from pathlib import Path

from core.rpc_schema import CONTRACTS
from core.server import METHODS


def test_contracts_are_real_methods():
    for method, (req, res) in CONTRACTS.items():
        assert method in METHODS, f"CONTRACTS 有 '{method}' 但 server.METHODS 沒有"
        assert req.__name__.endswith("Req")
        assert res.__name__.endswith("Res")


def test_generated_ts_is_fresh():
    """rpc-types.ts 與 rpc_schema 同步 (否則請重跑 gen_rpc_types.py)。"""
    script = Path(__file__).parent.parent / "scripts" / "gen_rpc_types.py"
    r = subprocess.run(
        [sys.executable, str(script), "--check"],
        capture_output=True, text=True,
    )
    assert r.returncode == 0, (
        f"rpc-types.ts 過時 — 重跑 gen_rpc_types.py。\n{r.stdout}\n{r.stderr}"
    )

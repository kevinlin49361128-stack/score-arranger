"""0.1.47 C3 — OMR + auto-update e2e 結構性測試.

OMR (PDF → MusicXML 走 Audiveris 子程序) 和 auto-update
(electron-updater) 都是依賴外部資源的 critical path:
- OMR: 需要 Audiveris JAR 安裝在使用者機器
- auto-update: 需要 GitHub Releases 連線

要寫真實 e2e (拿一份 PDF 跑 Audiveris) 在 CI 上不可行 (太慢, 而且需要
JDK + Audiveris 安裝). 本檔做的是結構性測試 — 確保模組 import 不炸,
detect_audiveris 接 None / 有 / 沒有環境都有合理輸出, 公開 API 介面
穩定.

真實 e2e 由 macOS dev box 手動驗證 (release-mac.sh 後 smoke test).
"""

from __future__ import annotations

import pytest


# ============================================================================
# OMR — Audiveris 偵測
# ============================================================================


def test_omr_module_imports():
    """import 不該炸 — 即使 Audiveris 沒裝."""
    from core import omr
    # Public API surface — 不該因 Audiveris 沒安裝而 import error
    assert hasattr(omr, "detect_audiveris")
    assert hasattr(omr, "pdf_to_musicxml")
    assert hasattr(omr, "AudiverisError")


def test_detect_audiveris_returns_status_struct():
    """detect_audiveris 不該 raise — 不管裝沒裝都回 Status."""
    from core.omr import detect_audiveris
    status = detect_audiveris()
    # 不檢查具體值 (CI 環境通常沒裝); 只確認介面穩定
    assert hasattr(status, "audiveris_path")
    assert hasattr(status, "version")
    # path 是 str 或 None
    assert status.audiveris_path is None or isinstance(
        status.audiveris_path, str,
    )


def test_audiveris_error_is_exception_class():
    """AudiverisError 必須是 Exception subclass (給 server.py catch)."""
    from core.omr import AudiverisError
    assert issubclass(AudiverisError, Exception)


def test_pdf_to_musicxml_signature():
    """pdf_to_musicxml 應接 (pdf_path, ...) → str path; 無 Audiveris 時
    raise AudiverisError 而非 silent fail."""
    import inspect
    from core.omr import pdf_to_musicxml
    sig = inspect.signature(pdf_to_musicxml)
    # 必須有 pdf_path 參數
    params = list(sig.parameters.keys())
    assert any("pdf" in p.lower() for p in params), (
        f"pdf_to_musicxml 缺 pdf_path 參數: {params}"
    )


def test_omr_server_method_registered():
    """server.py 應該 register omr 相關 method."""
    from core.server import METHODS
    omr_methods = [m for m in METHODS if "omr" in m.lower()
                   or "audiveris" in m.lower() or "pdf" in m.lower()]
    assert len(omr_methods) > 0, (
        f"server.py 未 register OMR method: {sorted(METHODS.keys())[:10]}..."
    )


# ============================================================================
# auto-update — electron-updater 設定結構
# ============================================================================


def test_electron_builder_config_has_publish():
    """electron-builder.yml 應該設定 publish (GitHub Releases) 給 updater."""
    from pathlib import Path
    config_path = Path(__file__).parent.parent.parent / "electron-builder.yml"
    if not config_path.exists():
        pytest.skip("electron-builder.yml not at expected location")
    content = config_path.read_text(encoding="utf-8")
    assert "publish:" in content or "publish " in content, (
        "electron-builder.yml 缺 publish 設定"
    )
    # github provider 是 auto-update 預設
    assert "github" in content.lower(), (
        "publish 應該指向 GitHub provider"
    )


def test_package_json_declares_electron_updater():
    """package.json 必須依賴 electron-updater."""
    import json
    from pathlib import Path
    pkg = Path(__file__).parent.parent.parent / "package.json"
    if not pkg.exists():
        pytest.skip("package.json not found")
    data = json.loads(pkg.read_text(encoding="utf-8"))
    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    assert "electron-updater" in deps, (
        f"package.json 缺 electron-updater 依賴: {sorted(deps.keys())[:10]}..."
    )


def test_main_index_wires_autoupdater():
    """src/main/index.ts 應該有 autoUpdater 啟動 / event handler."""
    from pathlib import Path
    main_ts = Path(__file__).parent.parent.parent / "src" / "main" / "index.ts"
    if not main_ts.exists():
        pytest.skip("src/main/index.ts not found")
    content = main_ts.read_text(encoding="utf-8")
    # 至少要 import 或 wire autoUpdater
    has_updater = (
        "electron-updater" in content
        or "autoUpdater" in content
        or "checkForUpdates" in content
    )
    assert has_updater, (
        "src/main/index.ts 沒看到 electron-updater 整合代碼"
    )

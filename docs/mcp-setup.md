# MCP Server 使用指南

Score Arranger 提供一個 **MCP (Model Context Protocol)** server，讓任何支援 MCP 的 AI 客戶端（Claude Desktop、Cursor、Continue 等）直接呼叫改編引擎，**不必開啟 Electron app**。

## 使用情境

> 「Claude，幫我把 Bach BWV 66.6 改編成弦樂四重奏，輸出到我桌面的 `bach_quartet.musicxml`。」

Claude 收到後會依序呼叫：
1. `list_corpus` — 找到 `bach/bwv66.6`
2. `arrange_and_export` — 一次完成解析 → 改編 → 修復 → 匯出
3. 把結果回報給你（含品質分數、各聲部分配、剩餘問題）

整個流程不需要打開 GUI。

## 啟動 server

獨立執行（驗證能否啟動）：
```bash
cd ~/樂譜改編/engine
.venv/bin/python -m core.mcp_server
```
正常情況下程式會 block 等 stdio 輸入（不會印任何東西到 stdout）。`Ctrl+C` 結束。

## 接到 Claude Desktop

編輯 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "score-arranger": {
      "command": "/Users/kevinlin/樂譜改編/engine/.venv/bin/python",
      "args": ["-m", "core.mcp_server"],
      "cwd": "/Users/kevinlin/樂譜改編/engine"
    }
  }
}
```

重啟 Claude Desktop，工具欄會出現 **🔌 score-arranger**。

## 接到 Cursor / Continue / 其他 MCP client

任何支援 MCP 的客戶端格式大同小異——主要是 `command` 與 `args`：
- **command**: `engine/.venv/bin/python` 的絕對路徑
- **args**: `["-m", "core.mcp_server"]`
- **cwd**: `engine/` 的絕對路徑

## Tool 列表

| Tool | 用途 |
|------|------|
| `list_corpus` | 列出內建可用樂譜（Bach、Mozart、Beethoven 等） |
| **`arrange_and_export`** | **一次完成：source → arrange → repair → export**（推薦） |
| `analyze_score` | 樂句偵測 + 聲部功能標記 + 和聲分析 + 可演奏性 |
| `arrange_score` | 改編但不匯出（結果留在 session，供後續編輯） |
| `get_arrangement_status` | 查目前改編的 quality / difficulty / issues |
| `apply_suggestion` | 對特定 issue 套用一個修復建議 |
| `edit_event` | 微調單一事件（transpose / dynamic / 改時值 / 刪除） |
| `export_arrangement` | 把 session 內的改編結果寫到磁碟 |

## 範例對話

> **You**：把 Beethoven Op.18 No.1 第一樂章改編成鋼琴獨奏，存到 `~/Desktop/op18_piano.musicxml`，如果有可演奏性問題試著修復。

> **Claude** (透過 MCP)：
> 1. 呼叫 `arrange_and_export({ source: "corpus:beethoven/opus18no1/movement1", target_ensemble: "piano_solo", output_path: "/Users/.../Desktop/op18_piano.musicxml", repair: true })`
> 2. 收到結果：旋律保留 92%、和聲完整 88%、可演奏性 95%，總體 91/100，輸出檔 187 KB
> 3. 回覆：「已輸出到 ~/Desktop/op18_piano.musicxml。改編品質 91/100，3 個 warning 為單一鋼琴手難跨越的和弦，建議手動檢查 m.42 與 m.78。」

## 注意事項

- **MCP server session 與 Electron app session 互不干擾** — MCP 用 `mcp-default` session_id，GUI 用各自 tab 的 session_id
- 若 Electron app 正在跑，MCP 仍能正常工作（兩個是不同 Python process）
- **檔案路徑用絕對路徑** — MCP server 的 cwd 是 `engine/`，相對路徑會解到那邊
- **超大譜（>1000 measures）** 可能會超過 MCP 預設 timeout — 若遇到請改成兩步驟：先 `arrange_score`、再 `export_arrangement`

## 疑難排解

```bash
# 1. 確認 MCP 套件有裝
cd ~/樂譜改編/engine && .venv/bin/python -c "import mcp; print(mcp)"

# 2. 確認引擎本身能跑
.venv/bin/python -c "from core.mcp_server import TOOLS; print(len(TOOLS), 'tools loaded')"

# 3. 跑整合測試
.venv/bin/python -m pytest tests/test_mcp_server.py -v
```

若 Claude Desktop 連不上，看 macOS Console.app 過濾 "claude" 找錯誤訊息（通常是 Python 路徑錯）。

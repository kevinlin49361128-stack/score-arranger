#!/usr/bin/env bash
# Score Arranger — macOS 簽章 + 公證 release 流程。
#
# 前置:
#   1. keychain 有 "Developer ID Application: Lin Kaijie (U94ZKKKLV4)"
#   2. notarytool keychain profile "notary" 存在且持久 ——
#      建議存進 login keychain (而非 electron-builder 的暫存 keychain):
#        xcrun notarytool store-credentials notary \
#          --apple-id <id> --team-id U94ZKKKLV4 --password <app-specific-pw> \
#          --keychain ~/Library/Keychains/login.keychain-db
#
# 產出 (~/build/score-arranger/dist/):
#   Score Arranger-<ver>-mac.zip  ← 主散佈格式 (notarized .app, 不需 DMG 公證)
#   Score Arranger-<ver>-mac.dmg  ← 選用
set -euo pipefail
cd "$(dirname "$0")"

IDENTITY="Developer ID Application: Lin Kaijie (U94ZKKKLV4)"
DIST="$HOME/build/score-arranger/dist"

echo "[1/5] 編譯 renderer + main process..."
npm run build

echo "[2/5] 凍結 Python engine (PyInstaller)..."
bash engine/freeze.sh

echo "[3/5] electron-builder 打包 + codesign (.app / .zip / .dmg)..."
rm -rf "$DIST"
npx electron-builder --mac

APP="$DIST/mac-arm64/Score Arranger.app"
DMG="$(ls -t "$DIST"/*.dmg 2>/dev/null | head -1 || true)"

# DMG 必須在公證「之前」簽章 (公證會綁檔案 hash; 先公證再簽會讓 ticket 失效)。
if [ -n "$DMG" ]; then
  echo "[4/5] codesign DMG..."
  codesign --force --timestamp --sign "$IDENTITY" "$DMG"
fi

echo "[5/5] 公證..."
# .app 已在 .zip 內 — 公證 .app (ticket 綁 .app 的 code hash, 之後 zip 不影響)。
# 也公證 DMG (若有)。stapler 在 macOS 26 有 Error 65 bug → 不 staple,
# 已公證的 app 首開走 Gatekeeper 線上查驗 (需連網一次)。
xcrun notarytool submit "$DMG" --keychain-profile notary --wait

echo
echo "✓ 完成。散佈用:"
ls -lh "$DIST"/*.zip "$DIST"/*.dmg 2>/dev/null | awk '{print "  " $5 "  " $NF}'
echo "  注意: 未 stapler (macOS 26 bug) — 使用者首次開啟需連網一次。"

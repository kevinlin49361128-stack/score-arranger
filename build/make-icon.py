#!/usr/bin/env python3
"""把專案根目錄的 app_icon.png 處理成 macOS 規範 app 圖示 → build/icon.icns。

來源 app_icon.png 是滿版方形 (且實為 JPEG 編碼)。macOS app 圖示規範:
圓角矩形 + 四周透明留白 (Apple 圖示網格)。本腳本:
  1. 載入來源, 轉 RGBA (吃 JPEG 也沒問題)
  2. 縮到 macOS 圖示網格的 body 尺寸 (824/1024)
  3. 套圓角遮罩 + 置中於透明 1024 畫布
  4. 產生 .iconset 各尺寸 → iconutil 打包成 icns

執行: engine/.venv/bin/python build/make-icon.py
"""

from __future__ import annotations

import os
import subprocess

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
SRC = os.path.join(ROOT, "app_icon.png")

# Apple macOS 圖示網格: 1024 畫布, body 824 圓角矩形, 圓角半徑 ~185
CANVAS = 1024
BODY = 824
RADIUS = 186
MARGIN = (CANVAS - BODY) // 2


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    art = src.resize((BODY, BODY), Image.LANCZOS)

    # 圓角遮罩 → 套為 alpha
    mask = Image.new("L", (BODY, BODY), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, BODY - 1, BODY - 1], radius=RADIUS, fill=255,
    )
    art.putalpha(mask)

    # 置中貼到透明畫布
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(art, (MARGIN, MARGIN), art)
    canvas.save(os.path.join(BUILD, "icon.png"))

    # .iconset → iconutil
    iconset = os.path.join(BUILD, "icon.iconset")
    os.makedirs(iconset, exist_ok=True)
    specs = [
        (16, "16x16"), (32, "16x16@2x"),
        (32, "32x32"), (64, "32x32@2x"),
        (128, "128x128"), (256, "128x128@2x"),
        (256, "256x256"), (512, "256x256@2x"),
        (512, "512x512"), (1024, "512x512@2x"),
    ]
    for size, name in specs:
        canvas.resize((size, size), Image.LANCZOS).save(
            os.path.join(iconset, f"icon_{name}.png"),
        )

    subprocess.run(
        ["iconutil", "-c", "icns", iconset,
         "-o", os.path.join(BUILD, "icon.icns")],
        check=True,
    )
    print("✓ build/icon.icns + build/icon.png 產生完成")


if __name__ == "__main__":
    main()

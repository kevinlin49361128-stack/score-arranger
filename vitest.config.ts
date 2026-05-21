import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 與 vite.config.mts 分開 — 那份是 renderer build 設定 (root 指到
// src/renderer)。測試需要從 repo 根掃描, 故獨立一份。
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "src/renderer"),
      "@shared": resolve(root, "src/shared"),
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // 目前測純邏輯模組, 不需 DOM; 元件測試之後再加 jsdom。
    environment: "node",
  },
});

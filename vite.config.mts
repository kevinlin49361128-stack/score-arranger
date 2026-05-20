import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// .mts (ESM) — 避免 Vite「CJS build of Node API is deprecated」警告。
// ESM 沒有 __dirname, 由 import.meta.url 推導。
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    // 不設 manualChunks — 交給 Vite/Rollup 自動 code-split。
    // 只經 dynamic import() 抵達的大型庫 (verovio 7.5MB / jspdf / html2canvas)
    // 會自動切成 lazy chunk, 啟動時不載入。
    // 手動 manualChunks 反而會讓 Vite 的 __vitePreload helper 被併進某個
    // 大 vendor chunk, 害整包在啟動時 eager 載入 (verovio 曾因此被誤拉)。
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});

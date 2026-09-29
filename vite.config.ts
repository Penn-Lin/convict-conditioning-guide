import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite 构建配置。
 * - `@` 别名统一指向 `src`，与 tsconfig.json 的 paths 保持一致（见架构 §9.2）。
 * - 纯静态 SPA 产物直出 `dist/`，交由 Cloudflare Pages 托管。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

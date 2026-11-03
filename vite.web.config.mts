import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  base: './',
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react()],
  define: {
    __EZWIN_WEB__: 'true',
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      allow: [root],
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./web-dist', import.meta.url)),
    emptyOutDir: true,
    target: 'chrome100',
  },
});

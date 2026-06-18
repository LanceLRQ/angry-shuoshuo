import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@game': fileURLToPath(new URL('./src/game', import.meta.url)),
      '@infra': fileURLToPath(new URL('./src/infra', import.meta.url)),
    },
  },
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    // assets 目录中的 manifest/levels/占位说明不经过 hash，保持可替换
    assetsInlineLimit: 0,
  },
});

import { copyFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/** GitHub Pages tidak mengenal rute SPA: salin index.html menjadi 404.html agar tautan langsung (mis. /siswa/peta) tetap memuat aplikasi. */
const spaFallback = (): Plugin => ({
  name: 'spa-404-fallback',
  apply: 'build',
  closeBundle() {
    copyFileSync('dist/index.html', 'dist/404.html');
  },
});

export default defineConfig({
  // VITE_BASE diisi saat build untuk GitHub Pages, mis. "/mathquest-junior/". Bawaan "/" cocok untuk Netlify/Vercel/domain sendiri.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), spaFallback()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});

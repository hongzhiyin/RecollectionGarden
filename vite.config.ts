import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync } from 'node:fs';

export default defineConfig({
  server: { proxy: { '/rg-api': { target: 'http://127.0.0.1:4320', changeOrigin: true, ws: true,
    rewrite: path => path.replace(/^\/rg-api/, '') } } },
  preview: { proxy: { '/rg-api': { target: 'http://127.0.0.1:4320', changeOrigin: true, ws: true,
    rewrite: path => path.replace(/^\/rg-api/, '') } } },
  plugins: [react(), {
    name: 'pdf-assets',
    buildStart() {
      for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
        cpSync(`node_modules/pdfjs-dist/${name}`, `public/pdf/${name}`, { recursive: true });
      }
    },
  }],
});

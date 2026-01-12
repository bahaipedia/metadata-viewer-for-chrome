import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // The React UI
        side_panel: resolve(__dirname, 'public/side_panel.html'),
        // The Background Script
        service_worker: resolve(__dirname, 'src/background/service_worker.ts'),
        // The Content Script (Scraper & Highlighter)
        content: resolve(__dirname, 'src/content/index.ts'), 
      },
      output: {
        entryFileNames: 'src/[name]/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

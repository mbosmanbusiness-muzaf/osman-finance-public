/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // 5173 — egasining boshqa loyihasi, 5174 — to'liq OSMAN dashboard; bu ilova — 5175
  server: { port: 5175, strictPort: true, open: false },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/xlsx/')) return 'spreadsheet'
          if (id.includes('/recharts/')) return 'charts'
          if (/\/(d3-[^/]+|victory-vendor|recharts-scale)\//.test(id)) return 'chart-math'
          if (/\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})

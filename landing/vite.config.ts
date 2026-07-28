import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@micropay/site-meta': resolve(__dirname, '../packages/site-meta/src/index.ts'),
    },
  },
  server: { port: 4000 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

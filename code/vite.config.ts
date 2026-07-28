import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '#': resolve(__dirname, './src'),
      '@micropay/site-meta': resolve(
        __dirname,
        '../packages/site-meta/src/index.ts',
      ),
    },
  },
  server: { port: 5000 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    global: 'globalThis',
  },
})

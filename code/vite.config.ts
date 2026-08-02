import { resolve } from 'node:path'
import { devtools } from '@tanstack/devtools-vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@micropay/site-meta': resolve(
        __dirname,
        '../packages/site-meta/src/index.ts',
      ),
    },
  },
  optimizeDeps: {
    include: ['buffer', 'process'],
  },
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5000,
    strictPort: true,
  },
  plugins: [
    devtools(),
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    tailwindcss(),
    viteReact(),
  ],
})

import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { devtools } from '@tanstack/devtools-vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
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
  // Pera/Defly WalletConnect v1 reads `global.WebSocket` at module init.
  define: {
    global: 'globalThis',
  },
  plugins: [
    devtools(),
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    tailwindcss(),
    viteReact(),
  ],
})

export default config

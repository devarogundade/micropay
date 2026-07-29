import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const config = defineConfig(({ isSsrBuild }) => ({
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
  // Without this, the production client bundle leaves WalletConnect's default
  // export undefined → "undefined is not a constructor (evaluating 'new e(this.options)')".
  // Keep SSR untouched so Node builtins (fs/module) stay real.
  define: isSsrBuild
    ? undefined
    : {
        global: 'globalThis',
      },
  plugins: [
    // Client-only: wallet / x402 need util.deprecate, crypto, Buffer, etc.
    !isSsrBuild &&
      nodePolyfills({
        include: [
          'buffer',
          'crypto',
          'stream',
          'util',
          'events',
          'process',
          'path',
          'string_decoder',
        ],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        protocolImports: true,
      }),
    devtools(),
    // Netlify's static handler stats the Vite project root, which on Windows can
    // lock node_modules/.vite/deps and break optimizeDeps renames (EPERM).
    // Upstream: https://github.com/netlify/primitives/pull/513
    netlify({
      dev: {
        // Windows: static handler can lock .vite/deps (EPERM on optimizeDeps).
        staticFiles: { enabled: false },
        // App uses Supabase via DATABASE_URL — do not spawn local Netlify DB
        // (PGlite), which fails on this machine and confuses DB troubleshooting.
        database: { enabled: false },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}))

export default config

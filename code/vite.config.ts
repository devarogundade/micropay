import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

/**
 * Vite 8 + duplicate `vite` resolutions make TanStack skip its SSR middleware
 * (`isRunnableDevEnvironment` fails across package copies). Bridge requests via
 * the SSR environment module runner so local `vite dev` serves pages.
 */
function ssrModuleRunnerBridge() {
  return {
    name: 'ssr-module-runner-bridge',
    enforce: 'post',
    configureServer(viteDevServer) {
      return () => {
        const serverEnv = viteDevServer.environments.ssr
        if (!serverEnv) return

        viteDevServer.middlewares.use(async (req, res, next) => {
          const u = req.originalUrl || req.url || '/'
          try {
            if (
              u.startsWith('/@') ||
              u.startsWith('/node_modules') ||
              u.startsWith('/src/') ||
              u.startsWith('/.vite') ||
              u.startsWith('/assets/') ||
              u.startsWith('/@id') ||
              u.startsWith('/@fs')
            ) {
              return next()
            }

            const runner = serverEnv.runner || serverEnv._runner
            if (!runner || typeof runner.import !== 'function') {
              return next()
            }

            const url = new URL(u, `http://${req.headers.host || 'localhost:5000'}`)
            const headers = new Headers()
            for (const [k, v] of Object.entries(req.headers)) {
              if (v == null) continue
              if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
              else headers.set(k, v)
            }
            const method = req.method || 'GET'
            const hasBody = method !== 'GET' && method !== 'HEAD'
            const webReq = new Request(url, {
              method,
              headers,
              body: hasBody ? req : undefined,
              duplex: hasBody ? 'half' : undefined,
            })

            const mod = await runner.import('virtual:tanstack-start-server-entry')
            const fetchFn = mod?.default?.fetch ?? mod?.fetch
            if (typeof fetchFn !== 'function') {
              return next()
            }

            const response = await fetchFn(webReq)
            res.statusCode = response.status
            response.headers.forEach((value, key) => {
              if (key.toLowerCase() === 'transfer-encoding') return
              res.setHeader(key, value)
            })
            res.end(Buffer.from(await response.arrayBuffer()))
          } catch (err) {
            next(err)
          }
        })
      }
    },
  }
}

const config = defineConfig(({ isSsrBuild }) => ({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@micropay/site-meta': resolve(
        __dirname,
        '../packages/site-meta/src/index.ts',
      ),
      ...(isSsrBuild
        ? {}
        : {
            buffer: 'buffer/',
          }),
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  define: isSsrBuild
    ? undefined
    : {
        global: 'globalThis',
      },
  server: {
    port: 5000,
    strictPort: true,
  },
  plugins: [
    devtools(),
    netlify({
      dev: {
        staticFiles: { enabled: false },
        database: { enabled: false },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    ssrModuleRunnerBridge(),
  ],
}))

export default config

import { createFileRoute } from '@tanstack/react-router'
import { corsPreflight, withCors } from '#/lib/cors'
import { proxyToNest } from '#/lib/nest-proxy'

/** Proxied to Nest — see backend/src/modules/ide */
export const Route = createFileRoute('/api/v1/puya-ts/compile')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      POST: async ({ request }) =>
        withCors(request, await proxyToNest(request)),
    },
  },
})

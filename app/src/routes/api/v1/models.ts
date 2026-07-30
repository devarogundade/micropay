import { createFileRoute } from '@tanstack/react-router'
import { corsPreflight, withCors } from '#/lib/cors'
import { proxyToNest } from '#/lib/nest-proxy'

/** Proxied to Nest — backend/src/modules/ai */
export const Route = createFileRoute('/api/v1/models')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      GET: async ({ request }) =>
        withCors(request, await proxyToNest(request)),
    },
  },
})

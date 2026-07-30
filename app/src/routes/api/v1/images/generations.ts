import { createFileRoute } from '@tanstack/react-router'
import { proxyToNest } from '#/lib/nest-proxy'

/** Proxied to Nest — backend/src/modules/images */
export const Route = createFileRoute('/api/v1/images/generations')({
  server: {
    handlers: {
      POST: async ({ request }) => proxyToNest(request),
    },
  },
})

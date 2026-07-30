import { createFileRoute } from '@tanstack/react-router'
import { proxyToNest } from '#/lib/nest-proxy'

/** Proxied to Nest — backend/src/modules/chat */
export const Route = createFileRoute('/api/v1/chat/sessions/$sessionId')({
  server: {
    handlers: {
      GET: async ({ request }) => proxyToNest(request),
      DELETE: async ({ request }) => proxyToNest(request),
    },
  },
})

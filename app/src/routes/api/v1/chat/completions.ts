import { createFileRoute } from '@tanstack/react-router'
import { proxyToNest } from '#/lib/nest-proxy'

/** Proxied to Nest — business logic in backend/src/modules/chat */
export const Route = createFileRoute('/api/v1/chat/completions')({
  server: {
    handlers: {
      POST: async ({ request }) => proxyToNest(request),
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { proxyToNest } from '#/lib/nest-proxy'

/** Proxied to Nest — backend/src/modules/audio */
export const Route = createFileRoute('/api/v1/audio/transcriptions')({
  server: {
    handlers: {
      POST: async ({ request }) => proxyToNest(request),
    },
  },
})

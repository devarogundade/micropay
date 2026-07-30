import { createFileRoute } from '@tanstack/react-router'
import { proxyToNest } from '#/lib/nest-proxy'

/** Proxied to Nest — backend/src/modules/storage (S3) */
export const Route = createFileRoute('/api/v1/storage/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => proxyToNest(request),
    },
  },
})

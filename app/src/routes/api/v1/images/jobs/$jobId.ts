import { createFileRoute } from '@tanstack/react-router'
import { proxyToNest } from '#/lib/nest-proxy'

/** Proxied to Nest — backend/src/modules/images (+ WS job.progress) */
export const Route = createFileRoute('/api/v1/images/jobs/$jobId')({
  server: {
    handlers: {
      GET: async ({ request }) => proxyToNest(request),
    },
  },
})

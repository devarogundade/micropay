import { createFileRoute } from '@tanstack/react-router'
import { corsPreflight, withCors } from '#/lib/cors'
import { proxyToNest } from '#/lib/nest-proxy'

/** Legacy app IDE agent — proxied to Nest IDE module. Prefer code product. */
export const Route = createFileRoute('/api/v1/ide/agent')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      POST: async ({ request }) =>
        withCors(request, await proxyToNest(request)),
    },
  },
})

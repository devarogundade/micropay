/**
 * IDE API routes — business logic lives in NestJS (`backend`).
 * These handlers only proxy to preserve same-origin paths during migration.
 * Prefer setting VITE_PUBLIC_API_URL so the SPA calls Nest directly.
 */
import { createFileRoute } from '@tanstack/react-router'
import { corsPreflight, withCors } from '#/lib/cors'
import { proxyToNest } from '#/lib/nest-proxy'

export const Route = createFileRoute('/api/v1/ide/agent')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      POST: async ({ request }) =>
        withCors(request, await proxyToNest(request)),
    },
  },
})

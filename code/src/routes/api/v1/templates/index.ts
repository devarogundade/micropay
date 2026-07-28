import { createFileRoute } from '@tanstack/react-router'

import { corsPreflight, withCors } from '#/lib/cors'
import { listTemplates, type TemplateSort } from '#/lib/templates-store'

/**
 * GET /api/v1/templates — browse IDE templates (free).
 * Query: q, category, sort (popular | newest | name | clones-asc | clones-desc)
 */
export const Route = createFileRoute('/api/v1/templates/')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      GET: async ({ request }) => {
        const respond = (response: Response) => withCors(request, response)
        try {
          const url = new URL(request.url)
          const q = url.searchParams.get('q') ?? undefined
          const category = url.searchParams.get('category') ?? undefined
          const sortParam = url.searchParams.get('sort') ?? 'popular'
          const allowed: TemplateSort[] = [
            'popular',
            'newest',
            'name',
            'clones-asc',
            'clones-desc',
          ]
          const sort = allowed.includes(sortParam as TemplateSort)
            ? (sortParam as TemplateSort)
            : 'popular'

          const data = await listTemplates({ q, category, sort })
          return respond(Response.json(data))
        } catch (e) {
          console.error('list templates failed', e)
          return respond(
            Response.json(
              {
                error: {
                  message:
                    e instanceof Error ? e.message : 'Failed to list templates',
                  type: 'server_error',
                },
              },
              { status: 500 },
            ),
          )
        }
      },
    },
  },
})

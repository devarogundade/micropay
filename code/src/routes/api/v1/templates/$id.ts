import { createFileRoute } from '@tanstack/react-router'

import { corsPreflight, withCors } from '#/lib/cors'
import { getTemplateByIdOrSlug } from '#/lib/templates-store'

/**
 * GET /api/v1/templates/$id — template detail including source files (free).
 */
export const Route = createFileRoute('/api/v1/templates/$id')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      GET: async ({ request, params }) => {
        const respond = (response: Response) => withCors(request, response)
        try {
          const template = await getTemplateByIdOrSlug(params.id)
          if (!template) {
            return respond(
              Response.json(
                {
                  error: {
                    message: 'Template not found',
                    type: 'not_found',
                  },
                },
                { status: 404 },
              ),
            )
          }
          return respond(Response.json({ template }))
        } catch (e) {
          console.error('get template failed', e)
          return respond(
            Response.json(
              {
                error: {
                  message:
                    e instanceof Error ? e.message : 'Failed to load template',
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

import { createFileRoute } from '@tanstack/react-router'

import { corsPreflight, withCors } from '#/lib/cors'
import { getCatalogModels } from '#/lib/zg-catalog'
import { listRouterModels } from '#/lib/zg-router'

/**
 * OpenAI-compatible model list.
 * Proxies 0G Compute Router GET /v1/models and also returns Micropay UI fields.
 * CORS enabled for code.micropay.website IDE host.
 */
export const Route = createFileRoute('/api/v1/models')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      GET: async ({ request }) => {
        const respond = (response: Response) => withCors(request, response)
        const url = new URL(request.url)
        const raw = url.searchParams.get('raw') === '1'

        try {
          if (raw) {
            const data = await listRouterModels()
            return respond(Response.json({ object: 'list', data }))
          }

          const catalog = await getCatalogModels()
          if (catalog.error && catalog.models.length === 0) {
            return respond(
              Response.json(
                {
                  error: {
                    message: catalog.error,
                    type: 'router_error',
                  },
                },
                { status: 502 },
              ),
            )
          }
          return respond(
            Response.json({
              object: 'list',
              source: 'router',
              data: catalog.models.map((m) => ({
                id: m.routerId ?? m.slug,
                object: 'model',
                owned_by: m.provider,
                name: m.name,
                description: m.description,
                // Micropay / x402 display fields
                type: m.type,
                price_usdc: m.priceUsdc,
                tee_attested: m.teeAttested,
                provider_count: m.providerCount,
                context_length: m.contextLength,
                supports_tools: m.supportsTools,
                supports_vision: m.supportsVision,
                verifiability: m.verifiability,
                supported_formats: m.supportedFormats ?? [],
                // Chat clients always use /api/v1/chat/completions; Anthropic-only
                // models are converted server-side to /v1/messages.
                chat_endpoint:
                  m.type === 'Chat' ? '/api/v1/chat/completions' : undefined,
              })),
            }),
          )
        } catch (e) {
          const message =
            e instanceof Error ? e.message : 'Failed to list models'
          return respond(
            Response.json(
              { error: { message, type: 'router_error' } },
              { status: 502 },
            ),
          )
        }
      },
    },
  },
})

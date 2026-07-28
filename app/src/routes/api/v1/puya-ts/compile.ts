import { createFileRoute } from '@tanstack/react-router'

import { corsPreflight, withCors } from '#/lib/cors'
import { compilePuyaTsProjectWithPuya } from '#/lib/puya-ts-compile.server'

/**
 * POST /api/v1/puya-ts/compile
 * Body:
 *   { source: string }                          — single-file (legacy)
 *   { files: Record<string,string>, entry?: string } — multi-file project
 *
 * Used by the IDE product (and MCP). No separate DB — compile is stateless.
 * Optional future: also expose from a code API host; schema remains app/prisma.
 */
export const Route = createFileRoute('/api/v1/puya-ts/compile')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      POST: async ({ request }) => {
        const respond = (response: Response) => withCors(request, response)

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return respond(
            Response.json(
              { error: { message: 'Invalid JSON body', type: 'invalid_request' } },
              { status: 400 },
            ),
          )
        }

        if (!body || typeof body !== 'object') {
          return respond(
            Response.json(
              {
                error: {
                  message: 'Expected JSON object body',
                  type: 'invalid_request',
                },
              },
              { status: 400 },
            ),
          )
        }

        const rec = body as Record<string, unknown>

        if (rec.files && typeof rec.files === 'object' && !Array.isArray(rec.files)) {
          const files: Record<string, string> = {}
          let total = 0
          for (const [k, v] of Object.entries(rec.files as Record<string, unknown>)) {
            if (typeof v !== 'string') continue
            files[k] = v
            total += v.length
          }
          if (Object.keys(files).length === 0) {
            return respond(
              Response.json(
                {
                  error: {
                    message: 'files must contain at least one string source',
                    type: 'invalid_request',
                  },
                },
                { status: 400 },
              ),
            )
          }
          if (total > 500_000) {
            return respond(
              Response.json(
                {
                  error: {
                    message: 'Project sources exceed 500KB limit',
                    type: 'invalid_request',
                  },
                },
                { status: 413 },
              ),
            )
          }
          const entry = typeof rec.entry === 'string' ? rec.entry : undefined
          const result = await compilePuyaTsProjectWithPuya({ files, entry })
          return respond(
            Response.json(result, { status: result.ok ? 200 : 422 }),
          )
        }

        const source = typeof rec.source === 'string' ? rec.source : null

        if (source === null) {
          return respond(
            Response.json(
              {
                error: {
                  message:
                    'Expected { source: string } or { files: Record<string,string>, entry?: string }',
                  type: 'invalid_request',
                },
              },
              { status: 400 },
            ),
          )
        }

        if (source.length > 200_000) {
          return respond(
            Response.json(
              {
                error: {
                  message: 'Source exceeds 200KB limit',
                  type: 'invalid_request',
                },
              },
              { status: 413 },
            ),
          )
        }

        const result = await compilePuyaTsProjectWithPuya({
          files: { 'contract.algo.ts': source },
          entry: 'contract.algo.ts',
        })
        return respond(
          Response.json(result, { status: result.ok ? 200 : 422 }),
        )
      },
    },
  },
})

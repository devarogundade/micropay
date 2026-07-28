import { createFileRoute } from '@tanstack/react-router'

import {
  gatePaidRequest,
  txIdFromPaymentHeaders,
} from '#/lib/api-proxy'
import { corsPreflight, withCors } from '#/lib/cors'
import {
  TEMPLATE_CLONE_USDC,
  getTemplateByIdOrSlug,
  recordPaidTemplateClone,
} from '#/lib/templates-store'
import { extractPayerAddress } from '#/lib/users'
import {
  X402SettleError,
  X402_ROUTE_DESCRIPTIONS,
  cloneDiscoveryExtension,
  withPaymentHeaders,
} from '#/lib/x402-server'

/**
 * POST /api/v1/clone
 *
 * x402-gated at 0.05 USDC. On settle: increments CodeTemplate.clonedCount,
 * writes CodeTemplateClone, returns template files for the IDE.
 * Does not write Activity / User rows for clone tracking.
 */
export const Route = createFileRoute('/api/v1/clone')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      POST: async ({ request }) => {
        const respond = (response: Response) => withCors(request, response)

        let body: Record<string, unknown>
        try {
          body = (await request.json()) as Record<string, unknown>
        } catch {
          return respond(
            Response.json(
              {
                error: {
                  message: 'Invalid JSON body',
                  type: 'invalid_request',
                },
              },
              { status: 400 },
            ),
          )
        }

        const templateIdRaw = body.templateId ?? body.id ?? body.slug
        if (!templateIdRaw || typeof templateIdRaw !== 'string') {
          return respond(
            Response.json(
              {
                error: {
                  message: 'templateId is required',
                  type: 'invalid_request',
                },
              },
              { status: 400 },
            ),
          )
        }

        const existing = await getTemplateByIdOrSlug(templateIdRaw)
        if (!existing) {
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

        const priceUsdc = TEMPLATE_CLONE_USDC

        const gate = await gatePaidRequest({
          request,
          routeKey: 'POST /api/v1/clone',
          path: '/api/v1/clone',
          body: { templateId: existing.id },
          priceUsdc,
          description: X402_ROUTE_DESCRIPTIONS.clone,
          routeKind: 'clone',
          extensions: cloneDiscoveryExtension(),
        })
        if (!gate.ok) return respond(gate.response)

        const walletAddress = extractPayerAddress(
          request,
          gate.paymentPayload,
        )

        try {
          const payload = {
            template: {
              id: existing.id,
              slug: existing.slug,
              name: existing.name,
              description: existing.description,
              category: existing.category,
              projectName: existing.projectName,
              activePath: existing.activePath,
              files: existing.files,
              clonedCount: existing.clonedCount + 1,
              featured: existing.featured,
            },
            costUsdc: priceUsdc,
          }
          const response = Response.json(payload)

          const paymentHeaders = await gate.settle(response)
          const txId = txIdFromPaymentHeaders(paymentHeaders)

          const detail = await recordPaidTemplateClone({
            templateId: existing.id,
            walletAddress,
            txId,
            costUsdc: priceUsdc,
          })

          const settled = Response.json({
            template: {
              id: detail.id,
              slug: detail.slug,
              name: detail.name,
              description: detail.description,
              category: detail.category,
              projectName: detail.projectName,
              activePath: detail.activePath,
              files: detail.files,
              clonedCount: detail.clonedCount,
              featured: detail.featured,
            },
            costUsdc: priceUsdc,
            txId,
          })

          return respond(withPaymentHeaders(settled, paymentHeaders))
        } catch (e) {
          if (e instanceof X402SettleError) {
            return respond(
              Response.json(
                {
                  error: {
                    message: e.message,
                    type: 'settlement_failed',
                  },
                },
                { status: 402, headers: e.headers },
              ),
            )
          }
          console.error('clone template failed', e)
          return respond(
            Response.json(
              {
                error: {
                  message:
                    e instanceof Error ? e.message : 'Clone failed',
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

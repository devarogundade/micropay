import { createFileRoute } from '@tanstack/react-router'

import { recordActivity } from '#/lib/activities-store'
import {
  activityMetaFromModel,
  activityMetaFromRouterPayload,
  extractProviderHeaders,
  finalizePaidResponse,
  gatePaidRequest,
  requireRouterKey,
  routerErrorResponse,
  txIdFromPaymentHeaders,
} from '#/lib/api-proxy'
import { corsPreflight, withCors } from '#/lib/cors'
import {
  IDE_AGENT_SYSTEM_PROMPT,
  IDE_AGENT_TOOLS,
} from '#/lib/ide-knowledge'
import { recordModelUsage } from '#/lib/model-usage-store'
import { extractPayerAddress } from '#/lib/users'
import {
  X402_ROUTE_DESCRIPTIONS,
  chatDiscoveryExtension,
} from '#/lib/x402-server'
import { assertModelType, resolveModelPriceUsdc } from '#/lib/zg-catalog'
import {
  createChatCompletion,
  createChatCompletionStream,
} from '#/lib/zg-router'

/**
 * POST /api/v1/ide/agent
 *
 * Dedicated IDE agent endpoint. Injects puya-ts knowledge + IDE tools;
 * records spend as type "IDE" in code-owned CodeActivity (same DATABASE_URL
 * as app, distinct tables — not app Activity / User).
 */
export const Route = createFileRoute('/api/v1/ide/agent')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => corsPreflight(request),
      POST: async ({ request }) => {
        const respond = (response: Response) => withCors(request, response)

        const missing = requireRouterKey()
        if (missing) return respond(missing)

        let body: Record<string, unknown>
        try {
          body = (await request.json()) as Record<string, unknown>
        } catch {
          return respond(
            Response.json(
              { error: { message: 'Invalid JSON body', type: 'invalid_request' } },
              { status: 400 },
            ),
          )
        }

        if (!body.model || typeof body.model !== 'string') {
          return respond(
            Response.json(
              {
                error: {
                  message: 'model is required',
                  type: 'invalid_request',
                },
              },
              { status: 400 },
            ),
          )
        }

        if (!Array.isArray(body.messages)) {
          return respond(
            Response.json(
              {
                error: {
                  message: 'messages array is required',
                  type: 'invalid_request',
                },
              },
              { status: 400 },
            ),
          )
        }

        try {
          const modelId = body.model
          const { priceUsdc, model } = await resolveModelPriceUsdc(modelId)
          assertModelType(model, 'Chat')
          const wantStream = Boolean(body.stream)

          const messages = [...(body.messages as unknown[])]
          const hasIdeSystem = messages.some(
            (m) =>
              m &&
              typeof m === 'object' &&
              (m as { role?: string }).role === 'system' &&
              typeof (m as { content?: unknown }).content === 'string' &&
              String((m as { content: string }).content).includes(
                'Micropay IDE agent',
              ),
          )
          if (!hasIdeSystem) {
            messages.unshift({
              role: 'system',
              content: IDE_AGENT_SYSTEM_PROMPT,
            })
          }

          const tools =
            body.tools === null
              ? undefined
              : Array.isArray(body.tools)
                ? body.tools
                : IDE_AGENT_TOOLS

          const upstreamBody: Record<string, unknown> = {
            ...body,
            messages,
            ...(tools ? { tools, tool_choice: body.tool_choice ?? 'auto' } : {}),
          }
          delete upstreamBody.verify_tee

          const gate = await gatePaidRequest({
            request,
            routeKey: 'POST /api/v1/ide/agent',
            path: '/api/v1/ide/agent',
            body: upstreamBody,
            priceUsdc,
            description: X402_ROUTE_DESCRIPTIONS.ide,
            routeKind: 'ide',
            extensions: chatDiscoveryExtension(),
          })
          if (!gate.ok) return respond(gate.response)

          const providerHeaders = extractProviderHeaders(request)
          const activity = activityMetaFromModel(
            model,
            modelId,
            'IDE',
            priceUsdc,
          )
          const walletAddress = extractPayerAddress(
            request,
            gate.paymentPayload,
          )

          if (wantStream && !tools) {
            const upstream = await createChatCompletionStream({
              body: upstreamBody,
              verifyTee: Boolean(body.verify_tee),
              providerHeaders,
            })

            const paymentHeaders = await gate.settle()
            await recordActivity({
              ...activity,
              status: 'settled',
              txId: txIdFromPaymentHeaders(paymentHeaders),
              walletAddress,
            })
            try {
              await recordModelUsage({
                walletAddress,
                modelSlug: activity.modelSlug,
                modelName: activity.modelName,
              })
            } catch (usageErr) {
              console.error('model usage persist failed', usageErr)
            }

            const headers = new Headers(upstream.headers)
            headers.delete('content-encoding')
            headers.delete('content-length')
            for (const [k, v] of Object.entries(paymentHeaders)) {
              headers.set(k, v)
            }
            headers.set(
              'Content-Type',
              upstream.headers.get('Content-Type') || 'text/event-stream',
            )

            return respond(
              new Response(upstream.body, {
                status: upstream.status,
                headers,
              }),
            )
          }

          const { data } = await createChatCompletion({
            body: { ...upstreamBody, stream: false },
            verifyTee: Boolean(body.verify_tee),
            providerHeaders,
          })
          const fromRouter = activityMetaFromRouterPayload(data)
          const response = Response.json(data)
          return respond(
            await finalizePaidResponse({
              gate,
              response,
              request,
              activity: { ...activity, ...fromRouter },
            }),
          )
        } catch (e) {
          return respond(routerErrorResponse(e))
        }
      },
    },
  },
})

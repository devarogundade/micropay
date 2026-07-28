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
 * OpenAI-compatible chat completions proxy → provider Router.
 * Anthropic-only models are auto-routed via /v1/messages with format conversion.
 * x402 paywall → settle → sk- stays on the server.
 */
export const Route = createFileRoute('/api/v1/chat/completions')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const missing = requireRouterKey()
        if (missing) return missing

        let body: Record<string, unknown>
        try {
          body = (await request.json()) as Record<string, unknown>
        } catch {
          return Response.json(
            { error: { message: 'Invalid JSON body', type: 'invalid_request' } },
            { status: 400 },
          )
        }

        if (!body.model || typeof body.model !== 'string') {
          return Response.json(
            {
              error: {
                message: 'model is required',
                type: 'invalid_request',
              },
            },
            { status: 400 },
          )
        }

        try {
          const modelId = body.model
          const { priceUsdc, model } = await resolveModelPriceUsdc(modelId)
          assertModelType(model, 'Chat')
          const wantStream = Boolean(body.stream)

          const verifyTee = Boolean(body.verify_tee)
          delete body.verify_tee

          const gate = await gatePaidRequest({
            request,
            routeKey: 'POST /api/v1/chat/completions',
            path: '/api/v1/chat/completions',
            body,
            priceUsdc,
            description: X402_ROUTE_DESCRIPTIONS.chat,
            routeKind: 'chat',
            extensions: chatDiscoveryExtension(),
          })
          if (!gate.ok) return gate.response

          const providerHeaders = extractProviderHeaders(request)
          const activity = activityMetaFromModel(
            model,
            modelId,
            'Chat',
            priceUsdc,
          )
          const walletAddress = extractPayerAddress(
            request,
            gate.paymentPayload,
          )

          if (wantStream) {
            const upstream = await createChatCompletionStream({
              body,
              verifyTee,
              providerHeaders,
            })

            // Settle before streaming body to the client (payment confirmed first).
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

            return new Response(upstream.body, {
              status: upstream.status,
              headers,
            })
          }

          const { data } = await createChatCompletion({
            body: { ...body, stream: false },
            verifyTee,
            providerHeaders,
          })
          const fromRouter = activityMetaFromRouterPayload(data)
          const response = Response.json(data)
          return finalizePaidResponse({
            gate,
            response,
            request,
            activity: { ...activity, ...fromRouter },
          })
        } catch (e) {
          return routerErrorResponse(e)
        }
      },
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'

import {
  activityMetaFromModel,
  activityMetaFromRouterPayload,
  extractProviderHeaders,
  finalizePaidResponse,
  gatePaidRequest,
  requireRouterKey,
  routerErrorResponse,
} from '#/lib/api-proxy'
import { createImageJob } from '#/lib/image-jobs-store'
import {
  extractPersistedImageRefs,
  recordImageGenerations,
} from '#/lib/media-history-store'
import {
  persistGeneratedImages,
  storageErrorResponse,
} from '#/lib/persist-generated-images'
import { extractPayerAddress } from '#/lib/users'
import {
  X402_ROUTE_DESCRIPTIONS,
  imagesDiscoveryExtension,
} from '#/lib/x402-server'
import { assertModelType, resolveModelPriceUsdc } from '#/lib/zg-catalog'
import { generateImageSynced, submitImageGeneration } from '#/lib/zg-router'

/**
 * Image generation proxy → provider Router async images API.
 * Always forces response_format: b64_json, then persists to Supabase Storage.
 *
 * Query: ?async=1 returns jobId immediately after payment settle.
 * Studio clients then subscribe via SSE: GET /api/v1/images/jobs/$id?stream=1
 * Default: server waits and returns the completed image payload with public URLs.
 */
export const Route = createFileRoute('/api/v1/images/generations')({
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
              error: { message: 'model is required', type: 'invalid_request' },
            },
            { status: 400 },
          )
        }
        if (!body.prompt || typeof body.prompt !== 'string') {
          return Response.json(
            {
              error: { message: 'prompt is required', type: 'invalid_request' },
            },
            { status: 400 },
          )
        }

        body.response_format = 'b64_json'

        try {
          const modelId = body.model
          const { priceUsdc, model } = await resolveModelPriceUsdc(modelId)
          assertModelType(model, 'Image Gen')
          const url = new URL(request.url)
          const asyncOnly = url.searchParams.get('async') === '1'

          const gate = await gatePaidRequest({
            request,
            routeKey: 'POST /api/v1/images/generations',
            path: '/api/v1/images/generations',
            body,
            priceUsdc,
            description: X402_ROUTE_DESCRIPTIONS.images,
            routeKind: 'images',
            extensions: imagesDiscoveryExtension(),
          })
          if (!gate.ok) return gate.response

          const providerHeaders = extractProviderHeaders(request)
          const verifyTee = Boolean(body.verify_tee)
          delete body.verify_tee

          const activity = activityMetaFromModel(
            model,
            modelId,
            'Image Gen',
            priceUsdc,
          )

          if (asyncOnly) {
            const { status, data } = await submitImageGeneration({
              body,
              providerHeaders,
              verifyTee,
            })
            const jobId = data.jobId || data.job_id
            const wallet = extractPayerAddress(request, gate.paymentPayload)
            if (jobId) {
              try {
                await createImageJob({
                  jobId,
                  walletAddress: wallet,
                  modelSlug: model?.slug ?? modelId,
                  modelName: model?.name ?? null,
                  prompt: body.prompt,
                  size: typeof body.size === 'string' ? body.size : null,
                  providerAddress: data.provider_address ?? null,
                  status: data.status || 'queued',
                })
              } catch (jobErr) {
                console.error('image job meta persist failed', jobErr)
              }
            }
            const fromRouter = activityMetaFromRouterPayload(data)
            const response = Response.json(data, { status })
            return finalizePaidResponse({
              gate,
              response,
              request,
              activity: { ...activity, ...fromRouter },
            })
          }

          const { data } = await generateImageSynced({
            body,
            providerHeaders,
            verifyTee,
          })
          const persisted = await persistGeneratedImages(data)
          const fromRouter = activityMetaFromRouterPayload(persisted)
          const response = Response.json(persisted)
          const finalResponse = await finalizePaidResponse({
            gate,
            response,
            request,
            activity: { ...activity, ...fromRouter },
          })

          // Persist gallery history after successful settle + Supabase upload.
          if (finalResponse.ok) {
            const wallet = extractPayerAddress(request, gate.paymentPayload)
            const images = extractPersistedImageRefs(persisted)
            if (wallet && images.length) {
              try {
                const history = await recordImageGenerations({
                  walletAddress: wallet,
                  modelSlug: model?.slug ?? modelId,
                  modelName: model?.name ?? null,
                  prompt: body.prompt,
                  size: typeof body.size === 'string' ? body.size : null,
                  images,
                })
                // Attach history ids without breaking OpenAI-shaped clients.
                const cloned = finalResponse.clone()
                const json = (await cloned.json()) as Record<string, unknown>
                return Response.json(
                  { ...json, micropay_history: history },
                  {
                    status: finalResponse.status,
                    headers: finalResponse.headers,
                  },
                )
              } catch (histErr) {
                console.error('image history persist failed', histErr)
              }
            }
          }

          return finalResponse
        } catch (e) {
          return storageErrorResponse(e) ?? routerErrorResponse(e)
        }
      },
    },
  },
})

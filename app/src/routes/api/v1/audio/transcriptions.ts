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
import { recordTranscription } from '#/lib/media-history-store'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '#/lib/storage-limits'
import { extractPayerAddress } from '#/lib/users'
import {
  X402_ROUTE_DESCRIPTIONS,
  audioDiscoveryExtension,
} from '#/lib/x402-server'
import { assertModelType, resolveModelPriceUsdc } from '#/lib/zg-catalog'
import { createAudioTranscription } from '#/lib/zg-router'

/**
 * Speech-to-text proxy → provider Router /v1/audio/transcriptions (multipart).
 */
export const Route = createFileRoute('/api/v1/audio/transcriptions')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const missing = requireRouterKey()
        if (missing) return missing

        let formData: FormData
        try {
          formData = await request.formData()
        } catch {
          return Response.json(
            {
              error: {
                message: 'Expected multipart/form-data',
                type: 'invalid_request',
              },
            },
            { status: 400 },
          )
        }

        const modelField = formData.get('model')
        if (typeof modelField !== 'string' || !modelField.trim()) {
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
        const modelId = modelField.trim()

        const audioField = formData.get('file') || formData.get('audio')
        if (!audioField) {
          return Response.json(
            {
              error: {
                message: 'file (audio) is required',
                type: 'invalid_request',
              },
            },
            { status: 400 },
          )
        }

        if (
          typeof audioField === 'object' &&
          audioField !== null &&
          'size' in audioField &&
          typeof (audioField as { size: unknown }).size === 'number' &&
          (audioField as { size: number }).size > MAX_UPLOAD_BYTES
        ) {
          return Response.json(
            {
              error: {
                message: `Audio file exceeds ${MAX_UPLOAD_LABEL} limit`,
                type: 'invalid_request',
                maxBytes: MAX_UPLOAD_BYTES,
              },
            },
            { status: 413 },
          )
        }

        const fileMeta =
          typeof audioField === 'object' &&
          audioField !== null &&
          'name' in audioField
            ? {
                filename:
                  typeof (audioField as File).name === 'string'
                    ? (audioField as File).name
                    : null,
                mimeType:
                  typeof (audioField as File).type === 'string'
                    ? (audioField as File).type || null
                    : null,
                fileSize:
                  typeof (audioField as File).size === 'number'
                    ? (audioField as File).size
                    : null,
              }
            : { filename: null, mimeType: null, fileSize: null }

        const languageField = formData.get('language')
        const language =
          typeof languageField === 'string' && languageField.trim()
            ? languageField.trim()
            : null

        try {
          const { priceUsdc, model } = await resolveModelPriceUsdc(modelId)
          assertModelType(model, 'Audio')

          const gate = await gatePaidRequest({
            request,
            routeKey: 'POST /api/v1/audio/transcriptions',
            path: '/api/v1/audio/transcriptions',
            body: { model: modelId },
            priceUsdc,
            description: X402_ROUTE_DESCRIPTIONS.audio,
            routeKind: 'audio',
            extensions: audioDiscoveryExtension(),
          })
          if (!gate.ok) return gate.response

          const verifyTee =
            request.headers.get('x-0g-verify-tee') === 'true' ||
            formData.get('verify_tee') === 'true'

          const activity = activityMetaFromModel(
            model,
            modelId,
            'Audio',
            priceUsdc,
          )

          const { data } = await createAudioTranscription({
            formData,
            providerHeaders: extractProviderHeaders(request),
            verifyTee,
          })
          const fromRouter = activityMetaFromRouterPayload(data)
          const response = Response.json(data)
          const finalResponse = await finalizePaidResponse({
            gate,
            response,
            request,
            activity: { ...activity, ...fromRouter },
          })

          if (finalResponse.ok) {
            const wallet = extractPayerAddress(request, gate.paymentPayload)
            const text =
              data &&
              typeof data === 'object' &&
              typeof (data as { text?: unknown }).text === 'string'
                ? (data as { text: string }).text
                : ''
            if (wallet && text.trim()) {
              try {
                const history = await recordTranscription({
                  walletAddress: wallet,
                  modelSlug: model?.slug ?? modelId,
                  modelName: model?.name ?? null,
                  filename: fileMeta.filename,
                  mimeType: fileMeta.mimeType,
                  fileSize: fileMeta.fileSize,
                  language,
                  text,
                })
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
                console.error('transcription history persist failed', histErr)
              }
            }
          }

          return finalResponse
        } catch (e) {
          return routerErrorResponse(e)
        }
      },
    },
  },
})

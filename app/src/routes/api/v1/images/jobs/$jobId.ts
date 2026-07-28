import { createFileRoute } from '@tanstack/react-router'

import {
  extractProviderHeaders,
  requireRouterKey,
  routerErrorResponse,
} from '#/lib/api-proxy'
import {
  getImageJob,
  updateImageJobStatus,
} from '#/lib/image-jobs-store'
import {
  extractPersistedImageRefs,
  recordImageGenerations,
} from '#/lib/media-history-store'
import {
  persistGeneratedImages,
  storageErrorResponse,
} from '#/lib/persist-generated-images'
import { pollImageJob } from '#/lib/zg-router'

const TERMINAL_OK = new Set(['completed', 'succeeded', 'success'])
const TERMINAL_FAIL = new Set(['failed', 'error'])

function jobStatusLabel(status: string): string {
  const st = status.toLowerCase()
  if (TERMINAL_OK.has(st)) return 'Image ready'
  if (TERMINAL_FAIL.has(st)) return 'Generation failed'
  if (st === 'queued' || st === 'pending') return 'Waiting in line…'
  if (st === 'running' || st === 'processing' || st === 'in_progress') {
    return 'Generating image…'
  }
  return status ? `Status: ${status}` : 'Working…'
}

async function resolveCompletedPayload(input: {
  jobId: string
  data: Awaited<ReturnType<typeof pollImageJob>>['data']
}) {
  const payload = input.data.data ?? input.data.result ?? input.data
  const persisted = await persistGeneratedImages(payload)
  const responseBody =
    persisted &&
    typeof persisted === 'object' &&
    Array.isArray((persisted as { data?: unknown }).data)
      ? {
          ...input.data,
          data: (persisted as { data: unknown }).data,
          result: undefined,
          status: 'completed',
        }
      : { ...input.data, data: persisted, status: 'completed' }

  const meta = await getImageJob(input.jobId)
  if (meta?.walletAddress) {
    const images = extractPersistedImageRefs(responseBody)
    if (images.length) {
      try {
        const history = await recordImageGenerations({
          walletAddress: meta.walletAddress,
          modelSlug: meta.modelSlug,
          modelName: meta.modelName,
          prompt: meta.prompt,
          size: meta.size,
          images,
        })
        await updateImageJobStatus({
          jobId: input.jobId,
          status: 'completed',
          providerAddress: input.data.provider_address ?? meta.providerAddress,
        })
        return { ...responseBody, micropay_history: history }
      } catch (histErr) {
        console.error('image history persist failed', histErr)
      }
    }
  }

  await updateImageJobStatus({
    jobId: input.jobId,
    status: 'completed',
    providerAddress: input.data.provider_address ?? undefined,
  })
  return responseBody
}

function sseResponse(
  jobId: string,
  request: Request,
  params: { model?: string; providerAddress?: string },
): Response {
  const providerHeaders = extractProviderHeaders(request)
  const encoder = new TextEncoder()
  const started = Date.now()
  const maxWaitMs = 120_000

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }

      send('status', {
        jobId,
        status: 'queued',
        label: jobStatusLabel('queued'),
      })

      try {
        while (Date.now() - started < maxWaitMs) {
          if (request.signal.aborted) break

          const { data, retryAfter } = await pollImageJob({
            jobId,
            model: params.model,
            providerAddress: params.providerAddress,
            providerHeaders,
          })
          const st = (data.status || '').toLowerCase()

          await updateImageJobStatus({
            jobId,
            status: st || 'processing',
            errorMessage:
              data.errorMessage || data.error?.message || undefined,
            providerAddress: data.provider_address ?? undefined,
          })

          if (TERMINAL_OK.has(st)) {
            const completed = await resolveCompletedPayload({ jobId, data })
            send('completed', {
              ...completed,
              jobId,
              status: 'completed',
              label: jobStatusLabel('completed'),
            })
            controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'))
            break
          }

          if (TERMINAL_FAIL.has(st)) {
            const message =
              data.errorMessage ||
              data.error?.message ||
              'Image generation failed'
            send('failed', {
              jobId,
              status: 'failed',
              label: jobStatusLabel('failed'),
              error: { message },
            })
            controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'))
            break
          }

          send('status', {
            jobId,
            status: st || 'processing',
            label: jobStatusLabel(st || 'processing'),
            retryAfter: retryAfter ?? data.retryAfter ?? 3,
          })

          const waitSec =
            retryAfter && retryAfter > 0
              ? retryAfter
              : data.retryAfter && data.retryAfter > 0
                ? data.retryAfter
                : 3
          await new Promise((r) => setTimeout(r, waitSec * 1000))
        }

        if (Date.now() - started >= maxWaitMs) {
          send('failed', {
            jobId,
            status: 'failed',
            label: 'Timed out',
            error: { message: 'Image generation timed out' },
          })
          controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'))
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Job stream failed'
        send('failed', {
          jobId,
          status: 'failed',
          label: jobStatusLabel('failed'),
          error: { message },
        })
        controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

/**
 * Async image job status.
 * - Default: one-shot JSON poll (API clients).
 * - ?stream=1 or Accept: text/event-stream → SSE progress until done/failed.
 * On completion, persists b64 images to Supabase and returns public URLs.
 * No additional x402 — paid at submit.
 */
export const Route = createFileRoute('/api/v1/images/jobs/$jobId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const missing = requireRouterKey()
        if (missing) return missing

        const url = new URL(request.url)
        const model = url.searchParams.get('model') ?? undefined
        const providerAddress =
          url.searchParams.get('provider_address') ?? undefined
        const wantStream =
          url.searchParams.get('stream') === '1' ||
          (request.headers.get('Accept') || '').includes('text/event-stream')

        if (wantStream) {
          return sseResponse(params.jobId, request, { model, providerAddress })
        }

        try {
          const { data, retryAfter } = await pollImageJob({
            jobId: params.jobId,
            model,
            providerAddress,
            providerHeaders: extractProviderHeaders(request),
          })
          const headers: Record<string, string> = {}
          if (retryAfter) headers['Retry-After'] = String(retryAfter)

          const st = (data.status || '').toLowerCase()
          if (!TERMINAL_OK.has(st)) {
            if (TERMINAL_FAIL.has(st)) {
              await updateImageJobStatus({
                jobId: params.jobId,
                status: st,
                errorMessage:
                  data.errorMessage || data.error?.message || undefined,
              })
            }
            return Response.json(data, { headers })
          }

          const completed = await resolveCompletedPayload({
            jobId: params.jobId,
            data,
          })
          return Response.json(completed, { headers })
        } catch (e) {
          return storageErrorResponse(e) ?? routerErrorResponse(e)
        }
      },
    },
  },
})

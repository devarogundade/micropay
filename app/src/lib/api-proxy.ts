/**
 * Shared helpers for Micropay → Router API routes (x402 + activity logging).
 */

import { decodePaymentResponseHeader } from '@x402/core/http'

import { recordActivity } from '#/lib/activities-store'
import type { Model } from '#/data/models'
import { recordModelUsage } from '#/lib/model-usage-store'
import { extractPayerAddress } from '#/lib/users'
import {
  X402SettleError,
  enforceX402,
  withPaymentHeaders,
  type X402GateOk,
} from '#/lib/x402-server'
import { CatalogModelError } from '#/lib/zg-catalog'
import {
  RouterApiError,
  RouterConfigError,
  getRouterApiKey,
} from '#/lib/zg-router'

export function routerMissingResponse(): Response {
  return Response.json(
    {
      error: {
        message:
          'Server missing ZG_ROUTER_API_KEY. Set a provider inference key in .env.local (server-side only).',
        type: 'config_error',
      },
    },
    { status: 503 },
  )
}

export function extractProviderHeaders(
  request: Request,
): Record<string, string> {
  const providerHeaders: Record<string, string> = {}
  for (const [key, value] of request.headers) {
    if (key.toLowerCase().startsWith('x-0g-provider-') && value) {
      providerHeaders[key] = value
    }
  }
  return providerHeaders
}

export function txIdFromPaymentHeaders(
  headers: Record<string, string>,
): string {
  const raw =
    headers['PAYMENT-RESPONSE'] ||
    headers['payment-response'] ||
    headers['Payment-Response']
  if (!raw) return '—'
  try {
    const decoded = decodePaymentResponseHeader(raw) as {
      transaction?: string
      txId?: string
    }
    return decoded.transaction || decoded.txId || '—'
  } catch {
    return raw.slice(0, 16) + '…'
  }
}

export async function gatePaidRequest(input: {
  request: Request
  routeKey: string
  path: string
  body: unknown
  priceUsdc: number
  description: string
  /** Bazaar serviceName / tags key (chat | images | audio). */
  routeKind?: 'chat' | 'images' | 'audio' | 'ide'
  /** Per-route Bazaar discovery metadata for facilitator cataloging. */
  extensions?: Record<string, unknown>
}): Promise<X402GateOk | { ok: false; response: Response }> {
  return enforceX402(input)
}

export async function finalizePaidResponse(input: {
  gate: X402GateOk
  response: Response
  request: Request
  activity: {
    modelSlug: string
    modelName: string
    type: string
    costUsdc: number
    requestId?: string | null
    provider?: string | null
    tokensIn?: number | null
    tokensOut?: number | null
  }
}): Promise<Response> {
  const walletAddress = extractPayerAddress(
    input.request,
    input.gate.paymentPayload,
  )

  try {
    const paymentHeaders = await input.gate.settle(input.response)
    const txId = txIdFromPaymentHeaders(paymentHeaders)
    await recordActivity({
      ...input.activity,
      status: 'settled',
      txId,
      walletAddress,
    })
    try {
      await recordModelUsage({
        walletAddress,
        modelSlug: input.activity.modelSlug,
        modelName: input.activity.modelName,
      })
    } catch (usageErr) {
      console.error('model usage persist failed', usageErr)
    }
    return withPaymentHeaders(input.response, paymentHeaders)
  } catch (e) {
    if (e instanceof X402SettleError) {
      await recordActivity({
        ...input.activity,
        status: 'failed',
        txId: '—',
        walletAddress,
      })
      return Response.json(
        {
          error: {
            message: e.message,
            type: 'settlement_failed',
          },
        },
        { status: 402, headers: e.headers },
      )
    }
    throw e
  }
}

export function routerErrorResponse(e: unknown): Response {
  if (e instanceof CatalogModelError) {
    return Response.json(
      {
        error: {
          message: e.message,
          type: e.status === 503 ? 'config_error' : 'invalid_request',
        },
      },
      { status: e.status },
    )
  }
  if (e instanceof RouterConfigError) {
    return Response.json(
      { error: { message: e.message, type: 'config_error' } },
      { status: 503 },
    )
  }
  if (e instanceof RouterApiError) {
    return Response.json(
      typeof e.body === 'object' && e.body
        ? e.body
        : { error: { message: e.message, type: 'router_error' } },
      { status: e.status || 502 },
    )
  }
  const message = e instanceof Error ? e.message : 'Upstream failure'
  return Response.json(
    { error: { message, type: 'router_error' } },
    { status: 502 },
  )
}

/** Extract provider + token usage from Router completion / trace payloads. */
export function activityMetaFromRouterPayload(payload: unknown): {
  provider?: string | null
  tokensIn?: number | null
  tokensOut?: number | null
  requestId?: string | null
} {
  if (!payload || typeof payload !== 'object') return {}
  const obj = payload as Record<string, unknown>
  const usage = obj.usage as
    | {
        prompt_tokens?: number
        completion_tokens?: number
      }
    | undefined
  const trace = (obj.x_0g_trace || obj.trace) as
    | Record<string, unknown>
    | undefined

  const providerRaw =
    (trace?.provider as string | undefined) ||
    (trace?.provider_address as string | undefined) ||
    (trace?.providerAddress as string | undefined) ||
    (typeof obj.provider === 'string' ? obj.provider : undefined) ||
    (typeof obj.provider_address === 'string' ? obj.provider_address : undefined)

  const tokensIn =
    usage?.prompt_tokens ??
    (typeof trace?.prompt_tokens === 'number' ? trace.prompt_tokens : null)
  const tokensOut =
    usage?.completion_tokens ??
    (typeof trace?.completion_tokens === 'number'
      ? trace.completion_tokens
      : null)

  const requestId =
    (typeof obj.id === 'string' ? obj.id : null) ||
    (typeof trace?.request_id === 'string' ? trace.request_id : null) ||
    (typeof trace?.requestId === 'string' ? trace.requestId : null)

  return {
    provider: providerRaw ? String(providerRaw) : null,
    tokensIn: typeof tokensIn === 'number' ? tokensIn : null,
    tokensOut: typeof tokensOut === 'number' ? tokensOut : null,
    requestId,
  }
}

export function requireRouterKey(): Response | null {
  return getRouterApiKey() ? null : routerMissingResponse()
}

export function activityMetaFromModel(
  model: Model | undefined,
  modelId: string,
  type: string,
  priceUsdc: number,
) {
  return {
    modelSlug: model?.slug ?? modelId,
    modelName: model?.name ?? modelId,
    type,
    costUsdc: priceUsdc,
  }
}

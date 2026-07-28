/**
 * Framework-agnostic x402 paywall for TanStack Start API routes.
 * Uses GoPlausible facilitator verify → settle (exact USDC on Algorand).
 *
 * App product: own payTo + network + USDC ASA + Bazaar discovery on app host.
 * IDE agent settlements belong on the code product stack (not this paywall long-term).
 */

import { ExactAvmScheme } from '@x402/avm/exact/server'
import { encodePaymentResponseHeader } from '@x402/core/http'
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type HTTPAdapter,
  type HTTPProcessResult,
  type HTTPRequestContext,
  type RoutesConfig,
} from '@x402/core/server'
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
} from '@x402/core/types'
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from '@x402/extensions/bazaar'

import {
  getX402Caip2,
  getX402FacilitatorUrl,
  getX402PayTo,
  getX402PaymentExtra,
  getX402UsdcAsa,
  toX402Price,
  x402Configured,
} from '#/lib/x402-config'
import {
  X402_ROUTE_META,
  getMerchantIconUrl,
} from '#/lib/site-meta'

/** Concrete Bazaar catalog descriptions (what the caller receives). */
export const X402_ROUTE_DESCRIPTIONS = {
  chat: 'OpenAI-compatible chat completions with optional SSE streaming across Micropay\'s catalog of popular LLMs',
  images:
    'OpenAI-compatible image generation returning base64 PNG (b64_json) for Micropay image models',
  audio:
    'OpenAI-compatible speech-to-text transcription (multipart audio upload) returning plain text for Micropay audio models',
  ide: 'Micropay IDE assistant with project file tools, compile, and Algorand TypeScript knowledge',
} as const

export type X402RouteKind = keyof typeof X402_ROUTE_META

export function chatDiscoveryExtension() {
  return declareDiscoveryExtension({
    bodyType: 'json',
    input: {
      model: 'gpt-oss-120b',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
    },
    inputSchema: {
      properties: {
        model: { type: 'string', description: 'Micropay model id' },
        messages: {
          type: 'array',
          description: 'OpenAI-style chat messages',
        },
        stream: {
          type: 'boolean',
          description: 'When true, response is text/event-stream',
        },
      },
      required: ['model', 'messages'],
    },
    output: {
      example: {
        id: 'chatcmpl_example',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
      },
    },
  })
}

export function imagesDiscoveryExtension() {
  return declareDiscoveryExtension({
    bodyType: 'json',
    input: {
      model: 'gpt-image-1',
      prompt: 'A calm lake at dawn',
      response_format: 'b64_json',
    },
    inputSchema: {
      properties: {
        model: { type: 'string', description: 'Micropay image model id' },
        prompt: { type: 'string', description: 'Image generation prompt' },
        response_format: {
          type: 'string',
          enum: ['b64_json'],
          description: 'Micropay always returns base64 JSON',
        },
      },
      required: ['model', 'prompt'],
    },
    output: {
      example: {
        created: 1_700_000_000,
        data: [{ b64_json: '<base64-png>' }],
      },
    },
  })
}

export function audioDiscoveryExtension() {
  return declareDiscoveryExtension({
    bodyType: 'form-data',
    input: {
      model: 'whisper-large-v3',
      file: '(binary audio)',
    },
    inputSchema: {
      properties: {
        model: { type: 'string', description: 'Micropay audio model id' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Audio file to transcribe',
        },
      },
      required: ['file'],
    },
    output: {
      example: {
        text: 'Transcribed speech appears here.',
      },
    },
  })
}

function makeAdapter(
  request: Request,
  path: string,
  body: unknown,
): HTTPAdapter {
  const url = new URL(request.url)
  return {
    getHeader(name: string) {
      return request.headers.get(name) ?? undefined
    },
    getMethod() {
      return request.method
    },
    getPath() {
      return path
    },
    getUrl() {
      return request.url
    },
    getAcceptHeader() {
      return request.headers.get('accept') ?? '*/*'
    },
    getUserAgent() {
      return request.headers.get('user-agent') ?? ''
    },
    getQueryParams() {
      const out: Record<string, string> = {}
      url.searchParams.forEach((v, k) => {
        out[k] = v
      })
      return out
    },
    getQueryParam(name: string) {
      return url.searchParams.get(name) ?? undefined
    },
    getBody() {
      return body
    },
  }
}

async function getHttpServer(
  routes: RoutesConfig,
): Promise<x402HTTPResourceServer> {
  const facilitator = new HTTPFacilitatorClient({
    url: getX402FacilitatorUrl(),
  })
  const resourceServer = new x402ResourceServer(facilitator)
  resourceServer.register('algorand:*' as Network, new ExactAvmScheme())
  // Enable Bazaar discovery once for the whole resource server (composite entry).
  resourceServer.registerExtension(bazaarResourceServerExtension)

  const httpServer = new x402HTTPResourceServer(resourceServer, routes)
  await httpServer.initialize()
  return httpServer
}

function paymentHeaderFromRequest(request: Request): string | undefined {
  return (
    request.headers.get('PAYMENT-SIGNATURE') ||
    request.headers.get('payment-signature') ||
    request.headers.get('X-PAYMENT') ||
    request.headers.get('x-payment') ||
    undefined
  )
}

export type X402GateOk = {
  ok: true
  paymentPayload: PaymentPayload
  paymentRequirements: PaymentRequirements
  declaredExtensions?: Record<string, unknown>
  settle: (response?: Response) => Promise<Record<string, string>>
}

export type X402GateResult =
  | X402GateOk
  | { ok: false; response: Response }

/**
 * Enforce x402 on a protected API call.
 * Call after parsing the body so dynamic pricing can use it.
 */
export async function enforceX402(input: {
  request: Request
  /** Route key matching RoutesConfig, e.g. "POST /api/v1/chat/completions" */
  routeKey: string
  path: string
  body: unknown
  priceUsdc: number
  description: string
  /** Bazaar service metadata key (chat | images | audio). */
  routeKind?: X402RouteKind
  /** Per-route Bazaar discovery metadata (`declareDiscoveryExtension` result). */
  extensions?: Record<string, unknown>
}): Promise<X402GateResult> {
  if (!x402Configured()) {
    return {
      ok: false,
      response: Response.json(
        {
          error: {
            message:
              'Server missing X402_PAY_TO. Set a Mainnet/Testnet Algorand address to receive USDC micropayments.',
            type: 'config_error',
          },
        },
        { status: 503 },
      ),
    }
  }

  const payTo = getX402PayTo()!
  const network = getX402Caip2() as Network
  const asset = getX402UsdcAsa()
  let price: string
  try {
    price = toX402Price(input.priceUsdc)
  } catch (e) {
    return {
      ok: false,
      response: Response.json(
        {
          error: {
            message:
              e instanceof Error ? e.message : 'Invalid payment price',
            type: 'config_error',
          },
        },
        { status: 500 },
      ),
    }
  }
  const extra = getX402PaymentExtra(asset)
  const routeMeta = input.routeKind ? X402_ROUTE_META[input.routeKind] : undefined
  const iconUrl = getMerchantIconUrl(input.request)

  const routes = {
    [input.routeKey]: {
      accepts: {
        scheme: 'exact',
        network,
        payTo,
        price,
        extra,
      },
      description: input.description,
      mimeType: 'application/json',
      ...(routeMeta
        ? {
            serviceName: routeMeta.serviceName,
            tags: [...routeMeta.tags],
          }
        : {}),
      ...(iconUrl ? { iconUrl } : {}),
      extensions: input.extensions,
      unpaidResponseBody: () => ({
        contentType: 'application/json',
        body: {
          error: {
            message: 'Payment required',
            type: 'payment_required',
          },
          x402: {
            price,
            network,
            asset,
            payTo,
            facilitator: getX402FacilitatorUrl(),
            tag: extra.tag,
            feePayer: extra.feePayer,
            ...(routeMeta
              ? {
                  serviceName: routeMeta.serviceName,
                  tags: routeMeta.tags,
                }
              : {}),
            ...(iconUrl ? { iconUrl } : {}),
          },
        },
      }),
    },
  } as RoutesConfig

  const httpServer = await getHttpServer(routes)

  const adapter = makeAdapter(input.request, input.path, input.body)
  const context: HTTPRequestContext = {
    adapter,
    path: input.path,
    method: input.request.method,
    paymentHeader: paymentHeaderFromRequest(input.request),
  }

  let result: HTTPProcessResult
  try {
    result = await httpServer.processHTTPRequest(context)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'x402 processing failed'
    return {
      ok: false,
      response: Response.json(
        { error: { message, type: 'x402_error' } },
        { status: 502 },
      ),
    }
  }

  if (result.type === 'payment-error') {
    const { status, headers, body } = result.response
    return {
      ok: false,
      response: new Response(
        typeof body === 'string' ? body : JSON.stringify(body ?? {}),
        {
          status,
          headers: {
            'Content-Type':
              result.response.isHtml
                ? 'text/html; charset=utf-8'
                : 'application/json',
            ...headers,
          },
        },
      ),
    }
  }

  if (result.type === 'no-payment-required') {
    return {
      ok: false,
      response: Response.json(
        {
          error: {
            message: 'x402 route misconfigured (no payment required)',
            type: 'config_error',
          },
        },
        { status: 500 },
      ),
    }
  }

  const { paymentPayload, paymentRequirements, declaredExtensions } = result

  return {
    ok: true,
    paymentPayload,
    paymentRequirements,
    declaredExtensions,
    settle: async (response?: Response) => {
      const settleResult = await httpServer.processSettlement(
        paymentPayload,
        paymentRequirements,
        declaredExtensions,
        {
          request: context,
          responseBody: undefined,
          responseHeaders: response
            ? Object.fromEntries(response.headers.entries())
            : undefined,
        },
      )

      if (settleResult.success) {
        return settleResult.headers ?? {}
      }

      throw new X402SettleError(
        settleResult.errorReason ||
          settleResult.errorMessage ||
          'Settlement failed',
        settleResult.headers ?? {},
      )
    },
  }
}

export class X402SettleError extends Error {
  headers: Record<string, string>
  constructor(message: string, headers: Record<string, string>) {
    super(message)
    this.name = 'X402SettleError'
    this.headers = headers
  }
}

/** Attach settlement response headers onto an existing Response. */
export function withPaymentHeaders(
  response: Response,
  paymentHeaders: Record<string, string>,
): Response {
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(paymentHeaders)) {
    headers.set(k, v)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function encodeSettleHeader(settle: {
  success: boolean
  transaction?: string
  network?: string
  errorReason?: string
}): string {
  return encodePaymentResponseHeader(settle as never)
}

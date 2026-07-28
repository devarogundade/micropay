/**
 * 0G Compute Router client (server-side).
 * Docs: https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview
 *
 * Auth:
 * - sk-… inference keys → Authorization on /v1/chat/completions (etc.)
 * - mk-… management keys → /v1/account/* (optional)
 * Never send sk-/mk- to the browser.
 *
 * Anthropic-only models (supported_formats: ["anthropic"]) are called via
 * /v1/messages with OpenAI↔Anthropic conversion so clients keep using
 * /api/v1/chat/completions.
 */

import {
  anthropicMessageToOpenaiCompletion,
  anthropicSseToOpenaiStream,
  isOpenaiFormatMismatchError,
  openaiChatBodyToAnthropicMessages,
  requiresAnthropicFormat,
} from '#/lib/zg-anthropic'

export const ZG_ROUTER_MAINNET = 'https://router-api.0g.ai/v1'
export const ZG_ROUTER_TESTNET =
  'https://router-api-testnet.integratenetwork.work/v1'

export type ZgRouterNetwork = 'mainnet' | 'testnet'

export type RouterModel = {
  id: string
  object?: string
  created?: number
  owned_by?: string
  name?: string
  description?: string
  type?: string
  context_length?: number
  max_completion_tokens?: number
  architecture?: {
    modality?: string
    input_modalities?: string[]
    output_modalities?: string[]
    instruct_type?: string
    tokenizer?: string
  }
  supported_parameters?: string[]
  supported_formats?: string[]
  pricing?: { prompt?: string; completion?: string }
  pricing_usd?: { prompt?: string; completion?: string; image?: string }
  verifiability?: string
  tee_attested?: boolean
  tee_type?: string
  tee_verifier?: string
  provider_count?: number
}

export type RouterModelsResponse = {
  object: string
  data: RouterModel[]
}

/** OpenAI-style chat completion response with optional Router extensions. */
export type RouterChatCompletion = {
  id?: string
  object?: string
  model?: string
  choices?: Array<{
    index?: number
    message?: {
      role?: string
      content?: string | null
    }
    reasoning_content?: string | null
    tool_calls?: unknown
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  /** Router cost / provider trace (surfaced in playground & workspace). */
  x_0g_trace?: Record<string, unknown>
  error?: { message?: string; type?: string; code?: string }
}

export function getRouterBaseUrl(): string {
  const explicit = process.env.ZG_ROUTER_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const network = (process.env.ZG_ROUTER_NETWORK?.trim().toLowerCase() ||
    'mainnet') as ZgRouterNetwork
  return network === 'testnet' ? ZG_ROUTER_TESTNET : ZG_ROUTER_MAINNET
}

/** Base without trailing /v1 — used for /v1/async/* paths. */
export function getRouterOrigin(): string {
  const base = getRouterBaseUrl()
  return base.replace(/\/v1\/?$/, '')
}

export function getRouterApiKey(): string | undefined {
  const key = process.env.ZG_ROUTER_API_KEY?.trim()
  return key || undefined
}

export function getRouterManagementKey(): string | undefined {
  const key = process.env.ZG_ROUTER_MANAGEMENT_KEY?.trim()
  return key || undefined
}

export function routerConfigured(): boolean {
  return Boolean(getRouterApiKey())
}

async function routerFetch(
  path: string,
  init: RequestInit & { requireAuth?: boolean; absolute?: boolean } = {},
): Promise<Response> {
  const url = init.absolute
    ? path
    : `${getRouterBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers)

  if (init.requireAuth !== false) {
    const key = getRouterApiKey()
    if (!key) {
      throw new RouterConfigError(
        'ZG_ROUTER_API_KEY is not set. Add a provider inference key to .env.local.',
      )
    }
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${key}`)
    }
  }

  if (
    !headers.has('Content-Type') &&
    init.body &&
    !(init.body instanceof FormData)
  ) {
    headers.set('Content-Type', 'application/json')
  }

  const { requireAuth: _r, absolute: _a, ...rest } = init
  return fetch(url, { ...rest, headers })
}

export class RouterConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RouterConfigError'
  }
}

export class RouterApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'RouterApiError'
    this.status = status
    this.body = body
  }
}

let modelsCache: { at: number; data: RouterModel[] } | null = null
const MODELS_TTL_MS = 60_000

export async function listRouterModels(opts?: {
  force?: boolean
}): Promise<RouterModel[]> {
  if (
    !opts?.force &&
    modelsCache &&
    Date.now() - modelsCache.at < MODELS_TTL_MS
  ) {
    return modelsCache.data
  }

  const res = await routerFetch('/models', {
    method: 'GET',
    requireAuth: false,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new RouterApiError(
      res.status,
      `Router GET /models failed (${res.status}): ${text.slice(0, 200)}`,
      text,
    )
  }

  const json = (await res.json()) as RouterModelsResponse
  const data = Array.isArray(json.data) ? json.data : []
  modelsCache = { at: Date.now(), data }
  return data
}

export type ChatCompletionsInput = {
  body: Record<string, unknown>
  /** Forward verify_tee when the client asks for verifiable execution. */
  verifyTee?: boolean
  /** Optional deterministic provider routing headers. */
  providerHeaders?: Record<string, string>
  /**
   * Force Anthropic /v1/messages. When omitted, inferred from the model's
   * supported_formats in the Router catalog.
   */
  useAnthropic?: boolean
}

function providerHeaderBag(
  providerHeaders?: Record<string, string>,
  verifyTee?: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {}
  if (verifyTee) headers['X-0G-Verify-Tee'] = 'true'
  if (providerHeaders) {
    for (const [k, v] of Object.entries(providerHeaders)) {
      if (k.toLowerCase().startsWith('x-0g-provider-') && v) {
        headers[k] = v
      }
    }
  }
  return headers
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

async function modelNeedsAnthropic(modelId: unknown): Promise<boolean> {
  if (typeof modelId !== 'string' || !modelId) return false
  try {
    const models = await listRouterModels()
    const rm = models.find((m) => m.id === modelId)
    if (rm) return requiresAnthropicFormat(rm.supported_formats)
    // Unknown to catalog — Claude ids are anthropic-only on 0G today.
    return /^claude[-_]/i.test(modelId)
  } catch {
    return /^claude[-_]/i.test(modelId)
  }
}

/**
 * Prefer catalog formats; `useAnthropic: true` forces /messages.
 * `useAnthropic: false` is ignored so callers cannot accidentally disable
 * anthropic-only models — auto-detect always wins for those.
 */
async function shouldUseAnthropic(
  input: ChatCompletionsInput,
): Promise<boolean> {
  if (input.useAnthropic === true) return true
  return modelNeedsAnthropic(input.body.model)
}

async function postAnthropicMessages(
  input: ChatCompletionsInput,
  stream: boolean,
): Promise<Response> {
  const anthropicBody = openaiChatBodyToAnthropicMessages({
    ...input.body,
    stream,
  })
  return routerFetch('/messages', {
    method: 'POST',
    requireAuth: true,
    headers: {
      ...providerHeaderBag(input.providerHeaders, input.verifyTee),
      'anthropic-version': '2023-06-01',
      ...(stream ? { Accept: 'text/event-stream' } : {}),
    },
    body: JSON.stringify(anthropicBody),
  })
}

function anthropicErrorMessage(raw: Record<string, unknown>, status: number) {
  const err = isRecord(raw.error) ? raw.error : undefined
  return (
    (typeof err?.message === 'string' && err.message) ||
    (typeof raw.error === 'string' && raw.error) ||
    `Router messages failed (${status})`
  )
}

function openaiErrorMessage(data: RouterChatCompletion, status: number) {
  return (
    data.error?.message ||
    (typeof (data as { error?: string }).error === 'string'
      ? (data as { error: string }).error
      : undefined) ||
    `Router chat completions failed (${status})`
  )
}

function wrapAnthropicStream(res: Response): Response {
  if (!res.body) {
    throw new RouterApiError(502, 'Empty Anthropic stream body')
  }
  const headers = new Headers(res.headers)
  headers.set('Content-Type', 'text/event-stream; charset=utf-8')
  headers.delete('content-length')
  headers.delete('content-encoding')
  return new Response(anthropicSseToOpenaiStream(res.body), {
    status: res.status,
    headers,
  })
}

export async function createChatCompletion(
  input: ChatCompletionsInput,
): Promise<{ status: number; data: RouterChatCompletion }> {
  const useAnthropic = await shouldUseAnthropic(input)

  if (useAnthropic) {
    const res = await postAnthropicMessages(input, false)
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      throw new RouterApiError(
        res.status,
        anthropicErrorMessage(raw, res.status),
        raw,
      )
    }
    return {
      status: res.status,
      data: anthropicMessageToOpenaiCompletion(raw) as RouterChatCompletion,
    }
  }

  const res = await routerFetch('/chat/completions', {
    method: 'POST',
    requireAuth: true,
    headers: providerHeaderBag(input.providerHeaders, input.verifyTee),
    body: JSON.stringify({ ...input.body, stream: false }),
  })

  const data = (await res.json().catch(() => ({}))) as RouterChatCompletion
  if (!res.ok) {
    const msg = openaiErrorMessage(data, res.status)
    // Catalog may lag; if Router says anthropic-only, retry /v1/messages.
    if (isOpenaiFormatMismatchError(msg)) {
      const retry = await postAnthropicMessages(input, false)
      const raw = (await retry.json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      if (!retry.ok) {
        throw new RouterApiError(
          retry.status,
          anthropicErrorMessage(raw, retry.status),
          raw,
        )
      }
      return {
        status: retry.status,
        data: anthropicMessageToOpenaiCompletion(raw) as RouterChatCompletion,
      }
    }
    throw new RouterApiError(res.status, msg, data)
  }

  return { status: res.status, data }
}

/** Stream chat completions; returns OpenAI-compatible SSE (even for Anthropic models). */
export async function createChatCompletionStream(
  input: ChatCompletionsInput,
): Promise<Response> {
  const useAnthropic = await shouldUseAnthropic(input)

  if (useAnthropic) {
    const res = await postAnthropicMessages(input, true)
    if (!res.ok) {
      const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
      throw new RouterApiError(
        res.status,
        anthropicErrorMessage(raw, res.status),
        raw,
      )
    }
    return wrapAnthropicStream(res)
  }

  const body = { ...input.body, stream: true }
  const res = await routerFetch('/chat/completions', {
    method: 'POST',
    requireAuth: true,
    headers: providerHeaderBag(input.providerHeaders, input.verifyTee),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as RouterChatCompletion
    const msg = openaiErrorMessage(data, res.status)
    if (isOpenaiFormatMismatchError(msg)) {
      const retry = await postAnthropicMessages(input, true)
      if (!retry.ok) {
        const raw = (await retry.json().catch(() => ({}))) as Record<
          string,
          unknown
        >
        throw new RouterApiError(
          retry.status,
          anthropicErrorMessage(raw, retry.status),
          raw,
        )
      }
      return wrapAnthropicStream(retry)
    }
    throw new RouterApiError(res.status, msg, data)
  }

  return res
}

export type ImageGenerationInput = {
  body: Record<string, unknown>
  providerHeaders?: Record<string, string>
  verifyTee?: boolean
}

export type AsyncImageJob = {
  jobId?: string
  job_id?: string
  status?: string
  provider_address?: string
  error?: { message?: string }
  errorMessage?: string
  data?: unknown
  result?: unknown
  retryAfter?: number
}

/** Submit async image generation. response_format must be b64_json. */
export async function submitImageGeneration(
  input: ImageGenerationInput,
): Promise<{ status: number; data: AsyncImageJob }> {
  const body = {
    ...input.body,
    response_format: 'b64_json',
  }
  const origin = getRouterOrigin()
  const res = await routerFetch(`${origin}/v1/async/images/generations`, {
    method: 'POST',
    requireAuth: true,
    absolute: true,
    headers: providerHeaderBag(input.providerHeaders, input.verifyTee),
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as AsyncImageJob
  if (!res.ok && res.status !== 202) {
    const msg =
      data.error?.message ||
      data.errorMessage ||
      `Router image generation failed (${res.status})`
    throw new RouterApiError(res.status, msg, data)
  }

  return { status: res.status, data }
}

export async function pollImageJob(input: {
  jobId: string
  model?: string
  providerAddress?: string
  providerHeaders?: Record<string, string>
}): Promise<{ status: number; data: AsyncImageJob; retryAfter?: number }> {
  const origin = getRouterOrigin()
  const qs = new URLSearchParams()
  if (input.model) qs.set('model', input.model)
  if (input.providerAddress) qs.set('provider_address', input.providerAddress)
  const q = qs.toString()
  const url = `${origin}/v1/async/jobs/${encodeURIComponent(input.jobId)}${q ? `?${q}` : ''}`

  const res = await routerFetch(url, {
    method: 'GET',
    requireAuth: true,
    absolute: true,
    headers: providerHeaderBag(input.providerHeaders),
  })

  const data = (await res.json().catch(() => ({}))) as AsyncImageJob
  if (!res.ok) {
    const msg =
      data.error?.message ||
      data.errorMessage ||
      `Router job poll failed (${res.status})`
    throw new RouterApiError(res.status, msg, data)
  }

  const retryAfterHeader = res.headers.get('Retry-After')
  return {
    status: res.status,
    data,
    retryAfter: retryAfterHeader ? Number(retryAfterHeader) : data.retryAfter,
  }
}

/**
 * Submit + poll until completed/failed (bounded).
 * Returns OpenAI-style { data: [{ b64_json }] } when possible.
 */
export async function generateImageSynced(
  input: ImageGenerationInput,
  opts?: { maxWaitMs?: number },
): Promise<{ status: number; data: unknown }> {
  const maxWait = opts?.maxWaitMs ?? 120_000
  const submitted = await submitImageGeneration(input)
  const jobId = submitted.data.jobId || submitted.data.job_id
  if (!jobId) {
    // Some routers may return the image inline
    return { status: submitted.status, data: submitted.data }
  }

  const model =
    typeof input.body.model === 'string' ? input.body.model : undefined
  const providerAddress = submitted.data.provider_address
  const started = Date.now()

  while (Date.now() - started < maxWait) {
    const polled = await pollImageJob({
      jobId,
      model,
      providerAddress,
      providerHeaders: input.providerHeaders,
    })
    const st = (polled.data.status || '').toLowerCase()
    if (st === 'completed' || st === 'succeeded' || st === 'success') {
      const payload =
        polled.data.data ??
        polled.data.result ??
        polled.data
      return { status: 200, data: payload }
    }
    if (st === 'failed' || st === 'error') {
      throw new RouterApiError(
        502,
        polled.data.errorMessage ||
          polled.data.error?.message ||
          'Image generation failed',
        polled.data,
      )
    }
    const waitSec = polled.retryAfter && polled.retryAfter > 0 ? polled.retryAfter : 3
    await new Promise((r) => setTimeout(r, waitSec * 1000))
  }

  throw new RouterApiError(504, 'Image generation timed out', { jobId })
}

export async function createAudioTranscription(input: {
  formData: FormData
  providerHeaders?: Record<string, string>
  verifyTee?: boolean
}): Promise<{ status: number; data: unknown; contentType: string }> {
  const res = await routerFetch('/audio/transcriptions', {
    method: 'POST',
    requireAuth: true,
    headers: providerHeaderBag(input.providerHeaders, input.verifyTee),
    body: input.formData,
  })

  const contentType = res.headers.get('content-type') || 'application/json'
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg =
        (data as { error?: { message?: string } })?.error?.message ||
        `Router transcription failed (${res.status})`
      throw new RouterApiError(res.status, msg, data)
    }
    return { status: res.status, data, contentType }
  }

  const text = await res.text()
  if (!res.ok) {
    throw new RouterApiError(res.status, text.slice(0, 200), text)
  }
  return { status: res.status, data: { text }, contentType }
}

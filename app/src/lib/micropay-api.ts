/** Browser → Micropay server proxy (never talks to upstream with sk- directly). */

import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '#/lib/storage-limits'

export type StorageUploadResult = {
  url: string
  storagePath: string
  size: number
  mimeType: string
  name: string
  bucket: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}))
}

function errorMessage(raw: unknown, fallback: string): string {
  if (!isRecord(raw)) return fallback
  const err = raw.error
  if (isRecord(err) && typeof err.message === 'string' && err.message) {
    return err.message
  }
  return fallback
}

/** Upload a file via the server (service role) → Supabase Storage. */
export async function uploadToStorage(input: {
  file: Blob
  filename?: string
  folder?: string
  signal?: AbortSignal
}): Promise<StorageUploadResult> {
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_LABEL} limit`)
  }

  const form = new FormData()
  form.append(
    'file',
    input.file,
    input.filename ||
      (input.file instanceof File ? input.file.name : 'upload.bin'),
  )
  if (input.folder) form.append('folder', input.folder)

  const res = await fetch('/api/v1/storage/upload', {
    method: 'POST',
    body: form,
    signal: input.signal,
  })
  const raw = await readJson(res)
  if (!res.ok) {
    throw new Error(errorMessage(raw, `Upload failed (${res.status})`))
  }
  if (!isRecord(raw) || typeof raw.url !== 'string') {
    throw new Error('Upload failed: invalid response')
  }
  return {
    url: raw.url,
    storagePath: String(raw.storagePath ?? ''),
    size: typeof raw.size === 'number' ? raw.size : input.file.size,
    mimeType: String(raw.mimeType ?? ''),
    name: String(raw.name ?? input.filename ?? 'upload'),
    bucket: String(raw.bucket ?? ''),
  }
}

/** OpenAI-compatible multimodal content parts. */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'image_url'
      image_url: { url: string; detail?: 'auto' | 'low' | 'high' }
    }

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatContentPart[]
}

export type ProxyChatResult = {
  ok: boolean
  status: number
  content: string
  reasoning?: string
  model?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  /** Provider cost / metadata when present (internal field may be x_0g_trace). */
  trace?: Record<string, unknown>
  /** USDC cost derived from provider trace when present. */
  costUsdc?: number
  error?: string
  raw?: unknown
  paymentResponse?: string | null
}

type ChatCompletionJson = {
  choices?: Array<{
    message?: {
      content?: string | null
      reasoning_content?: string | null
    }
    delta?: {
      content?: string | null
      reasoning_content?: string | null
    }
  }>
  model?: string
  usage?: ProxyChatResult['usage']
  x_0g_trace?: Record<string, unknown>
  error?: { message?: string }
}

function asChatCompletionJson(raw: unknown): ChatCompletionJson {
  return isRecord(raw) ? (raw as ChatCompletionJson) : {}
}

type PaidFetch = typeof fetch

async function paidFetch(
  fetchImpl: PaidFetch | null | undefined,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const f = fetchImpl ?? fetch
  return f(input, init)
}

/** Pull a numeric cost from provider trace without surfacing neuron jargon. */
export function costUsdcFromTrace(
  trace: Record<string, unknown> | undefined,
): number | undefined {
  if (!trace) return undefined
  const raw =
    trace.cost_usdc ??
    trace.usdc ??
    trace.cost ??
    trace.total_cost ??
    trace.amount ??
    trace.neuron_cost
  if (raw == null) return undefined
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  // Neuron-scale values are typically >> 1; treat large numbers as micro-units.
  if (n > 100) return Number((n / 1_000_000_000).toFixed(6))
  return Number(n.toFixed(6))
}

export function providerLabelFromTrace(
  trace: Record<string, unknown> | undefined,
): string | undefined {
  if (!trace) return undefined
  const provider =
    (trace.provider as string) ||
    (trace.provider_address as string) ||
    (trace.providerAddress as string)
  return provider ? String(provider) : undefined
}

function paymentHeader(res: Response): string | null {
  return res.headers.get('PAYMENT-RESPONSE') || res.headers.get('payment-response')
}

export async function proxyChatCompletions(input: {
  model: string
  messages: ChatMessage[]
  verifyTee?: boolean
  stream?: boolean
  fetchImpl?: PaidFetch | null
  signal?: AbortSignal
}): Promise<ProxyChatResult> {
  if (input.stream) {
    return streamChatCompletions(input)
  }

  const res = await paidFetch(input.fetchImpl, '/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      verify_tee: input.verifyTee || undefined,
      stream: false,
    }),
    signal: input.signal,
  })

  const paymentResponse = paymentHeader(res)
  const raw = await readJson(res)
  const data = asChatCompletionJson(raw)

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      content: '',
      error: errorMessage(raw, `Request failed (${res.status})`),
      raw,
      paymentResponse,
    }
  }

  const message = data.choices?.[0]?.message
  const content = message?.content?.trim() || ''
  const reasoning = message?.reasoning_content?.trim() || undefined
  const trace = data.x_0g_trace

  return {
    ok: true,
    status: res.status,
    content,
    reasoning,
    model: data.model,
    usage: data.usage,
    trace,
    costUsdc: costUsdcFromTrace(trace),
    raw,
    paymentResponse,
  }
}

/** Stream chat completions (SSE). Calls onDelta as tokens arrive. */
export async function streamChatCompletions(input: {
  model: string
  messages: ChatMessage[]
  verifyTee?: boolean
  fetchImpl?: PaidFetch | null
  signal?: AbortSignal
  onDelta?: (delta: { content?: string; reasoning?: string }) => void
}): Promise<ProxyChatResult> {
  const res = await paidFetch(input.fetchImpl, '/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      verify_tee: input.verifyTee || undefined,
      stream: true,
    }),
    signal: input.signal,
  })

  const paymentResponse = paymentHeader(res)

  if (!res.ok) {
    const raw = await readJson(res)
    return {
      ok: false,
      status: res.status,
      content: '',
      error: errorMessage(raw, `Request failed (${res.status})`),
      raw,
      paymentResponse,
    }
  }

  const ctype = res.headers.get('Content-Type') || ''
  if (!ctype.includes('text/event-stream') && !ctype.includes('stream')) {
    // Upstream returned JSON despite stream:true — parse as non-stream.
    const raw = await readJson(res)
    const data = asChatCompletionJson(raw)
    const message = data.choices?.[0]?.message
    const content = message?.content?.trim() || ''
    const reasoning = message?.reasoning_content?.trim() || undefined
    if (content) input.onDelta?.({ content })
    if (reasoning) input.onDelta?.({ reasoning })
    const trace = data.x_0g_trace
    return {
      ok: true,
      status: res.status,
      content,
      reasoning,
      model: data.model,
      usage: data.usage,
      trace,
      costUsdc: costUsdcFromTrace(trace),
      raw,
      paymentResponse,
    }
  }

  if (!res.body) {
    return {
      ok: false,
      status: res.status,
      content: '',
      error: 'Empty stream body',
      paymentResponse,
    }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let reasoning = ''
  let model: string | undefined
  let usage: ProxyChatResult['usage']
  let trace: Record<string, unknown> | undefined
  let rawLast: unknown

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue

        try {
          const chunk = asChatCompletionJson(JSON.parse(payload) as unknown)
          rawLast = chunk
          if (chunk.model) model = chunk.model
          if (chunk.usage) usage = chunk.usage
          if (chunk.x_0g_trace) trace = chunk.x_0g_trace

          const delta = chunk.choices?.[0]?.delta
          const msg = chunk.choices?.[0]?.message
          const c = delta?.content ?? msg?.content
          const r = delta?.reasoning_content ?? msg?.reasoning_content
          if (typeof c === 'string' && c) {
            content += c
            input.onDelta?.({ content: c })
          }
          if (typeof r === 'string' && r) {
            reasoning += r
            input.onDelta?.({ reasoning: r })
          }
        } catch {
          /* skip malformed SSE lines */
        }
      }
    }
  } catch (e) {
    if (input.signal?.aborted) {
      return {
        ok: true,
        status: res.status,
        content,
        reasoning: reasoning || undefined,
        model,
        usage,
        trace,
        costUsdc: costUsdcFromTrace(trace),
        paymentResponse,
        error: 'Stopped',
      }
    }
    throw e
  }

  return {
    ok: true,
    status: res.status,
    content,
    reasoning: reasoning || undefined,
    model,
    usage,
    trace,
    costUsdc: costUsdcFromTrace(trace),
    raw: rawLast,
    paymentResponse,
  }
}

type ImgItem = { b64_json?: string; url?: string }

function collectImageUrls(raw: unknown): string[] {
  const images: string[] = []
  const payload = isRecord(raw) ? raw : {}
  const dataList = Array.isArray(payload.data)
    ? (payload.data as ImgItem[])
    : []
  const result = isRecord(payload.result) ? payload.result : null
  const resultList =
    result && Array.isArray(result.data) ? (result.data as ImgItem[]) : []
  const list: ImgItem[] = dataList.length ? dataList : resultList

  for (const item of list) {
    // Prefer persisted HTTPS URL from Supabase over in-memory data URLs.
    if (item.url) {
      images.push(item.url)
    } else if (item.b64_json) {
      images.push(`data:image/png;base64,${item.b64_json}`)
    }
  }

  if (!images.length) {
    const nested = findB64(raw)
    for (const b64 of nested) {
      images.push(`data:image/png;base64,${b64}`)
    }
  }
  return images
}

/** Friendly status label from an SSE job event payload. */
function imageJobLabel(raw: unknown, fallback: string): string {
  if (!isRecord(raw)) return fallback
  if (typeof raw.label === 'string' && raw.label) return raw.label
  if (typeof raw.status === 'string' && raw.status) {
    const st = raw.status.toLowerCase()
    if (st === 'queued' || st === 'pending') return 'Waiting in line…'
    if (st === 'running' || st === 'processing' || st === 'in_progress') {
      return 'Generating image…'
    }
    if (st === 'completed' || st === 'succeeded' || st === 'success') {
      return 'Image ready'
    }
    if (st === 'failed' || st === 'error') return 'Generation failed'
  }
  return fallback
}

/**
 * Pay → submit async job → follow SSE status until images are ready.
 * Falls back to sync generations if the router returns images inline.
 */
export async function proxyImageGeneration(input: {
  model: string
  prompt: string
  size?: string
  n?: number
  fetchImpl?: PaidFetch | null
  signal?: AbortSignal
  onStatus?: (label: string) => void
}): Promise<{
  ok: boolean
  status: number
  images: string[]
  error?: string
  raw?: unknown
  jobId?: string
}> {
  input.onStatus?.('Confirming payment…')
  const res = await paidFetch(
    input.fetchImpl,
    '/api/v1/images/generations?async=1',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        n: input.n ?? 1,
        size: input.size ?? '1024x1024',
        response_format: 'b64_json',
      }),
      signal: input.signal,
    },
  )

  const raw = await readJson(res)
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      images: [],
      error: errorMessage(raw, `Image request failed (${res.status})`),
      raw,
    }
  }

  // Inline result (some routers skip async jobs).
  const inline = collectImageUrls(raw)
  if (inline.length) {
    input.onStatus?.('Image ready')
    return { ok: true, status: res.status, images: inline, raw }
  }

  const payload = isRecord(raw) ? raw : {}
  const jobId =
    (typeof payload.jobId === 'string' && payload.jobId) ||
    (typeof payload.job_id === 'string' && payload.job_id) ||
    null
  if (!jobId) {
    return {
      ok: false,
      status: res.status,
      images: [],
      error: 'No job id returned for image generation',
      raw,
    }
  }

  const providerAddress =
    typeof payload.provider_address === 'string'
      ? payload.provider_address
      : undefined
  const qs = new URLSearchParams({ stream: '1', model: input.model })
  if (providerAddress) qs.set('provider_address', providerAddress)

  input.onStatus?.('Waiting in line…')
  const streamRes = await paidFetch(
    input.fetchImpl,
    `/api/v1/images/jobs/${encodeURIComponent(jobId)}?${qs}`,
    {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: input.signal,
    },
  )

  if (!streamRes.ok) {
    const errBody = await readJson(streamRes)
    return {
      ok: false,
      status: streamRes.status,
      images: [],
      error: errorMessage(errBody, `Job stream failed (${streamRes.status})`),
      raw: errBody,
      jobId,
    }
  }

  if (!streamRes.body) {
    return {
      ok: false,
      status: streamRes.status,
      images: [],
      error: 'Empty job stream',
      jobId,
    }
  }

  const reader = streamRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let lastPayload: unknown
  let completedPayload: unknown
  let failedMessage: string | undefined

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trimEnd()
        if (!trimmed) {
          eventName = 'message'
          continue
        }
        if (trimmed.startsWith(':')) continue
        if (trimmed.startsWith('event:')) {
          eventName = trimmed.slice(6).trim()
          continue
        }
        if (!trimmed.startsWith('data:')) continue
        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue

        let parsed: unknown = dataStr
        try {
          parsed = JSON.parse(dataStr) as unknown
        } catch {
          /* keep raw string */
        }
        lastPayload = parsed

        if (eventName === 'status' || eventName === 'message') {
          input.onStatus?.(imageJobLabel(parsed, 'Generating image…'))
        } else if (eventName === 'completed') {
          completedPayload = parsed
          input.onStatus?.(imageJobLabel(parsed, 'Image ready'))
        } else if (eventName === 'failed') {
          failedMessage = errorMessage(
            parsed,
            imageJobLabel(parsed, 'Generation failed'),
          )
          if (isRecord(parsed) && isRecord(parsed.error)) {
            const msg = parsed.error.message
            if (typeof msg === 'string' && msg) failedMessage = msg
          }
        }
      }
    }
  } catch (e) {
    if (input.signal?.aborted) {
      return {
        ok: false,
        status: 499,
        images: [],
        error: 'Stopped',
        jobId,
      }
    }
    throw e
  }

  if (failedMessage) {
    return {
      ok: false,
      status: 502,
      images: [],
      error: failedMessage,
      raw: lastPayload,
      jobId,
    }
  }

  const images = collectImageUrls(completedPayload ?? lastPayload)
  if (!images.length) {
    return {
      ok: false,
      status: streamRes.status,
      images: [],
      error: 'No image data in job result',
      raw: completedPayload ?? lastPayload,
      jobId,
    }
  }

  return {
    ok: true,
    status: 200,
    images,
    raw: completedPayload ?? lastPayload,
    jobId,
  }
}

function findB64(value: unknown, out: string[] = []): string[] {
  if (!value || typeof value !== 'object') return out
  if (Array.isArray(value)) {
    for (const v of value) findB64(v, out)
    return out
  }
  const obj = value as Record<string, unknown>
  if (typeof obj.b64_json === 'string') out.push(obj.b64_json)
  for (const v of Object.values(obj)) findB64(v, out)
  return out
}

export async function proxyAudioTranscription(input: {
  model: string
  file: Blob
  filename?: string
  language?: string
  fetchImpl?: PaidFetch | null
  signal?: AbortSignal
}): Promise<{
  ok: boolean
  status: number
  text: string
  error?: string
  raw?: unknown
}> {
  if (input.file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      text: '',
      error: `Audio file exceeds ${MAX_UPLOAD_LABEL} limit`,
    }
  }

  const form = new FormData()
  form.append('model', input.model)
  form.append('file', input.file, input.filename || 'audio.webm')
  if (input.language) form.append('language', input.language)

  const res = await paidFetch(
    input.fetchImpl,
    '/api/v1/audio/transcriptions',
    {
      method: 'POST',
      body: form,
      signal: input.signal,
    },
  )

  const raw = await readJson(res)
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      text: '',
      error: errorMessage(raw, `Transcription failed (${res.status})`),
      raw,
    }
  }

  const text =
    isRecord(raw) && typeof raw.text === 'string'
      ? raw.text
      : JSON.stringify(raw)

  return { ok: true, status: res.status, text, raw }
}

export type ImageHistoryItem = {
  id: string
  modelSlug: string
  modelName: string | null
  prompt: string
  size: string | null
  url: string
  storagePath: string | null
  createdAt: string
}

export type TranscriptionHistoryItem = {
  id: string
  modelSlug: string
  modelName: string | null
  filename: string | null
  mimeType: string | null
  fileSize: number | null
  language: string | null
  text: string
  createdAt: string
}

/** Load persisted image gallery for the connected wallet. */
export async function fetchImageHistory(input: {
  fetchImpl?: PaidFetch | null
  signal?: AbortSignal
}): Promise<{ ok: boolean; data: ImageHistoryItem[]; error?: string }> {
  const res = await paidFetch(input.fetchImpl, '/api/v1/images/history', {
    method: 'GET',
    signal: input.signal,
  })
  const raw = await readJson(res)
  if (!res.ok) {
    return {
      ok: false,
      data: [],
      error: errorMessage(raw, `Image history failed (${res.status})`),
    }
  }
  const list =
    isRecord(raw) && Array.isArray(raw.data)
      ? (raw.data as ImageHistoryItem[])
      : []
  return { ok: true, data: list }
}

/** Load persisted transcription history for the connected wallet. */
export async function fetchTranscriptionHistory(input: {
  fetchImpl?: PaidFetch | null
  signal?: AbortSignal
}): Promise<{
  ok: boolean
  data: TranscriptionHistoryItem[]
  error?: string
}> {
  const res = await paidFetch(input.fetchImpl, '/api/v1/audio/history', {
    method: 'GET',
    signal: input.signal,
  })
  const raw = await readJson(res)
  if (!res.ok) {
    return {
      ok: false,
      data: [],
      error: errorMessage(raw, `Transcription history failed (${res.status})`),
    }
  }
  const list =
    isRecord(raw) && Array.isArray(raw.data)
      ? (raw.data as TranscriptionHistoryItem[])
      : []
  return { ok: true, data: list }
}

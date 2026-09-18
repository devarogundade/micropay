/** Client fetchers + prompt helpers for the Agents feature (Nest REST). */

import { apiUrl } from '#/lib/api-url'
import { normalizeWalletAddress } from '#/lib/wallet-address'
import { MAX_UPLOAD_BYTES } from '#/lib/storage-limits'

export type AgentType = 'chat' | 'image' | 'audio'
export type AgentStatus = 'draft' | 'published' | 'paused'
export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected'

export type AgentKnowledgeEntry = { title: string; content: string }

export type Agent = {
  id: string
  slug: string
  creatorAddress: string
  creatorShort: string
  name: string
  description: string | null
  type: AgentType
  modelId: string
  priceUsdc: number
  imageUrl: string | null
  systemPrompt?: string | null
  knowledge?: AgentKnowledgeEntry[] | null
  status: AgentStatus
  useCount: number
  createdAt: string
  updatedAt: string
}

export type AgentInput = {
  name: string
  description?: string | null
  type: AgentType
  modelId: string
  priceUsdc: number
  imageUrl?: string | null
  systemPrompt?: string | null
  knowledge?: AgentKnowledgeEntry[] | null
  status?: AgentStatus
}

export type AgentPayment = {
  id: string
  agentSlug: string
  agentName: string | null
  buyerAddress: string
  priceUsdc: number
  creditAppliedUsdc: number
  chargeUsdc: number
  txId: string | null
  createdAt: string
}

export type CreatorBalance = {
  availableUsdc: number
  lifetimeEarnedUsdc: number
  withdrawnUsdc: number
  pendingWithdrawalsUsdc: number
  balanceUsdc: number
  minWithdrawalUsdc: number
}

export type WithdrawalRequest = {
  id: string
  amountUsdc: number
  status: WithdrawalStatus
  destinationAddress: string | null
  txId: string | null
  note: string | null
  requestedAt: string
  processedAt: string | null
}

export type AgentListResult = {
  data: Agent[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export type AgentListQuery = {
  q?: string
  type?: AgentType | 'all'
  sort?: string
  creator?: string
  page?: number
  limit?: number
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
  if (isRecord(err) && typeof err.message === 'string' && err.message) return err.message
  if (typeof err === 'string' && err) return err
  if (typeof raw.message === 'string' && raw.message) return raw.message
  return fallback
}

function walletHeaders(wallet: string): HeadersInit {
  return { 'X-Wallet-Address': wallet, 'Content-Type': 'application/json' }
}

export async function fetchAgents(input: AgentListQuery = {}): Promise<AgentListResult> {
  const qs = new URLSearchParams()
  if (input.q) qs.set('q', input.q)
  if (input.type && input.type !== 'all') qs.set('type', input.type)
  if (input.sort) qs.set('sort', input.sort)
  if (input.creator) qs.set('creator', input.creator)
  if (input.page) qs.set('page', String(input.page))
  if (input.limit) qs.set('limit', String(input.limit))
  const res = await fetch(apiUrl(`/api/v1/agents${qs.toString() ? `?${qs}` : ''}`), {
    headers: { Accept: 'application/json' },
  })
  const raw = await readJson(res)
  if (!res.ok) {
    throw new Error(errorMessage(raw, `Agents request failed (${res.status})`))
  }
  // Nest envelope: { success, data: { data: Agent[], meta } }
  const payload = (
    isRecord(raw) && isRecord(raw.data)
      ? raw.data
      : isRecord(raw)
        ? raw
        : {}
  ) as Record<string, unknown>
  const data = Array.isArray(payload.data) ? (payload.data as Agent[]) : []
  const meta = isRecord(payload.meta)
    ? (payload.meta as AgentListResult['meta'])
    : undefined
  return {
    data,
    meta: meta ?? { page: input.page ?? 1, limit: input.limit ?? 20, total: data.length, totalPages: 1 },
  }
}

export async function fetchAgent(slug: string): Promise<Agent> {
  const res = await fetch(apiUrl(`/api/v1/agents/${encodeURIComponent(slug)}`), {
    headers: { Accept: 'application/json' },
  })
  const raw = await readJson(res)
  if (!res.ok) {
    throw new Error(errorMessage(raw, `Agent not found (${res.status})`))
  }
  return (isRecord(raw) && isRecord(raw.data) ? raw.data : raw) as Agent
}

export async function createAgent(input: {
  walletAddress: string
  agent: AgentInput
}): Promise<Agent> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) throw new Error('Wallet required')
  const res = await fetch(apiUrl('/api/v1/agents'), {
    method: 'POST',
    headers: walletHeaders(wallet),
    body: JSON.stringify(input.agent),
  })
  const raw = await readJson(res)
  if (!res.ok) throw new Error(errorMessage(raw, 'Failed to create agent'))
  return (isRecord(raw) && isRecord(raw.data) ? raw.data : raw) as Agent
}

export async function updateAgent(input: {
  walletAddress: string
  slug: string
  agent: AgentInput
}): Promise<Agent> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) throw new Error('Wallet required')
  const res = await fetch(apiUrl(`/api/v1/agents/${encodeURIComponent(input.slug)}`), {
    method: 'PATCH',
    headers: walletHeaders(wallet),
    body: JSON.stringify(input.agent),
  })
  const raw = await readJson(res)
  if (!res.ok) throw new Error(errorMessage(raw, 'Failed to update agent'))
  return (isRecord(raw) && isRecord(raw.data) ? raw.data : raw) as Agent
}

async function setAgentStatus(input: {
  walletAddress: string
  slug: string
  status: 'publish' | 'pause'
}): Promise<Agent> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) throw new Error('Wallet required')
  const res = await fetch(
    apiUrl(`/api/v1/agents/${encodeURIComponent(input.slug)}/${input.status}`),
    { method: 'POST', headers: walletHeaders(wallet) },
  )
  const raw = await readJson(res)
  if (!res.ok) throw new Error(errorMessage(raw, 'Failed to update agent status'))
  return (isRecord(raw) && isRecord(raw.data) ? raw.data : raw) as Agent
}

export function publishAgent(input: { walletAddress: string; slug: string }) {
  return setAgentStatus({ ...input, status: 'publish' })
}

export function pauseAgent(input: { walletAddress: string; slug: string }) {
  return setAgentStatus({ ...input, status: 'pause' })
}

export async function deleteAgent(input: {
  walletAddress: string
  slug: string
}): Promise<{ deleted: boolean; slug: string }> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) throw new Error('Wallet required')
  const res = await fetch(apiUrl(`/api/v1/agents/${encodeURIComponent(input.slug)}`), {
    method: 'DELETE',
    headers: walletHeaders(wallet),
  })
  const raw = await readJson(res)
  if (!res.ok) throw new Error(errorMessage(raw, 'Failed to delete agent'))
  return (isRecord(raw) && isRecord(raw.data) ? raw.data : raw) as { deleted: boolean; slug: string }
}

export async function fetchMyAgents(input: {
  walletAddress: string
}): Promise<Agent[]> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return []
  const res = await fetch(apiUrl('/api/v1/agents/mine'), {
    headers: { 'X-Wallet-Address': wallet },
  })
  const raw = await readJson(res)
  if (!res.ok) return []
  const data = isRecord(raw) ? raw.data : raw
  return Array.isArray(isRecord(data) ? data.items : null)
    ? (data as { items: Agent[] }).items
    : Array.isArray(data)
      ? (data as Agent[])
      : []
}

export async function fetchCreatorBalance(input: {
  walletAddress: string
}): Promise<CreatorBalance> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) {
    return {
      availableUsdc: 0,
      lifetimeEarnedUsdc: 0,
      withdrawnUsdc: 0,
      pendingWithdrawalsUsdc: 0,
      balanceUsdc: 0,
      minWithdrawalUsdc: 1,
    }
  }
  const res = await fetch(apiUrl('/api/v1/agents/me/balance'), {
    headers: { 'X-Wallet-Address': wallet },
  })
  const raw = await readJson(res)
  if (!res.ok) {
    return {
      availableUsdc: 0,
      lifetimeEarnedUsdc: 0,
      withdrawnUsdc: 0,
      pendingWithdrawalsUsdc: 0,
      balanceUsdc: 0,
      minWithdrawalUsdc: 1,
    }
  }
  return (isRecord(raw) && isRecord(raw.data) ? raw.data : raw) as CreatorBalance
}

export async function fetchCreatorPayments(input: {
  walletAddress: string
  page?: number
  limit?: number
}): Promise<{ items: AgentPayment[]; total: number; page: number; limit: number }> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return { items: [], total: 0, page: 1, limit: 20 }
  const qs = new URLSearchParams({
    page: String(input.page ?? 1),
    limit: String(input.limit ?? 20),
  })
  const res = await fetch(apiUrl(`/api/v1/agents/me/payments?${qs}`), {
    headers: { 'X-Wallet-Address': wallet },
  })
  const raw = await readJson(res)
  if (!res.ok) return { items: [], total: 0, page: input.page ?? 1, limit: input.limit ?? 20 }
  const payload = isRecord(raw) && isRecord(raw.data) ? raw.data : raw
  if (!isRecord(payload)) return { items: [], total: 0, page: 1, limit: 20 }
  return {
    items: Array.isArray(payload.items) ? (payload.items as AgentPayment[]) : [],
    total: typeof payload.total === 'number' ? payload.total : 0,
    page: typeof payload.page === 'number' ? payload.page : 1,
    limit: typeof payload.limit === 'number' ? payload.limit : 20,
  }
}

export async function requestWithdrawal(input: {
  walletAddress: string
  amountUsdc: number
  destinationAddress?: string
}): Promise<WithdrawalRequest> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) throw new Error('Wallet required')
  const res = await fetch(apiUrl('/api/v1/agents/me/withdrawals'), {
    method: 'POST',
    headers: walletHeaders(wallet),
    body: JSON.stringify({
      amountUsdc: input.amountUsdc,
      ...(input.destinationAddress ? { destinationAddress: input.destinationAddress } : {}),
    }),
  })
  const raw = await readJson(res)
  if (!res.ok) throw new Error(errorMessage(raw, 'Withdrawal request failed'))
  return (isRecord(raw) && isRecord(raw.data) ? raw.data : raw) as WithdrawalRequest
}

export async function fetchWithdrawals(input: {
  walletAddress: string
}): Promise<WithdrawalRequest[]> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return []
  const res = await fetch(apiUrl('/api/v1/agents/me/withdrawals'), {
    headers: { 'X-Wallet-Address': wallet },
  })
  const raw = await readJson(res)
  if (!res.ok) return []
  const data = isRecord(raw) ? raw.data : raw
  return Array.isArray(isRecord(data) ? data.items : null)
    ? (data as { items: WithdrawalRequest[] }).items
    : Array.isArray(data)
      ? (data as WithdrawalRequest[])
      : []
}

// ── Prompting helpers (x402 via fetchWithPay) ────────────────

export type AgentChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type AgentCompletionJson = {
  choices?: Array<{
    message?: { content?: string | null; reasoning_content?: string | null }
    delta?: { content?: string | null; reasoning_content?: string | null }
  }>
}

function asAgentCompletionJson(raw: unknown): AgentCompletionJson {
  return isRecord(raw) ? (raw as AgentCompletionJson) : {}
}

export async function agentChatCompletions(input: {
  slug: string
  messages: AgentChatMessage[]
  stream?: boolean
  fetchImpl?: typeof fetch | null
  signal?: AbortSignal
  onDelta?: (delta: { content?: string; reasoning?: string }) => void
}): Promise<{ ok: boolean; status: number; content: string; reasoning?: string; error?: string }> {
  const f = input.fetchImpl ?? fetch
  const url = apiUrl(`/api/v1/agents/${encodeURIComponent(input.slug)}/chat`)
  if (!input.stream) {
    const res = await f(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: input.messages, stream: false }),
      signal: input.signal,
    })
    const raw = await readJson(res)
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        content: '',
        error: errorMessage(raw, `Request failed (${res.status})`),
      }
    }
    const data = asAgentCompletionJson(raw)
    const message = data.choices?.[0]?.message
    return {
      ok: true,
      status: res.status,
      content: message?.content?.trim() || '',
      reasoning: message?.reasoning_content?.trim() || undefined,
    }
  }

  const res = await f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: input.messages, stream: true }),
    signal: input.signal,
  })
  if (!res.ok) {
    const raw = await readJson(res)
    return {
      ok: false,
      status: res.status,
      content: '',
      error: errorMessage(raw, `Request failed (${res.status})`),
    }
  }

  const ctype = res.headers.get('Content-Type') || ''
  if (!ctype.includes('text/event-stream') && !ctype.includes('stream')) {
    const raw = await readJson(res)
    const data = asAgentCompletionJson(raw)
    const message = data.choices?.[0]?.message
    const content = message?.content?.trim() || ''
    const reasoning = message?.reasoning_content?.trim() || undefined
    if (content) input.onDelta?.({ content })
    if (reasoning) input.onDelta?.({ reasoning })
    return { ok: true, status: res.status, content, reasoning }
  }

  if (!res.body) {
    return { ok: false, status: res.status, content: '', error: 'Empty stream body' }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let reasoning = ''

  const processLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    try {
      const chunk = asAgentCompletionJson(JSON.parse(payload) as unknown)
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
      /* ignore malformed provider events */
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) processLine(line)
    }
    buffer += decoder.decode()
    if (buffer) processLine(buffer)
  } catch (e) {
    if (input.signal?.aborted) {
      return { ok: true, status: res.status, content, reasoning: reasoning || undefined, error: 'Stopped' }
    }
    throw e
  }

  return { ok: true, status: res.status, content, reasoning: reasoning || undefined }
}

type ImgItem = { b64_json?: string; url?: string }

function collectImageUrls(raw: unknown): string[] {
  const images: string[] = []
  const payload = isRecord(raw) ? raw : {}
  const dataList = Array.isArray(payload.data) ? (payload.data as ImgItem[]) : []
  const result = isRecord(payload.result) ? payload.result : null
  const resultList = result && Array.isArray(result.data) ? (result.data as ImgItem[]) : []
  const list = dataList.length ? dataList : resultList
  for (const item of list) {
    if (item.url) images.push(item.url)
    else if (item.b64_json) images.push(`data:image/png;base64,${item.b64_json}`)
  }
  return images
}

export async function agentImageGeneration(input: {
  slug: string
  model: string
  prompt: string
  size?: string
  n?: number
  fetchImpl?: typeof fetch | null
  signal?: AbortSignal
  onStatus?: (label: string) => void
  walletAddress?: string
}): Promise<{
  ok: boolean
  status: number
  images: string[]
  error?: string
  raw?: unknown
  jobId?: string
}> {
  input.onStatus?.('Confirming payment…')
  const f = input.fetchImpl ?? fetch
  const res = await f(
    apiUrl(`/api/v1/agents/${encodeURIComponent(input.slug)}/images?async=1`),
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
  if (!res.ok && res.status !== 202) {
    return { ok: false, status: res.status, images: [], error: errorMessage(raw, 'Image request failed'), raw }
  }

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
    return { ok: false, status: res.status, images: [], error: 'No job id returned', raw }
  }

  input.onStatus?.('Waiting in line…')
  const { waitForJob } = await import('#/lib/realtime')
  const waited = await waitForJob({
    jobId,
    walletAddress: input.walletAddress,
    signal: input.signal,
    onStatus: (label) => input.onStatus?.(label),
    pollUrl: apiUrl(`/api/v1/images/jobs/${encodeURIComponent(jobId)}`),
    fetchImpl: input.fetchImpl ?? undefined,
  })

  if (!waited.ok) {
    return {
      ok: false,
      status: 502,
      images: [],
      error: waited.error || 'Image job failed',
      raw: waited.event,
      jobId,
    }
  }

  const images = collectImageUrls(waited.event?.result ?? waited.event)
  if (!images.length) {
    const pollRes = await f(apiUrl(`/api/v1/images/jobs/${encodeURIComponent(jobId)}`), {
      signal: input.signal,
    })
    const pollRaw = await readJson(pollRes)
    const fromPoll = collectImageUrls(pollRaw)
    if (fromPoll.length) {
      input.onStatus?.('Image ready')
      return { ok: true, status: 200, images: fromPoll, raw: pollRaw, jobId }
    }
    return { ok: false, status: 502, images: [], error: 'No image data in job result', raw: waited.event, jobId }
  }

  input.onStatus?.('Image ready')
  return { ok: true, status: 200, images, raw: waited.event, jobId }
}

export async function agentAudioTranscription(input: {
  slug: string
  model: string
  file: Blob
  filename?: string
  language?: string
  fetchImpl?: typeof fetch | null
  signal?: AbortSignal
}): Promise<{ ok: boolean; status: number; text: string; error?: string; raw?: unknown }> {
  if (input.file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, text: '', error: 'Audio file exceeds the upload limit' }
  }
  const form = new FormData()
  form.append('model', input.model)
  form.append('file', input.file, input.filename || 'audio.webm')
  if (input.language) form.append('language', input.language)

  const f = input.fetchImpl ?? fetch
  const res = await f(apiUrl(`/api/v1/agents/${encodeURIComponent(input.slug)}/audio`), {
    method: 'POST',
    body: form,
    signal: input.signal,
  })
  const raw = await readJson(res)
  if (!res.ok) {
    return { ok: false, status: res.status, text: '', error: errorMessage(raw, 'Transcription failed'), raw }
  }
  const text = isRecord(raw) && typeof raw.text === 'string' ? raw.text : JSON.stringify(raw)
  return { ok: true, status: res.status, text, raw }
}
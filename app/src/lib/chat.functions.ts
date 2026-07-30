/**
 * Client fetchers for chat sessions against Nest REST.
 * Call shape mirrors former createServerFn: `fn({ data })`.
 */

import { apiUrl } from '#/lib/api-url'
import type { StoredAttachment } from '#/lib/chat-attachments'
import type {
  StoredChatMessage,
  StoredChatSession,
} from '#/lib/chat-store'
import { normalizeWalletAddress } from '#/lib/wallet-address'

function walletHeaders(wallet: string): HeadersInit {
  return { 'X-Wallet-Address': wallet, 'Content-Type': 'application/json' }
}

export async function fetchLatestChat(input: {
  data: { walletAddress: string; modelId: string }
}): Promise<{
  session: StoredChatSession | null
  messages: StoredChatMessage[]
}> {
  const wallet = normalizeWalletAddress(input.data.walletAddress)
  if (!wallet) return { session: null, messages: [] }
  const qs = new URLSearchParams({
    latest: '1',
    modelId: input.data.modelId,
  })
  const res = await fetch(apiUrl(`/api/v1/chat/sessions?${qs}`), {
    headers: { 'X-Wallet-Address': wallet },
  })
  if (!res.ok) return { session: null, messages: [] }
  return (await res.json()) as {
    session: StoredChatSession | null
    messages: StoredChatMessage[]
  }
}

export async function fetchChatSessions(input: {
  data: { walletAddress: string; modelId?: string }
}): Promise<{ sessions: StoredChatSession[] }> {
  const wallet = normalizeWalletAddress(input.data.walletAddress)
  if (!wallet) return { sessions: [] }
  const qs = new URLSearchParams()
  if (input.data.modelId) qs.set('modelId', input.data.modelId)
  const res = await fetch(
    apiUrl(`/api/v1/chat/sessions${qs.toString() ? `?${qs}` : ''}`),
    { headers: { 'X-Wallet-Address': wallet } },
  )
  if (!res.ok) return { sessions: [] }
  const raw = (await res.json()) as { sessions?: StoredChatSession[] }
  return { sessions: Array.isArray(raw.sessions) ? raw.sessions : [] }
}

export async function fetchChatSession(input: {
  data: { walletAddress: string; sessionId: string }
}): Promise<{
  session: StoredChatSession | null
  messages: StoredChatMessage[]
}> {
  const wallet = normalizeWalletAddress(input.data.walletAddress)
  if (!wallet) return { session: null, messages: [] }
  const res = await fetch(
    apiUrl(
      `/api/v1/chat/sessions/${encodeURIComponent(input.data.sessionId)}`,
    ),
    { headers: { 'X-Wallet-Address': wallet } },
  )
  if (!res.ok) return { session: null, messages: [] }
  return (await res.json()) as {
    session: StoredChatSession | null
    messages: StoredChatMessage[]
  }
}

export async function createChatSessionFn(input: {
  data: {
    walletAddress: string
    modelId: string
    modelSlug?: string
    title?: string
  }
}): Promise<StoredChatSession> {
  const wallet = normalizeWalletAddress(input.data.walletAddress)
  if (!wallet) throw new Error('Wallet required')
  const res = await fetch(apiUrl('/api/v1/chat/sessions'), {
    method: 'POST',
    headers: walletHeaders(wallet),
    body: JSON.stringify({
      modelId: input.data.modelId,
      modelSlug: input.data.modelSlug,
      title: input.data.title ?? 'New chat',
    }),
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      raw &&
      typeof raw === 'object' &&
      'error' in raw &&
      (raw as { error?: { message?: string } }).error?.message
    throw new Error(typeof msg === 'string' ? msg : 'Failed to create session')
  }
  return raw as StoredChatSession
}

export async function saveChatTurn(input: {
  data: {
    walletAddress: string
    modelId: string
    modelSlug?: string
    sessionId?: string | null
    title?: string
    messages: Array<{
      id?: string
      role: 'user' | 'assistant' | 'system' | string
      content: string
      attachments?: StoredAttachment[]
      reasoning?: string
      modelId?: string
      costUsdc?: number
      provider?: string
      error?: boolean
    }>
  }
}): Promise<{ sessionId: string; messages: StoredChatMessage[] }> {
  const wallet = normalizeWalletAddress(input.data.walletAddress)
  if (!wallet) throw new Error('Wallet required')
  const res = await fetch(apiUrl('/api/v1/chat/sessions'), {
    method: 'POST',
    headers: walletHeaders(wallet),
    body: JSON.stringify({
      persist: true,
      modelId: input.data.modelId,
      modelSlug: input.data.modelSlug,
      sessionId: input.data.sessionId,
      title: input.data.title,
      messages: input.data.messages,
    }),
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      raw &&
      typeof raw === 'object' &&
      'error' in raw &&
      (raw as { error?: { message?: string } }).error?.message
    throw new Error(typeof msg === 'string' ? msg : 'Failed to save chat turn')
  }
  return raw as { sessionId: string; messages: StoredChatMessage[] }
}

export async function clearChatHistory(input: {
  data: {
    walletAddress: string
    sessionId: string
    deleteSession?: boolean
  }
}): Promise<{ ok: boolean }> {
  const wallet = normalizeWalletAddress(input.data.walletAddress)
  if (!wallet) return { ok: false }
  const qs =
    input.data.deleteSession === false ? '?clear=messages' : ''
  const res = await fetch(
    apiUrl(
      `/api/v1/chat/sessions/${encodeURIComponent(input.data.sessionId)}${qs}`,
    ),
    {
      method: 'DELETE',
      headers: { 'X-Wallet-Address': wallet },
    },
  )
  if (!res.ok) return { ok: false }
  const raw = (await res.json().catch(() => ({}))) as { ok?: boolean }
  return { ok: Boolean(raw.ok) }
}

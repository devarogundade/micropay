/**
 * LocalStorage-backed chat history for the code SPA.
 * Server chat store stays on app; IDE sessions are browser-local here.
 */

import type { StoredAttachment } from '#/lib/chat-attachments'

type MsgRow = {
  id?: string
  role: string
  content: string
  attachments?: StoredAttachment[]
  reasoning?: string
  modelId?: string
  costUsdc?: number
  provider?: string
  error?: boolean
}

type SessionMeta = {
  id: string
  modelId: string
  modelSlug: string | null
  title: string | null
  createdAt: string
  updatedAt: string
  messageCount?: number
}

type Store = {
  sessions: SessionMeta[]
  messages: Record<string, MsgRow[]>
}

const STORAGE_KEY = 'micropay.code.ide.chat.v1'

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function loadStore(): Store {
  if (typeof window === 'undefined') return { sessions: [], messages: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { sessions: [], messages: {} }
    const parsed = JSON.parse(raw) as Store
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      messages:
        parsed.messages && typeof parsed.messages === 'object'
          ? parsed.messages
          : {},
    }
  } catch {
    return { sessions: [], messages: {} }
  }
}

function saveStore(store: Store) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota */
  }
}

function normalizeWallet(address: string): string {
  return address.trim().toUpperCase()
}

/** Mirrors TanStack server-fn call shape: `fn({ data })`. */
export async function fetchChatSessions(input: {
  data: { walletAddress: string; modelId?: string }
}): Promise<{ sessions: SessionMeta[] }> {
  const wallet = normalizeWallet(input.data.walletAddress)
  const store = loadStore()
  const sessions = store.sessions
    .filter((s) => {
      if (!(s as { wallet?: string }).wallet) return true
      return (s as { wallet?: string }).wallet === wallet
    })
    .filter((s) =>
      input.data.modelId ? s.modelId === input.data.modelId : true,
    )
    .map((s) => ({
      ...s,
      messageCount: store.messages[s.id]?.length ?? s.messageCount ?? 0,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { sessions }
}

export async function fetchChatSession(input: {
  data: { walletAddress: string; sessionId: string }
}): Promise<{ session: SessionMeta | null; messages: MsgRow[] }> {
  const store = loadStore()
  const session = store.sessions.find((s) => s.id === input.data.sessionId)
  if (!session) return { session: null, messages: [] }
  return {
    session,
    messages: store.messages[session.id] ?? [],
  }
}

export async function createChatSessionFn(input: {
  data: {
    walletAddress: string
    modelId: string
    modelSlug?: string
    title?: string
  }
}): Promise<SessionMeta & { wallet: string }> {
  const wallet = normalizeWallet(input.data.walletAddress)
  const now = new Date().toISOString()
  const session: SessionMeta & { wallet: string } = {
    id: uid(),
    wallet,
    modelId: input.data.modelId,
    modelSlug: input.data.modelSlug ?? null,
    title: input.data.title ?? 'New chat',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  }
  const store = loadStore()
  store.sessions = [session, ...store.sessions]
  store.messages[session.id] = []
  saveStore(store)
  return session
}

export async function saveChatTurn(input: {
  data: {
    walletAddress: string
    modelId: string
    modelSlug?: string
    sessionId?: string | null
    title?: string
    messages: MsgRow[]
  }
}): Promise<{ sessionId: string }> {
  const wallet = normalizeWallet(input.data.walletAddress)
  const store = loadStore()
  let sessionId = input.data.sessionId || null
  const now = new Date().toISOString()

  if (!sessionId) {
    const session: SessionMeta & { wallet: string } = {
      id: uid(),
      wallet,
      modelId: input.data.modelId,
      modelSlug: input.data.modelSlug ?? null,
      title: input.data.title ?? 'New chat',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    }
    store.sessions = [session, ...store.sessions]
    store.messages[session.id] = []
    sessionId = session.id
  }

  const existing = store.messages[sessionId] ?? []
  const nextMsgs = [
    ...existing,
    ...input.data.messages.map((m) => ({
      ...m,
      id: m.id || uid(),
    })),
  ]
  store.messages[sessionId] = nextMsgs
  store.sessions = store.sessions.map((s) =>
    s.id === sessionId
      ? {
          ...s,
          updatedAt: now,
          title: input.data.title || s.title,
          messageCount: nextMsgs.length,
          modelSlug: input.data.modelSlug ?? s.modelSlug,
        }
      : s,
  )
  saveStore(store)
  return { sessionId }
}

export async function clearChatHistory(input: {
  data: {
    walletAddress: string
    sessionId: string
    deleteSession?: boolean
  }
}): Promise<{ ok: boolean }> {
  const store = loadStore()
  const id = input.data.sessionId
  if (input.data.deleteSession !== false) {
    store.sessions = store.sessions.filter((s) => s.id !== id)
    delete store.messages[id]
  } else {
    store.messages[id] = []
    store.sessions = store.sessions.map((s) =>
      s.id === id
        ? { ...s, messageCount: 0, updatedAt: new Date().toISOString() }
        : s,
    )
  }
  saveStore(store)
  return { ok: true }
}

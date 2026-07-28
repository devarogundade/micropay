/**
 * Chat session + message persistence (Prisma).
 */

import {
  toStoredAttachments,
  type StoredAttachment,
} from '#/lib/chat-attachments'
import { prisma } from '#/lib/db'
import { ensureUser } from '#/lib/users'
import { normalizeWalletAddress } from '#/lib/wallet-address'

export type { StoredAttachment }
export { toStoredAttachments }

export type StoredChatRole = 'user' | 'assistant' | 'system'

export type StoredChatMessage = {
  id: string
  role: StoredChatRole | string
  content: string
  attachments?: StoredAttachment[] | null
  reasoning?: string | null
  modelId?: string | null
  costUsdc?: number | null
  provider?: string | null
  error: boolean
  createdAt: string
}

function parseStoredAttachments(value: unknown): StoredAttachment[] | null {
  if (!Array.isArray(value)) return null
  const out: StoredAttachment[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const a = item as Partial<StoredAttachment>
    if (
      typeof a.id !== 'string' ||
      typeof a.name !== 'string' ||
      typeof a.mime !== 'string' ||
      typeof a.size !== 'number' ||
      (a.kind !== 'image' && a.kind !== 'text')
    ) {
      continue
    }
    out.push({
      id: a.id,
      name: a.name,
      mime: a.mime,
      mimeType: typeof a.mimeType === 'string' ? a.mimeType : undefined,
      size: a.size,
      kind: a.kind,
      url: typeof a.url === 'string' ? a.url : undefined,
      storagePath: typeof a.storagePath === 'string' ? a.storagePath : undefined,
      textContent:
        typeof a.textContent === 'string' ? a.textContent : undefined,
    })
  }
  return out.length ? out : null
}

export type StoredChatSession = {
  id: string
  modelId: string
  modelSlug: string | null
  title: string | null
  createdAt: string
  updatedAt: string
  messageCount?: number
}

function serializeMessage(m: {
  id: string
  role: string
  content: string
  attachments: unknown
  reasoning: string | null
  modelId: string | null
  costUsdc: number | null
  provider: string | null
  error: boolean
  createdAt: Date
}): StoredChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    attachments: parseStoredAttachments(m.attachments),
    reasoning: m.reasoning,
    modelId: m.modelId,
    costUsdc: m.costUsdc,
    provider: m.provider,
    error: m.error,
    createdAt: m.createdAt.toISOString(),
  }
}

export async function listChatSessions(input: {
  walletAddress: string
  modelId?: string
  limit?: number
}): Promise<StoredChatSession[]> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return []

  const rows = await prisma.chatSession.findMany({
    where: {
      userId: wallet,
      ...(input.modelId ? { modelId: input.modelId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: input.limit ?? 50,
    include: { _count: { select: { messages: true } } },
  })

  return rows.map((r) => ({
    id: r.id,
    modelId: r.modelId,
    modelSlug: r.modelSlug,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    messageCount: r._count.messages,
  }))
}

export async function getLatestChatSession(input: {
  walletAddress: string
  modelId: string
}): Promise<{
  session: StoredChatSession | null
  messages: StoredChatMessage[]
}> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return { session: null, messages: [] }

  const row = await prisma.chatSession.findFirst({
    where: { userId: wallet, modelId: input.modelId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!row) return { session: null, messages: [] }

  return {
    session: {
      id: row.id,
      modelId: row.modelId,
      modelSlug: row.modelSlug,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    messages: row.messages.map(serializeMessage),
  }
}

export async function getChatSession(input: {
  sessionId: string
  walletAddress: string
}): Promise<{
  session: StoredChatSession | null
  messages: StoredChatMessage[]
}> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return { session: null, messages: [] }

  const row = await prisma.chatSession.findFirst({
    where: { id: input.sessionId, userId: wallet },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!row) return { session: null, messages: [] }

  return {
    session: {
      id: row.id,
      modelId: row.modelId,
      modelSlug: row.modelSlug,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    messages: row.messages.map(serializeMessage),
  }
}

export async function createChatSession(input: {
  walletAddress: string
  modelId: string
  modelSlug?: string
  title?: string
}): Promise<StoredChatSession> {
  const user = await ensureUser(input.walletAddress)
  const row = await prisma.chatSession.create({
    data: {
      userId: user.id,
      modelId: input.modelId,
      modelSlug: input.modelSlug ?? null,
      title: input.title ?? null,
    },
  })
  return {
    id: row.id,
    modelId: row.modelId,
    modelSlug: row.modelSlug,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function appendChatMessages(input: {
  sessionId: string
  walletAddress: string
  messages: Array<{
    id?: string
    role: string
    content: string
    attachments?: StoredAttachment[]
    reasoning?: string
    modelId?: string
    costUsdc?: number
    provider?: string
    error?: boolean
  }>
}): Promise<StoredChatMessage[]> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) throw new Error('Invalid wallet address')

  const session = await prisma.chatSession.findFirst({
    where: { id: input.sessionId, userId: wallet },
  })
  if (!session) throw new Error('Chat session not found')

  const created = await prisma.$transaction(async (tx) => {
    const out = []
    for (const m of input.messages) {
      const row = await tx.chatMessage.create({
        data: {
          id: m.id,
          sessionId: session.id,
          role: m.role,
          content: m.content,
          attachments: m.attachments
            ? (m.attachments as object[])
            : undefined,
          reasoning: m.reasoning ?? null,
          modelId: m.modelId ?? null,
          costUsdc: m.costUsdc ?? null,
          provider: m.provider ?? null,
          error: m.error ?? false,
        },
      })
      out.push(row)
    }
    await tx.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    })
    return out
  })

  return created.map(serializeMessage)
}

/** Create session if needed, then append messages. */
export async function persistChatTurn(input: {
  walletAddress: string
  modelId: string
  modelSlug?: string
  sessionId?: string | null
  title?: string
  messages: Array<{
    id?: string
    role: string
    content: string
    attachments?: StoredAttachment[]
    reasoning?: string
    modelId?: string
    costUsdc?: number
    provider?: string
    error?: boolean
  }>
}): Promise<{ sessionId: string; messages: StoredChatMessage[] }> {
  let sessionId = input.sessionId ?? null

  if (sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId: normalizeWalletAddress(input.walletAddress) ?? '',
      },
    })
    if (!existing) sessionId = null
  }

  if (!sessionId) {
    const title =
      input.title ||
      input.messages.find((m) => m.role === 'user')?.content.slice(0, 80) ||
      'Chat'
    const session = await createChatSession({
      walletAddress: input.walletAddress,
      modelId: input.modelId,
      modelSlug: input.modelSlug,
      title,
    })
    sessionId = session.id
  } else if (input.title) {
    const wallet = normalizeWalletAddress(input.walletAddress)
    const existing = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: wallet ?? '' },
    })
    if (
      existing &&
      (!existing.title || existing.title === 'New chat')
    ) {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { title: input.title.slice(0, 80) },
      })
    }
  }

  const messages = await appendChatMessages({
    sessionId,
    walletAddress: input.walletAddress,
    messages: input.messages,
  })

  return { sessionId, messages }
}

export async function deleteChatSession(input: {
  sessionId: string
  walletAddress: string
}): Promise<boolean> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return false

  const result = await prisma.chatSession.deleteMany({
    where: { id: input.sessionId, userId: wallet },
  })
  return result.count > 0
}

/** Clear messages but keep session, or delete session entirely. */
export async function clearChatSession(input: {
  sessionId: string
  walletAddress: string
  deleteSession?: boolean
}): Promise<boolean> {
  if (input.deleteSession) {
    return deleteChatSession(input)
  }

  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return false

  const session = await prisma.chatSession.findFirst({
    where: { id: input.sessionId, userId: wallet },
  })
  if (!session) return false

  await prisma.chatMessage.deleteMany({ where: { sessionId: session.id } })
  await prisma.chatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date(), title: null },
  })
  return true
}

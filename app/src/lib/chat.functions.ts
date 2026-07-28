import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type { StoredAttachment } from '#/lib/chat-attachments'
import {
  clearChatSession,
  createChatSession,
  getChatSession,
  getLatestChatSession,
  listChatSessions,
  persistChatTurn,
} from '#/lib/chat-store'
import { normalizeWalletAddress } from '#/lib/wallet-address'

const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  mimeType: z.string().optional(),
  size: z.number(),
  kind: z.enum(['image', 'text']),
  url: z.string().optional(),
  storagePath: z.string().optional(),
  textContent: z.string().optional(),
})

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  attachments: z.array(attachmentSchema).optional(),
  reasoning: z.string().optional(),
  modelId: z.string().optional(),
  costUsdc: z.number().optional(),
  provider: z.string().optional(),
  error: z.boolean().optional(),
})

export const fetchLatestChat = createServerFn({ method: 'GET' })
  .validator((data: unknown) =>
    z
      .object({
        walletAddress: z.string(),
        modelId: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const wallet = normalizeWalletAddress(data.walletAddress)
    if (!wallet) return { session: null, messages: [] }
    return getLatestChatSession({
      walletAddress: wallet,
      modelId: data.modelId,
    })
  })

export const fetchChatSessions = createServerFn({ method: 'GET' })
  .validator((data: unknown) =>
    z
      .object({
        walletAddress: z.string(),
        modelId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const wallet = normalizeWalletAddress(data.walletAddress)
    if (!wallet) return { sessions: [] }
    const sessions = await listChatSessions({
      walletAddress: wallet,
      modelId: data.modelId,
    })
    return { sessions }
  })

export const fetchChatSession = createServerFn({ method: 'GET' })
  .validator((data: unknown) =>
    z
      .object({
        walletAddress: z.string(),
        sessionId: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const wallet = normalizeWalletAddress(data.walletAddress)
    if (!wallet) return { session: null, messages: [] }
    return getChatSession({
      sessionId: data.sessionId,
      walletAddress: wallet,
    })
  })

export const createChatSessionFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        walletAddress: z.string(),
        modelId: z.string(),
        modelSlug: z.string().optional(),
        title: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const wallet = normalizeWalletAddress(data.walletAddress)
    if (!wallet) throw new Error('Wallet required')
    return createChatSession({
      walletAddress: wallet,
      modelId: data.modelId,
      modelSlug: data.modelSlug,
      title: data.title ?? 'New chat',
    })
  })

export const saveChatTurn = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        walletAddress: z.string(),
        modelId: z.string(),
        modelSlug: z.string().optional(),
        sessionId: z.string().nullable().optional(),
        title: z.string().optional(),
        messages: z.array(messageSchema).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const wallet = normalizeWalletAddress(data.walletAddress)
    if (!wallet) throw new Error('Wallet required')

    return persistChatTurn({
      walletAddress: wallet,
      modelId: data.modelId,
      modelSlug: data.modelSlug,
      sessionId: data.sessionId,
      title: data.title,
      messages: data.messages.map(
        (m): {
          id?: string
          role: string
          content: string
          attachments?: StoredAttachment[]
          reasoning?: string
          modelId?: string
          costUsdc?: number
          provider?: string
          error?: boolean
        } => ({
          id: m.id,
          role: m.role,
          content: m.content,
          attachments: m.attachments,
          reasoning: m.reasoning,
          modelId: m.modelId,
          costUsdc: m.costUsdc,
          provider: m.provider,
          error: m.error,
        }),
      ),
    })
  })

export const clearChatHistory = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        walletAddress: z.string(),
        sessionId: z.string(),
        deleteSession: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const wallet = normalizeWalletAddress(data.walletAddress)
    if (!wallet) return { ok: false }
    const ok = await clearChatSession({
      sessionId: data.sessionId,
      walletAddress: wallet,
      deleteSession: data.deleteSession ?? true,
    })
    return { ok }
  })

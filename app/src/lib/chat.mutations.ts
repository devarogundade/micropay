import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { StoredAttachment } from '#/lib/chat-attachments'
import {
  clearChatHistory,
  createChatSessionFn,
  saveChatTurn,
} from '#/lib/chat.functions'
import {
  invalidateChatQueries,
  invalidateUsageQueries,
} from '#/lib/query-invalidation'

type CreateChatSessionInput = {
  walletAddress: string
  modelId: string
  modelSlug?: string
  title?: string
}

type SaveChatTurnInput = {
  walletAddress: string
  modelId: string
  modelSlug?: string
  sessionId?: string | null
  title?: string
  messages: Array<{
    id?: string
    role: 'user' | 'assistant' | 'system'
    content: string
    attachments?: StoredAttachment[]
    reasoning?: string
    modelId?: string
    costUsdc?: number
    provider?: string
    error?: boolean
  }>
}

type ClearChatHistoryInput = {
  walletAddress: string
  sessionId: string
  deleteSession?: boolean
  /** Used only for targeted session-list invalidation. */
  modelId?: string
}

export function useCreateChatSessionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateChatSessionInput) =>
      createChatSessionFn({ data }),
    onSuccess: async (_session, vars) => {
      await invalidateChatQueries(queryClient, {
        wallet: vars.walletAddress,
        modelId: vars.modelId,
      })
    },
  })
}

export function useSaveChatTurnMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SaveChatTurnInput) => saveChatTurn({ data }),
    onSuccess: async (result, vars) => {
      await Promise.all([
        invalidateChatQueries(queryClient, {
          wallet: vars.walletAddress,
          modelId: vars.modelId,
          sessionId: result.sessionId,
        }),
        // Paid chat completion also records activity + model usage server-side.
        invalidateUsageQueries(queryClient, vars.walletAddress),
      ])
    },
  })
}

export function useClearChatHistoryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ modelId: _modelId, ...data }: ClearChatHistoryInput) =>
      clearChatHistory({ data }),
    onSuccess: async (_ok, vars) => {
      await invalidateChatQueries(queryClient, {
        wallet: vars.walletAddress,
        modelId: vars.modelId,
        sessionId: vars.sessionId,
      })
    },
  })
}

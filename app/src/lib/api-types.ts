import type { StoredAttachment } from '#/lib/chat-attachments'

export type ActivityStatus = 'settled' | 'verified' | 'failed'

export type Activity = {
  id: string
  modelSlug: string
  modelName: string
  type: string
  costUsdc: number
  status: ActivityStatus
  txId: string
  createdAt: string
  walletAddress?: string | null
  requestId?: string | null
  provider?: string | null
  tokensIn?: number | null
  tokensOut?: number | null
}

export type UserStats = {
  totalSpendUsdc: number
  todaySpendUsdc: number
  totalRequests: number
  settledRequests: number
  dailyCreditAllowanceUsdc: number
  dailyCreditUsedUsdc: number
  dailyCreditRemainingUsdc: number
  creditResetsAt: string
  byType: Array<{ type: string; count: number; spendUsdc: number }>
}

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

export type StoredChatSession = {
  id: string
  modelId: string
  modelSlug: string | null
  title: string | null
  createdAt: string
  updatedAt: string
  messageCount?: number
}

export type RouterModel = {
  id: string
  owned_by?: string
  name?: string
  description?: string
  type?: string
  context_length?: number
  architecture?: { input_modalities?: string[] }
  supported_parameters?: string[]
  supported_formats?: string[]
  pricing_usd?: { prompt?: string; completion?: string; image?: string }
  verifiability?: string
  tee_attested?: boolean
  provider_count?: number
  price_usdc?: number
}

/**
 * Shared TanStack Query keys. Keep call sites and invalidation in sync via these helpers.
 * Always normalize wallet to `string | null` so query keys match invalidation.
 */
export const queryKeys = {
  activitiesRoot: ['activities'] as const,
  activities: (
    wallet: string | null | undefined,
    status: string,
    type: string,
  ) => ['activities', wallet ?? null, status, type] as const,

  userStatsRoot: ['user-stats'] as const,
  userStats: (wallet: string | null | undefined) =>
    ['user-stats', wallet ?? null] as const,

  recentlyUsedModelsRoot: ['recently-used-models'] as const,
  recentlyUsedModels: (wallet: string | null | undefined) =>
    ['recently-used-models', wallet ?? null] as const,

  modelsCatalog: ['models-catalog'] as const,
  toolsCapabilities: ['tools-capabilities'] as const,

  chat: {
    all: ['chat'] as const,
    sessions: (wallet: string | null | undefined, modelId?: string) =>
      ['chat', 'sessions', wallet ?? null, modelId ?? 'all'] as const,
    session: (
      wallet: string | null | undefined,
      sessionId: string | null | undefined,
    ) => ['chat', 'session', wallet ?? null, sessionId ?? null] as const,
  },

  agents: {
    all: ['agents'] as const,
    list: (query: Record<string, unknown> | undefined) =>
      ['agents', 'list', query ?? null] as const,
    detail: (slug: string | null | undefined) =>
      ['agents', 'detail', slug ?? null] as const,
    mine: (wallet: string | null | undefined) =>
      ['agents', 'mine', wallet ?? null] as const,
    balance: (wallet: string | null | undefined) =>
      ['agents', 'balance', wallet ?? null] as const,
    payments: (wallet: string | null | undefined) =>
      ['agents', 'payments', wallet ?? null] as const,
    withdrawals: (wallet: string | null | undefined) =>
      ['agents', 'withdrawals', wallet ?? null] as const,
  },
}

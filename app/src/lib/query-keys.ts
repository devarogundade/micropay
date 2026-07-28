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

  chat: {
    all: ['chat'] as const,
    sessions: (wallet: string | null | undefined, modelId?: string) =>
      ['chat', 'sessions', wallet ?? null, modelId ?? 'all'] as const,
    session: (
      wallet: string | null | undefined,
      sessionId: string | null | undefined,
    ) => ['chat', 'session', wallet ?? null, sessionId ?? null] as const,
  },
}

/**
 * Shared TanStack Query keys for the IDE SPA.
 */
export const queryKeys = {
  activitiesRoot: ['activities'] as const,
  userStatsRoot: ['user-stats'] as const,
  recentlyUsedModelsRoot: ['recently-used-models'] as const,
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

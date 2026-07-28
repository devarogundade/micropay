import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '#/lib/query-keys'

/**
 * Activities list, header spend stats, and recently-used models.
 * Uses root prefixes + refetchType 'all' so inactive queries (e.g. header
 * unmounted on model workspace) still refresh before the user navigates back.
 */
export async function invalidateUsageQueries(
  queryClient: QueryClient,
  _wallet?: string | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.activitiesRoot,
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.userStatsRoot,
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.recentlyUsedModelsRoot,
      refetchType: 'all',
    }),
  ])
}

/** Chat session list and optional single-session detail. */
export async function invalidateChatQueries(
  queryClient: QueryClient,
  opts?: {
    wallet?: string | null
    modelId?: string
    sessionId?: string | null
  },
) {
  const tasks: Array<Promise<unknown>> = []

  if (opts?.wallet && opts.modelId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.sessions(opts.wallet, opts.modelId),
      }),
    )
  } else if (opts?.wallet) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: ['chat', 'sessions', opts.wallet],
      }),
    )
  } else {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all }),
    )
  }

  if (opts?.sessionId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.session(opts.wallet, opts.sessionId),
      }),
    )
  }

  await Promise.all(tasks)
}

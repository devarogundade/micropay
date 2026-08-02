import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '#/lib/query-keys'

export async function invalidateUsageQueries(
  queryClient: QueryClient,
  wallet?: string | null,
) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.userStats(wallet) })
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

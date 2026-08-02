import type { QueryClient } from '@tanstack/react-query'

import { fetchModelsCatalog } from '#/lib/models-catalog.functions'
import { queryKeys } from '#/lib/query-keys'

/** Browser catalog cache window. */
export const MODELS_CATALOG_STALE_MS = 60_000

export function ensureModelsCatalog(queryClient: QueryClient) {
  return queryClient.ensureQueryData({
    queryKey: queryKeys.modelsCatalog,
    queryFn: async () => {
      try {
        return await fetchModelsCatalog()
      } catch (err) {
        console.error('[models] catalog loader failed', err)
        return {
          models: [],
          source: 'router' as const,
          error:
            err instanceof Error ? err.message : 'Failed to load model catalog',
        }
      }
    },
    staleTime: MODELS_CATALOG_STALE_MS,
  })
}

import type { QueryClient } from '@tanstack/react-query'

import { fetchModelsCatalog } from '#/lib/models.functions'
import { queryKeys } from '#/lib/query-keys'

/** Client+SSR catalog cache window — aligns with server `listRouterModels` TTL. */
export const MODELS_CATALOG_STALE_MS = 60_000

export function ensureModelsCatalog(queryClient: QueryClient) {
  return queryClient.ensureQueryData({
    queryKey: queryKeys.modelsCatalog,
    queryFn: () => fetchModelsCatalog(),
    staleTime: MODELS_CATALOG_STALE_MS,
  })
}

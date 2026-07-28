import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { getContext } from './integrations/tanstack-query/root-provider'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Keep intent-preloaded loader data warm so click doesn't re-fetch.
    // (0 made preload: 'intent' a no-op — every navigation re-ran loaders.)
    defaultPreloadStaleTime: 30_000,
    defaultStaleTime: 30_000,
    // Don't hold pending UI after data arrives (default min was 500ms).
    defaultPendingMinMs: 0,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

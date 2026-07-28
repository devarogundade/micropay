import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Monitor } from 'lucide-react'

import { BrandMark } from '#/components/brand'
import { PuyaTsIde } from '#/components/puya-ts/puya-ts-ide'
import { Button } from '#/components/ui/button'
import { ErrorState } from '#/components/ui/error-state'
import { EmptyState } from '#/components/ui/empty-state'
import {
  MODELS_CATALOG_STALE_MS,
  ensureModelsCatalog,
} from '#/lib/models-catalog-query'
import { getCodeOrigin } from '#/lib/site-meta'
import { LG_MEDIA_QUERY, useMediaQuery } from '#/lib/use-media-query'

function externalCodeUrl(): string | null {
  const fromEnv =
    (typeof import.meta !== 'undefined' &&
      (import.meta.env?.VITE_PUBLIC_CODE_URL as string | undefined)?.replace(
        /\/$/,
        '',
      )) ||
    ''
  const origin = fromEnv || getCodeOrigin() || ''
  return origin || null
}

export const Route = createFileRoute('/_shell/ide')({
  beforeLoad: () => {
    const code = externalCodeUrl()
    if (code) {
      throw redirect({ href: `${code}/` })
    }
  },
  loader: ({ context: { queryClient } }) => ensureModelsCatalog(queryClient),
  staleTime: MODELS_CATALOG_STALE_MS,
  preloadStaleTime: MODELS_CATALOG_STALE_MS,
  component: PuyaTsIdePage,
  head: () => ({
    meta: [
      { title: 'IDE · Micropay' },
      {
        name: 'description',
        content:
          'AI-assisted Algorand TypeScript IDE — edit, compile, chat, and deploy.',
      },
    ],
  }),
})

function IdeDesktopOnly() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-void">
      <div className="workspace-bar flex shrink-0 items-center gap-3 border-b border-border bg-carbon px-4">
        <Link to="/models" className="shrink-0 no-underline">
          <BrandMark size="sm" />
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12">
        <EmptyState
          icon={Monitor}
          title="Desktop only"
          description="The IDE needs a larger screen (about 1024px wide or more). Open it on a desktop or widen your browser window."
          action={
            <Button asChild variant="outline">
              <Link to="/models">Back to models</Link>
            </Button>
          }
        />
      </div>
    </div>
  )
}

function PuyaTsIdePage() {
  const catalog = Route.useLoaderData()
  const isLargeScreen = useMediaQuery(LG_MEDIA_QUERY)
  const models = catalog.models.filter((m) => m.type === 'Chat')

  if (isLargeScreen === null) {
    return <div className="h-full min-h-0 bg-void" aria-hidden />
  }

  if (!isLargeScreen) {
    return <IdeDesktopOnly />
  }

  if (catalog.error && models.length === 0) {
    return (
      <div className="p-6">
        <ErrorState
          title="Models unavailable"
          description={catalog.error}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No chat models available"
          description="The IDE needs chat models for the AI assistant."
        />
      </div>
    )
  }

  return <PuyaTsIde models={catalog.models} />
}

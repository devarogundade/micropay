import { Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'

import { BrandMark } from '#/components/brand'
import { PuyaTsIde } from '#/components/puya-ts/puya-ts-ide'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/ui/empty-state'
import { ErrorState } from '#/components/ui/error-state'
import { getAppUrl, getSiteUrl } from '#/lib/api-url'
import {
  fetchModelsCatalog,
  type ModelsCatalog,
} from '#/lib/models-catalog'
import { LG_MEDIA_QUERY, useMediaQuery } from '#/lib/use-media-query'

function IdeDesktopOnly() {
  const site = getSiteUrl()
  const app = getAppUrl()
  return (
    <div className="flex h-svh min-h-0 flex-col bg-void">
      <div className="workspace-bar flex shrink-0 items-center justify-between gap-3 border-b border-border bg-carbon px-4">
        <a href={site} className="shrink-0 no-underline">
          <BrandMark size="sm" />
        </a>
        <a
          href={app}
          className="text-sm text-fog transition-colors hover:text-paper"
        >
          App
        </a>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12">
        <EmptyState
          icon={Monitor}
          title="Desktop only"
          description="The IDE needs a larger screen (about 1024px wide or more). Open it on a desktop or widen your browser window."
          action={
            <Button asChild variant="outline">
              <a href={site}>Back to site</a>
            </Button>
          }
        />
      </div>
    </div>
  )
}

export function IdeApp() {
  const isLargeScreen = useMediaQuery(LG_MEDIA_QUERY)
  const [catalog, setCatalog] = useState<ModelsCatalog | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchModelsCatalog().then((next) => {
      if (!cancelled) setCatalog(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (isLargeScreen === null || catalog === null) {
    return <div className="h-svh min-h-0 bg-void" aria-hidden />
  }

  if (!isLargeScreen) {
    return <IdeDesktopOnly />
  }

  const models = catalog.models.filter((m) => m.type === 'Chat')

  if (catalog.error && models.length === 0) {
    return (
      <div className="flex h-svh items-center justify-center p-6">
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
      <div className="flex h-svh items-center justify-center p-6">
        <EmptyState
          title="No chat models available"
          description="The IDE needs chat models for the AI assistant."
        />
      </div>
    )
  }

  return (
    <div className="h-svh min-h-0 overflow-hidden">
      <PuyaTsIde models={catalog.models} />
    </div>
  )
}

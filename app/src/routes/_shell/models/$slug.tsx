import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { ModelWorkspace } from '#/components/models/model-workspace'
import { Button } from '#/components/ui/button'
import {
  MODELS_CATALOG_STALE_MS,
  ensureModelsCatalog,
} from '#/lib/models-catalog-query'

export const Route = createFileRoute('/_shell/models/$slug')({
  loader: async ({ context: { queryClient }, params }) => {
    const catalog = await ensureModelsCatalog(queryClient)
    return (
      catalog.models.find(
        (m) => m.slug === params.slug || m.routerId === params.slug,
      ) ?? null
    )
  },
  staleTime: MODELS_CATALOG_STALE_MS,
  preloadStaleTime: MODELS_CATALOG_STALE_MS,
  component: ModelDetailPage,
})

function ModelDetailPage() {
  const model = Route.useLoaderData()

  if (!model) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-start justify-center px-4 py-16">
        <h1 className="text-xl font-semibold text-paper">Model not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That model isn’t available. Pick another from the list.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/models">
            <ArrowLeft className="size-4" />
            Back to models
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0">
      <ModelWorkspace model={model} />
    </div>
  )
}

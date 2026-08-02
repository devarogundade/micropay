import type { Model } from '#/data/models'
import { apiUrl } from '#/lib/api-url'
import type { RouterModel } from '#/lib/api-types'
import { routerModelToUi } from '#/lib/model-catalog'

export type CatalogResult = {
  models: Model[]
  source: 'router'
  error?: string
}

export async function fetchModelsCatalog(): Promise<CatalogResult> {
  const response = await fetch(apiUrl('/api/v1/models'), {
    headers: { Accept: 'application/json' },
  })
  const body = (await response.json().catch(() => null)) as {
    data?: RouterModel[]
    error?: { message?: string }
  } | null
  if (!response.ok) {
    throw new Error(body?.error?.message || `Model catalog failed (${response.status})`)
  }
  return {
    models: (Array.isArray(body?.data) ? body.data : []).map(routerModelToUi),
    source: 'router',
  }
}

export async function fetchModelBySlug(slug: string): Promise<Model | null> {
  const catalog = await fetchModelsCatalog()
  return catalog.models.find((model) => model.slug === slug || model.routerId === slug) ?? null
}

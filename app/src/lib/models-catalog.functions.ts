/**
 * Models catalog — prefers Nest `/api/v1/models`, falls back to local zg-catalog
 * when Nest is unreachable (dev without backend).
 */

import { createServerFn } from '@tanstack/react-start'

import {
  getCatalogModel,
  getCatalogModels,
  routerModelToUi,
  type CatalogResult,
} from '#/lib/zg-catalog'
import type { RouterModel } from '#/lib/zg-router'

function nestOrigin(): string {
  return (
    process.env.NEST_API_URL?.replace(/\/$/, '') ||
    process.env.VITE_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'http://localhost:4000'
  )
}

async function fetchCatalogFromNest(): Promise<CatalogResult | null> {
  try {
    const res = await fetch(`${nestOrigin()}/api/v1/models`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const raw = (await res.json().catch(() => null)) as {
      data?: Array<RouterModel & { price_usdc?: number }>
    } | null
    const list = Array.isArray(raw?.data) ? raw.data : null
    if (!list) return null
    return {
      models: list.map((rm) => {
        const ui = routerModelToUi(rm)
        if (typeof rm.price_usdc === 'number' && rm.price_usdc > 0) {
          ui.priceUsdc = rm.price_usdc
        }
        return ui
      }),
      source: 'router',
    }
  } catch {
    return null
  }
}

/** Catalog-only server fns — prefer Nest; soft-fallback to in-process zg-catalog. */
export const fetchModelsCatalog = createServerFn({ method: 'GET' }).handler(
  async () => {
    const fromNest = await fetchCatalogFromNest()
    if (fromNest) return fromNest
    return getCatalogModels()
  },
)

export const fetchModelBySlug = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const fromNest = await fetchCatalogFromNest()
    if (fromNest) {
      return fromNest.models.find((m) => m.slug === slug) ?? null
    }
    const model = await getCatalogModel(slug)
    return model ?? null
  })

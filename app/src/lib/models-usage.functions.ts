/**
 * Recently used models — Nest `/api/v1/models/recent` + catalog join (no Prisma).
 */

import { apiUrl } from '#/lib/api-url'
import { normalizeWalletAddress } from '#/lib/wallet-address'
import type { Model } from '#/data/models'
import { routerModelToUi } from '#/lib/zg-catalog'
import type { RouterModel } from '#/lib/zg-router'

export type ModelUsageRow = {
  modelSlug: string
  modelName: string | null
  lastUsedAt: string
  useCount: number
}

function nestOrigin(): string {
  return (
    (typeof process !== 'undefined' &&
      (process.env.VITE_PUBLIC_API_URL || process.env.NEST_API_URL)?.replace(
        /\/$/,
        '',
      )) ||
    apiUrl('').replace(/\/$/, '') ||
    'http://localhost:4000'
  )
}

async function fetchCatalogModels(): Promise<Model[]> {
  try {
    const res = await fetch(`${nestOrigin()}/api/v1/models`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const raw = (await res.json()) as {
      data?: Array<RouterModel & { price_usdc?: number }>
    }
    const list = Array.isArray(raw.data) ? raw.data : []
    return list.map((rm) => {
      const ui = routerModelToUi(rm)
      if (typeof rm.price_usdc === 'number' && rm.price_usdc > 0) {
        ui.priceUsdc = rm.price_usdc
      }
      return ui
    })
  } catch {
    return []
  }
}

export async function fetchRecentlyUsedModels(input: {
  data?: { walletAddress?: string; limit?: number }
}): Promise<{ usage: ModelUsageRow[]; models: Model[] }> {
  const empty = { usage: [] as ModelUsageRow[], models: [] as Model[] }
  const wallet = normalizeWalletAddress(input.data?.walletAddress)
  if (!wallet) return empty

  const qs = new URLSearchParams()
  if (input.data?.limit) qs.set('limit', String(input.data.limit))
  const res = await fetch(
    apiUrl(`/api/v1/models/recent${qs.toString() ? `?${qs}` : ''}`),
    { headers: { 'X-Wallet-Address': wallet } },
  )
  if (!res.ok) return empty
  const raw = (await res.json()) as { usage?: ModelUsageRow[] }
  const usage = Array.isArray(raw.usage) ? raw.usage : []
  if (!usage.length) return { ...empty, usage }

  const catalog = await fetchCatalogModels()
  const bySlug = new Map<string, Model>()
  for (const m of catalog) {
    bySlug.set(m.slug, m)
    if (m.routerId) bySlug.set(m.routerId, m)
  }
  const models = usage
    .map((u) => bySlug.get(u.modelSlug))
    .filter((m): m is Model => Boolean(m))

  return { models, usage }
}

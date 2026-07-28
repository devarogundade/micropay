import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { listRecentModelUsage } from '#/lib/model-usage-store'
import { normalizeWalletAddress } from '#/lib/wallet-address'
import { getCatalogModel, getCatalogModels } from '#/lib/zg-catalog'

export const fetchModelsCatalog = createServerFn({ method: 'GET' }).handler(
  async () => getCatalogModels(),
)

export const fetchModelBySlug = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const model = await getCatalogModel(slug)
    return model ?? null
  })

export const fetchRecentlyUsedModels = createServerFn({ method: 'GET' })
  .validator((data: unknown) =>
    z
      .object({
        walletAddress: z.string().optional(),
        limit: z.number().int().min(1).max(40).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const empty = {
      models: [] as Awaited<ReturnType<typeof getCatalogModels>>['models'],
      usage: [] as Awaited<ReturnType<typeof listRecentModelUsage>>,
    }
    const wallet = normalizeWalletAddress(data.walletAddress)
    if (!wallet) return empty

    try {
      const usage = await listRecentModelUsage({
        walletAddress: wallet,
        limit: data.limit ?? 5,
      })
      if (!usage.length) return { ...empty, usage }

      const catalog = await getCatalogModels()
      const bySlug = new Map(catalog.models.map((m) => [m.slug, m]))
      for (const m of catalog.models) {
        if (m.routerId) bySlug.set(m.routerId, m)
      }

      const models = usage
        .map((u) => bySlug.get(u.modelSlug))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))

      return { models, usage }
    } catch (err) {
      console.error('[models] recently used unavailable', err)
      return empty
    }
  })

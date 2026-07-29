import { createServerFn } from '@tanstack/react-start'

import { getCatalogModel, getCatalogModels } from '#/lib/zg-catalog'

/** Catalog-only server fns — no Prisma imports (safe for SSR home loader). */
export const fetchModelsCatalog = createServerFn({ method: 'GET' }).handler(
  async () => getCatalogModels(),
)

export const fetchModelBySlug = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const model = await getCatalogModel(slug)
    return model ?? null
  })

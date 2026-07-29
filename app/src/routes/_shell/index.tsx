import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { FreeMode, Navigation } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'

import { ModelCard } from '#/components/models/model-card'
import { ProviderIcon } from '#/components/models/provider-icon'
import { EmptyState } from '#/components/ui/empty-state'
import { ErrorState } from '#/components/ui/error-state'
import { LoadingState, SkeletonLines } from '#/components/ui/loading-state'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { type ModelType } from '#/data/models'
import {
  MODELS_CATALOG_STALE_MS,
  ensureModelsCatalog,
} from '#/lib/models-catalog-query'
import { fetchRecentlyUsedModels } from '#/lib/models-usage.functions'
import { queryKeys } from '#/lib/query-keys'
import { useClientGsap } from '#/lib/use-client-gsap'
import { cn } from '#/lib/utils'
import { useWallet } from '#/lib/wallet'

import 'swiper/css'
import 'swiper/css/navigation'

export const Route = createFileRoute('/_shell/')({
  loader: async ({ context: { queryClient } }) => {
    try {
      return await ensureModelsCatalog(queryClient)
    } catch (err) {
      console.error('[models] route loader failed', err)
      return {
        models: [],
        source: 'router' as const,
        error:
          err instanceof Error ? err.message : 'Failed to load model catalog',
      }
    }
  },
  staleTime: MODELS_CATALOG_STALE_MS,
  preloadStaleTime: MODELS_CATALOG_STALE_MS,
  component: ModelsPage,
})

type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'name'

function ModelsPage() {
  const catalog = Route.useLoaderData()
  const MODELS = catalog?.models ?? []
  const { account } = useWallet()
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | ModelType>('all')
  const [provider, setProvider] = useState<'all' | string>('all')
  const [sort, setSort] = useState<SortKey>('recommended')
  const root = useRef<HTMLDivElement>(null)

  const recentQuery = useQuery({
    queryKey: queryKeys.recentlyUsedModels(account?.address ?? null),
    queryFn: () =>
      fetchRecentlyUsedModels({
        data: { walletAddress: account?.address, limit: 5 },
      }),
    enabled: Boolean(account?.address),
    staleTime: 15_000,
    refetchOnMount: 'always',
  })

  useClientGsap(root, (gsap) => {
    gsap.from('.models-hero', {
      y: 10,
      opacity: 0,
      duration: 0.28,
      ease: 'power2.out',
    })
    gsap.from('.models-strip', {
      opacity: 0,
      y: 8,
      duration: 0.3,
      delay: 0.04,
      ease: 'power2.out',
    })
  })

  const providers = useMemo(() => {
    const map = new Map<string, { label: string; logoSrc: string }>()
    for (const m of MODELS) {
      if (!map.has(m.provider)) {
        map.set(m.provider, { label: m.provider, logoSrc: m.logoSrc })
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [MODELS])

  const filtered = useMemo(() => {
    let list = MODELS.filter((m) => {
      const matchesQ =
        !q ||
        m.name.toLowerCase().includes(q.toLowerCase()) ||
        m.provider.toLowerCase().includes(q.toLowerCase()) ||
        m.description.toLowerCase().includes(q.toLowerCase()) ||
        m.slug.toLowerCase().includes(q.toLowerCase())
      const matchesType = type === 'all' || m.type === type
      const matchesProvider = provider === 'all' || m.provider === provider
      return matchesQ && matchesType && matchesProvider
    })
    list = [...list].sort((a, b) => {
      if (sort === 'price-asc') return a.priceUsdc - b.priceUsdc
      if (sort === 'price-desc') return b.priceUsdc - a.priceUsdc
      if (sort === 'name') return a.name.localeCompare(b.name)
      return Number(b.recommended) - Number(a.recommended)
    })
    return list
  }, [MODELS, q, type, provider, sort])

  const recentlyUsed = recentQuery.data?.models ?? []
  const showRecentStrip = !q && type === 'all' && provider === 'all'

  return (
    <div ref={root}>
      <div className="models-hero flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-paper sm:text-2xl">
            Models
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a model. Pay with your wallet only when you use it.
          </p>
          {catalog.error ? (
            <p className="mt-2 text-xs text-destructive">
              Couldn’t load models: {catalog.error}
            </p>
          ) : MODELS.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {MODELS.length} models ready to try
            </p>
          ) : null}
        </div>
      </div>

      {MODELS.length === 0 ? (
        catalog.error ? (
          <ErrorState
            className="mt-10"
            title="Couldn’t load models"
            description={catalog.error}
            onRetry={() => window.location.reload()}
          />
        ) : (
          <EmptyState
            className="mt-10"
            title="No models right now"
            description="Check back in a moment, or refresh the page."
          />
        )
      ) : null}

      {showRecentStrip ? (
        <section className="models-strip mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recently Used
            </h2>
          </div>
          {!account ? (
            <EmptyState
              compact
              title="Connect a wallet"
              description="Connect a wallet to see models you’ve used lately."
            />
          ) : recentQuery.isLoading ? (
            <div className="rounded-xl border border-border bg-carbon/60 p-4">
              <LoadingState compact label="Loading recent models…" />
              <SkeletonLines className="mt-3" lines={2} />
            </div>
          ) : recentlyUsed.length === 0 ? (
            <EmptyState
              compact
              title="Nothing here yet"
              description="Use a model from the list below — it’ll show up here next time."
            />
          ) : (
            <Swiper
              modules={[FreeMode, Navigation]}
              freeMode
              navigation
              spaceBetween={12}
              slidesPerView={1.15}
              breakpoints={{
                640: { slidesPerView: 2.1 },
                1024: { slidesPerView: 3.1 },
              }}
              className="models-carousel !overflow-visible"
            >
              {recentlyUsed.map((m) => (
                <SwiperSlide key={m.slug} className="!h-auto">
                  <ModelCard model={m} />
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </section>
      ) : null}

      <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search models…"
            className="h-11 pl-9 sm:h-9"
          />
        </div>
        <Select
          value={type}
          onValueChange={(v) => setType(v as 'all' | ModelType)}
        >
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-40" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Chat">Chat</SelectItem>
            <SelectItem value="Image Gen">Image Gen</SelectItem>
            <SelectItem value="Audio">Audio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-44" aria-label="Sort models">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="price-asc">Price ↑</SelectItem>
            <SelectItem value="price-desc">Price ↓</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {providers.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setProvider('all')}
            className={cn(
              'inline-flex h-8 items-center rounded-md border px-2.5 text-xs transition-colors',
              provider === 'all'
                ? 'border-smoke bg-card text-paper'
                : 'border-border bg-transparent text-muted-foreground hover:border-smoke hover:text-paper',
            )}
          >
            All
          </button>
          {providers.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setProvider(p.label)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors',
                provider === p.label
                  ? 'border-smoke bg-card text-paper'
                  : 'border-border bg-transparent text-muted-foreground hover:border-smoke hover:text-paper',
              )}
            >
              <ProviderIcon
                src={p.logoSrc}
                size="sm"
                className="size-5 border-0 shadow-none"
              />
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {q || type !== 'all' || provider !== 'all' ? 'Results' : 'All models'}
          <span className="ml-2 font-normal normal-case tracking-normal">
            ({filtered.length})
          </span>
        </h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {filtered.map((m) => (
            <ModelCard key={m.slug} model={m} />
          ))}
        </div>
        {filtered.length === 0 && MODELS.length > 0 ? (
          <EmptyState
            className="mt-8"
            title="No matches"
            description="Try a different search or clear the filters."
          />
        ) : null}
      </section>
    </div>
  )
}

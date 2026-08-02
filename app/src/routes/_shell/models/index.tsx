import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { type Model, type ModelType } from '#/data/models'
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

export const Route = createFileRoute('/_shell/models/')({
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
  const [sort, setSort] = useState<SortKey>('recommended')
  const root = useRef<HTMLDivElement>(null)

  const recentQuery = useQuery({
    queryKey: queryKeys.recentlyUsedModels(account?.address ?? null),
    queryFn: () =>
      fetchRecentlyUsedModels({
        data: { walletAddress: account?.address, limit: 8 },
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
    gsap.from('.models-brand-row', {
      opacity: 0,
      y: 8,
      duration: 0.3,
      stagger: 0.04,
      delay: 0.04,
      ease: 'power2.out',
    })
  })

  const filtered = useMemo(() => {
    let list = MODELS.filter((m) => {
      const matchesQ =
        !q ||
        m.name.toLowerCase().includes(q.toLowerCase()) ||
        m.provider.toLowerCase().includes(q.toLowerCase()) ||
        m.description.toLowerCase().includes(q.toLowerCase()) ||
        m.slug.toLowerCase().includes(q.toLowerCase())
      const matchesType = type === 'all' || m.type === type
      return matchesQ && matchesType
    })
    list = [...list].sort((a, b) => {
      if (sort === 'price-asc') return a.priceUsdc - b.priceUsdc
      if (sort === 'price-desc') return b.priceUsdc - a.priceUsdc
      if (sort === 'name') return a.name.localeCompare(b.name)
      return Number(b.recommended) - Number(a.recommended)
    })
    return list
  }, [MODELS, q, type, sort])

  const brandGroups = useMemo(() => {
    const map = new Map<string, { label: string; logoSrc: string; models: Model[] }>()
    for (const m of filtered) {
      const existing = map.get(m.provider)
      if (existing) {
        existing.models.push(m)
      } else {
        map.set(m.provider, {
          label: m.provider,
          logoSrc: m.logoSrc,
          models: [m],
        })
      }
    }
    return [...map.values()].sort((a, b) => {
      const rec = (g: { models: Model[] }) =>
        g.models.filter((m) => m.recommended).length
      const d = rec(b) - rec(a)
      if (d !== 0) return d
      return a.label.localeCompare(b.label)
    })
  }, [filtered])

  const recentlyUsed = recentQuery.data?.models ?? []
  const showRecentStrip = !q && type === 'all'
  const isSearching = Boolean(q) || type !== 'all'

  return (
    <div ref={root} className="pb-8">
      <div className="models-hero flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Browse by brand. Pay with your wallet only when you use a model.
          </p>
          {catalog.error ? (
            <p className="mt-2 text-xs text-destructive">
              Couldn’t load models: {catalog.error}
            </p>
          ) : MODELS.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {MODELS.length} models · {brandGroups.length} brands
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

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
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

      {showRecentStrip ? (
        <BrandModelRow
          className="models-brand-row mt-10"
          title="Recently used"
          logoSrc={null}
          models={recentlyUsed}
          empty={
            !account ? (
              <EmptyState
                compact
                title="Connect a wallet"
                description="Connect a wallet to see models you’ve used lately."
              />
            ) : recentQuery.isLoading ? (
              <div className="rounded-2xl border border-border bg-snow/80 p-4">
                <LoadingState compact label="Loading recent models…" />
                <SkeletonLines className="mt-3" lines={2} />
              </div>
            ) : recentlyUsed.length === 0 ? (
              <EmptyState
                compact
                title="Nothing here yet"
                description="Use a model below — it’ll show up here next time."
              />
            ) : null
          }
        />
      ) : null}

      {brandGroups.length === 0 && MODELS.length > 0 ? (
        <EmptyState
          className="mt-10"
          title="No matches"
          description="Try a different search or clear the filters."
        />
      ) : null}

      {brandGroups.map((group) => (
        <BrandModelRow
          key={group.label}
          className="models-brand-row mt-10"
          title={group.label}
          logoSrc={group.logoSrc}
          models={group.models}
          countLabel={
            isSearching
              ? `${group.models.length} match${group.models.length === 1 ? '' : 'es'}`
              : undefined
          }
        />
      ))}
    </div>
  )
}

function BrandModelRow({
  title,
  logoSrc,
  models,
  className,
  empty,
  countLabel,
}: {
  title: string
  logoSrc: string | null
  models: Model[]
  className?: string
  empty?: ReactNode
  countLabel?: string
}) {
  const uid = useId().replace(/:/g, '')
  const prevClass = `brand-nav-prev-${uid}`
  const nextClass = `brand-nav-next-${uid}`

  if (empty && models.length === 0) {
    return (
      <section className={className}>
        <BrandRowHeader title={title} logoSrc={logoSrc} countLabel={countLabel} />
        <div className="mt-3">{empty}</div>
      </section>
    )
  }

  if (models.length === 0) return null

  return (
    <section className={className}>
      <BrandRowHeader
        title={title}
        logoSrc={logoSrc}
        countLabel={countLabel}
        prevClass={prevClass}
        nextClass={nextClass}
        showNav={models.length > 1}
      />
      <Swiper
        modules={[FreeMode, Navigation]}
        freeMode
        navigation={{
          prevEl: `.${prevClass}`,
          nextEl: `.${nextClass}`,
        }}
        spaceBetween={16}
        slidesPerView={1.08}
        breakpoints={{
          640: { slidesPerView: 1.45, spaceBetween: 16 },
          768: { slidesPerView: 2.1, spaceBetween: 18 },
          1024: { slidesPerView: 2.6, spaceBetween: 18 },
          1280: { slidesPerView: 3.15, spaceBetween: 20 },
        }}
        className="models-carousel brand-models-carousel mt-3 !overflow-visible"
      >
        {models.map((m) => (
          <SwiperSlide key={m.slug} className="!h-auto">
            <ModelCard model={m} size="lg" />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  )
}

function BrandRowHeader({
  title,
  logoSrc,
  countLabel,
  prevClass,
  nextClass,
  showNav,
}: {
  title: string
  logoSrc: string | null
  countLabel?: string
  prevClass?: string
  nextClass?: string
  showNav?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {logoSrc ? (
          <ProviderIcon src={logoSrc} size="sm" className="size-7 border-0 shadow-none" />
        ) : null}
        <h2 className="truncate text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {countLabel ? (
          <span className="text-xs font-normal normal-case tracking-normal text-fog">
            {countLabel}
          </span>
        ) : null}
      </div>
      {showNav && prevClass && nextClass ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className={cn(
              prevClass,
              'inline-flex size-8 items-center justify-center rounded-lg border border-border bg-snow text-ink shadow-sm transition-colors hover:bg-muted disabled:opacity-35',
            )}
            aria-label={`Previous ${title} models`}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className={cn(
              nextClass,
              'inline-flex size-8 items-center justify-center rounded-lg border border-border bg-snow text-ink shadow-sm transition-colors hover:bg-muted disabled:opacity-35',
            )}
            aria-label={`Next ${title} models`}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

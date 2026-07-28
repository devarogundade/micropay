import { useQueryClient } from '@tanstack/react-query'
import { Download, ImageIcon, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { A11y, Navigation, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide, type SwiperClass } from 'swiper/react'

import { EmptyState } from '#/components/ui/empty-state'
import { ErrorState } from '#/components/ui/error-state'
import { LoadingState } from '#/components/ui/loading-state'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { ScrollArea } from '#/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { formatUsdc, type Model } from '#/data/models'
import {
  fetchImageHistory,
  proxyImageGeneration,
  type ImageHistoryItem,
} from '#/lib/micropay-api'
import { invalidateUsageQueries } from '#/lib/query-invalidation'
import { MAX_UPLOAD_LABEL } from '#/lib/storage-limits'
import { cn } from '#/lib/utils'
import { useWallet } from '#/lib/wallet'

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

const IMAGE_SIZES = [
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '1024x768', label: '1024 × 768' },
  { value: '768x1024', label: '768 × 1024' },
  { value: '512x512', label: '512 × 512' },
] as const

function relativeTime(iso: string) {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

export function ImageStudio({
  model,
  onRequestPay,
  onBusyChange,
}: {
  model: Model
  onRequestPay: (action: () => Promise<void>) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const { account, fetchWithPay } = useWallet()
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<string>('1024x1024')
  const [gallery, setGallery] = useState<ImageHistoryItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [busy, setBusyState] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const swiperRef = useRef<SwiperClass | null>(null)

  function setBusy(next: boolean) {
    setBusyState(next)
    onBusyChange?.(next)
  }

  useEffect(() => {
    return () => onBusyChange?.(false)
  }, [onBusyChange])

  function loadHistory() {
    if (!account || !fetchWithPay) {
      setGallery([])
      setHistoryError(null)
      return
    }

    setLoadingHistory(true)
    setHistoryError(null)
    void fetchImageHistory({ fetchImpl: fetchWithPay })
      .then((res) => {
        if (!res.ok) {
          setHistoryError(res.error || 'Could not load history')
          setGallery([])
          return
        }
        setGallery(res.data)
        setActiveIndex(0)
      })
      .finally(() => {
        setLoadingHistory(false)
      })
  }

  useEffect(() => {
    if (!account || !fetchWithPay) {
      setGallery([])
      setHistoryError(null)
      return
    }

    let cancelled = false
    setLoadingHistory(true)
    setHistoryError(null)
    void fetchImageHistory({ fetchImpl: fetchWithPay })
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          setHistoryError(res.error || 'Could not load history')
          setGallery([])
          return
        }
        setGallery(res.data)
        setActiveIndex(0)
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })

    return () => {
      cancelled = true
    }
  }, [account, fetchWithPay])

  const active = gallery[activeIndex] ?? null

  function download(src: string, name?: string) {
    const a = document.createElement('a')
    a.href = src
    a.download = name || `micropay-${Date.now()}.png`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  function selectItem(index: number) {
    setActiveIndex(index)
    swiperRef.current?.slideTo(index)
  }

  function generate() {
    const p = prompt.trim()
    if (!p || busy) return
    setError(null)

    onRequestPay(async () => {
      setBusy(true)
      setStatus('Confirming payment…')
      try {
        const result = await proxyImageGeneration({
          model: model.routerId ?? model.slug,
          prompt: p,
          size,
          fetchImpl: fetchWithPay,
          onStatus: setStatus,
        })
        if (!result.ok) {
          setError(result.error || 'Image generation failed')
          toast.error(result.error || 'Image generation failed')
          return
        }

        void invalidateUsageQueries(queryClient, account?.address)

        // Reload history from DB (server persists after SSE completion).
        if (fetchWithPay) {
          const hist = await fetchImageHistory({ fetchImpl: fetchWithPay })
          if (hist.ok) {
            setGallery(hist.data)
            setActiveIndex(0)
            setHistoryError(null)
          } else {
            // Fallback: show just-returned URLs if history reload fails.
            const fallback: ImageHistoryItem[] = result.images.map(
              (src, i) => ({
                id: `local-${Date.now()}-${i}`,
                modelSlug: model.slug,
                modelName: model.name,
                prompt: p,
                size,
                url: src,
                storagePath: null,
                createdAt: new Date().toISOString(),
              }),
            )
            setGallery((g) => [...fallback, ...g])
            setActiveIndex(0)
            setHistoryError(hist.error || 'History refresh failed')
          }
        }

        toast.success(
          result.images.length > 1
            ? `${result.images.length} images ready`
            : 'Image ready',
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed'
        setError(msg)
        toast.error(msg)
      } finally {
        setBusy(false)
        setStatus(null)
      }
    })
  }

  return (
    <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-border bg-carbon lg:border-b-0 lg:border-r">
        <div className="flex h-10 shrink-0 items-center border-b border-border px-4 lg:h-[var(--app-header-height)]">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-fog">
              Studio
            </p>
            <h2 className="text-sm font-medium leading-none text-paper">
              Image generation
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <Label htmlFor="img-prompt">Prompt</Label>
            <Textarea
              id="img-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-28 bg-void"
              placeholder="Describe the image you want…"
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label>Size</Label>
            <Select value={size} onValueChange={setSize} disabled={busy}>
              <SelectTrigger className="w-full bg-void" aria-label="Image size">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={busy || !prompt.trim()}
            onClick={generate}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImageIcon className="size-4" />
            )}
            {busy
              ? status || 'Generating image…'
              : `Generate · ${formatUsdc(model.priceUsdc)}`}
          </Button>
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pay once with your wallet, then we generate and save images (max{' '}
              {MAX_UPLOAD_LABEL}). Past gens stay in History.
            </p>
          )}

          <div className="border-t border-border/70 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                History
              </p>
              {gallery.length > 0 ? (
                <span className="text-[10px] text-fog">{gallery.length}</span>
              ) : null}
            </div>

            {!account ? (
              <EmptyState
                compact
                title="Connect a wallet"
                description="Connect a wallet to save and browse past images."
              />
            ) : loadingHistory ? (
              <LoadingState compact label="Loading history…" />
            ) : historyError && gallery.length === 0 ? (
              <ErrorState
                compact
                description={historyError}
                onRetry={loadHistory}
              />
            ) : gallery.length === 0 ? (
              <EmptyState
                compact
                title="No images yet"
                description="No images yet. Generate one — it will show up here."
              />
            ) : (
              <ScrollArea className="h-[min(40vh,280px)]">
                <ul className="space-y-1.5 pr-2">
                  {gallery.map((g, i) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => selectItem(i)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md border px-2 py-1.5 text-left transition-colors',
                          i === activeIndex
                            ? 'border-mist/30 bg-obsidian'
                            : 'border-transparent hover:border-border hover:bg-void/80',
                        )}
                      >
                        <img
                          src={g.url}
                          alt=""
                          className="size-10 shrink-0 rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] text-mist">
                            {g.prompt}
                          </p>
                          <p className="mt-0.5 text-[10px] text-fog">
                            {relativeTime(g.createdAt)}
                            {g.size ? ` · ${g.size}` : ''}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col bg-void p-4 md:p-6">
        <div className="relative flex min-h-[240px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-carbon shadow-[inset_0_0_0_1px_rgb(35,37,42)] sm:min-h-[280px]">
          {gallery.length > 0 ? (
            <Swiper
              modules={[Navigation, Pagination, A11y]}
              navigation
              pagination={{ clickable: true }}
              observer
              observeParents
              className="image-studio-swiper h-full w-full max-w-full"
              onSwiper={(s) => {
                swiperRef.current = s
              }}
              onSlideChange={(s) => setActiveIndex(s.activeIndex)}
              initialSlide={activeIndex}
            >
              {gallery.map((g) => (
                <SwiperSlide key={g.id} className="!h-full !w-full">
                  <div className="flex h-full w-full min-w-0 items-center justify-center p-4">
                    <img
                      src={g.url}
                      alt={g.prompt}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          ) : busy ? (
            <LoadingState label={status || 'Generating…'} />
          ) : (
            <EmptyState
              icon={ImageIcon}
              title={
                account
                  ? 'Your images will show up here'
                  : 'Connect a wallet to start'
              }
              description={
                account
                  ? 'Write a prompt and generate — results stay in History.'
                  : 'Connect, pay once per image, and browse past gens anytime.'
              }
            />
          )}

          {active ? (
            <div className="absolute bottom-4 right-4 z-10 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => download(active.url)}
              >
                <Download className="size-3.5" />
                Download
              </Button>
            </div>
          ) : null}
        </div>

        {active ? (
          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
            {active.prompt}
            {active.size ? ` · ${active.size}` : ''}
          </p>
        ) : null}
      </div>
    </div>
  )
}

import { useNavigate } from '@tanstack/react-router'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ProviderIcon } from '#/components/models/provider-icon'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { ScrollArea } from '#/components/ui/scroll-area'
import { formatUsdc, type Model } from '#/data/models'
import { PROVIDER_LOGO } from '#/lib/provider-logos'
import { cn } from '#/lib/utils'

type Props = {
  current: Model
  models: Model[]
  /** When true, confirm before navigating away mid-generation. */
  busy?: boolean
  /**
   * When set, switch in-place instead of navigating to `/models/$slug`.
   * Used by the puya-ts IDE workspace.
   */
  onSelect?: (slug: string) => void
}

export function ModelSwitcher({ current, models, busy, onSelect }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return models
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query) ||
        m.type.toLowerCase().includes(query) ||
        m.slug.toLowerCase().includes(query),
    )
  }, [models, q])

  function select(slug: string) {
    if (slug === current.slug) {
      setOpen(false)
      return
    }
    if (busy) {
      const ok = window.confirm(
        'A response is still generating. Switch models anyway? Progress may be lost.',
      )
      if (!ok) return
    }
    setOpen(false)
    setQ('')
    if (onSelect) {
      onSelect(slug)
      return
    }
    void navigate({ to: '/models/$slug', params: { slug } }).catch(() => {
      toast.error('Could not switch model')
    })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQ('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 max-w-[min(100%,160px)] gap-2 border-border bg-paper px-2 font-normal sm:max-w-[min(100%,280px)] sm:px-2.5"
          aria-label="Switch model"
        >
          <ProviderIcon
            src={current.logoSrc || PROVIDER_LOGO.micropay}
            size="sm"
            className="size-6 shrink-0 border-0 shadow-none"
          />
          <span className="min-w-0 flex-1 truncate text-left text-[13px] text-ink">
            {current.name}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-fog" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(100vw-2rem,320px)] border-border bg-snow p-0 shadow-lg"
      >
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fog" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search models…"
              className="h-8 border-border bg-paper pl-8 text-base"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="h-[min(50vh,320px)]">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No models match
              </p>
            ) : (
              filtered.map((m) => {
                const active = m.slug === current.slug
                return (
                  <button
                    key={m.slug}
                    type="button"
                    onClick={() => select(m.slug)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                      active
                        ? 'bg-obsidian text-ink'
                        : 'text-mist hover:bg-obsidian/70 hover:text-ink',
                    )}
                  >
                    <ProviderIcon
                      src={m.logoSrc || PROVIDER_LOGO.micropay}
                      size="sm"
                      className="size-7 shrink-0 border-0 shadow-none"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] leading-tight">
                        {m.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-fog">
                        {m.provider} · {m.type} · {formatUsdc(m.priceUsdc)}
                      </span>
                    </span>
                    {active ? (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

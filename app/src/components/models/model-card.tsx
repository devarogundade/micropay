import { Link } from '@tanstack/react-router'

import { ProviderIcon } from '#/components/models/provider-icon'
import { Badge } from '#/components/ui/badge'
import { formatUsdc, type Model } from '#/data/models'
import { PROVIDER_LOGO } from '#/lib/provider-logos'
import { cn } from '#/lib/utils'

export function ModelCard({
  model,
  size = 'md',
}: {
  model: Model
  /** Larger cards for brand carousel rows. */
  size?: 'md' | 'lg'
}) {
  const large = size === 'lg'

  return (
    <Link
      to="/models/$slug"
      params={{ slug: model.slug }}
      className={cn(
        'group block h-full no-underline transition-colors',
        large
          ? 'rounded-2xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] hover:border-smoke sm:p-6'
          : 'rounded-xl border border-border bg-card p-3.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] active:bg-obsidian/60 hover:border-smoke sm:p-4',
      )}
    >
      <div className={cn('flex items-start', large ? 'gap-4' : 'gap-3')}>
        <ProviderIcon
          src={model.logoSrc || PROVIDER_LOGO.micropay}
          size={large ? 'lg' : 'lg'}
          className={large ? 'size-12' : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate font-medium tracking-tight text-ink group-hover:underline',
                  large ? 'text-base sm:text-lg' : '',
                )}
              >
                {model.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {model.provider}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 font-normal">
              {model.type}
            </Badge>
          </div>
          <p
            className={cn(
              'mt-2 text-sm text-muted-foreground',
              large ? 'line-clamp-3 min-h-[3.75rem]' : 'line-clamp-2',
            )}
          >
            {model.description}
          </p>
          <p
            className={cn(
              'flex items-center gap-1.5 font-medium text-foreground',
              large ? 'mt-4 text-[15px]' : 'mt-3 text-sm',
            )}
          >
            <img src="/assets/usdc.png" alt="" className="size-4" />
            {formatUsdc(model.priceUsdc)}
            <span className="font-normal text-muted-foreground">/ est. use</span>
          </p>
        </div>
      </div>
    </Link>
  )
}

import { Link } from '@tanstack/react-router'

import { ProviderIcon } from '#/components/models/provider-icon'
import { Badge } from '#/components/ui/badge'
import { formatUsdc, type Model } from '#/data/models'
import { PROVIDER_LOGO } from '#/lib/provider-logos'

export function ModelCard({ model }: { model: Model }) {
  return (
    <Link
      to="/models/$slug"
      params={{ slug: model.slug }}
      className="group block rounded-xl border border-border bg-card p-3.5 no-underline shadow-[inset_0_0_0_1px_rgb(35,37,42)] transition-colors active:bg-obsidian/60 hover:border-smoke sm:p-4"
    >
      <div className="flex items-start gap-3">
        <ProviderIcon
          src={model.logoSrc || PROVIDER_LOGO.micropay}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium tracking-tight text-paper group-hover:underline">
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
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {model.description}
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <img src="/assets/usdc.png" alt="" className="size-4" />
            {formatUsdc(model.priceUsdc)}
            <span className="font-normal text-muted-foreground">/ est. use</span>
          </p>
        </div>
      </div>
    </Link>
  )
}

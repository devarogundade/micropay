import { Link } from '@tanstack/react-router'

import { AgentAvatar, AgentTypeBadge } from '#/components/agents/agent-meta'
import { Badge } from '#/components/ui/badge'
import { formatUsdc } from '#/data/models'
import type { Agent } from '#/lib/agents-api'
import { cn } from '#/lib/utils'

export function AgentCard({ agent, size = 'md' }: { agent: Agent; size?: 'md' | 'lg' }) {
  const large = size === 'lg'
  return (
    <Link
      to="/agents/$slug"
      params={{ slug: agent.slug }}
      className={cn(
        'group block h-full no-underline transition-colors',
        large
          ? 'rounded-2xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] hover:border-smoke sm:p-6'
          : 'rounded-xl border border-border bg-card p-3.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] hover:border-smoke sm:p-4',
      )}
    >
      <div className={cn('flex items-start', large ? 'gap-4' : 'gap-3')}>
        <AgentAvatar agent={agent} className={large ? 'size-14 rounded-2xl' : undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate font-medium tracking-tight text-ink group-hover:underline',
                  large ? 'text-base sm:text-lg' : '',
                )}
              >
                {agent.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                by {agent.creatorShort}
              </p>
            </div>
            <AgentTypeBadge type={agent.type} className="shrink-0" />
          </div>
          {agent.description ? (
            <p
              className={cn(
                'mt-2 text-sm text-muted-foreground',
                large ? 'line-clamp-3' : 'line-clamp-2',
              )}
            >
              {agent.description}
            </p>
          ) : (
            <p className={cn('mt-2 text-sm text-muted-foreground', large ? 'line-clamp-3' : 'line-clamp-2')}>
              A {agent.type} agent created on Micropay.
            </p>
          )}
          <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', large ? 'mt-4' : 'mt-3')}>
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <img src="/assets/usdc.png" alt="" className="size-4" />
              {formatUsdc(agent.priceUsdc)}
              <span className="font-normal text-muted-foreground">/ use</span>
            </p>
            {agent.useCount > 0 ? (
              <Badge variant="outline" className="font-normal">
                {agent.useCount} use{agent.useCount === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}
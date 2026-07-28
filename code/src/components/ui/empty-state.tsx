import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '#/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        compact
          ? 'space-y-1 px-0 py-2'
          : 'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center',
        className,
      )}
    >
      {Icon && !compact ? (
        <Icon className="size-8 text-muted-foreground/50" aria-hidden />
      ) : null}
      <p
        className={cn(
          compact
            ? 'text-xs leading-relaxed text-muted-foreground'
            : 'text-sm font-medium text-paper',
        )}
      >
        {compact ? description || title : title}
      </p>
      {!compact && description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className={cn(!compact && 'mt-2')}>{action}</div> : null}
    </div>
  )
}

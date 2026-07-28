import { Loader2 } from 'lucide-react'

import { cn } from '#/lib/utils'

export function LoadingState({
  label = 'Loading…',
  className,
  compact,
}: {
  label?: string
  className?: string
  /** Inline row for sidebars / tight spaces */
  compact?: boolean
}) {
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 py-4 text-xs text-muted-foreground',
          className,
        )}
        role="status"
      >
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        <span>{label}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-4 py-10 text-center',
        className,
      )}
      role="status"
    >
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

/** Simple skeleton bars for list/table placeholders. */
export function SkeletonLines({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-obsidian"
          style={{ width: `${72 - i * 12}%` }}
        />
      ))}
    </div>
  )
}

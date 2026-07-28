import { AlertCircle, RefreshCw } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
  compact,
}: {
  title?: string
  description?: string | null
  onRetry?: () => void
  retryLabel?: string
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        compact
          ? 'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2'
          : 'flex flex-col items-center justify-center gap-3 px-4 py-10 text-center',
        className,
      )}
      role="alert"
    >
      {compact ? (
        <div className="space-y-2">
          <p className="text-xs text-destructive">
            {description || title}
          </p>
          {onRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onRetry}
            >
              <RefreshCw className="size-3" />
              {retryLabel}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <AlertCircle className="size-6 text-destructive/80" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-paper">{title}</p>
            {description ? (
              <p className="max-w-sm text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {onRetry ? (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              {retryLabel}
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}

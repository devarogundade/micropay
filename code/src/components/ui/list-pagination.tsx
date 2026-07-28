import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

/** 1-based page controls for client-side lists. Hidden when everything fits on one page. */
export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
  compact,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
  compact?: boolean
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null

  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2',
        compact ? 'px-2 py-1.5' : 'px-1 py-2',
        className,
      )}
    >
      <p
        className={cn(
          'tabular-nums text-muted-foreground',
          compact ? 'text-[10px]' : 'text-xs',
        )}
      >
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(compact && 'size-7', 'text-fog')}
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span
          className={cn(
            'min-w-[3.25rem] text-center tabular-nums text-fog',
            compact ? 'text-[10px]' : 'text-xs',
          )}
        >
          {safePage} / {totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(compact && 'size-7', 'text-fog')}
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function slicePage<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (Math.max(1, page) - 1) * pageSize
  return items.slice(start, start + pageSize)
}

import type { ReactNode } from 'react'

import { cn } from '#/lib/utils'

type ListCardProps = {
  children: ReactNode
  className?: string
  /** Interactive card (button/link look). */
  interactive?: boolean
  onClick?: () => void
  as?: 'div' | 'button' | 'li'
}

/**
 * Card-style list row — touch-friendly padding, inset hairline, optional press.
 */
export function ListCard({
  children,
  className,
  interactive = false,
  onClick,
  as = 'div',
}: ListCardProps) {
  const classNames = cn(
    'surface-card w-full text-left',
    'px-3.5 py-3',
    interactive &&
      'cursor-pointer transition-colors active:bg-obsidian/80 hover:border-smoke/80',
    className,
  )

  if (as === 'button') {
    return (
      <button type="button" onClick={onClick} className={classNames}>
        {children}
      </button>
    )
  }

  if (as === 'li') {
    return (
      <li className={classNames} onClick={onClick}>
        {children}
      </li>
    )
  }

  return (
    <div className={classNames} onClick={onClick}>
      {children}
    </div>
  )
}

type ListCardRowProps = {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  meta?: ReactNode
  className?: string
}

/** Standard leading / title / trailing layout inside a ListCard. */
export function ListCardRow({
  leading,
  title,
  subtitle,
  trailing,
  meta,
  className,
}: ListCardRowProps) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {subtitle}
              </div>
            ) : null}
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>
        {meta ? <div className="mt-2">{meta}</div> : null}
      </div>
    </div>
  )
}

type ListCardGroupProps = {
  children: ReactNode
  className?: string
  /** Optional section label above the group. */
  label?: string
}

/** Stacked card list with consistent gap. */
export function ListCardGroup({
  children,
  className,
  label,
}: ListCardGroupProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <p className="px-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  )
}

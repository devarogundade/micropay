'use client'

import type { ReactNode } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { cn } from '#/lib/utils'

type BottomSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** Extra class on the scrollable body. */
  bodyClassName?: string
}

/**
 * Mobile-first bottom sheet with drag handle and safe-area padding.
 * Built on the shared Sheet primitive (side="bottom").
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
}: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'safe-bottom gap-0 rounded-t-2xl border-border bg-snow p-0 shadow-xl',
          'max-h-[min(92dvh,720px)]',
          className,
        )}
      >
        <div className="flex shrink-0 flex-col items-center pt-2.5 pb-1">
          <span
            aria-hidden
            className="h-1 w-10 rounded-full bg-smoke"
          />
        </div>
        {title || description ? (
          <SheetHeader className="gap-1 border-b border-border px-4 pb-3 pt-1 text-left">
            {title ? (
              <SheetTitle className="text-base text-ink">{title}</SheetTitle>
            ) : null}
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : null}
          </SheetHeader>
        ) : null}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4',
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer ? (
          <SheetFooter className="border-t border-border px-4 py-3">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

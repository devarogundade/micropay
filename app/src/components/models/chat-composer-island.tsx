import type { ReactNode } from 'react'

import { cn } from '#/lib/utils'

/** Floating bottom dock used by models + puya-ts chat composers. */
export function ChatIslandDock({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 md:px-6',
        className,
      )}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-3xl">
        {children}
      </div>
    </div>
  )
}

export const chatIslandShellClassName =
  'flex items-end gap-1.5 rounded-[1.35rem] border border-border/80 bg-snow/95 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(0,0,0,0.08)] backdrop-blur-md'

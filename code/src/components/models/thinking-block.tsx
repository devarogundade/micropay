import { ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '#/lib/utils'

export function ThinkingBlock({
  text,
  streaming = false,
}: {
  text: string
  /** When true, show an active “thinking” affordance (before answer tokens). */
  streaming?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-2 rounded-md border border-border/80 bg-void/60">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {streaming ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <ChevronDown
            className={cn('size-3.5 transition-transform', open && 'rotate-180')}
          />
        )}
        Thinking
      </button>
      {open || streaming ? (
        <pre className="max-h-40 overflow-y-auto border-t border-border/60 px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fog">
          {text}
        </pre>
      ) : null}
    </div>
  )
}

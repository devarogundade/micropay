import { Grid2X2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import type { ChatToolCapability } from '#/lib/tools-capabilities'
import { cn } from '#/lib/utils'

export function ChatToolsSelector({
  capabilities,
  selectedTools,
  onSelectedToolsChange,
  disabled,
}: {
  capabilities: ChatToolCapability[]
  selectedTools: string[]
  onSelectedToolsChange: (next: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Tools"
          className="absolute bottom-[calc(100%+0.5rem)] left-0 z-40 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-snow shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
        >
          {capabilities.length ? (
            <ul className="divide-y divide-border/80 py-1">
              {capabilities.map((tool) => {
                const checked = selectedTools.includes(tool.name)
                return (
                  <li key={tool.name} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-ink">
                        {toolLabel(tool.name)}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                        {tool.description}
                      </span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      onClick={() =>
                        onSelectedToolsChange(
                          checked
                            ? selectedTools.filter((name) => name !== tool.name)
                            : [...selectedTools, tool.name],
                        )
                      }
                      className={cn(
                        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                        checked ? 'bg-ink' : 'bg-smoke',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 size-4 rounded-full bg-snow shadow transition-transform',
                          checked ? 'left-4' : 'left-0.5',
                        )}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              No server tools are currently available.
            </p>
          )}
          <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            Selected tools run on Micropay and may make the response take longer.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12px] transition-colors',
          open || selectedTools.length
            ? 'bg-obsidian text-ink'
            : 'text-mist hover:bg-obsidian hover:text-ink',
        )}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Grid2X2 className="size-3.5" />
        <span className="hidden sm:inline">Tools</span>
        {selectedTools.length ? ` · ${selectedTools.length}` : ''}
      </button>
    </div>
  )
}

function toolLabel(name: string): string {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

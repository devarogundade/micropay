import { MessageSquarePlus, PanelLeftClose, PanelLeft, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { SessionListItem } from '#/components/models/chat-types'
import { EmptyState } from '#/components/ui/empty-state'
import {
  ListPagination,
  slicePage,
} from '#/components/ui/list-pagination'
import { LoadingState } from '#/components/ui/loading-state'
import { Button } from '#/components/ui/button'
import { ScrollArea } from '#/components/ui/scroll-area'
import { cn } from '#/lib/utils'

const PAGE_SIZE = 12

function relativeTime(iso: string) {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  loading,
  collapsed,
  onCollapsedChange,
  onSelect,
  onNewChat,
  onDelete,
  busy,
  walletConnected,
}: {
  sessions: SessionListItem[]
  activeSessionId: string | null
  loading?: boolean
  collapsed: boolean
  onCollapsedChange: (v: boolean) => void
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  busy?: boolean
  walletConnected: boolean
}) {
  const [page, setPage] = useState(1)
  const prevActiveRef = useRef<string | null>(null)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE))
    if (page > totalPages) setPage(totalPages)
  }, [sessions.length, page])

  useEffect(() => {
    if (!activeSessionId || activeSessionId === prevActiveRef.current) return
    prevActiveRef.current = activeSessionId
    const idx = sessions.findIndex((s) => s.id === activeSessionId)
    if (idx < 0) return
    setPage(Math.floor(idx / PAGE_SIZE) + 1)
  }, [activeSessionId, sessions])

  const pageSessions = useMemo(
    () => slicePage(sessions, page, PAGE_SIZE),
    [sessions, page],
  )

  if (collapsed) {
    return (
      <aside className="flex h-full w-11 shrink-0 flex-col items-center border-r border-border bg-snow">
        <div className="workspace-bar flex w-full flex-col items-center justify-center gap-1 border-b border-border">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-fog"
            onClick={() => onCollapsedChange(false)}
            aria-label="Expand chat history"
          >
            <PanelLeft className="size-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="mt-1 text-fog"
          onClick={onNewChat}
          disabled={busy}
          aria-label="Start new chat"
        >
          <MessageSquarePlus className="size-4" />
        </Button>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-snow">
      <div className="workspace-bar flex items-center gap-1 border-b border-border px-2">
        <Button
          className="h-8 flex-1 justify-start gap-2 px-2.5 text-[13px]"
          size="sm"
          onClick={onNewChat}
          disabled={busy}
        >
          <MessageSquarePlus className="size-3.5" />
          Start new chat
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-fog"
          onClick={() => onCollapsedChange(true)}
          aria-label="Collapse chat history"
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <ScrollArea className="h-0 min-h-0 flex-1">
        <div className="space-y-0.5 p-2">
          {!walletConnected ? (
            <EmptyState
              compact
              className="px-2 py-6"
              title="Connect a wallet"
              description="Connect a wallet to save and switch between chats."
            />
          ) : loading ? (
            <LoadingState compact label="Loading chats…" className="px-2" />
          ) : sessions.length === 0 ? (
            <EmptyState
              compact
              className="px-2 py-6"
              title="No chats yet"
              description="No chats yet. Start a conversation — it will appear here."
            />
          ) : (
            pageSessions.map((s) => {
              const active = s.id === activeSessionId
              return (
                <div
                  key={s.id}
                  className={cn(
                    'group flex items-start gap-1 rounded-md transition-colors',
                    active
                      ? 'bg-obsidian text-ink'
                      : 'text-mist hover:bg-obsidian/60',
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-2.5 py-2 text-left"
                    onClick={() => onSelect(s.id)}
                    disabled={busy}
                  >
                    <p className="truncate text-[13px] leading-snug">
                      {s.title?.trim() || 'Untitled chat'}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-fog">
                      <span>{relativeTime(s.updatedAt)}</span>
                      {s.messageCount != null ? (
                        <>
                          <span className="text-smoke">·</span>
                          <span>{s.messageCount} msgs</span>
                        </>
                      ) : null}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="mr-1 mt-1.5 rounded p-1 text-fog opacity-0 transition-opacity hover:bg-muted hover:text-coral-red group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(s.id)
                    }}
                    disabled={busy}
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {walletConnected && !loading && sessions.length > PAGE_SIZE ? (
        <ListPagination
          compact
          className="shrink-0 border-t border-border"
          page={page}
          pageSize={PAGE_SIZE}
          total={sessions.length}
          onPageChange={setPage}
        />
      ) : null}
    </aside>
  )
}

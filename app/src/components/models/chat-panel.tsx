import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  Copy,
  FileText,
  History,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  Square,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  ChatIslandDock,
  chatIslandShellClassName,
} from '#/components/models/chat-composer-island'
import { ChatSidebar } from '#/components/models/chat-sidebar'
import { MarkdownMessage } from '#/components/models/markdown-message'
import { ThinkingBlock } from '#/components/models/thinking-block'
import {
  attachmentsFromStored,
  formatBytes,
  imageSrc,
  isImageFile,
  isTextFile,
  MAX_ATTACHMENTS,
  parseChatRole,
  readAsText,
  toApiMessage,
  uid,
  type ChatAttachment,
  type Msg,
  type SessionListItem,
} from '#/components/models/chat-types'
import { EmptyState } from '#/components/ui/empty-state'
import { LoadingState } from '#/components/ui/loading-state'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Textarea } from '#/components/ui/textarea'
import { formatUsdc, type Model } from '#/data/models'
import { toStoredAttachments } from '#/lib/chat-attachments'
import {
  useClearChatHistoryMutation,
  useCreateChatSessionMutation,
  useSaveChatTurnMutation,
} from '#/lib/chat.mutations'
import { fetchChatSession, fetchChatSessions } from '#/lib/chat.functions'
import {
  costUsdcFromTrace,
  providerLabelFromTrace,
  streamChatCompletions,
  uploadToStorage,
} from '#/lib/micropay-api'
import { invalidateUsageQueries } from '#/lib/query-invalidation'
import { queryKeys } from '#/lib/query-keys'
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from '#/lib/storage-limits'
import { cn } from '#/lib/utils'
import { useWallet } from '#/lib/wallet'

const NEAR_BOTTOM_PX = 96

function copyMessage(text: string) {
  void navigator.clipboard.writeText(text)
  toast.success('Copied')
}

export function ChatPanel({
  model,
  onRequestPay,
  onBusyChange,
}: {
  model: Model
  onRequestPay: (action: () => Promise<void>) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const { account, fetchWithPay } = useWallet()
  const queryClient = useQueryClient()
  const createChatSessionMutation = useCreateChatSessionMutation()
  const saveChatTurnMutation = useSaveChatTurnMutation()
  const clearChatHistoryMutation = useClearChatHistoryMutation()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [busy, setBusyState] = useState(false)

  function setBusy(next: boolean) {
    setBusyState(next)
    onBusyChange?.(next)
  }
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stickToBottomRef = useRef(true)
  const lastUserRef = useRef<{ content: string; attachments?: ChatAttachment[] }>(
    { content: '' },
  )
  const modelKey = model.routerId ?? model.slug
  const walletAddress = account?.address ?? null

  const sessionsQuery = useQuery({
    queryKey: queryKeys.chat.sessions(walletAddress, modelKey),
    queryFn: async () => {
      const data = await fetchChatSessions({
        data: { walletAddress: walletAddress!, modelId: modelKey },
      })
      return data.sessions ?? []
    },
    enabled: Boolean(walletAddress),
  })

  const sessions: SessionListItem[] = sessionsQuery.data ?? []
  // Disabled queries stay isPending in TanStack Query — only show loading when connected.
  const loadingSessions =
    Boolean(walletAddress) &&
    (sessionsQuery.isLoading || sessionsQuery.isFetching)

  function setSession(id: string | null) {
    sessionIdRef.current = id
    setActiveSessionId(id)
  }

  const canVision = Boolean(model.supportsVision)
  const canSend = Boolean(input.trim()) || attachments.length > 0

  function isNearBottom(el: HTMLElement) {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const el = listRef.current
    if (!el) return
    stickToBottomRef.current = true
    setShowJumpToBottom(false)
    el.scrollTo({ top: el.scrollHeight, behavior })
  }

  function onListScroll() {
    const el = listRef.current
    if (!el) return
    const near = isNearBottom(el)
    stickToBottomRef.current = near
    setShowJumpToBottom(!near && messages.length > 0)
  }

  useEffect(() => {
    if (!stickToBottomRef.current) return
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  async function refreshSessions(preferId?: string | null) {
    if (!walletAddress) return null
    try {
      const list = await queryClient.fetchQuery({
        queryKey: queryKeys.chat.sessions(walletAddress, modelKey),
        queryFn: async () => {
          const data = await fetchChatSessions({
            data: { walletAddress, modelId: modelKey },
          })
          return data.sessions ?? []
        },
      })
      if (preferId && list.some((s) => s.id === preferId)) {
        return preferId
      }
      return list[0]?.id ?? null
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to load chat sessions',
      )
      return null
    }
  }

  async function loadSession(sessionId: string) {
    if (!account?.address) return
    setLoadingHistory(true)
    try {
      const data = await fetchChatSession({
        data: { walletAddress: account.address, sessionId },
      })
      setSession(data.session?.id ?? sessionId)
      stickToBottomRef.current = true
      setShowJumpToBottom(false)
      setMessages(
        (data.messages ?? []).map((m) => ({
          id: m.id,
          role: parseChatRole(m.role),
          content: m.content,
          attachments: attachmentsFromStored(m.attachments),
          reasoning: m.reasoning ?? undefined,
          costUsdc: m.costUsdc ?? undefined,
          provider: m.provider ?? undefined,
          error: m.error || undefined,
        })),
      )
    } catch {
      toast.error('Failed to load chat')
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!walletAddress) {
        setSession(null)
        setMessages([])
        setLoadingHistory(false)
        return
      }
      setLoadingHistory(true)
      try {
        const firstId = await refreshSessions()
        if (cancelled) return
        if (firstId) {
          await loadSession(firstId)
        } else {
          setSession(null)
          setMessages([])
        }
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot on wallet/model change
  }, [walletAddress, modelKey])

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
    setMessages((m) =>
      m.map((msg) =>
        msg.streaming
          ? { ...msg, streaming: false, content: msg.content || '…' }
          : msg,
      ),
    )
  }

  async function startNewChat() {
    if (busy) stop()
    setAttachments([])
    stickToBottomRef.current = true
    setShowJumpToBottom(false)
    setMessages([])
    if (!walletAddress) {
      setSession(null)
      return
    }
    try {
      const session = await createChatSessionMutation.mutateAsync({
        walletAddress,
        modelId: modelKey,
        modelSlug: model.slug,
        title: 'New chat',
      })
      setSession(session.id)
      await refreshSessions(session.id)
    } catch {
      setSession(null)
      toast.error('Could not create chat')
    }
  }

  async function deleteSession(id: string) {
    if (busy) stop()
    if (!walletAddress) return
    try {
      await clearChatHistoryMutation.mutateAsync({
        walletAddress,
        sessionId: id,
        deleteSession: true,
        modelId: modelKey,
      })
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to delete chat session',
      )
      return
    }
    const remaining = (
      queryClient.getQueryData<SessionListItem[]>(
        queryKeys.chat.sessions(walletAddress, modelKey),
      ) ?? sessions
    ).filter((s) => s.id !== id)
    if (activeSessionId === id) {
      if (remaining[0]) {
        await loadSession(remaining[0].id)
      } else {
        setSession(null)
        setMessages([])
      }
    }
  }

  async function addFiles(fileList: FileList | File[] | null) {
    if (!fileList || busy) return
    const files = Array.from(fileList)
    if (!files.length) return

    const next: ChatAttachment[] = [...attachments]

    for (const file of files) {
      if (next.length >= MAX_ATTACHMENTS) {
        toast.error(`Max ${MAX_ATTACHMENTS} files per message`)
        break
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(
          `${file.name}: must be under ${MAX_UPLOAD_LABEL} (${formatBytes(file.size)} given)`,
        )
        continue
      }

      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        toast.error(
          `${file.name}: PDF is not supported here. Convert to text or attach an image.`,
        )
        continue
      }

      if (
        /\.(docx?|xlsx?|pptx?|zip|rar|7z|exe|bin)$/i.test(file.name) ||
        file.type.includes('officedocument') ||
        file.type.includes('msword')
      ) {
        toast.error(
          `${file.name}: binary office docs are not supported. Use images or plain text.`,
        )
        continue
      }

      if (isImageFile(file)) {
        if (!canVision) {
          toast.error(
            'This model does not support vision. Choose a vision-capable chat model to attach images.',
          )
          continue
        }
        try {
          const stored = await uploadToStorage({
            file,
            filename: file.name,
            folder: 'attachments',
          })
          next.push({
            id: uid(),
            name: file.name,
            mime: file.type || 'image/png',
            mimeType: file.type || 'image/png',
            size: file.size,
            kind: 'image',
            url: stored.url,
            storagePath: stored.storagePath,
          })
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : `Upload failed for ${file.name}. Configure Supabase storage to attach images.`,
          )
        }
        continue
      }

      if (isTextFile(file)) {
        try {
          const textContent = await readAsText(file)
          if (!textContent.trim()) {
            toast.error(`${file.name}: file is empty`)
            continue
          }
          let url: string | undefined
          let storagePath: string | undefined
          try {
            const stored = await uploadToStorage({
              file,
              filename: file.name,
              folder: 'attachments',
            })
            url = stored.url
            storagePath = stored.storagePath
          } catch (uploadErr) {
            toast.error(
              uploadErr instanceof Error
                ? `Could not persist ${file.name}: ${uploadErr.message}`
                : `Could not persist ${file.name}`,
            )
            continue
          }
          next.push({
            id: uid(),
            name: file.name,
            mime: file.type || 'text/plain',
            mimeType: file.type || 'text/plain',
            size: file.size,
            kind: 'text',
            textContent,
            url,
            storagePath,
          })
        } catch (e) {
          toast.error(e instanceof Error ? e.message : `Failed to read ${file.name}`)
        }
        continue
      }

      toast.error(
        `${file.name}: unsupported type. Attach images (png/jpeg/gif/webp) or text files.`,
      )
    }

    setAttachments(next)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  function send(
    textOverride?: string,
    baseMessages?: Msg[],
    attachmentsOverride?: ChatAttachment[],
  ) {
    const text = (textOverride ?? input).trim()
    const atts = attachmentsOverride ?? attachments
    if ((!text && !atts.length) || busy) return

    if (atts.some((a) => a.kind === 'image') && !canVision) {
      toast.error('This model does not support vision image inputs')
      return
    }

    lastUserRef.current = { content: text, attachments: atts }
    const prior = baseMessages ?? messages

    onRequestPay(async () => {
      const userMsg: Msg = {
        id: uid(),
        role: 'user',
        content: text,
        attachments: atts.length ? atts : undefined,
      }
      const assistantId = uid()
      const history = [...prior, userMsg].filter((m) => m.role !== 'system')

      stickToBottomRef.current = true
      setShowJumpToBottom(false)
      setMessages([
        ...prior,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ])
      if (!textOverride) {
        setInput('')
        setAttachments([])
      }
      setBusy(true)

      const ac = new AbortController()
      abortRef.current = ac

      try {
        const result = await streamChatCompletions({
          model: model.routerId ?? model.slug,
          messages: history.map(toApiMessage),
          fetchImpl: fetchWithPay,
          signal: ac.signal,
          onDelta: ({ content, reasoning }) => {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantId) return msg
                return {
                  ...msg,
                  content: content ? msg.content + content : msg.content,
                  reasoning: reasoning
                    ? (msg.reasoning || '') + reasoning
                    : msg.reasoning,
                }
              }),
            )
          },
        })

        if (!result.ok) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    streaming: false,
                    error: true,
                    content: result.error || 'Request failed',
                  }
                : msg,
            ),
          )
          toast.error(result.error || 'Something went wrong')
          return
        }

        // Completions API records activity + model usage on success.
        void invalidateUsageQueries(queryClient, walletAddress)

        const cost =
          result.costUsdc ?? costUsdcFromTrace(result.trace) ?? undefined
        const provider = providerLabelFromTrace(result.trace)
        const assistantContent = result.content || '(empty response)'
        const assistantReasoning = result.reasoning || undefined

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  streaming: false,
                  content: assistantContent,
                  reasoning: assistantReasoning || msg.reasoning,
                  costUsdc: cost,
                  provider,
                }
              : msg,
          ),
        )

        if (walletAddress) {
          try {
            const saved = await saveChatTurnMutation.mutateAsync({
              walletAddress,
              modelId: modelKey,
              modelSlug: model.slug,
              sessionId: sessionIdRef.current,
              title: text.slice(0, 80) || undefined,
              messages: [
                {
                  id: userMsg.id,
                  role: 'user',
                  content: text,
                  attachments: toStoredAttachments(atts),
                },
                {
                  id: assistantId,
                  role: 'assistant',
                  content: assistantContent,
                  reasoning: assistantReasoning,
                  modelId: modelKey,
                  costUsdc: cost,
                  provider,
                },
              ],
            })
            setSession(saved.sessionId)
            void refreshSessions(saved.sessionId)
          } catch (persistErr) {
            toast.error(
              persistErr instanceof Error
                ? `Failed to persist chat history: ${persistErr.message}`
                : 'Failed to persist chat history',
            )
          }
        }

        toast.success(
          cost != null
            ? `Paid · ~${formatUsdc(cost)}`
            : `Paid · ~${formatUsdc(model.priceUsdc)}`,
        )
      } catch (e) {
        if (ac.signal.aborted) {
          toast.message('Generation stopped')
          return
        }
        const msg = e instanceof Error ? e.message : 'Request failed'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, error: true, content: msg }
              : m,
          ),
        )
        toast.error(msg)
      } finally {
        abortRef.current = null
        setBusy(false)
      }
    })
  }

  function regenerate() {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const text = lastUser?.content || lastUserRef.current.content
    const atts = lastUser?.attachments || lastUserRef.current.attachments || []
    if (!text && !atts.length) return
    const copy = [...messages]
    if (copy.length && copy[copy.length - 1]?.role === 'assistant') copy.pop()
    if (copy.length && copy[copy.length - 1]?.role === 'user') copy.pop()
    send(text, copy, atts)
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-void">
      <div className="hidden h-full md:flex">
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          loading={loadingSessions}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          onSelect={(id) => void loadSession(id)}
          onNewChat={() => void startNewChat()}
          onDelete={(id) => void deleteSession(id)}
          busy={busy}
          walletConnected={Boolean(account)}
        />
      </div>

      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <Sheet open={mobileHistoryOpen} onOpenChange={setMobileHistoryOpen}>
          <SheetContent side="left" className="w-[min(100%,300px)] bg-carbon p-0">
            <SheetHeader className="border-b border-border px-4 py-3">
              <SheetTitle className="text-sm">Your chats</SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100%-3.5rem)]">
              <ChatSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                loading={loadingSessions}
                collapsed={false}
                onCollapsedChange={() => undefined}
                onSelect={(id) => {
                  setMobileHistoryOpen(false)
                  void loadSession(id)
                }}
                onNewChat={() => {
                  setMobileHistoryOpen(false)
                  void startNewChat()
                }}
                onDelete={(id) => void deleteSession(id)}
                busy={busy}
                walletConnected={Boolean(account)}
              />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border bg-carbon px-2 sm:px-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 px-2 text-xs md:hidden"
              onClick={() => void startNewChat()}
              disabled={busy}
            >
              New
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 px-2 text-xs md:hidden"
              onClick={() => setMobileHistoryOpen(true)}
            >
              <History className="size-3.5" />
              Chats
            </Button>
            <p className="hidden min-w-0 truncate text-[11px] text-muted-foreground sm:block">
              ~{formatUsdc(model.priceUsdc)} per message
            </p>
            {canVision ? (
              <Badge
                variant="outline"
                className="hidden h-5 px-1.5 text-[10px] font-normal sm:inline-flex"
              >
                Images OK
              </Badge>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1.5 px-2 text-xs"
            disabled={busy || !messages.some((m) => m.role === 'user')}
            onClick={regenerate}
          >
            <RefreshCw className="size-3.5" />
            <span className="hidden sm:inline">Try again</span>
          </Button>
        </div>

        <div
          ref={listRef}
          onScroll={onListScroll}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-36 pt-5 md:px-8"
        >
          {loadingHistory ? (
            <LoadingState
              className="h-full"
              label="Loading chat…"
            />
          ) : messages.length === 0 ? (
            <EmptyState
              className="h-full"
              title="Start a conversation"
              description={`Try asking anything. About ${formatUsdc(model.priceUsdc)} per reply, paid from your wallet.${
                account
                  ? ' Chats save to your wallet.'
                  : ' Connect a wallet to save chats.'
              }`}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    'Write a short haiku about payments',
                    'Explain this idea like I’m five',
                    'Brainstorm three product taglines',
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="rounded-md border border-border bg-obsidian px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-mist/30 hover:text-foreground"
                      onClick={() => send(s, undefined, [])}
                      disabled={busy}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              }
            />
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'mx-auto max-w-3xl rounded-lg px-3.5 py-2.5 text-sm',
                  m.role === 'user'
                    ? 'ml-auto bg-paper text-void'
                    : m.error
                      ? 'border border-destructive/40 bg-destructive/10 text-destructive'
                      : 'bg-carbon shadow-[inset_0_0_0_1px_rgb(35,37,42)]',
                )}
              >
                {m.role === 'assistant' && m.reasoning ? (
                  <ThinkingBlock text={m.reasoning} streaming={Boolean(m.streaming && !m.content)} />
                ) : null}
                {m.role === 'assistant' &&
                m.streaming &&
                !m.content &&
                !m.reasoning ? (
                  <div
                    className="flex items-center gap-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                    Thinking
                  </div>
                ) : null}
                {m.attachments?.length ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {m.attachments.map((a) => {
                      const src = a.kind === 'image' ? imageSrc(a) : undefined
                      return src ? (
                        <img
                          key={a.id}
                          src={src}
                          alt={a.name}
                          title={a.name}
                          className={cn(
                            'max-h-28 max-w-[140px] rounded-sm object-cover',
                            m.role === 'user'
                              ? 'ring-1 ring-void/15'
                              : 'ring-1 ring-border',
                          )}
                        />
                      ) : (
                        <span
                          key={a.id}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px]',
                            m.role === 'user'
                              ? 'bg-void/10 text-void'
                              : 'bg-obsidian text-muted-foreground',
                          )}
                        >
                          <FileText className="size-3 shrink-0" />
                          <span className="max-w-[120px] truncate">{a.name}</span>
                        </span>
                      )
                    })}
                  </div>
                ) : null}
                {m.content ? (
                  m.role === 'assistant' && !m.error ? (
                    <MarkdownMessage
                      content={m.content}
                      streaming={Boolean(m.streaming)}
                      tone="assistant"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {m.content}
                    </div>
                  )
                ) : null}
                {m.role === 'user' && m.content ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-void/45">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-void"
                      onClick={() => copyMessage(m.content)}
                    >
                      <Copy className="size-3" />
                      Copy
                    </button>
                  </div>
                ) : null}
                {m.role === 'assistant' && !m.streaming && !m.error ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    {m.costUsdc != null ? (
                      <span className="inline-flex items-center gap-1">
                        <img src="/assets/usdc.png" alt="" className="size-3" />
                        ~{formatUsdc(m.costUsdc)}
                      </span>
                    ) : null}
                    {m.provider ? (
                      <span className="max-w-[160px] truncate">{m.provider}</span>
                    ) : null}
                    {m.content ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => copyMessage(m.content)}
                      >
                        <Copy className="size-3" />
                        Copy
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {showJumpToBottom ? (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-[7.5rem] left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-carbon/95 px-3 py-1.5 text-[11px] font-medium text-mist shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-colors hover:border-mist/30 hover:text-paper md:bottom-32"
            aria-label="Jump to bottom"
          >
            <ArrowDown className="size-3.5" />
            Jump to bottom
          </button>
        ) : null}

        <ChatIslandDock>
            {attachments.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="group relative flex items-center gap-1.5 rounded-full border border-border bg-carbon py-1 pl-1 pr-7 shadow-sm"
                  >
                    {a.kind === 'image' && imageSrc(a) ? (
                      <img
                        src={imageSrc(a)}
                        alt=""
                        className="size-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-7 items-center justify-center rounded-full bg-obsidian">
                        <FileText className="size-3.5 text-muted-foreground" />
                      </span>
                    )}
                    <div className="min-w-0 max-w-[120px]">
                      <p className="truncate text-[11px] font-medium leading-tight">
                        {a.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-obsidian hover:text-foreground"
                      onClick={() => removeAttachment(a.id)}
                      disabled={busy}
                      aria-label={`Remove ${a.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className={chatIslandShellClassName}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 rounded-full text-fog hover:bg-obsidian hover:text-paper"
                disabled={busy || attachments.length >= MAX_ATTACHMENTS}
                title={
                  canVision
                    ? 'Attach images or text files'
                    : 'Attach text files'
                }
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                accept={
                  canVision
                    ? 'image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp,text/plain,text/markdown,text/csv,application/json,.txt,.md,.csv,.json,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.log'
                    : 'text/plain,text/markdown,text/csv,application/json,.txt,.md,.csv,.json,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.log'
                }
                onChange={(e) => void addFiles(e.target.files)}
                disabled={busy}
              />
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Try asking…"
                rows={1}
                className="max-h-40 min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-base shadow-none focus-visible:ring-0"
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.files
                  if (items?.length) {
                    e.preventDefault()
                    void addFiles(items)
                  }
                }}
              />
              {busy ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0 rounded-full"
                  onClick={stop}
                  aria-label="Stop"
                >
                  <Square className="size-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="size-10 shrink-0 rounded-full"
                  onClick={() => send()}
                  disabled={!canSend}
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </Button>
              )}
            </div>
        </ChatIslandDock>
      </div>
    </div>
  )
}

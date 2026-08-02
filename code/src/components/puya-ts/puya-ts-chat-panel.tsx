import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Blocks,
  Coins,
  History,
  KeyRound,
  Loader2,
  Send,
  Square,
  Vote,
  Wrench,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import {
  ChatIslandDock,
  chatIslandShellClassName,
} from '#/components/models/chat-composer-island'
import { ChatSidebar } from '#/components/models/chat-sidebar'
import { MarkdownMessage } from '#/components/models/markdown-message'
import {
  parseChatRole,
  uid,
  type Msg,
  type SessionListItem,
} from '#/components/models/chat-types'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Textarea } from '#/components/ui/textarea'
import { formatUsdc, type Model } from '#/data/models'
import {
  runIdeAgentLoop,
  summarizeProjectForAgent,
  type IdeToolExecutor,
} from '#/lib/ide-agent-client'
import {
  useClearChatHistoryMutation,
  useCreateChatSessionMutation,
  useSaveChatTurnMutation,
} from '#/lib/chat.mutations'
import { fetchChatSession, fetchChatSessions } from '#/lib/chat.functions'
import type { CompileResult } from '#/lib/puya-ts-compile'
import type { IdeProjectState } from '#/lib/puya-ts-project'
import { invalidateUsageQueries } from '#/lib/query-invalidation'
import { queryKeys } from '#/lib/query-keys'
import { cn } from '#/lib/utils'
import { useWallet } from '#/lib/wallet'

export function PuyaTsChatPanel({
  model,
  project,
  setProject,
  compileProject,
  lastCompile,
  onRequestPay,
  onBusyChange,
  headerActions,
}: {
  model: Model
  project: IdeProjectState
  setProject: (next: IdeProjectState) => void
  compileProject: (entry?: string) => Promise<CompileResult>
  lastCompile: () => CompileResult | null
  onRequestPay: (action: () => Promise<void>) => void
  onBusyChange?: (busy: boolean) => void
  headerActions?: ReactNode
}) {
  const { account, fetchWithPay } = useWallet()
  const queryClient = useQueryClient()
  const createChatSessionMutation = useCreateChatSessionMutation()
  const saveChatTurnMutation = useSaveChatTurnMutation()
  const clearChatHistoryMutation = useClearChatHistoryMutation()

  const [input, setInput] = useState('')
  const [busy, setBusyState] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [toolLog, setToolLog] = useState<string[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const sessionIdRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const projectRef = useRef(project)
  projectRef.current = project

  const modelKey = `puya-ts-ide:${model.routerId ?? model.slug}`
  const walletAddress = account?.address ?? null

  function setBusy(next: boolean) {
    setBusyState(next)
    onBusyChange?.(next)
  }

  function setSession(id: string | null) {
    sessionIdRef.current = id
    setActiveSessionId(id)
  }

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
  const loadingSessions =
    Boolean(walletAddress) &&
    (sessionsQuery.isLoading || sessionsQuery.isFetching)

  useEffect(() => {
    setMessages([])
    setSession(null)
    setToolLog([])
  }, [modelKey])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, toolLog])

  async function loadSession(id: string) {
    if (!walletAddress) return
    setLoadingHistory(true)
    try {
      const data = await fetchChatSession({
        data: { walletAddress, sessionId: id },
      })
      const msgs = (data.messages ?? []).map((row) => ({
        id: row.id || uid(),
        role: parseChatRole(row.role),
        content: row.content || '',
        reasoning: row.reasoning || undefined,
        error: Boolean(row.error),
        costUsdc: row.costUsdc ?? undefined,
        provider: row.provider || undefined,
      }))
      setMessages(msgs)
      setSession(id)
      setMobileHistoryOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load session')
    } finally {
      setLoadingHistory(false)
    }
  }

  async function startNewChat() {
    if (!walletAddress) {
      toast.message('Connect a wallet to save chat history')
      setMessages([])
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
      setMessages([])
      setToolLog([])
      setSession(session.id)
      setMobileHistoryOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start chat')
    }
  }

  async function deleteSession(id: string) {
    if (!walletAddress) return
    try {
      await clearChatHistoryMutation.mutateAsync({
        walletAddress,
        sessionId: id,
        deleteSession: true,
        modelId: modelKey,
      })
      if (sessionIdRef.current === id) {
        setMessages([])
        setSession(null)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete session')
    }
  }

  function send(prompt?: string) {
    const text = (prompt ?? input).trim()
    if (!text || busy) return
    if (!account || !fetchWithPay) {
      toast.message('Connect a wallet to pay')
      return
    }
    onRequestPay(async () => {
      await runTurn(text)
    })
  }

  async function runTurn(userText: string) {
    if (!fetchWithPay) return
    setInput('')
    const userMsg: Msg = { id: uid(), role: 'user', content: userText }
    const assistantId = uid()
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ])
    setToolLog([])
    setBusy(true)

    const abort = new AbortController()
    abortRef.current = abort

    const exec: IdeToolExecutor = {
      getProject: () => projectRef.current,
      setProject: (next) => {
        projectRef.current = next
        setProject(next)
      },
      compile: (entry) => compileProject(entry),
      lastCompile: () => lastCompile(),
      onTool: (name, detail) => {
        setToolLog((prev) => [...prev.slice(-12), `${name}: ${detail}`])
      },
    }

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

      const result = await runIdeAgentLoop({
        model: model.routerId ?? model.slug,
        userMessages: history,
        projectSummary: summarizeProjectForAgent(projectRef.current),
        exec,
        fetchImpl: fetchWithPay,
        signal: abort.signal,
        onAssistantDelta: (text) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: text, streaming: true }
                : m,
            ),
          )
        },
      })

      if (!result.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: result.error || 'Request failed',
                  error: true,
                  streaming: false,
                }
              : m,
          ),
        )
        toast.error(result.error || 'Request failed')
        return
      }

      const finalContent = result.content || ''
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: finalContent || m.content,
                streaming: false,
                costUsdc: result.costUsdc,
                provider: result.provider,
              }
            : m,
        ),
      )

      if (walletAddress) {
        try {
          const saved = await saveChatTurnMutation.mutateAsync({
            walletAddress,
            modelId: modelKey,
            modelSlug: model.slug,
            sessionId: sessionIdRef.current,
            title: userText.slice(0, 48) || 'New chat',
            messages: [
              { role: 'user', content: userText },
              {
                role: 'assistant',
                content: finalContent,
                costUsdc: result.costUsdc,
                provider: result.provider,
              },
            ],
          })
          if (saved.sessionId) setSession(saved.sessionId)
        } catch {
          /* non-fatal */
        }
        void invalidateUsageQueries(queryClient, walletAddress)
      }
    } catch (e) {
      if (abort.signal.aborted) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, content: m.content || '(stopped)' }
              : m,
          ),
        )
      } else {
        const msg = e instanceof Error ? e.message : 'Request failed'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, error: true, content: msg }
              : m,
          ),
        )
        toast.error(msg)
      }
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden border-l border-border bg-void">
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
          walletConnected={Boolean(walletAddress)}
        />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="workspace-bar flex items-center gap-2 border-b border-border bg-carbon px-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-paper">Assistant</p>
            <p className="truncate text-[10px] text-fog">
              {model.name} · {formatUsdc(model.priceUsdc)}
            </p>
          </div>
          {headerActions}
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-fog md:hidden"
            onClick={() => setMobileHistoryOpen(true)}
            aria-label="Chat history"
          >
            <History className="size-4" />
          </Button>
        </div>

        <Sheet open={mobileHistoryOpen} onOpenChange={setMobileHistoryOpen}>
          <SheetContent side="left" className="w-[min(100%,300px)] bg-carbon p-0">
            <SheetHeader className="border-b border-border px-3 py-3">
              <SheetTitle className="text-sm">History</SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100%-3rem)]">
              <ChatSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                loading={loadingSessions}
                collapsed={false}
                onCollapsedChange={() => undefined}
                onSelect={(id) => void loadSession(id)}
                onNewChat={() => void startNewChat()}
                onDelete={(id) => void deleteSession(id)}
                busy={busy}
                walletConnected={Boolean(walletAddress)}
              />
            </div>
          </SheetContent>
        </Sheet>

        <div
          ref={listRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-36 pt-3"
        >
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-xs text-fog">
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-6">
              <div className="mx-auto w-full max-w-lg">
                <div className="text-center">
                  <p className="text-sm font-medium text-paper">Build from an idea</p>
                  <p className="mt-1 text-xs text-fog">
                    Pick a starter and the assistant will create the files, explain the design,
                    and compile it.
                  </p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {IDE_STARTER_PROMPTS.map(({ title, description, prompt, icon: Icon }) => (
                    <button
                      key={title}
                      type="button"
                      className="group rounded-xl border border-border bg-carbon p-3 text-left transition-colors hover:border-smoke hover:bg-obsidian"
                      onClick={() => send(prompt)}
                      disabled={busy}
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-graphite text-acid-lime">
                        <Icon className="size-4" />
                      </span>
                      <span className="mt-2 block text-[13px] font-medium text-paper">
                        {title}
                      </span>
                      <span className="mt-1 block text-[11px] leading-snug text-fog">
                        {description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'ml-6 bg-obsidian text-paper'
                      : 'mr-2 bg-carbon text-mist shadow-[inset_0_0_0_1px_rgb(35,37,42)]',
                    m.error && 'border border-coral-red/40',
                  )}
                >
                  {m.role === 'assistant' ? (
                    <MarkdownMessage
                      content={m.content || (m.streaming ? '…' : '')}
                      streaming={m.streaming}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-[13px]">{m.content}</p>
                  )}
                </div>
              ))}
              {toolLog.length > 0 ? (
                <div className="mr-2 space-y-1 rounded-lg border border-border bg-void px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fog">
                    <Wrench className="size-3" />
                    Tools
                  </p>
                  {toolLog.map((line, i) => (
                    <p key={`${line}-${i}`} className="font-mono text-[11px] text-mist">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <ChatIslandDock className="md:px-3">
          <div className={chatIslandShellClassName}>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask to edit, compile, or explain…"
              className="max-h-40 min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-base shadow-none focus-visible:ring-0"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              disabled={busy}
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
                disabled={!input.trim()}
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

const IDE_STARTER_PROMPTS = [
  {
    title: 'Milestone escrow',
    description: 'Staged releases for grants, bounties, and freelance work.',
    icon: Coins,
    prompt:
      'Create a polished multi-file Algorand TypeScript milestone escrow project. Include a contract state machine for staged approvals and releases, a README with security assumptions, then compile it and fix any diagnostics.',
  },
  {
    title: 'Community voting',
    description: 'Weighted proposals with room for box-backed voter receipts.',
    icon: Vote,
    prompt:
      'Scaffold a multi-file Algorand TypeScript community voting project with proposal state, weighted yes/no votes, a README describing duplicate-vote protection with boxes, then compile and fix it.',
  },
  {
    title: 'Token-gated club',
    description: 'ASA membership tiers and rotating access epochs.',
    icon: KeyRound,
    prompt:
      'Build a multi-file Algorand TypeScript token-gated membership project with configurable ASA and minimum balance, access epochs, extension notes for tiers, then compile and fix all diagnostics.',
  },
  {
    title: 'API credit meter',
    description: 'Prepaid usage for AI agents and machine-to-machine APIs.',
    icon: Blocks,
    prompt:
      'Create a multi-file Algorand TypeScript prepaid API credit meter with issued, consumed, and remaining credit state, a README for per-user box storage and authorization, then compile and fix it.',
  },
] as const

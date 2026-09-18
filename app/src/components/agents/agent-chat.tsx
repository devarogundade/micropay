import { Loader2, Send, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { AgentAvatar } from '#/components/agents/agent-meta'
import {
  ChatIslandDock,
  chatIslandShellClassName,
} from '#/components/models/chat-composer-island'
import { MarkdownMessage } from '#/components/models/markdown-message'
import { ThinkingBlock } from '#/components/models/thinking-block'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { formatUsdc } from '#/data/models'
import { agentChatCompletions, type Agent } from '#/lib/agents-api'
import { useWallet } from '#/lib/wallet'

type ChatMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  error?: boolean
}

let msgSeq = 0
function uid() {
  msgSeq += 1
  return `m-${Date.now()}-${msgSeq}`
}

export function AgentChat({ agent }: { agent: Agent }) {
  const { account, fetchWithPay, setConnectOpen } = useWallet()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  function sendNow() {
    const text = input.trim()
    if (!text || busy) return
    if (!account || !fetchWithPay) {
      setConnectOpen(true)
      toast.message('Connect a wallet to prompt this agent')
      return
    }

    const userMsg: ChatMsg = { id: uid(), role: 'user', content: text }
    const assistantId = uid()
    const assistantMsg: ChatMsg = { id: assistantId, role: 'assistant', content: '' }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setBusy(true)

    const history = [...messages, userMsg].slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    void agentChatCompletions({
      slug: agent.slug,
      messages: history,
      stream: true,
      fetchImpl: fetchWithPay,
      onDelta: (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: m.content + (delta.content ?? ''),
                  reasoning: (m.reasoning ?? '') + (delta.reasoning ?? ''),
                }
              : m,
          ),
        )
      },
    })
      .then((result) => {
        if (!result.ok) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: result.error || 'Request failed',
                    error: true,
                  }
                : m,
            ),
          )
          toast.error(result.error || 'Request failed')
          return
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: result.content, reasoning: result.reasoning }
              : m,
          ),
        )
      })
      .catch((err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: err instanceof Error ? err.message : 'Request failed', error: true }
              : m,
          ),
        )
        toast.error(err instanceof Error ? err.message : 'Request failed')
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-40 pt-4 md:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 pt-16 text-center">
            <AgentAvatar agent={agent} className="size-16 rounded-2xl" />
            <h2 className="text-xl font-semibold text-ink">{agent.name}</h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              {agent.description ||
                `Prompt ${agent.name} — each request costs ${formatUsdc(agent.priceUsdc)} and is grounded in the creator's knowledge base.`}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatUsdc(agent.priceUsdc)} / use · by {agent.creatorShort}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                    {m.reasoning ? (
                      <ThinkingBlock text={m.reasoning} streaming={busy && !m.content} />
                    ) : null}
                    {m.error ? (
                      <p className="text-sm text-destructive">{m.content}</p>
                    ) : (
                      <MarkdownMessage content={m.content} streaming={busy && !m.content} tone="assistant" />
                    )}
                  </div>
                </div>
              ),
            )}
            {busy ? (
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {messages[messages.length - 1]?.role === 'assistant' &&
                messages[messages.length - 1]?.content
                  ? 'Streaming…'
                  : 'Thinking…'}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <ChatIslandDock>
        <form
          className={chatIslandShellClassName}
          onSubmit={(e) => {
            e.preventDefault()
            sendNow()
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${agent.name}…`}
            rows={1}
            className="max-h-40 min-h-12 flex-1 resize-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendNow()
              }
            }}
          />
          {busy ? (
            <Button type="button" variant="secondary" size="icon" aria-label="Stop">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Send">
              <Send className="size-4" />
            </Button>
          )}
        </form>
      </ChatIslandDock>
    </div>
  )
}
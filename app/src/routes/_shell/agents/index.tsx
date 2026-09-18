import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Bot, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AgentCard } from '#/components/agents/agent-card'
import { EmptyState } from '#/components/ui/empty-state'
import { ErrorState } from '#/components/ui/error-state'
import { LoadingState } from '#/components/ui/loading-state'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { fetchAgents, type AgentType } from '#/lib/agents-api'
import { queryKeys } from '#/lib/query-keys'

type AgentsSearch = { type?: 'chat' | 'image' | 'audio' | 'all' }

function parseType(value: unknown): AgentsSearch['type'] {
  if (value === 'chat' || value === 'image' || value === 'audio' || value === 'all') {
    return value
  }
  return undefined
}

export const Route = createFileRoute('/_shell/agents/')({
  validateSearch: (search: Record<string, unknown>): AgentsSearch => {
    const type = parseType(search.type)
    return type ? { type } : {}
  },
  component: AgentsPage,
})

function AgentsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const type = search.type ?? 'all'
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('recent')

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list({ q, type, sort }),
    queryFn: () =>
      fetchAgents({ q: q || undefined, type, sort, limit: 50 }),
    staleTime: 20_000,
  })

  const agents = agentsQuery.data?.data ?? []
  const meta = agentsQuery.data?.meta
  const isLoading = agentsQuery.isLoading

  const setType = (next: 'all' | AgentType) => {
    void navigate({
      search: (prev) => ({ ...prev, type: next === 'all' ? undefined : next }),
      replace: true,
    })
  }

  const filteredCount = useMemo(() => agents.length, [agents])

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-snow">
            <Bot className="size-5 text-mist" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Agents</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Discover shareable agents — a knowledge base, an underlying model, and a
              per-use USDC price. Anyone can create and sell one.
            </p>
          </div>
        </div>
        <Button asChild>
          <a href="/agents/new">
            <Plus className="size-4" />
            Create agent
          </a>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search agents…"
            className="h-11 pl-9 sm:h-9"
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as 'all' | AgentType)}>
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-40" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="chat">Chat</SelectItem>
            <SelectItem value="image">Image Gen</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-44" aria-label="Sort agents">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="popular">Popular</SelectItem>
            <SelectItem value="price-asc">Price ↑</SelectItem>
            <SelectItem value="price-desc">Price ↓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {agentsQuery.error ? (
        <ErrorState
          className="mt-10"
          title="Couldn’t load agents"
          description={agentsQuery.error.message}
          onRetry={() => void agentsQuery.refetch()}
        />
      ) : isLoading ? (
        <div className="mt-8 rounded-2xl border border-border bg-snow/80 p-6">
          <LoadingState compact label="Loading agents…" />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          className="mt-10"
          title={q || type !== 'all' ? 'No matches' : 'No agents yet'}
          description={
            q || type !== 'all'
              ? 'Try a different search or clear the filters.'
              : 'Be the first to create a shareable agent.'
          }
          action={
            !q && type === 'all' ? (
              <Button asChild className="mt-4">
                <a href="/agents/new">
                  <Plus className="size-4" />
                  Create agent
                </a>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mt-6 text-xs text-muted-foreground">
            {meta ? `${meta.total} agent${meta.total === 1 ? '' : 's'}` : `${filteredCount} agents`}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.slug} agent={agent} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
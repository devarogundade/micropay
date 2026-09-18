import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Eye, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { AgentAvatar, AgentTypeBadge } from '#/components/agents/agent-meta'
import { AgentEarnings } from '#/components/agents/agent-earnings'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/ui/empty-state'
import { LoadingState } from '#/components/ui/loading-state'
import {
  ListCard,
  ListCardGroup,
  ListCardRow,
} from '#/components/app/list-card'
import { formatUsdc } from '#/data/models'
import { fetchMyAgents } from '#/lib/agents-api'
import {
  useDeleteAgentMutation,
  usePauseAgentMutation,
  usePublishAgentMutation,
} from '#/lib/agents.mutations'
import { queryKeys } from '#/lib/query-keys'
import { useWallet } from '#/lib/wallet'

export const Route = createFileRoute('/_shell/agents/mine')({
  component: MyAgentsPage,
})

function MyAgentsPage() {
  const { account, setConnectOpen } = useWallet()
  const wallet = account?.address ?? null

  const mineQuery = useQuery({
    queryKey: queryKeys.agents.mine(wallet),
    queryFn: () => fetchMyAgents({ walletAddress: wallet! }),
    enabled: Boolean(wallet),
    staleTime: 15_000,
  })

  const pauseMutation = usePauseAgentMutation()
  const publishMutation = usePublishAgentMutation()
  const deleteMutation = useDeleteAgentMutation()

  async function toggleStatus(slug: string, status: 'published' | 'paused') {
    if (!wallet) return
    try {
      if (status === 'published') {
        await pauseMutation.mutateAsync({ walletAddress: wallet, slug })
        toast.success('Agent paused')
      } else {
        await publishMutation.mutateAsync({ walletAddress: wallet, slug })
        toast.success('Agent published')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update agent')
    }
  }

  async function remove(slug: string) {
    if (!wallet) return
    if (!window.confirm('Delete this agent? Earnings are not affected.')) return
    try {
      await deleteMutation.mutateAsync({ walletAddress: wallet, slug })
      toast.success('Agent deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete agent')
    }
  }

  if (!wallet) {
    return (
      <EmptyState
        className="mt-10"
        title="Connect a wallet"
        description="Connect your Algorand wallet to manage agents and see your earnings."
        action={
          <Button className="mt-4" onClick={() => setConnectOpen(true)}>
            Connect wallet
          </Button>
        }
      />
    )
  }

  const agents = mineQuery.data ?? []

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">My agents</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Create, update, and manage your shareable agents and earnings.
          </p>
        </div>
        <Button asChild>
          <Link to="/agents/new">
            <Plus className="size-4" />
            New agent
          </Link>
        </Button>
      </div>

      <section>
        {mineQuery.isLoading ? (
          <div className="rounded-2xl border border-border bg-snow/80 p-4">
            <LoadingState compact label="Loading your agents…" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            compact
            title="No agents yet"
            description="Create your first agent to start earning."
            action={
              <Button asChild className="mt-4">
                <Link to="/agents/new">
                  <Plus className="size-4" />
                  Create agent
                </Link>
              </Button>
            }
          />
        ) : (
          <ListCardGroup label="Your agents">
            {agents.map((agent) => (
              <ListCard key={agent.id}>
                <ListCardRow
                  leading={<AgentAvatar agent={agent} />}
                  title={
                    <span className="flex items-center gap-2">
                      {agent.name}
                      {agent.status === 'paused' ? (
                        <Badge variant="outline">Paused</Badge>
                      ) : agent.status === 'draft' ? (
                        <Badge variant="outline">Draft</Badge>
                      ) : null}
                    </span>
                  }
                  subtitle={`${formatUsdc(agent.priceUsdc)} / use · ${agent.useCount} uses`}
                  trailing={<AgentTypeBadge type={agent.type} />}
                  meta={
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="outline" size="xs">
                        <Link to="/agents/$slug" params={{ slug: agent.slug }}>
                          <Eye className="size-3" />
                          View
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="xs">
                        <Link
                          to="/agents/new"
                          search={{ edit: agent.slug }}
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          void toggleStatus(
                            agent.slug,
                            agent.status === 'published' ? 'published' : 'paused',
                          )
                        }
                      >
                        {agent.status === 'published' ? (
                          <>
                            <Pause className="size-3" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="size-3" />
                            Publish
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-destructive"
                        onClick={() => void remove(agent.slug)}
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </Button>
                    </div>
                  }
                />
              </ListCard>
            ))}
          </ListCardGroup>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Earnings</h2>
        <div className="mt-2">
          <AgentEarnings walletAddress={wallet} />
        </div>
      </section>
    </div>
  )
}
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AgentForm } from '#/components/agents/agent-form'
import { Button } from '#/components/ui/button'
import { LoadingState } from '#/components/ui/loading-state'
import { fetchAgent, type AgentInput } from '#/lib/agents-api'
import {
  useCreateAgentMutation,
  useUpdateAgentMutation,
} from '#/lib/agents.mutations'
import { queryKeys } from '#/lib/query-keys'
import { useWallet } from '#/lib/wallet'

type NewAgentSearch = { edit?: string }

export const Route = createFileRoute('/_shell/agents/new')({
  validateSearch: (search: Record<string, unknown>): NewAgentSearch => {
    const edit = typeof search.edit === 'string' ? search.edit : undefined
    return edit ? { edit } : {}
  },
  component: NewAgentPage,
})

function NewAgentPage() {
  const { edit } = Route.useSearch()
  const navigate = useNavigate()
  const { account } = useWallet()
  const createMutation = useCreateAgentMutation()
  const updateMutation = useUpdateAgentMutation()
  const [busy, setBusy] = useState(false)

  const editing = Boolean(edit)
  const editQuery = useQuery({
    queryKey: queryKeys.agents.detail(edit ?? null),
    queryFn: () => (edit ? fetchAgent(edit) : Promise.resolve(null)),
    enabled: Boolean(edit),
  })

  if (editing && editQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-snow/80 p-6">
        <LoadingState compact label="Loading agent…" />
      </div>
    )
  }

  if (editing && !editQuery.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink">Agent not found</h1>
        <Button asChild variant="outline">
          <Link to="/agents/mine">
            <ArrowLeft className="size-4" />
            Back to my agents
          </Link>
        </Button>
      </div>
    )
  }

  async function submit(input: AgentInput) {
    if (!account?.address) {
      toast.error('Connect a wallet first')
      return
    }
    setBusy(true)
    try {
      if (editing && edit) {
        await updateMutation.mutateAsync({
          walletAddress: account.address,
          slug: edit,
          agent: input,
        })
        toast.success('Agent updated')
      } else {
        await createMutation.mutateAsync({
          walletAddress: account.address,
          agent: input,
        })
        toast.success('Agent created — share your link')
      }
      void navigate({ to: '/agents/mine' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save agent')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <Link to={editing ? '/agents/mine' : '/agents'}>
          <ArrowLeft className="size-4" />
          {editing ? 'My agents' : 'Agents'}
        </Link>
      </Button>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {editing ? 'Edit agent' : 'Create an agent'}
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Combine a knowledge base, an underlying model, and a per-use USDC price into a
        shareable agent. You earn on every paid request.
      </p>
      <div className="mt-6">
        <AgentForm
          initial={editQuery.data ?? null}
          busy={busy}
          submitLabel={editing ? 'Save changes' : 'Create agent'}
          onSubmit={submit}
        />
      </div>
    </div>
  )
}
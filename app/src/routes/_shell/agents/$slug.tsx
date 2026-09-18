import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { AgentStudio } from '#/components/agents/agent-studio'
import { Button } from '#/components/ui/button'
import { fetchAgent } from '#/lib/agents-api'

export const Route = createFileRoute('/_shell/agents/$slug')({
  loader: async ({ params }) => {
    try {
      return await fetchAgent(params.slug)
    } catch {
      return null
    }
  },
  component: AgentDetailPage,
})

function AgentDetailPage() {
  const agent = Route.useLoaderData()

  if (!agent) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-start justify-center px-4 py-16">
        <h1 className="text-xl font-semibold text-ink">Agent not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This agent isn’t available — it may be paused or unpublished.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/agents">
            <ArrowLeft className="size-4" />
            Back to agents
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0">
      <AgentStudio agent={agent} />
    </div>
  )
}
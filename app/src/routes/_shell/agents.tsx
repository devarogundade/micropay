import { createFileRoute } from '@tanstack/react-router'
import { Puzzle } from 'lucide-react'

import { ListCard, ListCardGroup, ListCardRow } from '#/components/app/list-card'
import { Badge } from '#/components/ui/badge'
import { getApiUrl } from '#/lib/api-url'

export const Route = createFileRoute('/_shell/agents')({
  component: McpPage,
})

const TOOLS = [
  {
    name: 'list_models',
    badge: 'free',
    body: 'List available models with display prices.',
  },
  {
    name: 'micropay_endpoints',
    badge: 'free',
    body: 'Describe the paid HTTP APIs agents can call (chat, images, audio, IDE).',
  },
  {
    name: 'compile_puya_ts',
    badge: 'free',
    body: 'Compile Algorand TypeScript (single source or multi-file project) to TEAL.',
  },
] as const

function McpPage() {
  const apiOrigin = getApiUrl()

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-snow">
          <Puzzle className="size-5 text-mist" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            MCP
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Connect agents to Micropay. Browse models for free; paid chat,
            image, audio, and IDE agent calls settle via x402.
          </p>
        </div>
      </div>

      <section className="mt-8 grid gap-4 lg:mt-10 lg:grid-cols-2 lg:gap-6">
        <ListCard className="p-4 sm:p-5">
          <h2 className="font-semibold text-ink">Backend API</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Agent and tool requests are served by the Micropay backend at{' '}
            <code className="text-foreground">{apiOrigin}</code>.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Stateless Streamable HTTP MCP is available at{' '}
            <code className="text-foreground">{apiOrigin}/mcp</code>.
          </p>
        </ListCard>

        <div className="space-y-4">
          <ListCardGroup label="Available tools">
            {TOOLS.map((t) => (
              <ListCard key={t.name}>
                <ListCardRow
                  leading={
                    <Badge
                      variant="secondary"
                      className="h-fit font-mono text-[10px]"
                    >
                      {t.badge}
                    </Badge>
                  }
                  title={<code className="text-sm">{t.name}</code>}
                  subtitle={t.body}
                />
              </ListCard>
            ))}
          </ListCardGroup>

          <ListCard className="p-4">
            <h3 className="text-sm font-medium text-ink">
              Paid HTTP (wallet / x402)
            </h3>
            <ul className="mt-2 space-y-2 font-mono text-xs text-muted-foreground">
              <li>POST /api/v1/chat/completions</li>
              <li>POST /api/v1/images/generations</li>
              <li>POST /api/v1/audio/transcriptions</li>
              <li>POST /api/v1/ide/agent</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
               MCP provides discovery and Puya compilation; payment happens on these routes with a
              wallet-capable client (@x402/fetch). Persistence and settlement are
              owned by the backend.
            </p>
          </ListCard>
        </div>
      </section>
    </div>
  )
}

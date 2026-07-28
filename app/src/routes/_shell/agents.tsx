import { createFileRoute } from '@tanstack/react-router'
import { Check, Copy, ExternalLink, Puzzle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { ListCard, ListCardGroup, ListCardRow } from '#/components/app/list-card'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { DEFAULT_APP_ORIGIN, getAppOrigin } from '#/lib/site-meta'

export const Route = createFileRoute('/_shell/agents')({
  component: McpPage,
})

function resolveAppOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return (
    (typeof import.meta !== 'undefined' &&
      (import.meta.env?.VITE_PUBLIC_APP_URL as string | undefined)?.replace(
        /\/$/,
        '',
      )) ||
    getAppOrigin() ||
    DEFAULT_APP_ORIGIN
  )
}

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
  const appOrigin = resolveAppOrigin()
  const mcpUrl = `${appOrigin}/mcp`
  const configJson = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            micropay: {
              url: mcpUrl,
            },
          },
        },
        null,
        2,
      ),
    [mcpUrl],
  )
  const [copied, setCopied] = useState(false)

  const copyConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(configJson)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [configJson])

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-carbon">
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-paper">Cursor / Claude Desktop</h2>
            <Button type="button" variant="outline" size="sm" onClick={copyConfig}>
              {copied ? (
                <>
                  <Check className="size-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy config
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Paste into your MCP client config. Server endpoint:{' '}
            <code className="text-foreground">POST {mcpUrl}</code>
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-void p-3 font-mono text-xs text-mist">
            {configJson}
          </pre>
          <Button asChild variant="outline" size="sm" className="mt-4 min-h-10">
            <a href="/mcp" target="_blank" rel="noreferrer">
              Open /mcp
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
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
            <h3 className="text-sm font-medium text-paper">
              Paid HTTP (wallet / x402)
            </h3>
            <ul className="mt-2 space-y-2 font-mono text-xs text-muted-foreground">
              <li>POST /api/v1/chat/completions</li>
              <li>POST /api/v1/images/generations</li>
              <li>POST /api/v1/audio/transcriptions</li>
              <li>POST /api/v1/ide/agent</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              MCP lists model info only; payment happens on these routes with a
              wallet-capable client (@x402/fetch). All settle into the shared
              Activity table.
            </p>
          </ListCard>
        </div>
      </section>
    </div>
  )
}

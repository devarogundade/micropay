import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  MessageSquare,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import { formatUsdc, type Model } from '#/data/models'
import {
  MODELS_CATALOG_STALE_MS,
  ensureModelsCatalog,
} from '#/lib/models-catalog-query'
import { useWallet } from '#/lib/wallet'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_shell/try')({
  loader: async ({ context: { queryClient } }) => {
    const catalog = await ensureModelsCatalog(queryClient)
    return pickDemoModel(catalog.models)
  },
  staleTime: MODELS_CATALOG_STALE_MS,
  component: TryDemoPage,
})

function pickDemoModel(models: Model[]): Model | null {
  const chat = models.filter((m) => m.type === 'Chat')
  if (chat.length === 0) return null
  return [...chat].sort((a, b) => a.priceUsdc - b.priceUsdc)[0] ?? null
}

function TryDemoPage() {
  const model = Route.useLoaderData()
  const { account, setConnectOpen } = useWallet()
  const connected = Boolean(account?.address)

  const step1Done = connected
  const step2Ready = step1Done && Boolean(model)

  return (
    <div className="mx-auto max-w-2xl px-1 py-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Guided demo
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Pay once. Run a chat.
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Connect your Algorand wallet, open a lite model (~
        {model ? formatUsdc(model.priceUsdc) : '$0.01'} USDC), send one message,
        then check Activities for the receipt.
      </p>

      <ol className="mt-10 space-y-4">
        <Step
          done={step1Done}
          n={1}
          title="Connect wallet"
          body="Pera, Defly, Lute, or Kibisis. Micropay uses x402 — no API keys."
          action={
            connected ? (
              <p className="text-xs text-muted-foreground">
                Connected as{' '}
                <span className="font-mono text-foreground">
                  {account?.address.slice(0, 6)}…{account?.address.slice(-4)}
                </span>
              </p>
            ) : (
              <Button type="button" onClick={() => setConnectOpen(true)}>
                <Wallet className="size-4" />
                Connect wallet
              </Button>
            )
          }
        />

        <Step
          done={false}
          active={step2Ready}
          n={2}
          title="Open a ~$0.01 chat model"
          body={
            model
              ? `${model.name} · ${formatUsdc(model.priceUsdc)} USDC per use`
              : 'Loading the cheapest chat model…'
          }
          action={
            model ? (
              <Button asChild variant={step1Done ? 'default' : 'outline'}>
                <Link to="/models/$slug" params={{ slug: model.slug }}>
                  <MessageSquare className="size-4" />
                  Open {model.name}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/">Browse models</Link>
              </Button>
            )
          }
        />

        <Step
          done={false}
          n={3}
          title="Send a message & approve payment"
          body="The first request returns HTTP 402. Approve the USDC payment in your wallet, then the completion streams back."
        />

        <Step
          done={false}
          n={4}
          title="See your receipt"
          body="Settled spend and Algorand tx links show up under Activities."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/activities">
                Open Activities
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
      </ol>

      <p className="mt-10 text-xs text-muted-foreground">
        Prefer the API? See{' '}
        <Link to="/api-reference" className="text-foreground underline-offset-2 hover:underline">
          API reference
        </Link>{' '}
        or connect agents via{' '}
        <Link to="/agents" className="text-foreground underline-offset-2 hover:underline">
          MCP
        </Link>
        .
      </p>
    </div>
  )
}

function Step({
  n,
  title,
  body,
  action,
  done,
  active,
}: {
  n: number
  title: string
  body: string
  action?: ReactNode
  done?: boolean
  active?: boolean
}) {
  return (
    <li
      className={cn(
        'rounded-md border border-border bg-carbon/40 p-5',
        active && 'border-mist/30',
      )}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0 text-mist">
          {done ? (
            <CheckCircle2 className="size-5 text-pulse-green" />
          ) : (
            <Circle className="size-5 opacity-50" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            <span className="mr-2 font-mono text-xs text-muted-foreground">
              {String(n).padStart(2, '0')}
            </span>
            {title}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </li>
  )
}

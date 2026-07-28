import { useCallback, useState } from 'react'
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  ImageIcon,
  MessageSquare,
  Mic,
  Puzzle,
  Wallet,
} from 'lucide-react'

const MOMENTS = [
  {
    id: 'chat',
    icon: MessageSquare,
    label: 'Chat',
    line: 'Ask anything. Pay per message in USDC.',
  },
  {
    id: 'image',
    icon: ImageIcon,
    label: 'Images',
    line: 'Describe a scene. Settle only when it generates.',
  },
  {
    id: 'audio',
    icon: Mic,
    label: 'Audio',
    line: 'Speech to text — wallet-paid, no API keys.',
  },
  {
    id: 'code',
    icon: Code2,
    label: 'Code',
    line: 'Algorand TypeScript IDE. AI agent is x402-paid.',
  },
] as const

const STEPS = [
  {
    n: '01',
    title: 'Connect wallet',
    body: 'Pera, Defly, Lute, or Kibisis on Algorand.',
  },
  {
    n: '02',
    title: 'Pick a model',
    body: 'Lite models start around $0.01 USDC per use.',
  },
  {
    n: '03',
    title: 'Pay & run',
    body: 'x402 challenges; you approve; usage lands in Activities.',
  },
] as const

function mcpConfigJson(appOrigin: string) {
  return JSON.stringify(
    {
      mcpServers: {
        micropay: {
          url: `${appOrigin}/mcp`,
        },
      },
    },
    null,
    2,
  )
}

export function LandingPage({
  appOrigin,
  codeOrigin,
  siteOrigin,
}: {
  appOrigin: string
  codeOrigin: string
  siteOrigin: string
}) {
  const [copied, setCopied] = useState(false)
  const mcpJson = mcpConfigJson(appOrigin)

  const copyMcp = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mcpJson)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [mcpJson])

  return (
    <div className="flex min-h-svh flex-col">
      <header className="rise mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 md:px-8">
        <a href="/" className="inline-flex items-center gap-2 no-underline">
          <img
            src="/assets/brand/logo.svg"
            alt="Micropay"
            className="h-7 w-auto"
            width={180}
            height={52}
          />
        </a>
        <nav className="flex items-center gap-4 text-sm text-fog">
          <a href={appOrigin} className="transition-colors hover:text-paper">
            App
          </a>
          <a
            href={codeOrigin}
            className="hidden transition-colors hover:text-paper sm:inline"
          >
            IDE
          </a>
          <a
            href={`${appOrigin}/agents`}
            className="hidden transition-colors hover:text-paper md:inline"
          >
            MCP
          </a>
          <a
            href={`${appOrigin}/api-reference`}
            className="transition-colors hover:text-paper"
          >
            API
          </a>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pb-24 md:px-8">
        <section className="relative flex min-h-[78svh] flex-col items-center justify-center text-center">
          <div
            className="hero-line pointer-events-none absolute inset-x-0 top-1/3 h-px bg-linear-to-r from-transparent via-mist/25 to-transparent"
            aria-hidden
          />
          <p className="rise rise-delay-1 text-xs uppercase tracking-[0.22em] text-fog">
            Micropay
          </p>
          <h1 className="rise rise-delay-2 mt-5 max-w-2xl text-3xl font-medium tracking-tight text-paper md:text-5xl">
            Pay-per-use AI on Algorand.
          </h1>
          <p className="rise rise-delay-3 mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Chat, images, audio, and a puya-ts IDE — settled in USDC via x402.
            One GoPlausible entry on this apex. No subscriptions.
          </p>
          <div className="rise rise-delay-4 mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`${appOrigin}/try`}
              className="inline-flex items-center gap-2 rounded-md bg-paper px-5 py-2.5 text-sm font-medium text-void transition-opacity hover:opacity-90"
            >
              Try ~$0.01
              <ArrowRight className="size-4" />
            </a>
            <a
              href={`${appOrigin}/models`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-carbon px-5 py-2.5 text-sm text-mist transition-colors hover:border-mist/30 hover:text-paper"
            >
              Open app
            </a>
            <a
              href={codeOrigin}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-carbon px-5 py-2.5 text-sm text-mist transition-colors hover:border-mist/30 hover:text-paper"
            >
              Open IDE
            </a>
          </div>
          <div className="rise rise-delay-4 mt-10 flex items-center gap-3 text-xs text-muted-foreground">
            <img
              src="/assets/usdc.png"
              alt=""
              className="size-5"
              width={20}
              height={20}
            />
            <span>USDC</span>
            <span className="text-border">|</span>
            <img
              src="/assets/algorand.png"
              alt=""
              className="size-5 rounded"
              width={20}
              height={20}
            />
            <span>Algorand · x402</span>
          </div>
        </section>

        <section className="border-t border-border/60 py-20">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-fog">
            How it works
          </p>
          <h2 className="mt-3 text-center text-2xl font-medium tracking-tight text-paper">
            Wallet in. Pay once. Run.
          </h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="text-left">
                <p className="font-mono text-xs text-brand">{s.n}</p>
                <p className="mt-3 flex items-center gap-2 text-sm font-medium text-paper">
                  {s.n === '01' ? <Wallet className="size-4 text-mist" /> : null}
                  {s.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-center">
            <a
              href={`${appOrigin}/try`}
              className="text-sm text-mist underline-offset-4 hover:text-paper hover:underline"
            >
              Start the guided demo →
            </a>
          </div>
        </section>

        <section className="border-t border-border/60 py-20">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-fog">
            Surfaces
          </p>
          <h2 className="mt-3 text-center text-2xl font-medium tracking-tight text-paper">
            One product. Three hosts.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
            Merchant tracking stays on {siteOrigin.replace(/^https?:\/\//, '')}.
            App and IDE are product surfaces — not separate challenge entries.
          </p>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MOMENTS.map(({ id, icon: Icon, label, line }) => (
              <li
                key={id}
                className="rounded-md border border-border/70 bg-carbon/50 p-5"
              >
                <Icon className="size-4 text-mist/80" />
                <p className="mt-4 text-sm font-medium text-paper">{label}</p>
                <p className="mt-2 text-sm text-muted-foreground">{line}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border/60 py-20">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-md">
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-fog">
                <Puzzle className="size-3.5" />
                Agents
              </p>
              <h2 className="mt-3 text-2xl font-medium tracking-tight text-paper">
                MCP for free discovery. HTTP for paid calls.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Point Cursor or Claude Desktop at Micropay MCP to list models and
                compile puya-ts for free. Chat, images, audio, and the IDE agent
                still settle through wallet-paid x402 HTTP APIs on the app host.
              </p>
              <a
                href={`${appOrigin}/agents`}
                className="mt-6 inline-flex items-center gap-2 text-sm text-mist hover:text-paper"
              >
                Full MCP docs
                <ArrowRight className="size-4" />
              </a>
            </div>
            <div className="w-full max-w-md rounded-md border border-border bg-carbon/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-paper">MCP config</p>
                <button
                  type="button"
                  onClick={copyMcp}
                  className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-mist transition-colors hover:border-mist/40 hover:text-paper"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-brand" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-mist">
                {mcpJson}
              </pre>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Free tools: list_models, micropay_endpoints, compile_puya_ts.
                Paid inference uses the HTTP APIs with a wallet-capable client.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <img
            src="/assets/brand/logo.svg"
            alt="Micropay"
            className="h-5 w-auto opacity-80"
          />
          <p className="text-xs text-muted-foreground">
            Sole merchant entry ·{' '}
            <a
              href={`${siteOrigin}/.well-known/x402.json`}
              className="text-mist hover:text-paper"
            >
              x402.json
            </a>{' '}
            · © 2026 Micropay
          </p>
        </div>
      </footer>
    </div>
  )
}

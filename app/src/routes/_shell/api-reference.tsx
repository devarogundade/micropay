import { createFileRoute } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { BottomSheet } from '#/components/app/bottom-sheet'
import { ListCard, ListCardGroup, ListCardRow } from '#/components/app/list-card'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'

export const Route = createFileRoute('/_shell/api-reference')({
  component: ApiReferencePage,
})

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/v1/chat/completions',
    desc: 'Chat completion (OpenAI-compatible, streaming supported). Anthropic-only models (e.g. Claude) are auto-routed via /v1/messages. x402 settle then Micropay runs inference. Provider keys stay server-side.',
  },
  {
    method: 'GET',
    path: '/api/v1/models',
    desc: 'List available models. Add ?raw=1 for the upstream catalog payload.',
  },
  {
    method: 'POST',
    path: '/api/v1/images/generations',
    desc: 'Image generation (requires Supabase Storage). Default waits for the job; ?async=1 returns jobId after payment (Studio then uses SSE).',
  },
  {
    method: 'GET',
    path: '/api/v1/images/jobs/:jobId',
    desc: 'Job status. JSON poll by default; ?stream=1 (or Accept: text/event-stream) for SSE progress until done. On completion persists images to Supabase (no extra payment).',
  },
  {
    method: 'POST',
    path: '/api/v1/audio/transcriptions',
    desc: 'Speech-to-text multipart transcription (50 MB max).',
  },
  {
    method: 'POST',
    path: '/api/v1/storage/upload',
    desc: 'Upload a file to Supabase Storage (multipart field: file; optional folder). Hard 50 MB limit. Server-side only.',
  },
  {
    method: 'GET',
    path: '/api/v1/activities',
    desc: 'Usage history from settled x402 requests. Optional ?wallet= & X-Wallet-Address.',
  },
  {
    method: 'GET',
    path: '/api/v1/chat/sessions',
    desc: 'List chat sessions for a wallet (?wallet=&modelId=&latest=1).',
  },
  {
    method: 'POST',
    path: '/api/v1/chat/sessions',
    desc: 'Create a session or append messages (persist chat turn).',
  },
  {
    method: 'GET',
    path: '/api/v1/chat/sessions/:sessionId',
    desc: 'Fetch a session and its messages.',
  },
  {
    method: 'DELETE',
    path: '/api/v1/chat/sessions/:sessionId',
    desc: 'Delete a session (or ?clear=1 to wipe messages only).',
  },
  {
    method: 'POST',
    path: '/api/v1/puya-ts/compile',
    desc: 'Compile Algorand TypeScript (puya-ts) to TEAL. Body: { source } or { files, entry }. Free (not x402).',
  },
] as const

type Endpoint = (typeof ENDPOINTS)[number]

function ApiReferencePage() {
  const [selected, setSelected] = useState<Endpoint | null>(null)

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        API Reference
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Micropay exposes an OpenAI-compatible surface with x402 payment headers.
        Clients pay USDC on Algorand; Micropay settles via the GoPlausible
        facilitator, then fulfills inference through its server-side provider
        gateway.
      </p>

      <ListCard className="mt-6 max-w-2xl p-4">
        <p className="font-medium text-paper">Realtime</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="text-mist">SSE</span> — chat token streaming (
            <code className="text-xs">stream:true</code>) and image job progress (
            <code className="text-xs">GET …/jobs/:id?stream=1</code>).
          </li>
          <li>
            <span className="text-mist">WebSocket</span> — not used; HTTP SSE covers
            streaming.
          </li>
          <li>
            <span className="text-mist">JSON poll</span> — optional fallback for
            image jobs without <code className="text-xs">stream=1</code>.
          </li>
        </ul>
      </ListCard>

      <Tabs defaultValue="gateway" className="mt-8">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="gateway" className="min-h-9">
            Gateway
          </TabsTrigger>
          <TabsTrigger value="x402" className="min-h-9">
            x402 flow
          </TabsTrigger>
          <TabsTrigger value="facilitator" className="min-h-9">
            Facilitator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gateway" className="mt-6 space-y-3">
          {/* Mobile card list + detail sheet */}
          <div className="md:hidden">
            <ListCardGroup>
              {ENDPOINTS.map((e) => (
                <ListCard
                  key={e.path}
                  as="button"
                  interactive
                  onClick={() => setSelected(e)}
                >
                  <ListCardRow
                    leading={
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px]"
                      >
                        {e.method}
                      </Badge>
                    }
                    title={
                      <code className="text-[13px] leading-snug">{e.path}</code>
                    }
                    subtitle={
                      <span className="line-clamp-2">{e.desc}</span>
                    }
                    trailing={
                      <ChevronRight className="size-4 text-muted-foreground" />
                    }
                  />
                </ListCard>
              ))}
            </ListCardGroup>
          </div>

          {/* Desktop endpoint rows */}
          <div className="hidden space-y-3 md:block">
            {ENDPOINTS.map((e) => (
              <div
                key={e.path}
                className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
              >
                <Badge
                  variant="outline"
                  className="w-fit font-mono text-[11px]"
                >
                  {e.method}
                </Badge>
                <div>
                  <code className="text-sm font-medium">{e.path}</code>
                  <p className="mt-1 text-sm text-muted-foreground">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <pre className="overflow-x-auto rounded-xl border border-border bg-ink p-4 text-xs text-white">
            {`# Browser clients: use @x402/fetch + Algorand wallet (auto PAYMENT-SIGNATURE).
# Agents: handle 402 → sign → retry with PAYMENT-SIGNATURE.

curl http://localhost:3000/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: <signed-payload>" \\
  -d '{
    "model": "glm-5.2",
    "messages": [{"role":"user","content":"Hello"}]
  }'`}
          </pre>
        </TabsContent>

        <TabsContent value="x402" className="mt-6 space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Client hits a paywalled resource → 402 + payment requirements.</li>
            <li>
              Client constructs an{' '}
              <strong className="font-medium text-foreground">exact</strong> USDC
              ASA transfer on Algorand.
            </li>
            <li>
              Facilitator <code>POST /verify</code> then <code>POST /settle</code>.
            </li>
            <li>
              Client retries with payment proof → Micropay runs inference.
            </li>
          </ol>
          <p className="text-muted-foreground">
            Required env: <code className="text-xs">X402_PAY_TO</code>, optional{' '}
            <code className="text-xs">X402_NETWORK</code>,{' '}
            <code className="text-xs">X402_FACILITATOR_URL</code>.
          </p>
        </TabsContent>

        <TabsContent value="facilitator" className="mt-6 space-y-4 text-sm">
          <p className="text-muted-foreground">
            Live facilitator:{' '}
            <a
              href="https://facilitator.goplausible.xyz/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              facilitator.goplausible.xyz
            </a>
          </p>
          <ul className="space-y-2 font-mono text-xs">
            <li>GET /supported</li>
            <li>POST /verify</li>
            <li>POST /settle</li>
          </ul>
        </TabsContent>
      </Tabs>

      <BottomSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title={
          selected ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {selected.method}
              </Badge>
              <code className="text-sm">{selected.path}</code>
            </span>
          ) : (
            'Endpoint'
          )
        }
      >
        {selected ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {selected.desc}
          </p>
        ) : null}
      </BottomSheet>
    </div>
  )
}

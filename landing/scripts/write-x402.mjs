/**
 * Writes authoritative merchant card to public/.well-known/x402.json
 * Run before Vite build so apex hosts the live GoPlausible entry.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const site = (
  process.env.VITE_PUBLIC_SITE_URL || 'https://micropay.website'
).replace(/\/$/, '')
const app = (
  process.env.VITE_PUBLIC_APP_URL || 'https://app.micropay.website'
).replace(/\/$/, '')
const code = (
  process.env.VITE_PUBLIC_CODE_URL || 'https://code.micropay.website'
).replace(/\/$/, '')

const card = {
  name: 'Micropay',
  serviceName: 'Micropay AI',
  description:
    'Pay-per-use AI for chat, images, and audio across popular models. Pay with your Algorand wallet in USDC via x402 — no subscriptions or API keys.',
  protocol: 'x402',
  version: '2',
  network: 'algorand:mainnet',
  asset: 'USDC',
  facilitator: 'https://facilitator.goplausible.xyz',
  tag: 'x402-global-challenge',
  icon: `${site}/assets/brand/icon.svg`,
  logo: `${site}/assets/brand/logo.svg`,
  homepage: `${site}/`,
  documentation: `${app}/api-reference`,
  llms: `${site}/llms.txt`,
  mcp: `${app}/mcp`,
  products: {
    app: `${app}/`,
    code: `${code}/`,
  },
  endpoints: [
    {
      method: 'POST',
      path: `${app}/api/v1/chat/completions`,
      serviceName: 'Micropay Chat',
      description:
        'OpenAI-compatible chat completions with optional SSE streaming for Micropay models (diverse popular LLMs).',
      mimeType: 'application/json',
      tags: ['ai', 'chat', 'llm', 'x402', 'openai-compatible'],
    },
    {
      method: 'POST',
      path: `${app}/api/v1/images/generations`,
      serviceName: 'Micropay Images',
      description:
        'OpenAI-compatible image generation returning base64 PNG (b64_json) for Micropay models.',
      mimeType: 'application/json',
      tags: ['ai', 'images', 'generation', 'x402', 'openai-compatible'],
    },
    {
      method: 'POST',
      path: `${app}/api/v1/audio/transcriptions`,
      serviceName: 'Micropay Audio',
      description:
        'OpenAI-compatible speech-to-text transcription (multipart audio upload) returning text for Micropay models.',
      mimeType: 'application/json',
      tags: ['ai', 'audio', 'transcription', 'x402', 'speech-to-text'],
    },
    {
      method: 'POST',
      path: `${app}/api/v1/ide/agent`,
      serviceName: 'Micropay IDE',
      description:
        'Micropay IDE assistant with project file tools, compile, and Algorand TypeScript knowledge.',
      mimeType: 'application/json',
      tags: ['ai', 'ide', 'puya-ts', 'x402', 'algorand'],
    },
  ],
}

const out = join(root, 'public', '.well-known', 'x402.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(card, null, 2)}\n`, 'utf8')
console.log(`Wrote ${out}`)

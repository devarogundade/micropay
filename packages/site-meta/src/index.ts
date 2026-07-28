/**
 * Shared Micropay identity for all surfaces (landing / app / code).
 *
 * GoPlausible / Bazaar / hackathon entry rules:
 * - ONE merchant identity: apex `micropay.website` (landing)
 * - ONE `X402_PAY_TO` across all paid APIs (lives on app)
 * - Do NOT register app. or code. as separate Bazaar / challenge merchants
 * - Merchant card + OG scrape live on the apex; endpoints point at app.
 */

/** Production origins — override via env in each deployable. */
export const DEFAULT_SITE_ORIGIN = 'https://micropay.website'
export const DEFAULT_APP_ORIGIN = 'https://app.micropay.website'
export const DEFAULT_CODE_ORIGIN = 'https://code.micropay.website'

export const SITE_NAME = 'Micropay'
/** ≤ 32 printable ASCII — Bazaar serviceName limit. */
export const SITE_SERVICE_NAME = 'Micropay AI'
export const SITE_TAGLINE = 'Pay-per-use AI gateway'
export const SITE_DESCRIPTION =
  'Pay-per-use AI for chat, images, and audio across popular models. Pay with your Algorand wallet in USDC via x402 — no subscriptions or API keys.'
export const SITE_KEYWORDS = [
  'Micropay',
  'x402',
  'Algorand',
  'USDC',
  'AI API',
  'micropayments',
  'chat completions',
  'image generation',
  'speech to text',
  'puya-ts',
  'Algorand IDE',
] as const

/** Shared Bazaar topical tags (≤ 5, each ≤ 32 ASCII). */
export const X402_SERVICE_TAGS = [
  'ai',
  'x402',
  'algorand',
  'usdc',
  'openai-compatible',
] as const

export const X402_CHALLENGE_TAG = 'x402-global-challenge'
export const GOPLAUSIBLE_FACILITATOR = 'https://facilitator.goplausible.xyz'

export const X402_ROUTE_META = {
  chat: {
    serviceName: 'Micropay Chat',
    tags: ['ai', 'chat', 'llm', 'x402', 'openai-compatible'] as string[],
  },
  images: {
    serviceName: 'Micropay Images',
    tags: ['ai', 'images', 'generation', 'x402', 'openai-compatible'] as string[],
  },
  audio: {
    serviceName: 'Micropay Audio',
    tags: ['ai', 'audio', 'transcription', 'x402', 'speech-to-text'] as string[],
  },
  ide: {
    serviceName: 'Micropay IDE',
    tags: ['ai', 'ide', 'puya-ts', 'x402', 'algorand'] as string[],
  },
} as const

function trimOrigin(value: string | undefined): string | undefined {
  const v = value?.trim()
  if (!v) return undefined
  try {
    const u = new URL(v.includes('://') ? v : `https://${v}`)
    if (!isPublicHttpOrigin(u)) return undefined
    return u.origin
  } catch {
    return undefined
  }
}

function readEnv(name: string): string | undefined {
  try {
    if (typeof process !== 'undefined' && process.env?.[name]) {
      return process.env[name]?.trim() || undefined
    }
  } catch {
    /* ignore */
  }
  return undefined
}

function readViteEnv(name: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined') {
      const env = (import.meta as ImportMeta & { env?: Record<string, string> })
        .env
      return env?.[name]?.trim() || undefined
    }
  } catch {
    /* ignore */
  }
  return undefined
}

export function isPublicHttpOrigin(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return false
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return false
  return true
}

/**
 * Apex / merchant identity origin (GoPlausible + Bazaar scrape target).
 * Prefer PUBLIC_SITE_URL; fall back to PUBLIC_APP_URL for single-site deploys.
 */
export function getSiteOrigin(): string | undefined {
  return (
    trimOrigin(readEnv('PUBLIC_SITE_URL')) ||
    trimOrigin(readViteEnv('VITE_PUBLIC_SITE_URL')) ||
    trimOrigin(readEnv('PUBLIC_APP_URL')) ||
    trimOrigin(readViteEnv('VITE_PUBLIC_APP_URL')) ||
    trimOrigin(readEnv('URL')) ||
    trimOrigin(readEnv('DEPLOY_PRIME_URL'))
  )
}

/** App product surface (`app.` subdomain). */
export function getAppOrigin(): string | undefined {
  return (
    trimOrigin(readEnv('PUBLIC_APP_URL')) ||
    trimOrigin(readViteEnv('VITE_PUBLIC_APP_URL')) ||
    trimOrigin(readViteEnv('VITE_APP_ORIGIN'))
  )
}

/** IDE product surface (`code.` subdomain). */
export function getCodeOrigin(): string | undefined {
  return (
    trimOrigin(readEnv('PUBLIC_CODE_URL')) ||
    trimOrigin(readViteEnv('VITE_PUBLIC_CODE_URL')) ||
    trimOrigin(readViteEnv('VITE_CODE_ORIGIN'))
  )
}

export function originFromRequest(request: Request): string | undefined {
  try {
    const u = new URL(request.url)
    if (!isPublicHttpOrigin(u)) return undefined
    return u.origin
  } catch {
    return undefined
  }
}

/** Absolute public icon for Bazaar — always prefer apex merchant origin. */
export function getMerchantIconUrl(request?: Request): string | undefined {
  const origin =
    getSiteOrigin() ||
    getAppOrigin() ||
    (request ? originFromRequest(request) : undefined)
  if (!origin) return undefined
  return `${origin}/assets/brand/icon.svg`
}

/** Absolute endpoint path on the app surface (for merchant card on apex). */
export function appEndpointUrl(path: string, appOrigin?: string): string {
  const base =
    appOrigin || getAppOrigin() || DEFAULT_APP_ORIGIN
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base.replace(/\/$/, '')}${p}`
}

/**
 * Authoritative GoPlausible / Bazaar merchant card.
 * Host this at `https://micropay.website/.well-known/x402.json`.
 * Endpoint URLs are absolute on `app.micropay.website` so scrapers resolve
 * paid APIs without treating app/code as separate merchants.
 */
export function buildMerchantCard(opts?: {
  siteOrigin?: string
  appOrigin?: string
}) {
  const site = (opts?.siteOrigin || getSiteOrigin() || DEFAULT_SITE_ORIGIN).replace(
    /\/$/,
    '',
  )
  const app = (opts?.appOrigin || getAppOrigin() || DEFAULT_APP_ORIGIN).replace(
    /\/$/,
    '',
  )

  return {
    name: SITE_NAME,
    serviceName: SITE_SERVICE_NAME,
    description: SITE_DESCRIPTION,
    protocol: 'x402',
    version: '2',
    network: 'algorand:mainnet',
    asset: 'USDC',
    facilitator: GOPLAUSIBLE_FACILITATOR,
    tag: X402_CHALLENGE_TAG,
    icon: `${site}/assets/brand/icon.svg`,
    logo: `${site}/assets/brand/logo.svg`,
    homepage: `${site}/`,
    documentation: `${app}/api-reference`,
    llms: `${site}/llms.txt`,
    mcp: `${app}/mcp`,
    products: {
      app: `${app}/`,
      code: `${(getCodeOrigin() || DEFAULT_CODE_ORIGIN).replace(/\/$/, '')}/`,
    },
    endpoints: [
      {
        method: 'POST',
        path: `${app}/api/v1/chat/completions`,
        serviceName: X402_ROUTE_META.chat.serviceName,
        description:
          'OpenAI-compatible chat completions with optional SSE streaming for Micropay models (diverse popular LLMs).',
        mimeType: 'application/json',
        tags: X402_ROUTE_META.chat.tags,
      },
      {
        method: 'POST',
        path: `${app}/api/v1/images/generations`,
        serviceName: X402_ROUTE_META.images.serviceName,
        description:
          'OpenAI-compatible image generation returning base64 PNG (b64_json) for Micropay models.',
        mimeType: 'application/json',
        tags: X402_ROUTE_META.images.tags,
      },
      {
        method: 'POST',
        path: `${app}/api/v1/audio/transcriptions`,
        serviceName: X402_ROUTE_META.audio.serviceName,
        description:
          'OpenAI-compatible speech-to-text transcription (multipart audio upload) returning text for Micropay models.',
        mimeType: 'application/json',
        tags: X402_ROUTE_META.audio.tags,
      },
      {
        method: 'POST',
        path: `${app}/api/v1/ide/agent`,
        serviceName: X402_ROUTE_META.ide.serviceName,
        description:
          'Micropay IDE assistant with project file tools, compile, and Algorand TypeScript knowledge.',
        mimeType: 'application/json',
        tags: X402_ROUTE_META.ide.tags,
      },
    ],
  }
}

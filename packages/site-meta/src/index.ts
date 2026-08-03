/**
 * Shared Micropay identity constants + per-product merchant builders.
 *
 * Architecture:
 * - `app` = TanStack Start fullstack (AI gateway product).
 * - `code` = TanStack Start fullstack IDE (own deploy / merchant card).
 * - Landing = Vite SPA marketing.
 * - App and code may share ONE DATABASE_URL (same Postgres instance) but
 *   own completely separate Prisma schemas, migrations, and tables.
 * - App-owned: User, Activity, Chat*, Image*, Transcription, UserModelUsage
 *   (app/prisma + Prisma Migrate)
 * - Code-owned: CodeUser, CodeActivity, CodeUserModelUsage, CodeTemplate,
 *   CodeTemplateClone (code/prisma → Postgres schema `code` via db push)
 * - Zero shared table names / rows / Prisma models between products.
 * - Challenge approach: GoPlausible facilitator + `x402-global-challenge`
 *   (+ product merchant cards for discovery).
 */

/** Production origins — override via env in each deployable. */
export const DEFAULT_SITE_ORIGIN = 'https://micropay.website'
export const DEFAULT_APP_ORIGIN = 'https://app.micropay.website'
export const DEFAULT_CODE_ORIGIN = 'https://code.micropay.website'
export const DEFAULT_API_ORIGIN = 'https://api.micropay.website'

export const SITE_NAME = 'Micropay'
/** ≤ 32 printable ASCII — Bazaar serviceName limit. */
export const SITE_SERVICE_NAME = 'Micropay AI'
export const SITE_TAGLINE = 'Pay-per-use AI gateway'
export const SITE_DESCRIPTION =
  'Pay-per-use AI for chat, images, and audio across popular models. Pay with your Algorand wallet in USDC via x402 — no subscriptions or API keys.'
export const CODE_SERVICE_NAME = 'Micropay IDE'
export const CODE_TAGLINE = 'Algorand TypeScript IDE'
export const CODE_DESCRIPTION =
  'AI-assisted Algorand TypeScript (puya-ts) IDE. Edit, compile, and deploy — agent calls settle in USDC via x402.'
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

/** Same challenge tag on every independent product entry. */
export const X402_CHALLENGE_TAG = 'x402-global-challenge'
export const GOPLAUSIBLE_FACILITATOR = 'https://facilitator.goplausible.xyz'

/** App product route meta (app backend only). */
export const X402_APP_ROUTE_META = {
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
} as const

/** IDE product route meta (code backend only). */
export const X402_CODE_ROUTE_META = {
  ide: {
    serviceName: 'Micropay IDE',
    tags: ['ai', 'ide', 'puya-ts', 'x402', 'algorand'] as string[],
  },
  clone: {
    serviceName: 'Micropay Templates',
    tags: ['ide', 'templates', 'puya-ts', 'x402', 'algorand'] as string[],
  },
} as const

/**
 * @deprecated Use X402_APP_ROUTE_META / X402_CODE_ROUTE_META.
 * Kept so existing app imports keep compiling during the split.
 */
export const X402_ROUTE_META = {
  ...X402_APP_ROUTE_META,
  ...X402_CODE_ROUTE_META,
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

/** Marketing apex origin (landing). Not a shared API/DB host. */
export function getSiteOrigin(): string | undefined {
  return (
    trimOrigin(readEnv('PUBLIC_SITE_URL')) ||
    trimOrigin(readViteEnv('VITE_PUBLIC_SITE_URL')) ||
    trimOrigin(readEnv('URL')) ||
    trimOrigin(readEnv('DEPLOY_PRIME_URL'))
  )
}

/** App product origin (`app.` subdomain). */
export function getAppOrigin(): string | undefined {
  return (
    trimOrigin(readEnv('PUBLIC_APP_URL')) ||
    trimOrigin(readViteEnv('VITE_PUBLIC_APP_URL')) ||
    trimOrigin(readViteEnv('VITE_APP_ORIGIN'))
  )
}

/** IDE product origin (`code.` subdomain). */
export function getCodeOrigin(): string | undefined {
  return (
    trimOrigin(readEnv('PUBLIC_CODE_URL')) ||
    trimOrigin(readViteEnv('VITE_PUBLIC_CODE_URL')) ||
    trimOrigin(readViteEnv('VITE_CODE_ORIGIN'))
  )
}

/** Shared public resource-server origin. All paid routes use this one domain. */
export function getApiOrigin(): string | undefined {
  return (
    trimOrigin(readEnv('PUBLIC_API_URL')) ||
    trimOrigin(readViteEnv('VITE_PUBLIC_API_URL'))
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

/** Absolute public icon — prefer the product host, then marketing apex. */
export function getMerchantIconUrl(
  request?: Request,
  prefer: 'site' | 'app' | 'code' = 'site',
): string | undefined {
  const origin =
    (prefer === 'app'
      ? getAppOrigin()
      : prefer === 'code'
        ? getCodeOrigin()
        : getSiteOrigin()) ||
    getSiteOrigin() ||
    getAppOrigin() ||
    getCodeOrigin() ||
    (request ? originFromRequest(request) : undefined)
  if (!origin) return undefined
  return `${origin}/assets/brand/icon.svg`
}

/** Absolute endpoint path on the app surface. */
export function appEndpointUrl(path: string, appOrigin?: string): string {
  const base = appOrigin || getAppOrigin() || DEFAULT_APP_ORIGIN
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base.replace(/\/$/, '')}${p}`
}

/** Absolute endpoint path on the IDE (code) surface. */
export function codeEndpointUrl(path: string, codeOrigin?: string): string {
  const base = codeOrigin || getCodeOrigin() || DEFAULT_CODE_ORIGIN
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base.replace(/\/$/, '')}${p}`
}

/** App product GoPlausible / Bazaar merchant card (chat / images / audio only). */
export function buildAppMerchantCard(opts?: {
  siteOrigin?: string
  appOrigin?: string
  apiOrigin?: string
}) {
  const site = (opts?.siteOrigin || getSiteOrigin() || DEFAULT_SITE_ORIGIN).replace(
    /\/$/,
    '',
  )
  const app = (opts?.appOrigin || getAppOrigin() || DEFAULT_APP_ORIGIN).replace(
    /\/$/,
    '',
  )
  const api = (opts?.apiOrigin || getApiOrigin() || DEFAULT_API_ORIGIN).replace(
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
    homepage: `${app}/`,
    documentation: `${app}/api-reference`,
    llms: `${site}/llms.txt`,
    mcp: `${api}/mcp`,
    product: 'app',
    endpoints: [
      {
        method: 'POST',
        path: `${api}/api/v1/chat/completions`,
        serviceName: X402_APP_ROUTE_META.chat.serviceName,
        description:
          'OpenAI-compatible chat completions with optional SSE streaming for Micropay models (diverse popular LLMs).',
        mimeType: 'application/json',
        tags: X402_APP_ROUTE_META.chat.tags,
      },
      {
        method: 'POST',
        path: `${api}/api/v1/images/generations`,
        serviceName: X402_APP_ROUTE_META.images.serviceName,
        description:
          'OpenAI-compatible image generation returning base64 PNG (b64_json) for Micropay models.',
        mimeType: 'application/json',
        tags: X402_APP_ROUTE_META.images.tags,
      },
      {
        method: 'POST',
        path: `${api}/api/v1/audio/transcriptions`,
        serviceName: X402_APP_ROUTE_META.audio.serviceName,
        description:
          'OpenAI-compatible speech-to-text transcription (multipart audio upload) returning text for Micropay models.',
        mimeType: 'application/json',
        tags: X402_APP_ROUTE_META.audio.tags,
      },
    ],
  }
}

/** IDE product GoPlausible / Bazaar merchant card (independent of app). */
export function buildCodeMerchantCard(opts?: {
  siteOrigin?: string
  codeOrigin?: string
  apiOrigin?: string
}) {
  const site = (opts?.siteOrigin || getSiteOrigin() || DEFAULT_SITE_ORIGIN).replace(
    /\/$/,
    '',
  )
  const code = (opts?.codeOrigin || getCodeOrigin() || DEFAULT_CODE_ORIGIN).replace(
    /\/$/,
    '',
  )
  const api = (opts?.apiOrigin || getApiOrigin() || DEFAULT_API_ORIGIN).replace(
    /\/$/,
    '',
  )

  return {
    name: SITE_NAME,
    serviceName: CODE_SERVICE_NAME,
    description: CODE_DESCRIPTION,
    protocol: 'x402',
    version: '2',
    network: 'algorand:mainnet',
    asset: 'USDC',
    facilitator: GOPLAUSIBLE_FACILITATOR,
    tag: X402_CHALLENGE_TAG,
    icon: `${site}/assets/brand/icon.svg`,
    logo: `${site}/assets/brand/logo.svg`,
    homepage: `${code}/`,
    documentation: `${code}/`,
    product: 'code',
    endpoints: [
      {
        method: 'POST',
        path: `${api}/api/v1/ide/agent`,
        serviceName: X402_CODE_ROUTE_META.ide.serviceName,
        description:
          'Micropay IDE assistant with project file tools, compile, and Algorand TypeScript knowledge.',
        mimeType: 'application/json',
        tags: X402_CODE_ROUTE_META.ide.tags,
      },
      {
        method: 'POST',
        path: `${api}/api/v1/clone`,
        serviceName: X402_CODE_ROUTE_META.clone.serviceName,
        description:
          'Clone an Algorand TypeScript IDE template into your workspace (0.05 USDC).',
        mimeType: 'application/json',
        tags: X402_CODE_ROUTE_META.clone.tags,
      },
    ],
  }
}

/**
 * @deprecated Prefer buildAppMerchantCard / buildCodeMerchantCard.
 * Landing discovery card pointing at both products (not a shared backend).
 */
export function buildMerchantCard(opts?: {
  siteOrigin?: string
  appOrigin?: string
  codeOrigin?: string
}) {
  const site = (opts?.siteOrigin || getSiteOrigin() || DEFAULT_SITE_ORIGIN).replace(
    /\/$/,
    '',
  )
  const app = (opts?.appOrigin || getAppOrigin() || DEFAULT_APP_ORIGIN).replace(
    /\/$/,
    '',
  )
  const code = (
    opts?.codeOrigin ||
    getCodeOrigin() ||
    DEFAULT_CODE_ORIGIN
  ).replace(/\/$/, '')

  const appCard = buildAppMerchantCard({ siteOrigin: site, appOrigin: app })
  return {
    ...appCard,
    homepage: `${site}/`,
    products: {
      app: `${app}/`,
      code: `${code}/`,
      appMerchant: `${app}/.well-known/x402.json`,
      codeMerchant: `${code}/.well-known/x402.json`,
    },
    note: 'Micropay App and IDE are separate products. Each host publishes its own /.well-known/x402.json for discovery.',
  }
}

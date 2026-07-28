/**
 * CORS for browser calls from marketing / local apps.
 * IDE (`code.`) should call its own API host — keep code origins listed only
 * while the temporary API bridge (code → app) remains.
 */

const DEFAULT_ALLOWED = [
  'https://code.micropay.website',
  'https://micropay.website',
  'https://app.micropay.website',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

function allowedOrigins(): string[] {
  const extra =
    (typeof process !== 'undefined' && process.env?.CORS_ALLOWED_ORIGINS) ||
    (typeof process !== 'undefined' && process.env?.VITE_CORS_ALLOWED_ORIGINS) ||
    ''
  const fromEnv = extra
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set([...DEFAULT_ALLOWED, ...fromEnv])]
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || ''
  const allowed = allowedOrigins()
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, PAYMENT-SIGNATURE, payment-signature, X-PAYMENT, x-payment, Accept',
    'Access-Control-Expose-Headers':
      'PAYMENT-RESPONSE, payment-response, X-PAYMENT-RESPONSE',
    'Access-Control-Max-Age': '86400',
  }
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  }
  return headers
}

export function withCors(request: Request, response: Response): Response {
  const extra = corsHeaders(request)
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(extra)) {
    headers.set(k, v)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function corsPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

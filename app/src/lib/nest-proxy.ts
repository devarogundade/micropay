/**
 * Thin reverse-proxy to the NestJS backend.
 * TanStack Start API routes should NOT contain business logic — only forward.
 *
 * Set VITE_PUBLIC_API_URL / NEST_API_URL (server) to the Nest origin
 * (default http://localhost:4000).
 */

const DEFAULT_NEST = 'http://localhost:4000';

export function getNestApiOrigin(): string {
  const fromVite = (
    typeof import.meta !== 'undefined'
      ? (import.meta as ImportMeta & { env?: Record<string, string> }).env
          ?.VITE_PUBLIC_API_URL
      : undefined
  )?.replace(/\/$/, '');
  const fromProcess =
    typeof process !== 'undefined'
      ? (process.env.NEST_API_URL || process.env.VITE_PUBLIC_API_URL)?.replace(
          /\/$/,
          '',
        )
      : undefined;
  return fromVite || fromProcess || DEFAULT_NEST;
}

/** Forward an incoming Request to Nest, preserving method/headers/body. */
export async function proxyToNest(
  request: Request,
  pathWithQuery?: string,
): Promise<Response> {
  const incoming = new URL(request.url);
  const targetPath = pathWithQuery ?? `${incoming.pathname}${incoming.search}`;
  const url = `${getNestApiOrigin()}${targetPath.startsWith('/') ? '' : '/'}${targetPath}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(url, init);
  const outHeaders = new Headers(upstream.headers);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

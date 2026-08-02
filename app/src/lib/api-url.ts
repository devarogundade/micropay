/**
 * API helper for the app SPA.
 * Set VITE_PUBLIC_API_URL to the NestJS backend (e.g. http://localhost:4000).
 * This client-only app always calls Nest directly.
 */

import { DEFAULT_SITE_ORIGIN } from '@micropay/site-meta'

export function getApiUrl(): string {
  const own = (
    import.meta.env.VITE_PUBLIC_API_URL as string | undefined
  )?.replace(/\/$/, '')
  if (own) return own
  throw new Error('VITE_PUBLIC_API_URL is required')
}

export function getSiteUrl(): string {
  return (
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(
      /\/$/,
      '',
    ) || DEFAULT_SITE_ORIGIN
  )
}

export function apiUrl(path: string): string {
  const base = getApiUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

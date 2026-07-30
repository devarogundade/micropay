/**
 * API helper for the app SPA.
 * Set VITE_PUBLIC_API_URL to the NestJS backend (e.g. http://localhost:4000).
 * Same-origin Start routes are thin proxies — prefer Nest directly.
 */

import { DEFAULT_SITE_ORIGIN } from '@micropay/site-meta'

export function getApiUrl(): string {
  const own = (
    import.meta.env.VITE_PUBLIC_API_URL as string | undefined
  )?.replace(/\/$/, '')
  if (own) return own

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return ''
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

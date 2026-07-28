/**
 * Same-origin API helper for the TanStack Start IDE deploy.
 * Prefer relative paths so agent / compile / models hit this host.
 * Optional VITE_PUBLIC_API_URL bridges to another origin (e.g. local app).
 */

import { DEFAULT_APP_ORIGIN, DEFAULT_SITE_ORIGIN } from '@micropay/site-meta'

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

/** Sister app product (nav / marketing link only). */
export function getAppUrl(): string {
  return (
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(
      /\/$/,
      '',
    ) || DEFAULT_APP_ORIGIN
  )
}

/** Landing / marketing origin. */
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

/** @deprecated Use apiUrl */
export function appApiUrl(path: string): string {
  return apiUrl(path)
}

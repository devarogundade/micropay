import { DEFAULT_APP_ORIGIN, DEFAULT_SITE_ORIGIN } from '@micropay/site-meta'

/** App origin for paid APIs (compile + IDE agent). No trailing slash. */
export function getAppUrl(): string {
  return (
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(
      /\/$/,
      '',
    ) || DEFAULT_APP_ORIGIN
  )
}

/** Landing / merchant origin. */
export function getSiteUrl(): string {
  return (
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(
      /\/$/,
      '',
    ) || DEFAULT_SITE_ORIGIN
  )
}

export function appApiUrl(path: string): string {
  const base = getAppUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

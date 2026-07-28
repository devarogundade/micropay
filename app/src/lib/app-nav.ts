import {
  Activity,
  BookOpen,
  Boxes,
  Puzzle,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react'

import {
  DEFAULT_CODE_ORIGIN,
  getCodeOrigin,
} from '#/lib/site-meta'

/** External IDE host when set; otherwise keep in-app `/ide` until extraction. */
export const CODE_ORIGIN =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_PUBLIC_CODE_URL as string | undefined)?.replace(
      /\/$/,
      '',
    )) ||
  getCodeOrigin() ||
  ''

export const USE_EXTERNAL_IDE = Boolean(CODE_ORIGIN)

export type AppNavItem = {
  to: string
  label: string
  icon: LucideIcon
  external?: boolean
  /** Hide from compact bottom nav (desktop-only destinations). */
  desktopOnly?: boolean
}

export const APP_NAV: AppNavItem[] = [
  { to: '/models', label: 'Models', icon: Boxes },
  {
    to: USE_EXTERNAL_IDE ? CODE_ORIGIN || DEFAULT_CODE_ORIGIN : '/ide',
    label: 'IDE',
    icon: TerminalSquare,
    external: USE_EXTERNAL_IDE,
    desktopOnly: true,
  },
  { to: '/activities', label: 'Activity', icon: Activity },
  { to: '/agents', label: 'MCP', icon: Puzzle },
  { to: '/api-reference', label: 'API', icon: BookOpen },
]

/** Primary tabs shown in the mobile bottom bar. */
export const BOTTOM_NAV = APP_NAV.filter((item) => !item.desktopOnly)

export function navActive(pathname: string, to: string) {
  if (to === '/models') return pathname.startsWith('/models')
  if (to.startsWith('http')) return false
  return pathname === to || pathname.startsWith(`${to}/`)
}

export type AppNavPath =
  | '/models'
  | '/ide'
  | '/activities'
  | '/agents'
  | '/api-reference'

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

/** External IDE host (code product). Never in-app. */
export const CODE_ORIGIN =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_PUBLIC_CODE_URL as string | undefined)?.replace(
      /\/$/,
      '',
    )) ||
  getCodeOrigin() ||
  DEFAULT_CODE_ORIGIN

export type AppNavItem = {
  to: string
  label: string
  icon: LucideIcon
  external?: boolean
  /** Hide from compact bottom nav (desktop-only destinations). */
  desktopOnly?: boolean
}

export const APP_NAV: AppNavItem[] = [
  { to: '/', label: 'Models', icon: Boxes },
  {
    to: CODE_ORIGIN,
    label: 'IDE',
    icon: TerminalSquare,
    external: true,
    desktopOnly: true,
  },
  { to: '/activities', label: 'Activity', icon: Activity },
  { to: '/agents', label: 'MCP', icon: Puzzle },
  { to: '/api-reference', label: 'API', icon: BookOpen },
]

/** Primary tabs shown in the mobile bottom bar. */
export const BOTTOM_NAV = APP_NAV.filter((item) => !item.desktopOnly)

export function navActive(pathname: string, to: string) {
  if (to === '/') {
    return (
      pathname === '/' ||
      pathname === '' ||
      pathname.startsWith('/models/')
    )
  }
  if (to.startsWith('http')) return false
  return pathname === to || pathname.startsWith(`${to}/`)
}

export type AppNavPath =
  | '/'
  | '/activities'
  | '/agents'
  | '/api-reference'
  | '/models/$slug'
  | '/try'

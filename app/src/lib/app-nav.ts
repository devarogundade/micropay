import {
  BookOpen,
  Boxes,
  History,
  Network,
  Puzzle,
  Sparkles,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react'

import {
  DEFAULT_CODE_ORIGIN,
  DEFAULT_SITE_ORIGIN,
  getCodeOrigin,
  getSiteOrigin,
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

export function siteOrigin(): string {
  return (
    (typeof import.meta !== 'undefined' &&
      (import.meta.env?.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(
        /\/$/,
        '',
      )) ||
    getSiteOrigin() ||
    DEFAULT_SITE_ORIGIN
  )
}

export type AppNavItem = {
  to: string
  label: string
  icon: LucideIcon
  external?: boolean
  /** Hide from compact bottom nav (desktop-only destinations). */
  desktopOnly?: boolean
  /** Open in new tab / show external cue */
  trailing?: 'external' | 'chevron'
}

export type AppNavSection = {
  id: string
  label: string
  items: AppNavItem[]
}

/** AI Studio–style sidebar sections mapped to micropay features. */
export const APP_NAV_SECTIONS: AppNavSection[] = [
  {
    id: 'explore',
    label: 'Explore',
    items: [
      { to: '/', label: 'Playground', icon: Sparkles },
      { to: '/models', label: 'Models', icon: Boxes },
      { to: '/activities', label: 'History', icon: History },
    ],
  },
  {
    id: 'build',
    label: 'Build',
    items: [
      { to: '/agents', label: 'Agents', icon: Puzzle },
      {
        to: CODE_ORIGIN,
        label: 'IDE',
        icon: TerminalSquare,
        external: true,
        trailing: 'external',
      },
    ],
  },
  {
    id: 'manage',
    label: 'Manage',
    items: [
      { to: '/api-reference', label: 'Documentation', icon: BookOpen },
      { to: '/mcp', label: 'MCP', icon: Network },
    ],
  },
]

/** Flat list for legacy consumers / page title lookup. */
export const APP_NAV: AppNavItem[] = APP_NAV_SECTIONS.flatMap((s) => s.items)

/** Primary tabs shown in the mobile bottom bar. */
export const BOTTOM_NAV: AppNavItem[] = [
  { to: '/', label: 'Playground', icon: Sparkles },
  { to: '/models', label: 'Models', icon: Boxes },
  { to: '/activities', label: 'History', icon: History },
  { to: '/agents', label: 'Agents', icon: Puzzle },
]

export function navActive(pathname: string, to: string) {
  if (to === '/') {
    return pathname === '/' || pathname === ''
  }
  if (to === '/models') {
    return pathname === '/models' || pathname.startsWith('/models/')
  }
  if (to === '/activities') {
    return pathname === '/activities' || pathname.startsWith('/activities/')
  }
  if (to.startsWith('http')) return false
  return pathname === to || pathname.startsWith(`${to}/`)
}

/** Resolve a human page title for the workspace header. */
export function pageTitleForPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Playground'
  if (pathname.startsWith('/models/')) return 'Model'
  if (pathname === '/models' || pathname.startsWith('/models')) return 'Models'
  if (pathname.startsWith('/activities')) return 'History'
  if (pathname.startsWith('/agents/new')) return 'Create Agent'
  if (pathname.startsWith('/agents/mine')) return 'My Agents'
  if (pathname.startsWith('/agents/')) return 'Agent'
  if (pathname.startsWith('/agents')) return 'Agents'
  if (pathname.startsWith('/api-reference')) return 'Documentation'
  if (pathname.startsWith('/mcp')) return 'MCP'
  if (pathname.startsWith('/try')) return 'Try'
  const hit = APP_NAV.find((item) => !item.external && navActive(pathname, item.to))
  return hit?.label ?? 'MicroPay'
}

export type AppNavPath =
  | '/'
  | '/models'
  | '/activities'
  | '/agents'
  | '/agents/$slug'
  | '/agents/new'
  | '/agents/mine'
  | '/api-reference'
  | '/models/$slug'
  | '/mcp'
  | '/try'

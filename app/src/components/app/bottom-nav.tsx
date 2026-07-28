import { Link, useRouterState } from '@tanstack/react-router'

import {
  BOTTOM_NAV,
  type AppNavPath,
  navActive,
} from '#/lib/app-nav'
import { cn } from '#/lib/utils'

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav
      aria-label="Primary"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-void/95 backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex h-[var(--bottom-nav-height)] max-w-lg items-stretch justify-around px-1">
        {BOTTOM_NAV.map((item) => {
          const { to, label, icon: Icon } = item
          const isActive = navActive(pathname, to)
          return (
            <li key={to} className="flex min-w-0 flex-1">
              <Link
                to={to as AppNavPath}
                className={cn(
                  'relative flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] tracking-[-0.01em] no-underline transition-colors',
                  isActive ? 'text-paper' : 'text-fog hover:text-mist',
                )}
              >
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-acid-lime"
                  />
                ) : null}
                <Icon
                  className={cn(
                    'size-5 shrink-0',
                    isActive ? 'opacity-100' : 'opacity-70',
                  )}
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span className={cn(isActive ? 'font-medium' : 'font-normal')}>
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

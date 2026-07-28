import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'

import { AppHeader } from '#/components/app/app-header'
import { BottomNav } from '#/components/app/bottom-nav'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_shell')({
  component: AppShell,
})

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isModelWorkspace = /^\/models\/[^/]+\/?$/.test(pathname)
  const isFullBleed = isModelWorkspace
  const showBottomNav = !isFullBleed

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      {isFullBleed ? null : <AppHeader />}
      <main
        className={cn(
          'min-h-0 flex-1',
          isFullBleed
            ? 'overflow-hidden'
            : 'overflow-y-auto overflow-x-hidden',
          showBottomNav && 'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] md:pb-0',
        )}
      >
        {isFullBleed ? (
          <Outlet />
        ) : (
          <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        )}
      </main>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  )
}

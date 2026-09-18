import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'

import { AppSidebar } from '#/components/app/app-sidebar'
import { BottomNav } from '#/components/app/bottom-nav'
import { WorkspaceHeader } from '#/components/app/workspace-header'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '#/components/ui/sheet'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_shell')({
  component: AppShell,
})

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isModelWorkspace = /^\/models\/[^/]+\/?$/.test(pathname)
  const isAgentWorkspace = /^\/agents\/(?!new|mine)[^/]+\/?$/.test(pathname)
  const isPlayground = pathname === '/' || pathname === ''
  const isFullBleed = isModelWorkspace || isPlayground || isAgentWorkspace
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleSidebar() {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setSidebarOpen((v) => !v)
    } else {
      setMobileOpen(true)
    }
  }

  return (
    <div className="flex min-h-dvh items-start bg-background">
      {/* Desktop sidebar */}
      <div
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 overflow-hidden transition-[width] duration-200 ease-out md:block',
          sidebarOpen ? 'w-[var(--studio-sidebar-width)]' : 'w-0',
        )}
      >
        <AppSidebar />
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[min(100%,var(--studio-sidebar-width))] border-r border-sidebar-border p-0 sm:max-w-[var(--studio-sidebar-width)]"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        {isModelWorkspace || isAgentWorkspace ? null : (
          <WorkspaceHeader onToggleSidebar={toggleSidebar} />
        )}

        <main
          className={cn(
            'min-h-0',
            (isModelWorkspace || isAgentWorkspace) && 'h-dvh overflow-hidden',
            isPlayground &&
              'h-[calc(100dvh-var(--app-header-height))] overflow-hidden',
            !isFullBleed && 'overflow-x-hidden',
            !isFullBleed &&
              'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] md:pb-0',
          )}
        >
          {isFullBleed ? (
            <Outlet />
          ) : (
            <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-8">
              <Outlet />
            </div>
          )}
        </main>

        {!isFullBleed ? <BottomNav /> : null}
      </div>
    </div>
  )
}

import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { BrandMark } from '#/components/brand'
import { getAppUrl, getSiteUrl } from '#/lib/api-url'

/** Lightweight chrome for non-IDE pages (templates gallery). */
export function CodePageShell({
  children,
  title,
  description,
}: {
  children: ReactNode
  title?: string
  description?: string
}) {
  const site = getSiteUrl()
  const app = getAppUrl()

  return (
    <div className="min-h-svh bg-void text-paper">
      <header className="workspace-bar flex shrink-0 items-center justify-between gap-3 border-b border-border bg-carbon px-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="shrink-0 no-underline">
            <BrandMark size="sm" />
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              to="/"
              className="text-fog transition-colors hover:text-paper"
            >
              IDE
            </Link>
            <Link
              to="/templates"
              className="text-fog transition-colors hover:text-paper [&.active]:text-paper"
              activeOptions={{ exact: false }}
            >
              Templates
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a
            href={app}
            className="text-fog transition-colors hover:text-paper"
          >
            App
          </a>
          <a
            href={site}
            className="text-fog transition-colors hover:text-paper"
          >
            Site
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {title ? (
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-paper sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  )
}

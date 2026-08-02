import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { BrandMark } from '#/components/brand'
import { getAppUrl, getSiteUrl } from '#/lib/api-url'
import { fetchCreditStats } from '#/lib/credit-stats'
import { formatUsdc } from '#/data/models'
import { queryKeys } from '#/lib/query-keys'
import { useWallet } from '#/lib/wallet'

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
  const { account } = useWallet()
  const creditQuery = useQuery({
    queryKey: queryKeys.userStats(account?.address),
    queryFn: () => fetchCreditStats(account!.address),
    enabled: Boolean(account?.address),
    staleTime: 15_000,
  })

  return (
    <div className="min-h-svh bg-void text-paper">
      <header className="workspace-bar sticky top-0 z-30 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-carbon/90 px-4 backdrop-blur-md sm:px-5">
        <div className="flex items-center gap-4">
          <Link to="/" className="shrink-0 no-underline">
            <BrandMark size="sm" />
          </Link>
          <nav className="flex items-center gap-1 text-[13px]">
            <Link
              to="/"
              className="rounded-xl px-2.5 py-1.5 text-fog transition-colors hover:bg-accent hover:text-paper"
            >
              IDE
            </Link>
            <Link
              to="/templates"
              className="rounded-xl px-2.5 py-1.5 text-fog transition-colors hover:bg-accent hover:text-paper [&.active]:bg-accent [&.active]:font-medium [&.active]:text-paper"
              activeOptions={{ exact: false }}
            >
              Templates
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-1 text-[13px]">
          {creditQuery.data ? (
            <span className="hidden items-center gap-1.5 rounded-xl border border-border bg-void px-2.5 py-1.5 text-[11px] text-mist sm:inline-flex">
              <img src="/assets/usdc.png" alt="" className="size-3" />
              {formatUsdc(creditQuery.data.dailyCreditRemainingUsdc)} credit left
            </span>
          ) : null}
          <a
            href={app}
            className="rounded-xl px-2.5 py-1.5 text-fog transition-colors hover:bg-accent hover:text-paper"
          >
            App
          </a>
          <a
            href={site}
            className="rounded-xl px-2.5 py-1.5 text-fog transition-colors hover:bg-accent hover:text-paper"
          >
            Site
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-8">
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

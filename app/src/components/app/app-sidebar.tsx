import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronRight,
  ExternalLink,
  KeyRound,
  LogOut,
  Search,
  Settings,
  Wallet,
} from 'lucide-react'

import { BrandMark } from '#/components/brand'
import { Button } from '#/components/ui/button'
import { formatUsdc } from '#/data/models'
import {
  APP_NAV_SECTIONS,
  type AppNavPath,
  CODE_ORIGIN,
  navActive,
  siteOrigin,
} from '#/lib/app-nav'
import { fetchUserStats } from '#/lib/activities.functions'
import { queryKeys } from '#/lib/query-keys'
import { cn } from '#/lib/utils'
import { useWallet } from '#/lib/wallet'

export function AppSidebar({
  className,
  onNavigate,
}: {
  className?: string
  /** Called after an in-app link click (e.g. close mobile drawer). */
  onNavigate?: () => void
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { account, shortAddress, setConnectOpen, disconnect } = useWallet()

  const { data: stats } = useQuery({
    queryKey: queryKeys.userStats(account?.address ?? null),
    queryFn: () =>
      fetchUserStats({ data: { walletAddress: account?.address } }),
    enabled: Boolean(account?.address),
    staleTime: 30_000,
    refetchOnMount: 'always',
  })

  return (
    <aside
      className={cn(
        'studio-sidebar flex h-full w-[var(--studio-sidebar-width)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className,
      )}
    >
      <div className="flex h-[var(--app-header-height)] shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 no-underline"
          onClick={onNavigate}
        >
          <BrandMark variant="icon" size="sm" />
          <span className="truncate text-sm font-medium tracking-tight text-ink">
            MicroPay
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Workspace">
        {APP_NAV_SECTIONS.map((section) => (
          <div key={section.id} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-fog">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const { to, label, icon: Icon, external, trailing } = item
                const isActive = !external && navActive(pathname, to)
                const className = cn(
                  'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] tracking-[-0.011em] transition-colors',
                  isActive
                    ? 'bg-sidebar-accent font-medium text-ink'
                    : 'text-mist hover:bg-obsidian/80 hover:text-ink',
                )

                const trailingIcon =
                  trailing === 'external' ? (
                    <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-40" />
                  ) : trailing === 'chevron' ? (
                    <ChevronRight className="ml-auto size-3.5 shrink-0 opacity-40" />
                  ) : null

                if (external) {
                  return (
                    <li key={`${section.id}-${to}-${label}`}>
                      <a
                        href={to}
                        className={className}
                        target={to.startsWith('http') ? '_blank' : undefined}
                        rel={
                          to.startsWith('http')
                            ? 'noopener noreferrer'
                            : undefined
                        }
                        onClick={onNavigate}
                      >
                        <Icon className="size-4 shrink-0 opacity-70" />
                        <span className="min-w-0 truncate">{label}</span>
                        {trailingIcon}
                      </a>
                    </li>
                  )
                }

                return (
                  <li key={`${section.id}-${to}-${label}`}>
                    <Link
                      to={to as AppNavPath}
                      className={className}
                      onClick={onNavigate}
                    >
                      <Icon className="size-4 shrink-0 opacity-70" />
                      <span className="min-w-0 truncate">{label}</span>
                      {trailingIcon}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-sidebar-border p-3">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-snow via-paper to-obsidian/60 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
          <p className="text-[12px] font-medium text-ink">Pay as you go</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Connect a wallet and only pay when you run a model.
          </p>
          {!account ? (
            <Button
              size="sm"
              className="mt-2.5 h-8 w-full"
              onClick={() => {
                setConnectOpen(true)
                onNavigate?.()
              }}
            >
              <Wallet className="size-3.5" />
              Connect wallet
            </Button>
          ) : stats ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-fog">
              <img src="/assets/usdc.png" alt="" className="size-3" />
              Daily credit{' '}
              <span className="text-ink">
                {formatUsdc(stats.dailyCreditRemainingUsdc)} left
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-1 px-0.5">
          <IconLink href="/api-reference" label="API keys" onClick={onNavigate}>
            <KeyRound className="size-4" />
          </IconLink>
          <IconLink href="/api-reference" label="Docs" onClick={onNavigate}>
            <Settings className="size-4" />
          </IconLink>
          <IconLink href="/models" label="Browse models" onClick={onNavigate}>
            <Search className="size-4" />
          </IconLink>
          <a
            href={CODE_ORIGIN}
            className="inline-flex size-8 items-center justify-center rounded-lg text-fog transition-colors hover:bg-obsidian hover:text-ink"
            aria-label="Open IDE"
            title="Open IDE"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>

        <div className="flex items-center gap-2 rounded-xl px-1 py-1">
          {account ? (
            <>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-obsidian">
                <img
                  src="/assets/algorand.png"
                  alt=""
                  className="size-4 rounded-sm"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[11px] text-ink">
                  {shortAddress}
                </p>
                <button
                  type="button"
                  className="text-[10px] text-fog hover:text-ink"
                  onClick={() => disconnect()}
                >
                  Disconnect
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 shrink-0 text-fog"
                onClick={() => disconnect()}
                aria-label="Log out"
              >
                <LogOut className="size-3.5" />
              </Button>
            </>
          ) : (
            <>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-obsidian text-[11px] font-medium text-mist">
                ?
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-ink">Guest</p>
                <a
                  href={siteOrigin()}
                  className="text-[10px] text-fog hover:text-ink"
                >
                  micropay.site
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

function IconLink({
  href,
  label,
  children,
  onClick,
}: {
  href: string
  label: string
  children: React.ReactNode
  onClick?: () => void
}) {
  const internal = href.startsWith('/')
  if (internal) {
    return (
      <Link
        to={href as AppNavPath}
        className="inline-flex size-8 items-center justify-center rounded-lg text-fog transition-colors hover:bg-obsidian hover:text-ink"
        aria-label={label}
        title={label}
        onClick={onClick}
      >
        {children}
      </Link>
    )
  }
  return (
    <a
      href={href}
      className="inline-flex size-8 items-center justify-center rounded-lg text-fog transition-colors hover:bg-obsidian hover:text-ink"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </a>
  )
}

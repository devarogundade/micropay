import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Home,
  LogOut,
  MoreHorizontal,
  TerminalSquare,
  Wallet,
} from "lucide-react";

import { BrandMark } from "#/components/brand";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { formatUsdc } from "#/data/models";
import {
  APP_NAV,
  type AppNavPath,
  CODE_ORIGIN,
  navActive,
} from "#/lib/app-nav";
import { fetchUserStats } from "#/lib/activities.functions";
import { queryKeys } from "#/lib/query-keys";
import { DEFAULT_SITE_ORIGIN, getSiteOrigin } from "#/lib/site-meta";
import { cn } from "#/lib/utils";
import { useWallet } from "#/lib/wallet";

function siteOrigin(): string {
  return (
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(
        /\/$/,
        "",
      )) ||
    getSiteOrigin() ||
    DEFAULT_SITE_ORIGIN
  );
}

export function AppHeader() {
  const { account, shortAddress, setConnectOpen, disconnect } = useWallet();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: stats } = useQuery({
    queryKey: queryKeys.userStats(account?.address ?? null),
    queryFn: () =>
      fetchUserStats({ data: { walletAddress: account?.address } }),
    enabled: Boolean(account?.address),
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const ideHref = CODE_ORIGIN;
  const marketingHref = siteOrigin();

  const pageTitle = APP_NAV.find((item) => navActive(pathname, item.to))?.label;

  return (
    <header className="safe-top sticky top-0 z-40 shrink-0">
      <div className="app-header-bar mx-auto flex w-full max-w-[1400px] items-center gap-2 px-3 md:gap-3 md:px-6">
        <Link to="/" className="shrink-0 no-underline">
          <BrandMark size="sm" className="hidden sm:inline-block" />
          <BrandMark variant="icon" size="sm" className="sm:hidden" />
        </Link>

        {/* Mobile activity title */}
        {pageTitle ? (
          <p className="min-w-0 truncate text-sm font-medium text-ink md:hidden">
            {pageTitle}
          </p>
        ) : null}

        {/* Desktop nav */}
        <nav className="ml-2 hidden items-center gap-0.5 md:flex">
          {APP_NAV.map((item) => {
            const { to, label, icon: Icon } = item;
            const external = Boolean(item.external);
            const isActive = navActive(pathname, to);
            const className = cn(
              "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[13px] tracking-[-0.011em] transition-colors",
              item.desktopOnly && "hidden lg:inline-flex",
              isActive
                ? "bg-obsidian text-ink"
                : "text-fog hover:bg-obsidian/70 hover:text-ink",
            );
            if (external) {
              return (
                <a key={to} href={to} className={className}>
                  <Icon className="size-3.5 shrink-0 opacity-70" />
                  {label}
                </a>
              );
            }
            return (
              <Link key={to} to={to as AppNavPath} className={className}>
                <Icon className="size-3.5 shrink-0 opacity-70" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          {account && stats ? (
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-snow px-2.5 py-1 text-[11px] text-fog lg:flex">
              <img src="/assets/usdc.png" alt="" className="size-3.5" />
              <span>
                Today{" "}
                <span className="text-ink">
                  {formatUsdc(stats.todaySpendUsdc)}
                </span>
              </span>
              <span className="text-smoke">·</span>
              <span>
                Total{" "}
                <span className="text-ink">
                  {formatUsdc(stats.totalSpendUsdc)}
                </span>
              </span>
            </div>
          ) : null}

          {/* Compact spend chip on mobile when connected */}
          {account && stats ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-snow px-2 py-1 text-[11px] text-fog lg:hidden">
              <img src="/assets/usdc.png" alt="" className="size-3" />
              <span className="text-ink tabular-nums">
                {formatUsdc(stats.todaySpendUsdc)}
              </span>
            </div>
          ) : null}

          {account ? (
            <div className="hidden items-center gap-1.5 sm:flex">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-snow px-2.5 py-1">
                <img
                  src="/assets/algorand.png"
                  alt=""
                  className="size-3.5 rounded-sm"
                />
                <span className="font-mono text-[12px] text-ink">
                  {shortAddress}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-fog"
                onClick={() => disconnect()}
              >
                <LogOut className="size-3.5" />
                <span className="hidden lg:inline">Log out</span>
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="h-9 min-w-9 px-2.5 sm:h-8"
              onClick={() => setConnectOpen(true)}
            >
              <Wallet className="size-3.5" />
              <span className="hidden min-[380px]:inline">Connect</span>
            </Button>
          )}

          <OverflowMenu
            account={account}
            shortAddress={shortAddress}
            stats={stats}
            ideHref={ideHref}
            marketingHref={marketingHref}
            onConnect={() => setConnectOpen(true)}
            onDisconnect={() => disconnect()}
          />
        </div>
      </div>
    </header>
  );
}

function OverflowMenu({
  account,
  shortAddress,
  stats,
  ideHref,
  marketingHref,
  onConnect,
  onDisconnect,
}: {
  account: { address: string } | null;
  shortAddress: string | null;
  stats?: { todaySpendUsdc: number; totalSpendUsdc: number } | null;
  ideHref: string;
  marketingHref: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="size-9 shrink-0 touch-manipulation md:size-8"
          aria-label="More options"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          {account ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Wallet</p>
              <p className="font-mono text-xs text-ink">
                {shortAddress ?? account.address.slice(0, 10)}
              </p>
              {stats ? (
                <p className="flex items-center gap-1.5 pt-1 text-[11px] text-fog">
                  <img src="/assets/usdc.png" alt="" className="size-3" />
                  Today {formatUsdc(stats.todaySpendUsdc)} · Total{" "}
                  {formatUsdc(stats.totalSpendUsdc)}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">Not connected</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={ideHref}>
            <TerminalSquare className="size-4" />
            Open IDE
            <ExternalLink className="ml-auto size-3.5 opacity-50" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={marketingHref}>
            <Home className="size-4" />
            Back to site
            <ExternalLink className="ml-auto size-3.5 opacity-50" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {account ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onDisconnect()}
          >
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onConnect()}>
            <Wallet className="size-4" />
            Connect wallet
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeft,
  Share2,
  TerminalSquare,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

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
import { CODE_ORIGIN, pageTitleForPath, siteOrigin } from "#/lib/app-nav";
import { fetchUserStats } from "#/lib/activities.functions";
import { queryKeys } from "#/lib/query-keys";
import { cn } from "#/lib/utils";
import { useWallet } from "#/lib/wallet";

export function WorkspaceHeader({
  title,
  actions,
  onToggleSidebar,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  onToggleSidebar?: () => void;
  className?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { account, shortAddress, setConnectOpen, disconnect } = useWallet();
  const pageTitle = title ?? pageTitleForPath(pathname);

  const { data: stats } = useQuery({
    queryKey: queryKeys.userStats(account?.address ?? null),
    queryFn: () =>
      fetchUserStats({ data: { walletAddress: account?.address } }),
    enabled: Boolean(account?.address),
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const marketingHref = siteOrigin();

  return (
    <header
      className={cn(
        "workspace-header safe-top sticky top-0 z-30 flex h-[var(--app-header-height)] shrink-0 items-center gap-2  px-3 md:px-5",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-9 shrink-0 text-mist hover:text-ink md:size-8"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu className="size-4 md:hidden" />
        <PanelLeft className="hidden size-4 md:block" />
      </Button>

      <h1 className="min-w-0 truncate text-[15px] font-medium tracking-tight text-ink">
        {pageTitle}
      </h1>

      <div className="ml-auto flex items-center gap-1.5">
        {actions}

        {account && stats ? (
          <div className="hidden items-center gap-1.5 rounded-xl border border-border bg-snow px-2.5 py-1 text-[11px] text-fog lg:flex">
            <img src="/assets/usdc.png" alt="" className="size-3.5" />
            <span className="text-ink tabular-nums">
              {formatUsdc(stats.dailyCreditRemainingUsdc)}
            </span>
            <span className="text-smoke">credit left</span>
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

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="hidden size-8 text-mist hover:text-ink sm:inline-flex"
          aria-label="Share"
          title="Share"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href);
          }}
        >
          <Share2 className="size-3.5" />
        </Button>

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
                      Credit {formatUsdc(stats.dailyCreditRemainingUsdc)} left · Used{" "}
                      {formatUsdc(stats.dailyCreditUsedUsdc)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <span className="text-muted-foreground">Not connected</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={CODE_ORIGIN}>
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
                onSelect={() => disconnect()}
              >
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setConnectOpen(true)}>
                <Wallet className="size-4" />
                Connect wallet
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ExternalLink, Filter, Info } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { BottomSheet } from '#/components/app/bottom-sheet'
import { ListCard, ListCardGroup, ListCardRow } from '#/components/app/list-card'
import { UsageChart } from '#/components/usage-chart'
import { EmptyState } from '#/components/ui/empty-state'
import { ErrorState } from '#/components/ui/error-state'
import {
  ListPagination,
  slicePage,
} from '#/components/ui/list-pagination'
import { LoadingState, SkeletonLines } from '#/components/ui/loading-state'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { formatUsdc } from '#/data/models'
import { fetchActivities } from '#/lib/activities.functions'
import type { Activity, ActivityStatus } from '#/lib/api-types'
import { queryKeys } from '#/lib/query-keys'
import { useWallet } from '#/lib/wallet'

const PAGE_SIZE = 15

/** Algorand mainnet explorer for x402 settlement txs. */
function explorerTxUrl(txId: string): string | null {
  const id = txId?.trim()
  if (
    !id ||
    id === '-' ||
    id.toLowerCase() === 'unknown' ||
    id.toLowerCase() === 'credit'
  )
    return null
  return `https://lora.algokit.io/mainnet/transaction/${id}`
}

export const Route = createFileRoute('/_shell/activities')({
  component: ActivitiesPage,
})

function ActivitiesPage() {
  const { account, setConnectOpen } = useWallet()
  const [status, setStatus] = useState<'all' | ActivityStatus>('all')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Activity | null>(null)
  const connected = Boolean(account?.address)

  const { data, isLoading, isFetching, isError, refetch, error } = useQuery({
    queryKey: queryKeys.activities(account?.address ?? null, status, type),
    queryFn: () =>
      fetchActivities({
        data: {
          walletAddress: account!.address,
          status,
          type,
        },
      }),
    enabled: connected,
  })

  const activities: Activity[] = data?.activities ?? []
  const dailySpend = data?.dailySpend ?? []
  const stats = data?.stats

  const rows = useMemo(() => activities, [activities])
  const pageRows = useMemo(
    () => slicePage(rows, page, PAGE_SIZE),
    [rows, page],
  )

  useEffect(() => {
    setPage(1)
  }, [status, type, account?.address])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    if (page > totalPages) setPage(totalPages)
  }, [rows.length, page])

  const total = rows
    .filter((r) => r.status !== 'failed')
    .reduce((s, r) => s + r.costUsdc, 0)
  const periodTotal = dailySpend.reduce(
    (s: number, d: { usdc: number }) => s + d.usdc,
    0,
  )
  const showLoading = connected && (isLoading || isFetching)

  const byType = stats?.byType ?? []
  const selectedExplorer = selected ? explorerTxUrl(selected.txId) : null

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Activities
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {connected
              ? 'Usage history and USDC spend for your connected wallet.'
              : 'Connect a wallet to see your usage history.'}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {stats ? (
            <>
              <div className="min-w-[7rem] flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 sm:flex-none sm:px-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Lifetime
                </p>
                <p className="font-semibold tabular-nums">
                  {formatUsdc(stats.totalSpendUsdc)}
                </p>
              </div>
              <div className="min-w-[7rem] flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 sm:flex-none sm:px-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Today
                </p>
                <p className="font-semibold tabular-nums">
                  {formatUsdc(stats.dailyCreditRemainingUsdc)}
                </p>
              </div>
            </>
          ) : null}
          <div className="flex min-w-[9rem] flex-[1_1_100%] items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 sm:flex-none sm:px-4">
            <img src="/assets/usdc.png" alt="" className="size-5" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                14-day spend
              </p>
              <p className="font-semibold tabular-nums">
                {formatUsdc(periodTotal)}
              </p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="ml-1 flex size-9 items-center justify-center text-muted-foreground hover:text-foreground sm:size-auto"
                  aria-label="About spend"
                >
                  <Info className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-xs" align="end">
                Daily credit used: {formatUsdc(stats?.dailyCreditUsedUsdc ?? 0)} of{' '}
                {formatUsdc(stats?.dailyCreditAllowanceUsdc ?? 0.1)}. Filtered list total:{' '}
                {formatUsdc(total)}. Lifetime and today come
                from wallet stats. Tx links open Algorand explorer (mainnet).
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {connected && byType.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {byType.map((row) => (
            <ListCard key={row.type} className="px-3 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {row.type}
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {formatUsdc(row.spendUsdc)}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.count} request{row.count === 1 ? '' : 's'}
              </p>
            </ListCard>
          ))}
        </div>
      ) : null}

      {!connected ? (
        <div className="mt-10">
          <EmptyState
            title="Wallet not connected"
            description="Connect to load settled x402 usage for this address."
            action={
              <Button type="button" onClick={() => setConnectOpen(true)}>
                Connect wallet
              </Button>
            }
          />
        </div>
      ) : isError ? (
        <div className="mt-10">
          <ErrorState
            title="Could not load activities"
            description={
              error instanceof Error ? error.message : 'Unknown error'
            }
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <>
          {/* Mobile filter overflow */}
          <div className="mt-6 flex items-center gap-2 md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-2">
                  <Filter className="size-3.5" />
                  Filters
                  {(status !== 'all' || type !== 'all') && (
                    <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
                      {[status !== 'all' ? 1 : 0, type !== 'all' ? 1 : 0].reduce(
                        (a, b) => a + b,
                        0,
                      )}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={status}
                  onValueChange={(v) => setStatus(v as 'all' | ActivityStatus)}
                >
                  <DropdownMenuRadioItem value="all">All status</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="settled">Settled</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="verified">Verified</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="failed">Failed</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Type</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={type} onValueChange={setType}>
                  <DropdownMenuRadioItem value="all">All types</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Chat">Chat</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Image Gen">Image Gen</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Audio">Audio</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="IDE">IDE</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop selects */}
          <div className="mt-8 hidden flex-wrap items-center gap-3 md:flex">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as 'all' | ActivityStatus)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="Chat">Chat</SelectItem>
                <SelectItem value="Image Gen">Image Gen</SelectItem>
                <SelectItem value="Audio">Audio</SelectItem>
                <SelectItem value="IDE">IDE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-6">
            <UsageChart data={dailySpend} />
          </div>

          {/* Mobile card list */}
          <div className="mt-6 md:hidden">
            {showLoading && rows.length === 0 ? (
              <div className="rounded-xl border border-border bg-snow/80 p-4">
                <LoadingState compact label="Loading activity…" />
                <SkeletonLines className="mt-3" lines={4} />
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Run the guided demo or a paid request from Models / IDE — it’ll show up here."
                action={
                  <Button asChild variant="outline" size="sm">
                    <a href="/try">Try ~$0.01 demo</a>
                  </Button>
                }
              />
            ) : (
              <ListCardGroup>
                {pageRows.map((a) => (
                  <ListCard
                    key={a.id}
                    as="button"
                    interactive
                    onClick={() => setSelected(a)}
                  >
                    <ListCardRow
                      title={a.modelName}
                      subtitle={`${a.type} · ${new Date(a.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`}
                      trailing={
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={a.status} />
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      }
                      meta={
                        <ActivityCost activity={a} />
                      }
                    />
                  </ListCard>
                ))}
              </ListCardGroup>
            )}
            {!isLoading && rows.length > 0 ? (
              <ListPagination
                className="mt-3 px-1"
                page={page}
                pageSize={PAGE_SIZE}
                total={rows.length}
                onPageChange={setPage}
              />
            ) : null}
          </div>

          {/* Desktop table */}
          <div className="mt-6 hidden overflow-hidden rounded-md border border-border md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {showLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
                      <LoadingState compact label="Loading activity…" />
                      <SkeletonLines className="mt-3" lines={4} />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6">
                      <EmptyState
                        title="No activity yet"
                        description="Run the guided demo or a paid request from Models / IDE — it’ll show up here."
                        action={
                          <Button asChild variant="outline" size="sm">
                            <a href="/try">Try ~$0.01 demo</a>
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((a) => {
                    const explorer = explorerTxUrl(a.txId)
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 font-medium">{a.modelName}</td>
                        <td className="px-4 py-3">{a.type}</td>
                        <td className="px-4 py-3">
                          <ActivityCost activity={a} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {explorer ? (
                            <a
                              href={explorer}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-mist hover:text-ink"
                              title={a.txId}
                            >
                              {a.txId.slice(0, 8)}…
                              <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            a.txId === 'credit' ? 'No transaction' : a.txId || '—'
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            {!isLoading && rows.length > 0 ? (
              <ListPagination
                className="border-t border-border px-3"
                page={page}
                pageSize={PAGE_SIZE}
                total={rows.length}
                onPageChange={setPage}
              />
            ) : null}
          </div>
        </>
      )}

      <BottomSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title={selected?.modelName ?? 'Activity'}
        description={
          selected
            ? new Date(selected.createdAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : undefined
        }
        footer={
          selectedExplorer ? (
            <Button asChild className="w-full" size="lg">
              <a
                href={selectedExplorer}
                target="_blank"
                rel="noreferrer"
              >
                View on explorer
                <ExternalLink className="size-4" />
              </a>
            </Button>
          ) : null
        }
      >
        {selected ? (
          <dl className="space-y-4 text-sm">
            <DetailRow label="Type" value={selected.type} />
            <DetailRow
              label="Cost"
              value={
                <ActivityCost activity={selected} />
              }
            />
            <DetailRow
              label="Status"
              value={<StatusBadge status={selected.status} />}
            />
            <DetailRow
              label="Transaction"
              value={
                <span className="break-all font-mono text-xs text-muted-foreground">
                  {selected.txId === 'credit'
                    ? 'No on-chain transaction (daily credit)'
                    : selected.txId || '—'}
                </span>
              }
            />
          </dl>
        ) : null}
      </BottomSheet>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{value}</dd>
    </div>
  )
}

function ActivityCost({ activity }: { activity: Activity }) {
  if (activity.txId === 'credit' && activity.costUsdc === 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-pulse-green/10 px-2 py-1 text-xs font-medium text-pulse-green">
        Covered by credit
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-foreground">
      <img src="/assets/usdc.png" alt="" className="size-3.5" />
      {formatUsdc(activity.costUsdc)}
    </span>
  )
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  if (status === 'settled')
    return (
      <Badge className="bg-pulse-green/15 text-pulse-green hover:bg-pulse-green/15">
        {status}
      </Badge>
    )
  if (status === 'verified')
    return <Badge variant="outline">{status}</Badge>
  return <Badge variant="destructive">{status}</Badge>
}

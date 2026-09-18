import { useQuery } from '@tanstack/react-query'
import { Coins, Download, Loader2, Wallet2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/ui/empty-state'
import { Input } from '#/components/ui/input'
import {
  ListCard,
  ListCardGroup,
  ListCardRow,
} from '#/components/app/list-card'
import { LoadingState } from '#/components/ui/loading-state'
import { formatUsdc } from '#/data/models'
import {
  fetchCreatorBalance,
  fetchCreatorPayments,
  fetchWithdrawals,
} from '#/lib/agents-api'
import { useRequestWithdrawalMutation } from '#/lib/agents.mutations'
import { queryKeys } from '#/lib/query-keys'
import type { WithdrawalStatus } from '#/lib/agents-api'

const WITHDRAWAL_LABEL: Record<WithdrawalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
}

export function AgentEarnings({ walletAddress }: { walletAddress: string }) {
  const [amount, setAmount] = useState('')
  const withdrawal = useRequestWithdrawalMutation()

  const balanceQuery = useQuery({
    queryKey: queryKeys.agents.balance(walletAddress),
    queryFn: () => fetchCreatorBalance({ walletAddress }),
    staleTime: 15_000,
  })
  const paymentsQuery = useQuery({
    queryKey: queryKeys.agents.payments(walletAddress),
    queryFn: () => fetchCreatorPayments({ walletAddress, limit: 25 }),
    staleTime: 15_000,
  })
  const withdrawalsQuery = useQuery({
    queryKey: queryKeys.agents.withdrawals(walletAddress),
    queryFn: () => fetchWithdrawals({ walletAddress }),
    staleTime: 15_000,
  })

  const balance = balanceQuery.data
  const amountNum = Number(amount)
  const canRequest =
    Boolean(balance) &&
    Number.isFinite(amountNum) &&
    amountNum >= (balance?.minWithdrawalUsdc ?? 1) &&
    amountNum <= (balance?.availableUsdc ?? 0) &&
    !withdrawal.isPending

  async function submitWithdrawal() {
    if (!canRequest || !balance) return
    try {
      await withdrawal.mutateAsync({
        walletAddress,
        amountUsdc: amountNum,
      })
      toast.success('Withdrawal requested')
      setAmount('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Withdrawal request failed')
    }
  }

  if (balanceQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-snow/80 p-4">
        <LoadingState compact label="Loading earnings…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Wallet2 className="size-4" />}
          label="Available"
          value={formatUsdc(balance?.availableUsdc ?? 0)}
        />
        <StatCard
          icon={<Coins className="size-4" />}
          label="Lifetime earned"
          value={formatUsdc(balance?.lifetimeEarnedUsdc ?? 0)}
        />
        <StatCard
          icon={<Download className="size-4" />}
          label="Withdrawn"
          value={formatUsdc(balance?.withdrawnUsdc ?? 0)}
        />
        <StatCard
          icon={<Loader2 className="size-4" />}
          label="Pending"
          value={formatUsdc(balance?.pendingWithdrawalsUsdc ?? 0)}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink">Request withdrawal</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Minimum {formatUsdc(balance?.minWithdrawalUsdc ?? 1)}. Requests are processed by the
          Micropay team and paid to your Algorand wallet.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-56">
            <img src="/assets/usdc.png" alt="" className="absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min ${balance?.minWithdrawalUsdc ?? 1}`}
              type="number"
              min={balance?.minWithdrawalUsdc ?? 1}
              max={balance?.availableUsdc ?? 0}
              step={0.1}
              className="pl-9"
            />
          </div>
          <Button type="button" onClick={() => void submitWithdrawal()} disabled={!canRequest}>
            {withdrawal.isPending ? 'Requesting…' : 'Request withdrawal'}
          </Button>
          {balance && amountNum > (balance.availableUsdc ?? 0) ? (
            <span className="text-xs text-destructive">Exceeds available balance</span>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Recent earnings</h2>
        {paymentsQuery.isLoading ? (
          <div className="mt-2 rounded-2xl border border-border bg-snow/80 p-4">
            <LoadingState compact label="Loading payments…" />
          </div>
        ) : paymentsQuery.data && paymentsQuery.data.items.length > 0 ? (
          <ListCardGroup className="mt-2">
            {paymentsQuery.data.items.map((p) => (
              <ListCard key={p.id}>
                <ListCardRow
                  title={p.agentName || p.agentSlug}
                  subtitle={new Date(p.createdAt).toLocaleString()}
                  leading={
                    <Badge variant="secondary" className="h-fit font-mono text-[10px]">
                      {p.chargeUsdc > 0 ? formatUsdc(p.chargeUsdc) : 'free'}
                    </Badge>
                  }
                  meta={
                    p.creditAppliedUsdc > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        +{formatUsdc(p.creditAppliedUsdc)} covered by daily credit
                      </p>
                    ) : null
                  }
                />
              </ListCard>
            ))}
          </ListCardGroup>
        ) : (
          <div className="mt-2">
            <EmptyState
              compact
              title="No earnings yet"
              description="Share your agent link — paid requests show up here."
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Withdrawals</h2>
        {withdrawalsQuery.data && withdrawalsQuery.data.length > 0 ? (
          <ListCardGroup className="mt-2">
            {withdrawalsQuery.data.map((w) => (
              <ListCard key={w.id}>
                <ListCardRow
                  title={formatUsdc(w.amountUsdc)}
                  subtitle={new Date(w.requestedAt).toLocaleString()}
                  trailing={
                    <Badge
                      variant={
                        w.status === 'paid'
                          ? 'default'
                          : w.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {WITHDRAWAL_LABEL[w.status]}
                    </Badge>
                  }
                  meta={
                    w.txId ? (
                      <p className="truncate font-mono text-xs text-muted-foreground">{w.txId}</p>
                    ) : null
                  }
                />
              </ListCard>
            ))}
          </ListCardGroup>
        ) : (
          <div className="mt-2">
            <EmptyState compact title="No withdrawals yet" description="Earnings you request will appear here." />
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}
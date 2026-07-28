/**
 * Persist IDE usage / settlement activity via Prisma (PostgreSQL).
 * Writes CodeActivity / CodeUser only — never app Activity / User.
 */

import { prisma } from '#/lib/db'
import { ensureUserOptional } from '#/lib/users'
import type { CodeActivityStatus as PrismaActivityStatus } from '../generated/prisma/client.js'

export type ActivityStatus = 'settled' | 'verified' | 'failed'

export type Activity = {
  id: string
  modelSlug: string
  modelName: string
  /** "IDE" (and any future IDE-specific types) */
  type: string
  costUsdc: number
  status: ActivityStatus
  txId: string
  createdAt: string
  walletAddress?: string | null
  requestId?: string | null
  provider?: string | null
  tokensIn?: number | null
  tokensOut?: number | null
}

export type UserStats = {
  totalSpendUsdc: number
  todaySpendUsdc: number
  totalRequests: number
  settledRequests: number
  byType: Array<{ type: string; count: number; spendUsdc: number }>
}

function serialize(row: {
  id: string
  modelSlug: string
  modelName: string
  type: string
  costUsdc: number
  status: PrismaActivityStatus
  txId: string
  createdAt: Date
  walletAddress: string | null
  requestId: string | null
  provider: string | null
  tokensIn: number | null
  tokensOut: number | null
}): Activity {
  return {
    id: row.id,
    modelSlug: row.modelSlug,
    modelName: row.modelName,
    type: row.type,
    costUsdc: row.costUsdc,
    status: row.status,
    txId: row.txId,
    createdAt: row.createdAt.toISOString(),
    walletAddress: row.walletAddress,
    requestId: row.requestId,
    provider: row.provider,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
  }
}

export async function listActivities(opts?: {
  walletAddress?: string | null
  status?: ActivityStatus | 'all'
  type?: string | 'all'
  limit?: number
}): Promise<Activity[]> {
  const where: {
    walletAddress?: string
    status?: PrismaActivityStatus
    type?: string
  } = {}

  if (opts?.walletAddress) where.walletAddress = opts.walletAddress
  if (opts?.status && opts.status !== 'all') where.status = opts.status
  if (opts?.type && opts.type !== 'all') where.type = opts.type

  const rows = await prisma.codeActivity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts?.limit ?? 200,
  })
  return rows.map(serialize)
}

export async function recordActivity(
  input: Omit<Activity, 'id' | 'createdAt'> & {
    createdAt?: string
    walletAddress?: string | null
    requestId?: string | null
    provider?: string | null
    tokensIn?: number | null
    tokensOut?: number | null
  },
): Promise<Activity> {
  const { userId, walletAddress } = await ensureUserOptional(input.walletAddress)

  const row = await prisma.codeActivity.create({
    data: {
      userId,
      walletAddress,
      modelSlug: input.modelSlug,
      modelName: input.modelName,
      type: input.type,
      costUsdc: input.costUsdc,
      status: input.status,
      txId: input.txId,
      requestId: input.requestId ?? null,
      provider: input.provider ?? null,
      tokensIn: input.tokensIn ?? null,
      tokensOut: input.tokensOut ?? null,
      createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
    },
  })
  return serialize(row)
}

/** Aggregate daily USDC spend from settled rows (last N days). */
export async function dailySpend(
  days = 14,
  walletAddress?: string | null,
): Promise<Array<{ day: string; usdc: number }>> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - (days - 1))

  const rows = await prisma.codeActivity.findMany({
    where: {
      status: 'settled',
      createdAt: { gte: since },
      ...(walletAddress ? { walletAddress } : {}),
    },
    select: { createdAt: true, costUsdc: true },
  })

  const byDay = new Map<string, number>()
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + r.costUsdc)
  }

  const now = new Date()
  const out: Array<{ day: string; usdc: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
    out.push({
      day: label,
      usdc: Number((byDay.get(key) ?? 0).toFixed(6)),
    })
  }
  return out
}

export async function getUserStats(
  walletAddress?: string | null,
): Promise<UserStats> {
  const whereWallet = walletAddress ? { walletAddress } : {}

  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)

  const [totals, today, byType] = await Promise.all([
    prisma.codeActivity.aggregate({
      where: { ...whereWallet, status: 'settled' },
      _sum: { costUsdc: true },
      _count: true,
    }),
    prisma.codeActivity.aggregate({
      where: {
        ...whereWallet,
        status: 'settled',
        createdAt: { gte: startOfToday },
      },
      _sum: { costUsdc: true },
    }),
    prisma.codeActivity.groupBy({
      by: ['type'],
      where: { ...whereWallet, status: 'settled' },
      _sum: { costUsdc: true },
      _count: true,
    }),
  ])

  const totalRequests = await prisma.codeActivity.count({ where: whereWallet })

  return {
    totalSpendUsdc: Number((totals._sum.costUsdc ?? 0).toFixed(6)),
    todaySpendUsdc: Number((today._sum.costUsdc ?? 0).toFixed(6)),
    totalRequests,
    settledRequests: totals._count,
    byType: byType.map((t) => ({
      type: t.type,
      count: t._count,
      spendUsdc: Number((t._sum.costUsdc ?? 0).toFixed(6)),
    })),
  }
}

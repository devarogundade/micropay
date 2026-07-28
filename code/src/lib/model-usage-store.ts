/**
 * Per-wallet model usage for the IDE “Recently Used” section.
 * Writes CodeUserModelUsage / CodeUser only — never app UserModelUsage / User.
 */

import { prisma } from '#/lib/db'
import { ensureUserOptional } from '#/lib/users'
import { normalizeWalletAddress } from '#/lib/wallet-address'

export type ModelUsageRow = {
  modelSlug: string
  modelName: string | null
  lastUsedAt: string
  useCount: number
}

/** Upsert last-used timestamp after a successful paid request. */
export async function recordModelUsage(input: {
  walletAddress?: string | null
  modelSlug: string
  modelName?: string | null
}): Promise<void> {
  const { userId } = await ensureUserOptional(input.walletAddress)
  if (!userId || !input.modelSlug) return

  const now = new Date()
  await prisma.codeUserModelUsage.upsert({
    where: {
      userId_modelSlug: {
        userId,
        modelSlug: input.modelSlug,
      },
    },
    create: {
      userId,
      modelSlug: input.modelSlug,
      modelName: input.modelName ?? null,
      lastUsedAt: now,
      useCount: 1,
    },
    update: {
      modelName: input.modelName ?? undefined,
      lastUsedAt: now,
      useCount: { increment: 1 },
    },
  })
}

export async function listRecentModelUsage(input: {
  walletAddress: string
  limit?: number
}): Promise<ModelUsageRow[]> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return []

  const rows = await prisma.codeUserModelUsage.findMany({
    where: { userId: wallet },
    orderBy: { lastUsedAt: 'desc' },
    take: Math.min(Math.max(input.limit ?? 12, 1), 40),
  })

  return rows.map((r) => ({
    modelSlug: r.modelSlug,
    modelName: r.modelName,
    lastUsedAt: r.lastUsedAt.toISOString(),
    useCount: r.useCount,
  }))
}

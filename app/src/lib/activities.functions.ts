import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  dailySpend,
  getUserStats,
  listActivities,
  type ActivityStatus,
  type UserStats,
} from '#/lib/activities-store'
import { normalizeWalletAddress } from '#/lib/users'

const emptyStats: UserStats = {
  totalSpendUsdc: 0,
  todaySpendUsdc: 0,
  totalRequests: 0,
  settledRequests: 0,
  byType: [],
}

const fetchInput = z.object({
  walletAddress: z.string().optional(),
  status: z
    .enum(['all', 'settled', 'verified', 'failed'])
    .optional()
    .default('all'),
  type: z.string().optional().default('all'),
})

export const fetchActivities = createServerFn({ method: 'GET' })
  .validator((data: unknown) => fetchInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const wallet = normalizeWalletAddress(data.walletAddress)
    const status = (data.status ?? 'all') as ActivityStatus | 'all'
    const type = data.type ?? 'all'

    try {
      const [activities, spend, stats] = await Promise.all([
        listActivities({ walletAddress: wallet, status, type }),
        dailySpend(14, wallet),
        getUserStats(wallet),
      ])

      return { activities, dailySpend: spend, stats }
    } catch (err) {
      // Soft-fail reads so Netlify DB outages don't surface as TSR error blobs.
      console.error('[activities] list/stats unavailable', err)
      return { activities: [], dailySpend: [], stats: emptyStats }
    }
  })

export const fetchUserStats = createServerFn({ method: 'GET' })
  .validator((data: unknown) =>
    z
      .object({
        walletAddress: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const wallet = normalizeWalletAddress(data.walletAddress)
    try {
      return await getUserStats(wallet)
    } catch (err) {
      console.error('[activities] user stats unavailable', err)
      return emptyStats
    }
  })

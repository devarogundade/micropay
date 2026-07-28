import { createFileRoute } from '@tanstack/react-router'

import {
  dailySpend,
  getUserStats,
  listActivities,
  type ActivityStatus,
} from '#/lib/activities-store'
import { normalizeWalletAddress } from '#/lib/users'

/** Real usage history from settled Micropay requests (Postgres). */
export const Route = createFileRoute('/api/v1/activities')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const wallet =
          normalizeWalletAddress(url.searchParams.get('wallet')) ||
          normalizeWalletAddress(
            request.headers.get('x-wallet-address') ||
              request.headers.get('X-Wallet-Address'),
          )
        const statusParam = url.searchParams.get('status') || 'all'
        const type = url.searchParams.get('type') || 'all'
        const status = (
          ['settled', 'verified', 'failed', 'all'].includes(statusParam)
            ? statusParam
            : 'all'
        ) as ActivityStatus | 'all'

        try {
          const [activities, spend, stats] = await Promise.all([
            listActivities({ walletAddress: wallet, status, type }),
            dailySpend(14, wallet),
            getUserStats(wallet),
          ])

          return Response.json({
            object: 'list',
            data: activities,
            daily_spend: spend,
            stats,
          })
        } catch (err) {
          console.error('[api/v1/activities] unavailable', err)
          return Response.json({
            object: 'list',
            data: [],
            daily_spend: [],
            stats: {
              totalSpendUsdc: 0,
              todaySpendUsdc: 0,
              totalRequests: 0,
              settledRequests: 0,
              byType: [],
            },
          })
        }
      },
    },
  },
})

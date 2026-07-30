/**
 * Client fetchers for activities / user stats against Nest.
 * Call shape mirrors former createServerFn: `fn({ data })`.
 */

import { apiUrl } from '#/lib/api-url'
import type { Activity, ActivityStatus, UserStats } from '#/lib/activities-store'

const emptyStats: UserStats = {
  totalSpendUsdc: 0,
  todaySpendUsdc: 0,
  totalRequests: 0,
  settledRequests: 0,
  byType: [],
}

function normalizeWallet(address?: string | null): string | null {
  const a = address?.trim()
  return a || null
}

async function nestGet(
  path: string,
  wallet?: string | null,
): Promise<Response> {
  const headers = new Headers()
  if (wallet) headers.set('X-Wallet-Address', wallet)
  return fetch(apiUrl(path), { headers })
}

export async function fetchActivities(input?: {
  data?: {
    walletAddress?: string
    status?: ActivityStatus | 'all'
    type?: string
  }
}): Promise<{
  activities: Activity[]
  dailySpend: Array<{ day: string; usdc: number }>
  stats: UserStats
}> {
  const data = input?.data ?? {}
  const wallet = normalizeWallet(data.walletAddress)
  if (!wallet) {
    return { activities: [], dailySpend: [], stats: emptyStats }
  }

  const params = new URLSearchParams()
  params.set('limit', '100')
  if (data.status && data.status !== 'all') params.set('status', data.status)
  if (data.type && data.type !== 'all') params.set('type', data.type)

  try {
    const res = await nestGet(
      `/api/v1/activities?${params.toString()}`,
      wallet,
    )
    const raw = (await res.json().catch(() => ({}))) as {
      activities?: Activity[]
      dailySpend?: Array<{ day: string; usdc: number }>
      stats?: UserStats
      error?: { message?: string }
    }
    if (!res.ok) {
      console.error('[activities] Nest list failed', raw.error?.message)
      return { activities: [], dailySpend: [], stats: emptyStats }
    }
    return {
      activities: Array.isArray(raw.activities) ? raw.activities : [],
      dailySpend: Array.isArray(raw.dailySpend) ? raw.dailySpend : [],
      stats: raw.stats ?? emptyStats,
    }
  } catch (err) {
    console.error('[activities] list/stats unavailable', err)
    return { activities: [], dailySpend: [], stats: emptyStats }
  }
}

export async function fetchUserStats(input?: {
  data?: { walletAddress?: string }
}): Promise<UserStats> {
  const wallet = normalizeWallet(input?.data?.walletAddress)
  if (!wallet) return emptyStats
  try {
    const res = await nestGet('/api/v1/activities?statsOnly=1', wallet)
    const raw = (await res.json().catch(() => ({}))) as {
      stats?: UserStats
    }
    if (!res.ok) return emptyStats
    return raw.stats ?? emptyStats
  } catch (err) {
    console.error('[activities] user stats unavailable', err)
    return emptyStats
  }
}

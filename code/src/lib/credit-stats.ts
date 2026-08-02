import { apiUrl } from '#/lib/api-url'

export type CreditStats = {
  dailyCreditAllowanceUsdc: number
  dailyCreditUsedUsdc: number
  dailyCreditRemainingUsdc: number
  creditResetsAt: string
}

export async function fetchCreditStats(walletAddress: string): Promise<CreditStats> {
  const response = await fetch(apiUrl('/api/v1/activities?statsOnly=1'), {
    headers: { 'X-Wallet-Address': walletAddress },
  })
  if (!response.ok) throw new Error('Unable to load daily credit')
  const raw = (await response.json()) as { stats?: Partial<CreditStats> }
  return {
    dailyCreditAllowanceUsdc: raw.stats?.dailyCreditAllowanceUsdc ?? 0.1,
    dailyCreditUsedUsdc: raw.stats?.dailyCreditUsedUsdc ?? 0,
    dailyCreditRemainingUsdc: raw.stats?.dailyCreditRemainingUsdc ?? 0.1,
    creditResetsAt: raw.stats?.creditResetsAt ?? '',
  }
}

/**
 * @deprecated Prisma path — Nest owns model usage via UsersService.
 * Kept only for type re-exports / legacy imports. Prefer Nest APIs.
 */
export type ModelUsageRow = {
  modelSlug: string
  modelName: string | null
  lastUsedAt: string
  useCount: number
}

export async function recordModelUsage(_input: {
  walletAddress?: string | null
  modelSlug: string
  modelName?: string | null
}): Promise<void> {
  // No-op: Nest records usage on paid settle.
}

export async function listRecentModelUsage(_input: {
  walletAddress: string
  limit?: number
}): Promise<ModelUsageRow[]> {
  return []
}

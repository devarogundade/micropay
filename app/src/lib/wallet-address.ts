/** Browser-safe Algorand address helpers. */

const ALGO_ADDR = /^[A-Z2-7]{58}$/

/** Normalize / validate an Algorand address. */
export function normalizeWalletAddress(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!ALGO_ADDR.test(trimmed)) return null
  return trimmed
}

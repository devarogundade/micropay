/**
 * Minimal client helpers shared with the IDE agent (full proxy lives on app).
 */

export type ChatContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'image_url'
      image_url: { url: string; detail?: 'auto' | 'low' | 'high' }
    }

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatContentPart[]
}

/** Pull a numeric cost from provider trace without surfacing neuron jargon. */
export function costUsdcFromTrace(
  trace: Record<string, unknown> | undefined,
): number | undefined {
  if (!trace) return undefined
  const raw =
    trace.cost_usdc ??
    trace.usdc ??
    trace.cost ??
    trace.total_cost ??
    trace.amount ??
    trace.neuron_cost
  if (raw == null) return undefined
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  if (n > 100) return Number((n / 1_000_000_000).toFixed(6))
  return Number(n.toFixed(6))
}

export function providerLabelFromTrace(
  trace: Record<string, unknown> | undefined,
): string | undefined {
  if (!trace) return undefined
  const provider =
    (trace.provider as string) ||
    (trace.provider_address as string) ||
    (trace.providerAddress as string)
  return provider ? String(provider) : undefined
}

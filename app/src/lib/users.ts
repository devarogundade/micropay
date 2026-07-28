import type { PaymentPayload } from '@x402/core/types'

import { prisma } from '#/lib/db'
import { normalizeWalletAddress } from '#/lib/wallet-address'

export { normalizeWalletAddress }

/**
 * Resolve payer wallet: prefer client header, then payment payload fields.
 */
export function extractPayerAddress(
  request: Request,
  paymentPayload?: PaymentPayload | null,
): string | null {
  const fromHeader = normalizeWalletAddress(
    request.headers.get('x-wallet-address') ||
      request.headers.get('X-Wallet-Address'),
  )
  if (fromHeader) return fromHeader

  const payload = paymentPayload?.payload
  if (payload && typeof payload === 'object') {
    const rec = payload as Record<string, unknown>
    for (const key of ['payer', 'from', 'sender', 'address']) {
      const v = normalizeWalletAddress(
        typeof rec[key] === 'string' ? (rec[key] as string) : null,
      )
      if (v) return v
    }
  }

  return null
}

/** Upsert a User keyed by wallet address. */
export async function ensureUser(address: string) {
  const wallet = normalizeWalletAddress(address)
  if (!wallet) {
    throw new Error('Invalid Algorand wallet address')
  }

  return prisma.user.upsert({
    where: { id: wallet },
    create: { id: wallet, address: wallet },
    update: { updatedAt: new Date() },
  })
}

/** Ensure user when address present; return null id if anonymous. */
export async function ensureUserOptional(address: string | null | undefined) {
  const wallet = normalizeWalletAddress(address)
  if (!wallet) return { userId: null as string | null, walletAddress: null as string | null }
  const user = await ensureUser(wallet)
  return { userId: user.id, walletAddress: user.address }
}

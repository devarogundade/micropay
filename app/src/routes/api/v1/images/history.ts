import { createFileRoute } from '@tanstack/react-router'

import { listImageGenerations } from '#/lib/media-history-store'
import { normalizeWalletAddress } from '#/lib/users'

function walletFrom(request: Request) {
  return (
    normalizeWalletAddress(
      request.headers.get('x-wallet-address') ||
        request.headers.get('X-Wallet-Address'),
    ) ||
    normalizeWalletAddress(new URL(request.url).searchParams.get('wallet'))
  )
}

/** List persisted image generations for a wallet. */
export const Route = createFileRoute('/api/v1/images/history')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const wallet = walletFrom(request)
        if (!wallet) {
          return Response.json(
            { error: { message: 'wallet required', type: 'invalid_request' } },
            { status: 400 },
          )
        }

        try {
          const url = new URL(request.url)
          const limitRaw = url.searchParams.get('limit')
          const limit = limitRaw ? Number(limitRaw) : undefined
          const data = await listImageGenerations({
            walletAddress: wallet,
            limit: Number.isFinite(limit) ? limit : undefined,
          })
          return Response.json({ object: 'list', data })
        } catch (e) {
          const message =
            e instanceof Error ? e.message : 'Failed to load image history'
          return Response.json(
            { error: { message, type: 'server_error' } },
            { status: 500 },
          )
        }
      },
    },
  },
})

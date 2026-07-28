import { createFileRoute } from '@tanstack/react-router'

import { listTranscriptions } from '#/lib/media-history-store'
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

/** List persisted audio transcriptions for a wallet. */
export const Route = createFileRoute('/api/v1/audio/history')({
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
          const data = await listTranscriptions({
            walletAddress: wallet,
            limit: Number.isFinite(limit) ? limit : undefined,
          })
          return Response.json({ object: 'list', data })
        } catch (e) {
          const message =
            e instanceof Error ? e.message : 'Failed to load transcription history'
          return Response.json(
            { error: { message, type: 'server_error' } },
            { status: 500 },
          )
        }
      },
    },
  },
})

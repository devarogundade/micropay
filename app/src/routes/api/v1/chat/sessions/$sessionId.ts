import { createFileRoute } from '@tanstack/react-router'

import {
  clearChatSession,
  getChatSession,
} from '#/lib/chat-store'
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

/** Get or delete a chat session. */
export const Route = createFileRoute('/api/v1/chat/sessions/$sessionId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const wallet = walletFrom(request)
        if (!wallet) {
          return Response.json(
            { error: { message: 'wallet required', type: 'invalid_request' } },
            { status: 400 },
          )
        }
        const data = await getChatSession({
          sessionId: params.sessionId,
          walletAddress: wallet,
        })
        if (!data.session) {
          return Response.json(
            { error: { message: 'Not found', type: 'not_found' } },
            { status: 404 },
          )
        }
        return Response.json(data)
      },

      DELETE: async ({ request, params }) => {
        const wallet = walletFrom(request)
        if (!wallet) {
          return Response.json(
            { error: { message: 'wallet required', type: 'invalid_request' } },
            { status: 400 },
          )
        }
        const url = new URL(request.url)
        const deleteSession = url.searchParams.get('clear') !== '1'
        const ok = await clearChatSession({
          sessionId: params.sessionId,
          walletAddress: wallet,
          deleteSession,
        })
        if (!ok) {
          return Response.json(
            { error: { message: 'Not found', type: 'not_found' } },
            { status: 404 },
          )
        }
        return Response.json({ ok: true })
      },
    },
  },
})

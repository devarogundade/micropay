import { createFileRoute } from '@tanstack/react-router'

import {
  createChatSession,
  getLatestChatSession,
  listChatSessions,
  persistChatTurn,
} from '#/lib/chat-store'
import { normalizeWalletAddress } from '#/lib/users'

function walletFrom(request: Request, body?: { walletAddress?: string }) {
  return (
    normalizeWalletAddress(body?.walletAddress) ||
    normalizeWalletAddress(
      request.headers.get('x-wallet-address') ||
        request.headers.get('X-Wallet-Address'),
    ) ||
    normalizeWalletAddress(new URL(request.url).searchParams.get('wallet'))
  )
}

/** List / create chat sessions for a wallet. */
export const Route = createFileRoute('/api/v1/chat/sessions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const wallet = walletFrom(request)
        if (!wallet) {
          return Response.json(
            { error: { message: 'wallet required', type: 'invalid_request' } },
            { status: 400 },
          )
        }
        const modelId = url.searchParams.get('modelId') || undefined
        const latest = url.searchParams.get('latest') === '1'

        if (latest && modelId) {
          const data = await getLatestChatSession({
            walletAddress: wallet,
            modelId,
          })
          return Response.json(data)
        }

        const sessions = await listChatSessions({
          walletAddress: wallet,
          modelId,
        })
        return Response.json({ object: 'list', data: sessions })
      },

      POST: async ({ request }) => {
        let body: {
          walletAddress?: string
          modelId?: string
          modelSlug?: string
          title?: string
          sessionId?: string | null
          messages?: Array<{
            id?: string
            role: string
            content: string
            attachments?: Array<{
              id: string
              name: string
              mime: string
              mimeType?: string
              size: number
              kind: 'image' | 'text'
              url?: string
              storagePath?: string
              textContent?: string
            }>
            reasoning?: string
            modelId?: string
            costUsdc?: number
            provider?: string
            error?: boolean
          }>
        }
        try {
          body = (await request.json()) as typeof body
        } catch {
          return Response.json(
            { error: { message: 'Invalid JSON', type: 'invalid_request' } },
            { status: 400 },
          )
        }

        const wallet = walletFrom(request, body)
        if (!wallet || !body.modelId) {
          return Response.json(
            {
              error: {
                message: 'walletAddress and modelId required',
                type: 'invalid_request',
              },
            },
            { status: 400 },
          )
        }

        if (body.messages?.length) {
          const result = await persistChatTurn({
            walletAddress: wallet,
            modelId: body.modelId,
            modelSlug: body.modelSlug,
            sessionId: body.sessionId,
            title: body.title,
            messages: body.messages,
          })
          return Response.json(result)
        }

        const session = await createChatSession({
          walletAddress: wallet,
          modelId: body.modelId,
          modelSlug: body.modelSlug,
          title: body.title,
        })
        return Response.json(session, { status: 201 })
      },
    },
  },
})

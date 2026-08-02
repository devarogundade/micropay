import {
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { Toaster } from '#/components/ui/sonner'
import { TooltipProvider } from '#/components/ui/tooltip'
import { WalletConnectDialog } from '#/components/wallet-connect-dialog'
import {
  CODE_DESCRIPTION,
  CODE_TAGLINE,
  SITE_KEYWORDS,
  SITE_NAME,
  getCodeOrigin,
} from '#/lib/site-meta'
import { WalletProvider } from '#/lib/wallet'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const publicOrigin =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_PUBLIC_CODE_URL as string | undefined)?.replace(
      /\/$/,
      '',
    )) ||
  getCodeOrigin() ||
  ''

const ogImage = publicOrigin ? `${publicOrigin}/og.png` : '/og.png'
const canonical = publicOrigin ? `${publicOrigin}/` : undefined

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: `IDE · ${SITE_NAME} — ${CODE_TAGLINE}`,
      },
      {
        name: 'description',
        content: CODE_DESCRIPTION,
      },
      {
        name: 'keywords',
        content: SITE_KEYWORDS.join(', '),
      },
      { name: 'theme-color', content: '#09C72B' },
      { name: 'color-scheme', content: 'dark' },
      { name: 'application-name', content: `${SITE_NAME} IDE` },
      { name: 'author', content: SITE_NAME },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      {
        property: 'og:title',
        content: `IDE · ${SITE_NAME} — ${CODE_TAGLINE}`,
      },
      { property: 'og:description', content: CODE_DESCRIPTION },
      { property: 'og:image', content: ogImage },
      {
        property: 'og:image:alt',
        content: `${SITE_NAME} IDE — Algorand TypeScript`,
      },
      ...(canonical
        ? [
            { property: 'og:url', content: canonical },
            { name: 'twitter:url', content: canonical },
          ]
        : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      {
        name: 'twitter:title',
        content: `IDE · ${SITE_NAME} — ${CODE_TAGLINE}`,
      },
      { name: 'twitter:description', content: CODE_DESCRIPTION },
      { name: 'twitter:image', content: ogImage },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      ...(canonical ? [{ rel: 'canonical', href: canonical }] : []),
      {
        rel: 'alternate',
        type: 'application/json',
        href: '/.well-known/x402.json',
        title: 'x402 merchant card',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <WalletProvider>
      <TooltipProvider>
        <Outlet />
        <WalletConnectDialog />
        <Toaster position="top-right" richColors closeButton />
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        ) : null}
      </TooltipProvider>
    </WalletProvider>
  )
}

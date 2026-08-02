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
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TAGLINE,
  getPublicAppUrl,
} from '#/lib/site-meta'
import { WalletProvider } from '#/lib/wallet'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const publicOrigin =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_PUBLIC_APP_URL as string | undefined)?.replace(
      /\/$/,
      '',
    )) ||
  getPublicAppUrl() ||
  ''

const ogImage = publicOrigin
  ? `${publicOrigin}/og.png`
  : '/og.png'
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
        title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
      {
        name: 'description',
        content: SITE_DESCRIPTION,
      },
      {
        name: 'keywords',
        content: SITE_KEYWORDS.join(', '),
      },
      { name: 'theme-color', content: '#111111' },
      { name: 'color-scheme', content: 'light' },
      { name: 'application-name', content: SITE_NAME },
      { name: 'author', content: SITE_NAME },
      { name: 'robots', content: 'index, follow' },
      // Open Graph — Bazaar / social enrichment from domain scrape
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: `${SITE_NAME} — ${SITE_TAGLINE}` },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:image', content: ogImage },
      { property: 'og:image:alt', content: `${SITE_NAME} — pay-per-use AI` },
      ...(canonical
        ? [
            { property: 'og:url', content: canonical },
            { name: 'twitter:url', content: canonical },
          ]
        : []),
      // Twitter / X
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: `${SITE_NAME} — ${SITE_TAGLINE}` },
      { name: 'twitter:description', content: SITE_DESCRIPTION },
      { name: 'twitter:image', content: ogImage },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.png', type: 'image/png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      ...(canonical
        ? [{ rel: 'canonical', href: canonical }]
        : []),
      { rel: 'llms-txt', href: '/llms.txt', type: 'text/plain' },
      {
        rel: 'alternate',
        type: 'application/json',
        // Authoritative merchant card lives on apex when split; app copy is fallback.
        href:
          typeof import.meta !== 'undefined' &&
          (import.meta.env?.VITE_PUBLIC_SITE_URL as string | undefined)
            ? `${String(import.meta.env.VITE_PUBLIC_SITE_URL).replace(/\/$/, '')}/.well-known/x402.json`
            : '/.well-known/x402.json',
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

import '#/lib/buffer-polyfill.js'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SITE_NAME } from '@micropay/site-meta'

import { IdeApp } from './IdeApp'
import { Toaster } from '#/components/ui/sonner'
import { WalletConnectDialog } from '#/components/wallet-connect-dialog'
import { WalletProvider } from '#/lib/wallet'
import './styles.css'

document.title = `IDE · ${SITE_NAME}`

function Root() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <IdeApp />
        <WalletConnectDialog />
        <Toaster />
      </WalletProvider>
    </QueryClientProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

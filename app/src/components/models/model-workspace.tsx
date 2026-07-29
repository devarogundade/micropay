import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, LogOut, Wallet } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import { toast } from 'sonner'

import { BrandMark } from '#/components/brand'
import { ModelSwitcher } from '#/components/models/model-switcher'
import {
  getSkipPayConfirm,
  PayConfirmDialog,
} from '#/components/pay-confirm-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { LoadingState } from '#/components/ui/loading-state'
import { formatUsdc, type Model } from '#/data/models'
import { MODELS_CATALOG_STALE_MS } from '#/lib/models-catalog-query'
import { fetchModelsCatalog } from '#/lib/models-catalog.functions'
import { queryKeys } from '#/lib/query-keys'
import { useClientGsap } from '#/lib/use-client-gsap'
import { useWallet } from '#/lib/wallet'

const ChatPanel = lazy(() =>
  import('#/components/models/chat-panel').then((m) => ({
    default: m.ChatPanel,
  })),
)
const ImageStudio = lazy(() =>
  import('#/components/models/image-studio').then((m) => ({
    default: m.ImageStudio,
  })),
)
const AudioStudio = lazy(() =>
  import('#/components/models/audio-studio').then((m) => ({
    default: m.AudioStudio,
  })),
)

function StudioFallback() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center p-6">
      <LoadingState compact label="Loading workspace…" />
    </div>
  )
}

export function ModelWorkspace({ model }: { model: Model }) {
  const [payOpen, setPayOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const pendingRef = useRef<null | (() => Promise<void>)>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const { account, shortAddress, setConnectOpen, disconnect, fetchWithPay } =
    useWallet()

  const catalogQuery = useQuery({
    queryKey: queryKeys.modelsCatalog,
    queryFn: () => fetchModelsCatalog(),
    staleTime: MODELS_CATALOG_STALE_MS,
  })

  useClientGsap(rootRef, (gsap) => {
    gsap.from('.ws-header', {
      y: -8,
      opacity: 0,
      duration: 0.25,
      ease: 'power2.out',
    })
    gsap.from('.ws-body', {
      opacity: 0,
      y: 6,
      duration: 0.28,
      delay: 0.04,
      ease: 'power2.out',
    })
  })

  function runPaidAction(action: () => Promise<void>) {
    setPayOpen(false)
    setConfirming(true)
    void action()
      .catch(() => {
        /* toasts handled in panels */
      })
      .finally(() => {
        setConfirming(false)
      })
  }

  function requestPay(action: () => Promise<void>) {
    if (!account || !fetchWithPay) {
      setConnectOpen(true)
      toast.message('Connect a wallet to pay')
      return
    }
    if (getSkipPayConfirm()) {
      runPaidAction(action)
      return
    }
    pendingRef.current = action
    setPayOpen(true)
  }

  const catalog = catalogQuery.data?.models?.length
    ? catalogQuery.data.models
    : [model]

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-void">
      <header className="ws-header workspace-bar flex shrink-0 items-center gap-1.5 border-b border-border bg-carbon px-2 sm:gap-3 sm:px-4">
        <Link to="/" className="shrink-0 no-underline">
          <BrandMark size="sm" className="hidden sm:inline-block" />
          <BrandMark size="sm" variant="icon" className="sm:hidden" />
        </Link>

        <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-1.5 text-fog sm:px-2"
        >
          <Link to="/">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Models</span>
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <ModelSwitcher current={model} models={catalog} busy={busy} />
            <Badge variant="secondary" className="hidden h-6 sm:inline-flex">
              {model.type}
            </Badge>
            {model.supportsVision ? (
              <Badge
                variant="outline"
                className="hidden h-6 font-normal md:inline-flex"
              >
                Vision
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-void px-1.5 py-1 sm:gap-1.5 sm:px-2.5 sm:py-1.5">
            <img src="/assets/usdc.png" alt="" className="size-3.5" />
            <span className="text-[11px] font-medium text-paper sm:text-[12px]">
              {formatUsdc(model.priceUsdc)}
            </span>
          </div>

          {account ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="hidden items-center gap-2 rounded-md border border-border bg-void px-2.5 py-1.5 sm:flex">
                <img
                  src="/assets/algorand.png"
                  alt=""
                  className="size-4 rounded-sm"
                />
                <span className="font-mono text-[13px] tracking-tight text-mist">
                  {shortAddress}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-fog sm:h-9 sm:px-2.5"
                onClick={() => disconnect()}
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="h-8 px-2 sm:h-9 sm:px-3"
              onClick={() => setConnectOpen(true)}
            >
              <Wallet className="size-4" />
              <span className="hidden sm:inline">Pay with wallet</span>
            </Button>
          )}
        </div>
      </header>

      <div className="ws-body min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<StudioFallback />}>
          {model.type === 'Chat' ? (
            <ChatPanel
              model={model}
              onRequestPay={requestPay}
              onBusyChange={setBusy}
            />
          ) : null}
          {model.type === 'Image Gen' ? (
            <ImageStudio
              model={model}
              onRequestPay={requestPay}
              onBusyChange={setBusy}
            />
          ) : null}
          {model.type === 'Audio' ? (
            <AudioStudio
              model={model}
              onRequestPay={requestPay}
              onBusyChange={setBusy}
            />
          ) : null}
        </Suspense>
      </div>

      <PayConfirmDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        model={model}
        confirming={confirming}
        onConfirm={() => {
          const action = pendingRef.current
          pendingRef.current = null
          if (!action) return
          // Dismiss immediately so the popup doesn't linger through wallet
          // signing + streaming (matches Playground).
          runPaidAction(action)
        }}
      />
    </div>
  )
}

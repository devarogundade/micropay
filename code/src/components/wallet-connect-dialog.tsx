import { Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { useWallet } from '#/lib/wallet'

const PROVIDERS = [
  {
    id: 'Pera',
    name: 'Pera Wallet',
    hint: 'Algorand mobile & browser',
    logoSrc: '/assets/wallets/pera.png',
  },
  {
    id: 'Defly',
    name: 'Defly',
    hint: 'Fast Algorand wallet',
    logoSrc: '/assets/wallets/defly.png',
  },
  {
    id: 'Lute',
    name: 'Lute',
    hint: 'Browser extension',
    logoSrc: '/assets/wallets/lute.png',
  },
  {
    id: 'Kibisis',
    name: 'Kibisis',
    hint: 'Browser extension',
    logoSrc: '/assets/wallets/kibisis.png',
  },
] as const

export function WalletConnectDialog() {
  const { connectOpen, setConnectOpen, connect, isConnecting } = useWallet()

  return (
    <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
      <DialogContent className="border-border bg-carbon sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5" />
            Connect wallet
          </DialogTitle>
          <DialogDescription>
            Connect an Algorand wallet to pay with{' '}
            <span className="inline-flex items-center gap-1 align-middle">
              <img src="/assets/usdc.png" alt="" className="size-3.5" />
              USDC
            </span>{' '}
            on{' '}
            {import.meta.env.VITE_X402_NETWORK === 'testnet'
              ? 'Testnet'
              : 'Mainnet'}
            .
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {PROVIDERS.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3"
              disabled={isConnecting}
              onClick={async () => {
                try {
                  await connect(p.id)
                  toast.success(`Connected with ${p.name}`, {
                    description: 'Ready to pay per use with USDC.',
                  })
                } catch (e) {
                  const raw =
                    e instanceof Error ? e.message : 'Failed to connect wallet'
                  const isWcCtor =
                    /is not a constructor|Can't find variable: global|global is not defined/i.test(
                      raw,
                    )
                  toast.error(
                    isWcCtor
                      ? `${p.name} failed to start WalletConnect. Hard-refresh and try again, or use another wallet.`
                      : raw,
                  )
                }
              }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-void">
                <img
                  src={p.logoSrc}
                  alt=""
                  className="size-full object-cover"
                  width={36}
                  height={36}
                />
              </span>
              <span className="flex flex-col items-start text-left">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.hint}</span>
              </span>
              {isConnecting ? (
                <Loader2 className="ml-auto size-4 animate-spin" />
              ) : null}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          You’ll confirm each charge in your wallet before anything runs.
        </p>
      </DialogContent>
    </Dialog>
  )
}

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { formatUsdc, type Model } from '#/data/models'
import { useWallet } from '#/lib/wallet'
import { cn } from '#/lib/utils'

const SKIP_PAY_CONFIRM_KEY = 'micropay.skip-pay-confirm'

export function getSkipPayConfirm(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SKIP_PAY_CONFIRM_KEY) === '1'
  } catch {
    return false
  }
}

export function setSkipPayConfirm(skip: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (skip) window.localStorage.setItem(SKIP_PAY_CONFIRM_KEY, '1')
    else window.localStorage.removeItem(SKIP_PAY_CONFIRM_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: Model
  /** Called after the user confirms — parent runs the real paid API call. */
  onConfirm: () => void
  confirming?: boolean
}

/** Confirms intent to pay. Settlement runs via the parent's paid fetch. */
export function PayConfirmDialog({
  open,
  onOpenChange,
  model,
  onConfirm,
  confirming = false,
}: Props) {
  const { account, setConnectOpen } = useWallet()
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    if (open) setDontShowAgain(false)
  }, [open])

  function handleContinue() {
    if (!account) {
      onOpenChange(false)
      setConnectOpen(true)
      return
    }
    if (dontShowAgain) setSkipPayConfirm(true)
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-carbon sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay with wallet</DialogTitle>
          <DialogDescription>
            Confirm this USDC charge in your wallet, then we’ll run your
            request.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Model</p>
              <p className="truncate font-medium">{model.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm text-muted-foreground">About</p>
              <p className="flex items-center justify-end gap-1.5 text-lg font-semibold tracking-tight">
                <img
                  src="/assets/usdc.png"
                  alt=""
                  className="size-5"
                  width={20}
                  height={20}
                />
                {formatUsdc(model.priceUsdc)}
              </p>
            </div>
          </div>
          <ol className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <li>1. Your daily 0.1 USDC credit is applied first</li>
            <li>2. You confirm only any remaining amount in your wallet</li>
            <li>3. Your result comes back</li>
          </ol>
        </div>

        <Label
          htmlFor="skip-pay-confirm"
          className={cn(
            'cursor-pointer font-normal text-muted-foreground',
            confirming && 'pointer-events-none opacity-50',
          )}
        >
          <input
            id="skip-pay-confirm"
            type="checkbox"
            checked={dontShowAgain}
            disabled={confirming}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="size-4 shrink-0 rounded border border-border bg-void accent-primary"
          />
          Don’t show this again
        </Label>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Paying…
              </>
            ) : account ? (
              'Pay & continue'
            ) : (
              'Connect to pay'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

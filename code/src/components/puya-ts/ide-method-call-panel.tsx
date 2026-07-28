import { Loader2, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { DeployNetwork } from '#/components/puya-ts/puya-ts-deploy'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { CompileMethod, CompileResult } from '#/lib/puya-ts-compile'
import {
  callContractMethod,
  methodParamMeta,
} from '#/lib/ide-method-call'
import { useWallet } from '#/lib/wallet'

export function IdeMethodCallPanel({
  compileResult,
  network,
  deployedAppId,
  onAppIdChange,
}: {
  compileResult: CompileResult | null
  network: DeployNetwork
  deployedAppId: string
  onAppIdChange: (id: string) => void
}) {
  const { account, setConnectOpen, signTransactions } = useWallet()
  const methods = compileResult?.methods ?? []
  const [methodName, setMethodName] = useState('')
  const [argValues, setArgValues] = useState<Record<string, string>>({})
  const [calling, setCalling] = useState(false)
  const [lastResult, setLastResult] = useState<{
    txId: string
    returnValue: string | null
    explorerUrl: string | null
  } | null>(null)

  const selected: CompileMethod | null = useMemo(() => {
    if (!methods.length) return null
    return methods.find((m) => m.name === methodName) ?? methods[0] ?? null
  }, [methods, methodName])

  const params = selected ? methodParamMeta(selected) : []

  async function runCall() {
    if (!selected) {
      toast.error('Compile a contract to list methods')
      return
    }
    if (!account) {
      setConnectOpen(true)
      toast.message('Connect a wallet to call methods')
      return
    }
    const appId = Number(deployedAppId)
    if (!Number.isFinite(appId) || appId <= 0) {
      toast.error('Enter a valid deployed application id')
      return
    }
    setCalling(true)
    setLastResult(null)
    try {
      const args = params.map((p) => argValues[p.name] ?? '')
      const result = await callContractMethod({
        appId,
        method: selected,
        args,
        sender: account.address,
        network,
        signTransactions,
      })
      setLastResult({
        txId: result.txId,
        returnValue: result.returnValue,
        explorerUrl: result.explorerUrl,
      })
      toast.success(`Called ${selected.name}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Method call failed')
    } finally {
      setCalling(false)
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wider text-fog">
          Application id
        </p>
        <Input
          value={deployedAppId}
          onChange={(e) => onAppIdChange(e.target.value)}
          placeholder="After deploy, paste app id"
          className="font-mono text-sm"
        />
      </div>

      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wider text-fog">
          Method
        </p>
        {methods.length === 0 ? (
          <p className="text-[12px] text-fog">
            Compile successfully to list contract methods.
          </p>
        ) : (
          <Select
            value={selected?.name}
            onValueChange={(v) => {
              setMethodName(v)
              setArgValues({})
            }}
          >
            <SelectTrigger className="bg-void font-mono text-sm">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {methods.map((m) => (
                <SelectItem key={m.name} value={m.name} className="font-mono">
                  {m.name}(): {m.returnType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {params.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-fog">
            Arguments
          </p>
          {params.map((p) => (
            <div key={p.name}>
              <label className="mb-1 block font-mono text-[11px] text-mist">
                {p.name}: {p.typeHint}
              </label>
              <Input
                value={argValues[p.name] ?? ''}
                onChange={(e) =>
                  setArgValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                }
                className="font-mono text-sm"
                placeholder={p.typeHint}
              />
            </div>
          ))}
        </div>
      ) : null}

      <Button
        size="sm"
        className="gap-1.5"
        disabled={calling || !selected}
        onClick={() => void runCall()}
      >
        {calling ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Play className="size-3.5" />
        )}
        Call method
      </Button>

      {lastResult ? (
        <div className="space-y-1 rounded-md border border-border bg-carbon p-3 font-mono text-[12px] text-mist">
          <p>
            <span className="text-fog">tx:</span> {lastResult.txId || '—'}
          </p>
          <p>
            <span className="text-fog">return:</span>{' '}
            <span className="text-paper">
              {lastResult.returnValue ?? '(void)'}
            </span>
          </p>
          {lastResult.explorerUrl ? (
            <a
              href={lastResult.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-signal-teal underline-offset-2 hover:underline"
            >
              View transaction
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

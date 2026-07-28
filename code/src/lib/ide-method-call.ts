/**
 * ABI method calls against a deployed application (algod + wallet).
 */

import algosdk from 'algosdk'

import {
  type DeployNetwork,
  algodClientForNetwork,
} from '#/components/puya-ts/puya-ts-deploy'
import type { CompileMethod } from '#/lib/puya-ts-compile'

export type MethodCallArg = string

export type MethodCallResult = {
  txId: string
  returnValue: string | null
  explorerUrl: string | null
  rawLogs: string[]
}

function explorerTxUrl(network: DeployNetwork, txId: string): string | null {
  if (network === 'localnet') return null
  return `https://lora.algokit.io/${network}/transaction/${txId}`
}

/** Parse a user-entered arg string into an ABI value given a TS-ish type hint. */
export function coerceAbiArg(
  raw: string,
  typeHint: string,
): string | number | bigint | boolean | Uint8Array {
  const t = typeHint.toLowerCase().replace(/\s/g, '')
  const v = raw.trim()

  if (t.includes('bool') || t === 'boolean') {
    if (v === 'true' || v === '1') return true
    if (v === 'false' || v === '0') return false
    throw new Error(`Expected boolean for ${typeHint}`)
  }

  if (
    t.includes('uint') ||
    t.includes('uint64') ||
    t === 'number' ||
    t === 'bigint'
  ) {
    if (!/^\d+$/.test(v)) throw new Error(`Expected integer for ${typeHint}`)
    return BigInt(v)
  }

  if (t.includes('byte') || t.includes('uint8array')) {
    if (v.startsWith('0x')) {
      const hex = v.slice(2)
      const out = new Uint8Array(hex.length / 2)
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
      }
      return out
    }
    return new TextEncoder().encode(v)
  }

  // Account / address — leave as string; algosdk ABI accepts address strings
  if (t.includes('account') || t.includes('address')) {
    if (!algosdk.isValidAddress(v)) {
      throw new Error(`Invalid Algorand address for ${typeHint}`)
    }
    return v
  }

  // Default: string
  return v
}

function paramTypeHint(param: string): string {
  const parts = param.split(':')
  return parts.length > 1 ? parts.slice(1).join(':').trim() : 'string'
}

function paramName(param: string): string {
  return param.split(':')[0]?.replace(/[=].*$/, '').trim() || 'arg'
}

export function methodParamMeta(method: CompileMethod): Array<{
  name: string
  typeHint: string
  raw: string
}> {
  return method.params.map((p) => ({
    name: paramName(p),
    typeHint: paramTypeHint(p),
    raw: p,
  }))
}

function mapReturnType(returnType: string): string {
  const t = returnType.toLowerCase().replace(/\s/g, '')
  if (!t || t === 'void' || t === 'undefined') return 'void'
  if (t.includes('bool')) return 'bool'
  if (t.includes('uint64') || t === 'number' || t === 'bigint') return 'uint64'
  if (t.includes('byte')) return 'byte[]'
  if (t.includes('account') || t.includes('address')) return 'address'
  return 'string'
}

function mapArgType(typeHint: string): string {
  const t = typeHint.toLowerCase().replace(/\s/g, '')
  if (t.includes('bool')) return 'bool'
  if (t.includes('uint') || t === 'number' || t === 'bigint') return 'uint64'
  if (t.includes('byte')) return 'byte[]'
  if (t.includes('account') || t.includes('address')) return 'address'
  return 'string'
}

/**
 * Call an ARC-4 method on a deployed app using algosdk ABIMethod.
 * Arg types are inferred from compile method signatures (best-effort).
 */
export async function callContractMethod(input: {
  appId: number | bigint
  method: CompileMethod
  args: MethodCallArg[]
  sender: string
  network: DeployNetwork
  signTransactions: (
    txns: Uint8Array[],
    indexesToSign?: number[],
  ) => Promise<(Uint8Array | null)[]>
}): Promise<MethodCallResult> {
  const algod = algodClientForNetwork(input.network)
  const meta = methodParamMeta(input.method)
  if (input.args.length !== meta.length) {
    throw new Error(
      `Expected ${meta.length} arg(s) for ${input.method.name}, got ${input.args.length}`,
    )
  }

  const abiArgs = meta.map((m, i) => coerceAbiArg(input.args[i] ?? '', m.typeHint))
  const ret = mapReturnType(input.method.returnType)
  const abiMethod = new algosdk.ABIMethod({
    name: input.method.name,
    args: meta.map((m) => ({
      type: mapArgType(m.typeHint),
      name: m.name,
    })),
    returns: { type: ret === 'void' ? 'void' : ret },
  })

  const sp = await algod.getTransactionParams().do()
  const atc = new algosdk.AtomicTransactionComposer()
  atc.addMethodCall({
    appID: BigInt(input.appId),
    method: abiMethod,
    methodArgs: abiArgs,
    sender: input.sender,
    suggestedParams: sp,
    signer: async (txnGroup, indexesToSign) => {
      const encoded = txnGroup.map((t) =>
        algosdk.encodeUnsignedTransaction(t),
      )
      const signed = await input.signTransactions(encoded, indexesToSign)
      return signed.map((s, i) => {
        if (!s) throw new Error(`Missing signature for txn ${i}`)
        return s
      })
    },
  })

  const result = await atc.execute(algod, 8)
  const txId = result.txIDs[0] || ''
  let returnValue: string | null = null
  if (result.methodResults?.[0]) {
    const mr = result.methodResults[0]
    if (mr.returnValue !== undefined && mr.returnValue !== null) {
      returnValue =
        typeof mr.returnValue === 'object'
          ? JSON.stringify(mr.returnValue, (_, v) =>
              typeof v === 'bigint' ? v.toString() : v,
            )
          : String(mr.returnValue)
    }
  }

  const rawLogs: string[] = []
  // methodResults may include raw return bytes; keep simple string form
  return {
    txId,
    returnValue,
    explorerUrl: explorerTxUrl(input.network, txId),
    rawLogs,
  }
}

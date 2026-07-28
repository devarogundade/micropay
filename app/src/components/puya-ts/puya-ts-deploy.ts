import algosdk from 'algosdk'

export type DeployNetwork = 'mainnet' | 'testnet' | 'localnet'

const NETWORK_LABELS: Record<DeployNetwork, string> = {
  mainnet: 'Algorand MainNet',
  testnet: 'Algorand TestNet',
  localnet: 'Algorand LocalNet',
}

const DEFAULT_ENDPOINTS: Record<
  DeployNetwork,
  { server: string; token: string; port: string }
> = {
  mainnet: {
    server: 'https://mainnet-api.algonode.cloud',
    token: '',
    port: '',
  },
  testnet: {
    server: 'https://testnet-api.algonode.cloud',
    token: '',
    port: '',
  },
  localnet: {
    server: 'http://localhost:4001',
    token: 'a'.repeat(64),
    port: '',
  },
}

export const DEPLOY_NETWORKS: DeployNetwork[] = [
  'mainnet',
  'testnet',
  'localnet',
]

export function defaultDeployNetwork(): DeployNetwork {
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_X402_NETWORK === 'testnet'
  ) {
    return 'testnet'
  }
  return 'mainnet'
}

export function algodClientForNetwork(network: DeployNetwork) {
  const custom =
    typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_ALGOD_SERVER as string | undefined)
      : undefined

  // Custom Algod overrides only when targeting LocalNet (typical local / custom node).
  if (custom && network === 'localnet') {
    const token =
      (import.meta.env?.VITE_ALGOD_TOKEN as string | undefined) ||
      DEFAULT_ENDPOINTS.localnet.token
    const port = (import.meta.env?.VITE_ALGOD_PORT as string | undefined) || ''
    return new algosdk.Algodv2(token, custom, port)
  }

  const ep = DEFAULT_ENDPOINTS[network]
  return new algosdk.Algodv2(ep.token, ep.server, ep.port)
}

/** @deprecated Prefer algodClientForNetwork */
function algodClient(network: DeployNetwork) {
  return algodClientForNetwork(network)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export type DeployResult = {
  appId: number | bigint
  txId: string
  network: DeployNetwork
  explorerUrl: string
}

export async function deployStubApplication(input: {
  approvalTeal: string
  clearTeal: string
  sender: string
  network: DeployNetwork
  signTransactions: (
    txns: Uint8Array[],
    indexesToSign?: number[],
  ) => Promise<(Uint8Array | null)[]>
}): Promise<DeployResult> {
  const network = input.network
  const algod = algodClient(network)

  const [approval, clear, sp] = await Promise.all([
    algod.compile(input.approvalTeal).do(),
    algod.compile(input.clearTeal).do(),
    algod.getTransactionParams().do(),
  ])

  if (!approval.result || !clear.result) {
    throw new Error('Algod TEAL compile returned empty programs')
  }

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: input.sender,
    suggestedParams: sp,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: b64ToBytes(approval.result),
    clearProgram: b64ToBytes(clear.result),
    numGlobalByteSlices: 1,
    numGlobalInts: 1,
    numLocalByteSlices: 0,
    numLocalInts: 0,
  })

  const encoded = algosdk.encodeUnsignedTransaction(txn)
  const signed = await input.signTransactions([encoded], [0])
  const signedTxn = signed[0]
  if (!signedTxn) {
    throw new Error('Wallet did not return a signed transaction')
  }

  const { txid } = await algod.sendRawTransaction(signedTxn).do()
  const confirmed = await algosdk.waitForConfirmation(algod, txid, 8)
  const appId = confirmed.applicationIndex
  if (appId === undefined || appId === null) {
    throw new Error('Deploy succeeded but application index was missing')
  }

  const explorerUrl =
    network === 'localnet'
      ? `localnet://application/${appId}`
      : `https://lora.algokit.io/${network}/application/${appId}`

  return {
    appId,
    txId: txid,
    network,
    explorerUrl,
  }
}

export function deployNetworkLabel(network: DeployNetwork) {
  return NETWORK_LABELS[network]
}

/**
 * Real Algorand wallet connect via @txnlab/use-wallet-react (Pera / Defly / Lute / Kibisis).
 * Exposes a thin Micropay-shaped API plus x402-aware fetchWithPay.
 *
 * WalletManager is created only in the browser — module-level construction
 * during SSR can throw HTTPError and take down the whole Netlify function.
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils/algorand-client'
import {
  NetworkId,
  WalletId,
  WalletManager,
} from '@txnlab/use-wallet'
import {
  WalletProvider as TxnlabWalletProvider,
  useWallet as useTxnlabWallet,
} from '@txnlab/use-wallet-react'
import type { ClientAvmSigner } from '@x402/avm'
import { ExactAvmScheme } from '@x402/avm/exact/client'
import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * AlgoKit TransactionComposer defaults to a 10-round validity window on
 * MainNet/TestNet (~25–30s). That expires during 402 → wallet approve →
 * PAYMENT-SIGNATURE retry → facilitator verify/settle/simulate.
 * Use the typical Algorand max window and skip suggested-params caching
 * so firstValid is fresh at build/sign time.
 */
function createX402AlgorandClient() {
  const client =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_X402_NETWORK === 'testnet'
      ? AlgorandClient.testNet()
      : AlgorandClient.mainNet()
  return client
    .setDefaultValidityWindow(1000)
    .setSuggestedParamsCacheTimeout(0)
}

export type WalletAccount = {
  address: string
  label: string
  provider: string
}

type MicropayWalletApi = {
  account: WalletAccount | null
  /** False until client mount — avoid SSR/client wallet UI mismatches. */
  hasHydrated: boolean
  isConnecting: boolean
  connectOpen: boolean
  setConnectOpen: (open: boolean) => void
  connect: (provider: string) => Promise<void>
  disconnect: () => Promise<void>
  shortAddress: string | null
  /** Payment-enabled fetch (null until a wallet is connected). */
  fetchWithPay: typeof fetch | null
  signTransactions: (
    txns: Uint8Array[],
    indexesToSign?: number[],
  ) => Promise<(Uint8Array | null)[]>
}

const MicropayWalletContext = createContext<MicropayWalletApi | null>(null)

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

const PROVIDER_TO_WALLET: Record<string, WalletId> = {
  Pera: WalletId.PERA,
  Defly: WalletId.DEFLY,
  Lute: WalletId.LUTE,
  Kibisis: WalletId.KIBISIS,
}

const isTestnet =
  typeof import.meta !== 'undefined' &&
  import.meta.env?.VITE_X402_NETWORK === 'testnet'

/** Algorand genesis / WalletConnect chain ids used by Pera & Defly. */
const walletChainId = isTestnet
  ? (416002 as const)
  : (416001 as const)

const defaultNetwork = isTestnet ? NetworkId.TESTNET : NetworkId.MAINNET

function createWalletManager() {
  return new WalletManager({
    wallets: [
      { id: WalletId.PERA, options: { chainId: walletChainId } },
      { id: WalletId.DEFLY, options: { chainId: walletChainId } },
      WalletId.LUTE,
      WalletId.KIBISIS,
    ],
    defaultNetwork,
  })
}

const ssrWalletStub: MicropayWalletApi = {
  account: null,
  hasHydrated: false,
  isConnecting: false,
  connectOpen: false,
  setConnectOpen: () => {},
  connect: async () => {
    throw new Error('Wallet is only available in the browser')
  },
  disconnect: async () => {},
  shortAddress: null,
  fetchWithPay: null,
  signTransactions: async () => {
    throw new Error('Wallet is only available in the browser')
  },
}

function MicropayWalletBridge({ children }: { children: ReactNode }) {
  const {
    activeAccount,
    activeWallet,
    wallets,
    signTransactions,
  } = useTxnlabWallet()

  const [connectOpen, setConnectOpen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const account: WalletAccount | null =
    hasHydrated && activeAccount
      ? {
          address: activeAccount.address,
          label: activeWallet?.metadata?.name || activeAccount.name || 'Wallet',
          provider: activeWallet?.metadata?.name || 'Algorand',
        }
      : null

  const connect = useCallback(
    async (provider: string) => {
      const id = PROVIDER_TO_WALLET[provider] ?? WalletId.PERA
      const wallet = wallets.find((w) => w.id === id)
      if (!wallet) {
        throw new Error(`Wallet ${provider} is not available in this browser`)
      }
      setIsConnecting(true)
      try {
        await wallet.connect()
        setConnectOpen(false)
      } finally {
        setIsConnecting(false)
      }
    },
    [wallets],
  )

  const disconnect = useCallback(async () => {
    if (activeWallet) {
      await activeWallet.disconnect()
    }
  }, [activeWallet])

  const signer: ClientAvmSigner | null = useMemo(() => {
    if (!activeAccount) return null
    return {
      address: activeAccount.address,
      signTransactions: async (
        txns: Uint8Array[],
        indexesToSign?: number[],
      ) => {
        return signTransactions(txns, indexesToSign)
      },
    }
  }, [activeAccount, signTransactions])

  const fetchWithPay = useMemo(() => {
    if (!signer || !activeAccount) return null
    const client = new x402Client()
    client.register(
      'algorand:*',
      new ExactAvmScheme(signer, {
        algorandClient: createX402AlgorandClient(),
      }),
    )
    const paid = wrapFetchWithPayment(fetch, client)
    const address = activeAccount.address
    return (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      headers.set('X-Wallet-Address', address)
      return paid(input, { ...init, headers })
    }
  }, [signer, activeAccount])

  const shortAddress = account ? shorten(account.address) : null

  const value = useMemo<MicropayWalletApi>(
    () => ({
      account,
      hasHydrated,
      isConnecting,
      connectOpen,
      setConnectOpen,
      connect,
      disconnect,
      shortAddress,
      fetchWithPay,
      signTransactions: (txns, indexesToSign) =>
        signTransactions(txns, indexesToSign),
    }),
    [
      account,
      hasHydrated,
      isConnecting,
      connectOpen,
      connect,
      disconnect,
      shortAddress,
      fetchWithPay,
      signTransactions,
    ],
  )

  return (
    <MicropayWalletContext.Provider value={value}>
      {children}
    </MicropayWalletContext.Provider>
  )
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [manager, setManager] = useState<WalletManager | null>(null)

  useEffect(() => {
    setManager(createWalletManager())
  }, [])

  // SSR + first client paint: stub context (no WalletManager / no network).
  if (!manager) {
    return (
      <MicropayWalletContext.Provider value={ssrWalletStub}>
        {children}
      </MicropayWalletContext.Provider>
    )
  }

  return (
    <TxnlabWalletProvider manager={manager}>
      <MicropayWalletBridge>{children}</MicropayWalletBridge>
    </TxnlabWalletProvider>
  )
}

export function useWallet(): MicropayWalletApi {
  const ctx = useContext(MicropayWalletContext)
  if (!ctx) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return ctx
}

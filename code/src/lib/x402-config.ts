/**
 * x402 / Algorand settlement config (server-side).
 *
 * Facilitator (Mainnet + Testnet): https://facilitator.goplausible.xyz
 * Live feePayer: GET https://facilitator.goplausible.xyz/supported
 *
 * Challenge / composite entry notes:
 * - Mainnet: ALGORAND_Mainnet_CAIP2, USDC ASA 31566704
 * - Testnet: ALGORAND_Testnet_CAIP2, USDC ASA 10458941 (validation only)
 * - App paid routes share this app's X402_PAY_TO (chat / images / audio)
 * - IDE is a separate product surface; settlements still use the shared DB
 *   (same DATABASE_URL + Activity table, type "IDE")
 * - GoPlausible: register product hosts as needed for discovery
 * - Public HTTPS required for Bazaar + leaderboard (localhost does not count)
 */

import {
  ALGORAND_MAINNET_CAIP2,
  ALGORAND_TESTNET_CAIP2,
  USDC_MAINNET_ASA_ID,
  USDC_TESTNET_ASA_ID,
} from '@x402/avm'
import { MAX_PAY_USDC, MIN_PAY_USDC } from '#/data/models'

export type X402Network = 'mainnet' | 'testnet'

/** Required `extra.tag` for Algorand x402 Global Challenge Bazaar + leaderboard. */
export const X402_CHALLENGE_TAG = 'x402-global-challenge'

/**
 * GoPlausible facilitator fee payer (Mainnet + Testnet).
 * Confirmed via facilitator `/supported` and the challenge checklist screenshot.
 */
export const GOPLAUSIBLE_FEE_PAYER =
  'ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA'

export function getX402Network(): X402Network {
  const n = process.env.X402_NETWORK?.trim().toLowerCase()
  return n === 'testnet' ? 'testnet' : 'mainnet'
}

/** CAIP-2 network id (`ALGORAND_Mainnet_CAIP2` / `ALGORAND_Testnet_CAIP2`). */
export function getX402Caip2(): string {
  return getX402Network() === 'testnet'
    ? ALGORAND_TESTNET_CAIP2
    : ALGORAND_MAINNET_CAIP2
}

/** USDC ASA id — Mainnet `31566704`, Testnet `10458941`. */
export function getX402UsdcAsa(): string {
  return getX402Network() === 'testnet'
    ? USDC_TESTNET_ASA_ID
    : USDC_MAINNET_ASA_ID
}

export function getX402PayTo(): string | undefined {
  const addr = process.env.X402_PAY_TO?.trim()
  return addr || undefined
}

export function getX402FacilitatorUrl(): string {
  return (
    process.env.X402_FACILITATOR_URL?.trim().replace(/\/$/, '') ||
    'https://facilitator.goplausible.xyz'
  )
}

/**
 * Facilitator fee payer for gasless AVM groups.
 * Override with X402_FEE_PAYER only if GoPlausible publishes a new address.
 */
export function getX402FeePayer(): string {
  return process.env.X402_FEE_PAYER?.trim() || GOPLAUSIBLE_FEE_PAYER
}

/** Shared `accepts.extra` for challenge-ready exact payments. */
export function getX402PaymentExtra(asset: string = getX402UsdcAsa()) {
  return {
    asset,
    feePayer: getX402FeePayer(),
    tag: X402_CHALLENGE_TAG,
  }
}

export function x402Configured(): boolean {
  return Boolean(getX402PayTo())
}

/** Format a USD/USDC display price as an x402 Money string, e.g. "$0.02". */
export function toX402Price(usdc: number): string {
  if (!Number.isFinite(usdc) || usdc <= 0) {
    throw new Error(
      `Invalid x402 price (${String(usdc)}). Model catalog must provide a positive USDC estimate.`,
    )
  }
  // Clamp to the Micropay per-use band so challenges match catalog prices.
  const amount = Math.min(MAX_PAY_USDC, Math.max(MIN_PAY_USDC, usdc))
  const fixed =
    amount < 0.0001
      ? amount.toFixed(6)
      : amount < 0.01
        ? amount.toFixed(4)
        : amount.toFixed(3)
  const trimmed = fixed.replace(/\.?0+$/, '')
  return `$${trimmed || fixed}`
}

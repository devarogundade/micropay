/**
 * Browser Buffer for wallet / x402 client code.
 * Uses the npm `buffer` package (includes Buffer.byteLength, etc.).
 */
import { Buffer as NodeBuffer } from 'buffer'

export const Buffer = NodeBuffer

export function ensureBufferGlobal() {
  // Always install a complete Buffer — Vite stubs can leave a partial global
  // without static helpers like byteLength.
  globalThis.Buffer = NodeBuffer
  if (typeof globalThis.global === 'undefined') {
    globalThis.global = globalThis
  }
}

ensureBufferGlobal()

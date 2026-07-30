/**
 * Realtime transport for Micropay app ↔ Nest backend.
 *
 * Nest Socket.IO namespace: `/realtime`
 * Events: `job.progress`, `job.completed`, `job.failed`, `usage.updated`
 * Client emits: `join` { walletAddress }, `subscribeJob` { jobId }
 */

import { io, type Socket } from 'socket.io-client'

import { getApiUrl } from '#/lib/api-url'

export const REALTIME_TRANSPORT = {
  chatTokens: 'sse',
  /** Image / AI jobs prefer Socket.IO `job.*` events (SSE job streams removed). */
  imageJobs: 'websocket',
  aiJobs: 'websocket',
  activities: 'poll',
  websockets: 'socket.io',
} as const

export function getRealtimeUrl(): string {
  return getApiUrl() || 'http://localhost:4000'
}

export type RealtimeSocket = {
  on: (event: string, cb: (...args: unknown[]) => void) => void
  off: (event: string, cb?: (...args: unknown[]) => void) => void
  emit: (event: string, payload?: unknown) => void
  disconnect: () => void
}

export type JobProgressEvent = {
  jobId: string
  status: string
  progress: number
  message?: string
  result?: unknown
  walletAddress?: string
}

let shared: Socket | null = null

/**
 * Connect to Nest `/realtime` namespace for job.progress / usage.updated.
 */
export async function connectRealtime(input?: {
  walletAddress?: string
}): Promise<{ socket: RealtimeSocket } | null> {
  if (typeof window === 'undefined') return null

  try {
    if (shared?.connected) {
      if (input?.walletAddress) {
        shared.emit('join', { walletAddress: input.walletAddress })
      }
      return { socket: shared as unknown as RealtimeSocket }
    }

    const url = `${getRealtimeUrl()}/realtime`
    shared = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: input?.walletAddress
        ? { walletAddress: input.walletAddress }
        : undefined,
      query: input?.walletAddress
        ? { wallet: input.walletAddress }
        : undefined,
    })

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('realtime connect timeout')), 8000)
      shared!.once('connect', () => {
        clearTimeout(t)
        resolve()
      })
      shared!.once('connect_error', (err) => {
        clearTimeout(t)
        reject(err)
      })
    })

    if (input?.walletAddress) {
      shared.emit('join', { walletAddress: input.walletAddress })
    }

    return { socket: shared as unknown as RealtimeSocket }
  } catch (err) {
    console.warn('[realtime] connect failed', err)
    shared?.disconnect()
    shared = null
    return null
  }
}

export function subscribeJob(
  socket: RealtimeSocket,
  jobId: string,
  onProgress: (event: JobProgressEvent) => void,
) {
  socket.emit('subscribeJob', { jobId })
  const handler = (...args: unknown[]) => {
    const ev = args[0] as JobProgressEvent | undefined
    if (!ev || ev.jobId === jobId) onProgress(ev as JobProgressEvent)
  }
  socket.on('job.progress', handler)
  socket.on('job.completed', handler)
  socket.on('job.failed', handler)
  return () => {
    socket.off('job.progress', handler)
    socket.off('job.completed', handler)
    socket.off('job.failed', handler)
  }
}

/**
 * Wait for an AI / image job to complete via WebSocket (with HTTP poll fallback).
 */
export async function waitForJob(input: {
  jobId: string
  walletAddress?: string
  signal?: AbortSignal
  timeoutMs?: number
  onStatus?: (label: string, event?: JobProgressEvent) => void
  /** Optional poll URL when WS is unavailable. */
  pollUrl?: string
  fetchImpl?: typeof fetch
}): Promise<{
  ok: boolean
  event?: JobProgressEvent
  error?: string
}> {
  const timeoutMs = input.timeoutMs ?? 180_000
  const started = Date.now()

  const conn = await connectRealtime({ walletAddress: input.walletAddress })
  if (conn?.socket) {
    return new Promise((resolve) => {
      let settled = false
      const finish = (result: {
        ok: boolean
        event?: JobProgressEvent
        error?: string
      }) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(result)
      }

      const onAbort = () => finish({ ok: false, error: 'Stopped' })
      input.signal?.addEventListener('abort', onAbort)

      const timer = setTimeout(() => {
        finish({ ok: false, error: 'Job timed out' })
      }, timeoutMs)

      const cleanup = subscribeJob(conn.socket, input.jobId, (ev) => {
        const st = String(ev?.status || '').toLowerCase()
        if (st === 'queued' || st === 'pending') {
          input.onStatus?.('Waiting in line…', ev)
        } else if (st === 'active' || st === 'running' || st === 'processing') {
          input.onStatus?.(ev.message || 'Working…', ev)
        } else if (
          st === 'completed' ||
          st === 'succeeded' ||
          st === 'success'
        ) {
          input.onStatus?.('Done', ev)
          clearTimeout(timer)
          input.signal?.removeEventListener('abort', onAbort)
          finish({ ok: true, event: ev })
        } else if (st === 'failed' || st === 'error') {
          clearTimeout(timer)
          input.signal?.removeEventListener('abort', onAbort)
          finish({
            ok: false,
            event: ev,
            error: ev.message || 'Job failed',
          })
        }
      })

      // Also listen for terminal events by name
      const onCompleted = (...args: unknown[]) => {
        const ev = args[0] as JobProgressEvent
        if (ev?.jobId && ev.jobId !== input.jobId) return
        input.onStatus?.('Done', ev)
        clearTimeout(timer)
        input.signal?.removeEventListener('abort', onAbort)
        finish({ ok: true, event: ev })
      }
      const onFailed = (...args: unknown[]) => {
        const ev = args[0] as JobProgressEvent
        if (ev?.jobId && ev.jobId !== input.jobId) return
        clearTimeout(timer)
        input.signal?.removeEventListener('abort', onAbort)
        finish({
          ok: false,
          event: ev,
          error: ev?.message || 'Job failed',
        })
      }
      conn.socket.on('job.completed', onCompleted)
      conn.socket.on('job.failed', onFailed)
    })
  }

  // HTTP poll fallback
  if (!input.pollUrl) {
    return { ok: false, error: 'Realtime unavailable and no poll URL' }
  }
  const f = input.fetchImpl ?? fetch
  while (Date.now() - started < timeoutMs) {
    if (input.signal?.aborted) return { ok: false, error: 'Stopped' }
    const res = await f(input.pollUrl, { signal: input.signal })
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const data =
      raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object'
        ? (raw.data as Record<string, unknown>)
        : raw
    const status = String(data.status || '').toLowerCase()
    input.onStatus?.(
      status === 'queued' ? 'Waiting in line…' : status || 'Working…',
    )
    if (
      status === 'completed' ||
      status === 'succeeded' ||
      status === 'success'
    ) {
      return {
        ok: true,
        event: {
          jobId: input.jobId,
          status,
          progress: 100,
          result: data.result ?? data,
        },
      }
    }
    if (status === 'failed' || status === 'error') {
      return {
        ok: false,
        error: String(data.error || data.errorMessage || 'Job failed'),
      }
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return { ok: false, error: 'Job timed out' }
}

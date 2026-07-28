/**
 * Realtime transport choices in Micropay
 *
 * SSE (Server-Sent Events)
 * - Chat token streaming: POST /api/v1/chat/completions with stream:true
 * - Async image job progress: GET /api/v1/images/jobs/:jobId?stream=1
 *   (server polls the provider job and pushes status until done/failed)
 *
 * WebSocket
 * - Not used. TanStack Start file routes are HTTP-native; SSE covers chat
 *   tokens and image job status without a custom WS upgrade server.
 *
 * Polling (fallback)
 * - GET /api/v1/images/jobs/:jobId without stream=1 remains for API clients
 *   that prefer one-shot JSON status checks.
 *
 * Activities / spend
 * - Fetched on demand (React Query). No live channel — optional later.
 */

export const REALTIME_TRANSPORT = {
  chatTokens: 'sse',
  imageJobs: 'sse',
  activities: 'poll',
  websockets: 'none',
} as const

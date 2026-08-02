import { apiUrl } from '#/lib/api-url'

export type ChatToolCapability = {
  name: string
  description: string
  execution: string
}

export type ChatToolsCapabilities = {
  enabled: boolean
  maxRounds: number
  tools: ChatToolCapability[]
}

export async function fetchChatToolsCapabilities(): Promise<ChatToolsCapabilities> {
  const response = await fetch(apiUrl('/api/v1/tools/capabilities'))
  if (!response.ok) throw new Error('Unable to load tool capabilities')
  const responseBody = (await response.json()) as
    | Partial<ChatToolsCapabilities>
    | { data?: Partial<ChatToolsCapabilities> }
  const raw: Partial<ChatToolsCapabilities> =
    'data' in responseBody && responseBody.data
      ? responseBody.data
      : (responseBody as Partial<ChatToolsCapabilities>)
  return {
    enabled: raw.enabled !== false,
    maxRounds: Number(raw.maxRounds) || 0,
    tools: Array.isArray(raw.tools) ? raw.tools : [],
  }
}

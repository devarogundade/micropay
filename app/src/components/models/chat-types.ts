import type { ChatContentPart, ChatMessage } from '#/lib/micropay-api'
import { formatUploadBytes } from '#/lib/storage-limits'

export type ChatAttachment = {
  id: string
  name: string
  mime: string
  mimeType?: string
  size: number
  kind: 'image' | 'text' | 'pdf'
  url?: string
  storagePath?: string
  dataUrl?: string
  textContent?: string
  pages?: number
  truncated?: boolean
}

export type ChatRole = 'user' | 'assistant' | 'system'

export type Msg = {
  id: string
  role: ChatRole
  content: string
  attachments?: ChatAttachment[]
  reasoning?: string
  streaming?: boolean
  error?: boolean
  costUsdc?: number
  provider?: string
}

const CHAT_ROLES = new Set<ChatRole>(['user', 'assistant', 'system'])

export function parseChatRole(role: string): ChatRole {
  return CHAT_ROLES.has(role as ChatRole) ? (role as ChatRole) : 'assistant'
}

export function attachmentsFromStored(
  value: unknown,
): ChatAttachment[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const out: ChatAttachment[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const a = item as Partial<ChatAttachment>
    if (
      typeof a.id !== 'string' ||
      typeof a.name !== 'string' ||
      typeof a.mime !== 'string' ||
      typeof a.size !== 'number' ||
      (a.kind !== 'image' && a.kind !== 'text' && a.kind !== 'pdf')
    ) {
      continue
    }
    out.push({
      id: a.id,
      name: a.name,
      mime: a.mime,
      mimeType: typeof a.mimeType === 'string' ? a.mimeType : a.mime,
      size: a.size,
      kind: a.kind,
      url: typeof a.url === 'string' ? a.url : undefined,
      storagePath: typeof a.storagePath === 'string' ? a.storagePath : undefined,
      dataUrl: typeof a.dataUrl === 'string' ? a.dataUrl : undefined,
      textContent:
        typeof a.textContent === 'string' ? a.textContent : undefined,
      pages: typeof a.pages === 'number' ? a.pages : undefined,
      truncated: a.truncated === true,
    })
  }
  return out.length ? out : undefined
}

export type SessionListItem = {
  id: string
  modelId: string
  modelSlug: string | null
  title: string | null
  createdAt: string
  updatedAt: string
  messageCount?: number
}

export const MAX_ATTACHMENTS = 5

export const IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
])

export const TEXT_MIME = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'text/xml',
  'application/x-yaml',
  'text/yaml',
])

export const TEXT_EXT =
  /\.(txt|md|markdown|csv|json|xml|yaml|yml|ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|css|html|svg|log|env|toml|ini|sh|bash|sql)$/i

export function isImageFile(file: File): boolean {
  if (IMAGE_MIME.has(file.type)) return true
  return /\.(png|jpe?g|gif|webp)$/i.test(file.name)
}

export function isTextFile(file: File): boolean {
  if (TEXT_MIME.has(file.type)) return true
  if (file.type.startsWith('text/')) return true
  return TEXT_EXT.test(file.name)
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file)
  })
}

export function formatBytes(n: number): string {
  return formatUploadBytes(n)
}

export function imageSrc(a: ChatAttachment): string | undefined {
  return a.url || a.dataUrl
}

export function toApiMessage(msg: Msg): ChatMessage {
  const role: ChatMessage['role'] =
    msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant'
      ? msg.role
      : 'user'
  const atts = msg.attachments ?? []
  const images = atts.filter((a) => a.kind === 'image' && imageSrc(a))
  const texts = atts.filter((a) => (a.kind === 'text' || a.kind === 'pdf') && a.textContent)

  if (!images.length && !texts.length) {
    return { role, content: msg.content }
  }

  const parts: ChatContentPart[] = []
  const body = msg.content.trim()
  if (body) parts.push({ type: 'text', text: body })

  for (const t of texts) {
    parts.push({
      type: 'text',
      text: `--- ${t.kind === 'pdf' ? 'PDF' : 'File'}: ${t.name}${t.pages ? ` (${t.pages} pages${t.truncated ? ', truncated' : ''})` : ''} ---\n${t.textContent}`,
    })
  }

  for (const img of images) {
    const url = imageSrc(img)!
    parts.push({
      type: 'image_url',
      image_url: { url, detail: 'auto' },
    })
  }

  if (!parts.length) return { role, content: msg.content || '' }
  if (parts.length === 1 && parts[0]?.type === 'text') {
    return { role, content: parts[0].text }
  }
  return { role, content: parts }
}

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

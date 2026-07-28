/** Minimal attachment shape for local IDE chat persistence. */
export type StoredAttachment = {
  id: string
  name: string
  mime: string
  mimeType?: string
  size: number
  kind: 'image' | 'text'
  url?: string
  storagePath?: string
  textContent?: string
}

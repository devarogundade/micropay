/** Browser-safe chat attachment helpers. */

export type StoredAttachment = {
  id: string
  name: string
  mime: string
  mimeType?: string
  size: number
  kind: 'image' | 'text' | 'pdf'
  /** Backend storage object path. */
  storagePath?: string
  /** Public or signed HTTPS URL for the object. */
  url?: string
  /** Text file bodies only (images omit data URLs). */
  textContent?: string
  pages?: number
  truncated?: boolean
}

/** Strip bulky image data URLs before sending attachment metadata. */
export function toStoredAttachments(
  attachments:
    | Array<{
        id: string
        name: string
        mime: string
        mimeType?: string
        size: number
        kind: 'image' | 'text' | 'pdf'
        dataUrl?: string
        url?: string
        storagePath?: string
        textContent?: string
        pages?: number
        truncated?: boolean
      }>
    | undefined,
): StoredAttachment[] | undefined {
  if (!attachments?.length) return undefined
  return attachments.map((a) => {
    const mimeType = a.mimeType || a.mime
    return {
      id: a.id,
      name: a.name,
      mime: a.mime,
      mimeType,
      size: a.size,
      kind: a.kind,
      ...(a.url ? { url: a.url } : {}),
      ...(a.storagePath ? { storagePath: a.storagePath } : {}),
      ...((a.kind === 'text' || a.kind === 'pdf') && a.textContent
        ? { textContent: a.textContent.slice(0, 50_000) }
        : {}),
      ...(a.pages != null ? { pages: a.pages } : {}),
      ...(a.truncated ? { truncated: true } : {}),
    }
  })
}

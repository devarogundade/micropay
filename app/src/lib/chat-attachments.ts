/** Client-safe chat attachment helpers (no Prisma / Node deps). */

export type StoredAttachment = {
  id: string
  name: string
  mime: string
  mimeType?: string
  size: number
  kind: 'image' | 'text'
  /** Supabase Storage object path. */
  storagePath?: string
  /** Public or signed HTTPS URL for the object. */
  url?: string
  /** Text file bodies only (images omit data URLs). */
  textContent?: string
}

/** Strip bulky image data URLs before persisting; keep Supabase metadata. */
export function toStoredAttachments(
  attachments:
    | Array<{
        id: string
        name: string
        mime: string
        mimeType?: string
        size: number
        kind: 'image' | 'text'
        dataUrl?: string
        url?: string
        storagePath?: string
        textContent?: string
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
      ...(a.kind === 'text' && a.textContent
        ? { textContent: a.textContent.slice(0, 50_000) }
        : {}),
    }
  })
}

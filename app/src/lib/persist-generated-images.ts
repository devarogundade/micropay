/**
 * After Router returns b64_json images, upload PNGs to Supabase and attach URLs.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — no silent local-only path.
 */

import {
  StorageConfigError,
  StorageUploadError,
  isStorageConfigured,
  uploadBase64Png,
} from '#/lib/supabase-storage'

type ImgItem = {
  b64_json?: string
  url?: string
  storagePath?: string
  [key: string]: unknown
}

function collectItems(payload: unknown): {
  items: ImgItem[]
  wrap: (items: ImgItem[]) => unknown
} | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>

  if (Array.isArray(obj.data)) {
    return {
      items: obj.data as ImgItem[],
      wrap: (items) => ({ ...obj, data: items }),
    }
  }

  const result = obj.result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (Array.isArray(r.data)) {
      return {
        items: r.data as ImgItem[],
        wrap: (items) => ({ ...obj, result: { ...r, data: items } }),
      }
    }
  }

  const nested: string[] = []
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) {
      for (const x of v) walk(x)
      return
    }
    const o = v as Record<string, unknown>
    if (typeof o.b64_json === 'string') nested.push(o.b64_json)
    for (const x of Object.values(o)) walk(x)
  }
  walk(payload)
  if (nested.length) {
    return {
      items: nested.map((b64_json) => ({ b64_json })),
      wrap: (items) => ({ data: items }),
    }
  }

  return null
}

function jobAlreadyHasUrls(items: ImgItem[]): boolean {
  return items.length > 0 && items.every((i) => Boolean(i.url) && !i.b64_json)
}

/** Upload each b64 image; replace b64 with public URL + storagePath. */
export async function persistGeneratedImages(
  payload: unknown,
): Promise<unknown> {
  if (!isStorageConfigured()) {
    throw new StorageConfigError(
      'Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to persist generated images.',
    )
  }

  const found = collectItems(payload)
  if (!found?.items.length) return payload
  if (jobAlreadyHasUrls(found.items)) return payload

  const next: ImgItem[] = []
  for (let i = 0; i < found.items.length; i++) {
    const item = found.items[i]!
    if (item.url && !item.b64_json) {
      next.push(item)
      continue
    }
    if (!item.b64_json) {
      next.push(item)
      continue
    }
    const stored = await uploadBase64Png({
      b64: item.b64_json,
      filename: `gen-${Date.now()}-${i}.png`,
      folder: 'images',
    })
    const { b64_json: _drop, ...rest } = item
    next.push({
      ...rest,
      url: stored.url,
      storagePath: stored.storagePath,
    })
  }

  const missing = next.filter((i) => !i.url && !i.b64_json)
  if (missing.length) {
    throw new StorageUploadError(
      'Image persistence incomplete: no URL produced for one or more images',
    )
  }

  return found.wrap(next)
}

export function storageErrorResponse(e: unknown): Response | null {
  if (e instanceof StorageConfigError) {
    return Response.json(
      { error: { message: e.message, type: 'config_error' } },
      { status: 503 },
    )
  }
  if (e instanceof StorageUploadError) {
    return Response.json(
      { error: { message: e.message, type: 'storage_error' } },
      { status: 502 },
    )
  }
  return null
}

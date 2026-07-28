/**
 * Server-side Supabase Storage helpers.
 *
 * Env (server only — never VITE_ for the service role):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_STORAGE_BUCKET (optional, default: micropay)
 *
 * Bucket setup (Supabase Dashboard → Storage → New bucket, or SQL):
 *   insert into storage.buckets (id, name, public)
 *   values ('micropay', 'micropay', true);
 *
 * Optional RLS policies if the bucket is private — with the service role
 * key, server uploads bypass RLS. Public read is required for public URLs.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  assertUnderUploadLimit,
} from '#/lib/storage-limits'

export const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'micropay'

export type StoredObject = {
  bucket: string
  storagePath: string
  url: string
  size: number
  mimeType: string
  name: string
}

let client: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new StorageConfigError(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (server-side only).',
    )
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageConfigError'
  }
}

export class StorageLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageLimitError'
  }
}

export class StorageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageUploadError'
  }
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file'
  return base.slice(0, 180)
}

function buildObjectPath(folder: string, filename: string): string {
  const safeFolder = folder
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '_')
    .slice(0, 80)
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${safeFolder || 'uploads'}/${id}-${sanitizeFilename(filename)}`
}

export async function uploadBuffer(input: {
  data: Buffer | Uint8Array | ArrayBuffer | Blob
  filename: string
  mimeType: string
  /** Path prefix, e.g. attachments | images | audio */
  folder?: string
  /** Prefer public URL when the bucket is public; else signed URL. */
  preferPublic?: boolean
  /** Signed URL TTL when not public (seconds). */
  signedUrlExpiresIn?: number
}): Promise<StoredObject> {
  let size: number
  let body: Buffer | Uint8Array | Blob

  if (input.data instanceof Blob) {
    size = input.data.size
    body = input.data
  } else if (input.data instanceof ArrayBuffer) {
    size = input.data.byteLength
    body = new Uint8Array(input.data)
  } else {
    size = input.data.byteLength
    body = input.data
  }

  const limitErr = assertUnderUploadLimit(size, input.filename)
  if (limitErr) {
    throw new StorageLimitError(
      `File exceeds ${MAX_UPLOAD_LABEL} limit (${MAX_UPLOAD_BYTES} bytes max)`,
    )
  }

  const storagePath = buildObjectPath(
    input.folder || 'uploads',
    input.filename,
  )
  const supabase = getSupabaseAdmin()

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, body, {
      contentType: input.mimeType || 'application/octet-stream',
      upsert: false,
    })

  if (error) {
    throw new StorageUploadError(error.message || 'Upload failed')
  }

  const preferPublic = input.preferPublic !== false
  let url: string

  if (preferPublic) {
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)
    url = data.publicUrl
  } else {
    const expires = input.signedUrlExpiresIn ?? 60 * 60 * 24 * 7
    const { data, error: signErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expires)
    if (signErr || !data?.signedUrl) {
      throw new StorageUploadError(
        signErr?.message || 'Failed to create signed URL',
      )
    }
    url = data.signedUrl
  }

  return {
    bucket: STORAGE_BUCKET,
    storagePath,
    url,
    size,
    mimeType: input.mimeType || 'application/octet-stream',
    name: sanitizeFilename(input.filename),
  }
}

export async function uploadBase64Png(input: {
  b64: string
  filename?: string
  folder?: string
}): Promise<StoredObject> {
  const raw = input.b64.includes(',')
    ? input.b64.slice(input.b64.indexOf(',') + 1)
    : input.b64
  const buf = Buffer.from(raw, 'base64')
  return uploadBuffer({
    data: buf,
    filename: input.filename || `image-${Date.now()}.png`,
    mimeType: 'image/png',
    folder: input.folder || 'images',
  })
}

export async function deleteObject(storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath])
  if (error) {
    throw new StorageUploadError(error.message || 'Delete failed')
  }
}

export async function createSignedUrl(
  storagePath: string,
  expiresIn = 60 * 60,
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn)
  if (error || !data?.signedUrl) {
    throw new StorageUploadError(
      error?.message || 'Failed to create signed URL',
    )
  }
  return data.signedUrl
}

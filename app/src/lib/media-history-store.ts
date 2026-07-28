/**
 * Image generation + audio transcription history (Prisma), keyed by wallet.
 */

import { prisma } from '#/lib/db'
import { ensureUser } from '#/lib/users'
import { normalizeWalletAddress } from '#/lib/wallet-address'

export type StoredImageGeneration = {
  id: string
  modelSlug: string
  modelName: string | null
  prompt: string
  size: string | null
  url: string
  storagePath: string | null
  createdAt: string
}

export type StoredTranscription = {
  id: string
  modelSlug: string
  modelName: string | null
  filename: string | null
  mimeType: string | null
  fileSize: number | null
  language: string | null
  text: string
  createdAt: string
}

function serializeImage(row: {
  id: string
  modelSlug: string
  modelName: string | null
  prompt: string
  size: string | null
  url: string
  storagePath: string | null
  createdAt: Date
}): StoredImageGeneration {
  return {
    id: row.id,
    modelSlug: row.modelSlug,
    modelName: row.modelName,
    prompt: row.prompt,
    size: row.size,
    url: row.url,
    storagePath: row.storagePath,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeTranscription(row: {
  id: string
  modelSlug: string
  modelName: string | null
  filename: string | null
  mimeType: string | null
  fileSize: number | null
  language: string | null
  text: string
  createdAt: Date
}): StoredTranscription {
  return {
    id: row.id,
    modelSlug: row.modelSlug,
    modelName: row.modelName,
    filename: row.filename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    language: row.language,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listImageGenerations(input: {
  walletAddress: string
  limit?: number
}): Promise<StoredImageGeneration[]> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return []

  const rows = await prisma.imageGeneration.findMany({
    where: { userId: wallet },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(input.limit ?? 60, 1), 100),
  })
  return rows.map(serializeImage)
}

export async function recordImageGenerations(input: {
  walletAddress: string
  modelSlug: string
  modelName?: string | null
  prompt: string
  size?: string | null
  images: Array<{ url: string; storagePath?: string | null }>
}): Promise<StoredImageGeneration[]> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) {
    throw new Error('Invalid wallet address')
  }
  const usable = input.images.filter((i) => typeof i.url === 'string' && i.url)
  if (!usable.length) return []

  await ensureUser(wallet)

  const created = await prisma.$transaction(
    usable.map((img) =>
      prisma.imageGeneration.create({
        data: {
          userId: wallet,
          modelSlug: input.modelSlug,
          modelName: input.modelName ?? null,
          prompt: input.prompt,
          size: input.size ?? null,
          url: img.url,
          storagePath: img.storagePath ?? null,
        },
      }),
    ),
  )

  return created.map(serializeImage)
}

export async function listTranscriptions(input: {
  walletAddress: string
  limit?: number
}): Promise<StoredTranscription[]> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) return []

  const rows = await prisma.transcription.findMany({
    where: { userId: wallet },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(input.limit ?? 60, 1), 100),
  })
  return rows.map(serializeTranscription)
}

export async function recordTranscription(input: {
  walletAddress: string
  modelSlug: string
  modelName?: string | null
  filename?: string | null
  mimeType?: string | null
  fileSize?: number | null
  language?: string | null
  text: string
}): Promise<StoredTranscription> {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!wallet) {
    throw new Error('Invalid wallet address')
  }
  if (!input.text.trim()) {
    throw new Error('Transcript text is empty')
  }

  await ensureUser(wallet)

  const row = await prisma.transcription.create({
    data: {
      userId: wallet,
      modelSlug: input.modelSlug,
      modelName: input.modelName ?? null,
      filename: input.filename ?? null,
      mimeType: input.mimeType ?? null,
      fileSize: input.fileSize ?? null,
      language: input.language ?? null,
      text: input.text,
    },
  })

  return serializeTranscription(row)
}

/** Extract persisted image URL(+path) pairs from a generations payload. */
export function extractPersistedImageRefs(payload: unknown): Array<{
  url: string
  storagePath?: string | null
}> {
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>
  const lists: unknown[] = []
  if (Array.isArray(obj.data)) lists.push(...obj.data)
  const result = obj.result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (Array.isArray(r.data)) lists.push(...r.data)
  }

  const out: Array<{ url: string; storagePath?: string | null }> = []
  for (const item of lists) {
    if (!item || typeof item !== 'object') continue
    const i = item as Record<string, unknown>
    if (typeof i.url === 'string' && i.url) {
      out.push({
        url: i.url,
        storagePath: typeof i.storagePath === 'string' ? i.storagePath : null,
      })
    }
  }
  return out
}

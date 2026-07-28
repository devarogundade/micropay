/**
 * Persist async image job metadata so SSE completion can save gallery history.
 */

import { prisma } from '#/lib/db'
import { ensureUserOptional } from '#/lib/users'

export type StoredImageJob = {
  id: string
  walletAddress: string | null
  modelSlug: string
  modelName: string | null
  prompt: string
  size: string | null
  providerAddress: string | null
  status: string
  errorMessage: string | null
}

export async function createImageJob(input: {
  jobId: string
  walletAddress?: string | null
  modelSlug: string
  modelName?: string | null
  prompt: string
  size?: string | null
  providerAddress?: string | null
  status?: string
}): Promise<StoredImageJob> {
  const { userId, walletAddress } = await ensureUserOptional(input.walletAddress)

  const row = await prisma.imageJob.upsert({
    where: { id: input.jobId },
    create: {
      id: input.jobId,
      userId,
      walletAddress,
      modelSlug: input.modelSlug,
      modelName: input.modelName ?? null,
      prompt: input.prompt,
      size: input.size ?? null,
      providerAddress: input.providerAddress ?? null,
      status: input.status ?? 'queued',
    },
    update: {
      userId,
      walletAddress,
      modelSlug: input.modelSlug,
      modelName: input.modelName ?? null,
      prompt: input.prompt,
      size: input.size ?? null,
      providerAddress: input.providerAddress ?? null,
      status: input.status ?? 'queued',
      errorMessage: null,
    },
  })

  return serialize(row)
}

export async function getImageJob(
  jobId: string,
): Promise<StoredImageJob | null> {
  const row = await prisma.imageJob.findUnique({ where: { id: jobId } })
  return row ? serialize(row) : null
}

export async function updateImageJobStatus(input: {
  jobId: string
  status: string
  errorMessage?: string | null
  providerAddress?: string | null
}): Promise<void> {
  await prisma.imageJob
    .update({
      where: { id: input.jobId },
      data: {
        status: input.status,
        errorMessage: input.errorMessage ?? undefined,
        providerAddress: input.providerAddress ?? undefined,
      },
    })
    .catch(() => {
      /* job row may be missing for external pollers */
    })
}

function serialize(row: {
  id: string
  walletAddress: string | null
  modelSlug: string
  modelName: string | null
  prompt: string
  size: string | null
  providerAddress: string | null
  status: string
  errorMessage: string | null
}): StoredImageJob {
  return {
    id: row.id,
    walletAddress: row.walletAddress,
    modelSlug: row.modelSlug,
    modelName: row.modelName,
    prompt: row.prompt,
    size: row.size,
    providerAddress: row.providerAddress,
    status: row.status,
    errorMessage: row.errorMessage,
  }
}

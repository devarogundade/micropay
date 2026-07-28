import { createFileRoute } from '@tanstack/react-router'

import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '#/lib/storage-limits'
import {
  StorageConfigError,
  StorageLimitError,
  StorageUploadError,
  isStorageConfigured,
  uploadBuffer,
} from '#/lib/supabase-storage'

/**
 * Server-side file upload → Supabase Storage (50 MB hard limit).
 * Multipart field: `file` (required). Optional: `folder` (attachments|images|audio|uploads).
 */
export const Route = createFileRoute('/api/v1/storage/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isStorageConfigured()) {
          return Response.json(
            {
              error: {
                message:
                  'Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
                type: 'config_error',
              },
            },
            { status: 503 },
          )
        }

        let formData: FormData
        try {
          formData = await request.formData()
        } catch {
          return Response.json(
            {
              error: {
                message: 'Expected multipart/form-data',
                type: 'invalid_request',
              },
            },
            { status: 400 },
          )
        }

        const fileField = formData.get('file')
        if (
          typeof fileField !== 'object' ||
          fileField === null ||
          !('arrayBuffer' in fileField) ||
          !('size' in fileField)
        ) {
          return Response.json(
            {
              error: {
                message: 'file is required',
                type: 'invalid_request',
              },
            },
            { status: 400 },
          )
        }

        const file = fileField as Blob & { name?: string; type?: string }

        if (file.size > MAX_UPLOAD_BYTES) {
          return Response.json(
            {
              error: {
                message: `File exceeds ${MAX_UPLOAD_LABEL} limit`,
                type: 'invalid_request',
                maxBytes: MAX_UPLOAD_BYTES,
              },
            },
            { status: 413 },
          )
        }

        const folderRaw = formData.get('folder')
        const folder =
          typeof folderRaw === 'string' && folderRaw
            ? folderRaw
            : 'attachments'
        const filename = file.name || 'upload.bin'
        const mimeType = file.type || 'application/octet-stream'

        try {
          const stored = await uploadBuffer({
            data: file,
            filename,
            mimeType,
            folder,
          })
          return Response.json({
            url: stored.url,
            storagePath: stored.storagePath,
            size: stored.size,
            mimeType: stored.mimeType,
            name: stored.name,
            bucket: stored.bucket,
          })
        } catch (e) {
          if (e instanceof StorageConfigError) {
            return Response.json(
              {
                error: { message: e.message, type: 'config_error' },
              },
              { status: 503 },
            )
          }
          if (e instanceof StorageLimitError) {
            return Response.json(
              {
                error: {
                  message: e.message,
                  type: 'invalid_request',
                  maxBytes: MAX_UPLOAD_BYTES,
                },
              },
              { status: 413 },
            )
          }
          const message =
            e instanceof StorageUploadError
              ? e.message
              : e instanceof Error
                ? e.message
                : 'Upload failed'
          return Response.json(
            { error: { message, type: 'storage_error' } },
            { status: 502 },
          )
        }
      },
    },
  },
})

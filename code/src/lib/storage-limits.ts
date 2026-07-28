/** Shared upload limits (client). */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const MAX_UPLOAD_LABEL = '50 MB'

export function formatUploadBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function assertUnderUploadLimit(
  size: number,
  label = 'File',
): string | null {
  if (size > MAX_UPLOAD_BYTES) {
    return `${label} must be under ${MAX_UPLOAD_LABEL} (${formatUploadBytes(size)} given)`
  }
  return null
}

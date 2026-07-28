/**
 * Client helpers for template browse + x402 clone.
 */

import { apiUrl } from '#/lib/api-url'
import type {
  TemplateDetail,
  TemplateListItem,
  TemplateSort,
} from '#/lib/templates-store'
import { TEMPLATE_CLONE_USDC } from '#/lib/templates-store'

export { TEMPLATE_CLONE_USDC }
export type { TemplateDetail, TemplateListItem, TemplateSort }

export const PENDING_TEMPLATE_KEY = 'micropay.ide.pending-template'

export type ClonedTemplatePayload = {
  id: string
  slug: string
  name: string
  description: string
  category: string
  projectName: string
  activePath: string
  files: Array<{ path: string; content: string }>
  clonedCount: number
  featured: boolean
}

export async function fetchTemplates(input?: {
  q?: string
  category?: string
  sort?: TemplateSort
}): Promise<{ templates: TemplateListItem[]; categories: string[] }> {
  const params = new URLSearchParams()
  if (input?.q) params.set('q', input.q)
  if (input?.category && input.category !== 'all') {
    params.set('category', input.category)
  }
  if (input?.sort) params.set('sort', input.sort)
  const qs = params.toString()
  const res = await fetch(
    apiUrl(`/api/v1/templates${qs ? `?${qs}` : ''}`),
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    throw new Error(body?.error?.message || `Failed to load templates (${res.status})`)
  }
  return res.json() as Promise<{
    templates: TemplateListItem[]
    categories: string[]
  }>
}

export async function fetchTemplate(
  idOrSlug: string,
): Promise<TemplateDetail> {
  const res = await fetch(apiUrl(`/api/v1/templates/${encodeURIComponent(idOrSlug)}`))
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    throw new Error(body?.error?.message || `Template not found (${res.status})`)
  }
  const data = (await res.json()) as { template: TemplateDetail }
  return data.template
}

export async function cloneTemplate(input: {
  templateId: string
  fetchImpl?: typeof fetch | null
}): Promise<{
  template: ClonedTemplatePayload
  costUsdc: number
  txId?: string
}> {
  const f = input.fetchImpl ?? fetch
  const res = await f(apiUrl('/api/v1/clone'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId: input.templateId }),
  })
  const body = (await res.json().catch(() => null)) as {
    template?: ClonedTemplatePayload
    costUsdc?: number
    txId?: string
    error?: { message?: string }
  } | null
  if (!res.ok || !body?.template) {
    throw new Error(
      body?.error?.message || `Clone failed (${res.status})`,
    )
  }
  return {
    template: body.template,
    costUsdc: body.costUsdc ?? TEMPLATE_CLONE_USDC,
    txId: body.txId,
  }
}

/** Stash a paid clone so the IDE can apply it on next load of `/`. */
export function stashPendingTemplate(template: ClonedTemplatePayload) {
  try {
    sessionStorage.setItem(PENDING_TEMPLATE_KEY, JSON.stringify(template))
  } catch {
    /* ignore quota */
  }
}

export function takePendingTemplate(): ClonedTemplatePayload | null {
  try {
    const raw = sessionStorage.getItem(PENDING_TEMPLATE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(PENDING_TEMPLATE_KEY)
    return JSON.parse(raw) as ClonedTemplatePayload
  } catch {
    return null
  }
}

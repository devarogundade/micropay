import {
  MAX_PAY_USDC,
  MIN_PAY_USDC,
  modelMinPayUsdc,
  type Model,
  type ModelType,
} from '#/data/models'
import { resolveProviderBrand } from '#/lib/provider-logos'
import {
  listRouterModels,
  RouterApiError,
  RouterConfigError,
  type RouterModel,
} from '#/lib/zg-router'

const ACCENTS = ['#0a0a0a', '#171717', '#262626', '#404040', '#525252']
const ICONS: Record<ModelType, string> = {
  Chat: '✦',
  'Image Gen': '◐',
  Audio: '♪',
}

function hashSlug(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function mapRouterType(type?: string): ModelType {
  const t = (type || '').toLowerCase()
  if (t.includes('image') || t === 'text-to-image') return 'Image Gen'
  if (t.includes('speech') || t.includes('audio') || t.includes('voice'))
    return 'Audio'
  return 'Chat'
}

function clampPayUsdc(n: number): number {
  return Number(
    Math.min(MAX_PAY_USDC, Math.max(MIN_PAY_USDC, n)).toFixed(3),
  )
}

/** Estimate a single-request USDC display price from Router USD token prices. */
export function estimatePriceUsdc(rm: RouterModel, type: ModelType): number {
  const floor = modelMinPayUsdc(
    { id: rm.id, name: rm.name, ownedBy: rm.owned_by },
    type,
  )
  const prompt = Number(rm.pricing_usd?.prompt ?? 0)
  const completion = Number(rm.pricing_usd?.completion ?? 0)
  const image = Number(
    (rm.pricing_usd as { image?: string } | undefined)?.image ?? 0,
  )

  let est: number
  if (type === 'Image Gen') {
    if (image > 0) est = Number(image.toFixed(4))
    else est = prompt > 0 ? prompt : floor
  } else if (type === 'Audio') {
    const v = prompt * 60
    est = v > 0 ? Number(v.toFixed(6)) : floor
  } else {
    const tokenEst = prompt * 500 + completion * 500
    // Catalog display / x402 gate estimate when token rates are present but tiny.
    if (tokenEst <= 0) {
      // Router listed the model but omitted usable USD rates — use the
      // per-model floor so gating still charges a real positive amount.
      est = floor
    } else if (tokenEst < 0.0001) {
      est = Number(tokenEst.toFixed(6))
    } else if (tokenEst < 0.01) {
      est = Number(tokenEst.toFixed(4))
    } else {
      est = Number(tokenEst.toFixed(3))
    }
  }

  return clampPayUsdc(Math.max(floor, est))
}

export function routerModelToUi(rm: RouterModel): Model {
  const type = mapRouterType(rm.type)
  const slug = rm.id
  const h = hashSlug(slug)
  const supportsTools = Boolean(rm.supported_parameters?.includes('tools'))
  const supportsVision = Boolean(
    rm.architecture?.input_modalities?.includes('image'),
  )

  const bits: string[] = []
  if (rm.description) bits.push(rm.description)
  else bits.push(`Micropay ${type.toLowerCase()} model.`)
  if (supportsTools) bits.push('Works with tools.')
  if (supportsVision) bits.push('Understands images.')

  const brand = resolveProviderBrand({
    id: rm.id,
    name: rm.name,
    ownedBy: rm.owned_by,
  })

  return {
    slug,
    name: rm.name || rm.id,
    provider: brand.label,
    type,
    priceUsdc: estimatePriceUsdc(rm, type),
    description: bits.join(' '),
    trending: (rm.provider_count ?? 0) >= 2,
    recommended: Boolean(rm.tee_attested) || (rm.provider_count ?? 0) >= 3,
    icon: ICONS[type],
    logoSrc: brand.logoSrc,
    accent: ACCENTS[h % ACCENTS.length],
    routerId: rm.id,
    teeAttested: rm.tee_attested,
    providerCount: rm.provider_count,
    contextLength: rm.context_length,
    supportsTools,
    supportsVision,
    verifiability: rm.verifiability,
    supportedFormats: rm.supported_formats,
  }
}

export type CatalogResult = {
  models: Model[]
  source: 'router'
  error?: string
}

export async function getCatalogModels(): Promise<CatalogResult> {
  try {
    const raw = await listRouterModels()
    if (!raw.length) {
      return {
        models: [],
        source: 'router',
        error: 'Provider returned an empty model list',
      }
    }
    return {
      models: raw.map(routerModelToUi),
      source: 'router',
    }
  } catch (e) {
    const message =
      e instanceof RouterConfigError || e instanceof RouterApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Failed to reach model catalog'
    return {
      models: [],
      source: 'router',
      error: message,
    }
  }
}

export async function getCatalogModel(
  slug: string,
): Promise<Model | undefined> {
  const { models } = await getCatalogModels()
  return models.find((m) => m.slug === slug || m.routerId === slug)
}

export class CatalogModelError extends Error {
  status: number
  constructor(message: string, status = 404) {
    super(message)
    this.name = 'CatalogModelError'
    this.status = status
  }
}

const TYPE_ENDPOINT: Record<ModelType, string> = {
  Chat: 'POST /api/v1/chat/completions',
  'Image Gen': 'POST /api/v1/images/generations',
  Audio: 'POST /api/v1/audio/transcriptions',
}

/** Ensure a catalog model matches the API route modality. */
export function assertModelType(model: Model, expected: ModelType): void {
  if (model.type === expected) return
  throw new CatalogModelError(
    `Model "${model.slug}" is ${model.type}, not ${expected}. Use ${TYPE_ENDPOINT[model.type]}.`,
    400,
  )
}

/** Resolve display USDC price for a Router model id (for x402 gating). */
export async function resolveModelPriceUsdc(modelId: string): Promise<{
  priceUsdc: number
  model: Model
}> {
  const catalog = await getCatalogModels()
  if (catalog.error && !catalog.models.length) {
    throw new CatalogModelError(
      `Model catalog unavailable: ${catalog.error}`,
      503,
    )
  }
  const model = catalog.models.find(
    (m) => m.slug === modelId || m.routerId === modelId,
  )
  if (!model) {
    throw new CatalogModelError(
      `Unknown model "${modelId}". Refresh the catalog and use a live model id.`,
      404,
    )
  }
  return { priceUsdc: model.priceUsdc, model }
}

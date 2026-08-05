import {
  MAX_PAY_USDC,
  MIN_PAY_USDC,
  modelMinPayUsdc,
  type Model,
  type ModelType,
} from '#/data/models'
import type { RouterModel } from '#/lib/api-types'
import { resolveProviderBrand } from '#/lib/provider-logos'

const ACCENTS = ['#0a0a0a', '#171717', '#262626', '#404040', '#525252']
const ICONS: Record<ModelType, string> = {
  Chat: '✦',
  'Image Gen': '◐',
  Audio: '♪',
}

function hashSlug(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function modelType(type?: string): ModelType {
  const value = (type || '').toLowerCase()
  if (value.includes('image') || value === 'text-to-image') return 'Image Gen'
  if (value.includes('speech') || value.includes('audio') || value.includes('voice')) {
    return 'Audio'
  }
  return 'Chat'
}

function estimatedPrice(model: RouterModel, type: ModelType): number {
  const floor = modelMinPayUsdc(
    { id: model.id, name: model.name, ownedBy: model.owned_by },
    type,
  )
  const prompt = Number(model.pricing_usd?.prompt ?? 0)
  const completion = Number(model.pricing_usd?.completion ?? 0)
  const image = Number(model.pricing_usd?.image ?? 0)
  const estimate =
    type === 'Image Gen'
      ? image || prompt || floor
      : type === 'Audio'
        ? prompt * 60 || floor
        : prompt * 500 + completion * 500 || floor
  return Number(
    Math.min(MAX_PAY_USDC, Math.max(MIN_PAY_USDC, floor, estimate)).toFixed(3),
  )
}

export function routerModelToUi(model: RouterModel): Model {
  const type = modelType(model.type)
  const supportsTools = Boolean(model.supported_parameters?.includes('tools'))
  const supportsVision = Boolean(model.architecture?.input_modalities?.includes('image'))
  const brand = resolveProviderBrand({
    id: model.id,
    name: model.name,
    ownedBy: model.owned_by,
  })
  const description = model.description || `Micropay ${type.toLowerCase()} model.`

  return {
    slug: model.id,
    name: model.name || model.id,
    provider: brand.label,
    type,
    priceUsdc:
      typeof model.price_usdc === 'number' && model.price_usdc > 0
        ? Math.min(MAX_PAY_USDC, Math.max(MIN_PAY_USDC, model.price_usdc))
        : estimatedPrice(model, type),
    description,
    trending: (model.provider_count ?? 0) >= 2,
    recommended: Boolean(model.tee_attested) || (model.provider_count ?? 0) >= 3,
    icon: ICONS[type],
    logoSrc: brand.logoSrc,
    accent: ACCENTS[hashSlug(model.id) % ACCENTS.length],
    routerId: model.id,
    teeAttested: model.tee_attested,
    providerCount: model.provider_count,
    contextLength: model.context_length,
    supportsTools,
    supportsVision,
    verifiability: model.verifiability,
    supportedFormats: model.supported_formats,
  }
}

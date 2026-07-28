import {
  MIN_PAY_USDC,
  type Model,
  type ModelType,
} from '#/data/models'
import { providerLogoSrc } from '#/lib/provider-logos'
import { apiUrl } from '#/lib/api-url'

type ApiModel = {
  id: string
  name?: string
  owned_by?: string
  description?: string
  type?: string
  price_usdc?: number
  tee_attested?: boolean
  provider_count?: number
  context_length?: number
  supports_tools?: boolean
  supports_vision?: boolean
  verifiability?: string
  supported_formats?: string[]
}

function mapType(raw: string | undefined): ModelType {
  if (raw === 'Image Gen' || raw === 'image') return 'Image Gen'
  if (raw === 'Audio' || raw === 'audio') return 'Audio'
  return 'Chat'
}

function toModel(row: ApiModel): Model {
  const provider = row.owned_by || 'Unknown'
  const slug = row.id
  const type = mapType(row.type)
  return {
    slug,
    name: row.name || slug,
    provider,
    type,
    priceUsdc:
      typeof row.price_usdc === 'number' && row.price_usdc > 0
        ? row.price_usdc
        : MIN_PAY_USDC,
    description: row.description || '',
    icon: provider.slice(0, 1).toUpperCase(),
    logoSrc: providerLogoSrc({ ownedBy: provider, id: slug }),
    accent: '#09c72b',
    routerId: row.id,
    teeAttested: row.tee_attested,
    providerCount: row.provider_count,
    contextLength: row.context_length,
    supportsTools: row.supports_tools,
    supportsVision: row.supports_vision,
    verifiability: row.verifiability,
    supportedFormats: row.supported_formats,
  }
}

export type ModelsCatalog = {
  models: Model[]
  error: string | null
}

/** Fetch chat catalog from the IDE API host (own backend). */
export async function fetchModelsCatalog(): Promise<ModelsCatalog> {
  try {
    const res = await fetch(apiUrl('/api/v1/models'))
    const raw: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg =
        raw &&
        typeof raw === 'object' &&
        'error' in raw &&
        (raw as { error?: { message?: string } }).error?.message
      return {
        models: [],
        error:
          typeof msg === 'string'
            ? msg
            : `Models request failed (${res.status})`,
      }
    }
    const data =
      raw && typeof raw === 'object' && 'data' in raw
        ? (raw as { data: unknown }).data
        : null
    if (!Array.isArray(data)) {
      return { models: [], error: 'Unexpected models response' }
    }
    const models = data
      .filter((m): m is ApiModel => Boolean(m && typeof m === 'object'))
      .map(toModel)
    return { models, error: null }
  } catch (e) {
    return {
      models: [],
      error: e instanceof Error ? e.message : 'Failed to load models',
    }
  }
}

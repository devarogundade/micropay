/**
 * App re-exports of shared merchant / SEO identity.
 * Canonical source: `packages/site-meta` (@micropay/site-meta).
 *
 * App and IDE are separate product surfaces. This package shares
 * challenge and identity constants. Runtime data is owned by Nest.
 */

export {
  DEFAULT_APP_ORIGIN,
  DEFAULT_CODE_ORIGIN,
  DEFAULT_SITE_ORIGIN,
  GOPLAUSIBLE_FACILITATOR,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_SERVICE_NAME,
  SITE_TAGLINE,
  X402_APP_ROUTE_META,
  X402_CHALLENGE_TAG,
  X402_CODE_ROUTE_META,
  X402_ROUTE_META,
  X402_SERVICE_TAGS,
  appEndpointUrl,
  buildAppMerchantCard,
  buildCodeMerchantCard,
  buildMerchantCard,
  codeEndpointUrl,
  getAppOrigin,
  getCodeOrigin,
  getMerchantIconUrl,
  getSiteOrigin,
  isPublicHttpOrigin,
  originFromRequest,
} from '@micropay/site-meta'

import { getAppOrigin, getSiteOrigin } from '@micropay/site-meta'

/**
 * Public origin for this app deploy (OG / canonical on app pages).
 * Prefer PUBLIC_APP_URL; fall back to apex for single-site deploys.
 */
export function getPublicAppUrl(): string | undefined {
  return getAppOrigin() || getSiteOrigin()
}

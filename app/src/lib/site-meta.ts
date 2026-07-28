/**
 * App re-exports of shared merchant / SEO identity.
 * Canonical source: `packages/site-meta` (@micropay/site-meta).
 *
 * GoPlausible: register ONLY apex `micropay.website` (landing).
 * App + code are product surfaces sharing one X402_PAY_TO.
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
  X402_CHALLENGE_TAG,
  X402_ROUTE_META,
  X402_SERVICE_TAGS,
  buildMerchantCard,
  getAppOrigin,
  getCodeOrigin,
  getMerchantIconUrl,
  getSiteOrigin,
  isPublicHttpOrigin,
  originFromRequest,
  appEndpointUrl,
} from '@micropay/site-meta'

import { getAppOrigin, getSiteOrigin } from '@micropay/site-meta'

/**
 * Public origin for this app deploy (OG / canonical on app pages).
 * Prefer PUBLIC_APP_URL; fall back to apex for single-site deploys.
 */
export function getPublicAppUrl(): string | undefined {
  return getAppOrigin() || getSiteOrigin()
}

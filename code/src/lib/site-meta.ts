/**
 * Code (IDE) re-exports of shared merchant / SEO identity.
 * Canonical source: `packages/site-meta` (@micropay/site-meta).
 *
 * App and IDE are separate product surfaces (own deploy / merchant card).
 * Same DATABASE_URL; code owns CodeUser / CodeActivity / CodeUserModelUsage /
 * CodeTemplate / CodeTemplateClone (not app User / Activity).
 */

export {
  CODE_DESCRIPTION,
  CODE_SERVICE_NAME,
  CODE_TAGLINE,
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

import { getCodeOrigin, getSiteOrigin } from '@micropay/site-meta'

/**
 * Public origin for this IDE deploy (OG / canonical).
 */
export function getPublicCodeUrl(): string | undefined {
  return getCodeOrigin() || getSiteOrigin()
}

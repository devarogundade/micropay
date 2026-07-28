import { createFileRoute, redirect } from '@tanstack/react-router'

import { LandingPage } from '#/components/landing/landing-page'
import { DEFAULT_SITE_ORIGIN, getSiteOrigin } from '#/lib/site-meta'

/**
 * Marketing still ships in-app for local / single-site deploys.
 * After landing is live on apex, set:
 *   VITE_REDIRECT_APEX_LANDING=true
 *   VITE_PUBLIC_SITE_URL=https://micropay.website
 * so `/` sends users to the GoPlausible entry surface.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (import.meta.env?.VITE_REDIRECT_APEX_LANDING !== 'true') return
    const site =
      (import.meta.env?.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(
        /\/$/,
        '',
      ) ||
      getSiteOrigin() ||
      DEFAULT_SITE_ORIGIN
    throw redirect({ href: `${site}/` })
  },
  component: LandingPage,
})

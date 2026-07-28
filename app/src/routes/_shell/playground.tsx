import { createFileRoute, redirect } from '@tanstack/react-router'

import { DEFAULT_CODE_ORIGIN, getCodeOrigin } from '#/lib/site-meta'

/**
 * Legacy path — send to the separate code product host.
 */
export const Route = createFileRoute('/_shell/playground')({
  beforeLoad: () => {
    const fromEnv = (
      import.meta.env?.VITE_PUBLIC_CODE_URL as string | undefined
    )?.replace(/\/$/, '')
    const code = fromEnv || getCodeOrigin() || DEFAULT_CODE_ORIGIN
    throw redirect({ href: `${code}/` })
  },
  // Redirect-only; component required so Start's route manifest stays valid.
  component: () => null,
})

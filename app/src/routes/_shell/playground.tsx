import { createFileRoute, redirect } from '@tanstack/react-router'

import { getCodeOrigin } from '#/lib/site-meta'

/**
 * Legacy path — prefer code.micropay.website when configured, else `/ide`.
 */
export const Route = createFileRoute('/_shell/playground')({
  beforeLoad: () => {
    const fromEnv = (
      import.meta.env?.VITE_PUBLIC_CODE_URL as string | undefined
    )?.replace(/\/$/, '')
    const code = fromEnv || getCodeOrigin() || ''
    if (code) {
      throw redirect({ href: `${code}/` })
    }
    throw redirect({ to: '/ide' })
  },
  // Redirect-only; component required so Start's route manifest stays valid.
  component: () => null,
})
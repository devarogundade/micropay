import { createFileRoute, redirect } from '@tanstack/react-router'

/** Legacy `/models` → app home (`/`). */
export const Route = createFileRoute('/_shell/models/')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
  component: () => null,
})

import { createFileRoute, redirect } from '@tanstack/react-router'

function legacyAppPath(pathname: string): string {
  const rest = pathname.replace(/^\/app\/?/, '')
  if (!rest) return '/models'
  if (rest === 'mcp' || rest.startsWith('mcp/')) return '/agents'
  return `/${rest}`
}

/** Catch leftover /app/... bookmarks and send them to /... */
export const Route = createFileRoute('/app/$')({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `${legacyAppPath(location.pathname)}${location.searchStr}${location.hash}`,
    })
  },
})

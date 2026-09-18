import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

function legacyAppPath(pathname: string): string {
  const rest = pathname.replace(/^\/app\/?/, '')
  if (!rest) return '/'
  // UI lived at /app/mcp; /mcp is the protocol endpoint.
  if (rest === 'mcp' || rest.startsWith('mcp/')) return '/mcp'
  return `/${rest}`
}

/** Legacy /app/* URLs → top-level routes (/, /activities, etc.). */
export const Route = createFileRoute('/app')({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `${legacyAppPath(location.pathname)}${location.searchStr}${location.hash}`,
    })
  },
  component: () => <Outlet />,
})

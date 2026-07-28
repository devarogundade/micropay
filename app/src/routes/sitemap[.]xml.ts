import { createFileRoute } from '@tanstack/react-router'

import { getPublicAppUrl, originFromRequest } from '#/lib/site-meta'

const PATHS = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/models', priority: '0.9', changefreq: 'daily' },
  { path: '/try', priority: '0.9', changefreq: 'weekly' },
  { path: '/api-reference', priority: '0.8', changefreq: 'weekly' },
  { path: '/activities', priority: '0.7', changefreq: 'weekly' },
  { path: '/ide', priority: '0.6', changefreq: 'weekly' },
  { path: '/agents', priority: '0.5', changefreq: 'weekly' },
  { path: '/llms.txt', priority: '0.5', changefreq: 'weekly' },
  { path: '/.well-known/x402.json', priority: '0.5', changefreq: 'weekly' },
] as const

function buildSitemap(origin: string): string {
  const urls = PATHS.map(
    ({ path, priority, changefreq }) => `  <url>
    <loc>${origin}${path === '/' ? '/' : path}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin =
          getPublicAppUrl() ||
          originFromRequest(request) ||
          new URL(request.url).origin

        return new Response(buildSitemap(origin.replace(/\/$/, '')), {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})

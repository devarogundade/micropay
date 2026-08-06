import { createFileRoute, Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { CodePageShell } from '#/components/templates/code-page-shell'
import { EmptyState } from '#/components/ui/empty-state'
import { ErrorState } from '#/components/ui/error-state'
import { Input } from '#/components/ui/input'
import { LoadingState } from '#/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { formatUsdc } from '#/data/models'
import {
  TEMPLATE_CLONE_USDC,
  fetchTemplates,
  type TemplateSort,
} from '#/lib/templates-client'
import { SITE_NAME } from '#/lib/site-meta'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/templates/')({
  component: TemplatesPage,
  head: () => ({
    meta: [
      { title: `Templates · IDE · ${SITE_NAME}` },
      {
        name: 'description',
        content:
          'Browse Algorand TypeScript IDE templates. Clone into your workspace for 0.1 USDC via x402.',
      },
    ],
  }),
})

function TemplatesPage() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<TemplateSort>('popular')

  const query = useQuery({
    queryKey: ['templates', q, category, sort],
    queryFn: () => fetchTemplates({ q, category, sort }),
    staleTime: 15_000,
  })

  const templates = query.data?.templates ?? []
  const categories = useMemo(() => {
    const fromApi = query.data?.categories ?? []
    return ['all', ...fromApi.filter((c) => c !== 'all')]
  }, [query.data?.categories])

  return (
    <CodePageShell
      title="Templates"
      description={`Starter Algorand TypeScript projects. Clone into the IDE for ${formatUsdc(TEMPLATE_CLONE_USDC)}.`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fog" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates…"
            className="pl-9"
            aria-label="Search templates"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c === 'all' ? 'All categories' : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as TemplateSort)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Sort templates">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Popular</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="clones-desc">Most cloned</SelectItem>
            <SelectItem value="clones-asc">Least cloned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <LoadingState className="mt-10" label="Loading templates…" />
      ) : query.isError ? (
        <ErrorState
          className="mt-10"
          title="Couldn’t load templates"
          description={
            query.error instanceof Error
              ? query.error.message
              : 'Something went wrong'
          }
          onRetry={() => void query.refetch()}
        />
      ) : templates.length === 0 ? (
        <EmptyState
          className="mt-10"
          title="No templates match"
          description="Try a different search or category."
        />
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id}>
              <Link
                to="/templates/$id"
                params={{ id: t.slug }}
                className={cn(
                  'flex h-full flex-col gap-2 rounded-md border border-border bg-carbon px-4 py-3.5 no-underline transition-colors',
                  'hover:border-mist/40 hover:bg-obsidian',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-paper">{t.name}</span>
                  {t.featured ? (
                    <span className="shrink-0 text-[10px] tracking-wide text-fog uppercase">
                      Featured
                    </span>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-[12px] text-fog">
                  {t.description}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                  <span className="capitalize">{t.category}</span>
                  <span>{t.clonedCount} cloned</span>
                  <span>{t.fileCount} files</span>
                  <span>{formatUsdc(TEMPLATE_CLONE_USDC)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CodePageShell>
  )
}

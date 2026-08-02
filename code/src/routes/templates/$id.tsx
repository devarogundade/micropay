import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { CodePageShell } from '#/components/templates/code-page-shell'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/ui/empty-state'
import { ErrorState } from '#/components/ui/error-state'
import { LoadingState } from '#/components/ui/loading-state'
import { ScrollArea } from '#/components/ui/scroll-area'
import { formatUsdc } from '#/data/models'
import { SITE_NAME } from '#/lib/site-meta'
import {
  TEMPLATE_CLONE_USDC,
  cloneTemplate,
  fetchTemplate,
  stashPendingTemplate,
} from '#/lib/templates-client'
import { useWallet } from '#/lib/wallet'
import { fetchCreditStats } from '#/lib/credit-stats'
import { queryKeys } from '#/lib/query-keys'
import { invalidateUsageQueries } from '#/lib/query-invalidation'

export const Route = createFileRoute('/templates/$id')({
  component: TemplateDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: `Template · ${params.id} · IDE · ${SITE_NAME}` },
      {
        name: 'description',
        content: `Clone Algorand TypeScript template ${params.id} into the Micropay IDE for 0.05 USDC.`,
      },
    ],
  }),
})

function TemplateDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { account, fetchWithPay, setConnectOpen } = useWallet()
  const [activeFile, setActiveFile] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['template', id],
    queryFn: () => fetchTemplate(id),
  })
  const creditQuery = useQuery({
    queryKey: queryKeys.userStats(account?.address),
    queryFn: () => fetchCreditStats(account!.address),
    enabled: Boolean(account?.address),
    staleTime: 15_000,
  })

  const template = query.data
  const previewPath =
    activeFile ?? template?.activePath ?? template?.files[0]?.path ?? null
  const previewFile = template?.files.find((f) => f.path === previewPath)
  const listPrice = template?.priceUsdc ?? TEMPLATE_CLONE_USDC
  const availableCredit = creditQuery.data?.dailyCreditRemainingUsdc ?? 0
  const estimatedCredit = Math.min(listPrice, availableCredit)
  const estimatedCharge = Math.max(0, listPrice - estimatedCredit)

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error('Template not loaded')
      if (!account) {
        setConnectOpen(true)
        throw new Error('Connect a wallet to clone')
      }
      if (!fetchWithPay) {
        throw new Error('Wallet payment is not ready')
      }
      return cloneTemplate({
        templateId: template.id,
        fetchImpl: fetchWithPay,
      })
    },
    onSuccess: (result) => {
      stashPendingTemplate(result.template)
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
      void queryClient.invalidateQueries({ queryKey: ['template', id] })
      void invalidateUsageQueries(queryClient, account?.address)
      toast.success(`Cloned ${result.template.name}`, {
        description:
          result.credit && result.credit.creditAppliedUsdc > 0
            ? result.costUsdc === 0
              ? `Covered by ${formatUsdc(result.credit.creditAppliedUsdc)} daily credit. Opening IDE…`
              : `${formatUsdc(result.credit.creditAppliedUsdc)} credit + ${formatUsdc(result.costUsdc)} wallet charge. Opening IDE…`
            : `Charged ${formatUsdc(result.costUsdc)}. Opening IDE…`,
      })
      void navigate({ to: '/' })
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : 'Clone payment failed'
      if (message.toLowerCase().includes('connect a wallet')) return
      toast.error(message)
    },
  })

  return (
    <CodePageShell>
      <Link
        to="/templates"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fog no-underline transition-colors hover:text-paper"
      >
        <ArrowLeft className="size-3.5" />
        All templates
      </Link>

      {query.isLoading ? (
        <LoadingState label="Loading template…" />
      ) : query.isError || !template ? (
        <ErrorState
          title="Template not found"
          description={
            query.error instanceof Error
              ? query.error.message
              : 'This template does not exist.'
          }
          onRetry={() => void navigate({ to: '/templates' })}
          retryLabel="Back to templates"
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-paper sm:text-2xl">
                  {template.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {template.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fog">
                  <span className="capitalize">{template.category}</span>
                  <span>{template.clonedCount} cloned</span>
                  <span>{template.files.length} files</span>
                  <span className="font-mono text-[11px]">{template.slug}</span>
                </div>
              </div>
            </div>

            {template.files.length === 0 ? (
              <EmptyState
                className="mt-8"
                title="No files"
                description="This template has no source files."
              />
            ) : (
              <div className="mt-6 overflow-hidden rounded-md border border-border bg-carbon">
                <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
                  {template.files.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => setActiveFile(f.path)}
                      className={
                        f.path === previewPath
                          ? 'rounded px-2 py-1 text-[11px] text-paper bg-obsidian'
                          : 'rounded px-2 py-1 text-[11px] text-fog hover:text-paper'
                      }
                    >
                      {f.path}
                    </button>
                  ))}
                </div>
                <ScrollArea className="h-[min(420px,50vh)]">
                  <pre className="p-4 font-mono text-[11px] leading-relaxed text-mist whitespace-pre-wrap">
                    {previewFile?.content ?? ''}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-md border border-border bg-carbon px-4 py-4">
              <p className="text-xs text-fog">Clone price</p>
              <p className="mt-1 text-lg font-semibold text-paper">
                {formatUsdc(listPrice)}
              </p>
              {account && creditQuery.data ? (
                <div className="mt-3 space-y-1.5 rounded-xl border border-border bg-void p-3 text-[11px]">
                  <div className="flex justify-between gap-3 text-fog">
                    <span>Daily credit</span>
                    <span className="text-pulse-green">-{formatUsdc(estimatedCredit)}</span>
                  </div>
                  <div className="flex justify-between gap-3 font-medium text-paper">
                    <span>Due from wallet</span>
                    <span>{formatUsdc(estimatedCharge)}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Connect to apply your daily credit. Any remainder settles via x402.
                </p>
              )}
              <Button
                className="mt-4 w-full"
                disabled={cloneMutation.isPending}
                onClick={() => {
                  if (!account) {
                    setConnectOpen(true)
                    return
                  }
                  cloneMutation.mutate()
                }}
              >
                <Copy className="size-4" />
                {cloneMutation.isPending
                  ? 'Cloning…'
                  : account
                    ? estimatedCharge === 0
                      ? 'Clone with credit'
                      : `Clone · ${formatUsdc(estimatedCharge)}`
                    : 'Connect to clone'}
              </Button>
            </div>
            <div className="text-[12px] text-muted-foreground">
              <p>
                Project name:{' '}
                <span className="text-fog">{template.projectName}</span>
              </p>
              <p className="mt-1">
                Entry:{' '}
                <span className="font-mono text-fog">{template.activePath}</span>
              </p>
            </div>
          </aside>
        </div>
      )}
    </CodePageShell>
  )
}

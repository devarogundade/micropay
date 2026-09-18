import { Plus, Trash2, Upload } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { AGENT_TYPE_META } from '#/components/agents/agent-meta'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { formatUsdc, type Model } from '#/data/models'
import {
  type Agent,
  type AgentInput,
  type AgentType,
} from '#/lib/agents-api'
import { MODELS_CATALOG_STALE_MS } from '#/lib/models-catalog-query'
import { fetchModelsCatalog } from '#/lib/models-catalog.functions'
import { useQuery } from '@tanstack/react-query'
import { uploadToStorage } from '#/lib/micropay-api'
import { queryKeys } from '#/lib/query-keys'

const MIN_AGENT_PRICE = 0.01
const MAX_AGENT_PRICE = 10

function modelTypeForAgent(type: AgentType): Model['type'] {
  if (type === 'image') return 'Image Gen'
  if (type === 'audio') return 'Audio'
  return 'Chat'
}

export function AgentForm({
  initial,
  busy,
  submitLabel = 'Create agent',
  onSubmit,
}: {
  initial?: Agent | null
  busy?: boolean
  submitLabel?: string
  onSubmit: (input: AgentInput) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [type, setType] = useState<AgentType>(initial?.type ?? 'chat')
  const [modelId, setModelId] = useState(initial?.modelId ?? '')
  const [price, setPrice] = useState(
    initial ? String(initial.priceUsdc) : '0.10',
  )
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null)
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '')
  const [knowledge, setKnowledge] = useState<Array<{ title: string; content: string }>>(
    initial?.knowledge?.length
      ? initial.knowledge.map((k) => ({ title: k.title, content: k.content }))
      : [{ title: '', content: '' }],
  )
  const [status, setStatus] = useState<'published' | 'draft'>(
    initial?.status === 'draft' ? 'draft' : 'published',
  )
  const [uploading, setUploading] = useState(false)

  const catalogQuery = useQuery({
    queryKey: queryKeys.modelsCatalog,
    queryFn: () => fetchModelsCatalog(),
    staleTime: MODELS_CATALOG_STALE_MS,
  })

  const models = useMemo(() => {
    const list = catalogQuery.data?.models ?? []
    return list.filter((m) => m.type === modelTypeForAgent(type))
  }, [catalogQuery.data, type])

  const priceNumber = Number(price)
  const priceValid =
    Number.isFinite(priceNumber) && priceNumber >= MIN_AGENT_PRICE && priceNumber <= MAX_AGENT_PRICE
  const valid =
    name.trim().length > 0 &&
    modelId.length > 0 &&
    priceValid

  async function handleAvatar(file: File | undefined) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be under 5 MB')
      return
    }
    setUploading(true)
    try {
      const result = await uploadToStorage({ file, folder: 'agents' })
      setImageUrl(result.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Avatar upload failed')
    } finally {
      setUploading(false)
    }
  }

  function updateKnowledge(index: number, patch: Partial<{ title: string; content: string }>) {
    setKnowledge((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    )
  }

  async function submit() {
    if (!valid) {
      toast.error('Fill in name, model, and a valid price (0.01–10 USDC)')
      return
    }
    const cleaned = knowledge
      .map((k) => ({ title: k.title.trim(), content: k.content.trim() }))
      .filter((k) => k.title || k.content)
    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      type,
      modelId,
      priceUsdc: priceNumber,
      imageUrl: imageUrl ?? null,
      systemPrompt: systemPrompt.trim() || null,
      knowledge: cleaned.length ? cleaned : null,
      status,
    })
  }

  return (
    <div className="space-y-6">
      <Section label="Basics">
        <Field label="Name" hint="Shown on the agent card and share link.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My trading analyst" maxLength={120} />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this agent do? Help buyers know when to prompt it."
            rows={3}
            maxLength={4000}
          />
        </Field>
        <Field label="Type" hint="Determines the model class and how buyers prompt the agent.">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(AGENT_TYPE_META) as AgentType[]).map((t) => {
              const meta = AGENT_TYPE_META[t]
              const active = type === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t)
                    setModelId('')
                  }}
                  className={
                    active
                      ? 'rounded-xl border border-ink bg-snow p-3 text-left shadow-sm'
                      : 'rounded-xl border border-border bg-snow p-3 text-left text-muted-foreground transition-colors hover:border-smoke'
                  }
                >
                  <div className="flex items-center gap-2">
                    {meta.icon}
                    <span className="text-sm font-medium text-ink">{meta.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>
                </button>
              )
            })}
          </div>
        </Field>
      </Section>

      <Section label="Model & pricing">
        <Field label="Underlying model" hint="Buyers pay per use — the model powers the agent.">
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="w-full" aria-label="Choose a model">
              <SelectValue placeholder={models.length ? 'Choose a model' : 'No models for this type'} />
            </SelectTrigger>
            <SelectContent>
              {models.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No {type} models available
                </SelectItem>
              ) : (
                models.map((m) => (
                  <SelectItem key={m.slug} value={m.slug}>
                    {m.name} · {m.provider}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Price per use (USDC)" hint={`${formatUsdc(MIN_AGENT_PRICE)} to ${formatUsdc(MAX_AGENT_PRICE)}. You earn this (after any daily credit) on every paid request.`}>
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            type="number"
            min={MIN_AGENT_PRICE}
            max={MAX_AGENT_PRICE}
            step={0.01}
          />
          {priceValid ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Buyers see <Badge variant="outline">{formatUsdc(priceNumber)}</Badge> per request.
            </p>
          ) : null}
        </Field>
      </Section>

      <Section label="Persona & knowledge">
        <Field label="System prompt (optional)" hint="Instructions that shape how the agent behaves.">
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful analyst who explains decisions in plain language."
            rows={3}
            maxLength={8000}
          />
        </Field>
        <Field
          label="Knowledge base"
          hint="Paste the knowledge this agent should answer from. Each entry is injected into its context."
        >
          <div className="space-y-3">
            {knowledge.map((entry, index) => (
              <div key={index} className="rounded-xl border border-border bg-snow p-3">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={entry.title}
                    onChange={(e) => updateKnowledge(index, { title: e.target.value })}
                    placeholder="Section title (e.g. Product FAQ)"
                    maxLength={500}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove entry"
                    onClick={() => setKnowledge((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Textarea
                  value={entry.content}
                  onChange={(e) => updateKnowledge(index, { content: e.target.value })}
                  placeholder="Knowledge content…"
                  rows={4}
                  className="mt-2"
                  maxLength={60000}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setKnowledge((prev) => [...prev, { title: '', content: '' }])}
            >
              <Plus className="size-4" />
              Add entry
            </Button>
          </div>
        </Field>
      </Section>

      <Section label="Avatar & visibility">
        <Field label="Avatar">
          <div className="flex items-center gap-4">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="size-16 rounded-2xl border border-border object-cover" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-border bg-snow text-muted-foreground">
                <Upload className="size-5" />
              </div>
            )}
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-snow px-3 py-2 text-sm font-medium text-ink hover:bg-accent">
                <Upload className="size-4" />
                {uploading ? 'Uploading…' : imageUrl ? 'Replace' : 'Upload image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void handleAvatar(e.target.files?.[0])}
                />
              </label>
              {imageUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(null)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </Field>
        <Field label="Visibility">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={status === 'published' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatus('published')}
            >
              Published
            </Button>
            <Button
              type="button"
              variant={status === 'draft' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatus('draft')}
            >
              Draft
            </Button>
            <span className="text-xs text-muted-foreground">
              {status === 'published'
                ? 'Anyone with the link can use and pay for this agent.'
                : 'Only you can see this agent.'}
            </span>
          </div>
        </Field>
      </Section>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <Button type="button" onClick={() => void submit()} disabled={busy || !valid || uploading}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
import { Image as ImageIcon, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { formatUsdc } from '#/data/models'
import { agentImageGeneration, type Agent } from '#/lib/agents-api'
import { useWallet } from '#/lib/wallet'

export function AgentImage({ agent }: { agent: Agent }) {
  const { account, fetchWithPay, setConnectOpen } = useWallet()
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  async function generate() {
    const text = prompt.trim()
    if (!text || busy) return
    if (!account || !fetchWithPay) {
      setConnectOpen(true)
      toast.message('Connect a wallet to generate images')
      return
    }
    setBusy(true)
    setImages([])
    try {
      const result = await agentImageGeneration({
        slug: agent.slug,
        model: agent.modelId,
        prompt: text,
        fetchImpl: fetchWithPay,
        walletAddress: account.address,
        onStatus: (label) => setStatus(label),
      })
      if (!result.ok) {
        toast.error(result.error || 'Generation failed')
        return
      }
      setImages(result.images)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-3 pb-40 pt-6 md:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">{agent.name}</h2>
          <p className="text-sm text-muted-foreground">
            {formatUsdc(agent.priceUsdc)} / image · by {agent.creatorShort}
          </p>
        </div>

        {images.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${agent.name} result ${i + 1}`}
                className="aspect-square w-full rounded-2xl border border-border object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-snow text-muted-foreground">
            <ImageIcon className="size-8" />
            <p className="text-sm">Generated images will appear here</p>
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Describe the image you want ${agent.name} to create…`}
            rows={3}
            maxLength={4000}
          />
          <div className="flex items-center justify-between gap-3">
            {status ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {status}
              </p>
            ) : (
              <span className="text-xs text-muted-foreground">
                {formatUsdc(agent.priceUsdc)} per generation, settled by your wallet.
              </span>
            )}
            <Button type="button" onClick={() => void generate()} disabled={busy || !prompt.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Generate
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
import { AudioLines, FileUp, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { formatUsdc } from '#/data/models'
import { agentAudioTranscription, type Agent } from '#/lib/agents-api'
import { useWallet } from '#/lib/wallet'

export function AgentAudio({ agent }: { agent: Agent }) {
  const { account, fetchWithPay, setConnectOpen } = useWallet()
  const [fileName, setFileName] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  async function transcribe(file: File | undefined) {
    if (!file) return
    if (busy) return
    if (!account || !fetchWithPay) {
      setConnectOpen(true)
      toast.message('Connect a wallet to transcribe audio')
      return
    }
    setFileName(file.name)
    setTranscript('')
    setBusy(true)
    setStatus('Uploading audio…')
    try {
      const result = await agentAudioTranscription({
        slug: agent.slug,
        model: agent.modelId,
        file,
        filename: file.name,
        fetchImpl: fetchWithPay,
      })
      setStatus('')
      if (!result.ok) {
        toast.error(result.error || 'Transcription failed')
        return
      }
      setTranscript(result.text)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-3 pb-40 pt-6 md:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">{agent.name}</h2>
          <p className="text-sm text-muted-foreground">
            {formatUsdc(agent.priceUsdc)} / transcription · by {agent.creatorShort}
          </p>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-snow px-6 py-10 text-center text-muted-foreground transition-colors hover:border-smoke">
          <AudioLines className="size-8" />
          <span className="text-sm font-medium text-ink">
            {busy ? status : fileName || 'Choose an audio file'}
          </span>
          <span className="text-xs">{busy ? 'Transcribing…' : 'MP3, WAV, M4A, OGG, WebM'}</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => void transcribe(e.target.files?.[0])}
          />
          {busy ? (
            <Button type="button" variant="secondary" size="sm" disabled>
              <Loader2 className="size-4 animate-spin" />
              Working…
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm">
              <FileUp className="size-4" />
              Upload audio
            </Button>
          )}
        </label>

        {transcript ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Transcript
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{transcript}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
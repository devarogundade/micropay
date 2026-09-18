import { Copy, Link2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AgentAvatar, AgentTypeBadge } from '#/components/agents/agent-meta'
import { AgentAudio } from '#/components/agents/agent-audio'
import { AgentChat } from '#/components/agents/agent-chat'
import { AgentImage } from '#/components/agents/agent-image'
import { Button } from '#/components/ui/button'
import { formatUsdc } from '#/data/models'
import type { Agent } from '#/lib/agents-api'
import { siteOrigin } from '#/lib/app-nav'

export function agentShareUrl(slug: string): string {
  const base = (typeof window !== 'undefined' ? window.location.origin : '') || siteOrigin()
  return `${base}/agents/${slug}`
}

export function AgentStudio({ agent }: { agent: Agent }) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    const url = agentShareUrl(agent.slug)
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true)
        toast.success('Agent link copied')
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => toast.error('Could not copy link'))
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <header className="workspace-bar flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 sm:gap-3 sm:px-5">
        <AgentAvatar agent={agent} className="size-9 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight text-ink sm:text-base">
              {agent.name}
            </h1>
            <AgentTypeBadge type={agent.type} className="hidden sm:inline-flex" />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {formatUsdc(agent.priceUsdc)} / use · by {agent.creatorShort}
            {agent.useCount > 0 ? ` · ${agent.useCount} uses` : ''}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={copyLink}>
          {copied ? <Copy className="size-4" /> : <Link2 className="size-4" />}
          {copied ? 'Copied' : 'Share'}
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        {agent.type === 'image' ? (
          <AgentImage agent={agent} />
        ) : agent.type === 'audio' ? (
          <AgentAudio agent={agent} />
        ) : (
          <AgentChat agent={agent} />
        )}
      </div>
    </div>
  )
}